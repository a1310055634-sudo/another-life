// 第 22 轮测试：收入曲线与通胀
// 覆盖：工资公式化四系数（工龄/职级/景气/存量调薪）锚点、同一角色 30 年工资曲线
// 先升后稳（非锯齿非指数）验收、退休金挂钩缴费年限、通胀价格系数（学费/医疗/房）、
// 工龄跨失业保留、旧档（无 workYears）兼容推进。
import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { settleCareerYear, employPatch, endEmploymentPatch, applySalaryMul } from './career'
import {
  RETIRE_AGE,
  RETIRE_PENSION_MUL,
  EARLY_PENSION_MUL,
  PENSION_MIN,
  PENSION_MAX,
  PENSION_YEARS_BASE,
  PENSION_YEARS_STEP,
  PENSION_YEARS_CAP,
  pensionFromSalary,
  pensionYearsFactor,
  retirePatch,
} from './career'
import {
  INDUSTRY_CYCLE,
  computeSalary,
  getJob,
  industryFactor,
  levelFactor,
  tenureFactor,
  TENURE_STEP_EARLY,
  TENURE_STEP_LATE,
} from '../data/careers'
import {
  PRICE_BANDS,
  baseLivingExpense,
  livingExpense,
  medicalExpense,
  priceFactor,
  settleFinanceYear,
} from './finance'
import { validateState } from './validate'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' })
  return { ...base, ...patch }
}

/** 在职夹具：salary 由公式化年薪推导（与引擎同源），可选覆盖工龄 */
function makeEmployed(
  jobId: string,
  patch: Partial<GameState> = {},
  level = 1,
): GameState {
  const job = getJob(jobId)!
  const career = {
    kind: 'employed' as const,
    jobId,
    jobTitle: job.title,
    level,
    salary: computeSalary('highschool', patch.age ?? 25, job, level, patch.workYears ?? 0, 1),
    yearsAtJob: 0,
    salaryMul: 1 as const,
  }
  return makeGame(7, { age: 25, ...patch, career })
}

// ── 公式系数锚点 ──────────────────────────────────────────

describe('收入曲线四系数（第 22 轮）', () => {
  it('工龄系数：前 10 年 +3.5%/年，其后 +0.8%/年，25 年封顶 1.47（先升后稳）', () => {
    expect(tenureFactor(0)).toBe(1)
    expect(tenureFactor(1)).toBeCloseTo(1 + TENURE_STEP_EARLY)
    expect(tenureFactor(10)).toBeCloseTo(1.35)
    expect(tenureFactor(15)).toBeCloseTo(1.35 + 5 * TENURE_STEP_LATE)
    expect(tenureFactor(25)).toBeCloseTo(1.47)
    expect(tenureFactor(40)).toBeCloseTo(1.47) // 封顶
  })

  it('行业景气：按年龄段带状波动（数据驱动，无日历），±5% 温和', () => {
    expect(industryFactor(18)).toBe(1.0)
    expect(industryFactor(30)).toBe(1.0)
    expect(industryFactor(31)).toBe(1.05)
    expect(industryFactor(40)).toBe(1.05)
    expect(industryFactor(41)).toBe(1.02)
    expect(industryFactor(52)).toBe(1.02)
    expect(industryFactor(53)).toBe(0.97)
    expect(industryFactor(62)).toBe(0.97)
    expect(industryFactor(63)).toBe(0.94)
    // 全表因子都温和：0.9～1.1 之间
    for (const b of INDUSTRY_CYCLE) {
      expect(b.factor).toBeGreaterThan(0.9)
      expect(b.factor).toBeLessThan(1.1)
    }
  })

  it('职级系数 = 岗位晋升倍率逐级复利，有 maxLevel 封顶', () => {
    const job = getJob('junior_dev')!
    expect(levelFactor(job, 1)).toBe(1)
    expect(levelFactor(job, 2)).toBeCloseTo(1.28)
    expect(levelFactor(job, 4)).toBeCloseTo(1.28 ** 3)
  })

  it('computeSalary 全公式精确：基础工资×职级×工龄×景气×存量调薪', () => {
    // 本科初级程序员 36 岁（黄金期）、职级 2、工龄 12 年：
    // 96000 × 1.28 × 1.366(工龄 10+2) × 1.05 = 176246.8 → 176200
    expect(computeSalary('bachelor', 36, getJob('junior_dev')!, 2, 12, 1)).toBe(176200)
    // 存量调薪 0.88 直接乘进基础工资
    expect(computeSalary('bachelor', 36, getJob('junior_dev')!, 2, 12, 0.88)).toBe(155100) // ×0.88=155097.2 → 155100
  })
})

// ── 30 年工资曲线验收（先升后稳、非锯齿、非指数）──────────

