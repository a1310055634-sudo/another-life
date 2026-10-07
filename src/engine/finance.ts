// 第 10 轮：财务系统引擎
// 生活开支分层、储蓄利息阶梯、负债利息与财务压力、失业救济、铺面租金。
// 全部为纯函数、不消耗 RNG（收入波动仍由 lifecycle 的 RNG 负责），保证同 seed 复现。
import type { CareerKind, GameState, Relation, StudentStage } from './types'
import { cityCostFactor } from './city'
import { childAge } from './children'

/** 金钱档位：事件可达性测试与财务压力都用它表达 */
export type MoneyTier = 'debt' | 'tight' | 'normal' | 'wealthy'

export const WEALTHY_LINE = 150000    // 富裕线
export const TIGHT_LINE = 20000       // 手头紧线
export const DEEP_DEBT_LINE = -50000  // 深度负债线

export function moneyTier(money: number): MoneyTier {
  if (money < 0) return 'debt'
  if (money < TIGHT_LINE) return 'tight'
  if (money >= WEALTHY_LINE) return 'wealthy'
  return 'normal'
}

// ── 年度生活开支 ───────────────────────────────────────────

/** 基础生活费（按年龄阶段，元/年）：青年花销最低、中年负担最重、晚年收缩 */
export function baseLivingExpense(age: number): number {
  if (age <= 25) return 20000
  if (age <= 40) return 26000
  if (age <= 60) return 28000
  return 22000
}

// ── 通胀价格系数（第 22 轮）────────────────────────────────
// 按年龄段给"学费/房租/医疗"等大额支出加温和的价格系数（+0%～15%），
// 数据驱动、不建日历系统；一次性事件金额不在此列（保持玩家感知的物价锚点）。

export interface PriceBand {
  maxAge: number
  factor: number
  label: string
}

export const PRICE_BANDS: PriceBand[] = [
  { maxAge: 30, factor: 1.0, label: '物价平稳' },
  { maxAge: 45, factor: 1.05, label: '物价温和上涨' },
  { maxAge: 60, factor: 1.1, label: '物价明显上涨' },
  { maxAge: 200, factor: 1.15, label: '晚年高物价' },
]

export function priceFactor(age: number): number {
  for (const b of PRICE_BANDS) {
    if (age <= b.maxAge) return b.factor
  }
  return 1
}

const round100 = (v: number): number => Math.round(v / 100) * 100

/**
 * 年度医疗自负开销（第 22 轮通胀线的"医疗"承担者）：
 * 45 岁起出现、60 岁起抬升、70 岁起再抬升，再叠加价格系数——年纪渐长的固定医药钱。
 * 基数取 2000/3000/4000：与各价格带相乘后均为整百，不产生取整粒度损失。
 */
export function medicalExpense(age: number): number {
  const base = age < 45 ? 0 : age < 60 ? 2000 : age < 70 ? 3000 : 4000
  return base === 0 ? 0 : round100(base * priceFactor(age))
}

/** 住房开销（标记驱动）：有房只付持有成本；租房付租金；住家里为 0。按年龄段价格系数 */
export const RENT_EXPENSE = 12000       // independent_living：在外租房（基准价，18~30 岁物价）
export const HOME_HOLD_EXPENSE = 9000   // homeowner：物业/维修等持有成本（同上）
export function housingExpense(tags: string[], age = 18): number {
  // 缺省按 18 岁物价（系数 1.0），兼容旧调用与既有测试
  if (tags?.includes('homeowner')) return round100(HOME_HOLD_EXPENSE * priceFactor(age))
  if (tags?.includes('independent_living')) return round100(RENT_EXPENSE * priceFactor(age))
  return 0
}

/** 其他生活方式开销（标记驱动，元/年） */
export const LIFESTYLE_EXPENSE: Record<string, number> = {
  pet_owner: 3000,   // 猫粮与疫苗
  car_owner: 12000,  // 养车
}

/**
 * 孩子的养育开支（元/年）：第 15 轮引入时为"有一个存活孩子就 10,000"；
 * 第 26 轮起按孩子年龄分档、逐个孩子累加——婴幼儿最贵、K12 持平（既有锚点）、
 * 大学贴补略降、就业后停付（孩子按真实年龄长大，开支跟着人生阶段走）。
 * 出生年龄未知（旧档/手改档）的孩子按旧口径 CHILD_EXPENSE 计，行为与第 15～25 轮一致。
 */
