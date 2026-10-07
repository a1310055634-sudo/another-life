// 第 113 轮（V7）：心理健康线——low_mood 状态的授予与走出
// 覆盖：授予门正反（幸福/压力双门+tagsNone 防重）、三出口效果与摘除、
// 天晴边界（happiness 55）、cooldown 落账（复发通道）、计数与池校验。
// 红线自查（禁词零命中）在关账账本留证（grep 证据），不入断言。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { MENTAL_EVENTS } from '../data/events/mental'
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

const LOW_ATTRS = { health: 60, happiness: 30, smarts: 50, social: 50, stress: 70 }
const OK_ATTRS = { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 }

const withFriend = (s: GameState): GameState => ({
  ...s,
  relations: [
    ...s.relations,
    { id: 'f_test', kind: 'friend', name: '老周', closeness: 60, alive: true } as Relation,
  ],
})

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('授予门正反（A1）', () => {
  const grant = findEvent('mood_low_tide')

  it('幸福 >35 不可用（不够低）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS, happiness: 40 } })
    expect(isEventAvailable(s, grant)).toBe(false)
  })
  it('压力 <65 不可用（不够紧）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS, stress: 60 } })
    expect(isEventAvailable(s, grant)).toBe(false)
  })
  it('已有 low_mood 不可用（tagsNone 防重复授予）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS }, tags: ['low_mood'] })
    expect(isEventAvailable(s, grant)).toBe(false)
  })
  it('双门过可用：选「就让它沉着」→ 标记落账；选「撑一撑」→ stress+1 且无标记', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS } })
    expect(isEventAvailable(s, grant)).toBe(true)
    const sunk = choose(s, 'mood_low_tide', '就让它沉着。不想解释，也不想好起来')
    expect(sunk.tags).toContain('low_mood')
    const held = choose(s, 'mood_low_tide', '撑一撑，先把今天过完')
    expect(held.tags).not.toContain('low_mood')
    expect(held.attrs.stress).toBe(71)
  })
  it('cooldown 由选择落账（age+3，摘除后 3 年内不再来=复发通道防刷）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS } })
    const after = choose(s, 'mood_low_tide', '撑一撑，先把今天过完')
    expect(after.cooldowns['mood_low_tide']).toBe(33)
  })
})

describe('三出口效果与摘除（A2）', () => {
  it('无 low_mood 标记：三出口事件全部不可用', () => {
    const s = makeGame(7, { age: 30, attrs: { ...OK_ATTRS } })
    for (const id of ['mood_self_care', 'mood_talk', 'mood_professional'])
      expect(isEventAvailable(s, findEvent(id))).toBe(false)
  })
  it('mood_talk 需要活关系在册：无 friend/partner/spouse 不可达', () => {
    const lonely = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS }, tags: ['low_mood'], relations: [] })
    expect(isEventAvailable(lonely, findEvent('mood_talk'))).toBe(false)
    const befriended = withFriend(lonely)
    expect(isEventAvailable(befriended, findEvent('mood_talk'))).toBe(true)
  })
  it('倾诉「说了」：happiness+3 且摘除标记', () => {
    const s = withFriend(makeGame(7, { age: 30, attrs: { ...LOW_ATTRS }, tags: ['low_mood'] }))
    const after = choose(s, 'mood_talk', '说了。把最近的状态，原原本本说了')
    expect(after.attrs.happiness).toBe(33)
    expect(after.tags).not.toContain('low_mood')
  })
  it('求助「打了」：money−800、happiness+4 且摘除标记（小额<大额隐藏线，负债年也可见）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS }, tags: ['low_mood'], money: 0 })
    const ev = findEvent('mood_professional')
    expect(visibleChoices(s, ev).length).toBe(2)
    const after = choose(s, 'mood_professional', '打了。约了第一次咨询')
    expect(after.money).toBe(-800)
    expect(after.attrs.happiness).toBe(34)
    expect(after.tags).not.toContain('low_mood')
  })
  it('自我调节「收拾屋子」：happiness+2 且标记保留（慢路不摘）', () => {
    const s = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS }, tags: ['low_mood'] })
    const after = choose(s, 'mood_self_care', '收拾屋子，睡一个长觉')
    expect(after.attrs.happiness).toBe(32)
    expect(after.tags).toContain('low_mood')
  })
})

describe('天晴边界（A3）', () => {
  it('happiness 54 不可用；55 可用；选「缓过来了」摘除标记', () => {
    const s54 = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS, happiness: 54 }, tags: ['low_mood'] })
    const s55 = makeGame(7, { age: 30, attrs: { ...LOW_ATTRS, happiness: 55 }, tags: ['low_mood'] })
    const sky = findEvent('mood_clear_sky')
    expect(isEventAvailable(s54, sky)).toBe(false)
    expect(isEventAvailable(s55, sky)).toBe(true)
    const after = choose(s55, 'mood_clear_sky', '……好像缓过来了')
    expect(after.tags).not.toContain('low_mood')
  })
})

describe('计数与池校验（A5/G7）', () => {
  it('mental.ts 5 枚、全池 292→297、category 合规、≥2 选项、validateEvents 零 issue', () => {
    expect(MENTAL_EVENTS).toHaveLength(5)
    expect(ALL_EVENTS).toHaveLength(349)
    for (const e of MENTAL_EVENTS) {
      expect(e.category).toBe('life')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.maxAge).toBe(70)
    }
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