describe('30 年工资曲线验收', () => {
  it('同一角色 30 年（无晋升干扰）：逐年涨幅有限、先升后稳、总增幅远低于复利漂移', () => {
    // 仓储管理员 + 零技能：晋升门槛 33 永远够不到 → 曲线只由工龄系数与行业景气驱动
    const s = makeEmployed('warehouse_keeper', { age: 25, skills: { academics: 0, vocational: 0 } })
    expect(s.career.kind === 'employed' && s.career.salary).toBe(38000)
    const salaries: number[] = []
    const levels: number[] = []
    let cur = s
    for (let i = 0; i < 30; i++) {
      cur = advanceYear(cur)
      if (cur.career.kind === 'employed') {
        salaries.push(cur.career.salary)
        levels.push(cur.career.level)
      }
    }
    expect(salaries).toHaveLength(30)
    expect(levels.every((l) => l === 1)).toBe(true) // 确认无晋升干扰
    expect(salaries.every((v) => Number.isFinite(v) && v > 0)).toBe(true)

    // 非锯齿：任何一年涨跌都有限（工龄 3.5%/0.8% + 景气带 ±5%，一年最多叠两段）
    for (let i = 1; i < salaries.length; i++) {
      const r = salaries[i] / salaries[i - 1]
      expect(r).toBeGreaterThan(0.93)
      expect(r).toBeLessThan(1.09)
    }
    // 先升后稳：前十年年均涨幅 > 3%，最后一个十年年均涨幅 < 1%
    const decMean = (from: number, to: number) => {
      let sum = 0
      for (let i = from + 1; i <= to; i++) sum += salaries[i] / salaries[i - 1] - 1
      return sum / (to - from)
    }
    expect(decMean(0, 9)).toBeGreaterThan(0.03)
    expect(decMean(20, 29)).toBeLessThan(0.01)
    // 非指数：29 年总增幅 < 1.5 倍（旧模型无晋升复利 1.02^29≈1.77；有晋升只会更高）
    const total = salaries[29] / salaries[0]
    expect(total).toBeGreaterThan(1.2) // 确实在涨
    expect(total).toBeLessThan(1.5)
    // 终值锚点：55 岁工龄 30 年 = 38000×1.47(工龄封顶)×0.97(景气回落) = 54184.2 → 54200
    expect(salaries[29]).toBe(54200)
  })

  it('在职晋升年：职级系数重推、工龄不清零、缴费年限继续累计', () => {
    const dev = makeEmployed('junior_dev', { workYears: 2 })
    if (dev.career.kind !== 'employed') throw new Error('夹具应为在职')
    dev.career = { ...dev.career, yearsAtJob: 2 } // 满 promoteEvery 前夜
    const out = settleCareerYear(dev, { academics: 63, vocational: 15 }) // 压线晋升
    expect(out.career).toMatchObject({ level: 2 })
    expect(out.workYears).toBe(3)
  })

  it('中年再就业保留工龄系数：48 岁 · 工龄 18 年入职电工不吃毕业生起薪', () => {
    const s = makeGame(9, {
      age: 48,
      education: 'highschool',
      skills: { academics: 10, vocational: 50 },
      workYears: 18,
    })
    const patch = employPatch(s, 'electrician')
    expect(patch.ok).toBe(true)
    // 52000×1.414(工龄18)×1.02(景气回落前高原)=74998.56 → 75000
    expect(patch.career).toMatchObject({ kind: 'employed', level: 1, salary: 75000 })
  })

  it('工龄跨失业保留：在职 3 年 → 辞职 → 再就业，缴费年限与工龄系数延续', () => {
    let s = makeEmployed('stall_vendor', { workYears: 3, skills: { academics: 10, vocational: 30 } })
    s = { ...s, career: endEmploymentPatch(s, 'resigned').career }
    const out = settleCareerYear(s, { academics: 0, vocational: 0 })
    expect(out.career.kind).toBe('unemployed')
    expect(out.workYears).toBe(3) // 待业不涨也不清
    const re = employPatch({ ...s, workYears: out.workYears }, 'warehouse_keeper')
    expect(re.ok).toBe(true)
    // 38000×1.105(工龄3)×1.0 = 41990 → 42000
    expect(re.career).toMatchObject({ salary: 42000 })
  })

  it('salaryMul 存量倍率跨年保留：降薪后的工龄调整建立在倍率之上', () => {
    let s = makeEmployed('junior_dev')
    s = { ...s, career: applySalaryMul(s, 0.88) }
    const out = settleCareerYear(s, { academics: 0, vocational: 0 })
    if (out.career.kind !== 'employed') throw new Error('应为在职')
    expect(out.career.salaryMul).toBe(0.88)
    // 96000×1.035×0.88 = 87412.8 → 87400
    expect(out.career.salary).toBe(87400)
  })
})