export const CHILD_EXPENSE = 10000
/** 年龄分档（孩子周岁，atLeast ≤ 年龄 ≤ maxInfant）；金额均为整百，无取整损耗 */
export const CHILD_EXPENSE_INFANT = 14000   // ≤5 岁：奶粉托育最贵
export const CHILD_EXPENSE_K12 = 10000      // 6~17 岁：与既有锚点一致
export const CHILD_EXPENSE_COLLEGE = 8000   // 18~21 岁：大学贴补
export function childExpenseFor(child: Relation, playerAge: number): number {
  const age = childAge(child, playerAge)
  if (age === null) return CHILD_EXPENSE
  if (age <= 5) return CHILD_EXPENSE_INFANT
  if (age <= 17) return CHILD_EXPENSE_K12
  if (age <= 21) return CHILD_EXPENSE_COLLEGE
  return 0
}
export function childExpense(state: Pick<GameState, 'relations' | 'age'>): number {
  return (state.relations ?? [])
    .filter((r) => r.kind === 'child' && r.alive)
    .reduce((sum, r) => sum + childExpenseFor(r, state.age), 0)
}

/** 生活方式总开销 = 住房（按年龄价格系数）+ 各项标记开销 */
export function lifestyleExpense(tags: string[], age = 18): number {
  let e = housingExpense(tags, age)
  for (const [tag, cost] of Object.entries(LIFESTYLE_EXPENSE)) {
    if (tags?.includes(tag)) e += cost
  }
  return e
}

/** 学生年度开支（第 8 轮口径不变）：各学制学费+生活费；本科/博士有奖学金津贴、净收入为正 */
function studentExpense(stage: StudentStage): number {
  switch (stage) {
    case 'highschool': return 12000
    case 'college': return 25000
    case 'master': return 18000
    case 'bachelor':
    case 'phd': return -20000
  }
}

/** 全量年度生活开支：学生按学制特例（学费按年龄段价格系数），其余 = 年龄基础 + 医疗 + 住房（价格系数）+ 生活方式 + 孩子养育 + 在职 10% 收入联动 */
export function livingExpense(state: GameState): number {
  const career = state.career
  if (career.kind === 'student') {
    return round100(studentExpense(career.stage) * priceFactor(state.age) * cityCostFactor(state.city)) + childExpense(state)
  }
  let e = baseLivingExpense(state.age)
  e += medicalExpense(state.age)
  e += housingExpense(state.tags ?? [], state.age)
  for (const [tag, cost] of Object.entries(LIFESTYLE_EXPENSE)) {
    if (state.tags?.includes(tag)) e += cost
  }
  e += childExpense(state)
  if (career.kind === 'employed') e += Math.round(career.salary * 0.10)
  // 城市生活成本系数（第 90 轮）：缺省 hometown=1 时保持原值不取整（旧行为逐位不变，
  // 18 局基线安全）；仅离乡年份取整到百元
  const costFactor = cityCostFactor(state.city)
  if (costFactor === 1) return e
  return round100(e * costFactor)
}

// ── 持续性现金流 ───────────────────────────────────────────

/** 老街铺面年租金（landlord 标记）：一次性大投入换持续现金流 */
export const SHOP_RENT = 18000
export function rentIncome(tags: string[]): number {
  return tags?.includes('landlord') ? SHOP_RENT : 0
}

/** 待业救济（元/年）：日子紧但不断顿 */
export const UNEMPLOYMENT_BENEFIT = 6000
export function unemploymentBenefit(kind: CareerKind): number {
  return kind === 'unemployed' ? UNEMPLOYMENT_BENEFIT : 0
}

// ── 利息 ──────────────────────────────────────────────────

/**
 * 阶梯存款利息（按年初存款、只对超出部分计息，单年封顶）：
 * 10 万以内不计息；10～50 万部分 2%；50～200 万部分 1.2%；200 万以上 0.6%。
 * 替代旧"全额 2% 无上限"——第 9 轮实测该机制与高薪叠加后富裕线无限滚雪球。
 */
