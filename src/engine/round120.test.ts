// 第 120 轮（V7）：养老方式线——怎么老去
// 覆盖：三向门控正反（随子女需 child/养老院需 20 万/once+tagsNone 防重）、
// 后续事件按 elder_* tag 分化（跨 tag 零泄漏）、**既有晚年事件可达性零变化**
// （elder tag 为纯增量层的核心断言）、存档与计数。
// 撞题差异化逐枚结论在关账账本（适老化改造/搭伴/返聘三线不重叠）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable, availableEvents } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { LATE_EVENTS } from '../data/events/late'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

const child = (): Relation => ({ id: 'c_x', kind: 'child', name: '小满', closeness: 60, alive: true, birthAge: 30 })

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

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('三向门控正反（A1）', () => {
  const how = findEvent('elder_how')
  it('随子女支：无孩子在册隐藏（可见 2=居家+养老院）；有孩子三支全见', () => {
    const noChild = makeGame(7, { age: 65, money: 300000 })
    expect(visibleChoices(noChild, how)).toHaveLength(2)
    const withChild = makeGame(7, { age: 65, money: 300000, relations: [child()] as Relation[] })
    expect(visibleChoices(withChild, how)).toHaveLength(3)
  })
  it('养老院支：积蓄 <20 万隐藏；≥20 万可见', () => {
    const poor = makeGame(7, { age: 65, money: 50000 })
    expect(visibleChoices(poor, how).some((c) => c.text.includes('养老院'))).toBe(false)
    const rich = makeGame(7, { age: 65, money: 300000 })
    expect(visibleChoices(rich, how).some((c) => c.text.includes('养老院'))).toBe(true)
  })
  it('once+tagsNone 防重：已定方式者不可再抉择', () => {
    const decided = makeGame(7, { age: 65, tags: ['elder_home'] })
    expect(isEventAvailable(decided, how)).toBe(false)
  })
})

describe('后续事件按 tag 分化（A2，跨 tag 零泄漏）', () => {
  it('elder_home：家里的小改动可达，养老院黄昏/一屋两代不可达', () => {
    const s = makeGame(7, { age: 70, tags: ['elder_home'] })
    expect(isEventAvailable(s, findEvent('elder_home_tweak'))).toBe(true)
    expect(isEventAvailable(s, findEvent('elder_institution_life'))).toBe(false)
    expect(isEventAvailable(s, findEvent('elder_two_gen'))).toBe(false)
  })
  it('elder_institution 与 elder_with_child 同理互斥', () => {
    const inst = makeGame(7, { age: 70, tags: ['elder_institution'] })
    expect(isEventAvailable(inst, findEvent('elder_institution_life'))).toBe(true)
    expect(isEventAvailable(inst, findEvent('elder_two_gen'))).toBe(false)
    const withChild = makeGame(7, { age: 70, tags: ['elder_with_child'] })
    expect(isEventAvailable(withChild, findEvent('elder_two_gen'))).toBe(true)
    expect(isEventAvailable(withChild, findEvent('elder_home_tweak'))).toBe(false)
  })
  it('后续事件效果落地：养老院「棋友局」幸福+2', () => {
    const s = makeGame(7, {
      age: 70,
      attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 30 },
      tags: ['elder_institution'],
    })
    const after = choose(s, 'elder_institution_life', '棋友局，杀三盘')
    expect(after.attrs.happiness).toBe(52)
  })
})

describe('既有晚年事件可达性零变化（A3，纯增量层核心断言）', () => {
  it('构造晚年局：设置三种方式 tag 前后，既有事件候选集恒等（新事件除外）', () => {
    for (const tag of ['elder_home', 'elder_with_child', 'elder_institution']) {
      const base = makeGame(7, {
        age: 68,
        money: 100000,
        tags: ['will_done'],
        relations: [child()] as Relation[],
      })
      const tagged = { ...base, tags: [...base.tags, tag] }
      const before = availableEvents(base, ALL_EVENTS).map((e) => e.id).filter((id) => !id.startsWith('elder_')).sort()
      const after = availableEvents(tagged, ALL_EVENTS).map((e) => e.id).filter((id) => !id.startsWith('elder_')).sort()
      expect(after).toEqual(before)
    }
  })
})

describe('计数与池校验（A4/G7）', () => {
  it('late.ts 61→65、全池 323→327、validateEvents 零 issue、once/cooldown 语义明确', () => {
    expect(LATE_EVENTS).toHaveLength(65)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of LATE_EVENTS.filter((x) => x.id.startsWith('elder_'))) {
      expect(e.category).toBe('life')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.once === true || typeof e.cooldown === 'number').toBe(true)
    }
  })
})
