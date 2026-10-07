// 第 23 轮：房贷余额模型引擎
// 等额本息贷款的开贷、年供推导与年度摊还。全部为纯函数、不消耗 RNG，
// 保证同 seed 复现；本文件是房贷数值的唯一权威出口（事件接线与年度结算都经这里）。
import type { MortgageState } from './types'

/** 房贷年利率：全游戏统一，年度扣款与摊还表都按它推导 */
export const MORTGAGE_RATE = 0.049

const round100 = (v: number): number => Math.round(v / 100) * 100

/**
 * 等额本息年供（元/年，取整到百元）：
 *   年供 = 本金 × r × (1+r)^n / ((1+r)^n − 1)
 * 取整带来的几元漂移由尾年"按余额一次结清"吸收，不影响"年度扣款固定可预期"。
 */
export function annuityPayment(principal: number, years: number, rate: number = MORTGAGE_RATE): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  if (!Number.isInteger(years) || years < 1) return 0
  if (!Number.isFinite(rate) || rate < 0) return 0
  if (rate === 0) return round100(principal / years)
  const f = Math.pow(1 + rate, years)
  return round100((principal * rate * f) / (f - 1))
}

/** 开贷：建立房贷结构；参数非法时返回 undefined（效果安全 no-op） */
export function openMortgage(principal: number, years: number): MortgageState | undefined {
  const annualPayment = annuityPayment(principal, years)
  if (annualPayment <= 0) return undefined
  return { principal, balance: principal, annualPayment, yearsLeft: years }
}

export interface MortgageYearResult {
  /** 结算后的房贷；还清或原本无贷为 null（调用方应移除该字段） */
  mortgage: MortgageState | null
  /** 本年实际扣款（无贷为 0） */
  payment: number
  /** 本年是否划走最后一笔 */
  cleared: boolean
}

/**
 * 房贷年度结算：先按年初余额计当年利息，再划扣固定年供（等额本息）。
 * 尾年（yearsLeft ≤ 1 或 应扣总额 ≤ 年供）按余额一次结清——取整漂移在此归零，
 * 保证余额恰好还完、绝不出现负余额或永不还清。
 */
export function settleMortgageYear(mortgage: MortgageState | undefined): MortgageYearResult {
  if (!mortgage || !Number.isFinite(mortgage.balance) || mortgage.balance <= 0) {
    return { mortgage: null, payment: 0, cleared: false }
  }
  const interest = Math.round(mortgage.balance * MORTGAGE_RATE)
  const due = mortgage.balance + interest
  const clearNow = (): MortgageYearResult => ({ mortgage: null, payment: due, cleared: true })
  if (mortgage.yearsLeft <= 1 || due <= mortgage.annualPayment) return clearNow()
  const nextBalance = due - mortgage.annualPayment
  if (nextBalance <= 0) return { mortgage: null, payment: mortgage.annualPayment, cleared: true }
  return {
    mortgage: { ...mortgage, balance: nextBalance, yearsLeft: mortgage.yearsLeft - 1 },
    payment: mortgage.annualPayment,
    cleared: false,
  }
}

/** 当前房贷余额（无贷为 0）：事件条件与展示共用的唯一读数口 */
export function mortgageBalance(mortgage: MortgageState | undefined): number {
  return mortgage && Number.isFinite(mortgage.balance) && mortgage.balance > 0 ? mortgage.balance : 0
}
