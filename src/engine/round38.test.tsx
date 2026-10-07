// 第 38 轮（移动端与氛围）。
// 覆盖：sound 偏好纯逻辑（默认关/持久化/存储不可用不炸）、合成发声路径（开启时真实
// 走到 AudioContext 图、关闭时零构造、AC 抛错安全）、HomePage 音效开关两态渲染、
// App 接线点存在（onChoose→咔哒 / onNext→翻页）、CSS（--tap token、触控 ≥44、
// 结算面板 sticky 吸底、safe-area、不新增 @media）、index.html viewport-fit=cover。
// 呈现轮：引擎/事件数据/存档零改动；node 环境无真实 DOM/存储，用注入桩验证逻辑。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import HomePage from '../pages/HomePage'
import { soundEnabled, setSoundEnabled, playClick, playPageFlip, getVolume, setVolume, hasExplicitPreference } from '../sound'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const appSrc = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
const endingSrc = readFileSync(new URL('../pages/EndingPage.tsx', import.meta.url), 'utf8')

/** 内存版 localStorage（node 环境无真实存储） */
function installMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const stub: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  }
  const prev = (globalThis as Record<string, unknown>).localStorage
  ;(globalThis as Record<string, unknown>).localStorage = stub
  return () => {
    ;(globalThis as Record<string, unknown>).localStorage = prev
  }
}

/** AudioContext 探针桩：记录节点图调用，可注入构造失败 */
interface FakeNode {
  connect: (n: FakeNode) => FakeNode
  frequency?: { setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void }
  gain?: { setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void }
  Q?: { value: number }
  type?: string
  buffer?: unknown
  start: (t: number) => void
  stop: (t: number) => void
}
function installFakeAudio(opts: { throwOnConstruct?: boolean } = {}) {
  const calls = { created: 0, started: 0, oscillators: 0, sources: 0, buffers: 0 }
  const makeNode = (kind: 'osc' | 'src' | 'gain' | 'filter'): FakeNode => ({
    connect(n: FakeNode) {
      return n
    },
    start() {
      if (kind === 'osc') calls.oscillators++
      if (kind === 'src') calls.sources++
      calls.started++
    },
    stop() {},
    ...(kind === 'osc' || kind === 'filter'
      ? { frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }
      : {}),
    ...(kind === 'gain'
      ? { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }
      : {}),
    ...(kind === 'filter' ? { Q: { value: 1 } } : {}),
  })
  class FakeAC {
    currentTime = 0
    sampleRate = 48000
    state = 'running'
    destination = makeNode('gain')
    constructor() {
      if (opts.throwOnConstruct) throw new Error('no audio hardware')
      calls.created++
    }
    createOscillator(): FakeNode {
      return makeNode('osc')
    }
    createGain(): FakeNode {
      return makeNode('gain')
    }
    createBiquadFilter(): FakeNode {
      return makeNode('filter')
    }
    createBuffer(_ch: number, len: number, _rate: number): unknown {
      calls.buffers++
      return { getChannelData: () => new Float32Array(len) }
    }
    createBufferSource(): FakeNode {
      return makeNode('src')
    }
    resume() {
      return Promise.resolve()
    }
  }
  const prevWindow = (globalThis as Record<string, unknown>).window
  ;(globalThis as Record<string, unknown>).window = { AudioContext: FakeAC }
  return { calls, restore: () => { (globalThis as Record<string, unknown>).window = prevWindow } }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage
  delete (globalThis as Record<string, unknown>).window
})

// ── sound：偏好纯逻辑 ────────────────────────────────────────

describe('sound：偏好默认关、持久化、存储不可用安全', () => {
  it('无存储环境（node）默认关闭：soundEnabled() 为 false', () => {
    expect(soundEnabled()).toBe(false)
  })

  it('开启后读到 true；第 52 轮三态起持久值为 high（高档）；关闭写回 off', () => {
    const restore = installMemoryStorage()
    try {
      expect(soundEnabled()).toBe(false)
      setSoundEnabled(true)
      expect(soundEnabled()).toBe(true)
      // 第 52 轮语义适配：setSoundEnabled(true) 写 'high'（三态高档），不再写旧 'on'
      expect(globalThis.localStorage.getItem('another-life:sound')).toBe('high')
      setSoundEnabled(false)
      expect(soundEnabled()).toBe(false)
      expect(globalThis.localStorage.getItem('another-life:sound')).toBe('off')
    } finally {
      restore()
    }
  })

  it('存储不可用（读抛错/写抛错）绝不炸，读恒 false', () => {
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(soundEnabled()).toBe(false)
    expect(() => setSoundEnabled(true)).not.toThrow()
  })
})

// ── sound：合成发声路径 ──────────────────────────────────────

