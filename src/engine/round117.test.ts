// 第 117 轮（V7）：遗嘱与遗产分配——will_done 链三事件
// 覆盖：资格串联门控（will_done→分配→修改/心愿）、三向分配标记落账与孙辈支门控、
// 修改遗嘱的标记替换、存档 v2 零改动证明（SAVE_VERSION 恒 2）、计数与池校验。
// inheritanceOf 三向/旧键缺省的引擎断言在 bloodline.test（本轮扩展 +2）。
import { describe, it, expect } from 'vitest'
import { createNewGame, SAVE_VERSION } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { LATE_EVENTS } from '../data/events/late'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function choiceIndex(state: GameState, event: GameEvent, text: string): number {
  const vis = visibleChoices(state, event)
  const i = event.choices.findIndex((c) => c.text === text && vis.includes(c))
  if (i === -1) throw new Error(`选项不可见: ${text}（可见 ${vis.length} 个）`)
  return i
}

const child = (id: string, closeness = 60): Relation => ({ id, kind: 'child', name: '小满', closeness, alive: true, birthAge: 25 })
const grandchild = (id: string, closeness = 55): Relation => ({ id, kind: 'grandchild', name: '豆豆', closeness, alive: true, birthAge: 50 })

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('资格串联门控（A1）', () => {
  it('无 will_done（未立遗嘱）：分配/心愿事件均不可达', () => {
    const s = makeGame(7, { age: 70, relations: [child('c1')] as Relation[] })
    expect(isEventAvailable(s, findEvent('late_will_split'))).toBe(false)
    expect(isEventAvailable(s, findEvent('late_final_wish'))).toBe(false)
  })
  it('will_done 无孩子：分配不可达（遗产分配需要孩子在册）；心愿在 73+ 可达', () => {
    const s = makeGame(7, { age: 70, tags: ['will_done'] })
    expect(isEventAvailable(s, findEvent('late_will_split'))).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 75, tags: ['will_done'] }), findEvent('late_final_wish'))).toBe(true)
  })
  it('will_done+孩子在册：分配可达；孙辈支仅在孙辈在册时可见（否则隐藏=回落资格）', () => {
    const noGc = makeGame(7, { age: 70, tags: ['will_done'], relations: [child('c1')] as Relation[] })
    const ev = findEvent('late_will_split')
    expect(isEventAvailable(noGc, ev)).toBe(true)
    expect(visibleChoices(noGc, ev)).toHaveLength(2)
    const withGc = makeGame(7, {
      age: 70,
      tags: ['will_done'],
      relations: [child('c1'), grandchild('g1')] as Relation[],
    })
    expect(visibleChoices(withGc, ev)).toHaveLength(3)
  })
})

describe('三向分配标记落账与 closeness 二向（A3）', () => {
  it('均分：will_mode_even+孩子 closeness+2', () => {
    const s = makeGame(7, { age: 70, tags: ['will_done'], relations: [child('c1')] as Relation[] })
    const after = choose(s, 'late_will_split', '一视同仁，均分')
    expect(after.tags).toContain('will_mode_even')
    expect(after.relations.find((r) => r.id === 'c1')?.closeness).toBe(62)
  })
  it('多帮衬：will_mode_weighted+孩子 closeness−1+幸福+1（手心手背二向）', () => {
    const s = makeGame(7, {
      age: 70,
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 30 },
      tags: ['will_done'],
      relations: [child('c1')] as Relation[],
    })
    const after = choose(s, 'late_will_split', '多帮衬眼下最难的那个')
    expect(after.tags).toContain('will_mode_weighted')
    expect(after.relations.find((r) => r.id === 'c1')?.closeness).toBe(59)
    expect(after.attrs.happiness).toBe(51)
  })
  it('孙辈支：will_mode_grandchild 落账（需孙辈在册）', () => {
    const s = makeGame(7, {
      age: 70,
      tags: ['will_done'],
      relations: [child('c1'), grandchild('g1')] as Relation[],
    })
    const after = choose(s, 'late_will_split', '给孙辈留一份，隔代的心意')
    expect(after.tags).toContain('will_mode_grandchild')
  })
})

describe('修改遗嘱与临终心愿（A1/A3）', () => {
  it('无任何 mode 标记：修改遗嘱不可达', () => {
    const s = makeGame(7, { age: 70, tags: ['will_done'] })
    expect(isEventAvailable(s, findEvent('late_will_amend'))).toBe(false)
  })
  it('weighted 局「改回均分」：even 落账+weighted/grandchild 移除', () => {
    const s = makeGame(7, { age: 70, tags: ['will_done', 'will_mode_weighted'] })
    const after = choose(s, 'late_will_amend', '改回均分，谁也不偏')
    expect(after.tags).toContain('will_mode_even')
    expect(after.tags).not.toContain('will_mode_weighted')
    expect(after.tags).not.toContain('will_mode_grandchild')
  })
  it('临终心愿两向：清单=幸福+2 能力+1；随缘=压力−2', () => {
    const base = makeGame(7, {
      age: 75,
      attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 40 },
      tags: ['will_done'],
    })
    const wish = choose(base, 'late_final_wish', '把心愿清单重新写一遍，能完成的都去完成')
    expect(wish.attrs.happiness).toBe(52)
    expect(wish.attrs.smarts).toBe(51)
    const calm = choose(base, 'late_final_wish', '都安排好了，剩下的随缘')
    expect(calm.attrs.stress).toBe(38)
  })
})

describe('存档 v2 零改动与计数（A4/A5）', () => {
  it('SAVE_VERSION 恒 2；late.ts 演进至 65（120 轮养老线 +4）；全池 327；validateEvents 零 issue', () => {
    expect(SAVE_VERSION).toBe(2)
    expect(LATE_EVENTS).toHaveLength(65)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const id of ['late_will_split', 'late_will_amend', 'late_final_wish'])
      expect(findEvent(id).category).toBe('life')
  })
})
