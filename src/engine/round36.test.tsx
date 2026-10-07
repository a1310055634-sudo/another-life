// 第 36 轮（属性雷达与人生时间轴）。
// 覆盖：buildRadar 纯函数（五轴顶点同圆反算、越界 clamp 与非有限按引擎语义归 50/压力 0、
// 基准任一维非有限整条丢弃、基准年龄非法降级、label 两态）、radarPoints 唯一拼接源、
// ringPointsAt 网格同源、LifeRadar 渲染（数据 polygon 与 axes 同源、基准两态、图例两态）、
// EndingPage 接线（真实对局到终局：雷达逐字符一致 + 时间轴条目/关键节点计数一致、
// 空履历空态降级、旧档空快照雷达降级）、CSS token（雷达限宽/图例/时间轴主干与金节点）。
// 呈现轮：引擎/事件数据/存档零改动，快照与履历只读消费；测试按第 35 轮惯例放 engine 目录。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import EndingPage from '../pages/EndingPage'
import {
  buildRadar,
  radarPoints,
  ringPointsAt,
  LifeRadar,
  RADAR_W,
  RADAR_H,
  RADAR_CX,
  RADAR_CY,
  RADAR_R,
} from '../components/LifeRadar'
import { startSession, chooseOption, nextYear } from './session'
import { visibleChoices } from './events'
import { ALL_EVENTS } from '../data/events'
import type { Session } from './session'
import type { Attributes } from './types'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

const attrs = (v: Partial<Attributes> = {}): Attributes => ({
  health: 55,
  happiness: 60,
  smarts: 58,
  social: 50,
  stress: 25,
  ...v,
})

// ── buildRadar：纯函数几何 ───────────────────────────────────

describe('buildRadar：终值 + 基准 → 雷达几何', () => {
  it('五轴顶点按同一公式落在同心圆上：半径 = 值/100×R，角度自正上方每 72° 一轴', () => {
    const radar = buildRadar(attrs(), attrs({ health: 40, happiness: 70, smarts: 58, social: 30, stress: 10 }), 18)
    expect(radar.axes.map((a) => a.key)).toEqual(['health', 'happiness', 'smarts', 'social', 'stress'])
    expect(radar.axes.map((a) => a.label)).toEqual(['健康', '幸福', '能力', '人际', '压力'])
    const ANGLE0 = -Math.PI / 2
    const STEP = (Math.PI * 2) / 5
    const baseVals = [40, 70, 58, 30, 10]
    radar.axes.forEach((a, i) => {
      const r = Math.hypot(a.x - RADAR_CX, a.y - RADAR_CY)
      expect(r).toBeCloseTo((a.value / 100) * RADAR_R, 1)
      const angle = Math.atan2(a.y - RADAR_CY, a.x - RADAR_CX)
      const norm = (v: number) => (v < -Math.PI ? v + Math.PI * 2 : v)
      // 坐标经 round2（0.01 精度）舍入，半径 ~50~92 时角度误差 ~3e-5，断言取 1e-3 档
      expect(norm(angle - (ANGLE0 + STEP * i))).toBeCloseTo(0, 3)
      // 基准顶点同圆
      const br = Math.hypot(a.bx! - RADAR_CX, a.by! - RADAR_CY)
      expect(br).toBeCloseTo((baseVals[i] / 100) * RADAR_R, 1)
    })
    // 正上方第一轴（health 55）
    expect(radar.axes[0].x).toBeCloseTo(RADAR_CX, 1)
    expect(radar.axes[0].y).toBeCloseTo(RADAR_CY - (55 / 100) * RADAR_R, 1)
    expect(radar.hasBaseline).toBe(true)
    expect(radar.baselineAge).toBe(18)
  })

  it('越界 clamp 与非有限：150→100 贴外框、-20→0 在圆心，NaN 按引擎语义归 50/压力 0，坐标全有限', () => {
    const radar = buildRadar(
      attrs({ health: 150, happiness: -20, smarts: NaN, social: Infinity, stress: NaN }),
      null,
    )
    expect(radar.axes[0].value).toBe(100)
    expect(Math.hypot(radar.axes[0].x - RADAR_CX, radar.axes[0].y - RADAR_CY)).toBeCloseTo(RADAR_R, 1)
    expect(radar.axes[1].value).toBe(0)
    expect(radar.axes[1].x).toBeCloseTo(RADAR_CX, 1)
    expect(radar.axes[1].y).toBeCloseTo(RADAR_CY, 1)
    expect(radar.axes[2].value).toBe(50)
    expect(radar.axes[3].value).toBe(50)
    expect(radar.axes[4].value).toBe(0) // 压力非有限归 0（clampAttr 引擎语义）
    for (const a of radar.axes) {
      expect(Number.isFinite(a.x)).toBe(true)
      expect(Number.isFinite(a.y)).toBe(true)
    }
    expect(radar.hasBaseline).toBe(false)
  })

  it('基准五维任一非有限 → 整条基准丢弃（bx/by 全 null），不做单维修补', () => {
    const bad = attrs({ social: NaN })
    const radar = buildRadar(attrs(), bad, 18)
    expect(radar.hasBaseline).toBe(false)
    for (const a of radar.axes) {
      expect(a.bx).toBeNull()
      expect(a.by).toBeNull()
    }
    expect(radar.baselineAge).toBeNull()
    expect(radar.label).toContain('旧档无开局基准')
  })

  it('基准年龄非法（NaN）时基准环保留、年龄降级为「开局基准」字样', () => {
    const radar = buildRadar(attrs(), attrs(), NaN)
    expect(radar.hasBaseline).toBe(true)
    expect(radar.baselineAge).toBeNull()
    expect(radar.label).toContain('开局基准')
    expect(radar.label).not.toContain('NaN')
  })

  it('label 两态：带基准报五维终值与基准年龄；无基准括注旧档说明', () => {
    const withBase = buildRadar(attrs(), attrs({ health: 40 }), 18)
    expect(withBase.label).toBe('五维属性雷达：健康 55、幸福 60、能力 58、人际 50、压力 25；虚线为 18 岁开局基准')
    const noBase = buildRadar(attrs(), null)
    expect(noBase.label).toBe('五维属性雷达：健康 55、幸福 60、能力 58、人际 50、压力 25（旧档无开局基准，仅显示终值）')
  })
})

