// 第 88 轮（V5）：体制内线——考公录取判定（seed 派生独立支流，确定性可重放）。
// 录取 = 支流散列 roll < 基础概率 且 academics 达标（双条件）；同 seed 同 age 同结果；
// 换年重考（cooldown 2）概率重 roll——「再战」语义成立。绝不消耗主 rng。
import type { GameState } from './types'

/** 独立支流种子盐（合法十六进制；任务书草稿 0xc1v1l 含非 hex 字符已改） */
const CIVIL_SALT = 0x6a72c1c1

/** 基础录取概率（笔试面试通过率）：45%——考试资格放宽到功底达标者后收敛上岸率进 5–15% 带 */
export const CIVIL_EXAM_PASS_RATE = 0.45

/** 学业功底门槛：与事业编岗位 minAcademics 同口径（45——公务员岗 55 由 employPatch 兜底） */
export const CIVIL_EXAM_ACADEMICS = 45

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 录取判定：同 seed/age/academics 恒同果；academics 不达标恒落榜（双条件） */
export function civilExamAdmitted(seed: number, age: number, academics: number): boolean {
  if (academics < CIVIL_EXAM_ACADEMICS) return false
  const rng = mulberry32(((seed ^ CIVIL_SALT) >>> 0) + age * 7919)
  return rng() < CIVIL_EXAM_PASS_RATE
}

/** 体制内在编判定（tag 口径：上岸事件授予） */
export function isCivilServant(state: Pick<GameState, 'tags'>): boolean {
  return state.tags.includes('civil_servant')
}

/**
 * 按学历定录取去向：bachelor+ → 公务员（本科起步）；college → 事业编（专科可考）。
 * 返回岗位 id 供 employPatch（学历/功底门槛由引擎二次校验，不足则入职 no-op）。
 */
export function civilTargetJob(education: GameState['education']): string {
  const rank = { junior: 0, highschool: 1, college: 2, bachelor: 3, master: 4, phd: 5 }
  return rank[education] >= rank.bachelor ? 'civil_servant' : 'public_institution'
}