describe('sound：发声路径（开启时走节点图、关闭时零构造、AC 故障安全）', () => {
  it('默认关：playClick/playPageFlip 直接早退，AudioContext 从未构造', () => {
    const fake = installFakeAudio()
    try {
      expect(() => {
        playClick()
        playPageFlip()
      }).not.toThrow()
      expect(fake.calls.created).toBe(0)
      expect(fake.calls.started).toBe(0)
    } finally {
      fake.restore()
    }
  })

  it('开启后：咔哒走振荡器、翻页走噪声缓冲源，各自真实 start', () => {
    const restoreStorage = installMemoryStorage({ 'another-life:sound': 'on' })
    const fake = installFakeAudio()
    try {
      playClick()
      expect(fake.calls.oscillators).toBe(1)
      expect(fake.calls.started).toBe(1)
      playPageFlip()
      expect(fake.calls.buffers).toBe(1)
      expect(fake.calls.sources).toBe(1)
      expect(fake.calls.started).toBe(2)
    } finally {
      fake.restore()
      restoreStorage()
    }
  })

  it('AudioContext 构造抛错（无音频硬件）时安全 no-op', () => {
    const restoreStorage = installMemoryStorage({ 'another-life:sound': 'on' })
    const fake = installFakeAudio({ throwOnConstruct: true })
    try {
      expect(() => {
        playClick()
        playPageFlip()
      }).not.toThrow()
      expect(fake.calls.started).toBe(0)
    } finally {
      fake.restore()
      restoreStorage()
    }
  })
})

// ── 接线：HomePage 开关两态 + App 发声点 ─────────────────────

describe('接线：HomePage 音效开关与 App 发声点', () => {
  const home = () =>
    renderToStaticMarkup(
      <HomePage
        saveMeta={null}
        saveState="none"
        saveReason=""
        importError={null}
        pendingImport={null}
        onContinue={() => {}}
        onStart={() => {}}
        onImportFile={() => {}}
        onConfirmImport={() => {}}
        onCancelImport={() => {}}
        onExportRaw={() => {}}
      />,
    )

  it('默认态：按钮「音效：关」且 aria-pressed=false（aria 文案注明默认）', () => {
    expect(home()).toContain('aria-pressed="false"')
    expect(home()).toContain('音效：关')
    expect(home()).toContain('已关闭（默认）')
  })

  it('旧档偏好 on 迁移为高档：按钮「音效：高」且 aria-pressed=true（第 52 轮三态迁移）', () => {
    const restore = installMemoryStorage({ 'another-life:sound': 'on' })
    try {
      expect(home()).toContain('aria-pressed="true"')
      expect(home()).toContain('音效：高')
    } finally {
      restore()
    }
  })

  it('App 接线点存在：onChoose 内 playClick、onNext 内 playPageFlip（呈现层，引擎零改动）', () => {
    expect(appSrc).toContain('playClick()')
    expect(appSrc).toContain('playPageFlip()')
  })

  it('第 52 轮接线点存在：App 成就音、EndingPage 盖章音（呈现层）', () => {
    expect(appSrc).toContain('playAchievement()')
    expect(endingSrc).toContain('playStamp()')
  })
})

// ── 第 52 轮：三态音量、旧档迁移、新音效 ───────────────────────

/** sound.ts 的 AudioContext 为模块级单例——用 vi.resetModules + 动态 import 取全新模块，
 *  避免与既有发声测试的桩缓存串线（每测一桩、计数干净）。 */
async function freshSound() {
  vi.resetModules()
  return await import('../sound')
}

describe('第 52 轮：三态音量与旧档迁移', () => {
  it('getVolume：off/low/high 原样读；旧 on 迁移 high；无记录与异常环境 off', () => {
    const restore = installMemoryStorage({ 'another-life:sound': 'low' })
    try {
      expect(getVolume()).toBe('low')
    } finally {
      restore()
    }
    const restore2 = installMemoryStorage({ 'another-life:sound': 'high' })
    try {
      expect(getVolume()).toBe('high')
    } finally {
      restore2()
    }
    const restore3 = installMemoryStorage({ 'another-life:sound': 'on' })
    try {
      expect(getVolume()).toBe('high') // 旧两态档迁移：显式开启 → 高
      expect(soundEnabled()).toBe(true)
    } finally {
      restore3()
    }
    const restore4 = installMemoryStorage()
    try {
      expect(getVolume()).toBe('off')
      expect(hasExplicitPreference()).toBe(false)
    } finally {
      restore4()
    }
  })

  it('setVolume 三态持久化；hasExplicitPreference 键存在即真', () => {
    const restore = installMemoryStorage()
    try {
      expect(hasExplicitPreference()).toBe(false)
      setVolume('low')
      expect(getVolume()).toBe('low')
      expect(hasExplicitPreference()).toBe(true)
      setVolume('high')
      expect(getVolume()).toBe('high')
      setVolume('off')
      expect(getVolume()).toBe('off')
      expect(hasExplicitPreference()).toBe(true) // 显式关也是显式偏好
    } finally {
      restore()
    }
  })
})

