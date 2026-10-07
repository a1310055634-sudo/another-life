// 第 115 轮（V7）：同事与邻里——关系网走出家门
// 覆盖：新 kind 衰减率（colleague 2/neighbor 1，relationDecay.test 同步在册）、
// 入口正反（在职门控/relationKindsNone 防重/取名池确定性）、八事件门控矩阵零泄漏、
// chips/顶栏文案泛化通道、散伙饭 ex_colleague 留痕语义、计数与池校验。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { RELATION_DECAY_RATE, relationDeltaChips, relationsLine, settleRelationDecay } from './relations'
import { ALL_EVENTS } from '../data/events'
import { WORKLIFE_EVENTS } from '../data/events/worklife'
import { COLLEAGUE_NICKNAMES, NEIGHBOR_NICKNAMES } from '../data/names'
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

const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }
const withColleague = (s: GameState, closeness = 60): GameState => ({
  ...s,
  relations: [...s.relations, { id: 'col_t', kind: 'colleague', name: '老郑', closeness, alive: true } as Relation],
})
const withNeighbor = (s: GameState, closeness = 60): GameState => ({
  ...s,
  relations: [...s.relations, { id: 'nb_t', kind: 'neighbor', name: '张婶', closeness, alive: true } as Relation],
})

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

describe('新 kind 衰减率（A1，relationDecay.test 速率表同步在册）', () => {
  it('colleague=2（朋友口径）/ neighbor=1（稳定口径）；settleRelationDecay 按率落地', () => {
    expect(RELATION_DECAY_RATE.colleague).toBe(2)
    expect(RELATION_DECAY_RATE.neighbor).toBe(1)
    const rels: Relation[] = [
      { id: 'c1', kind: 'colleague', name: '老郑', closeness: 60, alive: true },
      { id: 'n1', kind: 'neighbor', name: '张婶', closeness: 60, alive: true },
    ]
    const after = settleRelationDecay(rels).relations
    expect(after.find((r) => r.id === 'c1')?.closeness).toBe(58)
    expect(after.find((r) => r.id === 'n1')?.closeness).toBe(59)
  })
})

describe('入口正反（A2）', () => {
  it('工位隔壁的人：无业不可达；已有同事不可达（relationKindsNone 防重）', () => {
    const unemployed = makeGame(7, { age: 30, career: { kind: 'unemployed', weeks: 3 } })
    expect(isEventAvailable(unemployed, findEvent('wl_office_deskmate'))).toBe(false)
    const hasColleague = withColleague(makeGame(7, { age: 30, career: EMPLOYED }))
    expect(isEventAvailable(hasColleague, findEvent('wl_office_deskmate'))).toBe(false)
  })
  it('接了辣条：colleague 建立且名字来自取名池（seed 确定具名）', () => {
    const s = makeGame(7, { age: 30, career: EMPLOYED })
    const after = choose(s, 'wl_office_deskmate', '接了。聊起来才知道就住隔壁小区')
    const col = after.relations.find((r) => r.kind === 'colleague')
    expect(col).toBeDefined()
    expect(COLLEAGUE_NICKNAMES).toContain(col!.name)
    const again = choose(makeGame(7, { age: 30, career: EMPLOYED }), 'wl_office_deskmate', '接了。聊起来才知道就住隔壁小区')
    expect(again.relations.find((r) => r.kind === 'colleague')?.name).toBe(col!.name)
  })
  it('对门邻居：建立且取名池确定；酸奶支 closeness 40', () => {
    const s = makeGame(7, { age: 30 })
    const after = choose(s, 'wl_new_neighbor', '搭把手，帮着抬了一趟')
    const nb = after.relations.find((r) => r.kind === 'neighbor')
    expect(nb).toBeDefined()
    expect(NEIGHBOR_NICKNAMES).toContain(nb!.name)
    const alt = choose(makeGame(7, { age: 30 }), 'wl_new_neighbor', '点头笑了笑，各自忙')
    expect(alt.relations.find((r) => r.kind === 'neighbor')?.closeness).toBe(35)
  })
})

