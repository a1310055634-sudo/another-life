// 第 87 轮：资产系统 II 测试（基金定投+牛熊序列；存款利息为既有机制——A2 盘点断言）
// 验收口径（PROMPT-V5.md 第 87 轮）：
// - A1 牛熊序列 seed 确定性+三态占比带；收益率表冻结
// - A2 存款利息=V1 R10 既有阶梯机制（盘点结论：任务书「1.5% 起征 1 万」为重复建设不落地），
//   本轮新增 sanity 断言锁定既有行为在位
// - A3 fund 字段 validate 三态+旧档兼容；定投/断供/赎回效果；错误状态从不入候选
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { savingsInterest, SAVINGS_INTEREST_CAP } from './finance'
import { ALL_EVENTS } from '../data/events'
import { FUND_EVENTS } from '../data/events/fund'
import { marketAt, MARKET_RETURN } from './fund'
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

describe('第 87 轮：牛熊序列（A1）', () => {
  it('收益率表冻结：熊 −15%/震荡 +3%/牛 +18%', () => {
    expect(MARKET_RETURN.bear).toBe(-0.15)
    expect(MARKET_RETURN.sideways).toBe(0.03)
    expect(MARKET_RETURN.bull).toBe(0.18)
  })
  it('seed 确定性：同 seed 同年龄同态；独立支流不耗主 rng（纯函数）', () => {
    for (const age of [18, 25, 40, 60, 77]) {
      expect(marketAt(20260917, age)).toBe(marketAt(20260917, age))
      expect(marketAt(11, age)).toBe(marketAt(11, age))
    }
    // 起点约定：≤18 岁恒震荡
    expect(marketAt(1, 18)).toBe('sideways')
  })
  it('多 seed 序列有差异（非退化为常量）；三态千步占比落带内', () => {
    const seeds = [1, 7, 11, 77, 20260917, 314, 606, 808]
    const outcomes = seeds.map((s) => marketAt(s, 50))
    expect(new Set(outcomes).size).toBeGreaterThan(1)
    // 大步重放统计（age 18→18+999，计 999 次转移的态分布）
    const counts = { bull: 0, sideways: 0, bear: 0 }
    const seed = 20260917
    for (let age = 19; age <= 18 + 999; age++) counts[marketAt(seed, age)]++
    const total = 999
    for (const k of ['bull', 'sideways', 'bear'] as const) {
      const share = counts[k] / total
      // 转移矩阵平稳分布三态理论各约 1/3——带取 ±0.07（含有限样本方差）
      expect(share).toBeGreaterThan(0.26)
      expect(share).toBeLessThan(0.41)
    }
  })
})

describe('第 87 轮：存款利息=既有阶梯机制（A2 盘点断言）', () => {
  it('V1 R10 阶梯利息在位：10 万起征、首档 2%、三档合计封顶 3 万（本轮不重复建设）', () => {
    expect(savingsInterest(100000)).toBe(0)
    expect(savingsInterest(500000)).toBe(8000) // (50−10)万 × 2%
    expect(savingsInterest(2100000)).toBe(26600) // 8000 + 150万×1.2% + 10万×0.6%（未触顶）
    expect(savingsInterest(5000000)).toBe(SAVINGS_INTEREST_CAP) // 8000+18000+18000=44000 → 封顶
  })
})

describe('第 87 轮：fund 字段 validate 与旧档兼容（A3）', () => {
  it('旧档无 fund 字段：加载零 issue；在册合法零 issue', () => {
    const bare = makeGame(7, { age: 40 })
    expect(bare.fund).toBeUndefined()
    expect(validateState(bare).issues).toEqual([])
    const holder = makeGame(7, { fund: { annualContribution: 6000, units: 12000 } })
    expect(validateState(holder).issues).toEqual([])
  })
  it('损坏持仓（负档位/缺字段）整体清除视为未开户', () => {
    const bad1 = makeGame(7, { fund: { annualContribution: -1, units: 0 } } as unknown as GameState)
    validateState(bad1)
    expect(bad1.fund).toBeUndefined()
    const bad2 = makeGame(7, { fund: { annualContribution: 6000 } } as unknown as GameState)
    validateState(bad2)
    expect(bad2.fund).toBeUndefined()
  })
})

