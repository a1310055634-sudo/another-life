// 第 24 轮：生活方式长因果测试
// 覆盖：风险值纯函数锚点（增速表/年龄系数/累积/分级）、年度结算接入、跨档年志提示、
// 戒烟不清零历史（增速放缓而非归零）、30 年吸烟+久坐线 vs 锻炼线模拟、
// 分级体检与慢性病事件的档位门槛（正反可用性）、条件镜像的玩家语言、校验守卫。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, visibleChoices, isEventAvailable, conditionFailReason } from './events'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import {
  LIFESTYLE_RISK_RATE,
  riskAgeFactor,
  accumulateHealthRisk,
  riskBand,
  riskBandWarning,
  RISK_MODERATE,
  RISK_HIGH,
} from './lifestyle'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

/** 按文本找到可见选项的【原始索引】（applyChoice 按完整 choices 数组定位） */
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

describe('风险值模型纯函数（lifestyle.ts）', () => {
  it('增速表锚点：吸烟/饮酒 2、久坐/熬夜 1、锻炼 -1、戒烟修复 -0.5', () => {
    expect(LIFESTYLE_RISK_RATE.light_smoker).toBe(2)
    expect(LIFESTYLE_RISK_RATE.heavy_drinker).toBe(2)
    expect(LIFESTYLE_RISK_RATE.desk_bound).toBe(1)
    expect(LIFESTYLE_RISK_RATE.night_owl).toBe(1)
    expect(LIFESTYLE_RISK_RATE.routine_exercise).toBe(-1)
    expect(LIFESTYLE_RISK_RATE.rehab_program).toBe(-0.5)
    expect(LIFESTYLE_RISK_RATE.quit_smoking).toBe(-0.5)
  })

  it('年龄系数三带：39 岁 1.0、40 岁 1.5、60 岁 2.0', () => {
    expect(riskAgeFactor(18)).toBe(1)
    expect(riskAgeFactor(39)).toBe(1)
    expect(riskAgeFactor(40)).toBe(1.5)
    expect(riskAgeFactor(59)).toBe(1.5)
    expect(riskAgeFactor(60)).toBe(2)
  })

  it('年度累积精确锚定：39 岁吸烟 0→2，40 岁吸烟 2→5（增速×1.5）', () => {
    expect(accumulateHealthRisk(['light_smoker'], 39, 0)).toBe(2)
    expect(accumulateHealthRisk(['light_smoker'], 40, 2)).toBe(5)
  })

  it('多标记求和：40 岁吸烟+久坐 4.5/年，60 岁翻倍到 6/年', () => {
    expect(accumulateHealthRisk(['light_smoker', 'desk_bound'], 40, 0)).toBe(4.5)
    expect(accumulateHealthRisk(['light_smoker', 'desk_bound'], 60, 0)).toBe(6)
  })

  it('下限 0（锻炼不能凭空造出负风险）、上限 100（不会无限累积）', () => {
    expect(accumulateHealthRisk(['routine_exercise'], 25, 0)).toBe(0)
    expect(accumulateHealthRisk(['light_smoker', 'heavy_drinker'], 70, 99)).toBe(100)
    expect(accumulateHealthRisk([], 30, 50)).toBe(50) // 无相关标记原值保持
  })

  it('分档读数：24 low / 25 moderate / 49 moderate / 50 high', () => {
    expect(RISK_MODERATE).toBe(25)
    expect(RISK_HIGH).toBe(50)
    expect(riskBand(0)).toBe('low')
    expect(riskBand(24)).toBe('low')
    expect(riskBand(25)).toBe('moderate')
    expect(riskBand(49)).toBe('moderate')
    expect(riskBand(50)).toBe('high')
    expect(riskBand(100)).toBe('high')
  })

  it('跨档提示只在升档那一年出现；同档与降档不提示', () => {
    expect(riskBandWarning(24, 26)).toMatch('小箭头')
    expect(riskBandWarning(49, 51)).toMatch('记账')
    expect(riskBandWarning(30, 32)).toBeNull()
    expect(riskBandWarning(51, 40)).toBeNull() // 降档不提示
    expect(riskBandWarning(0, 0)).toBeNull()
  })
})

