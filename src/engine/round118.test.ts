// 第 118 轮（V7）：年关系统——离乡者的年关抉择层
// 覆盖：三重人群切割门控（cityIn/未婚/年龄窗——youth 18-30 与 marriage 已婚两事件
// 均不覆盖的段）、回家/留城二向效果与标记落账、亲戚提问资格门、留城年夜饭的
// R115 colleague 联动（无同事隐藏）、计数与池校验。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { NEWYEAR_EVENTS } from '../data/events/newyear'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }
const colleague = (): Relation => ({ id: 'col_x', kind: 'colleague', name: '老郑', closeness: 60, alive: true })

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

describe('三重人群切割门控（A1）', () => {
  it('老家（hometown）不可达：年关线只对离乡者开放', () => {
    const home = makeGame(7, { age: 35, city: 'hometown', career: EMPLOYED })
    expect(isEventAvailable(home, findEvent('ny_where'))).toBe(false)
  })
  it('已婚离乡不可达（mar_new_year_side 辖区）；未婚离乡 31 岁可用', () => {
    const married = makeGame(7, { age: 35, city: 'metro', tags: ['married'], career: EMPLOYED })
    expect(isEventAvailable(married, findEvent('ny_where'))).toBe(false)
    const single = makeGame(7, { age: 31, city: 'metro', career: EMPLOYED })
    expect(isEventAvailable(single, findEvent('ny_where'))).toBe(true)
  })
  it('年龄窗外：30 岁（youth 辖区）拒；59 岁拒', () => {
    expect(isEventAvailable(makeGame(7, { age: 30, city: 'metro', career: EMPLOYED }), findEvent('ny_where'))).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 59, city: 'metro' }), findEvent('ny_where'))).toBe(false)
  })
  it('亲戚提问需 home_for_ny；留成年夜饭需 ny_stay_town', () => {
    expect(isEventAvailable(makeGame(7, { age: 35 }), findEvent('ny_questions'))).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 35, tags: ['home_for_ny'] }), findEvent('ny_questions'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 35 }), findEvent('ny_stay_dinner'))).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 35, tags: ['ny_stay_town'] }), findEvent('ny_stay_dinner'))).toBe(true)
  })
})

describe('回家/留城二向与标记落账（A2）', () => {
  it('回家：−1,500/stress−2/parent+2/home_for_ny 落账', () => {
    const s = makeGame(7, { age: 35, city: 'metro', career: EMPLOYED, money: 20000 })
    const after = choose(s, 'ny_where', '回家。票再难抢也要回')
    expect(after.money).toBe(18500)
    expect(after.attrs.stress).toBeLessThan(s.attrs.stress)
    expect(after.tags).toContain('home_for_ny')
    const p = after.relations.find((r) => r.kind === 'parent' && r.alive)
    if (p) expect(p.closeness).toBeGreaterThan(s.relations.find((r) => r.kind === 'parent' && r.alive)!.closeness)
  })
  it('留城：+2,000/幸福−3/ny_stay_town 落账', () => {
    const s = makeGame(7, {
      age: 35,
      city: 'metro',
      career: EMPLOYED,
      money: 20000,
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
    })
    const after = choose(s, 'ny_where', '留在城市，把路费变成加班费')
    expect(after.money).toBe(22000)
    expect(after.attrs.happiness).toBe(47)
    expect(after.tags).toContain('ny_stay_town')
  })
  it('亲戚提问两向：打太极 stress+1；实话说 幸福−1 压力−2', () => {
    const base = makeGame(7, {
      age: 35,
      tags: ['home_for_ny'],
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 40 },
    })
    const dodge = choose(base, 'ny_questions', '打太极，「还行还行，吃菜吃菜」')
    expect(dodge.attrs.stress).toBe(41)
    const truth = choose(base, 'ny_questions', '实话实说，一句是一句')
    expect(truth.attrs.happiness).toBe(49)
    expect(truth.attrs.stress).toBe(38)
  })
})

describe('留成年夜饭与 colleague 联动（A3）', () => {
  it('无同事：被邀请支隐藏（仅一人食 1 可见）', () => {
    const s = makeGame(7, { age: 35, tags: ['ny_stay_town'] })
    expect(visibleChoices(s, findEvent('ny_stay_dinner'))).toHaveLength(2)
  })
  it('有同事：两支可见；被邀请支 happiness+2+colleague closeness+2', () => {
    const s = makeGame(7, { age: 35, tags: ['ny_stay_town'], relations: [colleague()] as Relation[] })
    const ev = findEvent('ny_stay_dinner')
    expect(visibleChoices(s, ev)).toHaveLength(3)
    const after = choose(s, 'ny_stay_dinner', '同事喊了一起了年')
    expect(after.attrs.happiness).toBeGreaterThanOrEqual(s.attrs.happiness)
    expect(after.relations.find((r) => r.id === 'col_x')?.closeness).toBe(62)
  })
})

describe('计数与池校验（A4/G7）', () => {
  it('newyear.ts 3 枚、全池 318→321、validateEvents 零 issue、cd3 语义明确', () => {
    expect(NEWYEAR_EVENTS).toHaveLength(3)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of NEWYEAR_EVENTS) {
      expect(e.category).toBe('life')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.cooldown).toBe(3)
    }
  })
})