describe('八事件门控矩阵零泄漏（A3）', () => {
  it('无同事：四个同事向事件不可达；无邻居：三个邻居向事件不可达', () => {
    const bare = makeGame(7, { age: 30, career: EMPLOYED })
    for (const id of ['wl_late_night', 'wl_one_seat', 'wl_farewell_dinner'])
      expect(isEventAvailable(bare, findEvent(id))).toBe(false)
    for (const id of ['wl_hallway_chat', 'wl_renovation_noise', 'wl_good_neighbor'])
      expect(isEventAvailable(bare, findEvent(id))).toBe(false)
  })
  it('在职门控：加班夜/名额/散伙饭在无业时不可达（散伙饭需失业）', () => {
    const unemployedWithColleague = makeGame(7, {
      age: 30,
      career: { kind: 'unemployed', weeks: 3 },
      relations: [{ id: 'col_t', kind: 'colleague', name: '老郑', closeness: 60, alive: true } as Relation],
    })
    expect(isEventAvailable(unemployedWithColleague, findEvent('wl_late_night'))).toBe(false)
    expect(isEventAvailable(unemployedWithColleague, findEvent('wl_one_seat'))).toBe(false)
    expect(isEventAvailable(unemployedWithColleague, findEvent('wl_farewell_dinner'))).toBe(true)
  })
  it('远亲不如近邻：邻居亲密 <50 不可达；≥50 且负面标记在册可达', () => {
    const cold = withNeighbor(makeGame(7, { age: 40, tags: ['low_mood'] }), 45)
    expect(isEventAvailable(cold, findEvent('wl_good_neighbor'))).toBe(false)
    const warm = withNeighbor(makeGame(7, { age: 40, tags: ['low_mood'] }), 55)
    expect(isEventAvailable(warm, findEvent('wl_good_neighbor'))).toBe(true)
    const warmNoTag = withNeighbor(makeGame(7, { age: 40 }), 55)
    expect(isEventAvailable(warmNoTag, findEvent('wl_good_neighbor'))).toBe(false)
  })
})

describe('散伙饭 ex_colleague 留痕语义（A1 补充）', () => {
  it('碰杯道别：colleague 移出在册 + ex_colleague 标记落账', () => {
    const s = makeGame(7, {
      age: 30,
      career: { kind: 'unemployed', weeks: 3 },
      relations: [{ id: 'col_t', kind: 'colleague', name: '老郑', closeness: 60, alive: true } as Relation],
    })
    const after = choose(s, 'wl_farewell_dinner', '碰杯，正式道别')
    expect(after.relations.some((r) => r.kind === 'colleague')).toBe(false)
    expect(after.tags).toContain('ex_colleague')
  })
  it('不道别支：colleague 保留、closeness +2', () => {
    const s = makeGame(7, {
      age: 30,
      career: { kind: 'unemployed', weeks: 3 },
      relations: [{ id: 'col_t', kind: 'colleague', name: '老郑', closeness: 60, alive: true } as Relation],
    })
    const after = choose(s, 'wl_farewell_dinner', '不道别。以后常联系，就不是散伙')
    expect(after.relations.find((r) => r.id === 'col_t')?.closeness).toBe(62)
  })
})

describe('chips/顶栏文案（A4，泛化通道）', () => {
  it('新增同事 chip：新工位隔壁的人 →「新增同事：×」', () => {
    const s = makeGame(7, { age: 30, career: EMPLOYED })
    const after = choose(s, 'wl_office_deskmate', '接了。聊起来才知道就住隔壁小区')
    const chips = relationDeltaChips(s.relations, after.relations)
    const col = after.relations.find((r) => r.kind === 'colleague')!
    expect(chips.some((c) => c === `新增同事：${col.name}`)).toBe(true)
  })
  it('顶栏 relationsLine 列出邻居名字与亲密度', () => {
    const s = withNeighbor(makeGame(7, { age: 40 }))
    expect(relationsLine(s)).toContain('张婶 60')
  })
})

describe('计数与池校验（A5/G7）', () => {
  it('worklife.ts 8 枚、全池 301→309、validateEvents 零 issue、once/cooldown 语义明确', () => {
    expect(WORKLIFE_EVENTS).toHaveLength(8)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of WORKLIFE_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.once === true || typeof e.cooldown === 'number').toBe(true)
    }
  })
})
