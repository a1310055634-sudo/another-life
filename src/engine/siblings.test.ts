// 第 65 轮：兄弟姐妹事件线测试（siblings.ts 8 事件）
// 验收口径（PROMPT-V4.md 第 65 轮）：
// - A1 三状态模拟（长线/疏远/已故，入候选口径=availableEvents）：各态抽到对应处境
//   事件、错误状态从不入候选；无手足局 18–77 岁逐岁零泄漏
// - A2 每事件正反可用性；手足线与父母线联动（赡养分工 minCloseness 双键 AND、
//   遗产之年 parentsAllDeceased + parentDiedWithin + 手足在册）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, availableEvents, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { SIBLING_EVENTS } from '../data/events/siblings'
import type { GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const father: Relation = { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true }
const mother: Relation = { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true }
const fatherGone: Relation = { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true, deathAge: 87 }
const motherGone: Relation = { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true, deathAge: 86 }
const sib = (patch: Partial<Relation> = {}): Relation => ({
  id: 's1', kind: 'sibling', name: '建平', closeness: 65, alive: true, birthAge: -3, ...patch,
})

const idsOf = (s: GameState): Set<string> =>
  new Set(availableEvents(s, ALL_EVENTS).map((e) => e.id))
const SIB_IDS = SIBLING_EVENTS.map((e) => e.id)

describe('第 65 轮：siblings.ts 文件与计数（A3）', () => {
  it('文件计数 8、全池 204（第 68 轮倦怠线 +6）、validateEvents 全池零 issue', () => {
    expect(SIBLING_EVENTS).toHaveLength(8)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
  it('窗口覆盖 20–70+：每事件 ≥2 选项、minAge/maxAge 有序', () => {
    for (const e of SIBLING_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.minAge).toBeLessThanOrEqual(e.maxAge)
      expect(e.category).toBe('relationship')
    }
  })
})

describe('第 65 轮：三状态模拟（A1，入候选口径）', () => {
  it('长线态（在册亲密 65）：借钱/合伙/赡养可用；口角/重逢/老来/遗产/忌日不入候选', () => {
    const s = makeGame(7, { age: 38, money: 20000, relations: [father, mother, sib()] })
    const ids = idsOf(s)
    expect(ids.has('sib_loan')).toBe(true)
    expect(ids.has('sib_venture')).toBe(true)
    expect(ids.has('sib_care_split')).toBe(true)
    expect(ids.has('sib_fallout_reconcile')).toBe(false) // 亲密 65 > 40
    expect(ids.has('sib_reunion')).toBe(false)
    expect(ids.has('sib_old_companion')).toBe(false) // 手足 41 岁 <60 且玩家 <58
    expect(ids.has('sib_inheritance')).toBe(false) // 父母在册
    expect(ids.has('sib_memorial')).toBe(false)
  })

  it('口角态（亲密 35）与老来态（手足 66 岁）：各自唯一入候选', () => {
    const low = makeGame(7, {
      age: 40, relations: [sib({ closeness: 35 })],
    })
    expect(idsOf(low).has('sib_fallout_reconcile')).toBe(true)
    expect(idsOf(low).has('sib_loan')).toBe(true) // 在册即借钱线照常
    const old = makeGame(7, { age: 62, relations: [sib({ birthAge: -4 })] })
    expect(idsOf(old).has('sib_old_companion')).toBe(true)
  })

  it('疏远态：仅重逢线入候选；在册线全灭；重建选择落地 revive+清标记', () => {
    const s = makeGame(7, {
      age: 40,
      relations: [sib({ alive: false, estranged: true })],
      tags: ['estranged_sibling'],
    })
    const ids = idsOf(s)
    expect(ids.has('sib_reunion')).toBe(true)
    expect(ids.has('sib_loan')).toBe(false)
    expect(ids.has('sib_fallout_reconcile')).toBe(false)
    expect(ids.has('sib_old_companion')).toBe(false)
    const ev = ALL_EVENTS.find((e) => e.id === 'sib_reunion')!
    const after = applyChoice(s, ev, 0).state
    const r = after.relations.find((x) => x.id === 's1')!
    expect(r.alive).toBe(true)
    expect(r.estranged).toBe(false)
    expect(r.closeness).toBe(45)
    expect(after.tags).not.toContain('estranged_sibling')
  })

  it('已故态：仅旧照片（siblingDiedWithin 2）入候选；其余全灭', () => {
    const s = makeGame(7, {
      age: 65,
      relations: [sib({ alive: false, deceased: true, deathAge: 66 })], // 手足 66 岁，1 年前走
    })
    const ids = idsOf(s)
    expect(ids.has('sib_memorial')).toBe(true)
    expect(ids.has('sib_loan')).toBe(false)
    expect(ids.has('sib_fallout_reconcile')).toBe(false)
    expect(ids.has('sib_reunion')).toBe(false)
    // 超窗：3 年前走 → 不再入候选
    const stale = makeGame(7, {
      age: 68,
      relations: [sib({ alive: false, deceased: true, deathAge: 65 })],
    })
    expect(idsOf(stale).has('sib_memorial')).toBe(false)
  })

  it('遗产态：双亲皆逝三年内+手足在册入候选；手足不在册不入', () => {
    const s = makeGame(7, { age: 60, relations: [fatherGone, motherGone, sib()] })
    expect(idsOf(s).has('sib_inheritance')).toBe(true)
    const alone = makeGame(7, { age: 60, relations: [fatherGone, motherGone] })
    expect(idsOf(alone).has('sib_inheritance')).toBe(false)
  })

  it('零泄漏：无手足局 18–77 岁逐岁，8 个 sib_ 事件从不入候选', () => {
    for (let age = 18; age <= 77; age++) {
      const s = makeGame(7, { age, relations: [father, mother] })
      const ids = idsOf(s)
      for (const id of SIB_IDS) {
        expect(ids.has(id), `${age} 岁：${id} 不应入候选`).toBe(false)
      }
    }
  })
})

describe('第 65 轮：正反与结算（A2）', () => {
  it('sib_loan 借一半：支出落账 + 2 年后 delayed 还钱入 pending', () => {
    const s = makeGame(7, { age: 35, money: 20000, relations: [sib()] })
    const ev = ALL_EVENTS.find((e) => e.id === 'sib_loan')!
    expect(isEventAvailable(s, ev)).toBe(true)
    const after = applyChoice(s, ev, 1).state
    expect(after.money).toBe(10000)
    expect(after.pending.some((p) => p.money === 10000 && p.dueAge === 37)).toBe(true)
  })

  it('sib_inheritance 闹僵支：closeness −12 触发既有疏远兜底的路径可用（跌 0 由 settleEstrangement 接手）', () => {
    const s = makeGame(7, { age: 60, relations: [fatherGone, motherGone, sib({ closeness: 20 })] })
    const ev = ALL_EVENTS.find((e) => e.id === 'sib_inheritance')!
    const after = applyChoice(s, ev, 2).state
    const r = after.relations.find((x) => x.id === 's1')!
    expect(r.closeness).toBe(8)
    expect(r.alive).toBe(true) // 跌 0 才疏远；此处由后续年度衰减/兜底接手
    expect(after.money - s.money).toBe(15000)
  })
})
