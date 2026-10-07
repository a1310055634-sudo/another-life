// 第 35 轮（资产曲线图）。
// 覆盖：buildCurve 纯函数（快照→几何的逐点一致、等距 x、NaN/Infinity 防护、平线不除零、
// 负值区 0 线/负债着色语义、空/短快照返回 null 优雅隐藏）、fmtAxisMoney 轴标签缩写、
// AssetCurve 渲染（polyline 与 curve.points 同源、负债 note、token 引用）、
// GamePage 履历区折叠接线 / EndingPage 直接展示接线（含真实对局到终局）、
// 空快照两页均不渲染曲线块（旧档迁移档）、CSS 类与限宽。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import GamePage from '../pages/GamePage'
import EndingPage from '../pages/EndingPage'
import {
  buildCurve,
  polylinePoints,
  fmtAxisMoney,
  AssetCurve,
  CURVE_W,
  CURVE_H,
  CURVE_PAD_X,
  CURVE_PLOT_TOP,
  CURVE_PLOT_BOTTOM,
} from '../components/AssetCurve'
import { createNewGame } from './init'
import { startSession, chooseOption, nextYear } from './session'
import { visibleChoices } from './events'
import { ALL_EVENTS } from '../data/events'
import type { Session } from './session'
import type { YearlySnapshot } from './types'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

const snap = (age: number, money: number): YearlySnapshot => ({
  age,
  money,
  attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 20 },
  career: { kind: 'none' },
})

// ── buildCurve：纯函数几何 ───────────────────────────────────

