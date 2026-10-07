// 第 56 轮：开场引导测试（三步内容/一次性记忆/完成与跳过不阻塞/SSR 空存储安全）
// 验收口径（PROMPT-V3.md 第 56 轮）：
// - 三步引导文案与切换；跳过与完成都写独立键 another-life:tutorial=done
// - 二次进入（done 态）组件返回 null 不渲染；无 localStorage 环境（SSR）安全
// - 接线点：GamePage 挂载 <Tutorial />；验收的 CDP 流程在 mobile_verify M15
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import HomePage from '../pages/HomePage'
import { Tutorial, TUTORIAL_STEPS, tutorialDone, markTutorialDone } from '../components/Tutorial'

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

describe('第 56 轮：引导数据与记忆', () => {
  it('三步文案齐备且非空（属性/选择/跨年）', () => {
    expect(TUTORIAL_STEPS).toHaveLength(3)
    expect(TUTORIAL_STEPS[0].title).toContain('五个数字')
    expect(TUTORIAL_STEPS[1].title).toContain('选择')
    expect(TUTORIAL_STEPS[2].title).toContain('翻过一年')
    for (const s of TUTORIAL_STEPS) {
      expect(s.body.length).toBeGreaterThan(20)
    }
  })

  it('一次性记忆：markTutorialDone 写 done；tutorialDone 读态翻转；异常环境视为已完成', () => {
    const restore = installStorage()
    try {
      expect(tutorialDone()).toBe(false)
      markTutorialDone()
      expect(tutorialDone()).toBe(true)
      expect(localStorage.getItem('another-life:tutorial')).toBe('done')
    } finally {
      restore()
    }
  })
})

describe('第 56 轮：浮层渲染', () => {
  it('未完成态：渲染步骤标题/跳过/下一步；跳过后（done）同组件返回 null', () => {
    const restore = installStorage()
    try {
      const html = renderToStaticMarkup(<Tutorial />)
      expect(html).toContain('第 1 步 · 共 3 步')
      expect(html).toContain('五个数字')
      expect(html).toContain('跳过引导')
      expect(html).toContain('下一步')
      expect(html).not.toContain('undefined')
      // 完成/跳过 → done → 不渲染
      markTutorialDone()
      expect(renderToStaticMarkup(<Tutorial />)).toBe('')
    } finally {
      restore()
    }
  })

  it('SSR/无存储环境：视为已完成不渲染（绝不阻塞页面）', () => {
    // 当前 jsdom 之外的本 describe 无存储——直接验证组件在无 localStorage 时安全
    const prev = (globalThis as Record<string, unknown>).localStorage
    delete (globalThis as Record<string, unknown>).localStorage
    try {
      expect(tutorialDone()).toBe(true)
      expect(renderToStaticMarkup(<Tutorial />)).toBe('')
    } finally {
      ;(globalThis as Record<string, unknown>).localStorage = prev
    }
  })

  it('GamePage 接线点存在：<Tutorial /> 挂载（呈现层）', () => {
    const src = readFileSync(new URL('../pages/GamePage.tsx', import.meta.url), 'utf8')
    expect(src).toContain('<Tutorial />')
  })

  it('独立键与存档隔离：tutorial 键写入不触碰 save/legacy 键', () => {
    const restore = installStorage({ 'another-life:save': '{"saveVersion":2}', 'another-life:legacy': '[]' })
    try {
      markTutorialDone()
      expect(localStorage.getItem('another-life:save')).toBe('{"saveVersion":2}')
      expect(localStorage.getItem('another-life:legacy')).toBe('[]')
    } finally {
      restore()
    }
  })
})

describe('第 56 轮：首页开场文案（节奏打磨）', () => {
  it('首页副标题保留年度选择定位（本轮微调后仍完整）', () => {
    const src = readFileSync(new URL('../pages/HomePage.tsx', import.meta.url), 'utf8')
    expect(src).toContain('每年做一次选择')
    expect(src).toContain('所有决定都会写进你的人生')
  })
})

// HomePage 引用保真（renderToStaticMarkup 冒烟在既有测试覆盖，此处防误删 import）
void HomePage
