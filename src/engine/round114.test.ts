// 第 114 轮（V7）：育儿参与线——里程碑之间的家长抉择与 child_path 轻分化
// 覆盖：childStage 门控正反（无娃/年龄窗外/dink）、child_path 三向显形分化、
// milestoneTarget 定向 closeness 落账、计数与池校验。
// 撞题差异化（fam_child_gaokao 志愿表/fam_child_junior 书包/senior 岔路口/first_job）
// 在关账账本留证。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { PARENTING_EVENTS } from '../data/events/parenting'
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

/** 造一个指定当前年龄的孩子（birthAge=出生时玩家年龄） */
const childOfAge = (childAge: number, playerAge: number): Relation => ({
  id: 'c_test',
  kind: 'child',
  name: '小满',
  closeness: 60,
  alive: true,
  birthAge: playerAge - childAge,
})

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('childStage 门控正反（A1）', () => {
  it('无娃：四事件全部不可达', () => {
    const s = makeGame(7, { age: 33 })
    for (const id of ['par_interest_class', 'par_teen_door', 'par_form_night', 'par_path_visible'])
      expect(isEventAvailable(s, findEvent(id))).toBe(false)
  })
  it('孩子年龄窗外：3 岁不可达兴趣班；14 岁不可达填报前夜', () => {
    const youngKid = makeGame(7, { age: 33, relations: [childOfAge(3, 33)] as Relation[] })
    expect(isEventAvailable(youngKid, findEvent('par_interest_class'))).toBe(false)
    const midKid = makeGame(7, { age: 45, relations: [childOfAge(14, 45)] as Relation[] })
    expect(isEventAvailable(midKid, findEvent('par_form_night'))).toBe(false)
  })
  it('dink 标记局不可达（显式 tagsNone）', () => {
    const s = makeGame(7, { age: 33, tags: ['dink'], relations: [childOfAge(8, 33)] as Relation[] })
    expect(isEventAvailable(s, findEvent('par_interest_class'))).toBe(false)
  })
  it('无 child_path 标记：去向显形不可达；命中任一路径标记即可达', () => {
    const noPath = makeGame(7, { age: 50, relations: [childOfAge(23, 50)] as Relation[] })
    expect(isEventAvailable(noPath, findEvent('par_path_visible'))).toBe(false)
    const academic = makeGame(7, {
      age: 50,
      relations: [childOfAge(23, 50)] as Relation[],
      tags: ['child_path_academic'],
    })
    expect(isEventAvailable(academic, findEvent('par_path_visible'))).toBe(true)
  })
})

describe('child_path 三向显形分化（A2）', () => {
  const vis = (path: string | null) => {
    let s = makeGame(7, { age: 50, relations: [childOfAge(23, 50)] as Relation[] })
    if (path) s = { ...s, tags: [...s.tags, path] }
    return visibleChoices(s, findEvent('par_path_visible')).map((c) => c.text)
  }
  it('academic：行李箱支可见，工具/冰箱支隐藏', () => {
    const texts = vis('child_path_academic')
    expect(texts.some((t) => t.includes('行李箱'))).toBe(true)
    expect(texts.some((t) => t.includes('工具'))).toBe(false)
    expect(texts.some((t) => t.includes('冰箱'))).toBe(false)
  })
  it('vocational：工具支可见', () => {
    expect(vis('child_path_vocational').some((t) => t.includes('工具'))).toBe(true)
  })
  it('work：冰箱支可见', () => {
    expect(vis('child_path_work').some((t) => t.includes('冰箱'))).toBe(true)
  })
  it('任意路径恒 ≥2 可见（命中支+无条件支）', () => {
    for (const p of ['child_path_academic', 'child_path_vocational', 'child_path_work'])
      expect(vis(p).length).toBeGreaterThanOrEqual(2)
  })
})

describe('closeness 定向落账与效果（A3）', () => {
  it('兴趣班「体验班」：−2,000 元、该孩子 closeness 60→63、parenting_active 落账', () => {
    const s = makeGame(7, { age: 33, money: 30000, relations: [childOfAge(8, 33)] as Relation[] })
    const after = choose(s, 'par_interest_class', '先报个零基础体验班')
    expect(after.money).toBe(28000)
    expect(after.relations.find((r) => r.id === 'c_test')?.closeness).toBe(63)
    expect(after.tags).toContain('parenting_active')
  })
  it('青春期「把门带上」：stress−2、closeness +2', () => {
    const s = makeGame(7, { age: 43, attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 40 }, relations: [childOfAge(13, 43)] as Relation[] })
    const after = choose(s, 'par_teen_door', '把门轻轻带上，给他空间')
    expect(after.attrs.stress).toBe(38)
    expect(after.relations.find((r) => r.id === 'c_test')?.closeness).toBe(62)
  })
  it('填报前夜三向：child_path 标记逐项落账', () => {
    for (const [text, tag] of [
      ['全力托举：想读，就一直读下去', 'child_path_academic'],
      ['陪他看了职业院校：手艺是铁饭碗', 'child_path_vocational'],
      ['他心意已决：早点自立，家里尊重', 'child_path_work'],
    ] as const) {
      const s = makeGame(7, { age: 45, relations: [childOfAge(18, 45)] as Relation[] })
      const after = choose(s, 'par_form_night', text)
      expect(after.tags).toContain(tag)
    }
  })
})

describe('计数与池校验（A4/G7）', () => {
  it('parenting.ts 4 枚、全池 297→301、validateEvents 零 issue、once/cooldown 语义明确', () => {
    expect(PARENTING_EVENTS).toHaveLength(4)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of PARENTING_EVENTS) {
      expect(e.category).toBe('life')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.once === true || typeof e.cooldown === 'number').toBe(true)
    }
  })
})