describe('buildCurve：快照 → 曲线几何', () => {
  it('逐点一致：每点 y 按同一线性映射反算回原金额，x 等距且首尾贴边', () => {
    const snaps = [snap(18, 3000), snap(25, -12000), snap(33, 45000), snap(41, 68000), snap(52, 21000)]
    const curve = buildCurve(snaps)
    expect(curve).not.toBeNull()
    expect(curve!.points.length).toBe(snaps.length)
    const span = curve!.maxMoney - curve!.minMoney
    curve!.points.forEach((p, i) => {
      expect(p.age).toBe(snaps[i].age)
      const back = curve!.minMoney + ((CURVE_PLOT_BOTTOM - p.y) / (CURVE_PLOT_BOTTOM - CURVE_PLOT_TOP)) * span
      expect(back).toBeCloseTo(snaps[i].money, 4)
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      if (i > 0) {
        const prev = curve!.points[i - 1]
        expect(p.x - prev.x).toBeCloseTo((CURVE_W - CURVE_PAD_X * 2) / (snaps.length - 1), 6)
      }
    })
    expect(curve!.points[0].x).toBe(CURVE_PAD_X)
    expect(curve!.points[curve!.points.length - 1].x).toBe(CURVE_W - CURVE_PAD_X)
    expect(curve!.startAge).toBe(18)
    expect(curve!.endAge).toBe(52)
    expect(curve!.finalMoney).toBe(21000)
  })

  it('NaN/Infinity 防护：损坏条目被剔除、坐标全有限；全部损坏返回 null', () => {
    const dirty = [
      snap(18, 1000),
      { ...snap(19, NaN) },
      { ...snap(20, Infinity) },
      { ...snap(NaN as unknown as number, 5000) },
      snap(21, 2000),
    ] as unknown as YearlySnapshot[]
    const curve = buildCurve(dirty)
    expect(curve).not.toBeNull()
    expect(curve!.points.map((p) => p.age)).toEqual([18, 21])
    for (const p of curve!.points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    const allBad = [NaN, Infinity, 'x'] as unknown as YearlySnapshot[]
    expect(buildCurve(allBad)).toBeNull()
  })

  it('平线不除零：全部相同金额落在绘图区垂直中点，坐标全有限', () => {
    const curve = buildCurve([snap(18, 5000), snap(19, 5000), snap(20, 5000)])
    expect(curve).not.toBeNull()
    const midY = (CURVE_PLOT_TOP + CURVE_PLOT_BOTTOM) / 2
    for (const p of curve!.points) {
      expect(p.y).toBe(midY)
      expect(Number.isFinite(p.x)).toBe(true)
    }
  })

  it('跨零值域：0 元平衡线存在且在绘图区内，负债区从 0 线铺到底边', () => {
    const curve = buildCurve([snap(18, -50000), snap(19, 20000), snap(20, 8000)])
    expect(curve).not.toBeNull()
    expect(curve!.zeroY).not.toBeNull()
    expect(curve!.zeroY!).toBeGreaterThan(CURVE_PLOT_TOP)
    expect(curve!.zeroY!).toBeLessThan(CURVE_PLOT_BOTTOM)
    expect(curve!.negTop).toBe(curve!.zeroY)
  })

  it('全负值域：平衡线在界外不画，负债区铺满绘图区；全正两样都不画', () => {
    const allNeg = buildCurve([snap(18, -3000), snap(19, -9000)])
    expect(allNeg!.zeroY).toBeNull()
    expect(allNeg!.negTop).toBe(CURVE_PLOT_TOP)
    const allPos = buildCurve([snap(18, 100), snap(19, 200)])
    expect(allPos!.zeroY).toBeNull()
    expect(allPos!.negTop).toBeNull()
  })

  it('空快照与单条快照返回 null（旧档迁移档/开局年优雅隐藏的依据）', () => {
    expect(buildCurve([])).toBeNull()
    expect(buildCurve([snap(18, 100)])).toBeNull()
  })
})

// ── fmtAxisMoney：轴标签缩写 ─────────────────────────────────

describe('fmtAxisMoney', () => {
  it('万/亿分段缩写，负数带负号，零与近零不出 -0', () => {
    expect(fmtAxisMoney(0)).toBe('0')
    expect(fmtAxisMoney(-0.4)).toBe('0')
    expect(fmtAxisMoney(9999)).toBe('9999')
    expect(fmtAxisMoney(10000)).toBe('1万')
    expect(fmtAxisMoney(12345)).toBe('1.2万')
    expect(fmtAxisMoney(1234567)).toBe('123.5万')
    expect(fmtAxisMoney(-123456)).toBe('-12.3万')
    expect(fmtAxisMoney(150000000)).toBe('1.5亿')
    expect(fmtAxisMoney(95000)).toBe('9.5万')
  })
})

// ── AssetCurve 渲染 ──────────────────────────────────────────

describe('AssetCurve：SVG 渲染', () => {
  const debtCurve = buildCurve([snap(18, -50000), snap(25, 20000), snap(40, 8000)])!
  const posCurve = buildCurve([snap(18, 1000), snap(25, 9000), snap(40, 30000)])!

  it('折线 points 属性与 curve.points 同源（逐点一致的渲染面）', () => {
    const html = renderToStaticMarkup(<AssetCurve curve={debtCurve} />)
    expect(html).toContain(`class="asset-curve"`)
    expect(html).toContain(`role="img"`)
    expect(html).toContain(`points="${polylinePoints(debtCurve)}"`)
    expect(html).toContain(`viewBox="0 0 ${CURVE_W} ${CURVE_H}"`)
  })

  it('aria-label 带真实起止年龄与最终金额（读屏不依赖图形）', () => {
    const html = renderToStaticMarkup(<AssetCurve curve={debtCurve} />)
    expect(html).toContain('资产曲线：18 岁至 40 岁')
    expect(html).toContain('最终 ¥8,000')
    expect(html).toContain('含负债期')
  })

  it('含负债：0 线、负债着色区与标注行齐全；全正曲线三者皆无', () => {
    const debt = renderToStaticMarkup(<AssetCurve curve={debtCurve} />)
    expect(debt).toContain('<rect')
    expect(debt).toContain('<line')
    expect(debt).toContain('asset-curve-note')
    expect(debt).toContain('浅红为负债区')
    const pos = renderToStaticMarkup(<AssetCurve curve={posCurve} />)
    expect(pos).not.toContain('<rect')
    expect(pos).not.toContain('<line')
    expect(pos).not.toContain('asset-curve-note')
  })

  it('轴标签使用缩写金额与年龄段（不出现长数字）', () => {
    const html = renderToStaticMarkup(<AssetCurve curve={posCurve} />)
    expect(html).toContain('3万')
    expect(html).toContain('1000')
    expect(html).toContain('18–40 岁')
  })
})

// ── 页面接线 ─────────────────────────────────────────────────

const baseState = createNewGame({ seed: 42, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })

function makeGameSession(partial: Partial<Session>): Session {
  return {
    state: baseState,
    currentEvent: null,
    awaitingAdvance: true,
    lastSummary: '这一年过去了。',
    lastDeltas: [],
    ...partial,
  }
}

/** 真实对局推进到终局（首个可见选项走到底），供 EndingPage 接线测试 */
function playToEnd(seed: number): Session {
  let s = startSession({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '曲线君' }, ALL_EVENTS)
  for (let guard = 0; s.state.phase === 'playing' && guard < 400; guard++) {
    if (s.awaitingAdvance) {
      s = nextYear(s, ALL_EVENTS)
    } else if (s.currentEvent) {
      const vis = visibleChoices(s.state, s.currentEvent)
      if (vis.length === 0) throw new Error('可见选项为空，推进循环无法继续')
      s = chooseOption(s, s.currentEvent.choices.indexOf(vis[0]))
    } else {
      break
    }
  }
  expect(s.state.phase).toBe('ended')
  return s
}

describe('GamePage：履历区折叠展示', () => {
  it('快照充足时渲染折叠块，标题带年数，展开内容为曲线', () => {
    const state = { ...baseState, snapshots: [snap(18, 1000), snap(19, 4000), snap(20, 2500)] }
    const html = renderToStaticMarkup(
      <GamePage session={makeGameSession({ state })} onChoose={() => {}} onNext={() => {}} onRestart={() => {}} />,
    )
    expect(html).toContain('asset-fold')
    expect(html).toContain('资产曲线（3 年）')
    expect(html).toContain('asset-curve')
  })

  it('开局（仅 1 条快照）与旧档（空快照）不渲染曲线块', () => {
    expect(baseState.snapshots.length).toBe(1)
    const fresh = renderToStaticMarkup(
      <GamePage session={makeGameSession({})} onChoose={() => {}} onNext={() => {}} onRestart={() => {}} />,
    )
    expect(fresh).not.toContain('asset-fold')
    const oldSave = renderToStaticMarkup(
      <GamePage
        session={makeGameSession({ state: { ...baseState, snapshots: [] } })}
        onChoose={() => {}}
        onNext={() => {}}
        onRestart={() => {}}
      />,
    )
    expect(oldSave).not.toContain('asset-fold')
  })
})

describe('EndingPage：结局页直接展示', () => {
  it('真实对局到终局：曲线块出现，点数与快照逐年一致', () => {
    const session = playToEnd(7)
    expect(session.state.snapshots.length).toBeGreaterThanOrEqual(2)
    const html = renderToStaticMarkup(<EndingPage session={session} onRestart={() => {}} />)
    expect(html).toContain('>资产曲线</h3>')
    expect(html).toContain(`points="${polylinePoints(buildCurve(session.state.snapshots)!)}"`)
  })

  it('空快照（旧档迁移档）结局页不渲染曲线块，其余内容不受影响', () => {
    const session = playToEnd(11)
    const stripped: Session = { ...session, state: { ...session.state, snapshots: [] } }
    const html = renderToStaticMarkup(<EndingPage session={stripped} onRestart={() => {}} />)
    expect(html).not.toContain('asset-curve')
    // 第 37 轮结局页改版「人生报告」：kicker 文案由「人生落幕」有意变更
    expect(html).toContain('人生报告')
  })
})

// ── CSS ──────────────────────────────────────────────────────

describe('CSS：资产曲线样式（token 体系）', () => {
  it('折叠头与履历同款、SVG 限宽 520px 等比缩放、标注行小字', () => {
    expect(css).toMatch(/\.asset-fold summary\s*\{[^}]*cursor: pointer/)
    const svgRule = css.match(/\.asset-curve svg\s*\{[^}]*\}/)
    expect(svgRule).toBeTruthy()
    expect(svgRule![0]).toContain('width: 100%')
    expect(svgRule![0]).toContain('max-width: 520px')
    expect(svgRule![0]).toContain('height: auto')
    const note = css.match(/\.asset-curve-note\s*\{[^}]*\}/)
    expect(note).toBeTruthy()
    expect(note![0]).toContain('var(--fs-xs)')
    expect(note![0]).toContain('var(--muted)')
  })
})
