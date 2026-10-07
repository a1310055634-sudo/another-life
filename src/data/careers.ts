// 第 8 轮：职业门槛表（教育与技能 → 职业资格的映射）
// 第 9 轮：补全职级曲线（晋升加薪倍率/职级上限/晋升间隔）、年度压力、五大职业方向，
// 求职/离职/晋升结算在 engine/career.ts 实现。
import type { GameState } from '../engine/types'
import { EDU_RANK } from '../engine/education'

/** 职业方向（至少 4 条可交叉路线，互不锁死） */
export type JobTrack = 'craft' | 'office' | 'care' | 'tech' | 'academic'

export const TRACK_LABELS: Record<JobTrack, string> = {
  craft: '手艺',
  office: '行政',
  care: '医护',
  tech: '技术',
  academic: '学术',
}

export interface JobDef {
  id: string
  title: string
  /**
   * 逐级头衔（第 31 轮清偿 V1 遗留）：titles[level-1] 为该职级的对外头衔，
   * 长度与 maxLevel 一致、titles[0] 恒等于 title（入职头衔不变，晋升起逐级更新）；
   * 缺省（测试假岗位/旧数据）回退 title。
   */
  titles?: string[]
  /** 最低学历 */
  minEducation: 'junior' | 'highschool' | 'college' | 'bachelor' | 'master' | 'phd'
  /** 学业功底门槛（应试/理论型岗位） */
  minAcademics?: number
  /** 职业技能门槛（实操/手艺型岗位） */
  minVocational?: number
  /** 起薪年收入（元） */
  baseSalary: number
  /** 职业方向 */
  track: JobTrack
  /** 晋升时年薪倍率（默认 1.15） */
  levelRaise?: number
  /** 职级上限（默认 4） */
  maxLevel?: number
  /** 每年压力基调（默认 3） */
  stressPerYear?: number
  /** 两次晋升之间最少在职年数（默认 3） */
  promoteEvery?: number
  /**
   * 薪资系数（第 88 轮，默认 1）：体制内岗位定薪低于市场（0.85/0.9），
   * computeSalary 末尾乘上；缺省 1，既有岗位零行为变化。
   */
  salaryFactor?: number
  /**
   * 退休金加成（第 88 轮，默认 1）：体制内在编退休（retirePatch）按本系数
   * 上浮退休金（1.1 = +10%）；缺省 1，既有岗位零行为变化。
   */
  pensionBonus?: number
  desc: string
}

