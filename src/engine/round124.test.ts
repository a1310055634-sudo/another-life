// 第 124 轮（V7）：事件池扩容——新线联动 10 枚（linkup.ts）+老线补密 9 枚
// 本测试锁定：联动事件的**两线交点门控**（缺任一线即不可达）+池合规。
// 老线 9 枚的门控矩阵由各自文件既有套件覆盖（marriage/friends/pets/parents 计数已同步）。
// 撞题扫描与两线交点清单在关账账本（linkup 撞题扫描记录段）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { LINKUP_EVENTS } from '../data/events/linkup'
import { MARRIAGE_EVENTS } from '../data/events/marriage'
import { FRIEND_EVENTS } from '../data/events/friends'
import { PET_EVENTS } from '../data/events/pets'
import { PARENT_EVENTS } from '../data/events/parents'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

const ev = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const ok = (id: string, s: GameState): boolean => isEventAvailable(s, ev(id))

describe('两线交点门控（A3 抽检 5 枚，缺任一线即不可达）', () => {
  it('创业×婚姻：entrepreneur 缺→拒；spouse 缺→拒；双线齐→可达', () => {
    const neither = makeGame(7, { age: 35 })
    const entOnly = makeGame(7, { age: 35, tags: ['entrepreneur'] })
    expect(ok('lk_spouse_venture', neither)).toBe(false)
    expect(ok('lk_spouse_venture', entOnly)).toBe(false)
    const both = makeGame(7, {
      age: 35,
      tags: ['entrepreneur'],
      relations: [{ id: 'sp1', kind: 'spouse', name: 'TA', closeness: 60, alive: true }],
    })
    expect(ok('lk_spouse_venture', both)).toBe(true)
  })
  it('心理×职场：low_mood 缺拒、非在职拒、双齐可达', () => {
    const employed = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '文员', level: 1, salary: 50000, yearsAtJob: 1 }
    expect(ok('lk_mood_work', makeGame(7, { age: 35, career: employed }))).toBe(false)
    expect(ok('lk_mood_work', makeGame(7, { age: 35, tags: ['low_mood'] }))).toBe(false)
    expect(ok('lk_mood_work', makeGame(7, { age: 35, tags: ['low_mood'], career: employed }))).toBe(true)
  })
  it('遗嘱×手足：will_mode 缺拒；清空手足后缺拒；双齐可达（fixture 清 base 自带手足——R64 开局定数 35% 有手足）', () => {
    expect(ok('will_sibling_table', makeGame(7, { age: 65 }))).toBe(false)
    const noSib = makeGame(7, { age: 65, tags: ['will_mode_even'], relations: [] })
    expect(ok('will_sibling_table', noSib)).toBe(false)
    const both = makeGame(7, {
      age: 65,
      tags: ['will_mode_even'],
      relations: [{ id: 's1', kind: 'sibling', name: '大哥', closeness: 60, alive: true }],
    })
    expect(ok('will_sibling_table', both)).toBe(true)
  })
  it('性格×创业（tagsAll 双标记）：biz_failed 缺拒、persona_shifted 缺拒、双齐可达', () => {
    expect(ok('persona_after_close', makeGame(7, { age: 40, tags: ['biz_failed'] }))).toBe(false)
    expect(ok('persona_after_close', makeGame(7, { age: 40, tags: ['persona_shifted'] }))).toBe(false)
    expect(ok('persona_after_close', makeGame(7, { age: 40, tags: ['biz_failed', 'persona_shifted'] }))).toBe(true)
  })
  it('邻里×养老：elder_home 缺拒、neighbor 缺拒、双齐可达', () => {
    const nb = { id: 'n1', kind: 'neighbor' as const, name: '张婶', closeness: 60, alive: true }
    expect(ok('nb_elder_help', makeGame(7, { age: 68 }))).toBe(false)
    expect(ok('nb_elder_help', makeGame(7, { age: 68, tags: ['elder_home'] }))).toBe(false)
    expect(ok('nb_elder_help', makeGame(7, { age: 68, tags: ['elder_home'], relations: [nb] }))).toBe(true)
  })
})

describe('池合规与计数（A1/A4）', () => {
  it('linkup 10 枚/老线 9 枚/全池 330→349/validateEvents 零 issue/once 或 cooldown 语义明确', () => {
    expect(LINKUP_EVENTS).toHaveLength(10)
    expect(MARRIAGE_EVENTS).toHaveLength(11)
    expect(FRIEND_EVENTS).toHaveLength(8)
    expect(PET_EVENTS).toHaveLength(8)
    expect(PARENT_EVENTS).toHaveLength(10)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of LINKUP_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.once === true || typeof e.cooldown === 'number').toBe(true)
    }
  })
})
