// 第 8 轮：教育与技能系统
// 路径：复读/高中 → 高考（引擎结算）→ 大专/本科 →（成年后）考研/自考/培训。
// 全部为纯函数，可脱离 UI 测试；RNG 消费只在高考放榜一刻，保证同 seed 可复现。
import type {
  EducationLevel,
  GameState,
  HistoryEntry,
  SkillKey,
  StudentStage,
} from './types'
import { rngFromState } from './rng'

export const SKILL_KEYS: SkillKey[] = ['academics', 'vocational']

export const SKILL_LABELS: Record<SkillKey, string> = {
  academics: '学业',
  vocational: '技能',
}

/** 创建角色的技能基准值（背景/特质在其上叠加） */
export const BASE_SKILLS: Record<SkillKey, number> = { academics: 25, vocational: 15 }

export function clampSkill(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

export function normalizeSkills(skills: Partial<Record<SkillKey, number>> | undefined): Record<SkillKey, number> {
  const out = {} as Record<SkillKey, number>
  for (const k of SKILL_KEYS) out[k] = clampSkill(skills?.[k] ?? 0)
  return out
}

/** 学历等级：只升不降的排序依据 */
export const EDU_RANK: Record<EducationLevel, number> = {
  junior: 0,
  highschool: 1,
  college: 2,
  bachelor: 3,
  master: 4,
  phd: 5,
}

export const EDU_LABELS: Record<EducationLevel, string> = {
  junior: '初中',
  highschool: '高中',
  college: '大专',
  bachelor: '本科',
  master: '硕士',
  phd: '博士',
}

export interface StageInfo {
  label: string
  /** 标准学制（年） */
  years: number
  /** 毕业获得的学历；null 表示该阶段毕业走特殊结算（如高考） */
  graduateTo: EducationLevel | null
  /** 毕业标记 */
  graduateTag: string
  /** 每年技能成长 */
  perYear: Partial<Record<SkillKey, number>>
  /** 毕业时的履历标题 */
  title: string
}

export const STAGE_INFO: Record<StudentStage, StageInfo> = {
  highschool: {
    label: '高三（复读）',
    years: 1,
    graduateTo: null, // 毕业即高考，成绩由 gaokaoOutcome 结算
    graduateTag: 'gaokao_done',
    perYear: { academics: 6 },
    title: '高考',
  },
  college: {
    label: '大专在读',
    years: 3,
    graduateTo: 'college',
    graduateTag: 'graduated_college',
    perYear: { academics: 3, vocational: 4 },
    title: '大专毕业',
  },
  bachelor: {
    label: '本科在读',
    years: 4,
    graduateTo: 'bachelor',
    graduateTag: 'graduated_bachelor',
    perYear: { academics: 4, vocational: 3 },
    title: '本科毕业',
  },
  master: {
    label: '硕士在读',
    years: 2,
    graduateTo: 'master',
    graduateTag: 'graduated_master',
    perYear: { academics: 4 },
    title: '硕士毕业',
  },
  phd: {
    label: '博士在读',
    years: 4,
    graduateTo: 'phd',
    graduateTag: 'graduated_phd',
    perYear: { academics: 3 },
    title: '博士毕业',
  },
}

/** 学历入学门槛：想进入该阶段，现有学历必须达到（考研要本科、申博要硕士） */
export const STAGE_PREREQUISITE: Record<StudentStage, EducationLevel> = {
  highschool: 'junior',
  college: 'highschool',
  bachelor: 'highschool',
  master: 'bachelor',
  phd: 'master',
}

// ── 高考结算 ──────────────────────────────────────────────

export type GaokaoResult = 'elite' | 'bachelor' | 'college' | 'fail'

/** 高考录取分数线（综合 能力 60% + 学业技能 40% ± 考场波动） */
export const GAOKAO_BANDS: Array<{ min: number; result: GaokaoResult }> = [
  { min: 85, result: 'elite' },
  { min: 58, result: 'bachelor' },
  { min: 40, result: 'college' },
  { min: 0, result: 'fail' },
]

export function gaokaoScore(smarts: number, academics: number, roll: number): number {
  const clampedRoll = Math.max(0, Math.min(1, roll))
  const raw = smarts * 0.6 + academics * 0.4 + (clampedRoll * 2 - 1) * 12
  return Math.round(raw)
}

export function gaokaoOutcome(score: number): GaokaoResult {
  for (const band of GAOKAO_BANDS) {
    if (score >= band.min) return band.result
  }
  return 'fail'
}

export const GAOKAO_RESULT_TEXT: Record<GaokaoResult, string> = {
  elite: '分数高得超出全家预期，重点大学的录取线都够到了',
  bachelor: '过本科线了，一所普通大学的录取通知书在路上',
  college: '分数刚过大专线，有学上',
  fail: '差了几分，这一年落榜了',
}

// ── 入学 / 毕业 / 退学 ─────────────────────────────────────

export interface EnterResult {
  ok: boolean
  reason?: string
  state: GameState
}

/** 入学：把角色置为在读学生。前置学历不足、已在读、或毕业学历不高于现有学历（无意义重读）时失败 */
export function enterEducation(state: GameState, stage: StudentStage, years?: number): EnterResult {
  if (state.career.kind === 'student') {
    return { ok: false, reason: '已经在读书了', state }
  }
  const info = STAGE_INFO[stage]
  const need = STAGE_PREREQUISITE[stage]
  if (EDU_RANK[state.education] < EDU_RANK[need]) {
    return { ok: false, reason: `学历不足：读${info.label}需要${EDU_LABELS[need]}及以上`, state }
  }
  // 毕业学历不高于现有学历的重读没有意义（高三复读除外：其毕业结算走高考）
  if (info.graduateTo && EDU_RANK[info.graduateTo] <= EDU_RANK[state.education]) {
    return { ok: false, reason: `已有${EDU_LABELS[state.education]}学历，无需再读${info.label}`, state }
  }
  const y = Math.max(1, Math.round(years ?? info.years))
  return {
    ok: true,
    state: {
      ...state,
      career: { kind: 'student', stage, yearsLeft: y },
      tags: [...new Set([...state.tags, 'in_school'])],
    },
  }
}

/** 退学/休学：离开学生身份并留下标记 */
export function leaveEducation(state: GameState): GameState {
  if (state.career.kind !== 'student') return state
  return {
    ...state,
    career: { kind: 'none' },
    tags: [...new Set([...state.tags, 'quit_school'])],
  }
}

/** 学历只升不降：毕业/自考等所有教育结算统一走这里 */
export function upgradeEducation(current: EducationLevel, target: EducationLevel): EducationLevel {
  return EDU_RANK[target] > EDU_RANK[current] ? target : current
}

export interface GraduatePatch {
  career: GameState['career']
  education: EducationLevel
  skills: Record<SkillKey, number>
  tags: string[]
  historyEntry: HistoryEntry
  notes: string[]
  /** 高考放榜额外产生的录取标记 */
  admitTags: string[]
}

/**
 * 学生毕业结算：yearsLeft 已在调用方减到 0 时调用。
 * highschool 阶段走高考（消耗一次 RNG）；其余阶段按 STAGE_INFO 升学历。
 * skills 传入当前累计值（含最后一年成长）；缺省用 state.skills。
 */
export function graduateStudent(
  state: GameState,
  roll: number,
  skills: Record<SkillKey, number> = state.skills,
): GraduatePatch {
  const stage = state.career.kind === 'student' ? state.career.stage : null
  if (!stage) throw new Error('graduateStudent 只能在学生状态下调用')
  const info = STAGE_INFO[stage]
  const tags = [...state.tags]
  const notes: string[] = []

  if (stage === 'highschool') {
    // 高考放榜：录取结果只写标记与记录，入学（升学历）由「录取通知书」事件的报到选项完成
    const score = gaokaoScore(state.attrs.smarts, skills.academics, roll)
    const result = gaokaoOutcome(score)
    const admitTags =
      result === 'elite'
        ? ['admitted_bachelor', 'elite_school']
        : result === 'bachelor'
          ? ['admitted_bachelor']
          : result === 'college'
            ? ['admitted_college']
            : ['gaokao_failed']
    tags.push(...admitTags, info.graduateTag)
    notes.push(`高考放榜：${GAOKAO_RESULT_TEXT[result]}`)
    return {
      career: { kind: 'none' },
      education: state.education,
      skills: { ...state.skills },
      tags: [...new Set(tags)],
      admitTags,
      historyEntry: {
        age: state.age + 1,
        eventId: 'settle',
        title: '高考放榜',
        choice: '',
        summary: GAOKAO_RESULT_TEXT[result],
      },
      notes,
    }
  }

  // 普通毕业：升学历、发标记
  const education = upgradeEducation(state.education, info.graduateTo ?? state.education)
  tags.push(info.graduateTag)
  if (info.graduateTo && education === info.graduateTo) {
    notes.push(`你从${info.label.replace('在读', '')}毕业了，学历变成了${EDU_LABELS[education]}`)
  }
  return {
    career: { kind: 'none' },
    education,
    skills: { ...state.skills },
    tags: [...new Set(tags)],
    admitTags: [],
    historyEntry: {
      age: state.age + 1,
      eventId: 'settle',
      title: info.title,
      choice: '',
      summary:
        info.graduateTo && education === info.graduateTo
          ? `顺利毕业，拿到${EDU_LABELS[education]}文凭`
          : '学业告一段落',
    },
    notes,
  }
}

/** 供 UI/事件条件展示的在读描述 */
export function studentLabel(stage: StudentStage, yearsLeft: number): string {
  return `${STAGE_INFO[stage].label}·还剩 ${yearsLeft} 年`
}

/** 重放工具：从 rngState 取下一次随机数（不改状态），仅供测试与展示 */
export function peekRoll(state: GameState): number {
  return rngFromState(state.rngState).next()
}