describe('第 87 轮：事件线与年结效果', () => {
  it('新事件计数=3、窗口正确、全池校验器零 issue', () => {
    expect(FUND_EVENTS).toHaveLength(3)
    expect(FUND_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([[25, 50], [25, 60], [25, 60]])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('开户事件资格：钱够可用；钱不够/已触发过（once）不可用；开户落地 units=0', () => {
    const ev = byId('fin_fund_start')
    expect(isEventAvailable(makeGame(7, { age: 30, money: 10000 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, money: 5000 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, money: 10000, seenEvents: ['fin_fund_start'] }), ev)).toBe(false)
    const r = applyChoice(makeGame(7, { age: 30, money: 10000 }), ev, 0)
    expect(r.state.fund).toEqual({ annualContribution: 6000, units: 0 })
    const r2 = applyChoice(makeGame(7, { age: 30, money: 10000 }), ev, 1)
    expect(r2.state.fund).toEqual({ annualContribution: 12000, units: 0 })
  })

  it('年结定投：钱够划扣+按当年态结算市值；钱不够断供（份额照吃收益+年志）', () => {
    // 同 seed 孪生：定投局的现金恰好比无基金局少一笔划扣（复利只动 units 不动其他现金流）
    const s = makeGame(42, { age: 40, money: 50000, fund: { annualContribution: 6000, units: 10000 } })
    const bare = makeGame(42, { age: 40, money: 50000 })
    const after = advanceYear(s)
    const afterBare = advanceYear(bare)
    expect(after.money).toBe(afterBare.money - 6000)
    // 市值按当年态结算（重放同一纯函数校验乘数）
    const r = MARKET_RETURN[marketAt(42, 41)]
    expect(after.fund?.units).toBe(Math.round((10000 + 6000) * (1 + r)))

    const poor = makeGame(99, { age: 40, money: 100, fund: { annualContribution: 6000, units: 10000 } })
    const afterPoor = advanceYear(poor)
    expect(afterPoor.yearLog.join('\n')).toContain('定投断供了')
    expect(afterPoor.fund).toBeDefined()
  })

  it('止盈/割肉事件：市场态门槛镜像（牛态只出止盈、熊态只出割肉）；赎回全额入袋销户', () => {
    const tp = byId('fin_fund_take_profit')
    const cl = byId('fin_fund_cut_loss')
    // 找一个 45 岁为牛态的 seed 和一个为熊态的 seed
    let bullSeed = -1
    let bearSeed = -1
    for (let s0 = 1; s0 < 500; s0++) {
      const m = marketAt(s0, 45)
      if (m === 'bull' && bullSeed < 0) bullSeed = s0
      if (m === 'bear' && bearSeed < 0) bearSeed = s0
      if (bullSeed > 0 && bearSeed > 0) break
    }
    expect(bullSeed).toBeGreaterThan(0)
    expect(bearSeed).toBeGreaterThan(0)
    const bull = makeGame(bullSeed, { age: 45, fund: { annualContribution: 6000, units: 20000 } })
    expect(isEventAvailable(bull, tp)).toBe(true)
    expect(isEventAvailable(bull, cl)).toBe(false)
    const bear = makeGame(bearSeed, { age: 45, fund: { annualContribution: 6000, units: 20000 } })
    expect(isEventAvailable(bear, cl)).toBe(true)
    expect(isEventAvailable(bear, tp)).toBe(false)
    // 赎回：市值全额入袋+销户；未开户 no-op
    const r = applyChoice(bull, tp, 0)
    expect(r.state.money).toBe(bull.money + 20000)
    expect(r.state.fund).toBeUndefined()
    const noFund = makeGame(bullSeed, { age: 45 })
    const r2 = applyChoice(noFund, tp, 0)
    expect(r2.state.money).toBe(noFund.money)
  })

  it('加权抽取（新事件 ×50，priority=0 层）：抽到的新事件必然资格可用', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...FUND_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(3000 + i, { age: 40, money: 20000, fund: { annualContribution: 6000, units: 6000 } })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (FUND_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