export const JOB_CATALOG: JobDef[] = [
  {
    id: 'stall_vendor', title: '市集摊主', titles: ['市集摊主', '摊位小老板', '市集老江湖'], minEducation: 'junior', minVocational: 20,
    baseSalary: 30000, track: 'craft', levelRaise: 1.10, maxLevel: 3, stressPerYear: 4, promoteEvery: 4,
    desc: '起早贪黑的小本生意，门槛最低，赚的都是辛苦钱',
  },
  {
    id: 'warehouse_keeper', title: '仓储管理员', titles: ['仓储管理员', '仓储班长', '仓储主管'], minEducation: 'highschool', minVocational: 25,
    baseSalary: 38000, track: 'craft', levelRaise: 1.08, maxLevel: 3, stressPerYear: 2, promoteEvery: 4,
    desc: '收发货、盘库存，稳定但上升空间有限',
  },
  {
    id: 'electrician', title: '持证电工', titles: ['持证电工', '高级电工', '电工技师', '高级技师'], minEducation: 'highschool', minVocational: 45,
    baseSalary: 52000, track: 'craft', levelRaise: 1.15, maxLevel: 4, stressPerYear: 2, promoteEvery: 3,
    desc: '手艺人的铁饭碗，活儿排队上门',
  },
  {
    id: 'office_clerk', title: '行政文员', titles: ['行政文员', '行政专员', '行政主管'], minEducation: 'college', minAcademics: 35,
    baseSalary: 44000, track: 'office', levelRaise: 1.08, maxLevel: 3, stressPerYear: 2, promoteEvery: 4,
    desc: '办公室的琐碎与安稳',
  },
  {
    id: 'nurse', title: '护士', titles: ['护士', '护师', '主管护师', '护士长'], minEducation: 'college', minVocational: 45,
    baseSalary: 56000, track: 'care', levelRaise: 1.15, maxLevel: 4, stressPerYear: 5, promoteEvery: 3,
    desc: '三班倒，但越老越吃香',
  },
  {
    id: 'junior_dev', title: '初级程序员', titles: ['初级程序员', '程序员', '资深程序员', '技术组长'], minEducation: 'bachelor', minAcademics: 55,
    baseSalary: 96000, track: 'tech', levelRaise: 1.28, maxLevel: 4, stressPerYear: 4, promoteEvery: 3,
    desc: '吃青春饭的脑力活，起薪高',
  },
  {
    id: 'teacher', title: '中学教师', titles: ['中学教师', '一级教师', '高级教师', '正高级教师'], minEducation: 'bachelor', minAcademics: 60,
    baseSalary: 62000, track: 'academic', levelRaise: 1.12, maxLevel: 4, stressPerYear: 2, promoteEvery: 3,
    desc: '有编制的体面与清闲的假期',
  },
  {
    id: 'rd_engineer', title: '研发工程师', titles: ['研发工程师', '中级工程师', '高级工程师', '资深工程师', '首席工程师'], minEducation: 'master', minAcademics: 70,
    baseSalary: 130000, track: 'tech', levelRaise: 1.22, maxLevel: 5, stressPerYear: 4, promoteEvery: 3,
    desc: '高学历高回报，压力也高',
  },
  {
    id: 'researcher', title: '大学研究员', titles: ['大学研究员', '课题骨干', '课题负责人', '学科带头人'], minEducation: 'phd', minAcademics: 80,
    baseSalary: 110000, track: 'academic', levelRaise: 1.15, maxLevel: 4, stressPerYear: 2, promoteEvery: 3,
    desc: '坐冷板凳换来的学术席位',
  },
  {
    id: 'civil_servant', title: '科员', titles: ['科员', '副主任科员', '主任科员', '副处级'],
    minEducation: 'bachelor', minAcademics: 55,
    baseSalary: 42000, track: 'office', levelRaise: 1.10, maxLevel: 4, stressPerYear: 2, promoteEvery: 5,
    salaryFactor: 0.85, pensionBonus: 1.1,
    desc: '考进机关的编制内岗位：稳定、体面、薪资低于市场，退休保障优厚',
  },
  {
    id: 'public_institution', title: '管理九级职员', titles: ['管理九级职员', '管理八级职员', '管理七级职员', '管理六级职员'],
    minEducation: 'college', minAcademics: 45,
    baseSalary: 36000, track: 'office', levelRaise: 1.10, maxLevel: 4, stressPerYear: 2, promoteEvery: 5,
    salaryFactor: 0.9, pensionBonus: 1.1,
    desc: '事业单位管理岗：安稳有保障，天花板不高，胜在细水长流',
  },
]

export function getJob(jobId: string): JobDef | undefined {
  return JOB_CATALOG.find((j) => j.id === jobId)
}

/** 指定职级的对外头衔：titles[level-1]，缺省/越界回退岗位名（第 31 轮） */
export function jobTitleAt(job: JobDef, level: number): string {
  return job.titles?.[Math.max(0, level - 1)] ?? job.title
}

/** 角色当前够得着门槛的职业 */
export function eligibleJobs(state: GameState): JobDef[] {
  return JOB_CATALOG.filter((j) => isEligibleFor(state, j))
}

/** 单个岗位的门槛校验（学历 + 学业/技能） */
export function isEligibleFor(state: GameState, job: JobDef): boolean {
  if (EDU_RANK[state.education] < EDU_RANK[job.minEducation]) return false
  if (job.minAcademics !== undefined && (state.skills?.academics ?? 0) < job.minAcademics) return false
  if (job.minVocational !== undefined && (state.skills?.vocational ?? 0) < job.minVocational) return false
  return true
}

