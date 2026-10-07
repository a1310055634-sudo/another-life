import type { Attributes, EducationLevel, GameState, Relation, SkillKey } from './types'
import { ATTR_KEYS, clampAttr, normalizeAttrs, sanitizeMoney } from './attrs'
import { mulberry32 } from './rng'
import { BASE_SKILLS, clampSkill } from './education'
import { takeSnapshot } from './snapshot'
import { getBackground } from '../data/backgrounds'
import { getTrait } from '../data/traits'
import { SIBLING_NAMES, pickName } from '../data/names'

export const SAVE_VERSION = 2
export const START_AGE = 18

const SURNAMES = ['林', '陈', '苏', '周', '沈', '顾', '江', '许']
const GIVEN_NAMES = ['晚', '知远', '一鸣', '小满', '望舒', '之然', '予安', '青野']

export function randomName(rng: { next(): number }): string {
  const s = SURNAMES[Math.floor(rng.next() * SURNAMES.length)]
  const g = GIVEN_NAMES[Math.floor(rng.next() * GIVEN_NAMES.length)]
  return s + g
}

/** 背景 + 特质共同决定的初始标记（去重；特质标记可供事件条件引用） */
export function initialTags(backgroundId: string, traitId: string): string[] {
  const bg = getBackground(backgroundId)
  const trait = getTrait(traitId)
  return [...new Set([...bg.tags, ...(trait.tags ?? [])])]
}

/** 背景 + 特质共同决定的初始技能：基准值上叠加各自加成 */
export function initialSkills(backgroundId: string, traitId: string): Record<SkillKey, number> {
  const bg = getBackground(backgroundId)
  const trait = getTrait(traitId)
  const out = {} as Record<SkillKey, number>
  for (const k of ['academics', 'vocational'] as SkillKey[]) {
    out[k] = clampSkill(BASE_SKILLS[k] + (bg.skills?.[k] ?? 0) + (trait.skills?.[k] ?? 0))
  }
  return out
}

/**
 * 创建父母等初始家庭关系。seed（第 64 轮）：手足定数与取名走独立随机支流
 * （seed ^ SIBLING_SALT 的 mulberry32 实例 + pickName 纯散列），主 rng 流零位移——
 * 固定 seed 局的事件抽取序列与第 63 轮及以前完全一致（outcomes 18 局零位移）。
 */
function initialRelations(backgroundId: string, seed: number): Relation[] {
  const relations: Relation[] = []
  if (backgroundId === 'single_parent') {
    relations.push({ id: 'mother', kind: 'parent', name: '母亲', closeness: 70, alive: true })
  } else {
    relations.push({ id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true })
    relations.push({ id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true })
  }
  // 手足定数（第 64 轮，独生子女代际）：开局一次定数终身不追加——
  // 独生 60% / 1 个手足 35% / 2 个 5%；birthAge = 玩家出生年 ±4（engine 约定：
  // 关系年龄 = 玩家年龄 − birthAge，兄姐 birthAge 为负=玩家出生前 Δ 年），
  // 兄姐更年长 → 更早进入晚年先逝年检带（settleSiblingDeath），无需额外权重。
  const stream = mulberry32((seed ^ 0x5eedb105) >>> 0)
  const roll = stream.next()
  const count = roll < 0.6 ? 0 : roll < 0.95 ? 1 : 2
  for (let i = 0; i < count; i++) {
    const ageOffset = Math.floor(stream.next() * 9) - 4 // −4…+4：兄(姐)为正
    relations.push({
      id: `sibling_${i + 1}`,
      kind: 'sibling',
      name: pickName(SIBLING_NAMES, seed, 18, i),
      closeness: 65,
      alive: true,
      birthAge: -ageOffset,
    })
  }
  return relations
}

export interface NewGameOptions {
  seed: number
  name?: string
  backgroundId: string
  traitId: string
}

/** 由背景与特质确定性地生成初始状态：同参数必得同结果 */
export function createNewGame(options: NewGameOptions): GameState {
  const bg = getBackground(options.backgroundId)
  const trait = getTrait(options.traitId)
  const rng = mulberry32(options.seed)

  const rawAttrs = { health: 0, happiness: 0, smarts: 0, social: 0, stress: 0 }
  for (const k of ATTR_KEYS) {
    rawAttrs[k] = clampAttr(k, (bg.attrs[k] ?? 50) + (trait.attrs[k] ?? 0))
  }

  const name = options.name?.trim() || randomName(rng)

  const base: Omit<GameState, 'snapshots'> = {
    version: SAVE_VERSION,
    seed: options.seed >>> 0,
    rngState: rng.state(),
    name,
    age: START_AGE,
    backgroundId: bg.id,
    traitId: trait.id,
    attrs: normalizeAttrs(rawAttrs),
    money: sanitizeMoney(bg.money),
    education: bg.education,
    skills: initialSkills(bg.id, trait.id),
    career: { kind: 'none' },
    relations: initialRelations(bg.id, options.seed),
    tags: initialTags(bg.id, trait.id),
    seenEvents: [],
    cooldowns: {},
    pending: [],
    history: [],
    achievements: [],
    phase: 'playing',
    yearLog: [],
  }
  // 18 岁开局切面即首条快照：资产曲线等可视化从人生起点画起（第 21 轮）
  const state: GameState = { ...base, snapshots: [takeSnapshot(base)] }
  return state
}

/** 创建页的开局预览：与 createNewGame 完全同一套计算，只省去随机取名 */
export interface StartPreview {
  attrs: Attributes
  money: number
  education: EducationLevel
  skills: Record<SkillKey, number>
  parents: string
  tags: string[]
}

export function previewStart(backgroundId: string, traitId: string): StartPreview {
  const bg = getBackground(backgroundId)
  const trait = getTrait(traitId)
  const rawAttrs = { health: 0, happiness: 0, smarts: 0, social: 0, stress: 0 }
  for (const k of ATTR_KEYS) {
    rawAttrs[k] = clampAttr(k, (bg.attrs[k] ?? 50) + (trait.attrs[k] ?? 0))
  }
  return {
    attrs: normalizeAttrs(rawAttrs),
    money: sanitizeMoney(bg.money),
    education: bg.education,
    skills: initialSkills(bg.id, trait.id),
    parents: bg.id === 'single_parent' ? '只有母亲' : '父母双全',
    tags: initialTags(bg.id, trait.id),
  }
}
