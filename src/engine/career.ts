// 第 9 轮：职业系统引擎
// 求职（employPatch）、离职（endEmploymentPatch）、晋升（promotePatch / settleCareerYear）
// 全部为纯函数；标记约定：job_<id> 当前岗位、ex_<id> 行业经历、ever_employed 曾正式就业、
// laid_off / resigned 离职方式（再就业时移除）。
import type { CareerState, GameState, HistoryEntry, SkillKey } from './types'
import { sanitizeMoney } from './attrs'
import {
  computeSalary,
  getJob,
  isEligibleFor,
  jobTitleAt,
  promotionThreshold,
  type JobDef,
} from '../data/careers'
import { citySalaryFactor } from './city'

export interface CareerPatch {
  career: CareerState
  addTags: string[]
  removeTags: string[]
  ok: boolean
  reason?: string
}

const noPatch = (career: CareerState, reason?: string): CareerPatch => ({
  career, addTags: [], removeTags: [], ok: false, reason,
})

/** 岗位标记：job_x（当前）/ ex_x（经历） */
export function jobIdTag(id: string): string {
  return `job_${id}`
}
export function jobExTag(id: string): string {
  return `ex_${id}`
}

/** 当前在职岗位 ID（未就业返回 null） */
export function currentJobId(state: GameState): string | null {
  return state.career.kind === 'employed' ? state.career.jobId : null
}

/**
 * 入职：none/unemployed → employed，或在职者跳槽转行。
 * 守卫：在读不可就业、门槛不足拒绝、重复入职同一岗位拒绝。
 * 转行时旧岗位标记转为 ex_（行业经历保留，供后续事件引用）。
 */
export function employPatch(state: GameState, jobId: string): CareerPatch {
  if (state.career.kind === 'student') return noPatch(state.career, '在读期间不能签劳动合同')
  const job = getJob(jobId)
  if (!job) return noPatch(state.career, `未知岗位 ${jobId}`)
  if (state.career.kind === 'employed' && state.career.jobId === jobId) {
    return noPatch(state.career, '已经在这家干了')
  }
  if (!isEligibleFor(state, job)) return noPatch(state.career, `${job.title}的门槛不够`)

  const prevId = currentJobId(state)
  const addTags: string[] = [jobIdTag(jobId), 'ever_employed']
  const removeTags: string[] = ['laid_off', 'resigned']
  if (prevId && prevId !== jobId) {
    removeTags.push(jobIdTag(prevId))
    addTags.push(jobExTag(prevId))
  }
  // 公式化年薪（第 22 轮）：入职按当前工龄推导——中年转行/再就业不吃"毕业生起薪"
  const salary = computeSalary(state.education, state.age, job, 1, state.workYears ?? 0, 1, citySalaryFactor(state.city))
  return {
    ok: true,
    career: { kind: 'employed', jobId, jobTitle: jobTitleAt(job, 1), level: 1, salary, yearsAtJob: 0, salaryMul: 1 },
    addTags,
    removeTags,
  }
}

/** 离职：employed → unemployed（weeks 归零）。kind 区分被裁与主动辞职 */
export function endEmploymentPatch(state: GameState, kind: 'laid_off' | 'resigned'): CareerPatch {
  if (state.career.kind !== 'employed') return noPatch(state.career, '本来就没有正式工作')
  const prevId = state.career.jobId
  return {
    ok: true,
    career: { kind: 'unemployed', weeks: 0 },
    addTags: [jobExTag(prevId), kind],
    removeTags: [jobIdTag(prevId)],
  }
}

/**
 * 事件驱动的晋升：校验职级上限，不校验技能门槛（"表现被看见了"的戏剧时刻）；
 * 年度考核晋升（带技能门槛）走 settleCareerYear。
 */
export function promotePatch(state: GameState): CareerPatch {
  if (state.career.kind !== 'employed') return noPatch(state.career)
  const job = getJob(state.career.jobId)
  if (!job) return noPatch(state.career)
  const maxLevel = job.maxLevel ?? 4
  if (state.career.level >= maxLevel) return noPatch(state.career, '已经到顶了')
  const level = state.career.level + 1
  // 公式化年薪（第 22 轮）：职级系数随晋升重推，调薪倍率与工龄系数保留
  const salary = computeSalary(
    state.education, state.age, job, level,
    state.workYears ?? 0, state.career.salaryMul ?? 1, citySalaryFactor(state.city),
  )
  return {
    ok: true,
    career: {
      ...state.career,
      level,
      jobTitle: jobTitleAt(job, level),
      salary,
      yearsAtJob: 0,
    },
    addTags: [],
    removeTags: [],
  }
}