// ── radarPoints / ringPointsAt：唯一拼接源 ───────────────────

describe('radarPoints / ringPointsAt', () => {
  it('final 恰 5 点与 axes 同源；base 同源；无基准时 base 返回空串', () => {
    const radar = buildRadar(attrs(), attrs(), 18)
    expect(radarPoints(radar.axes, 'final').split(' ').length).toBe(5)
    expect(radarPoints(radar.axes, 'final')).toBe(
      radar.axes.map((a) => `${a.x},${a.y}`).join(' '),
    )
    expect(radarPoints(radar.axes, 'base').split(' ').length).toBe(5)
    const noBase = buildRadar(attrs(), null)
    expect(radarPoints(noBase.axes, 'base')).toBe('')
    expect(radarPoints(noBase.axes, 'final').split(' ').length).toBe(5)
  })

  it('网格三层：fraction 1 与外框重合，坐标全部有限', () => {
    expect(ringPointsAt(1).split(' ').length).toBe(5)
    expect(ringPointsAt(1 / 3).split(' ').length).toBe(5)
    for (const pair of ringPointsAt(2 / 3).split(' ')) {
      for (const v of pair.split(',')) {
        expect(Number.isFinite(parseFloat(v))).toBe(true)
      }
    }
    // 外框顶点距圆心恰为 R
    const [hx, hy] = ringPointsAt(1).split(' ')[0].split(',').map(Number)
    expect(Math.hypot(hx - RADAR_CX, hy - RADAR_CY)).toBeCloseTo(RADAR_R, 1)
  })
})

// ── LifeRadar 渲染 ──────────────────────────────────────────

describe('LifeRadar：SVG 渲染', () => {
  it('数据 polygon points 与 radarPoints 同源；viewBox 与常量一致', () => {
    const radar = buildRadar(attrs(), attrs(), 18)
    const html = renderToStaticMarkup(<LifeRadar radar={radar} />)
    expect(html).toContain(`class="life-radar"`)
    expect(html).toContain(`role="img"`)
    expect(html).toContain(`viewBox="0 0 ${RADAR_W} ${RADAR_H}"`)
    expect(html).toContain(`points="${radarPoints(radar.axes, 'final')}"`)
    expect(html).toContain(`points="${radarPoints(radar.axes, 'base')}"`)
  })

  it('aria-label 透传（读屏不依赖图形）；图例两项', () => {
    const radar = buildRadar(attrs(), attrs(), 18)
    const html = renderToStaticMarkup(<LifeRadar radar={radar} />)
    expect(html).toContain(radar.label)
    expect(html).toContain('本局终值')
    expect(html).toContain('18 岁开局（虚线）')
  })

  it('无基准：只有终值 polygon 与单项图例，不出现 radar-base', () => {
    const radar = buildRadar(attrs(), null)
    const html = renderToStaticMarkup(<LifeRadar radar={radar} />)
    expect(html).toContain(`points="${radarPoints(radar.axes, 'final')}"`)
    expect(html).not.toContain('radar-base')
    expect(html).not.toContain('lg-base')
    expect(html).toContain('旧档无开局基准')
    expect(html).toContain('本局终值')
  })
})

// ── EndingPage 接线 ─────────────────────────────────────────

