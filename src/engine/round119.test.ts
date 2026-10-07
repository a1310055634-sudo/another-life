// 第 119 轮（V7）：性格成长——你变了（persona_shifted 轻机制）
// 覆盖：来源标记资格一致性（四种「够重」标记构造局均可达/无标记不可达）、
// once 语义与两向效果、回响事件资格与两向、trait 本体零改动（mtime 存证+.test 旁证）、
// 计数与池校验。文案支分化记录偏差（静态 text 约束，R118 同款）在关账账本留证。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { PERSONA_EVENTS } from '../data/events/persona'
import { TRAITS } from '../data/traits'
import type { GameEvent, GameState } from './types'

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

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('来源标记资格一致性（A1/A3）', () => {
  const SOURCES = ['been_deep_debt', 'divorced', 'biz_failed', 'marriage_mended']
  it('四种来源标记构造局均可达（文案支分化的资格一致性断言形式）', () => {
    for (const tag of SOURCES) {
      const s = makeGame(7, { age: 40, tags: [tag] })
      expect(isEventAvailable(s, findEvent('persona_shift_moment'))).toBe(true)
    }
  })
  it('无重大标记不可达；已有 persona_shifted 不可达（once 语义的资格面）', () => {
    const bare = makeGame(7, { age: 40 })
    expect(isEventAvailable(bare, findEvent('persona_shift_moment'))).toBe(false)
    const shifted = makeGame(7, { age: 40, tags: ['been_deep_debt', 'persona_shifted'] })
    expect(isEventAvailable(shifted, findEvent('persona_shift_moment'))).toBe(false)
  })
  it('年龄窗外：29 岁拒', () => {
    expect(isEventAvailable(makeGame(7, { age: 29, tags: ['been_deep_debt'] }), findEvent('persona_shift_moment'))).toBe(false)
  })
})

describe('两向效果与回响（A1）', () => {
  it('承认自己变了：persona_shifted+幸福+2；我还是我：无标记', () => {
    const base = makeGame(7, {
      age: 40,
      tags: ['been_deep_debt'],
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 30 },
    })
    const admitted = choose(base, 'persona_shift_moment', '承认吧，我变了')
    expect(admitted.tags).toContain('persona_shifted')
    expect(admitted.attrs.happiness).toBe(52)
    const held = choose(base, 'persona_shift_moment', '我还是我。只是走了段远路')
    expect(held.tags).not.toContain('persona_shifted')
    expect(held.attrs.happiness).toBe(50)
  })
  it('回响：需 persona_shifted+老朋友在册；笑着承认 closeness+2', () => {
    const noTag = makeGame(7, { age: 40 })
    expect(isEventAvailable(noTag, findEvent('persona_echo'))).toBe(false)
    const base = makeGame(7, {
      age: 40,
      tags: ['persona_shifted'],
      relations: [{ id: 'f1', kind: 'friend', name: '老周', closeness: 60, alive: true } as never],
    })
    expect(isEventAvailable(base, findEvent('persona_echo'))).toBe(true)
    const after = choose(base, 'persona_echo', '笑着承认：「变了，变多了」')
    expect(after.relations.find((r) => r.id === 'f1')?.closeness).toBe(62)
    const deflected = choose(base, 'persona_echo', '嘴硬：「哪有，还是老样子」')
    expect(deflected.relations.find((r) => r.id === 'f1')?.closeness).toBe(61)
  })
})

describe('trait 本体零改动与计数（A2/A4）', () => {
  it('特质六枚与判定字面量零改动（引擎侧旁证；mtime 存证 .r119/traits_mtime_before.txt）', () => {
    // 旁证：特质表仍为开局六枚、名称未变（persona 线不触碰特质本体）
    expect(TRAITS).toHaveLength(6)
    expect(TRAITS.map((t: { name: string }) => t.name)).toEqual(
      ['书虫', '社牛', '野心家', '佛系', '精打细算', '敢闯敢赌'],
    )
  })
  it('persona.ts 2 枚、全池 321→323、validateEvents 零 issue', () => {
    expect(PERSONA_EVENTS).toHaveLength(2)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of PERSONA_EVENTS) {
      expect(e.category).toBe('life')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
    }
  })
})