/**
 * 事件调薪（第 22 轮公式化）：倍率写入存量字段 salaryMul（逐次相乘后夹 0.5～2），
 * 年薪按公式重推——此后每年的工龄/景气调整都建立在这个倍率上，与旧"直接改 salary"等价。
 * 岗位表缺失（测试假岗位）时退化为按旧薪直接乘，保持历史行为。
 */
export function applySalaryMul(state: GameState, mul: number): CareerState {
  const career = state.career
  if (career.kind !== 'employed') return career
  const clamped = Math.max(0.5, Math.min(2, mul))
  const salaryMul = Math.max(0.5, Math.min(2, (career.salaryMul ?? 1) * clamped))
  const job = getJob(career.jobId)
  const salary = job
    ? computeSalary(state.education, state.age, job, career.level, state.workYears ?? 0, salaryMul, citySalaryFactor(state.city))
    : Math.round(sanitizeMoney(career.salary * clamped) / 100) * 100
  return { ...career, salaryMul, salary }
}

// ── 退休（第 16 轮；第 22 轮挂钩缴费年限）──────────────────────
// 此前 retired 状态只有类型定义，没有任何机制能让角色真正退休；
// 本轮补上：事件可办提前退休，到 RETIRE_AGE 年度结算自动退休兜底。
export const RETIRE_AGE = 65
/** 标准退休金：最后年薪 × 40%（取整到百元） */
export const RETIRE_PENSION_MUL = 0.4
/** 提前退休折算：拿得早、拿得少 */
export const EARLY_PENSION_MUL = 0.32
export const PENSION_MIN = 12000
export const PENSION_MAX = 60000

// 缴费年限折算（第 22 轮）：退休金 = 末期工资 × 折算倍率 × 缴费系数。
// 无缴费年限打五折、每缴一年 +2%、缴满 25 年封顶（系数 1.0，与旧全额口径一致）；
// 保底线随系数等比缩水——没缴过钱的人拿不到全额保底。
export const PENSION_YEARS_BASE = 0.5
export const PENSION_YEARS_STEP = 0.02
export const PENSION_YEARS_CAP = 25

export function pensionYearsFactor(workYears: number): number {
  const y = Math.max(0, workYears)
  return Math.min(1, PENSION_YEARS_BASE + PENSION_YEARS_STEP * y)
}

/**
 * 按末期工资折算退休金。workYears 缺省按缴满（PENSION_YEARS_CAP）处理，
 * 使旧的两参调用与第 16 轮口径完全一致；真实退休路径（retirePatch）传实际工龄。
 */
export function pensionFromSalary(
  salary: number,
  mul = RETIRE_PENSION_MUL,
  workYears = PENSION_YEARS_CAP,
): number {
  const f = pensionYearsFactor(workYears)
  const raw = Math.round((sanitizeMoney(salary) * mul * f) / 100) * 100
  const floor = Math.round((PENSION_MIN * f) / 100) * 100
  return Math.min(PENSION_MAX, Math.max(floor, raw))
}

/**
 * 办理退休：employed → retired。非在职为 no-op。
 * 退休金按最后年薪与累计缴费年限折算（提前退休传更低倍率），岗位标记转为行业经历。
 */
export function retirePatch(state: GameState, mul = RETIRE_PENSION_MUL): CareerPatch {
  if (state.career.kind !== 'employed') return noPatch(state.career, '没有可退休的岗位')
  const prevId = state.career.jobId
  // 体制内退休金加成（第 88 轮）：岗位 pensionBonus 系数上浮（缺省 1，既有岗位零变化）
  const bonus = getJob(prevId)?.pensionBonus ?? 1
  const pension = pensionFromSalary(state.career.salary, mul * bonus, state.workYears ?? 0)
  return {
    ok: true,
    career: { kind: 'retired', pension },
    addTags: [jobExTag(prevId), 'retired'],
    removeTags: [jobIdTag(prevId), 'laid_off', 'resigned'],
  }
}

export interface CareerYearResult {
  career: CareerState
  /** 累计工龄/缴费年限（第 22 轮）：在职年 +1，其余身份保持原值，由 advanceYear 落回状态 */
  workYears: number
  /** 晋升时产出履历条目与年志提示 */
  history?: HistoryEntry
  notes: string[]
  /** 到龄自动退休（第 16 轮）时的标记变更：岗位转行业经历、授予 retired */
  addTags?: string[]
  removeTags?: string[]
}

