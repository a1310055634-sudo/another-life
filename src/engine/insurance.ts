// 第 85 轮（V5）：医疗与保险域——基本医保报销系数与实付估算。
// 系数为常量纯函数、不消耗 RNG（房贷模型同款纪律）；只在 V5 新事件内实装，
// 不追溯既有事件金额（18 局基线零位移的结构性保证）。
import type { CareerKind, GameState } from './types'

/** 职工医保（在职）：报销 70% */
export const REBATE_EMPLOYED = 0.7
/** 居民医保（学生/待业/零工——灵活就业口径）：报销 50% */
export const REBATE_RESIDENT = 0.5
/** 退休人员医疗保障：报销 85% */
export const REBATE_RETIRED = 0.85

/** 按职业身份给基本医保报销档位（退休 > 在职 > 居民） */
export function insuranceRebate(careerKind: CareerKind): number {
  if (careerKind === 'employed') return REBATE_EMPLOYED
  if (careerKind === 'retired') return REBATE_RETIRED
  return REBATE_RESIDENT
}

/** 大额医疗总费用的基本医保实付估算（取整到百元；费用为负/非法时按 0 处理） */
export function estimateOutOfPocket(careerKind: CareerKind, totalCost: number): number {
  if (!Number.isFinite(totalCost) || totalCost <= 0) return 0
  return Math.round((totalCost * (1 - insuranceRebate(careerKind))) / 100) * 100
}

/** 保单在册判定（读 state.insurance） */
export function isInsured(state: Pick<GameState, 'insurance'>): boolean {
  return state.insurance !== undefined
}
