// 第 10 轮：财务系统测试
// 覆盖：金钱档位、开支分层、阶梯利息、负债利息与封顶、财务压力分档、
// 负债大额消费自动隐藏、富裕/普通/负债三状态事件可达性、三状态长线推进不卡死、同 seed 复现。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear, baseYearFinance, naturalAttrDrift } from './lifecycle'
import { validateState } from './validate'
import {
  baseLivingExpense,
  livingExpense,
  lifestyleExpense,
  moneyTier,
  savingsInterest,
  debtInterest,
  financeStressDrift,
  settleFinanceYear,
  SAVINGS_INTEREST_CAP,
  DEBT_INTEREST_CAP,
  SHOP_RENT,
  UNEMPLOYMENT_BENEFIT,
} from './finance'
import { visibleChoices, isEventAvailable, checkCondition } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { FINANCE_EVENTS } from '../data/events/finance'
import { getJob } from '../data/careers'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' })
  return { ...base, ...patch }
}

function makeEmployed(jobId: string, salary: number, patch: Partial<GameState> = {}): GameState {
  const job = getJob(jobId)!
  return makeGame(7, {
    age: 30,
    career: { kind: 'employed', jobId, jobTitle: job.title, level: 1, salary, yearsAtJob: 0 },
    ...patch,
  })
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const OK_ATTRS = { health: 60, happiness: 60, smarts: 50, social: 50, stress: 30 }

describe('金钱档位', () => {
  it('四档划分边界正确', () => {
    expect(moneyTier(-1)).toBe('debt')
    expect(moneyTier(0)).toBe('tight')
    expect(moneyTier(19999)).toBe('tight')
    expect(moneyTier(20000)).toBe('normal')
    expect(moneyTier(149999)).toBe('normal')
    expect(moneyTier(150000)).toBe('wealthy')
  })
})

describe('生活开支分层', () => {
  it('基础生活费按年龄分层', () => {
    expect(baseLivingExpense(18)).toBe(20000)
    expect(baseLivingExpense(25)).toBe(20000)
    expect(baseLivingExpense(26)).toBe(26000)
    expect(baseLivingExpense(40)).toBe(26000)
    expect(baseLivingExpense(41)).toBe(28000)
    expect(baseLivingExpense(60)).toBe(28000)
    expect(baseLivingExpense(61)).toBe(22000)
  })

  it('生活方式开销：租房 12000，有房 9000 且不再付租', () => {
    expect(lifestyleExpense([])).toBe(0)
    expect(lifestyleExpense(['independent_living'])).toBe(12000)
    expect(lifestyleExpense(['independent_living', 'homeowner'])).toBe(9000)
    expect(lifestyleExpense(['pet_owner'])).toBe(3000)
    expect(lifestyleExpense(['independent_living', 'pet_owner', 'car_owner'])).toBe(27000)
  })

  it('在职开支 = 年龄基础 + 生活方式 + 10% 收入联动', () => {
    // 30 岁程序员年薪 96,000：26000 + 9600 = 35600
    expect(livingExpense(makeEmployed('junior_dev', 96000))).toBe(35600)
    // 25 岁摊主年薪 30,000 无标签：20000 + 3000 = 23000
    expect(livingExpense(makeEmployed('stall_vendor', 30000, { age: 25 }))).toBe(23000)
  })

  it('学生按学制特例（口径与第 8 轮一致），不叠加收入联动', () => {
    expect(livingExpense(makeGame(1, { career: { kind: 'student', stage: 'highschool', yearsLeft: 2 } }))).toBe(12000)
    expect(livingExpense(makeGame(1, { career: { kind: 'student', stage: 'college', yearsLeft: 3 } }))).toBe(25000)
    expect(livingExpense(makeGame(1, { career: { kind: 'student', stage: 'bachelor', yearsLeft: 4 } }))).toBe(-20000)
    expect(livingExpense(makeGame(1, { career: { kind: 'student', stage: 'phd', yearsLeft: 4 } }))).toBe(-20000)
  })

  it('待业者按年龄分层并领救济；零工者按年龄分层', () => {
    const u = makeGame(2, { age: 30, career: { kind: 'unemployed', weeks: 52 } })
    const f = baseYearFinance(u, { next: () => 0.5 })
    expect(f.expense).toBe(26000)
    expect(f.income).toBe(UNEMPLOYMENT_BENEFIT)
    expect(f.fin.benefit).toBe(UNEMPLOYMENT_BENEFIT)
  })

  it('landlord 标记带来稳定租金，不参与波动', () => {
    const s = makeEmployed('office_clerk', 44000, { tags: ['landlord'] })
    for (const r of [0, 0.5, 0.99]) {
      const f = baseYearFinance(s, { next: () => r })
      expect(f.income).toBeGreaterThanOrEqual(44000 * 0.92 + SHOP_RENT)
    }
  })
})

describe('阶梯存款利息', () => {
  it('10 万以内不计息', () => {
    expect(savingsInterest(0)).toBe(0)
    expect(savingsInterest(100000)).toBe(0)
  })
  it('阶梯精确：10～50 万 2%、50～200 万 1.2%、200 万以上 0.6%', () => {
    expect(savingsInterest(200000)).toBe(2000)   // 10万×2%
    expect(savingsInterest(500000)).toBe(8000)   // 40万×2%
    expect(savingsInterest(2000000)).toBe(26000) // 8千 + 1.5万×1.2% → 8000+18000
    expect(savingsInterest(2500000)).toBe(29000) // 26000 + 50万×0.6%
  })
  it('单年封顶，富裕线不再无限滚雪球', () => {
    expect(savingsInterest(20000000)).toBe(SAVINGS_INTEREST_CAP)
    expect(savingsInterest(100000000)).toBe(SAVINGS_INTEREST_CAP)
  })
})

describe('负债利息', () => {
  it('存款为正不计负债利息', () => {
    expect(debtInterest(0)).toBe(0)
    expect(debtInterest(50000)).toBe(0)
  })
  it('按 5% 计息，单年封顶', () => {
    expect(debtInterest(-10000)).toBe(500)
    expect(debtInterest(-40000)).toBe(2000)
    expect(debtInterest(-1000000)).toBe(DEBT_INTEREST_CAP)
    expect(debtInterest(-10000000)).toBe(DEBT_INTEREST_CAP)
  })
})

describe('财务压力分档', () => {
  it('轻债/深债/极端债/富裕四档', () => {
    expect(financeStressDrift(-1000)).toMatchObject({ drift: { happiness: -1, stress: 1 } })
    expect(financeStressDrift(-50000)).toMatchObject({ drift: { happiness: -3, stress: 3 } })
    expect(financeStressDrift(-200000)).toMatchObject({ drift: { happiness: -5, stress: 5 } })
    expect(financeStressDrift(500000)).toMatchObject({ drift: { happiness: 1, stress: -1 } })
    expect(financeStressDrift(5000).notes).toEqual([])
  })
  it('深债附注保留原年志文案，自然属性变化接线生效', () => {
    const s = makeGame(22, { money: -50000, attrs: { ...OK_ATTRS } })
    const next = advanceYear(s)
    expect(next.attrs.happiness).toBeLessThan(60)
    expect(next.attrs.stress).toBeGreaterThan(30)
    const drift = naturalAttrDrift({ ...s, money: -60000 }, { next: () => 0.5 })
    expect(drift.notes.some((n) => n.includes('债务像石头'))).toBe(true)
  })
})

describe('年度财务结算集成', () => {
  it('利息按年初余额计：60 万存款在职者一年拿 9,200 利息并写入年志', () => {
    // 年初 600,000：(50万-10万)×2% = 8000，(60万-50万)×1.2% = 1200 → 9200
    const s = makeEmployed('office_clerk', 44000, { money: 600000 })
    const fin = settleFinanceYear(s)
    expect(fin.savingsInterest).toBe(9200)
    const next = advanceYear(s)
    expect(next.yearLog.some((l) => l.includes('存款利息 9,200'))).toBe(true)
    expect(next.money).toBeGreaterThan(600000)
  })

  it('负债利息落账：-8 万待业者一年利息 4,000，救济与支出同时结算', () => {
    const s = makeGame(23, {
      age: 30,
      money: -80000,
      career: { kind: 'unemployed', weeks: 52 },
      attrs: { ...OK_ATTRS },
    })
    const next = advanceYear(s)
    // -80000 + 6000(救济) - 26000(开支) - 4000(负债利息) = -104000
    expect(next.money).toBe(-104000)
    expect(next.yearLog.some((l) => l.includes('负债利息滚出 4,000'))).toBe(true)
    expect(next.yearLog.some((l) => l.includes('失业救济'))).toBe(true)
  })

  it('存款利息按年初而非年末余额：年初 15 万存款当年花到 5 万仍按 15 万计息', () => {
    // 在职但开支高于收入：制造"年内存款下降"场景。
    // 第 22 轮起年薪按公式推导（文员起薪 44000 系），手设低薪不再参与结算，
    // 改用租房+养车+宠物把年度开支抬到推导收入（45,540±8%）之上
    const s = makeEmployed('office_clerk', 20000, {
      money: 150000,
      age: 25,
      tags: ['bg_ordinary', 'independent_living', 'car_owner', 'pet_owner'],
    })
    const fin = settleFinanceYear(s)
    expect(fin.savingsInterest).toBe(1000) // (150000-100000)×2%，按年初余额
    const next = advanceYear(s)
    // 年末余额远低于 10 万，但利息已按年初结清
    expect(next.money).toBeLessThan(150000)
    expect(next.yearLog.some((l) => l.includes('存款利息 1,000'))).toBe(true)
  })

  it('同 seed 复现：含利息与压力分档的推进完全一致', () => {
    const run = () => {
      let s = makeGame(777, { money: -30000, career: { kind: 'none' }, attrs: { ...OK_ATTRS } })
      for (let i = 0; i < 15; i++) s = advanceYear(s)
      return JSON.stringify({ m: s.money, a: s.attrs, log: s.yearLog })
    }
    expect(run()).toBe(run())
  })
})

describe('负债大额消费自动隐藏', () => {
  it('负债 -25,700 时健身房企卡（-3000）不可见，免费选项保留（第 9 轮实测漏洞回归）', () => {
    const s = makeGame(31, { age: 20, money: -25700, attrs: { ...OK_ATTRS } })
    const event = findEvent('youth_gym_card')
    const vis = visibleChoices(s, event)
    expect(vis.some((c) => c.text.includes('办年卡'))).toBe(false)
    expect(vis.some((c) => c.text.includes('夜跑'))).toBe(true)
    // 第 19 轮语义收紧：大额选项隐藏后只剩夜跑一个可见选项，事件卡不再出现
    //（≥2 有效选项规则）；办卡/夜跑的取舍留到不负债的年份（once 未经历不会丢失）
    expect(isEventAvailable(s, event)).toBe(false)
  })
  it('存款归零及以上时办卡选项恢复可见', () => {
    const s = makeGame(32, { age: 20, money: 0, attrs: { ...OK_ATTRS } })
    const vis = visibleChoices(s, findEvent('youth_gym_card'))
    expect(vis.some((c) => c.text.includes('办年卡'))).toBe(true)
  })
  it('阈值之下的小额支出在负债时仍可见（100 元猫粮）', () => {
    const s = makeGame(33, { age: 20, money: -5000, attrs: { ...OK_ATTRS } })
    const vis = visibleChoices(s, findEvent('youth_pet_stray'))
    expect(vis.some((c) => c.text.includes('猫粮'))).toBe(true)
  })
  it('延迟支出不算大额：mid_parent_health 借钱周转选项（延迟 -6000）负债时可见', () => {
    const s = makeGame(34, { age: 40, money: -30000, attrs: { ...OK_ATTRS } })
    const vis = visibleChoices(s, findEvent('mid_parent_health'))
    expect(vis.some((c) => c.text.includes('周转也要治'))).toBe(true)
    // 三个现金支付选项全部被隐藏
    expect(vis.filter((c) => c.effects.some((e) => typeof e.money === 'number' && e.money < 0))).toHaveLength(0)
  })
  it('教育与技能投资豁免：负债时复读（startEducation -3000）仍可见，不能堵死上进路', () => {
    const s = makeGame(37, { age: 18, money: -12000, attrs: { ...OK_ATTRS } })
    const fork = visibleChoices(s, findEvent('youth_gap_decision'))
    expect(fork.some((c) => c.text.includes('复读'))).toBe(true)
    // 纯消费的大专/搬出去选项照常隐藏逻辑不受豁免影响（大专 -2000 在阈值下本就可见）
    const nightClass = visibleChoices(s, findEvent('youth_night_class'))
    expect(nightClass.some((c) => c.text.includes('培训班'))).toBe(false) // -9000 纯消费属性
    expect(nightClass.some((c) => c.text.includes('借书证'))).toBe(true) // 免费自学路线保留
  })
})

describe('富裕/普通/负债三状态的事件可达性', () => {
  const wealthy = () => makeEmployed('junior_dev', 96000, { age: 32, money: 300000, attrs: { ...OK_ATTRS } })
  const normal = () => makeEmployed('warehouse_keeper', 38000, { age: 32, money: 50000, attrs: { ...OK_ATTRS } })
  const debtor = () => makeGame(35, { age: 32, money: -80000, career: { kind: 'none' }, attrs: { ...OK_ATTRS } })

  it('催收电话只在深度负债时出现', () => {
    const e = findEvent('fin_debt_calls')
    expect(isEventAvailable(debtor(), e)).toBe(true)
    expect(isEventAvailable(wealthy(), e)).toBe(false)
    expect(isEventAvailable(normal(), e)).toBe(false)
    expect(isEventAvailable(makeGame(36, { age: 32, money: -10000, attrs: { ...OK_ATTRS } }), e)).toBe(false)
  })

  it('亲戚借钱只对富裕线开放', () => {
    const e = findEvent('fin_relative_borrow')
    expect(isEventAvailable(wealthy(), e)).toBe(true)
    expect(isEventAvailable(normal(), e)).toBe(false)
    expect(isEventAvailable(debtor(), e)).toBe(false)
  })

  it('铺面投资需要 20 万门槛，全款选项还要 25 万', () => {
    const e = findEvent('fin_shopfront')
    expect(isEventAvailable(wealthy(), e)).toBe(true)
    expect(isEventAvailable(normal(), e)).toBe(false)
    const rich = makeEmployed('junior_dev', 96000, { age: 32, money: 220000, attrs: { ...OK_ATTRS } })
    const vis = visibleChoices(rich, e)
    expect(vis.some((c) => c.text.includes('全款'))).toBe(false)
    expect(vis.some((c) => c.text.includes('贷款盘下'))).toBe(true)
  })

  it('理财骗局事件要求至少 1.5 万本金；大手笔选项要求 5 万', () => {
    const e = findEvent('fin_invest_pitch')
    expect(isEventAvailable(normal(), e)).toBe(true)
    expect(isEventAvailable(debtor(), e)).toBe(false)
    const mid = makeEmployed('warehouse_keeper', 38000, { age: 32, money: 30000, attrs: { ...OK_ATTRS } })
    expect(visibleChoices(mid, e).some((c) => c.text.includes('大手笔'))).toBe(false)
    expect(visibleChoices(wealthy(), e).some((c) => c.text.includes('大手笔'))).toBe(true)
  })

  it('三种状态都能在财务事件里看到至少一个可行选项，且处境不同', () => {
    for (const [label, s] of [['富裕', wealthy()], ['普通', normal()], ['负债', debtor()]] as const) {
      const finEvents = FINANCE_EVENTS.filter((e) => isEventAvailable(s, e))
      expect(finEvents.length).toBeGreaterThanOrEqual(1)
      for (const e of finEvents) {
        expect(visibleChoices(s, e).length).toBeGreaterThanOrEqual(1)
      }
      // 三状态处境可观察不同
      if (label === '负债') expect(checkCondition(s, { moneyBelow: -20000 })).toBe(true)
      if (label === '富裕') expect(checkCondition(s, { moneyAtLeast: 100000 })).toBe(true)
    }
  })
})

describe('三种财务状态长线推进：不卡死、不 NaN、处境分化', () => {
  it('富裕线 40 年：持续为正、利息封顶、状态合法', () => {
    let s = makeEmployed('junior_dev', 96000, { age: 25, money: 300000, attrs: { ...OK_ATTRS } })
    for (let i = 0; i < 40 && s.phase === 'playing'; i++) {
      s = advanceYear(s)
      expect(validateState(s).issues).toEqual([])
      expect(Number.isFinite(s.money)).toBe(true)
    }
    expect(s.money).toBeGreaterThan(300000)
  })

  it('普通线 40 年：量入为出缓慢积蓄，状态合法', () => {
    let s = makeEmployed('warehouse_keeper', 38000, { age: 25, money: 40000, attrs: { ...OK_ATTRS } })
    for (let i = 0; i < 40 && s.phase === 'playing'; i++) {
      s = advanceYear(s)
      expect(validateState(s).issues).toEqual([])
      expect(Number.isFinite(s.money)).toBe(true)
    }
    expect(s.money).toBeGreaterThan(40000)
  })

  it('负债线 40 年：有救济和负债事件托底，债务线性恶化但不爆炸、不软锁', () => {
    let s = makeGame(88, {
      age: 25,
      money: -100000,
      career: { kind: 'unemployed', weeks: 52 },
      skills: { academics: 5, vocational: 5 },
      attrs: { health: 60, happiness: 45, smarts: 20, social: 40, stress: 30 },
    })
    let minMoney = 0
    for (let i = 0; i < 40 && s.phase === 'playing'; i++) {
      s = advanceYear(s)
      expect(validateState(s).issues).toEqual([])
      expect(Number.isFinite(s.money)).toBe(true)
      minMoney = Math.min(minMoney, s.money)
    }
    // 负债利息封顶后债务是线性增长而非指数爆炸
    expect(minMoney).toBeGreaterThan(-2000000)
    expect(s.phase === 'ended' || s.age >= 60).toBe(true)
  })

  it('铺面租金持续入账：landlord 每年恰好多 18,000', () => {
    const clerk = makeEmployed('office_clerk', 44000, { age: 35, money: 300000, attrs: { ...OK_ATTRS } })
    // 同一状态下有/无 landlord 标记，收入恰好差一份租金
    expect(baseYearFinance({ ...clerk, tags: ['landlord'] }, { next: () => 0.5 }).income).toBe(44000 + SHOP_RENT)
    expect(baseYearFinance({ ...clerk, tags: [] }, { next: () => 0.5 }).income).toBe(44000)
    // 实际推进一年，同 seed 下两条线的年末存款差恰好 18,000
    const withRent = advanceYear({ ...clerk, tags: ['landlord'] })
    const without = advanceYear({ ...clerk, tags: [] })
    expect(withRent.money - without.money).toBe(SHOP_RENT)
  })
})

describe('第 10 轮财务事件数据质量', () => {
  it('10 个财务事件入池（含第 13 轮因果链下游 3 个），全池通过校验器', () => {
    expect(FINANCE_EVENTS).toHaveLength(10)
    for (const e of FINANCE_EVENTS) expect(ALL_EVENTS.some((x) => x.id === e.id)).toBe(true)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('每个财务事件的选项结果组合互不相同，且都有短期/长期分化', () => {
    for (const e of FINANCE_EVENTS) {
      const sigs = e.choices.map(
        (c) => JSON.stringify([c.effects, (c.delayed ?? []).map((d) => d.years)]),
      )
      expect(new Set(sigs).size).toBe(e.choices.length)
      // 兼顾短期与长期：至少一个选项带延迟效果（长期后果）
      expect(e.choices.some((c) => (c.delayed ?? []).length > 0)).toBe(true)
    }
  })

  it('催收电话四条出路互斥且各有代价', () => {
    const e = findEvent('fin_debt_calls')
    const debtorState = makeGame(41, { age: 30, money: -60000, attrs: { ...OK_ATTRS } })
    const vis = visibleChoices(debtorState, e)
    expect(vis).toHaveLength(4)
    const totalMoney = vis.map((c) => c.effects.reduce((s, x) => s + (x.money ?? 0), 0))
    // 找家里 +15000 / 以贷养贷 +8000（延迟 -10000）/ 自救 +6000 / 硬扛 0
    expect(totalMoney).toEqual([15000, 8000, 6000, 0])
  })
})