describe('年度结算接入（lifecycle.ts 第 4.4 步）', () => {
  it('advanceYear 按标记累积：30 岁吸烟者一年 +2，无标记者保持 0', () => {
    const smoker = advanceYear(makeGame(7, { age: 30, healthRisk: 0, tags: ['light_smoker'] }))
    expect(smoker.healthRisk).toBe(2)
    const clean = advanceYear(makeGame(7, { age: 30, healthRisk: 0, tags: [] }))
    expect(clean.healthRisk).toBe(0)
  })

  it('旧档缺省（healthRisk 字段不存在）正常从 0 起算，不炸', () => {
    const legacy = makeGame(7, { age: 45, tags: ['desk_bound'] })
    delete (legacy as Partial<GameState>).healthRisk
    const next = advanceYear(legacy)
    expect(next.healthRisk).toBe(1.5) // 45 岁（40~59 带）× 久坐 1 = 1.5
  })

  it('跨档年志提示：升入中档/高档当年各提示一次，同档年不提示', () => {
    const crossModerate = advanceYear(makeGame(7, { age: 38, healthRisk: 24, tags: ['light_smoker'] }))
    expect(crossModerate.healthRisk).toBe(26)
    expect(crossModerate.yearLog.join('\n')).toMatch('小箭头')
    const stayModerate = advanceYear(makeGame(7, { age: 38, healthRisk: 30, tags: ['light_smoker'] }))
    expect(stayModerate.healthRisk).toBe(32)
    expect(stayModerate.yearLog.join('\n')).not.toMatch('小箭头')
    const crossHigh = advanceYear(makeGame(7, { age: 48, healthRisk: 48, tags: ['light_smoker'] }))
    expect(crossHigh.healthRisk).toBe(51)
    expect(crossHigh.yearLog.join('\n')).toMatch('记账')
  })

  it('事件染上的习惯当年开始记账：酒局选完即累积', () => {
    let s = makeGame(7, { age: 25 })
    s = choose(s, 'hlt_drink_toast', '仰头干了，从此是自己人')
    expect(s.tags).toContain('heavy_drinker')
    s = advanceYear(s)
    expect(s.healthRisk).toBe(2)
  })

  it('久坐线：选完工位事件后逐年累积，换升降桌后停涨且已有风险保留', () => {
    let s = makeGame(7, { age: 26 })
    s = choose(s, 'hlt_desk_years', '习惯成自然，外卖上楼，一坐一天')
    s = advanceYear(s)
    expect(s.healthRisk).toBe(1)
    s = advanceYear(s)
    expect(s.healthRisk).toBe(2)
    // 改良：再次触发事件选升降桌选项 → 停涨，历史 2 点保留
    s = choose(s, 'hlt_desk_years', '咬牙换升降桌，每小时站一站')
    expect(s.tags).not.toContain('desk_bound')
    const after = advanceYear(s)
    expect(after.healthRisk).toBe(2)
  })
})

describe('戒烟/戒断：增速放缓而非历史清零（第 24 轮核心语义）', () => {
  it('40 点烟龄欠账，戒烟后 10 年只回落到 32.5（修复 -0.75/年），不清零', () => {
    let s = makeGame(7, { age: 40, healthRisk: 40, tags: ['quit_smoking'] }) // 已戒烟（无 light_smoker）
    for (let i = 0; i < 10; i++) s = advanceYear(s)
    expect(s.healthRisk).toBe(32.5) // 40 − 0.5×1.5×10
  })

  it('对照组：同样 40 点继续吸烟，10 年后涨到 70', () => {
    let s = makeGame(7, { age: 40, healthRisk: 40, tags: ['light_smoker'] })
    for (let i = 0; i < 10; i++) s = advanceYear(s)
    expect(s.healthRisk).toBe(70) // 40 + 2×1.5×10
  })

  it('重度体检的戒断选项：三标记移除后停涨（移除即归零增速，历史保留）', () => {
    let s = makeGame(7, { age: 52, healthRisk: 55, tags: ['light_smoker', 'heavy_drinker', 'desk_bound'] })
    s = choose(s, 'hlt_checkup_red_flags', '酒局全推，烟也戒了，每天走一万步')
    expect(s.tags).not.toContain('light_smoker')
    expect(s.tags).not.toContain('heavy_drinker')
    expect(s.tags).not.toContain('desk_bound')
    const next = advanceYear(s)
    expect(next.healthRisk).toBe(55) // 无正增速标记 → 停涨；55 点历史原样保留
  })
})

