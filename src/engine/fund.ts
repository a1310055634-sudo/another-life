// 第 87 轮（V5）：基金定投域——牛熊市场序列（seed 派生独立支流，确定性可重放）。
// 市场态不进存档：marketAt(seed, age) 从 18 岁起点重放马尔可夫链，任意次调用
// 同参同果；绝不消耗主 rng（R82 探针同款纪律）。零日历约束：链按玩家年龄锚定。
import type { GameState } from './types'

export type MarketState = 'bull' | 'sideways' | 'bear'

/** 三态年化收益（定投市值年结乘数）：熊 −15% / 震荡 +3% / 牛 +18% */
export const MARKET_RETURN: Record<MarketState, number> = {
  bull: 0.18,
  sideways: 0.03,
  bear: -0.15,
}

/** 独立支流种子盐（与手足 0x5eedb105、宠物散列、考公 0xc1v1l 等互不冲突） */
const MARKET_SALT = 0x5eedbeef

/** mulberry32（与引擎 rng.ts 同款实现，独立实例） */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 转移矩阵（按当前态 roll 下一态）：行和恒 1 */
const TRANSITIONS: Record<MarketState, Array<[MarketState, number]>> = {
  bull: [['bull', 0.5], ['sideways', 0.35], ['bear', 0.15]],
  sideways: [['bull', 1 / 3], ['sideways', 1 / 3], ['bear', 1 / 3]],
  bear: [['bear', 0.45], ['sideways', 0.4], ['bull', 0.15]],
}

function step(m: MarketState, roll: number): MarketState {
  let acc = 0
  for (const [next, p] of TRANSITIONS[m]) {
    acc += p
    if (roll < acc) return next
  }
  return TRANSITIONS[m][TRANSITIONS[m].length - 1][0]
}

/** 玩家 age 岁当年的市场态：从 18 岁（起点震荡）重放到 age；age ≤18 恒为起点态 */
export function marketAt(seed: number, age: number): MarketState {
  let m: MarketState = 'sideways'
  if (age <= 18) return m
  const rng = mulberry32((seed ^ MARKET_SALT) >>> 0)
  for (let a = 19; a <= age; a++) {
    m = step(m, rng())
  }
  return m
}

/** 基金在册判定（读 state.fund） */
export function hasFund(state: Pick<GameState, 'fund'>): boolean {
  return state.fund !== undefined
}
