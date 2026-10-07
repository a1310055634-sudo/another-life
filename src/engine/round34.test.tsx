// 第 34 轮（动效 II：跨年与入场）。
// 覆盖：GamePage 渲染「翻开新的一年」转场遮罩（aria-hidden、含年龄）、
// 结算面板与事件卡在 DOM 上互斥（转场不改变状态的呈现证据）、
// CSS 侧 rise-in 入场挂载（结算卡/事件卡/选项 stagger）、
// 转场遮罩纯视觉安全性（pointer-events none、底态不可见、时长同源 token）、
// prefers-reduced-motion 降级块覆盖全部新动画。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import GamePage from '../pages/GamePage'
import { createNewGame } from './init'
import { ALL_EVENTS } from '../data/events'
import type { Session } from './session'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

const baseState = createNewGame({ seed: 42, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })

function makeSession(partial: Partial<Session>): Session {
  return {
    state: baseState,
    currentEvent: null,
    awaitingAdvance: true,
    lastSummary: '这一年过去了。',
    lastDeltas: [],
    ...partial,
  }
}

function renderGame(session: Session): string {
  return renderToStaticMarkup(
    <GamePage session={session} onChoose={() => {}} onNext={() => {}} onRestart={() => {}} />,
  )
}

const settledHtml = renderGame(makeSession({})).replace(/<!-- -->/g, '')
const playingHtml = renderGame(
  makeSession({ currentEvent: ALL_EVENTS[0], awaitingAdvance: false }),
).replace(/<!-- -->/g, '')

// ── 转场遮罩渲染 ─────────────────────────────────────────────

describe('GamePage：跨年「翻开新的一年」转场遮罩', () => {
  it('渲染 .year-flip 遮罩，aria-hidden 纯视觉层，翻页带带出当前年龄', () => {
    for (const html of [settledHtml, playingHtml]) {
      expect(html).toContain('class="year-flip"')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('year-flip-band')
      expect(html).toContain('翻开新的一年 · 18 岁')
    }
  })

  it('结算面板与事件卡在 DOM 上互斥（转场只是呈现，状态机语义不变）', () => {
    expect(settledHtml).toContain('result-panel')
    expect(settledHtml).not.toContain('event-card')
    expect(playingHtml).toContain('event-card')
    expect(playingHtml).not.toContain('result-panel')
  })
})

// ── 入场动画挂载（CSS 体系）─────────────────────────────────

describe('CSS：结算卡/事件卡淡入上移，选项入场 stagger', () => {
  it('rise-in keyframes 存在，从透明 + 下移 10px（--sp-10）起始', () => {
    const m = css.match(/@keyframes rise-in\s*\{[\s\S]*?\n\}/)
    expect(m).toBeTruthy()
    expect(m![0]).toContain('opacity: 0')
    expect(m![0]).toContain('translateY(var(--sp-10))')
  })

  it('结算面板与事件卡都挂 rise-in（--dur-slow + --ease-out，时长不脱离 token 阶梯）', () => {
    expect(css).toMatch(/\.result-panel\s*\{[\s\S]*?animation: rise-in var\(--dur-slow\) var\(--ease-out\)/)
    expect(css).toMatch(/\.event-card\s*\{[\s\S]*?animation: rise-in var\(--dur-slow\) var\(--ease-out\)/)
  })

  it('选项挂 rise-in 且 fill backwards（延迟期保持首帧隐藏）', () => {
    expect(css).toMatch(
      /\.choice-btn\s*\{[\s\S]*?animation: rise-in var\(--dur-slow\) var\(--ease-out\) backwards/,
    )
  })

  it('stagger 延迟依次为 --dur-fast 的 n 倍（当前事件最多 4 选项，覆盖到 5 留余量）', () => {
    expect(css).toMatch(/\.choices \.choice-btn:nth-child\(1\)\s*\{\s*animation-delay:\s*var\(--dur-fast\)/)
    for (let n = 2; n <= 5; n++) {
      const re = new RegExp(
        `\\.choices \\.choice-btn:nth-child\\(${n}\\)\\s*\\{\\s*animation-delay:\\s*calc\\(var\\(--dur-fast\\) \\* ${n}\\)`,
      )
      expect(css).toMatch(re)
    }
  })
})

// ── 转场遮罩 CSS 安全性 ─────────────────────────────────────

describe('CSS：转场遮罩纯视觉且播完/降级双路隐身', () => {
  it('.year-flip 全屏固定层在 --z-overlay，pointer-events none 不挡点击', () => {
    const flip = css.match(/\.year-flip\s*\{[\s\S]*?\}/)
    expect(flip).toBeTruthy()
    expect(flip![0]).toContain('pointer-events: none')
    expect(flip![0]).toContain('z-index: var(--z-overlay)')
  })

  it('翻页带底态 opacity 0：animation:none（降级）与播完（末帧）都不可见，不永久遮挡', () => {
    const band = css.match(/\.year-flip-band\s*\{[\s\S]*?\}/)
    expect(band).toBeTruthy()
    expect(band![0]).toContain('opacity: 0')
    expect(band![0]).toContain('animation: year-flip-sweep calc(var(--dur-slow) * 2)')
  })

  it('翻页扫描末帧 opacity 0（fill forwards 收敛到隐身）', () => {
    const sweep = css.match(/@keyframes year-flip-sweep\s*\{[\s\S]*?\n\}/)
    expect(sweep).toBeTruthy()
    const tail = sweep![0].slice(sweep![0].indexOf('100%'))
    expect(tail).toContain('opacity: 0')
  })
})

// ── 降级 ─────────────────────────────────────────────────────

describe('prefers-reduced-motion：本轮新动画全部纳入降级', () => {
  it('降级块对遮罩带/结算卡/事件卡/选项统一 animation: none', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(idx).toBeGreaterThan(-1)
    const block = css.slice(idx)
    expect(block).toContain('animation: none')
    for (const sel of ['.year-flip-band', '.result-panel', '.event-card', '.choice-btn']) {
      expect(block).toContain(sel)
    }
  })

  it('降级块仍保留第 33 轮的过渡关闭与按压位移取消', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)')
    const block = css.slice(idx)
    expect(block).toContain('transition: none')
    expect(block).toContain('transform: none')
  })
})
