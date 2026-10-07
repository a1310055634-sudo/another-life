// 第 24 轮：生活方式长因果——健康风险值模型
// 年轻时的习惯在老年结账：年度结算按「标记 × 年龄」累积风险值（只累积，不直接扣属性），
// 兑现走分级体检与老年慢性病事件（资格读累积值而非仅年龄）。
// 戒烟/改变习惯让风险增速放缓而非历史清零：移除坏标记即停止增长，
// quit_smoking 等修复标记只提供小幅回落，远不抵消已积累的历史。
// 全部为纯函数、不消耗 RNG；数值全部为 0.5 的倍数，二进制精确、测试可精确锚定。

/** 生活方式标记 → 每年风险增速（正 = 风险累积，负 = 身体修复带来的缓慢回落） */
export const LIFESTYLE_RISK_RATE: Record<string, number> = {
  light_smoker: 2,       // 烟不离手
  heavy_drinker: 2,      // 长期饮酒
  desk_bound: 1,         // 久坐不动
  night_owl: 1,          // 长期熬夜
  routine_exercise: -1,  // 坚持锻炼
  rehab_program: -0.5,   // 康复训练中
  quit_smoking: -0.5,    // 已戒烟：缓慢修复，烟龄欠的账还在
}

// ── 倦怠（第 68 轮）：事件授予制（stress 全域动力学饱和，纯阈值不可用——
// R68 三探针实证入账本）；stress <60 年度结算自动摘除，倦怠期 happiness −1/年。
export const BURNOUT_TAG = 'burnout'
export const BURNOUT_HAPPINESS_DRAIN = 1

/**
 * 年龄系数：同样的习惯，年纪越大身体代偿越差，风险兑现越快。
 * 与 §6.6 收入曲线同思路——按年龄段带状取值，数据驱动不建日历。
 */
export function riskAgeFactor(age: number): number {
  if (age < 40) return 1
  if (age < 60) return 1.5
  return 2
}

/** 风险值上下限：与属性同范围（0～100），下限 0 表示没有负风险 */
export const RISK_MIN = 0
export const RISK_MAX = 100

/**
 * 年度风险累积：risk' = clamp(0,100, risk + Σ 各标记增速 × 年龄系数 + 慢病增速 × 年龄系数)。
 * tags 传当年度结算定型后的标记集——当年染上的习惯当年开始记账，当年戒断当年停涨。
 * chronicRate（第 43 轮，可选，缺省 0）：慢病在身的额外年度增速，由 chronicRiskRate(tags) 得出；
 * 缺省 0 保持既有行为（未患病者零感知，旧档兼容）。
 */
export function accumulateHealthRisk(
  tags: string[],
  age: number,
  current: number,
  chronicRate = 0,
): number {
  const factor = riskAgeFactor(age)
  let risk = current
  for (const tag of tags ?? []) {
    const rate = LIFESTYLE_RISK_RATE[tag]
    if (rate !== undefined) risk += rate * factor
  }
  risk += chronicRate * factor
  return Math.min(RISK_MAX, Math.max(RISK_MIN, risk))
}

/** 风险分档阈值：0～24 低 / 25～49 中 / ≥50 高（事件条件与年志提示共用一套口径） */
export const RISK_MODERATE = 25
export const RISK_HIGH = 50

export type RiskBand = 'low' | 'moderate' | 'high'

/** 风险值 → 分档读数 */
export function riskBand(risk: number): RiskBand {
  if (risk >= RISK_HIGH) return 'high'
  if (risk >= RISK_MODERATE) return 'moderate'
  return 'low'
}

/**
 * 跨档年志提示：只在风险升入更高档的那一年提醒一次（与低健康预警同思路，
 * 让「风险值」这个隐藏数值在年志上可见可感）；同档内波动或降档不提示。
 */
export function riskBandWarning(prev: number, curr: number): string | null {
  const before = riskBand(prev)
  const after = riskBand(curr)
  if (after === 'high' && before !== 'high')
    return '体检单上的异常指标攒了一叠，医生的原话是：身体要开始记账了'
  if (after === 'moderate' && before === 'low')
    return '体检开始出现几个小箭头，医生建议调整生活方式'
  return null
}

// ── 慢性病长期线（第 43 轮）────────────────────────────────
// 确诊（chronic_condition）不是一次性事件而是长期状态：药要长期吃、复查要按时去。
// 「控制良好」（chronic_managed，由遵医嘱/复查选项授予与刷新，CHRONIC_MANAGED_YEARS
// 年未刷新视为失访、由年度结算移除）让风险增速放缓而非清零——与戒烟同哲学：
// 历史欠账还在，但增速差 4 倍（61+ 年龄系数后失控 +8/年 vs 管理 +2/年），
// 并发症资格（healthRiskAtLeast，事件侧）因此对失控线更早兑现。
// 年度复查用药开支随第 22 轮物价系数（priceFactor）。纯函数、不消耗 RNG。

/** 慢病在身标记：确诊即事实，hlt_chronic_onset 全部选项授予 */
export const CHRONIC_CONDITION_TAG = 'chronic_condition'
/** 控制良好标记：遵医嘱/复查授予与刷新，到期未刷新 = 失访失控 */
export const CHRONIC_MANAGED_TAG = 'chronic_managed'
/** 管理良好有效期（年）：复查刷新；到期由年度结算移除（cooldowns 借用键记时点） */
export const CHRONIC_MANAGED_YEARS = 2
/** 慢病年度复查与用药开支基准（元/年，×priceFactor：61+ → 1,380） */
export const CHRONIC_ANNUAL_COST = 1200
/** 失控（患病且无 managed）年度风险增速 */
export const CHRONIC_RISK_UNMANAGED = 4
/** 控制良好年度风险增速 */
export const CHRONIC_RISK_MANAGED = 1

/** 慢病在身时的年度风险增速：未患病 0；失控快、管理慢（差 4 倍） */
export function chronicRiskRate(tags: string[]): number {
  if (!tags || !tags.includes(CHRONIC_CONDITION_TAG)) return 0
  return tags.includes(CHRONIC_MANAGED_TAG) ? CHRONIC_RISK_MANAGED : CHRONIC_RISK_UNMANAGED
}
