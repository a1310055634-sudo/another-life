// 第 11 轮：关系系统（友情/伴侣/家庭的多实例管理与破裂-重建状态机）。
// 全部纯函数，不消耗 RNG；同一存档在同样选择下结果一致。
import type { GameState, Relation, RelationEffect, RelationKind } from './types'
import {
  CHILD_NICKNAMES,
  GRANDCHILD_NICKNAMES,
  COMPANION_NAMES,
  SIBLING_NAMES,
  FRIEND_NICKNAMES,
  COLLEAGUE_NICKNAMES,
  NEIGHBOR_NICKNAMES,
  pickName,
} from '../data/names'

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  parent: '家人',
  friend: '朋友',
  partner: '恋人',
  spouse: '伴侣',
  child: '孩子',
  pet: '宠物',
  grandchild: '孙辈',
  sibling: '手足',
  colleague: '同事',
  neighbor: '邻居',
}

export const RELATION_KINDS: RelationKind[] = [
  'parent', 'friend', 'partner', 'spouse', 'child', 'pet', 'grandchild', 'sibling',
  'colleague', 'neighbor',
]

/** 第 44 轮：名字缺省时的取名池（其余种类维持泛称兜底）；第 64 轮 +sibling、第 66 轮 +friend、第 115 轮 +colleague/neighbor */
function namePoolFor(kind: RelationKind): string[] | null {
  if (kind === 'child') return CHILD_NICKNAMES
  if (kind === 'grandchild') return GRANDCHILD_NICKNAMES
  if (kind === 'partner') return COMPANION_NAMES
  if (kind === 'sibling') return SIBLING_NAMES
  if (kind === 'friend') return FRIEND_NICKNAMES
  if (kind === 'colleague') return COLLEAGUE_NICKNAMES
  if (kind === 'neighbor') return NEIGHBOR_NICKNAMES
  return null
}

