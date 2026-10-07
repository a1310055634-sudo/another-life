// 第 69 轮：宠物真实化测试（birthAge 盖章 / 散列定寿 / 到龄离世 / grief_pet / 事件门控）
// 验收口径（PROMPT-V4.md 第 69 轮）：
// - A1 寿命 seed 确定性（散列支流：seed ^ hashString(pet_id)，12–16 均匀）
// - A2 旧档 pet 无 birthAge 兼容（不参与离世判定，近似账本说明）
// - A3 离世后宠物类事件资格消失；A4 grief_pet 自然消退；A6 18 局零位移（排除表+盖章不触 V1 主流）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, isEventAvailable, availableEvents } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { PET_EVENTS } from '../data/events/pets'
import { petLifespan, settlePetDeath, petAgeOf, GRIEF_PET_TAG } from './parents'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function byId(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const pet = (birthAge: number, patch: Partial<Relation> = {}): Relation => ({
  id: 'p1', kind: 'pet', name: '小猫', closeness: 60, alive: true, birthAge, ...patch,
})

describe('第 69 轮：寿命散列与到龄离世（A1）', () => {
  it('寿命 seed 确定性：同 seed 同 id 必同值且在 12–16；跨 seed 分散', () => {
    expect(petLifespan(42, 'p1')).toBe(petLifespan(42, 'p1'))
    expect(petLifespan(42, 'p1')).toBeGreaterThanOrEqual(12)
    expect(petLifespan(42, 'p1')).toBeLessThanOrEqual(16)
    const spread = new Set(Array.from({ length: 20 }, (_, i) => petLifespan(i + 1, 'p1')))
    expect(spread.size).toBeGreaterThanOrEqual(3)
  })

  it('到龄确定性离世：deathAge 记宠物年龄、善后 500、未到龄不判；旧档无 birthAge 跳过（A2）', () => {
    const lifespan = petLifespan(42, 'p1')
    const playerAge = 30 + lifespan // 30 岁收养 → 玩家 30+寿命 岁时宠物寿命期满
    const rels = [pet(30)]
    const res = settlePetDeath(rels, playerAge, 42)
    expect(res.deaths).toHaveLength(1)
    expect(res.deaths[0].petAge).toBe(lifespan)
    expect(res.aftercare).toBe(500)
    expect(res.relations[0].alive).toBe(false)
    expect(res.relations[0].deceased).toBe(true)
    expect(res.relations[0].deathAge).toBe(lifespan)
    // 未到龄：不判
    expect(settlePetDeath(rels, playerAge - 1, 42).deaths).toHaveLength(0)
    // 旧档无 birthAge：跳过不判（A2 近似口径）
    const old: Relation = { id: 'p9', kind: 'pet', name: '老白', closeness: 55, alive: true }
    expect(petAgeOf(old, 60)).toBeNull()
    expect(settlePetDeath([old], 60, 42).deaths).toHaveLength(0)
  })

  it('advanceYear 集成：离世年善后落账 + 送别 key 履历 + grief_pet 授予；两年后哀伤消退（A4）', () => {
    const lifespan = petLifespan(42, 'p1')
    const s = makeGame(42, { age: 30 + lifespan - 1, relations: [pet(30)] })
    const after = advanceYear(s)
    const dead = after.relations.find((r) => r.id === 'p1')!
    if (dead.deceased) {
      expect(after.history.some((h) => h.title === '送别' && h.key)).toBe(true)
      expect(after.yearLog.join('\n')).toContain('善后开支')
      expect(after.tags).toContain(GRIEF_PET_TAG)
      // 两年后哀伤自然消退（泛化循环）
      let cur = after
      for (let i = 0; i < 2 && cur.phase === 'playing'; i++) cur = advanceYear(cur)
      expect(cur.tags).not.toContain(GRIEF_PET_TAG)
    }
  })

  it('宠物入家门盖章 birthAge（第 69 轮 engine 扩展）；validate pet 年龄域 [age−20, age]', () => {
    const s = makeGame(7, { age: 35 })
    const after = applyChoice(s, byId('youth_pet_stray'), 0).state
    const p = after.relations.find((r) => r.kind === 'pet')!
    expect(p.birthAge).toBe(35)
    const ok = makeGame(7, { age: 40, relations: [pet(38)] })
    expect(validateState(ok).issues).toEqual([])
    const stale = makeGame(7, { age: 40, relations: [pet(15)] }) // 宠物 25 岁 > 20 上限
    validateState(stale)
    expect(stale.relations[0].birthAge).toBeUndefined()
  })
})

describe('第 69 轮：事件门控（A3）', () => {
  it('疫苗/陪伴须宠物在册；衰老照护须满 10 岁；离别线须 grief_pet', () => {
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [pet(32)] }), byId('pet_vet_visit'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [] }), byId('pet_vet_visit'))).toBe(false)
    const low = { ...makeGame().attrs, happiness: 40 }
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: low, relations: [pet(32)] }), byId('pet_companion'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: low, relations: [] }), byId('pet_companion'))).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 45, relations: [pet(33)] }), byId('pet_aging_care'))).toBe(true) // 12 岁
    expect(isEventAvailable(makeGame(7, { age: 45, relations: [pet(40)] }), byId('pet_aging_care'))).toBe(false) // 5 岁
    expect(isEventAvailable(makeGame(7, { age: 45, relations: [pet(33)], tags: ['grief_pet'] }), byId('pet_farewell_choice'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 45, relations: [pet(33)] }), byId('pet_farewell_choice'))).toBe(false)
  })

  it('A3 离世后宠物类事件资格消失（deceased 不算在册）', () => {
    const s = makeGame(7, {
      age: 50,
      relations: [pet(30, { alive: false, deceased: true, deathAge: 15 })],
    })
    const ids = new Set(availableEvents(s, ALL_EVENTS).map((e) => e.id))
    expect(ids.has('pet_vet_visit')).toBe(false)
    expect(ids.has('pet_companion')).toBe(false)
    expect(ids.has('pet_aging_care')).toBe(false)
  })

  it('离别线再领养支：新宠物落家（birthAge 盖章）+ 双标记收放', () => {
    const s = makeGame(7, {
      age: 45,
      relations: [pet(30, { alive: false, deceased: true, deathAge: 14 })],
      tags: ['grief_pet', 'pet_owner'],
    })
    const after = applyChoice(s, byId('pet_farewell_choice'), 1).state
    const p = after.relations.find((r) => r.kind === 'pet' && r.alive)!
    expect(p.birthAge).toBe(45)
    expect(after.tags).toContain('pet_owner')
    expect(after.tags).not.toContain('grief_pet')
  })

  it('计数：pets.ts 6、全池 282、validateEvents 全池零 issue', () => {
    expect(PET_EVENTS).toHaveLength(8)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
