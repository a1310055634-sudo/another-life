// 第 23 轮测试：房贷余额模型
// 覆盖：等额本息公式锚点、逐年摊还表（余额递减/总成本>本金/尾年结清）、
// 贷款购房建余额、全款与翻修两线无余额、月供事件资格=余额>0、
// 提前还款（封顶结清/负债隐藏）、自然还清、年度扣款落账、校验守卫。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import {
  applyChoice,
  visibleChoices,
  isEventAvailable,
  conditionFailReason,
  checkCondition,
  choiceGateReason,
} from './events'
import { validateState } from './validate'
import { annuityPayment, openMortgage, settleMortgageYear, mortgageBalance, MORTGAGE_RATE } from './mortgage'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState } from './types'

function byId(id: string): GameEvent {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件 ${id} 不存在`)
  return e
}

function makeGame(patch: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame({ seed: 42, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' }),
    ...patch,
  }
}

describe('第 23 轮：等额本息年供公式', () => {
  it('年供锚点：30 万 20 年 = 23,900；18 万 20 年 = 14,300', () => {
    expect(annuityPayment(300000, 20)).toBe(23900)
    expect(annuityPayment(180000, 20)).toBe(14300)
  })

  it('非法输入返回 0（防御：绝不凭空建贷）', () => {
    expect(annuityPayment(0, 20)).toBe(0)
    expect(annuityPayment(-100000, 10)).toBe(0)
    expect(annuityPayment(100000, 0)).toBe(0)
    expect(annuityPayment(100000, 1.5)).toBe(0)
    expect(annuityPayment(Number.NaN, 10)).toBe(0)
  })

  it('零利率退化为平均分摊；openMortgage 字段一致，非法参数 no-op', () => {
    expect(annuityPayment(120000, 10, 0)).toBe(12000)
    const m = openMortgage(300000, 20)
    expect(m).toEqual({ principal: 300000, balance: 300000, annualPayment: 23900, yearsLeft: 20 })
    expect(openMortgage(0, 20)).toBeUndefined()
    expect(openMortgage(300000, 20.5)).toBeUndefined()
  })
})

describe('第 23 轮：年度摊还表（纯函数）', () => {
  it('30 万 20 年：前 19 年固定扣款 23,900，余额严格递减，第 20 年尾款一次结清', () => {
    let m = openMortgage(300000, 20)
    if (!m) throw new Error('开贷失败')
    let prevBalance = m.balance
    let clearedYear = 0
    for (let year = 1; year <= 20; year++) {
      const out = settleMortgageYear(m)
      expect(out.payment).toBe(year < 20 ? 23900 : 22888)
      if (year < 20) {
        expect(out.cleared).toBe(false)
        if (!out.mortgage) throw new Error(`第 ${year} 年不应还清`)
        expect(out.mortgage.balance).toBeLessThan(prevBalance)
        expect(out.mortgage.yearsLeft).toBe(20 - year)
        prevBalance = out.mortgage.balance
        m = out.mortgage
      } else {
        expect(out.cleared).toBe(true)
        expect(out.mortgage).toBeNull()
        clearedYear = year
      }
    }
    expect(clearedYear).toBe(20)
  })

  it('摊还恒等式：总扣款 − 总利息 = 本金；贷款总成本大于本金（利息 176,988 元）', () => {
    let m = openMortgage(300000, 20)
    if (!m) throw new Error('开贷失败')
    let totalPaid = 0
    let totalInterest = 0
    for (let i = 0; i < 30; i++) {
      const out = settleMortgageYear(m)
      if (out.payment === 0) break
      totalPaid += out.payment
      totalInterest += Math.round((m?.balance ?? 0) * MORTGAGE_RATE)
      m = out.mortgage ?? undefined
      if (!m) break
    }
    expect(totalPaid - totalInterest).toBe(300000)
    expect(totalPaid).toBe(476988)
    expect(totalInterest).toBe(176988)
    expect(totalPaid).toBeGreaterThan(300000)
  })

  it('18 万 20 年同样走通：尾年 14,999 一次结清', () => {
    let m = openMortgage(180000, 20)
    if (!m) throw new Error('开贷失败')
    let out = settleMortgageYear(m)
    expect(out.payment).toBe(14300)
    for (let i = 0; i < 18; i++) {
      out = settleMortgageYear(out.mortgage ?? undefined)
      expect(out.cleared).toBe(false)
    }
    out = settleMortgageYear(out.mortgage ?? undefined)
    expect(out.cleared).toBe(true)
    expect(out.payment).toBe(14999)
    expect(out.mortgage).toBeNull()
  })

  it('尾年/小余额按 余额+利息 一次结清；无贷与损坏结构安全返回 0', () => {
    const lastYear = settleMortgageYear({ principal: 50000, balance: 50000, annualPayment: 200000, yearsLeft: 1 })
    expect(lastYear).toEqual({ mortgage: null, payment: 50000 + Math.round(50000 * MORTGAGE_RATE), cleared: true })

    expect(settleMortgageYear(undefined)).toEqual({ mortgage: null, payment: 0, cleared: false })
    expect(settleMortgageYear({ principal: 1, balance: 0, annualPayment: 1, yearsLeft: 5 })).toEqual({
      mortgage: null,
      payment: 0,
      cleared: false,
    })
  })

  it('mortgageBalance：无贷/损坏读 0，正常读余额（条件判定的唯一读数口）', () => {
    expect(mortgageBalance(undefined)).toBe(0)
    expect(mortgageBalance({ principal: 300000, balance: 290800, annualPayment: 23900, yearsLeft: 19 })).toBe(290800)
  })
})

describe('第 23 轮：贷款购房建余额，全款与翻修不建', () => {
  it('首付事件选大两居：建 30 万余额、年供 23,900，首付 10 万照付', () => {
    const s = applyChoice(makeGame({ age: 30, money: 150000 }), byId('mid_house_down_payment'), 0)
    expect(s.state.money).toBe(50000)
    expect(s.state.tags).toContain('homeowner')
    expect(s.state.mortgage).toEqual({
      principal: 300000,
      balance: 300000,
      annualPayment: 23900,
      yearsLeft: 20,
    })
  })

  it('选小户型：建 18 万余额、年供 14,300', () => {
    const s = applyChoice(makeGame({ age: 30, money: 150000 }), byId('mid_house_down_payment'), 1)
    expect(s.state.mortgage).toEqual({
      principal: 180000,
      balance: 180000,
      annualPayment: 14300,
      yearsLeft: 20,
    })
  })

  it('选观望：无房无贷', () => {
    const s = applyChoice(makeGame({ age: 30, money: 150000 }), byId('mid_house_down_payment'), 3)
    expect(s.state.tags).not.toContain('homeowner')
    expect(s.state.mortgage).toBeUndefined()
  })

  it('全款选项：存款 25 万以上才可见；成交后有房无贷', () => {
    const ev = byId('mid_house_down_payment')
    const rich = makeGame({ age: 30, money: 300000 })
    const poor = makeGame({ age: 30, money: 150000 })
    const texts = visibleChoices(rich, ev).map((c) => c.text)
    expect(texts).toContain('攒够了全款，一步到位')
    expect(visibleChoices(poor, ev)).toHaveLength(3)

    const s = applyChoice(rich, ev, 2)
    expect(s.state.money).toBe(50000)
    expect(s.state.tags).toContain('homeowner')
    expect(s.state.mortgage).toBeUndefined()
  })

  it('学区房「咬牙买下」是全款购房：有房无贷', () => {
    const s = applyChoice(
      makeGame({ age: 33, money: 200000, tags: ['has_child'] }),
      byId('mid_school_district'),
      0,
    )
    expect(s.state.tags).toContain('homeowner')
    expect(s.state.mortgage).toBeUndefined()
  })

  it('老家「出钱翻新」是翻修线：有房无贷（cared_for_parents 照旧）', () => {
    const s = applyChoice(
      makeGame({ age: 35, money: 100000, tags: ['stay_hometown'] }),
      byId('mid_hometown_house'),
      0,
    )
    expect(s.state.tags).toContain('homeowner')
    expect(s.state.tags).toContain('cared_for_parents')
    expect(s.state.mortgage).toBeUndefined()
  })
})

describe('第 23 轮：月供事件的触发资格 = 余额 > 0', () => {
  const refit = () => byId('mid_mortgage_refit')
  const midAge = (patch: Partial<GameState>) => makeGame({ age: 33, ...patch })

  it('贷款购房后可触发；全款、翻修、观望路线均不可触发', () => {
    const loan = applyChoice(midAge({ money: 150000 }), byId('mid_house_down_payment'), 0).state
    expect(isEventAvailable(loan, refit())).toBe(true)

    const fullCash = applyChoice(midAge({ money: 300000 }), byId('mid_house_down_payment'), 2).state
    expect(isEventAvailable(fullCash, refit())).toBe(false)

    const renovate = applyChoice(midAge({ money: 100000, tags: ['stay_hometown'] }), byId('mid_hometown_house'), 0).state
    expect(isEventAvailable(renovate, refit())).toBe(false)

    expect(isEventAvailable(midAge({ money: 150000 }), refit())).toBe(false)
  })

  it('条件镜像：checkCondition 与 conditionFailReason 判定一致，拒绝理由是玩家语言', () => {
    const cond = { mortgageBalanceAtLeast: 1 }
    const noLoan = midAge({})
    expect(checkCondition(noLoan, cond)).toBe(false)
    expect(conditionFailReason(noLoan, cond)).toBe('名下没有正在偿还的房贷')

    const withLoan = applyChoice(midAge({ money: 150000 }), byId('mid_house_down_payment'), 0).state
    expect(checkCondition(withLoan, cond)).toBe(true)
    expect(conditionFailReason(withLoan, cond)).toBeNull()
  })
})

describe('第 23 轮：提前还款', () => {
  const loaned = (balance = 300000): GameState => ({
    ...makeGame({ age: 33, money: 100000 }),
    mortgage: { principal: 300000, balance, annualPayment: 23900, yearsLeft: 20 },
  })
  const refit = byId('mid_mortgage_refit')

  it('payMortgage 4 万：划扣 4 万现金，余额 30 万 → 26.4 万，年供与年限不变', () => {
    const s = applyChoice(loaned(), refit, 0)
    expect(s.state.money).toBe(60000)
    expect(s.state.mortgage).toEqual({
      principal: 300000,
      balance: 260000,
      annualPayment: 23900,
      yearsLeft: 20,
    })
  })

  it('余额不足 4 万时一次结清：扣 3 万，房贷销账，月供事件不再出现', () => {
    const s = applyChoice(loaned(30000), refit, 0)
    expect(s.state.money).toBe(70000)
    expect(s.state.mortgage).toBeUndefined()
    expect(isEventAvailable(s.state, refit)).toBe(false)
  })

  it('名下无贷时提前还款安全 no-op（不扣钱）', () => {
    const plain = makeGame({ age: 33, money: 100000 })
    const s = applyChoice(plain, refit, 0)
    expect(s.state.money).toBe(100000)
    expect(s.state.mortgage).toBeUndefined()
  })

  it('负债时提前还款被大额消费门槛隐藏（提前还款视同大额即时支出）', () => {
    const broke = { ...loaned(), money: -5000 }
    const vis = visibleChoices(broke, refit)
    expect(vis.map((c) => c.text)).not.toContain('提前还一笔本金')
    const prepay = refit.choices.find((c) => c.text === '提前还一笔本金')
    if (!prepay) throw new Error('找不到提前还款选项')
    expect(choiceGateReason(broke, prepay)).toContain('负债')
  })
})

describe('第 23 轮：年度结算自动扣款', () => {
  it('扣款年：年志有「房贷扣款」行，余额按 利息+扣款 精确推进（300,000 → 290,800）', () => {
    const bought = applyChoice(makeGame({ age: 30, money: 400000 }), byId('mid_house_down_payment'), 0).state
    const next = advanceYear(bought)
    expect(next.yearLog.some((l) => l.includes('房贷扣款') && l.includes('23,900'))).toBe(true)
    expect(next.mortgage).toEqual({
      principal: 300000,
      balance: 300000 + Math.round(300000 * MORTGAGE_RATE) - 23900,
      annualPayment: 23900,
      yearsLeft: 19,
    })
    expect(next.mortgage?.balance).toBe(290800)
  })

  it('自然还清：贷款 20 年后房贷销账、履历落「还清房贷」关键条目、月供事件不再出现', () => {
    let s = applyChoice(makeGame({ age: 28, money: 400000 }), byId('mid_house_down_payment'), 0).state
    for (let i = 0; i < 20 && s.phase === 'playing'; i++) s = advanceYear(s)
    expect(s.age).toBe(48)
    expect(s.mortgage).toBeUndefined()
    const payoff = s.history.find((h) => h.title === '还清房贷')
    expect(payoff).toBeDefined()
    expect(payoff?.key).toBe(true)
    expect(payoff?.age).toBe(48)
    expect(isEventAvailable(s, byId('mid_mortgage_refit'))).toBe(false)
  })

  it('无贷旧局推进：无扣款行、无房贷字段（旧档缺省路径）', () => {
    const next = advanceYear(makeGame({ age: 30 }))
    expect(next.mortgage).toBeUndefined()
    expect(next.yearLog.some((l) => l.includes('房贷扣款'))).toBe(false)
  })

  it('快照五元组不受房贷影响：结构仍恰为 age/money/attrs/career', () => {
    const bought = applyChoice(makeGame({ age: 30, money: 400000 }), byId('mid_house_down_payment'), 0).state
    const next = advanceYear(bought)
    const last = next.snapshots[next.snapshots.length - 1]
    expect(Object.keys(last).sort()).toEqual(['age', 'attrs', 'career', 'money'])
  })
})

describe('第 23 轮：校验守卫与存档', () => {
  it('合法房贷零问题；损坏结构（余额≤0/NaN/余额>本金/年限非正整数）整体清除并报告', () => {
    const ok = { ...makeGame(), mortgage: { principal: 300000, balance: 290800, annualPayment: 23900, yearsLeft: 19 } }
    expect(validateState(ok).issues).toEqual([])

    const cases: Array<Record<string, unknown>> = [
      { principal: 300000, balance: 0, annualPayment: 23900, yearsLeft: 19 },
      { principal: 300000, balance: Number.NaN, annualPayment: 23900, yearsLeft: 19 },
      { principal: 300000, balance: 400000, annualPayment: 23900, yearsLeft: 19 },
      { principal: 300000, balance: 290800, annualPayment: 0, yearsLeft: 19 },
      { principal: 300000, balance: 290800, annualPayment: 23900, yearsLeft: 0 },
      { principal: 300000, balance: 290800, annualPayment: 23900, yearsLeft: 1.5 },
    ]
    for (const mortgage of cases) {
      const bad = { ...makeGame(), mortgage } as unknown as GameState
      const { issues } = validateState(bad)
      expect(issues.some((i) => i.field === 'mortgage')).toBe(true)
      expect(bad.mortgage).toBeUndefined()
    }
  })
})
