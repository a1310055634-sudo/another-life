// 第 85 轮：医疗与保险线测试（基本医保三档报销 + 商业保单生命周期）
// 验收口径（PROMPT-V5.md 第 85 轮）：
// - A1 报销系数三档实付（与手术事件金额一致：4 万总费用 → 1.2 万/2 万/6 千）
// - A2 insurance 字段 validate+旧档（无字段/损坏字段）兼容
// - A3 4 事件正反可用性+效果落地（投保建单/防重/确诊给付/无保单 no-op）+
//      错误状态从不入候选（加权抽取）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { isEventAvailable, visibleChoices, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { INSURANCE_EVENTS } from '../data/events/insurance'
import { insuranceRebate, estimateOutOfPocket, REBATE_EMPLOYED, REBATE_RESIDENT, REBATE_RETIRED } from './insurance'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}
const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}
const employed = (): GameState['career'] => ({
  kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2, salaryMul: 1,
})

describe('第 85 轮：报销系数与实付（A1）', () => {
  it('三档系数：在职 0.70/居民 0.50/退休 0.85', () => {
    expect(REBATE_EMPLOYED).toBe(0.7)
    expect(REBATE_RESIDENT).toBe(0.5)
    expect(REBATE_RETIRED).toBe(0.85)
    expect(insuranceRebate('employed')).toBe(0.7)
    expect(insuranceRebate('student')).toBe(0.5)
    expect(insuranceRebate('unemployed')).toBe(0.5)
    expect(insuranceRebate('none')).toBe(0.5)
    expect(insuranceRebate('retired')).toBe(0.85)
  })
  it('4 万总费用三档实付：1.2 万/2 万/6 千（与手术事件金额一致）', () => {
    expect(estimateOutOfPocket('employed', 40000)).toBe(12000)
    expect(estimateOutOfPocket('unemployed', 40000)).toBe(20000)
    expect(estimateOutOfPocket('retired', 40000)).toBe(6000)
    // 与事件选项金额逐字对账（防「报销额/自付额」口径错位）
    const surgery = byId('hlt_major_surgery')
    const moneys = surgery.choices.map((c) => c.effects.find((e) => typeof e.money === 'number')?.money)
    expect(moneys).toContain(-12000)
    expect(moneys).toContain(-20000)
    expect(moneys).toContain(-6000)
  })
  it('非法费用安全归 0', () => {
    expect(estimateOutOfPocket('employed', -5)).toBe(0)
    expect(estimateOutOfPocket('employed', NaN)).toBe(0)
  })
})

describe('第 85 轮：保单字段 validate 与旧档兼容（A2）', () => {
  it('旧档无 insurance 字段：加载零 issue', () => {
    const s = makeGame(7, { age: 40 })
    expect(s.insurance).toBeUndefined()
    expect(validateState(s).issues).toEqual([])
  })
  it('保单在册合法：零 issue；损坏字段（负数/缺字段）整体清除', () => {
    const good = makeGame(7, { insurance: { annualPremium: 800, benefit: 50000, purchasedAtAge: 28 } })
    expect(validateState(good).issues).toEqual([])
    const bad1 = makeGame(7, { insurance: { annualPremium: -1, benefit: 50000, purchasedAtAge: 28 } } as unknown as GameState)
    const issues1 = validateState(bad1)
    expect(bad1.insurance).toBeUndefined()
    expect(issues1.issues.length).toBeGreaterThan(0)
    const bad2 = makeGame(7, { insurance: { annualPremium: 800 } } as unknown as GameState)
    validateState(bad2)
    expect(bad2.insurance).toBeUndefined()
  })
})