describe('第 52 轮：成就音与盖章音（发声路径与安全）', () => {
  it('音效关：playAchievement/playStamp 直接早退，AudioContext 零构造', async () => {
    const sound = await freshSound()
    const restore = installMemoryStorage()
    const fake = installFakeAudio()
    try {
      sound.playAchievement()
      sound.playStamp()
      expect(fake.calls.created).toBe(0)
      expect(fake.calls.started).toBe(0)
    } finally {
      restore()
      fake.restore()
    }
  })

  it('音效开：成就音两振荡器琶音、盖章音单振荡器，均真实 start', async () => {
    const sound = await freshSound()
    const restore = installMemoryStorage({ 'another-life:sound': 'high' })
    const fake = installFakeAudio()
    try {
      sound.playAchievement()
      expect(fake.calls.oscillators).toBe(2)
      sound.playStamp()
      expect(fake.calls.oscillators).toBe(3)
      expect(fake.calls.started).toBe(3)
    } finally {
      restore()
      fake.restore()
    }
  })

  it('低档同样出声（同一发声路径，增益乘数在参数内）', async () => {
    const sound = await freshSound()
    const restore = installMemoryStorage({ 'another-life:sound': 'low' })
    const fake = installFakeAudio()
    try {
      sound.playClick()
      expect(fake.calls.started).toBe(1)
    } finally {
      restore()
      fake.restore()
    }
  })

  it('AudioContext 构造失败：新音效安全 no-op 不抛错', async () => {
    const sound = await freshSound()
    const restore = installMemoryStorage({ 'another-life:sound': 'high' })
    const fake = installFakeAudio({ throwOnConstruct: true })
    try {
      expect(() => sound.playAchievement()).not.toThrow()
      expect(() => sound.playStamp()).not.toThrow()
      expect(fake.calls.created).toBe(0)
    } finally {
      restore()
      fake.restore()
    }
  })
})

// ── CSS：触控 / 吸底操作栏 / safe-area ───────────────────────

describe('CSS：移动端触控与底部操作栏（token 体系，不新增 @media）', () => {
  it('--tap token 定义为 44px（触控目标最小高度）', () => {
    expect(css).toMatch(/--tap:\s*44px/)
  })

  it('420px 媒体块内：.btn/.choice-btn/summary 触控目标 ≥ var(--tap)', () => {
    const media = css.match(/@media \(max-width: 420px\)\s*\{[\s\S]*?\n\}/)
    expect(media).toBeTruthy()
    const block = media![0]
    const touch = block.match(/\.btn,\s*\n\s*\.choice-btn,\s*\n\s*summary\s*\{[^}]*\}/)
    expect(touch).toBeTruthy()
    expect(touch![0]).toContain('min-height: var(--tap)')
  })

  it('420px 媒体块内：结算面板 sticky 吸底（safe-area + 抬层 + 大阴影）', () => {
    const block = css.match(/@media \(max-width: 420px\)\s*\{[\s\S]*?\n\}/)![0]
    const sticky = block.match(/\.result-panel\s*\{[^}]*\}/)
    expect(sticky).toBeTruthy()
    expect(sticky![0]).toContain('position: sticky')
    expect(sticky![0]).toContain('env(safe-area-inset-bottom, 0px)')
    expect(sticky![0]).toContain('z-index: var(--z-raised)')
    expect(sticky![0]).toContain('box-shadow: var(--shadow-lg)')
  })

  it('420px 媒体块内：.app 底 padding 计入 safe-area；@media 总数保持 2（不新增）', () => {
    const block = css.match(/@media \(max-width: 420px\)\s*\{[\s\S]*?\n\}/)![0]
    const app = block.match(/\.app\s*\{[^}]*\}/)
    expect(app).toBeTruthy()
    expect(app![0]).toContain('calc(var(--sp-40) + env(safe-area-inset-bottom, 0px))')
    expect((css.match(/@media/g) ?? []).length).toBe(2)
  })
})

// ── index.html：viewport-fit=cover ──────────────────────────

describe('index.html：viewport 携带 viewport-fit=cover（safe-area 生效前提）', () => {
  it('meta viewport 含 viewport-fit=cover', () => {
    expect(html).toMatch(/name="viewport"\s+content="[^"]*viewport-fit=cover/)
  })
})
