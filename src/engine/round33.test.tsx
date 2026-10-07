// 第 33 轮（动效 I：结算反馈）。
// 覆盖：count-up 纯函数（结束帧精确等于结算值、中间帧整数单调）、
// reduced-motion 探测在无 DOM 环境安全降级、CountUp 静态渲染直出终值（不遮挡数据）、
// GamePage 结算面板金钱 delta 走 count-up 而其余 delta 维持纯文本、
// CSS 侧按压反馈与 prefers-reduced-motion 降级块、COUNT_UP_MS 与 --dur-slow token 同源。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { CountUp, countFrame, easeOutCubic, COUNT_UP_MS, prefersReducedMotion } from '../components/CountUp'
import { fmtSigned } from '../components/AttrBar'
import GamePage from '../pages/GamePage'
import { createNewGame } from './init'
import type { ChoiceDelta, Session } from './session'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

function makeSession(deltas: ChoiceDelta[]): Session {
  const state = createNewGame({ seed: 42, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { state, currentEvent: null, awaitingAdvance: true, lastSummary: '这一年过去了。', lastDeltas: deltas }
}

function renderGame(deltas: ChoiceDelta[]): string {
  return renderToStaticMarkup(
    <GamePage session={makeSession(deltas)} onChoose={() => {}} onNext={() => {}} onRestart={() => {}} />
  )
}

// ── count-up 纯函数 ──────────────────────────────────────────

describe('countFrame：动画结束值与结算值完全一致', () => {
  it('t>=1 时精确返回终值（正数/负数/零/大数），不依赖浮点插值收敛', () => {
    expect(countFrame(0, 12000, 1)).toBe(12000)
    expect(countFrame(0, -9000, 1)).toBe(-9000)
    expect(countFrame(0, 0, 1)).toBe(0)
    expect(countFrame(0, 1234567, 1)).toBe(1234567)
    expect(countFrame(0, 12000, 1.5)).toBe(12000)
    expect(countFrame(100, 200, 1)).toBe(200)
  })

  it('t<=0 返回起点；中间帧恒为整数且单调趋近终值', () => {
    expect(countFrame(0, 12000, 0)).toBe(0)
    expect(countFrame(0, 12000, -0.5)).toBe(0)
    let prev = 0
    for (let t = 0.05; t <= 0.95; t += 0.05) {
      const v = countFrame(0, 12000, t)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(prev).toBeLessThan(12000)
  })

  it('负向金额单调递减趋近终值', () => {
    let prev = 0
    for (let t = 0.05; t <= 0.95; t += 0.05) {
      const v = countFrame(0, -9000, t)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
    expect(countFrame(0, -9000, 1)).toBe(-9000)
  })

  it('easeOutCubic 端点为 0/1 且单调递增（快出缓收，观感对齐 --ease-out）', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    let prev = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeOutCubic(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('COUNT_UP_MS 与 index.css 的 --dur-slow token 同源（320ms）', () => {
    const m = css.match(/--dur-slow:\s*(\d+)ms/)
    expect(m).toBeTruthy()
    expect(COUNT_UP_MS).toBe(Number(m![1]))
  })
})

// ── reduced-motion 降级 ──────────────────────────────────────

describe('prefers-reduced-motion：无动画且数据不变', () => {
  it('无 window/matchMedia 的环境（node/SSR）判定为需要降级，直接显示终值', () => {
    expect(prefersReducedMotion()).toBe(true)
  })

  it('CountUp 静态渲染直出终值（无 JS、首帧、降级路径都不缺席数据）', () => {
    expect(renderToStaticMarkup(<CountUp value={12000} format={fmtSigned} />)).toContain('+12,000')
    expect(renderToStaticMarkup(<CountUp value={-9000} format={fmtSigned} />)).toContain('-9,000')
    expect(renderToStaticMarkup(<CountUp value={0} format={fmtSigned} />)).toContain('>0<')
  })

  it('CSS 侧降级块存在：过渡与按压位移全部关闭，attr-fill 过渡纳入降级', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(idx).toBeGreaterThan(-1)
    const block = css.slice(idx)
    for (const sel of ['.btn', '.choice-btn', '.opt-card', '.attr-fill']) {
      expect(block).toContain(sel)
    }
    expect(block).toContain('transition: none')
    expect(block).toContain('transform: none')
  })
})

// ── 结算面板集成 ─────────────────────────────────────────────

describe('GamePage 结算面板：金钱 delta 走 count-up，其余 delta 维持纯文本', () => {
  it('金钱增/减 delta 渲染为无属性 span 包裹的终值文本', () => {
    expect(renderGame([{ money: 12000 }])).toContain('金钱 <span>+12,000</span>')
    expect(renderGame([{ money: -9000 }])).toContain('金钱 <span>-9,000</span>')
  })

  it('属性/技能/职业/关系 delta 不经 count-up，保持既有纯文本', () => {
    const html = renderGame([
      { attr: 'health', delta: 5 },
      { skill: 'academics', delta: 3 },
      { job: '入职：市集摊主' },
      { relation: '结识新朋友' },
    ])
    expect(html).toContain('健康 +5')
    expect(html).toContain('学业 +3')
    expect(html).toContain('入职：市集摊主')
    expect(html).toContain('结识新朋友')
    // 无属性 <span> 只由 CountUp 产生：以上四类 delta 均不应出现
    expect(html).not.toContain('<span>+')
    expect(html).not.toContain('<span>-')
  })

  it('无 delta（内心毫无波澜）与混合 delta 渲染不报错、终值可见', () => {
    expect(renderGame([])).toContain('内心毫无波澜')
    const html = renderGame([{ attr: 'smarts', delta: -2 }, { money: 800 }])
    expect(html).toContain('能力 -2')
    expect(html).toContain('金钱 <span>+800</span>')
  })
})

// ── 按钮按压反馈（CSS 体系）─────────────────────────────────

describe('按压反馈体系：btn / choice-btn / opt-card 统一，锁定项排除', () => {
  it('三类可点元素都有 :active 按压规则；锁定选项不参与按压位移', () => {
    expect(css).toContain('.btn:active')
    expect(css).toContain('.choice-btn:active:not(.locked)')
    expect(css).toContain('.opt-card:active')
  })

  it('choice-btn / opt-card 的 transition 链包含 transform（--dur-press）', () => {
    expect(css).toMatch(/\.choice-btn\s*\{[\s\S]*?transform var\(--dur-press\)/)
    expect(css).toMatch(/\.opt-card\s*\{[\s\S]*?transform var\(--dur-press\)/)
  })
})