describe('第 85 轮：4 事件正反与效果落地（A3）', () => {
  it('文件级计数=4，窗口分档，全池校验器零 issue', () => {
    expect(INSURANCE_EVENTS).toHaveLength(4)
    const windows = INSURANCE_EVENTS.map((e) => [e.minAge, e.maxAge])
    expect(windows).toEqual([[18, 35], [36, 55], [30, 60], [40, 70]])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('投保事件：无保单+低风险可用；有保单/高风险/年龄窗外不可用', () => {
    const ev = byId('ins_buy_young')
    expect(isEventAvailable(makeGame(7, { age: 28, healthRisk: 10 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 28, healthRisk: 10, insurance: { annualPremium: 800, benefit: 50000, purchasedAtAge: 25 } }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 28, healthRisk: 50 }), ev)).toBe(false) // 高风险核保不过
    expect(isEventAvailable(makeGame(7, { age: 40, healthRisk: 10 }), ev)).toBe(false)
    const mid = byId('ins_buy_mid')
    expect(isEventAvailable(makeGame(7, { age: 45, healthRisk: 10 }), mid)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 28, healthRisk: 10 }), mid)).toBe(false)
  })

  it('拒保事件：高风险+无保单可用；低风险/已有保单不可用', () => {
    const ev = byId('ins_declined')
    expect(isEventAvailable(makeGame(7, { age: 45, healthRisk: 50 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 45, healthRisk: 30 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 45, healthRisk: 50, insurance: { annualPremium: 800, benefit: 50000, purchasedAtAge: 40 } }), ev)).toBe(false)
  })

  it('投保落地：chooseOption 后保单在册（年缴/保额/年龄盖章）', () => {
    const s = makeGame(7, { age: 28, healthRisk: 10, money: 5000 })
    const r = applyChoice(s, byId('ins_buy_young'), 0)
    expect(r.state.insurance).toEqual({ annualPremium: 800, benefit: 30000, purchasedAtAge: 28 })
    expect(r.state.money).toBe(4200)
  })

  it('手术事件可见性分档：在职 2 项（职工手术+保守）、退休 2 项（≥2 有效选项红线）', () => {
    const ev = byId('hlt_major_surgery')
    const emp = makeGame(7, { age: 45, healthRisk: 55, career: employed(), money: 100000 })
    const visE = visibleChoices(emp, ev)
    expect(visE.map((c) => c.text)).toEqual([
      expect.stringContaining('职工医保'),
      expect.stringContaining('亲戚'),
    ])
    expect(visE.length).toBe(2)
    const ret = makeGame(7, { age: 66, healthRisk: 55, career: { kind: 'retired', pension: 20000 }, money: 100000 })
    const visR = visibleChoices(ret, ev)
    expect(visR.length).toBe(2)
    expect(visR.some((c) => c.text.includes('退休统筹'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 45, healthRisk: 30 }), ev)).toBe(false)
  })

  it('确诊给付：有保单手术→保额划入+保单终结；无保单→安全 no-op 不给钱', () => {
    const insured = makeGame(7, {
      age: 45, healthRisk: 55, career: employed(), money: 100000,
      insurance: { annualPremium: 1600, benefit: 60000, purchasedAtAge: 40 },
    })
    const ev = byId('hlt_major_surgery')
    const choiceIdx = ev.choices.findIndex((c) => c.text.includes('职工医保'))
    const r1 = applyChoice(insured, ev, choiceIdx)
    expect(r1.state.insurance).toBeUndefined()
    expect(r1.state.money).toBe(100000 - 12000 + 60000)
    const bare = makeGame(7, { age: 45, healthRisk: 55, career: employed(), money: 100000 })
    const r2 = applyChoice(bare, ev, choiceIdx)
    expect(r2.state.insurance).toBeUndefined()
    expect(r2.state.money).toBe(100000 - 12000)
  })

  it('ensureInsurance 防重兜底：已有保单时 no-op（事件层 insuranceMissing 已挡，此处锁引擎）', () => {
    const s = makeGame(7, {
      age: 28, healthRisk: 10, money: 5000,
      insurance: { annualPremium: 1600, benefit: 60000, purchasedAtAge: 26 },
    })
    const r = applyChoice(s, byId('ins_buy_young'), 0)
    expect(r.state.insurance).toEqual({ annualPremium: 1600, benefit: 60000, purchasedAtAge: 26 })
  })

  it('加权抽取（新事件 ×50）：抽到的新事件必然资格可用（错误状态从不入候选）', () => {
    // weightedPick 按 priority 分层（高优先级层优先）——病危链等 priority>0 事件在场时
    // 会整层遮蔽 priority=0 的新事件，故对照池过滤到 priority=0 层再放大新事件权重
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...INSURANCE_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(1000 + i, { age: 45, healthRisk: i % 2 === 0 ? 55 : 10, career: employed(), money: 100000 })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (INSURANCE_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
