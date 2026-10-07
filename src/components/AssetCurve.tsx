// 资产曲线（第 35 轮）：纯 SVG 自绘金钱—年龄折线，零依赖、零动画。
// 数据来自第 21 轮年度快照（state.snapshots）；几何由 buildCurve 纯函数生成，
// 组件只负责渲染。空/短快照（旧档迁移档）由 buildCurve 返回 null，调用方整块隐藏。
// 颜色全部经 style 内联引用 CSS token（SVG 表现属性不支持 var()，走 style 才能留在 token 体系）。
import type { YearlySnapshot } from '../engine/types'
import { fmtMoney } from './AttrBar'

/** viewBox 与绘图区常量（导出供测试按同一公式反算逐点坐标） */
export const CURVE_W = 320
export const CURVE_H = 150
export const CURVE_PAD_X = 3
export const CURVE_PLOT_TOP = 14
export const CURVE_PLOT_BOTTOM = 132

export interface CurvePoint {
  age: number
  money: number
  x: number
  y: number
}

export interface Curve {
  points: CurvePoint[]
  minMoney: number
  maxMoney: number
  /** 0 元平衡线 y；仅当 0 严格落在值域内时存在（全正/全负时线在界外，不画） */
  zeroY: number | null
  /** 负债着色区顶部 y（值域含负时 < 底边；全正为 null=不画） */
  negTop: number | null
  startAge: number
  endAge: number
  finalMoney: number
}

/** 轴标签缩写：亿/万分段，坐标轴不出现 9 位长数字 */
export function fmtAxisMoney(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e8) return `${trim1(n / 1e8)}亿`
  if (a >= 1e4) return `${trim1(n / 1e4)}万`
  return `${Object.is(Math.round(n), -0) ? 0 : Math.round(n)}`
}

function trim1(v: number): string {
  const r = Math.round(v * 10) / 10
  return (Object.is(r, -0) ? 0 : r).toFixed(1).replace(/\.0$/, '')
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** 折线 points 属性串（组件渲染与测试共用同一拼接，保证"逐点一致"有唯一权威来源） */
export function polylinePoints(curve: Curve): string {
  return curve.points.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ')
}

/**
 * 快照 → 曲线几何。有效点少于 2（空快照/旧档迁移档/仅开局一年）返回 null，
 * 调用方据此整块隐藏。非有限值（损坏数据）的快照直接剔除，绝不产生 NaN 坐标；
 * 值域为零跨度（平线）时不除零，落在绘图区垂直中点。
 */
export function buildCurve(snapshots: readonly YearlySnapshot[]): Curve | null {
  const valid = (snapshots ?? []).filter(
    (s) => Number.isFinite(s?.money) && Number.isFinite(s?.age),
  )
  if (valid.length < 2) return null
  const monies = valid.map((s) => s.money)
  const minMoney = Math.min(...monies)
  const maxMoney = Math.max(...monies)
  const span = maxMoney - minMoney
  const yOf = (m: number): number =>
    span === 0
      ? (CURVE_PLOT_TOP + CURVE_PLOT_BOTTOM) / 2
      : CURVE_PLOT_BOTTOM - ((m - minMoney) / span) * (CURVE_PLOT_BOTTOM - CURVE_PLOT_TOP)
  const last = valid.length - 1
  const points: CurvePoint[] = valid.map((s, i) => ({
    age: s.age,
    money: s.money,
    x: CURVE_PAD_X + ((CURVE_W - CURVE_PAD_X * 2) * i) / last,
    y: yOf(s.money),
  }))
  return {
    points,
    minMoney,
    maxMoney,
    zeroY: minMoney < 0 && maxMoney > 0 ? yOf(0) : null,
    negTop: minMoney < 0 ? Math.min(Math.max(yOf(0), CURVE_PLOT_TOP), CURVE_PLOT_BOTTOM) : null,
    startAge: valid[0].age,
    endAge: valid[last].age,
    finalMoney: valid[last].money,
  }
}

interface Props {
  curve: Curve
}

export function AssetCurve({ curve }: Props) {
  const inDebt = curve.negTop !== null
  const label =
    `资产曲线：${curve.startAge} 岁至 ${curve.endAge} 岁，` +
    `最终 ${fmtMoney(curve.finalMoney)}${inDebt ? '，含负债期' : ''}`
  return (
    <figure className="asset-curve" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${CURVE_W} ${CURVE_H}`} aria-hidden="true" focusable="false">
        {inDebt && curve.negTop! < CURVE_PLOT_BOTTOM && (
          <rect
            x={0}
            y={curve.negTop!}
            width={CURVE_W}
            height={CURVE_PLOT_BOTTOM - curve.negTop!}
            style={{ fill: 'var(--neg-bg)' }}
          />
        )}
        {curve.zeroY !== null && (
          <line
            x1={0}
            x2={CURVE_W}
            y1={curve.zeroY}
            y2={curve.zeroY}
            strokeDasharray="4 3"
            strokeWidth={1}
            style={{ stroke: 'var(--muted)', opacity: 0.55 }}
          />
        )}
        <polyline
          points={polylinePoints(curve)}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ stroke: 'var(--accent)' }}
        />
        {curve.points.map((p, i) =>
          i === 0 || i === curve.points.length - 1 ? (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} style={{ fill: 'var(--accent-deep)' }} />
          ) : null,
        )}
        <text
          x={CURVE_PAD_X}
          y={10}
          fontSize={10}
          style={{ fill: 'var(--muted)' }}
        >
          {fmtAxisMoney(curve.maxMoney)}
        </text>
        <text x={CURVE_PAD_X} y={CURVE_H - 4} fontSize={10} style={{ fill: 'var(--muted)' }}>
          {fmtAxisMoney(curve.minMoney)}
        </text>
        <text
          x={CURVE_W - CURVE_PAD_X}
          y={CURVE_H - 4}
          fontSize={10}
          textAnchor="end"
          style={{ fill: 'var(--muted)' }}
        >
          {curve.startAge}–{curve.endAge} 岁
        </text>
      </svg>
      {inDebt && (
        <figcaption className="asset-curve-note">
          浅红为负债区，虚线为 0 元平衡线（{curve.startAge}–{curve.endAge} 岁）。
        </figcaption>
      )}
    </figure>
  )
}
