// 属性雷达（第 36 轮）：纯 SVG 自绘五维雷达，终值对比开局基准，零依赖、零动画。
// 终值来自 state.attrs（恒存在，雷达无隐藏分支）；青年基准来自第 21 轮年度快照首条
// （snapshots[0]，开局切面），旧档迁移档无快照时只画终值多边形、图例自然降为单项。
// 值经 clampAttr（与引擎同语义：越界夹 0~100，非有限归 50、压力归 0）；
// 基准五维任一非有限则整条丢弃，绝不产生 NaN 坐标。
// 颜色全部经 style 内联引用 CSS token（SVG 表现属性不支持 var()，走 style 才能留在 token 体系）。
import { ATTR_KEYS, ATTR_LABELS, clampAttr } from '../engine/attrs'
import type { AttrKey, Attributes } from '../engine/types'

/** viewBox 与绘图常量（导出供测试按同一公式反算顶点） */
export const RADAR_W = 320
export const RADAR_H = 252
export const RADAR_CX = 160
export const RADAR_CY = 130
export const RADAR_R = 92
/** 维度标签与外框顶点的间距 */
export const RADAR_LABEL_GAP = 14

const ANGLE0 = -Math.PI / 2
const STEP = (Math.PI * 2) / 5

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function polar(r: number, i: number): { x: number; y: number } {
  return {
    x: round2(RADAR_CX + r * Math.cos(ANGLE0 + STEP * i)),
    y: round2(RADAR_CY + r * Math.sin(ANGLE0 + STEP * i)),
  }
}

/** 同心网格多边形（f ∈ (0,1] 为外框半径比例），组件与测试共用同一公式 */
export function ringPointsAt(fraction: number): string {
  return ATTR_KEYS.map((_, i) => {
    const p = polar(RADAR_R * fraction, i)
    return `${p.x},${p.y}`
  }).join(' ')
}

export interface RadarAxis {
  key: AttrKey
  label: string
  /** 夹取后的终值 0~100 */
  value: number
  /** 终值顶点 */
  x: number
  y: number
  /** 基准顶点；无有效基准为 null */
  bx: number | null
  by: number | null
}

export interface Radar {
  axes: RadarAxis[]
  hasBaseline: boolean
  /** 基准切面年龄；基准无效或年龄非法为 null（图例/label 降级为「开局基准」） */
  baselineAge: number | null
  /** 读屏文案：五维终值 + 基准说明 */
  label: string
}

/**
 * 终值属性 + 开局基准 → 雷达几何。终值逐维 clampAttr（非法值按引擎语义归 50/压力 0）；
 * 基准 attrs 五维任一非有限 → 整条基准丢弃（bx/by 全 null），不做单维修补——
 * 损坏的基准画进图里就是造假，丢弃后图例降级比错图诚实。
 */
export function buildRadar(
  finalAttrs: Attributes,
  baselineAttrs?: Attributes | null,
  baselineAge?: number | null,
): Radar {
  const baselineValid =
    !!baselineAttrs && ATTR_KEYS.every((k) => Number.isFinite(baselineAttrs[k]))
  const age = Number.isFinite(baselineAge as number) ? (baselineAge as number) : null
  const axes: RadarAxis[] = ATTR_KEYS.map((key, i) => {
    const value = clampAttr(key, finalAttrs[key])
    const p = polar((value / 100) * RADAR_R, i)
    let bx: number | null = null
    let by: number | null = null
    if (baselineValid) {
      const bv = clampAttr(key, baselineAttrs![key])
      const bp = polar((bv / 100) * RADAR_R, i)
      bx = bp.x
      by = bp.y
    }
    return { key, label: ATTR_LABELS[key], value, x: p.x, y: p.y, bx, by }
  })
  const summary = axes.map((a) => `${a.label} ${a.value}`).join('、')
  const label = baselineValid
    ? `五维属性雷达：${summary}；虚线为${age !== null ? ` ${age} 岁` : ''}开局基准`
    : `五维属性雷达：${summary}（旧档无开局基准，仅显示终值）`
  return {
    axes,
    hasBaseline: baselineValid,
    baselineAge: baselineValid ? age : null,
    label,
  }
}

/** 数据多边形 points 属性串（组件渲染与测试共用同一拼接，保证「逐点一致」有唯一权威来源） */
export function radarPoints(axes: readonly RadarAxis[], which: 'final' | 'base'): string {
  return axes
    .map((a) => (which === 'base' ? { x: a.bx, y: a.by } : { x: a.x, y: a.y }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null)
    .map((p) => `${round2(p.x)},${round2(p.y)}`)
    .join(' ')
}

interface Props {
  radar: Radar
}

export function LifeRadar({ radar }: Props) {
  const labelAnchor = (i: number): 'start' | 'end' | 'middle' =>
    i === 0 ? 'middle' : i <= 2 ? 'start' : 'end'
  const labelPos = (i: number) => {
    const p = polar(RADAR_R + RADAR_LABEL_GAP, i)
    // 顶部轴文字上移、下侧两轴文字下沉，避免与顶点圆点贴挤
    const nudge = i === 0 ? -4 : i >= 2 && i <= 3 ? 10 : 4
    return { x: p.x, y: p.y + nudge }
  }
  return (
    <figure className="life-radar" role="img" aria-label={radar.label}>
      <svg viewBox={`0 0 ${RADAR_W} ${RADAR_H}`} aria-hidden="true" focusable="false">
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon
            key={f}
            points={ringPointsAt(f)}
            fill="none"
            strokeWidth={1}
            style={{ stroke: 'var(--line)' }}
          />
        ))}
        {radar.axes.map((_, i) => {
          const edge = polar(RADAR_R, i)
          return (
            <line
              key={i}
              x1={RADAR_CX}
              y1={RADAR_CY}
              x2={edge.x}
              y2={edge.y}
              strokeWidth={1}
              style={{ stroke: 'var(--line)' }}
            />
          )
        })}
        {radar.hasBaseline && (
          <polygon
            className="radar-base"
            points={radarPoints(radar.axes, 'base')}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
            style={{ stroke: 'var(--muted)' }}
          />
        )}
        {radar.hasBaseline &&
          radar.axes.map((a, i) =>
            a.bx !== null && a.by !== null ? (
              <circle key={i} cx={a.bx} cy={a.by} r={2} style={{ fill: 'var(--muted)' }} />
            ) : null,
          )}
        <polygon
          className="radar-final"
          points={radarPoints(radar.axes, 'final')}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ fill: 'var(--accent-soft)', stroke: 'var(--accent)' }}
        />
        {radar.axes.map((a, i) => (
          <circle key={i} cx={a.x} cy={a.y} r={3} style={{ fill: 'var(--accent-deep)' }} />
        ))}
        {radar.axes.map((a, i) => {
          const lp = labelPos(i)
          return (
            <text
              key={a.key}
              x={lp.x}
              y={lp.y}
              fontSize={11}
              textAnchor={labelAnchor(i)}
              style={{ fill: 'var(--ink)' }}
            >
              {a.label}
            </text>
          )
        })}
      </svg>
      <figcaption className="radar-legend">
        <i>本局终值</i>
        {radar.hasBaseline && (
          <i className="lg-base">
            {radar.baselineAge !== null ? `${radar.baselineAge} 岁开局（虚线）` : '开局基准（虚线）'}
          </i>
        )}
      </figcaption>
    </figure>
  )
}