export const SAVINGS_INTEREST_CAP = 30000
export function savingsInterest(money: number): number {
  if (!Number.isFinite(money) || money <= 100000) return 0
  let rest = money - 100000
  const t1 = Math.min(rest, 400000)
  rest -= t1
  const t2 = Math.min(rest, 1500000)
  rest -= t2
  const t3 = rest
  const raw = t1 * 0.02 + t2 * 0.012 + t3 * 0.006
  return Math.min(SAVINGS_INTEREST_CAP, Math.round(raw))
}

export const DEBT_RATE = 0.05
export const DEBT_INTEREST_CAP = 20000
/** 负债利息（按年初负债计息，单年封顶）：负债有代价，但不许指数爆炸 */
export function debtInterest(money: number): number {
  if (!Number.isFinite(money) || money >= 0) return 0
  return Math.min(DEBT_INTEREST_CAP, Math.round(-money * DEBT_RATE))
}

// ── 财务压力 ───────────────────────────────────────────────

export interface FinanceStress {
  drift: { happiness?: number; stress?: number }
  notes: string[]
}

/** 财务压力分档：轻债提醒、深负债伤身伤心、大额存款体感安心 */
export function financeStressDrift(money: number): FinanceStress {
  if (money <= -200000) {
    return { drift: { happiness: -5, stress: 5 }, notes: ['债台高筑，夜里翻来覆去睡不着'] }
  }
  if (money <= DEEP_DEBT_LINE) {
    return { drift: { happiness: -3, stress: 3 }, notes: ['债务像石头一样压在心上'] }
  }
  if (money < 0) {
    return { drift: { happiness: -1, stress: 1 }, notes: ['手头紧巴巴的，得精打细算'] }
  }
  if (money >= 500000) {
    return { drift: { happiness: 1, stress: -1 }, notes: ['账户里的数字让人踏实'] }
  }
  return { drift: {}, notes: [] }
}

// ── 年度财务结算 ───────────────────────────────────────────

export interface FinanceYear {
  rent: number              // 铺面租金
  benefit: number           // 失业救济
  savingsInterest: number   // 存款利息（收益，正数）
  debtInterest: number      // 负债利息（成本，正数）
  notes: string[]           // 年志附注
}

/**
 * 年度财务结算：租金/救济/利息全部按确定性规则计算。
 * 利息一律按年初余额（state.money）计，与当年收支无关，便于测试精确对账。
 */
export function settleFinanceYear(state: GameState): FinanceYear {
  const rent = rentIncome(state.tags)
  const benefit = unemploymentBenefit(state.career.kind)
  const si = savingsInterest(state.money)
  const di = debtInterest(state.money)
  const notes: string[] = []
  const childCost = childExpense(state)
  if (childCost > 0) notes.push(`孩子的吃穿用度又是一年 ${childCost.toLocaleString('zh-CN')} 元`)
  // 孩子成年自立（第 26 轮）：跨过 22 岁当年点一句，让"开支停了"可感可解释
  if ((state.relations ?? []).some((r) => childAge(r, state.age) === 22))
    notes.push('孩子开始自己谋生了，家里的担子轻了一截')
  if (medicalExpense(state.age) > 0) notes.push('年岁渐长，医药和体检成了一笔雷打不动的开销')
  if (benefit > 0) notes.push('领了失业救济，日子紧但没断顿')
  if (si > 0) notes.push(`存款利息 ${si.toLocaleString('zh-CN')} 元`)
  if (di > 0) notes.push(`负债利息滚出 ${di.toLocaleString('zh-CN')} 元`)
  return { rent, benefit, savingsInterest: si, debtInterest: di, notes }
}

// ── 大额消费门槛 ───────────────────────────────────────────

/**
 * 大额消费阈值：负债（money<0）时，即时支出 ≥ 此值的选项自动隐藏。
 * 第 9 轮实测漏洞：负债 -2.5 万仍能办 3,000 元健身年卡。
 * 延迟支出不计入——分期/借贷类选项是负债者的合法出路，不应被一刀切。
 */
export const BIG_SPEND_THRESHOLD = 3000
