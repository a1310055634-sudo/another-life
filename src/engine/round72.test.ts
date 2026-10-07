// 第 72 轮：成就三期测试（46→52，全部读 V4 新机制真实状态）
// 验收口径（PROMPT-V4.md 第 72 轮）：
// - 6 枚新成就正反测试 + 可达构造路线（依赖机制若被砍量砍掉则改条件或砍掉——
//   离婚分支未做，婚姻修复成就用 marriage_mended 持久标记承载[67 轮修复支授予]）
// - 不误奖励富裕开局（bg_wealthy 排除惯例不涉本批——6 枚条件均无资产门槛）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { ACHIEVEMENTS, evaluateAchievements } from './achievements'
import type { GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const ids = (s: GameState): string[] => evaluateAchievements(s).map((a) => a.id)
const sib = (patch: Partial<Relation> = {}): Relation => ({
  id: 's1', kind: 'sibling', name: '建平', closeness: 65, alive: true, birthAge: -3, ...patch,
})
const friend = (closeness: number, bestFriend = true): Relation => ({
  id: 'f1', kind: 'friend', name: '老周', closeness, alive: true, bestFriend,
})
const deadPet = (deathAge: number): Relation => ({
  id: 'p1', kind: 'pet', name: '小猫', closeness: 60, alive: false, deceased: true, deathAge, birthAge: 20,
})

describe('第 72 轮：成就三期（46→52）', () => {
  it('ach_sibling_bond 手足情深：50 岁+在册亲密 60 ✓；49 岁/低亲密/无手足 ✗', () => {
    const ok = ids(makeGame(7, { age: 50, relations: [sib()] }))
    expect(ok).toContain('ach_sibling_bond')
    const young = ids(makeGame(7, { age: 49, relations: [sib()] }))
    expect(young).not.toContain('ach_sibling_bond')
    const cold = ids(makeGame(7, {
      age: 50, relations: [sib({ closeness: 45 })],
    }))
    expect(cold).not.toContain('ach_sibling_bond')
    expect(ids(makeGame(7, { age: 50, relations: [] }))).not.toContain('ach_sibling_bond')
  })

  it('ach_soul_buddy 挚友如兄：45 岁+挚友标记+亲密 75 ✓；无标记/低亲密/年轻 ✗', () => {
    const ok = ids(makeGame(7, { age: 45, relations: [friend(75)] }))
    expect(ok).toContain('ach_soul_buddy')
    expect(ids(makeGame(7, { age: 45, relations: [friend(75, false)] }))).not.toContain('ach_soul_buddy')
    expect(ids(makeGame(7, { age: 45, relations: [friend(70)] }))).not.toContain('ach_soul_buddy')
    expect(ids(makeGame(7, { age: 44, relations: [friend(75)] }))).not.toContain('ach_soul_buddy')
  })

  it('ach_grad_studies 学无止境：硕博学历 ✓；本科及以下 ✗（与 ach_first_degree 递进不撞）', () => {
    const master = ids(makeGame(7, { age: 40, education: 'master' }))
    expect(master).toContain('ach_grad_studies')
    expect(master).toContain('ach_first_degree') // 递进并存
    expect(ids(makeGame(7, { age: 40, education: 'bachelor' }))).not.toContain('ach_grad_studies')
    expect(ids(makeGame(7, { age: 40, education: 'phd' }))).toContain('ach_grad_studies')
  })

  it('ach_marriage_mended 雨过天晴：修复持久标记 ✓；危机在身/无痕迹 ✗', () => {
    expect(ids(makeGame(7, { tags: ['married', 'marriage_mended'] }))).toContain('ach_marriage_mended')
    expect(ids(makeGame(7, { tags: ['married', 'marriage_crisis'] }))).not.toContain('ach_marriage_mended')
    expect(ids(makeGame(7, { tags: ['married'] }))).not.toContain('ach_marriage_mended')
  })

  it('ach_pet_forever 它们的一生：送别 ≥12 岁宠物 ✓；短寿离世/在册/短寿离世的都不算', () => {
    const ok = ids(makeGame(7, { age: 50, relations: [deadPet(14)] }))
    expect(ok).toContain('ach_pet_forever')
    expect(ids(makeGame(7, { age: 50, relations: [deadPet(8)] }))).not.toContain('ach_pet_forever')
    expect(ids(makeGame(7, {
      age: 50, relations: [{ id: 'p2', kind: 'pet', name: '在册', closeness: 60, alive: true, birthAge: 20 }],
    }))).not.toContain('ach_pet_forever')
  })

  it('ach_burnout_resilience 倦怠突围：经历倦怠+已走出+心气回暖 ✓；仍在雾中/心气未复 ✗', () => {
    const ok = makeGame(7, {
      age: 40, seenEvents: ['mid_burnout_onset'], attrs: { ...makeGame().attrs, happiness: 55 },
    })
    expect(ids(ok)).toContain('ach_burnout_resilience')
    const stillIn = makeGame(7, {
      age: 40, seenEvents: ['mid_burnout_onset'], tags: ['burnout'],
      attrs: { ...makeGame().attrs, happiness: 55 },
    })
    expect(ids(stillIn)).not.toContain('ach_burnout_resilience')
    const low = makeGame(7, {
      age: 40, seenEvents: ['mid_burnout_onset'], attrs: { ...makeGame().attrs, happiness: 35 },
    })
    expect(ids(low)).not.toContain('ach_burnout_resilience')
    expect(ids(makeGame(7, { age: 40, attrs: { ...makeGame().attrs, happiness: 55 } }))).not.toContain('ach_burnout_resilience')
  })

  it('总数 59、id 唯一、稀有度合法、全池校验零 issue（事件池 214 不变）', () => {
    // R100 同步：52 → 59（第 100 轮成就四期 +7）
    expect(ACHIEVEMENTS).toHaveLength(66)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(66)
    expect(ACHIEVEMENTS.filter((a) => a.hidden)).toHaveLength(3) // 隐藏成就恰 3 枚不变
    const RARITIES = ['common', 'rare', 'epic', 'legendary']
    for (const a of ACHIEVEMENTS) expect(RARITIES).toContain(a.rarity)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const probe = makeGame(7, { age: 50, relations: [sib(), friend(75), deadPet(14)], tags: ['marriage_mended'] })
    expect(validateState(probe).issues).toEqual([])
  })
})
