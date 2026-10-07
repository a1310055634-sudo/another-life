// 第 90 轮（V5）：城市域——三档层级系数（薪资/生活成本/房产增值）。
// 常量纯函数、不消耗 RNG；缺省 hometown 全系数=1 → 旧行为逐位不变
// （18 局零位移的结构性保证；migration 事件为选择性加入）。
import type { CityTier, GameState } from './types'

/** 薪资系数：一线 1.35 / 省城 1.15 / 老家 1.0 */
export const CITY_SALARY: Record<CityTier, number> = { hometown: 1, province: 1.15, metro: 1.35 }
/** 生活成本系数：一线 1.3 / 省城 1.1 / 老家 1.0 */
export const CITY_COST: Record<CityTier, number> = { hometown: 1, province: 1.1, metro: 1.3 }
/** 房产年增值率（替代「房价基数」的等价挂钩——购房金额为静态事件数字，
 *  城市差异体现为持有期增值速度）：一线 3% / 省城 2% / 老家 1.2% */
export const CITY_HOME_RATE: Record<CityTier, number> = { hometown: 0.012, province: 0.02, metro: 0.03 }

/** 归一化：旧档/缺省 undefined = hometown（全系数 1） */
export function cityOf(city: CityTier | undefined): CityTier {
  return city ?? 'hometown'
}

export function citySalaryFactor(city: CityTier | undefined): number {
  return CITY_SALARY[cityOf(city)]
}

export function cityCostFactor(city: CityTier | undefined): number {
  return CITY_COST[cityOf(city)]
}

export function cityHomeRate(city: CityTier | undefined): number {
  return CITY_HOME_RATE[cityOf(city)]
}

/** 城市在册判定（读 state.city） */
export function cityOfState(state: Pick<GameState, 'city'>): CityTier {
  return cityOf(state.city)
}