// ── 退休金挂钩缴费年限 ────────────────────────────────────

describe('退休金缴费年限折算（第 22 轮）', () => {
  it('缴费系数：无年限 0.5、每 year +0.02、25 年封顶 1.0', () => {
    expect(pensionYearsFactor(0)).toBe(PENSION_YEARS_BASE)
    expect(pensionYearsFactor(10)).toBeCloseTo(PENSION_YEARS_BASE + 10 * PENSION_YEARS_STEP)
    expect(pensionYearsFactor(PENSION_YEARS_CAP)).toBe(1)
    expect(pensionYearsFactor(40)).toBe(1) // 封顶
  })

  it('pensionFromSalary：缴满口径与第 16 轮全额完全一致（向后兼容锚点）', () => {
    expect(pensionFromSalary(60000)).toBe(24000)
    expect(pensionFromSalary(60000, RETIRE_PENSION_MUL, PENSION_YEARS_CAP)).toBe(24000)
    expect(pensionFromSalary(60000, EARLY_PENSION_MUL, PENSION_YEARS_CAP)).toBe(19200)
    expect(pensionFromSalary(20000)).toBe(PENSION_MIN)
    expect(pensionFromSalary(200000)).toBe(PENSION_MAX)
  })

  it('无缴费年限者退休金显著偏低：保底线随系数缩水', () => {
    // 同样 3 万末期工资：缴满 25 年 12000，零缴费只有 6000（-50%）
    expect(pensionFromSalary(30000, RETIRE_PENSION_MUL, PENSION_YEARS_CAP)).toBe(12000)
    expect(pensionFromSalary(30000, RETIRE_PENSION_MUL, 0)).toBe(6000)
    // 6 万末期工资零缴费：60000×0.4×0.5=12000（高于缩水保底 6000，取公式值）
    expect(pensionFromSalary(60000, RETIRE_PENSION_MUL, 0)).toBe(12000)
    // 上限封顶不受缴费年限放大
    expect(pensionFromSalary(200000, RETIRE_PENSION_MUL, 30)).toBe(PENSION_MAX)
  })

  it('到龄自动退休：退休金 = 末期工资×倍率×缴费系数，最后一年工作计入缴费', () => {
    const full = makeGame(7, {
      age: 64,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 80000, yearsAtJob: 4 },
      workYears: 25,
    })
    const r1 = advanceYear(full)
    expect(r1.career).toMatchObject({ kind: 'retired', pension: 32000 }) // 80000×0.4×1.0
    expect(r1.workYears).toBe(26)

    const thin = makeGame(7, {
      age: 64,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 80000, yearsAtJob: 1 },
      workYears: 2,
    })
    const r2 = advanceYear(thin)
    // 最后一年工作计入缴费 → 缴费 3 年系数 0.56：80000×0.4×0.56 = 17920 → 17900，不足全额的 55%
    expect(r2.career).toMatchObject({ kind: 'retired', pension: 17900 })
    expect(r2.workYears).toBe(3)
    if (r2.career.kind === 'retired' && r1.career.kind === 'retired') {
      expect(r2.career.pension).toBeLessThan(r1.career.pension * 0.6) // 显著偏低
    }
    expect(validateState(r2).issues).toEqual([])
  })

  it('retirePatch 事件退休按实际工龄折算；snapshot/履历不受影响', () => {
    const s = makeGame(11, {
      age: 55,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 4 },
      workYears: 10,
    })
    const patch = retirePatch(s, EARLY_PENSION_MUL)
    if (patch.career.kind !== 'retired') throw new Error('应为退休')
    // 60000×0.32(提前退休)×0.7(缴费 10 年) = 13440 → 13400
    expect(patch.career.pension).toBe(13400)
  })

  it('从不就业者不触发到龄退休（无缴费无退休金），维持原身份', () => {
    const s = makeGame(12, { age: 66, career: { kind: 'none' } })
    const next = advanceYear(s)
    expect(next.career.kind).toBe('none')
    expect(next.age).toBe(67)
  })
})

// ── 通胀价格系数 ──────────────────────────────────────────

