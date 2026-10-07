// 第 96 轮（V5）：同龄人对照卡——终局数据 vs 千局分位表（norms.ts 生成物）。
// 纯展示组件：百分位 = 分位锚点间线性插值（夹取 1～99）；文案分档非羞辱化。
// 引擎只读：不触碰任何结算逻辑，norms 为生成物展示数据。
import type { NormDimension, Norms } from '../data/norms'

const ANCHORS: Array<[number, number]> = [
  [10, 0.1],
  [25, 0.25],
  [50, 0.5],
  [75, 0.75],
  [90, 0.9],
]

/** 分位锚点间线性插值出百分位（1～99；越界按开区间端点夹取） */
export function percentileOf(dim: NormDimension, value: number): number {
  if (!Number.isFinite(value)) return 50
  if (value <= dim.p10) return Math.max(1, Math.round(10 * (value / Math.max(1, dim.p10))))
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [pLo, qLo] = ANCHORS[i]
    const [pHi, qHi] = ANCHORS[i + 1]
    const vLo = dim[`p${pLo}` as keyof NormDimension] as number
    const vHi = dim[`p${pHi}` as keyof NormDimension] as number
    if (value <= vHi) {
      const t = vHi === vLo ? 0 : (value - vLo) / (vHi - vLo)
      return Math.max(1, Math.min(99, Math.round((qLo + (qHi - qLo) * t) * 100)))
    }
  }
  return 99
}

/** 文案分档：非羞辱化——每档都给体面的说法 */
export function tierText(pct: number): string {
  if (pct >= 90) return '远超绝大多数同龄人'
  if (pct >= 75) return '高于大多数同龄人'
  if (pct >= 25) return '与大多数同龄人相当'
  if (pct >= 10) return '节奏不同，慢一点也是走'
  return '一段缓慢但真实的一生'
}

export interface PeerValues {
  money: number
  age: number
  achievements: number
  happinessAvg: number
}

export interface PeerRow {
  label: string
  valueText: string
  pct: number
  tier: string
}

export function buildPeerRows(values: PeerValues, norms: Norms): PeerRow[] {
  return [
    {
      label: '积蓄',
      valueText: `${values.money.toLocaleString('zh-CN')} 元`,
      pct: percentileOf(norms.money, values.money),
      tier: tierText(percentileOf(norms.money, values.money)),
    },
    {
      label: '寿命',
      valueText: `${values.age} 岁`,
      pct: percentileOf(norms.age, values.age),
      tier: tierText(percentileOf(norms.age, values.age)),
    },
    {
      label: '成就',
      valueText: `${values.achievements} 枚`,
      pct: percentileOf(norms.achievements, values.achievements),
      tier: tierText(percentileOf(norms.achievements, values.achievements)),
    },
    {
      label: '幸福感',
      valueText: `${Math.round(values.happinessAvg)}（均值）`,
      pct: percentileOf(norms.happinessAvg, values.happinessAvg),
      tier: tierText(percentileOf(norms.happinessAvg, values.happinessAvg)),
    },
  ]
}