/** 真实对局推进到终局（首个可见选项走到底），供 EndingPage 接线测试 */
function playToEnd(seed: number): Session {
  let s = startSession({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '雷达君' }, ALL_EVENTS)
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

describe('EndingPage：雷达与时间轴接线（真实对局到终局）', () => {
  it('雷达 polygon 与 buildRadar(state.attrs, snapshots[0]) 逐字符一致；aria 就位', () => {
    const session = playToEnd(7)
    const st = session.state
    const first = st.snapshots.length > 0 ? st.snapshots[0] : null
    const radar = buildRadar(st.attrs, first?.attrs ?? null, first?.age ?? null)
    const html = renderToStaticMarkup(<EndingPage session={session} onRestart={() => {}} />)
    expect(html).toContain('>属性雷达</h3>')
    expect(html).toContain(`points="${radarPoints(radar.axes, 'final')}"`)
    expect(html).toContain(radar.label)
  })

  it('时间轴条目数 = history 长度，★ 关键条目挂 tl-key 与 history-star', () => {
    const session = playToEnd(7)
    const st = session.state
    expect(st.history.length).toBeGreaterThan(0)
    const keyCount = st.history.filter((h) => h.key).length
    expect(keyCount).toBeGreaterThan(0)
    const html = renderToStaticMarkup(<EndingPage session={session} onRestart={() => {}} />)
    expect(html).toContain('life-timeline')
    expect(html).not.toContain('class="history-list"')
    // 第 75 轮岁月长河：时间轴按年代分段（每段一个 life-timeline ol）——
    // 计数改为「river-seg 分段之后」的全部片段聚合：分段组头无 li，
    // 段内 li 数之和 = history 长度；tl-key/history-star 断言同口径。
    const tlPart = html.split('river-seg').slice(1).join('')
    const tlLi = (tlPart.match(/<li[^>]*>/g) ?? []).length
    expect(tlLi).toBe(st.history.length)
    expect(tlPart).toContain('tl-key')
    const keyLi = (tlPart.match(/class="tl-key"/g) ?? []).length
    expect(keyLi).toBe(keyCount)
    expect(tlPart).toContain('history-star')
  })

  it('空履历（成就外的极端档）：不渲染时间轴，空态文案自然降级，雷达与曲线不受影响', () => {
    const session = playToEnd(11)
    const stripped: Session = { ...session, state: { ...session.state, history: [] } }
    const html = renderToStaticMarkup(<EndingPage session={stripped} onRestart={() => {}} />)
    expect(html).not.toContain('life-timeline')
    expect(html).toContain('平淡的一生，没有留下刻痕。')
    // 第 37 轮结局页改版「人生报告」：kicker 文案由「人生落幕」有意变更
    expect(html).toContain('人生报告')
    expect(html).toContain('life-radar')
  })

  it('旧档空快照：雷达仍渲染但仅终值多边形（无 radar-base / lg-base），曲线块隐藏', () => {
    const session = playToEnd(11)
    const stripped: Session = { ...session, state: { ...session.state, snapshots: [] } }
    const html = renderToStaticMarkup(<EndingPage session={stripped} onRestart={() => {}} />)
    expect(html).toContain('life-radar')
    expect(html).not.toContain('radar-base')
    expect(html).not.toContain('lg-base')
    expect(html).toContain('旧档无开局基准')
    expect(html).not.toContain('asset-curve')
    expect(html).toContain('人生时间线')
  })
})

// ── CSS ──────────────────────────────────────────────────────

describe('CSS：雷达与时间轴样式（token 体系）', () => {
  it('雷达 svg 限宽 520px 等比缩放，图例小字居中可换行', () => {
    const svgRule = css.match(/\.life-radar svg\s*\{[^}]*\}/)
    expect(svgRule).toBeTruthy()
    expect(svgRule![0]).toContain('width: 100%')
    expect(svgRule![0]).toContain('max-width: 520px')
    expect(svgRule![0]).toContain('height: auto')
    const legend = css.match(/\.radar-legend\s*\{[^}]*\}/)
    expect(legend).toBeTruthy()
    expect(legend![0]).toContain('var(--fs-xs)')
    expect(legend![0]).toContain('var(--muted)')
  })

  it('时间轴：相邻条目 border-left 相连为主干，节点圆点压线，★ 节点金色放大', () => {
    const li = css.match(/\.life-timeline li\s*\{[^}]*\}/)
    expect(li).toBeTruthy()
    expect(li![0]).toContain('border-left: 2px solid var(--line)')
    expect(li![0]).toContain('position: relative')
    const dot = css.match(/\.life-timeline li::before\s*\{[^}]*\}/)
    expect(dot).toBeTruthy()
    expect(dot![0]).toContain('left: calc(-1 * var(--sp-6))')
    expect(dot![0]).toContain('border-radius: var(--radius-pill)')
    const key = css.match(/\.life-timeline li\.tl-key::before\s*\{[^}]*\}/)
    expect(key).toBeTruthy()
    expect(key![0]).toContain('var(--gold)')
    expect(key![0]).toContain('var(--gold-bg)')
    const last = css.match(/\.life-timeline li:last-child\s*\{[^}]*\}/)
    expect(last).toBeTruthy()
    expect(last![0]).toContain('border-left-color: transparent')
  })
})