function clampCloseness(v: number): number {
  if (!Number.isFinite(v)) return 50
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** 第一条存活的同类关系（没有则 null） */
export function aliveOf(relations: Relation[], kind: RelationKind): Relation | null {
  return relations.find((r) => r.kind === kind && r.alive) ?? null
}

/** 存活同类关系数量（多实例：朋友可以有多个） */
export function aliveCount(relations: Relation[], kind: RelationKind): number {
  return relations.filter((r) => r.kind === kind && r.alive).length
}

/**
 * 应用一条关系效果（纯函数）。salt 用年龄等确定值生成新关系 ID，保证同 seed 可复现。
 * 见 RelationEffect 注释：add / remove / deltaCloseness / convertFrom / revive。
 * playerAge（第 26 轮）：孩子出生（add）时盖章 Relation.birthAge，供子女生命阶段
 * 推算孩子年龄；缺省不盖章（未知年龄走向后兼容语义）。第 44 轮起孙辈出生同款盖章。
 * seed（第 44 轮，可选）：name 缺省时从取名池 seed 确定具名（data/names.ts）；
 * 缺省 0——同 salt 同序数仍得同名，跨局分散性略降但不破坏复现性。
 */
export function applyRelationEffect(
  relations: Relation[],
  effect: RelationEffect,
  salt = 0,
  playerAge?: number,
  seed = 0,
): Relation[] {
  let next = [...relations]
  const idx = next.findIndex((r) => r.kind === effect.kind && r.alive)

  if (effect.revive) {
    // 重新建立：复活第一条已疏远的同类关系（保留原 id 与名字；没疏远过则无效）
    const deadIdx = next.findIndex((r) => r.kind === effect.kind && !r.alive && r.estranged)
    if (deadIdx !== -1) {
      const r = next[deadIdx]
      next[deadIdx] = { ...r, alive: true, estranged: false, closeness: clampCloseness(effect.closeness ?? 30) }
    }
    return next
  }
  if (effect.convertFrom !== undefined) {
    // 关系转变（恋爱→结婚）：保留 id 与名字，仅换 kind
    const fromIdx = next.findIndex((r) => r.kind === effect.convertFrom && r.alive)
    if (fromIdx !== -1) {
      const r = next[fromIdx]
      next[fromIdx] = { ...r, kind: effect.kind }
    }
    return next
  }
  // add：没有存活同类关系时新增（V1 语义）；addAnother（第 28 轮二胎）无视已有同类关系追加
  if (effect.add && (idx === -1 || effect.addAnother)) {
    const pool = namePoolFor(effect.kind)
    next.push({
      id: `${effect.kind}_${salt}_${next.length}`,
      kind: effect.kind,
      // 名字三级来源：事件数据静态具名 > 取名池 seed 确定具名 > 种类泛称
      name: effect.name ?? (pool ? pickName(pool, seed, salt, next.length) : defaultRelationName(effect.kind)),
      closeness: clampCloseness(effect.closeness ?? 50),
      alive: true,
      // 孩子/孙辈出生即记下当时玩家的年龄（第 26/44 轮）；宠物入家门也盖章
      // （第 69 轮：宠物年龄=玩家年龄−birthAge，供衰老/离世判定）；其余种类无年龄语义
      ...(effect.kind === 'child' || effect.kind === 'grandchild' || effect.kind === 'pet'
        ? typeof playerAge === 'number'
          ? { birthAge: playerAge }
          : {}
        : {}),
    })
    return next
  }
  if (effect.remove && idx !== -1) {
    // 分手/永别：直接移除（区别于疏远：不可 revive，履历里已留痕）
    next = next.filter((_, i) => i !== idx)
    return next
  }
  if (idx !== -1 && typeof effect.deltaCloseness === 'number') {
    const r = next[idx]
    next[idx] = { ...r, closeness: clampCloseness(r.closeness + effect.deltaCloseness) }
  }
  return next
}

function defaultRelationName(kind: RelationKind): string {
  return RELATION_KIND_LABELS[kind] ?? '某人'
}

export interface EstrangementResult {
  relations: Relation[]
  /** 本轮新疏远的关系（供年志/履历/标记使用） */
  broke: Array<{ kind: RelationKind; name: string }>
}

/**
 * 关系破裂兜底（第 11 轮）：亲密度跌到 0 的存活关系自动疏远。
 * fin_debt_calls「找家里周转」这类反复消耗亲情的选择最终会走到这里，
 * 疏远后相关关系选项因 relationKinds/minCloseness 检查存活而自动隐藏。
 */
export function settleEstrangement(relations: Relation[]): EstrangementResult {
  const broke: EstrangementResult['broke'] = []
  const next = relations.map((r) => {
    if (r.alive && r.closeness <= 0) {
      broke.push({ kind: r.kind, name: r.name })
      return { ...r, alive: false, estranged: true }
    }
    return r
  })
  return { relations: next, broke }
}

/** 疏远后写入状态的关系标记（供"重新建立"类事件做条件） */
export function estrangementTag(kind: RelationKind): string {
  return `estranged_${kind}`
}

// ── 关系动态（第 25 轮）：亲密度年度自然衰减 ─────────────────
// 关系需要经营：不维护的关系逐年变淡，衰减速率按种类分档——
// 朋友衰减快（不进则退），配偶/恋人/父母/孩子慢（稳定关系不是零维护），宠物天天在家不衰减。
// 恋人与配偶同档 -1 是模拟校准的结果：相亲对象 45 起、求婚门槛 65，-2/年会把
// 婚姻弧线对非最优玩法整体封死（18 局轮换策略模拟 18/18 无婚姻，见第 25 轮记录）。
// 衰减只把亲密度推向 0，破裂本身仍交给既有的疏远兜底（settleEstrangement），
// 不另建第二套破裂机制；estranged 与已移除的关系不再衰减（不重复伤害）。
export const RELATION_DECAY_RATE: Record<RelationKind, number> = {
  parent: 1,
  friend: 2,
  partner: 1,
  spouse: 1,
  child: 1,
  pet: 0,
  grandchild: 0, // 孙辈不含饴弄孙不衰减（第 44 轮；亲密度由含饴弄孙小事件维护）
  sibling: 1, // 手足按稳定关系口径（第 64 轮）：血亲不进则退的密度低于朋友
  colleague: 2, // 同事按朋友口径（第 115 轮）：离开工位就淡，维护事件是唯一粘合剂
  neighbor: 1, // 邻居按稳定关系口径（第 115 轮）：抬头不见低头见，淡得慢
}

/** 黄灯线：亲密度跌破此值当年年志提示一次（跨越式提示，与 lifestyle.riskBandWarning 同模式） */
export const RELATION_YELLOW_LINE = 20

export interface RelationDecayResult {
  relations: Relation[]
  /** 本年度跌破黄灯线的关系（供年志提示） */
  warnings: Array<{ kind: RelationKind; name: string }>
}

/**
 * 对存活关系按种类扣减亲密度（纯函数、确定性、不消耗 RNG）。
 * 数值全部取整：衰减与亲密度同粒度，无舍入漂移；clamp 到 0，归零后由疏远兜底接手。
 */
export function settleRelationDecay(relations: Relation[]): RelationDecayResult {
  const warnings: RelationDecayResult['warnings'] = []
  const next = relations.map((r) => {
    if (!r.alive) return r
    let rate = RELATION_DECAY_RATE[r.kind] ?? 0
    // 第 66 轮挚友双档：维护到位的挚友衰减 −1（稳定关系口径），普通朋友维持 −2
    if (r.kind === 'friend' && r.bestFriend) rate = Math.min(rate, 1)
    if (rate <= 0) return r
    const prev = r.closeness
    const now = clampCloseness(prev - rate)
    if (now === prev) return r
    if (prev >= RELATION_YELLOW_LINE && now < RELATION_YELLOW_LINE) {
      warnings.push({ kind: r.kind, name: r.name })
    }
    return { ...r, closeness: now }
  })
  return { relations: next, warnings }
}

export interface BestFriendMarkResult {
  relations: Relation[]
  /** 本年度新盖挚友标记的名字（供年志） */
  promoted: string[]
  /** 本年度摘除挚友标记的名字（供年志） */
  demoted: string[]
}/**
 * 挚友标记年度升降（第 66 轮，纯函数不消耗 RNG）：存活 friend 亲密度 ≥60 盖
 * bestFriend 标记、<40 摘除——「处得好的才是挚友」。与衰减同批结算（衰减先跑、
 * 标记后评，用衰减后的亲密度判定），阈值 60/40 为唯一口径（勿在调用方另立）。
 */
export function settleBestFriendMarks(relations: Relation[]): BestFriendMarkResult {
  const promoted: string[] = []
  const demoted: string[] = []
  const next = relations.map((r) => {
    if (r.kind !== 'friend' || !r.alive) return r
    if (!r.bestFriend && r.closeness >= 60) {
      promoted.push(r.name)
      return { ...r, bestFriend: true }
    }
    if (r.bestFriend && r.closeness < 40) {
      demoted.push(r.name)
      return { ...r, bestFriend: false }
    }
    return r
  })
  return { relations: next, promoted, demoted }
}

export interface MarriageStrainResult {
  relations: Relation[]
  /** 本年度危机 strain 是否生效（供年志） */
  strained: boolean
}

/**
 * 婚姻危机年度 strain（第 67 轮，纯函数不消耗 RNG）：marriage_crisis 标记在场时，
 * 第一条存活 spouse 在常规衰减（−1）之外额外 −2（合计 −3/年）——置之不理的裂缝
 * 会加速扩大，直至既有疏远兜底接手（不自动离婚）。修复类事件摘除标记即停止 strain。
 */
export function settleMarriageStrain(relations: Relation[], tags: string[]): MarriageStrainResult {
  if (!tags.includes('marriage_crisis')) {
    return { relations, strained: false }
  }
  const idx = relations.findIndex((r) => r.kind === 'spouse' && r.alive)
  if (idx === -1) {
    return { relations, strained: false }
  }
  const r = relations[idx]
  const next = [...relations]
  next[idx] = { ...r, closeness: clampCloseness(r.closeness - 2) }
  return { relations: next, strained: true }
}

/**
 * 对指定 id 的存活关系调整亲密度（第 26 轮）：子女里程碑事件的
 * milestoneTarget 关系效果用——里程碑办在谁身上，亲密度就落在谁身上，
 * 多孩家庭不再默认打在第一条存活同类关系（最年长者）上。
 */
export function deltaClosenessById(relations: Relation[], id: string, delta: number): Relation[] {
  return relations.map((r) =>
    r.id === id && r.alive ? { ...r, closeness: clampCloseness(r.closeness + delta) } : r,
  )
}

/** 顶栏关系摘要：母亲 60 · 父亲 55 · 恋人 小赵 72（只列存活关系；名字缺失降级泛称不露 undefined） */
export function relationsLine(state: GameState): string {
  const parts = state.relations
    .filter((r) => r.alive)
    .slice(0, 5)
    .map((r) => `${r.name ?? RELATION_KIND_LABELS[r.kind]} ${r.closeness}`)
  return parts.length > 0 ? parts.join(' · ') : '暂无亲近的人'
}

/**
 * 选择前后的关系差异 → 结果面板的增量文案（第 11 轮：关系变化可见）。
 * 按 id 精确匹配，支持多实例（同名关系多条互不干扰）。
 * 名字缺失（旧档/手改档）降级种类泛称，不露 undefined（第 44 轮）。
 */
export function relationDeltaChips(before: Relation[], after: Relation[]): string[] {
  const relName = (r: Relation) => r.name ?? RELATION_KIND_LABELS[r.kind]
  const chips: string[] = []
  const beforeById = new Map(before.map((r) => [r.id, r]))
  for (const r of after) {
    const prev = beforeById.get(r.id)
    if (!prev) {
      if (r.alive) chips.push(`新增${RELATION_KIND_LABELS[r.kind]}：${relName(r)}`)
      continue
    }
    if (prev.kind !== r.kind) {
      chips.push(r.kind === 'spouse' ? `和${relName(r)}结婚了` : `和${relName(r)}的关系发生了变化`)
      continue
    }
    if (!prev.alive && r.alive) chips.push(`和${relName(r)}重新建立了联系`)
    else if (prev.alive && r.alive && prev.closeness !== r.closeness) {
      const d = r.closeness - prev.closeness
      chips.push(`${relName(r)} 亲密 ${d > 0 ? '+' : ''}${d}`)
    }
  }
  const afterById = new Map(after.map((r) => [r.id, r]))
  for (const r of before) {
    if (!r.alive) continue
    const now = afterById.get(r.id)
    if (!now) chips.push(`${relName(r)}走出了你的生活`)
    else if (!now.alive && now.estranged) chips.push(`和${relName(now)}疏远了`)
  }
  return chips
}