/**
 * 入职起薪：学历每高出门槛一档 +5%（用学历溢价体现"读书的回报"）。
 * 取整到百元，保证数值可读、测试可精确断言。
 */
export function startingSalary(state: GameState, job: JobDef): number {
  const above = Math.max(0, EDU_RANK[state.education] - EDU_RANK[job.minEducation])
  return Math.round((job.baseSalary * (1 + above * 0.05)) / 100) * 100
}

// ── 收入曲线（第 22 轮）：工资公式化 ─────────────────────────
// 年薪 = 基础工资(起薪表×学历溢价) × 存量调薪倍率 × 职级系数 × 工龄系数 × 行业景气。
// 全部为线性分段/有封顶的系数：替代旧模型的"每年 ×1.02 复利"，
// 让 30 年工资曲线先升后稳（非锯齿、非指数）。

/** 行业景气带（按年龄段周期波动；数据驱动，不建日历系统） */
export interface IndustryBand {
  maxAge: number
  factor: number
  label: string
}

/** 上升期 → 黄金期 → 高原 → 回落 → 暮年：温和的 ±5% 带状波动 */
export const INDUSTRY_CYCLE: IndustryBand[] = [
  { maxAge: 30, factor: 1.0, label: '入行上升期' },
  { maxAge: 40, factor: 1.05, label: '职业黄金期' },
  { maxAge: 52, factor: 1.02, label: '景气高原' },
  { maxAge: 62, factor: 0.97, label: '景气回落' },
  { maxAge: 200, factor: 0.94, label: '暮年行情' },
]

export function industryFactor(age: number): number {
  for (const b of INDUSTRY_CYCLE) {
    if (age <= b.maxAge) return b.factor
  }
  return 1
}

/** 工龄系数分段：前 10 年每年 +3.5%，第 11~25 年每年 +0.8%，之后封顶 1.47 */
export const TENURE_STEP_EARLY = 0.035
export const TENURE_EARLY_YEARS = 10
export const TENURE_STEP_LATE = 0.008
export const TENURE_LATE_YEARS = 15

export function tenureFactor(workYears: number): number {
  const y = Math.max(0, workYears)
  const early = Math.min(y, TENURE_EARLY_YEARS)
  const late = Math.min(Math.max(y - TENURE_EARLY_YEARS, 0), TENURE_LATE_YEARS)
  return 1 + TENURE_STEP_EARLY * early + TENURE_STEP_LATE * late
}

/** 职级系数：岗位晋升倍率的逐级复利（levelRaise^(level-1)），有 maxLevel 封顶 */
export function levelFactor(job: JobDef, level: number): number {
  return Math.pow(job.levelRaise ?? 1.15, Math.max(0, level - 1))
}

/**
 * 公式化年薪（第 22 轮）：全部系数从基础工资推导，末尾一次取整到百元。
 * edu 用角色当前学历（在职提升学历后起薪溢价随之兑现），age 用结算年年龄。
 */
export function computeSalary(
  edu: GameState['education'],
  age: number,
  job: JobDef,
  level: number,
  workYears: number,
  salaryMul = 1,
  cityFactor = 1,
): number {
  const above = Math.max(0, EDU_RANK[edu] - EDU_RANK[job.minEducation])
  const base = job.baseSalary * (1 + above * 0.05) * salaryMul
  const raw = base * levelFactor(job, level) * tenureFactor(workYears) * industryFactor(age) * (job.salaryFactor ?? 1) * cityFactor
  return Math.round(raw / 100) * 100
}

/** 晋升到 nextLevel 需要的技能门槛：岗位主门槛 + 每级 +8 */
export function promotionThreshold(job: JobDef, nextLevel: number): number {
  const base = job.minAcademics ?? job.minVocational ?? 25
  return base + (nextLevel - 1) * 8
}

/** 当前在职岗位的年度压力基调 */
export function jobStressPerYear(state: GameState): number {
  if (state.career.kind !== 'employed') return 3
  return getJob(state.career.jobId)?.stressPerYear ?? 3
}
