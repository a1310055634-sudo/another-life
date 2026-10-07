// 第 41 轮：父母去世——去世语义与年度判定。
// 人生 77 年里父母只会衰老不会离世，是 V2 结账时记录在案的最大失真点
// （第 25/29 轮两次评估均因涉及关系生死语义让位，V3 第 41 轮落地）。
// 设计口径（写死，勿在调用方另立标准）：
// - 父母没有生日字段，年龄沿用项目既有近似「父母年龄 ≈ 玩家年龄 + PARENT_AGE_OFFSET」
//   （rel_parent_frail 的「32 岁起≈父母 60+」即此口径），不伪造精确生日。
// - 判定使用独立 RNG 流（seed + 玩家年龄 + 关系 id 派生，mulberry32），
//   不消耗主 rngState——事件抽取序列零位移，机制对轨迹的影响只通过
//   真实数值（丧葬/遗产/哀伤）传导。
// - 去世 = alive:false + deceased:true（无 estranged）：所有「在册」判定
//   （relationKinds/minCloseness 只查 alive）自动失效；revive 只认 estranged，
//   不会复活去世者；亲密度衰减与疏远兜底只作用于存活者，对去世者无感。
// - 被疏远（断绝来往）的父母不在判定范围：其身后事叙事留给第 42 轮内容轮评估。
import type { Relation } from './types'
import { mulberry32 } from './rng'

/** 父母近似年龄偏移：父母年龄 ≈ 玩家年龄 + 28（与 rel_parent_frail 注释同口径） */
export const PARENT_AGE_OFFSET = 28

/** 年度去世风险表（千分比/年）：按父母近似年龄分档，数据驱动；档位从高到低取首个命中 */
export interface ParentDeathBand {
  /** 父母近似年龄下限（含） */
  minAge: number
  /** 该档年度去世概率（千分比） */
  pPerMille: number
}

export const PARENT_DEATH_TABLE: ParentDeathBand[] = [
  { minAge: 90, pPerMille: 150 },
  { minAge: 80, pPerMille: 80 },
  { minAge: 70, pPerMille: 30 },
  { minAge: 60, pPerMille: 10 },
]

/**
 * 被照护（cared_for_parents）意味着父母更高龄或重病，风险 ×1.5。
 * 数值唯一平衡窗口是第 58 轮千局；改前先跑对照。
 */
export const PARENT_CARE_RISK_MUL = 1.5

/** 丧葬开支（每位去世者，元）——数千元档，与既有物价感知（手术 8k/15k 顶格）一致 */
export const PARENT_FUNERAL_COST = 4000

/** 遗产（元）：被照护或亲密度 ≥ 60 的父母留下的小额积蓄（多年孝心的回响） */
export const PARENT_INHERITANCE = 8000
export const PARENT_INHERITANCE_MIN_CLOSENESS = 60

/** 哀伤期标记：送别父母后进入哀伤期，到期由年度结算移除（时点记在 cooldowns） */
export const GRIEF_TAG = 'grief_parent'
/** 哀伤期长度（年）：去世年龄 + GRIEF_YEARS 到期；期间每年 happiness -1 */
export const GRIEF_YEARS = 3
/** 哀伤期年度情绪代价（到期年不再扣，只移除标记） */
export const GRIEF_HAPPINESS_DRAIN = 1
/** 去世当年的即时情绪冲击 */
export const GRIEF_IMMEDIATE_HIT = 2

/**
 * 病危标记（第 42 轮，事件线授予）：病危事件（rel_parent_critical）各选项授予，
 * 临终陪伴事件消耗（removeTags）；年度结算按 cooldowns 借用键到期清理（CRITICAL_YEARS）。
 * 标记在场 = 父母病危未安，去世风险 ×PARENT_CRITICAL_RISK_MUL。
 */
export const CRITICAL_TAG = 'parent_critical'
export const CRITICAL_YEARS = 3
export const PARENT_CRITICAL_RISK_MUL = 5

