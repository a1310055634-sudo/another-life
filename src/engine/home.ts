// 第 86 轮（V5）：房产域——现值复利与卖出净额。
// 全部纯函数、不消耗 RNG（房贷模型同款纪律）；复利只动 home.value 不动现金，
// 资产曲线/报告的现金口径不变（18 局零位移的结构性保证）。
import type { CityTier, GameState, HomeProperty, MortgageState } from './types'
import { cityHomeRate } from './city'

/** 房产年增值率基准（第 86 轮常量，=省城档；第 90 轮起按城市分档 1.2%/2%/3%） */
export const HOME_APPRECIATION = 0.02

const round100 = (v: number): number => Math.round(v / 100) * 100

/** 年度复利：value ×(1+城市增值率) 取整到百元；非法值（NaN/负数）不增值原样保留；
 *  缺省 hometown=1.2%（旧档语义），一线 3%、省城 2% */
export function appreciateHome(home: HomeProperty | undefined, city?: CityTier): HomeProperty | undefined {
  if (!home) return undefined
  if (!Number.isFinite(home.value) || home.value <= 0) return home
  return { ...home, value: round100(home.value * (1 + cityHomeRate(city))) }
}

/** 卖出净额 = 现值 − 房贷余额（可为负：卖房先清贷，倒欠部分从卖价里扣） */
export function sellNetProceeds(home: HomeProperty, mortgage: MortgageState | undefined): number {
  return home.value - (mortgage?.balance ?? 0)
}

/** 房册在册判定（读 state.home） */
export function ownsHome(state: Pick<GameState, 'home'>): boolean {
  return state.home !== undefined
}