describe('通胀价格系数（第 22 轮）', () => {
  it('priceFactor 按年龄段带状递增，幅度温和（≤15%）', () => {
    expect(priceFactor(18)).toBe(1.0)
    expect(priceFactor(30)).toBe(1.0)
    expect(priceFactor(31)).toBe(1.05)
    expect(priceFactor(45)).toBe(1.05)
    expect(priceFactor(46)).toBe(1.1)
    expect(priceFactor(60)).toBe(1.1)
    expect(priceFactor(61)).toBe(1.15)
    expect(priceFactor(77)).toBe(1.15)
    for (const b of PRICE_BANDS) {
      expect(b.factor).toBeGreaterThanOrEqual(1.0)
      expect(b.factor).toBeLessThanOrEqual(1.15)
    }
  })

  it('医疗自负开销：45 岁起出现，60/70 岁抬升，青年为 0', () => {
    expect(medicalExpense(30)).toBe(0)
    expect(medicalExpense(44)).toBe(0)
    expect(medicalExpense(45)).toBe(2100)  // 2000×1.05（31~45 温和带）
    expect(medicalExpense(59)).toBe(2200)  // 2000×1.10（46~60 明显带）
    expect(medicalExpense(60)).toBe(3300)  // 3000×1.10
    expect(medicalExpense(69)).toBe(3400)  // 3000×1.15（61+ 晚年带；3449.99…取整）
    expect(medicalExpense(70)).toBe(4600)  // 4000×1.15
  })

  it('livingExpense：医疗并入年度开支；学费与住房按年龄段价格系数', () => {
    // 50 岁无房无车：28000 + 2200
    expect(livingExpense(makeGame(1, { age: 50, career: { kind: 'none' } }))).toBe(30200)
    // 66 岁：22000 + 3400
    expect(livingExpense(makeGame(2, { age: 66, career: { kind: 'none' } }))).toBe(25400)
    // 66 岁租房：租金 12000×1.15 = 13800
    expect(livingExpense(makeGame(3, { age: 66, career: { kind: 'none' }, tags: ['bg_ordinary', 'independent_living'] }))).toBe(39200)
    // 66 岁有房：持有 9000×1.15 名义 10350，浮点 10350.000…2 → 取整 10400
    expect(livingExpense(makeGame(4, { age: 66, career: { kind: 'none' }, tags: ['bg_ordinary', 'homeowner'] }))).toBe(35800)
    // 32 岁在读大专：学费 25000×1.05 = 26250 → 百元取整 26300（大龄学生感受物价）
    expect(livingExpense(makeGame(5, { age: 32, career: { kind: 'student', stage: 'college', yearsLeft: 2 } }))).toBe(26300)
    // 20 岁在读大专：物价平稳，与旧口径一致
    expect(livingExpense(makeGame(6, { age: 20, career: { kind: 'student', stage: 'college', yearsLeft: 2 } }))).toBe(25000)
    // 26 岁在职 96000：26000 + 9600（价格系数 1.0、医疗 0，与旧口径一致）
    expect(livingExpense(makeEmployed('junior_dev', { age: 26 }))).toBe(35600)
    // 基础分层本身不变
    expect(baseLivingExpense(61)).toBe(22000)
  })

  it('医疗开销写入年志附注，青年年无附注', () => {
    const old = settleFinanceYear(makeGame(7, { age: 66, career: { kind: 'none' } }))
    expect(old.notes.some((n) => n.includes('医药'))).toBe(true)
    const young = settleFinanceYear(makeGame(8, { age: 26, career: { kind: 'none' } }))
    expect(young.notes.some((n) => n.includes('医药'))).toBe(false)
  })
})

// ── 旧档兼容（v2 无 workYears 字段）──────────────────────

describe('旧档兼容（第 22 轮可选字段）', () => {
  it('v2 旧档（无 workYears/salaryMul）推进不炸：工龄从 0 起算、年薪重推、快照照常', () => {
    const legacy = makeGame(13, {
      age: 40,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 50000, yearsAtJob: 6 },
    })
    expect(legacy.workYears).toBeUndefined()
    const next = advanceYear(legacy)
    expect(next.workYears).toBe(1)
    if (next.career.kind === 'employed') {
      // 44000×1.08(职级2)×1.035(工龄)×1.02(41 岁高原)=50166.9 → 50200（旧档薪资按新公式重推）
      expect(next.career.salary).toBe(50200)
    }
    expect(next.snapshots.length).toBe(legacy.snapshots.length + 1)
    expect(validateState(next).issues).toEqual([])
  })

  it('RETIRE_AGE 常量未被本轮移动（65 岁口径不变）', () => {
    expect(RETIRE_AGE).toBe(65)
  })

  it('非法 workYears/salaryMul（手改存档）被 validateState 重置，不污染推导', () => {
    const bad = makeGame(14, {
      age: 30,
      workYears: '三年' as unknown as number,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 44000, yearsAtJob: 1, salaryMul: -2 },
    })
    const { issues } = validateState(bad)
    expect(issues.some((i) => i.field === 'workYears')).toBe(true)
    expect(issues.some((i) => i.field === 'career.salaryMul')).toBe(true)
    expect(bad.workYears).toBe(0)
    if (bad.career.kind === 'employed') expect(bad.career.salaryMul).toBe(1)
    const next = advanceYear(bad)
    expect(Number.isFinite(next.money)).toBe(true)
    expect(validateState(next).issues).toEqual([])
  })
})