// ── 晚年搭伴伴侣（第 44 轮）：搭伴线升级为真实 partner 关系后的离世语义 ──
// 复用第 41 轮去世语义（alive=false + deceased + deathAge，无 estranged）：
// 「重新建立」不复活、在册判定自动失效、送别走同一套哀伤/履历。
// 搭伴双方都已高龄，固定年去世率 8%（预期共处约 12 年）；不设遗产
// （搭伴财产各自归置，不引入继承机制），丧葬同款数千元档。

/** 搭伴伴侣年度去世概率（千分比） */
export const COMPANION_DEATH_PPERMILLE = 80
/** 送别搭伴伴侣的丧葬开支（元） */
export const COMPANION_FUNERAL_COST = 4000
/** 送别搭伴伴侣的哀伤期标记（与 grief_parent 同款消退/扣减逻辑，lifecycle 泛化处理） */
export const GRIEF_COMPANION_TAG = 'grief_companion'
/** late_late_companion 升级线授予的标记：在场即认定真实搭伴关系 */
export const LATE_COMPANIONSHIP_TAG = 'late_companionship'

export interface CompanionDeathResult {
  relations: Relation[]
  /** 本年度去世的搭伴伴侣（至多一位） */
  died: { id: string; name: string } | null
  /** 丧葬开支（元；无去世为 0） */
  funeral: number
}

/**
 * 搭伴伴侣去世年度判定（纯函数，不读写主 rngState）：
 * 存活 partner 且玩家带 late_companionship 标记时，按固定年率独立 roll。
 * seed + 玩家年龄 + 关系 id 派生独立随机流（与父母去世同款，主抽取序列零位移）。
 */
export function settleCompanionDeath(
  relations: Relation[],
  tags: string[],
  playerAge: number,
  seed: number,
): CompanionDeathResult {
  if (!tags.includes(LATE_COMPANIONSHIP_TAG)) {
    return { relations, died: null, funeral: 0 }
  }
  const rel = relations.find((r) => r.kind === 'partner' && r.alive)
  if (!rel) return { relations, died: null, funeral: 0 }
  const stream = mulberry32(
    (seed ^ Math.imul(playerAge, 0xc2b2ae35) ^ hashString(`companion_${rel.id}`)) >>> 0,
  )
  if (stream.next() * 1000 >= COMPANION_DEATH_PPERMILLE) {
    return { relations, died: null, funeral: 0 }
  }
  const next = relations.map((r) =>
    r.id === rel.id ? { ...r, alive: false, deceased: true, deathAge: playerAge } : r,
  )
  return {
    relations: next,
    died: { id: rel.id, name: rel.name },
    funeral: COMPANION_FUNERAL_COST,
  }
}

// ── 兄弟姐妹晚年先逝（第 64 轮）：复用第 41 轮去世语义的最小复制 ──
// 手足年龄有真实数据（开局 birthAge = 玩家出生年 ±4 盖章，childAge('sibling') 可查），
// 风险按手足真实年龄查表——兄姐更年长更早进入高档位，「兄姐先逝略高」由数据自然实现。
// 判定独立随机流（seed + 玩家年龄 + 关系 id 派生），主 rng 流零位移；
// 去世 = alive:false + deceased + deathAge（记手足年龄）：revive 不复活、在册判定自动失效。
// 本轮不设遗产与哀伤期（丧葬+送别履历已齐；哀伤期归第 65 轮事件线评估）。

/** 手足年度去世风险表（千分比/年）：按手足真实年龄分档 */
export const SIBLING_DEATH_TABLE: ParentDeathBand[] = [
  { minAge: 80, pPerMille: 70 },
  { minAge: 72, pPerMille: 28 },
  { minAge: 64, pPerMille: 9 },
]

/** 手足先逝年检起点：玩家 58 岁起才判定（此前手足约 54–62 岁，风险带未开） */
export const SIBLING_DEATH_START = 58

/** 送别手足的丧葬开支（元）——数千元档，与父母/搭伴同款 */
export const SIBLING_FUNERAL_COST = 4000

