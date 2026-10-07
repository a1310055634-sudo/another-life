import type { Attributes, AttrKey } from './types'

export const ATTR_KEYS: AttrKey[] = ['health', 'happiness', 'smarts', 'social', 'stress']

export const ATTR_LABELS: Record<AttrKey, string> = {
  health: '健康',
  happiness: '幸福',
  smarts: '能力',
  social: '人际',
  stress: '压力',
}

/** 属性收敛到 [0,100]；非法值（NaN/Infinity）归 50 */
export function clampAttr(key: AttrKey, v: number): number {
  if (!Number.isFinite(v)) {
    return key === 'stress' ? 0 : 50
  }
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** 金钱收敛：取整、禁止 NaN/Infinity、限制在 ±2 万亿 */
export function sanitizeMoney(v: number): number {
  if (!Number.isFinite(v)) return 0
  const LIMIT = 2_000_000_000_000
  return Math.max(-LIMIT, Math.min(LIMIT, Math.round(v)))
}

/** 全量属性收敛：任何状态变换后都应调用 */
export function normalizeAttrs(attrs: Attributes): Attributes {
  const out = {} as Attributes
  for (const k of ATTR_KEYS) out[k] = clampAttr(k, attrs[k])
  return out
}

/** 应用一组效果（纯函数，不改原对象） */
export function applyEffects(
  attrs: Attributes,
  money: number,
  effects: Array<{ attr?: AttrKey; delta?: number; money?: number }>,
): { attrs: Attributes; money: number } {
  const next = { ...attrs }
  let m = money
  for (const e of effects) {
    if (e.attr && typeof e.delta === 'number') next[e.attr] += e.delta
    if (typeof e.money === 'number') m += e.money
  }
  return { attrs: normalizeAttrs(next), money: sanitizeMoney(m) }
}
