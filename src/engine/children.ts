// 第 26 轮：子女生命阶段。孩子按真实年龄长大——出生年龄记在 Relation.birthAge
//（"孩子出生"延迟效果落地当年由引擎盖章），走过的里程碑记在 Relation.milestones。
// 本模块是孩子年龄、阶段资格与里程碑标记的唯一权威出口：条件判定（events.ts
// checkCondition）与效果落地（applyChoice）解析同一个孩子，全部纯函数、不消耗 RNG。
import type { ChildStageCondition, Relation, RelationKind } from './types'

/**
 * 里程碑标记（写入 Relation.milestones；事件数据以字符串字面量引用，
 * validateEvents 锁定效果与条件的 milestonePending 一致）。
 * 升学 12 / 15 / 18，就业 22，婚嫁 26，孙辈 26（须先成家；第 62 轮自 29 放宽）。
 */
export const CHILD_MILESTONES = {
  junior: 'ms_junior',         // 小升初
  senior: 'ms_senior',         // 中考
  adult: 'ms_adult',           // 成年（高考志愿 / 独立择路）
  job: 'ms_job',               // 第一份工作
  wedding: 'ms_wedding',       // 婚嫁
  grandchild: 'ms_grandchild', // 孙辈
} as const

/**
 * 孩子当前年龄（周岁）。仅存活的孩子有年龄；出生年龄未知（旧档/手改档）返回
 * null——里程碑事件对其不触发，养育开支按旧口径 10,000 计（向后兼容语义）。
 */
export function childAge(r: Relation, playerAge: number, kind: RelationKind = 'child'): number | null {
  if (r.kind !== kind || !r.alive) return null
  if (typeof r.birthAge !== 'number' || !Number.isInteger(r.birthAge)) return null
  const age = playerAge - r.birthAge
  return age >= 0 ? age : null
}

function hasMilestone(r: Relation, m: string | undefined): boolean {
  if (m === undefined) return false
  return Array.isArray(r.milestones) && r.milestones.includes(m)
}

/**
 * 找到阶段条件命中的孩子：第一条满足年龄窗、未完成 milestonePending 且已完成
 * milestoneDone 的存活孩子。孩子按出生次序追加进关系表，"第一条"即最年长的
 * 待办孩子——多孩同年达标时先办大的，来年条件仍在就轮到小的。
 * cond.kind（第 44 轮，缺省 'child'）：'grandchild' 时解析孙辈（birthAge/milestones 同套语义）。
 */
export function pickChildByStage(
  relations: Relation[],
  playerAge: number,
  cond: ChildStageCondition,
): Relation | null {
  const kind = cond.kind ?? 'child'
  return (
    relations.find((r) => {
      const age = childAge(r, playerAge, kind)
      if (age === null) return false
      if (age < cond.atLeast) return false
      if (cond.below !== undefined && age >= cond.below) return false
      if (cond.milestonePending !== undefined && hasMilestone(r, cond.milestonePending)) return false
      if (cond.milestoneDone !== undefined && !hasMilestone(r, cond.milestoneDone)) return false
      return true
    }) ?? null
  )
}

/** 给指定孩子记里程碑标记（纯函数；已有标记不重复写入，其余孩子不受影响） */
export function markChildMilestone(
  relations: Relation[],
  childId: string,
  milestone: string,
): Relation[] {
  return relations.map((r) => {
    if (r.id !== childId) return r
    if (Array.isArray(r.milestones) && r.milestones.includes(milestone)) return r
    return { ...r, milestones: [...(r.milestones ?? []), milestone] }
  })
}