export interface SiblingDeath {
  id: string
  name: string
  /** 去世时的手足年龄 */
  siblingAge: number
}

export interface SiblingDeathResult {
  relations: Relation[]
  /** 本年度去世的手足（两人同年概率极低但叙事合法） */
  deaths: SiblingDeath[]
  /** 丧葬总开支（元） */
  funeral: number
}

/** 手足真实年龄（开局 birthAge 盖章推算；缺盖章或为负异常时返回 null 不判定） */
export function siblingAgeOf(r: Relation, playerAge: number): number | null {
  if (typeof r.birthAge !== 'number' || !Number.isInteger(r.birthAge)) return null
  const age = playerAge - r.birthAge
  return age >= 0 ? age : null
}

/**
 * 手足去世年度判定（纯函数，不读写主 rngState）：玩家 ≥SIBLING_DEATH_START 起，
 * 每位存活手足按真实年龄查表独立 roll。同 seed 同年龄同关系集合，结果可复现。
 */
export function settleSiblingDeath(
  relations: Relation[],
  playerAge: number,
  seed: number,
): SiblingDeathResult {
  const deaths: SiblingDeath[] = []
  if (playerAge < SIBLING_DEATH_START) {
    return { relations, deaths, funeral: 0 }
  }
  let next = relations
  for (const r of relations) {
    if (r.kind !== 'sibling' || !r.alive) continue
    const sAge = siblingAgeOf(r, playerAge)
    if (sAge === null) continue
    const band = SIBLING_DEATH_TABLE.find((b) => sAge >= b.minAge)
    if (!band) continue
    const stream = mulberry32((seed ^ Math.imul(playerAge, 0x85ebca6b) ^ hashString(r.id)) >>> 0)
    if (stream.next() * 1000 < band.pPerMille) {
      if (next === relations) next = [...relations]
      next = next.map((x) =>
        x.id === r.id ? { ...x, alive: false, deceased: true, deathAge: sAge } : x,
      )
      deaths.push({ id: r.id, name: r.name, siblingAge: sAge })
    }
  }
  return { relations: next, deaths, funeral: deaths.length * SIBLING_FUNERAL_COST }
}

// ── 宠物生命周期（第 69 轮）：衰老与离别——decay 0 维持（在世不衰减），寿命封顶管离别 ──
// 寿命 12–16 年由「seed + 关系 id」散列一次定寿（随机支流，主 rng 零位移、
// 同 seed 同宠物可复现）；到龄确定性离世（deathAge 记宠物真实年龄）。
// 旧档宠物无 birthAge → 无法推算年龄 → 不参与离世判定（近似「家中新成员」，
// 账本说明）；身后事 = 善后 500 + grief_pet 哀伤 2 年（lifecycle 泛化循环）。

export const PET_LIFESPAN_MIN = 12
/** 寿命上限（含）——12…16 年均匀取整 */
export const PET_LIFESPAN_MAX = 16
/** 宠物善后开支（元）——数百档 */
export const PET_AFTERCARE_COST = 500
export const GRIEF_PET_TAG = 'grief_pet'
export const GRIEF_PET_YEARS = 2

/** 宠物寿命（散列支流）：同 seed 同宠物 id 必得同寿命 */
export function petLifespan(seed: number, petId: string): number {
  const stream = mulberry32((seed ^ hashString(`pet_${petId}`)) >>> 0)
  return PET_LIFESPAN_MIN + Math.floor(stream.next() * (PET_LIFESPAN_MAX + 1 - PET_LIFESPAN_MIN))
}

export interface PetDeath {
  id: string
  name: string
  /** 离世时的宠物年龄 */
  petAge: number
}

export interface PetDeathResult {
  relations: Relation[]
  /** 本年度离世的宠物 */
  deaths: PetDeath[]
  /** 善后开支（元） */
  aftercare: number
}

/** 宠物当前年龄（开局/领养 birthAge 盖章推算；无盖章返回 null——旧档近似不判定） */
export function petAgeOf(r: Relation, playerAge: number): number | null {
  if (typeof r.birthAge !== 'number' || !Number.isInteger(r.birthAge)) return null
  const age = playerAge - r.birthAge
  return age >= 0 ? age : null
}

