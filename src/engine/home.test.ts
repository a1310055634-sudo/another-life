// 第 86 轮：房产系统 I 测试（现值复利 + 买卖效果 + 既有购房事件盖章）
// 验收口径（PROMPT-V5.md 第 86 轮）：
// - A1 value 复利单测（逐年 +2% 取整百、无 rng 确定性、非法值安全）
// - A2 卖出净额=现值−房贷余额（含余额大于现值的负值局）
// - A3 home 字段 validate 三态+旧档兼容；盖章/卖出效果落地；错误状态从不入候选
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { HOME_EVENTS } from '../data/events/home'
import { appreciateHome, sellNetProceeds, HOME_APPRECIATION } from './home'
import type { GameEvent, GameState, HomeProperty } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}
const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}
const home40w = (purchasedAtAge = 28): HomeProperty => ({ basis: 400000, value: 400000, purchasedAtAge })
const mortgageLeft = (balance: number): GameState['mortgage'] => ({
  principal: 300000, balance, annualPayment: 23900, yearsLeft: 18,
})

describe('第 86 轮：现值复利（A1）', () => {
  it('增值率基准 2%（省城档）冻结；缺省 hometown 1.2% 逐年取整百；纯函数无 rng 确定性', () => {
    expect(HOME_APPRECIATION).toBe(0.02) // 省城档基准（第 90 轮起按城市分档）
    expect(appreciateHome({ basis: 400000, value: 400000, purchasedAtAge: 28 })).toEqual({
      basis: 400000, value: 404800, purchasedAtAge: 28,
    })
    expect(appreciateHome({ basis: 250000, value: 326400, purchasedAtAge: 30 })?.value).toBe(330300)
    expect(appreciateHome({ basis: 400000, value: 400000, purchasedAtAge: 28 }, 'metro')?.value).toBe(412000)
    expect(appreciateHome({ basis: 400000, value: 400000, purchasedAtAge: 28 }, 'province')?.value).toBe(408000)
    // 同输入同输出（确定性），不消耗任何 rng
    const h = home40w()
    expect(appreciateHome(h)).toEqual(appreciateHome(h))
  })
  it('无房 no-op；非法现值原样保留不增值', () => {
    expect(appreciateHome(undefined)).toBeUndefined()
    expect(appreciateHome({ basis: 100000, value: NaN, purchasedAtAge: 28 })?.value).toBeNaN()
    expect(appreciateHome({ basis: 100000, value: -5, purchasedAtAge: 28 })?.value).toBe(-5)
  })
  it('advanceYear 集成：有房局现值年增、现金口径逐位不变；无房局字段保持缺省', () => {
    const owner = advanceYear(makeGame(7, { age: 40, home: home40w(18) }))
    expect(owner.home?.value).toBe(404800) // 缺省 hometown 1.2%
    const bare = advanceYear(makeGame(7, { age: 40 }))
    expect(bare.home).toBeUndefined()
    expect(owner.money).toBe(bare.money) // 复利只动 home.value——现金口径与无房局逐位一致
  })
})

describe('第 86 轮：卖出净额（A2）', () => {
  it('净额=现值−房贷余额；无贷=全现值；余额大于现值=负值', () => {
    expect(sellNetProceeds(home40w(), undefined)).toBe(400000)
    expect(sellNetProceeds(home40w(), mortgageLeft(280000))).toBe(120000)
    expect(sellNetProceeds({ basis: 250000, value: 250000, purchasedAtAge: 30 }, mortgageLeft(280000))).toBe(-30000)
  })
})

describe('第 86 轮：home 字段 validate 与旧档兼容（A3）', () => {
  it('旧档无 home 字段：加载零 issue；在册合法零 issue', () => {
    const bare = makeGame(7, { age: 40 })
    expect(bare.home).toBeUndefined()
    expect(validateState(bare).issues).toEqual([])
    const owner = makeGame(7, { home: home40w() })
    expect(validateState(owner).issues).toEqual([])
  })
  it('损坏房册（负值/缺字段）整体清除视为无房', () => {
    const bad1 = makeGame(7, { home: { basis: -1, value: 400000, purchasedAtAge: 28 } } as unknown as GameState)
    validateState(bad1)
    expect(bad1.home).toBeUndefined()
    const bad2 = makeGame(7, { home: { basis: 400000 } } as unknown as GameState)
    validateState(bad2)
    expect(bad2.home).toBeUndefined()
  })
})

describe('第 86 轮：事件线正反与效果落地', () => {
  it('新事件计数=2、窗口正确、全池校验器零 issue', () => {
    expect(HOME_EVENTS).toHaveLength(2)
    expect(HOME_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([[25, 70], [30, 70]])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('既有购房事件已盖章 buyHome（三档总价 40 万/25 万/25 万）', () => {
    const ev = byId('mid_house_down_payment')
    const totals = ev.choices
      .map((c) => c.effects.find((e) => e.buyHome)?.buyHome?.total)
    expect(totals).toEqual([400000, 250000, 250000, undefined])
  })

  it('盖章落地：选「上车大两居」→ home 在册（basis=value=40 万）+房贷并存', () => {
    const s = makeGame(7, { age: 30, money: 500000 })
    const ev = byId('mid_house_down_payment')
    const r = applyChoice(s, ev, 0)
    expect(r.state.home).toEqual({ basis: 400000, value: 400000, purchasedAtAge: 30 })
    expect(r.state.mortgage?.balance).toBeGreaterThan(0)
  })

  it('持有/变卖事件资格：无房不可用；有房+负债可卖；有房+正资产卖房不可用', () => {
    const living = byId('home_living')
    const sell = byId('home_sell_forced')
    expect(isEventAvailable(makeGame(7, { age: 40 }), living)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, home: home40w() }), living)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, home: home40w(), money: 5000 }), sell)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, home: home40w(), money: -100 }), sell)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 20, home: home40w(), money: -100 }), sell)).toBe(false)
  })

  it('卖出变现：净额入袋+房册注销+房贷两清；撑住支只扣心态', () => {
    const s = makeGame(7, { age: 40, money: -100, home: home40w(), mortgage: mortgageLeft(280000) })
    const ev = byId('home_sell_forced')
    const r = applyChoice(s, ev, 0)
    expect(r.state.money).toBe(-100 + 120000)
    expect(r.state.home).toBeUndefined()
    expect(r.state.mortgage).toBeUndefined()
    const hold = applyChoice(makeGame(7, { age: 40, money: -100, home: home40w() }), ev, 1)
    expect(hold.state.home).toBeDefined()
    expect(hold.state.attrs.stress).toBe(makeGame(7).attrs.stress + 1)
  })

  it('负值卖房：现值不足清贷时净额为负（A2 负值局经事件层验证）', () => {
    const s = makeGame(7, {
      age: 40, money: -100,
      home: { basis: 250000, value: 250000, purchasedAtAge: 30 },
      mortgage: mortgageLeft(280000),
    })
    const r = applyChoice(s, byId('home_sell_forced'), 0)
    expect(r.state.money).toBe(-100 - 30000)
    expect(r.state.mortgage).toBeUndefined()
  })

  it('加权抽取（新事件 ×50，priority=0 层）：抽到的新事件必然资格可用', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...HOME_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(2000 + i, {
        age: 45,
        money: i % 2 === 0 ? -100 : 100000,
        home: home40w(),
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (HOME_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