/**
 * 在职年度结算：工龄（缴费年限）+1、年薪按公式重推（工龄系数 +1 年、行业景气随年龄重推）；
 * 在职满 promoteEvery 年且技能过门槛 → 考核晋升（职级系数随晋升重推，工龄不清零）。
 * 待业：失业周数累计。学生/零工/退休原样返回。
 */
export function settleCareerYear(
  state: GameState,
  skills: Record<SkillKey, number>,
): CareerYearResult {
  const career = state.career
  if (career.kind === 'employed') {
    const workYears = (state.workYears ?? 0) + 1
    // 到龄自动退休（第 16 轮）：年度结算最先判定，不再走晋升/涨薪；
    // 退休金按末期工资与累计缴费年限折算（最后一年工作计入缴费），
    // 履历记 key 条目供结局总结引用。
    if (state.age + 1 >= RETIRE_AGE) {
      const patch = retirePatch({ ...state, workYears })
      const pension = patch.career.kind === 'retired' ? patch.career.pension : 0
      return {
        career: patch.career,
        workYears,
        history: {
          age: state.age + 1,
          eventId: 'settle',
          title: '退休',
          choice: '',
          summary: `到龄办理了退休，年退休金 ${pension.toLocaleString('zh-CN')} 元`,
          key: true,
        },
        notes: [`到了退休年龄，你办理了退休手续`],
        addTags: patch.addTags,
        removeTags: patch.removeTags,
      }
    }
    const job = getJob(career.jobId)
    const maxLevel = job?.maxLevel ?? 4
    const promoteEvery = job?.promoteEvery ?? 3
    const nextAge = state.age + 1
    // 公式化年薪（第 22 轮）：岗位表缺失（测试假岗位）时保持原薪不动
    const nextSalary = job
      ? computeSalary(state.education, nextAge, job, career.level, workYears, career.salaryMul ?? 1, citySalaryFactor(state.city))
      : career.salary
    let next: CareerState = {
      ...career,
      yearsAtJob: career.yearsAtJob + 1,
      salary: nextSalary,
    }
    const notes: string[] = []
    const nextLevel = next.kind === 'employed' ? next.level + 1 : 0
    const canPromote =
      next.kind === 'employed' &&
      next.yearsAtJob >= promoteEvery &&
      next.level < maxLevel &&
      job !== undefined &&
      promotionSkillValue(job, skills) >= promotionThreshold(job, nextLevel)
    if (canPromote && next.kind === 'employed' && job) {
      // next.level 仍是晋升前的职级，新头衔按晋升后的级别取（与 salary/level 同口径）
      const newTitle = jobTitleAt(job, next.level + 1)
      next = {
        ...next,
        level: next.level + 1,
        jobTitle: newTitle,
        salary: computeSalary(state.education, nextAge, job, next.level + 1, workYears, next.salaryMul ?? 1, citySalaryFactor(state.city)),
        yearsAtJob: 0,
      }
      notes.push(`年度考核通过，你升到了职级 ${next.level}，年薪涨到了 ${next.salary.toLocaleString('zh-CN')} 元`)
      return {
        career: next,
        workYears,
        history: {
          age: state.age + 1,
          eventId: 'settle',
          title: '升职',
          choice: '',
          // 第 31 轮：履历与顶栏同步亮出新头衔（titles 逐级表），不再只报职级数字
          summary: `晋升为「${newTitle}」（职级 ${next.level}）`,
        },
        notes,
      }
    }
    return { career: next, workYears, notes }
  }
  if (career.kind === 'unemployed') {
    return {
      career: { kind: 'unemployed', weeks: career.weeks + 52 },
      workYears: state.workYears ?? 0,
      notes: [],
    }
  }
  return { career, workYears: state.workYears ?? 0, notes: [] }
}

/** 晋升考核用的技能值：岗位主门槛对应的那项技能 */
function promotionSkillValue(job: JobDef, skills: Record<SkillKey, number>): number {
  return job.minAcademics !== undefined ? skills.academics : skills.vocational
}

/** 在职描述（顶栏/履历用）：初级程序员（职级 2 · 年薪 9.6 万） */
export function employedLabel(jobTitle: string, level: number, salary: number): string {
  const wan = salary / 10000
  const wanText = wan >= 10 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '')
  return `${jobTitle}（职级 ${level} · 年薪 ${wanText} 万）`
}