/**
 * 宠物到龄离世年度判定（纯函数、确定性、不消耗任何 RNG）：
 * 宠物年龄 ≥ 散列定寿 → 当年离世（alive:false + deceased + deathAge=宠物年龄）。
 * 旧档无 birthAge 的宠物不判定； revive 只认 estranged 不涉及宠物。
 */
export function settlePetDeath(relations: Relation[], playerAge: number, seed: number): PetDeathResult {
  const deaths: PetDeath[] = []
  let next = relations
  for (const r of relations) {
    if (r.kind !== 'pet' || !r.alive) continue
    const pAge = petAgeOf(r, playerAge)
    if (pAge === null) continue
    if (pAge < petLifespan(seed, r.id)) continue
    if (next === relations) next = [...relations]
    next = next.map((x) =>
      x.id === r.id ? { ...x, alive: false, deceased: true, deathAge: pAge } : x,
    )
    deaths.push({ id: r.id, name: r.name, petAge: pAge })
  }
  return { relations: next, deaths, aftercare: deaths.length * PET_AFTERCARE_COST }
}

/** 父母近似年龄 */
export function parentApproximateAge(playerAge: number): number {
  return playerAge + PARENT_AGE_OFFSET
}

/** 查表得年度去世概率（千分比）；父母在被照护中 ×1.5，病危未安 ×5（第 42 轮） */
export function parentDeathRiskPerMille(
  parentAge: number,
  underCare: boolean,
  underCritical = false,
): number {
  const band = PARENT_DEATH_TABLE.find((b) => parentAge >= b.minAge)
  if (!band) return 0
  let p = underCare ? Math.round(band.pPerMille * PARENT_CARE_RISK_MUL) : band.pPerMille
  if (underCritical) p = Math.round(p * PARENT_CRITICAL_RISK_MUL)
  return p
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface ParentDeath {
  id: string
  name: string
  /** 去世时的父母近似年龄 */
  parentAge: number
  /** 留下的遗产（0 = 无） */
  inheritance: number
}

export interface ParentDeathResult {
  relations: Relation[]
  /** 本年度去世的父母（同一年可能双亲同逝，概率极低但叙事合法） */
  deaths: ParentDeath[]
  /** 丧葬总开支（元） */
  funeral: number
}

/**
 * 父母去世年度判定（纯函数，不读写主 rngState）：
 * 每位在场父母独立 roll 一次，风险按近似年龄查表、照护 ×1.5。
 * 同 seed 同年龄同关系集合，结果可复现。
 */
export function settleParentDeath(
  relations: Relation[],
  tags: string[],
  playerAge: number,
  seed: number,
): ParentDeathResult {
  const parentAge = parentApproximateAge(playerAge)
  const underCare = tags.includes('cared_for_parents')
  const underCritical = tags.includes(CRITICAL_TAG)
  const pPerMille = parentDeathRiskPerMille(parentAge, underCare, underCritical)
  const deaths: ParentDeath[] = []
  let next = relations
  if (pPerMille > 0) {
    for (const r of relations) {
      if (r.kind !== 'parent' || !r.alive) continue
      const stream = mulberry32((seed ^ Math.imul(playerAge, 0x9e3779b1) ^ hashString(r.id)) >>> 0)
      if (stream.next() * 1000 < pPerMille) {
        if (next === relations) next = [...relations]
        next = next.map((x) =>
          x.id === r.id ? { ...x, alive: false, deceased: true, deathAge: parentAge } : x,
        )
        deaths.push({
          id: r.id,
          name: r.name,
          parentAge,
          inheritance:
            underCare || r.closeness >= PARENT_INHERITANCE_MIN_CLOSENESS ? PARENT_INHERITANCE : 0,
        })
      }
    }
  }
  return { relations: next, deaths, funeral: deaths.length * PARENT_FUNERAL_COST }
}
