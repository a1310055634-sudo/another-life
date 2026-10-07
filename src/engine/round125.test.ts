// 第 125 轮（V7）：成就五期——V7 新线机制成就 59→66
// 七枚逐枚正反构造（差一块条件都不解锁的矩阵式断言），来源标记与 R113/R115/R116/
// R118/R120/R122 各线事件对账；稀有度初校表在关账账本（400 局抽测产出）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { evaluateAchievements } from './achievements'
import { ACHIEVEMENTS } from './achievements'
import type { GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

const ids = (s: GameState): string[] => evaluateAchievements(s).map((a) => a.id)
const has = (s: GameState, id: string): boolean => ids(s).includes(id)

const rel = (kind: 'child' | 'neighbor' | 'parent', closeness: number): Relation => ({
  id: `r_${kind}`,
  kind,
  name: '测试',
  closeness,
  alive: true,
  ...(kind === 'child' ? { birthAge: 30 } : {}),
})

describe('白手起家 ach_white_hands（rare）', () => {
  const s = (over: Partial<GameState>): GameState =>
    makeGame(7, { age: 40, money: 150000, tags: ['entrepreneur'], ...over })
  it('三条件齐→解锁；缺 biz_failed 排除/缺钱/缺 entrepreneur 均不解锁', () => {
    expect(has(s({}), 'ach_white_hands')).toBe(true)
    expect(has(s({ tags: ['entrepreneur', 'biz_failed'] }), 'ach_white_hands')).toBe(false)
    expect(has(s({ money: 50000 }), 'ach_white_hands')).toBe(false)
    expect(has(s({ tags: [] }), 'ach_white_hands')).toBe(false)
  })
})

describe('求助的勇气 ach_brave_help（rare）', () => {
  const s = (over: Partial<GameState>): GameState =>
    makeGame(7, {
      age: 40,
      attrs: { health: 60, happiness: 55, smarts: 50, social: 50, stress: 20 },
      ...over,
    })
  it('曾入谷（low_mood_ever）+现无 low_mood+幸福≥50 → 解锁', () => {
    expect(has(s({ tags: ['low_mood_ever'] }), 'ach_brave_help')).toBe(true)
  })
  it('仍在谷中（low_mood 在册）不解锁；无 low_mood_ever（没入过谷）不解锁；幸福 <50 不解锁', () => {
    expect(has(s({ tags: ['low_mood_ever', 'low_mood'] }), 'ach_brave_help')).toBe(false)
    expect(has(s({ tags: [] }), 'ach_brave_help')).toBe(false)
    expect(has(s({ tags: ['low_mood_ever'], attrs: { health: 60, happiness: 40, smarts: 50, social: 50, stress: 20 } }), 'ach_brave_help')).toBe(false)
  })
})

describe('良师父母 ach_teacher_parent（rare）', () => {
  it('parenting_active+存活孩子亲密 ≥75 → 解锁；亲密 74 不解锁', () => {
    const ok = makeGame(7, { age: 40, tags: ['parenting_active'], relations: [rel('child', 75)] })
    expect(has(ok, 'ach_teacher_parent')).toBe(true)
    const near = makeGame(7, { age: 40, tags: ['parenting_active'], relations: [rel('child', 74)] })
    expect(has(near, 'ach_teacher_parent')).toBe(false)
  })
  it('无 parenting_active（参与标记）不解锁', () => {
    expect(has(makeGame(7, { age: 40, relations: [rel('child', 80)] }), 'ach_teacher_parent')).toBe(false)
  })
})

describe('远亲不如近邻 ach_near_neighbor（common）', () => {
  it('邻居亲密 ≥70 解锁；69 不解锁', () => {
    expect(has(makeGame(7, { age: 45, relations: [rel('neighbor', 70)] }), 'ach_near_neighbor')).toBe(true)
    expect(has(makeGame(7, { age: 45, relations: [rel('neighbor', 69)] }), 'ach_near_neighbor')).toBe(false)
  })
})

describe('十年归途 ach_decade_homecoming（common）', () => {
  it('home_for_ny+45 岁+父母亲密 ≥60 解锁；44 岁或父母亲密不足不解锁', () => {
    const ok = makeGame(7, { age: 45, tags: ['home_for_ny'], relations: [rel('parent', 60)] })
    expect(has(ok, 'ach_decade_homecoming')).toBe(true)
    expect(has(makeGame(7, { age: 44, tags: ['home_for_ny'], relations: [rel('parent', 60)] }), 'ach_decade_homecoming')).toBe(false)
    expect(has(makeGame(7, { age: 45, tags: ['home_for_ny'], relations: [rel('parent', 55)] }), 'ach_decade_homecoming')).toBe(false)
  })
})

describe('家风相传 ach_family_motto（epic，血脉局专属）', () => {
  it('motto_set+generation≥2 解锁；motto_set+generation:1（初代）不解锁；无 motto_set 不解锁', () => {
    expect(has(makeGame(7, { tags: ['motto_set', 'generation:2'] }), 'ach_family_motto')).toBe(true)
    expect(has(makeGame(7, { tags: ['motto_set', 'generation:3'] }), 'ach_family_motto')).toBe(true)
    expect(has(makeGame(7, { tags: ['motto_set', 'generation:1'] }), 'ach_family_motto')).toBe(false)
    expect(has(makeGame(7, { tags: ['generation:2'] }), 'ach_family_motto')).toBe(false)
  })
})

describe('安其所 ach_content_elder（rare）', () => {
  it('三种方式 tag 任一+幸福 ≥60 解锁；幸福 59 或无方式 tag 不解锁', () => {
    for (const tag of ['elder_home', 'elder_with_child', 'elder_institution']) {
      expect(has(makeGame(7, { age: 70, tags: [tag], attrs: { health: 50, happiness: 60, smarts: 50, social: 50, stress: 20 } }), 'ach_content_elder')).toBe(true)
    }
    expect(has(makeGame(7, { age: 70, tags: ['elder_home'], attrs: { health: 50, happiness: 59, smarts: 50, social: 50, stress: 20 } }), 'ach_content_elder')).toBe(false)
    expect(has(makeGame(7, { age: 70, attrs: { health: 50, happiness: 70, smarts: 50, social: 50, stress: 20 } }), 'ach_content_elder')).toBe(false)
  })
})

describe('池合规（A3）', () => {
  it('ACHIEVEMENTS 59→66、id 无重复、新七枚 rarity 落位', () => {
    expect(ACHIEVEMENTS).toHaveLength(66)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(66)
    const rarity = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.rarity]))
    expect(rarity.ach_white_hands).toBe('rare')
    expect(rarity.ach_brave_help).toBe('rare')
    expect(rarity.ach_teacher_parent).toBe('rare')
    expect(rarity.ach_near_neighbor).toBe('common')
    expect(rarity.ach_decade_homecoming).toBe('common')
    expect(rarity.ach_family_motto).toBe('epic')
    expect(rarity.ach_content_elder).toBe('rare')
  })
})
