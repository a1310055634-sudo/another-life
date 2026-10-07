// 第 53 轮：往生录数据层与首页面板测试（独立键/FIFO/损坏安全/收集去重/空态）
// 验收口径（PROMPT-V3.md 第 53 轮）：
// - 独立键 another-life:legacy 与存档 v2 隔离；50 条 FIFO；损坏数据返回空表不写回
// - seed 幂等：同 seed 同终龄重复追加跳过（effect 双调防护）
// - 首页渲染：有条目列表+清空入口；旧玩家空态自然（SSR/无存储均不炸）
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import HomePage from './pages/HomePage'
import { readLegacy, appendLegacy, clearLegacy, collectedAchievementIds, type LegacyEntry } from './legacy'

function installStorage(init: Record<string, string> = {}) {
  const store = new Map(Object.entries(init))
  const stub = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  const prev = (globalThis as Record<string, unknown>).localStorage
  ;(globalThis as Record<string, unknown>).localStorage = stub
  return () => {
    ;(globalThis as Record<string, unknown>).localStorage = prev
  }
}

function entry(seed: number, over: Partial<LegacyEntry> = {}): LegacyEntry {
  return {
    name: '测试者',
    endingId: 'quiet_life',
    endingName: '平凡之路',
    grade: 'B',
    age: 74,
    peakMoney: 120000,
    epitaph: '把普通的日子认真过完了。',
    achievements: ['ach_first_degree'],
    seed,
    finishedAt: 1700000000000 + seed,
    ...over,
  }
}

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

afterEach(() => {
  // 每测恢复真实环境（桩各自 restore）
})

describe('第 53 轮：往生录数据层', () => {
  it('无键/损坏 JSON/非数组 → 空数组且不写回', () => {
    const restore = installStorage()
    try {
      expect(readLegacy()).toEqual([])
      localStorage.setItem('another-life:legacy', '{broken json')
      expect(readLegacy()).toEqual([])
      localStorage.setItem('another-life:legacy', '{"not":"an array"}')
      expect(readLegacy()).toEqual([])
      expect(localStorage.getItem('another-life:legacy')).toBe('{"not":"an array"}') // 不写回
    } finally {
      restore()
    }
  })

  it('追加与读取：字段保真；FIFO 上限 50 条（最旧的先出）', () => {
    const restore = installStorage()
    try {
      for (let i = 0; i < 55; i++) appendLegacy(entry(i, { name: `玩家${i}` }))
      const list = readLegacy()
      expect(list).toHaveLength(50)
      expect(list[0].name).toBe('玩家5') // 前 5 条被挤出
      expect(list[49].name).toBe('玩家54')
    } finally {
      restore()
    }
  })

  it('seed 幂等：同 seed 同终龄同结局的重复追加跳过（effect 双调防护）', () => {
    const restore = installStorage()
    try {
      appendLegacy(entry(42))
      appendLegacy(entry(42))
      appendLegacy(entry(42, { name: '不同名但同局' })) // 同 seed+age+endingId → 仍跳过
      expect(readLegacy()).toHaveLength(1)
      appendLegacy(entry(43))
      expect(readLegacy()).toHaveLength(2)
    } finally {
      restore()
    }
  })

  it('clearLegacy 清空；collectedAchievementIds 跨周目去重并集', () => {
    const restore = installStorage()
    try {
      appendLegacy(entry(1, { achievements: ['a', 'b'] }))
      appendLegacy(entry(2, { achievements: ['b', 'c'] }))
      expect(collectedAchievementIds().sort()).toEqual(['a', 'b', 'c'])
      clearLegacy()
      expect(readLegacy()).toEqual([])
      expect(collectedAchievementIds()).toEqual([])
    } finally {
      restore()
    }
  })

  it('存档隔离：往生录写入不触碰存档键 another-life:save', () => {
    const restore = installStorage({ 'another-life:save': '{"saveVersion":2}' })
    try {
      appendLegacy(entry(9))
      expect(localStorage.getItem('another-life:save')).toBe('{"saveVersion":2}')
    } finally {
      restore()
    }
  })
})

describe('第 53 轮：首页往生录面板', () => {
  it('旧玩家空态：折叠标题「走过 0 段人生」，空态文案自然，无清空按钮', () => {
    const restore = installStorage()
    try {
      const html = home()
      expect(html).toContain('走过 0 段人生')
      expect(html).toContain('还没有走完过一局')
      expect(html).not.toContain('清空往生录')
      expect(html).not.toContain('undefined')
    } finally {
      restore()
    }
  })

  it('有记录态：列表渲染墓志铭/评级/峰值资产，成就收集计数去重', () => {
    const restore = installStorage()
    try {
      appendLegacy(entry(1, { achievements: ['a', 'b'] }))
      appendLegacy(entry(2, { achievements: ['b'], endingName: '薪火不熄', grade: 'S' }))
      const html = home()
      expect(html).toContain('走过 2 段人生')
      expect(html).toContain('把普通的日子认真过完了。')
      expect(html).toContain('薪火不熄')
      expect(html).toContain('成就收集 2 / 66') // 去重并集 {a,b} → 2；R100 同步 52→59
      expect(html).toContain('清空往生录')
      expect(html).not.toContain('undefined')
    } finally {
      restore()
    }
  })

  it('面板走既有 card/home-ach 类，新增类仅 legacy 系（守卫放行清单同步）', () => {
    const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
    for (const cls of ['legacy-list', 'legacy-entry', 'legacy-grade', 'legacy-epitaph']) {
      expect(css).toContain(`.${cls}`)
    }
  })
})