describe('30 年模拟验收：吸烟+久坐线 vs 锻炼线', () => {
  it('30 年后健康终值差异显著（>25 点），风险值 100 vs 0', () => {
    let bad = makeGame(7, { age: 22, tags: ['light_smoker', 'desk_bound'] })
    let good = makeGame(7, { age: 22, tags: ['routine_exercise'] })
    for (let i = 0; i < 30; i++) {
      bad = advanceYear(bad)
      good = advanceYear(good)
      expect(bad.phase).toBe('playing') // 纯结算模拟 30 年不提前死亡
      expect(good.phase).toBe('playing')
    }
    expect(bad.healthRisk).toBe(100) // 吸烟+久坐 30 年攒满
    expect(good.healthRisk).toBe(0)
    expect(good.attrs.health - bad.attrs.health).toBeGreaterThan(25)
  })

  it('双 seed 复现：seed 7 与 seed 99 的差异结论一致', () => {
    for (const seed of [7, 99]) {
      let bad = makeGame(seed, { age: 22, tags: ['light_smoker', 'desk_bound'] })
      let good = makeGame(seed, { age: 22, tags: ['routine_exercise'] })
      for (let i = 0; i < 30; i++) {
        bad = advanceYear(bad)
        good = advanceYear(good)
      }
      expect(good.attrs.health - bad.attrs.health).toBeGreaterThan(25)
      expect(bad.healthRisk).toBeGreaterThan(good.healthRisk ?? 0)
    }
  })
})

describe('分级事件档位门槛（正反可用性）', () => {
  it('轻度体检（风险 25~49，35~58 岁）：低风险不可用、中档可用、高档不可用', () => {
    const ev = findEvent('hlt_checkup_mild_flags')
    expect(isEventAvailable(makeGame(7, { age: 40, healthRisk: 10 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, healthRisk: 30 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, healthRisk: 55 }), ev)).toBe(false) // Below 50 拦住
    expect(isEventAvailable(makeGame(7, { age: 34, healthRisk: 30 }), ev)).toBe(false) // 年龄未到
    expect(isEventAvailable(makeGame(7, { age: 59, healthRisk: 30 }), ev)).toBe(false) // 窗口已过
  })

  it('重度体检（风险 ≥50，48~64 岁）：49 不可用、50 可用、30 不可用', () => {
    const ev = findEvent('hlt_checkup_red_flags')
    expect(isEventAvailable(makeGame(7, { age: 50, healthRisk: 49 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 50, healthRisk: 50 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 50, healthRisk: 30 }), ev)).toBe(false)
    // 无钱者仍有两个免费选项（戒断/照旧），事件可用
    const poor = makeGame(7, { age: 50, healthRisk: 60, money: 0 })
    expect(visibleChoices(poor, ev).length).toBe(2)
  })

  it('老年慢性病（风险 ≥45，62~77 岁）：44 不可用、45 可用、年轻高风险不可用', () => {
    const ev = findEvent('hlt_chronic_onset')
    expect(isEventAvailable(makeGame(7, { age: 65, healthRisk: 44 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 65, healthRisk: 45 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 55, healthRisk: 60 }), ev)).toBe(false) // 年龄窗口外
  })

  it('轻度体检调理选项真实移除久坐标记（风险历史保留、增速停涨）', () => {
    let s = makeGame(7, { age: 40, healthRisk: 30, tags: ['desk_bound'] })
    s = choose(s, 'hlt_checkup_mild_flags', '认真调理三个月，外卖和酒局都停了')
    expect(s.tags).not.toContain('desk_bound')
    expect(s.healthRisk).toBe(30) // 历史不清零
    const next = advanceYear(s)
    expect(next.healthRisk).toBe(30) // 停涨
  })

  it('条件镜像：conditionFailReason 给玩家语言（不足档/越过档）', () => {
    const mild = findEvent('hlt_checkup_mild_flags')
    expect(conditionFailReason(makeGame(7, { age: 40, healthRisk: 20 }), mild.requires)).toMatch('还没到这份上')
    expect(conditionFailReason(makeGame(7, { age: 40, healthRisk: 55 }), mild.requires)).toMatch('越过了这一档')
  })
})

describe('校验守卫与快照', () => {
  it('validateState：非法风险值（NaN/负数/越界）重置为 0 并报告', () => {
    for (const bad of [NaN, -5, 150]) {
      const s = makeGame(7, { healthRisk: bad })
      const { issues } = validateState(s)
      expect(issues.some((i) => i.problem.includes('风险值'))).toBe(true)
      expect(s.healthRisk).toBe(0)
    }
    expect(validateState(makeGame(7, { healthRisk: 50 })).issues).toHaveLength(0)
  })

  it('快照不含风险值（结构稳定，五元组不受本轮影响）', () => {
    const s = advanceYear(makeGame(7, { age: 40, healthRisk: 66, tags: ['light_smoker'] }))
    const last = s.snapshots[s.snapshots.length - 1]
    expect(last.age).toBe(41)
    expect(last.money).toBe(s.money)
    expect('healthRisk' in last).toBe(false)
  })
})
