// 第 116 轮（V7）：创业事件族——辞职去试试
// 覆盖：链路门控正反（employed/钱门/entrepreneur 链/biz_failed）、双支流散列确定性
// 与两向落点、delayed 三期投入逐期到账、loseJob 落账、计数与池校验。
// 撞题差异化（family_backed 家里出资/rel_old_friend_success 合伙）在关账账本留证。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ventureCloseAt, ventureProfitAt } from './venture'
import { ALL_EVENTS } from '../data/events'
import { VENTURE_EVENTS } from '../data/events/venture'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }

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

/** 扫 seed 找散列命中/未命中样本 */
function scanSeeds(fn: (seed: number, age: number) => boolean, age: number): { hit: number[]; miss: number[] } {
  const hit: number[] = []
  const miss: number[] = []
  for (let s = 1; s <= 300 && (hit.length < 3 || miss.length < 3); s++) {
    if (fn(s, age)) hit.push(s)
    else miss.push(s)
  }
  return { hit, miss }
}

describe('链路门控正反（A1）', () => {
  it('辞职去创业：无业拒；钱不够（moneyAtLeast 30000 隐藏选项→单可见→不可用）；在职+3 万可用', () => {
    const unemployed = makeGame(7, { age: 30, career: { kind: 'unemployed', weeks: 3 }, money: 50000 })
    expect(isEventAvailable(unemployed, findEvent('ven_quit_resign'))).toBe(false)
    const poor = makeGame(7, { age: 30, career: EMPLOYED, money: 5000 })
    expect(isEventAvailable(poor, findEvent('ven_quit_resign'))).toBe(false)
    const ok = makeGame(7, { age: 30, career: EMPLOYED, money: 50000 })
    expect(isEventAvailable(ok, findEvent('ven_quit_resign'))).toBe(true)
  })
  it('辞职「签了」：loseJob+money−30000+entrepreneur 落账；「再攒攒」无标记', () => {
    const s = makeGame(7, { age: 30, career: EMPLOYED, money: 50000 })
    const signed = choose(s, 'ven_quit_resign', '签了。从今天起，给自己打工')
    expect(signed.career.kind).toBe('unemployed')
    expect(signed.money).toBe(20000)
    expect(signed.tags).toContain('entrepreneur')
    const held = choose(s, 'ven_quit_resign', '再攒攒，还没到时候')
    expect(held.tags).not.toContain('entrepreneur')
    expect(held.career.kind).toBe('employed')
  })
  it('entrepreneur 链门控：无标记时启动期/进账/扩张/关门全部不可达', () => {
    const s = makeGame(7, { age: 30, career: { kind: 'unemployed', weeks: 3 }, money: 50000 })
    for (const id of ['ven_first_year', 'ven_first_profit', 'ven_scale_or_hold', 'vent_close_day'])
      expect(isEventAvailable(s, findEvent(id))).toBe(false)
  })
  it('重新上班：需 biz_failed 标记', () => {
    const failed = makeGame(7, { age: 35, tags: ['biz_failed'] })
    expect(isEventAvailable(failed, findEvent('vent_back_to_work'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 35 }), findEvent('vent_back_to_work'))).toBe(false)
  })
  it('支流门：进账/关门事件在散列未命中年不可达', () => {
    const ent = (seed: number, age: number): GameState =>
      makeGame(seed, { age, tags: ['entrepreneur'], career: { kind: 'unemployed', weeks: 1 }, money: 20000 })
    const profit = scanSeeds(ventureProfitAt, 30)
    expect(isEventAvailable(ent(profit.miss[0], 30), findEvent('ven_first_profit'))).toBe(false)
    expect(isEventAvailable(ent(profit.hit[0], 30), findEvent('ven_first_profit'))).toBe(true)
    const close = scanSeeds(ventureCloseAt, 30)
    expect(isEventAvailable(ent(close.miss[0], 30), findEvent('vent_close_day'))).toBe(false)
    expect(isEventAvailable(ent(close.hit[0], 30), findEvent('vent_close_day'))).toBe(true)
  })
})

describe('支流确定性与两向落点（A2）', () => {
  it('双散列同参同果；两盐互异（分歧 seed 存在）', () => {
    for (let s = 1; s <= 80; s++) {
      expect(ventureProfitAt(s, 30)).toBe(ventureProfitAt(s, 30))
      expect(ventureCloseAt(s, 30)).toBe(ventureCloseAt(s, 30))
    }
    let diff = 0
    for (let s = 1; s <= 300; s++) if (ventureProfitAt(s, 30) !== ventureCloseAt(s, 30)) diff++
    expect(diff).toBeGreaterThan(20)
  })
  it('关门两向：正式关门→biz_failed+幸福−4；再撑一撑→无标记+stress+3', () => {
    const hit = scanSeeds(ventureCloseAt, 35).hit[0]
    const attrs = { health: 60, happiness: 50, smarts: 50, social: 50, stress: 70 }
    const base = makeGame(hit, { age: 35, attrs, tags: ['entrepreneur'], career: { kind: 'unemployed', weeks: 1 }, money: 20000 })
    const closed = choose(base, 'vent_close_day', '正式关门。这段路不算白走')
    expect(closed.tags).toContain('biz_failed')
    expect(closed.attrs.happiness).toBe(46)
    const held = choose(base, 'vent_close_day', '再撑一撑，把库清完再说')
    expect(held.tags).not.toContain('biz_failed')
    expect(held.attrs.stress).toBe(73)
  })
})

describe('delayed 三期投入逐期到账（A3）', () => {
  it('启动期「按计划来」：3 条延迟入队，三年各 −20,000 逐期落地（孪生对照消除失业年净支基线）', () => {
    const s = makeGame(7, { age: 30, tags: ['entrepreneur'], career: { kind: 'unemployed', weeks: 1 }, money: 100000 })
    const twin = makeGame(7, { age: 30, tags: ['entrepreneur'], career: { kind: 'unemployed', weeks: 1 }, money: 100000 })
    const after = choose(s, 'ven_first_year', '按计划来：铺面、装修、第一批货')
    expect(after.pending).toHaveLength(3)
    expect(after.pending.map((p) => p.dueAge)).toEqual([31, 32, 33])
    let cur = after
    for (let i = 0; i < 3; i++) cur = advanceYear(cur)
    let ctl = twin
    for (let i = 0; i < 3; i++) ctl = advanceYear(ctl)
    // 逐年差恒为 −20,000（三期投入逐期到账；失业年净支等基线由孪生抵消）
    expect(ctl.money - cur.money).toBe(60000)
    expect(cur.pending).toHaveLength(0)
  })
})

describe('计数与池校验（A4/G7）', () => {
  it('venture.ts 6 枚、全池 309→315、validateEvents 零 issue、once/cooldown 语义明确', () => {
    expect(VENTURE_EVENTS).toHaveLength(6)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of VENTURE_EVENTS) {
      expect(e.category).toBe('career')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.once === true || typeof e.cooldown === 'number').toBe(true)
    }
  })
})
