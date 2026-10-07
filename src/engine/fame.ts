// 第 93 轮（V5）：自媒体名声域——走红/网暴支流窗口（seed 派生独立散列，确定性可重放）。
// 市场态不进存档：viralAt/hateAt 从 seed+age 直接散列，任意次调用同参同果；
// 绝不消耗主 rng。概率：走红窗 35%/年（有坚持更新标记的创作者），网暴窗 25%/年（走红者）。
import type { GameState } from './types'

/** 独立支流种子盐（合法 hex，与其他支流盐互不冲突） */
const FAME_SALT = 0xfa7e1102

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 走红窗（该年内容有机会爆）：散列 roll < 0.35 */
export const FAME_VIRAL_RATE = 0.35

/** 网暴窗（该年流量反噬）：散列 roll < 0.25 */
export const FAME_HATE_RATE = 0.25

export function viralAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ FAME_SALT) >>> 0) + age * 104729)
  return rng() < FAME_VIRAL_RATE
}

export function hateAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ (FAME_SALT + 1)) >>> 0) + age * 99991)
  return rng() < FAME_HATE_RATE
}

/** 名声在册判定（读 state.tags） */
export function isFamous(state: Pick<GameState, 'tags'>): boolean {
  return state.tags.includes('minor_fame')
}
