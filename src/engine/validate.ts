import type { GameState, SkillKey } from './types'
import { ATTR_KEYS, sanitizeMoney } from './attrs'
import { RELATION_KINDS } from './relations'

export interface ValidationIssue {
  field: string
  problem: string
}

const SKILL_KEYS: SkillKey[] = ['academics', 'vocational']

/** 校验状态合法性：属性范围、数值有限、结构完整。修复可修的部分，返回问题清单 */
export function validateState(state: GameState): { issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const add = (field: string, problem: string) => issues.push({ field, problem })

  if (!state || typeof state !== 'object') {
    return { issues: [{ field: 'root', problem: '状态不是对象' }] }
  }

  if (!Number.isFinite(state.seed)) add('seed', '种子不是有限数值')
  if (!Number.isFinite(state.rngState)) add('rngState', 'RNG 状态不是有限数值')
  if (typeof state.name !== 'string' || state.name.length === 0) add('name', '姓名为空')
  if (!Number.isInteger(state.age) || state.age < 18 || state.age > 120)
    add('age', `年龄 ${state.age} 超出 18～120`)
  if (!Number.isFinite(state.money)) {
    add('money', `金钱 ${state.money} 不是有限数值`)
    state.money = sanitizeMoney(state.money)
  }

  for (const k of ATTR_KEYS) {
    const v = state.attrs?.[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      add(`attrs.${k}`, `属性 ${k} 不是有限数值`)
    } else if (v < 0 || v > 100) {
      add(`attrs.${k}`, `属性 ${k}=${v} 超出 0～100`)
    }
  }

  for (const k of SKILL_KEYS) {
    const v = state.skills?.[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      add(`skills.${k}`, `技能 ${k} 不是有限数值`)
      state.skills = { ...state.skills, [k]: 0 }
    } else if (v < 0 || v > 100) {
      add(`skills.${k}`, `技能 ${k}=${v} 超出 0～100`)
      state.skills = { ...state.skills, [k]: Math.max(0, Math.min(100, Math.round(v))) }
    }
  }

  if (!Array.isArray(state.tags)) add('tags', '标记不是数组')
  if (!Array.isArray(state.seenEvents)) add('seenEvents', '已见事件不是数组')
  if (!Array.isArray(state.history)) add('history', '履历不是数组')
  if (!Array.isArray(state.snapshots)) add('snapshots', '年度快照不是数组')
  if (!Array.isArray(state.achievements)) {
    add('achievements', '成就不是数组')
  } else if (state.achievements.some((a) => typeof a !== 'string')) {
    add('achievements', '成就列表含非字符串条目')
  }
  if (!Array.isArray(state.relations)) {
    add('relations', '关系不是数组')
  } else {
    const seenRelIds = new Set<string>()
    for (const r of state.relations) {
      if (typeof r.closeness !== 'number' || !Number.isFinite(r.closeness) || r.closeness < 0 || r.closeness > 100)
        add('relations', `关系 ${r.id} 亲密度非法`)
      if (typeof r.id !== 'string' || r.id.length === 0) add('relations', '关系缺少 id')
      else if (seenRelIds.has(r.id)) add('relations', `关系 id ${r.id} 重复`)
      else seenRelIds.add(r.id)
      if (!RELATION_KINDS.includes(r.kind)) add('relations', `关系 ${r.id} 种类 ${String(r.kind)} 非法`)
      if (typeof r.name !== 'string' || r.name.length === 0) add('relations', `关系 ${r.id} 名字为空`)
      if (typeof r.alive !== 'boolean') add('relations', `关系 ${r.id} 的 alive 不是布尔值`)
    }
  }
  if (state.phase !== 'playing' && state.phase !== 'ended' && state.phase !== 'creation')
    add('phase', `阶段 ${String(state.phase)} 非法`)

  // 第 22 轮可选字段守卫：非法值会污染年薪/退休金推导，重置为安全默认
  if (state.workYears !== undefined && (!Number.isFinite(state.workYears) || state.workYears < 0)) {
    add('workYears', `累计工龄 ${String(state.workYears)} 非法，已重置为 0`)
    state.workYears = 0
  }
  if (state.career?.kind === 'employed') {
    const sm = state.career.salaryMul
    if (sm !== undefined && (!Number.isFinite(sm) || sm <= 0)) {
      add('career.salaryMul', `调薪倍率 ${String(sm)} 非法，已重置为 1`)
      state.career.salaryMul = 1
    }
  }

  // 第 24 轮可选字段守卫：风险值非法（NaN/负数/越界）会污染分级事件资格判定，重置为 0
  if (
    state.healthRisk !== undefined &&
    (!Number.isFinite(state.healthRisk) || state.healthRisk < 0 || state.healthRisk > 100)
  ) {
    add('healthRisk', `生活方式风险值 ${String(state.healthRisk)} 非法，已重置为 0`)
    state.healthRisk = 0
  }

  // 第 23 轮可选字段守卫：房贷是不变式数据（存在即 balance > 0 且 ≤ 本金），
  // 半截数据没有安全解释，整体清除（视为无贷款）而不是带病运行。
  if (state.mortgage !== undefined) {
    const m = state.mortgage as unknown as Record<string, unknown> | null
    const p = m?.principal
    const b = m?.balance
    const a = m?.annualPayment
    const y = m?.yearsLeft
    const bad =
      typeof m !== 'object' ||
      m === null ||
      typeof p !== 'number' ||
      !Number.isFinite(p) ||
      p <= 0 ||
      typeof b !== 'number' ||
      !Number.isFinite(b) ||
      b <= 0 ||
      b > p ||
      typeof a !== 'number' ||
      !Number.isFinite(a) ||
      a <= 0 ||
      typeof y !== 'number' ||
      !Number.isInteger(y) ||
      y < 1
    if (bad) {
      add('mortgage', '房贷数据损坏，已清除（视为无贷款）')
      state.mortgage = undefined
    }
  }

  // 第 85 轮可选字段守卫：保单是理赔给付的不变式数据（三项全为正数才算在册），
  // 半截数据没有安全解释，整体清除（视为无保单）而不是带病运行。
  if (state.insurance !== undefined) {
    const ins = state.insurance as unknown as Record<string, unknown> | null
    const ap = ins?.annualPremium
    const bf = ins?.benefit
    const pa = ins?.purchasedAtAge
    const bad =
      typeof ins !== 'object' ||
      ins === null ||
      typeof ap !== 'number' ||
      !Number.isFinite(ap) ||
      ap <= 0 ||
      typeof bf !== 'number' ||
      !Number.isFinite(bf) ||
      bf <= 0 ||
      typeof pa !== 'number' ||
      !Number.isFinite(pa) ||
      pa < 0
    if (bad) {
      add('insurance', '保单数据损坏，已清除（视为无保单）')
      state.insurance = undefined
    }
  }

  // 第 86 轮可选字段守卫：房册是复利与变卖的不变式数据（总价/现值为正、盖章年龄非负），
  // 半截数据没有安全解释，整体清除（视为无房）而不是带病运行。
  if (state.home !== undefined) {
    const h = state.home as unknown as Record<string, unknown> | null
    const b = h?.basis
    const v = h?.value
    const pa = h?.purchasedAtAge
    const bad =
      typeof h !== 'object' ||
      h === null ||
      typeof b !== 'number' ||
      !Number.isFinite(b) ||
      b <= 0 ||
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      v <= 0 ||
      typeof pa !== 'number' ||
      !Number.isFinite(pa) ||
      pa < 0
    if (bad) {
      add('home', '房册数据损坏，已清除（视为无房）')
      state.home = undefined
    }
  }

  // 第 87 轮可选字段守卫：基金持仓是市值结算的不变式数据（档位为正、市值非负），
  // 半截数据没有安全解释，整体清除（视为未开户）而不是带病运行。
  if (state.fund !== undefined) {
    const f = state.fund as unknown as Record<string, unknown> | null
    const ac = f?.annualContribution
    const u = f?.units
    const bad =
      typeof f !== 'object' ||
      f === null ||
      typeof ac !== 'number' ||
      !Number.isFinite(ac) ||
      ac <= 0 ||
      typeof u !== 'number' ||
      !Number.isFinite(u) ||
      u < 0
    if (bad) {
      add('fund', '基金持仓数据损坏，已清除（视为未开户）')
      state.fund = undefined
    }
  }

  // 第 90 轮可选字段守卫：城市层级为枚举值（损坏/未知值重置为缺省老家）
  if (state.city !== undefined && !['hometown', 'province', 'metro'].includes(state.city)) {
    add('city', `城市层级 ${String(state.city)} 非法，已重置为老家`)
    state.city = undefined
  }

  // 第 26 轮可选字段守卫：孩子出生年龄与里程碑是"每孩至多一次"的资格数据。
  // 损坏时删除字段、退回"出生年龄未知"的兼容语义（开支按旧口径 10,000、
  // 里程碑事件不触发），不带病推算孩子年龄。
  if (Array.isArray(state.relations)) {
    for (const r of state.relations) {
      // 第 64 轮：手足 birthAge = 玩家出生年 ±4（兄姐为负=玩家出生前 Δ 年），
      // 走独立合法域；第 69 轮：宠物 birthAge = 入家时玩家年龄（宠物年龄 ≤20）；
      // 孩子/孙辈维持「玩家 18 岁后出生」口径不变。
      const siblingBA =
        r.kind === 'sibling' &&
        typeof r.birthAge === 'number' &&
        Number.isInteger(r.birthAge) &&
        r.birthAge >= -4 &&
        r.birthAge <= 4
      const petBA =
        r.kind === 'pet' &&
        typeof r.birthAge === 'number' &&
        Number.isInteger(r.birthAge) &&
        r.birthAge >= state.age - 20 &&
        r.birthAge <= state.age
      if (
        r.birthAge !== undefined &&
        !siblingBA &&
        !petBA &&
        (!Number.isInteger(r.birthAge) || r.birthAge < 18 || r.birthAge > state.age)
      ) {
        add(`relations.${r.id}.birthAge`, `孩子出生年龄 ${String(r.birthAge)} 非法，已忽略（按未知年龄处理）`)
        delete r.birthAge
      }
      if (r.milestones !== undefined) {
        const badMs =
          !Array.isArray(r.milestones) ||
          r.milestones.some((m) => typeof m !== 'string' || m.length === 0)
        if (badMs) {
          add(`relations.${r.id}.milestones`, '孩子里程碑数据损坏，已清除')
          delete r.milestones
        } else {
          const deduped = [...new Set(r.milestones)]
          if (deduped.length !== r.milestones.length) {
            add(`relations.${r.id}.milestones`, '孩子里程碑含重复条目，已去重')
            r.milestones = deduped
          }
        }
      }
      // 第 41 轮可选字段守卫：去世数据损坏时清理——deceased 非布尔则整组删除
      // （回"从未走过去世结算"语义），deathAge 非有限数单独清除。
      if (r.deceased !== undefined && typeof r.deceased !== 'boolean') {
        add(`relations.${r.id}.deceased`, '去世标记非法，已清除')
        delete r.deceased
        delete r.deathAge
      }
      if (r.deathAge !== undefined && !Number.isFinite(r.deathAge)) {
        add(`relations.${r.id}.deathAge`, '去世年龄非法，已清除')
        delete r.deathAge
      }
      // 第 66 轮可选字段守卫：挚友标记非布尔则删除（回普通朋友语义）
      if (r.bestFriend !== undefined && typeof r.bestFriend !== 'boolean') {
        add(`relations.${r.id}.bestFriend`, '挚友标记非法，已清除')
        delete r.bestFriend
      }
    }
  }

  return { issues }
}
