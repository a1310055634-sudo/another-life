// 第 43 轮：慢性病长期线测试（managed 管理 / 风险增速分化 / 年度开支 / 孪生对照）
// 验收口径（PROMPT-V3.md 第 43 轮）：
// - 孪生对照（同病不同管理）：并发症资格兑现时点差异显著（失控增速 4× 于管理）
// - managed 标记过期语义明确：2 年未刷新 = 失访失控，年度结算移除并提示
// - 既有 hlt 池测试零回归（accumulateHealthRisk 新参缺省 0，既有行为逐位不变）
// - 复查/遵医嘱选项真实刷新 managed（链路闭环：过期 → 复查 → 回到管理态）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { HEALTH_EVENTS } from '../data/events/health'
import {
  accumulateHealthRisk,
  chronicRiskRate,
  CHRONIC_CONDITION_TAG,
  CHRONIC_MANAGED_TAG,
  CHRONIC_MANAGED_YEARS,
  CHRONIC_ANNUAL_COST,
  CHRONIC_RISK_UNMANAGED,
  CHRONIC_RISK_MANAGED,
  riskAgeFactor,
} from './lifestyle'
import { priceFactor } from './finance'
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

/** 按文本找选项原始索引 */
function choiceIndex(event: GameEvent, text: string): number {
  const i = event.choices.findIndex((c) => c.text === text)
  if (i === -1) throw new Error(`选项不存在: ${text}`)
  return i
}

describe('第 43 轮：数据规格与校验', () => {
  it('HEALTH_EVENTS 12→14：新增复查与并发症两事件，全池过校验器', () => {
    expect(HEALTH_EVENTS).toHaveLength(16)
    const ids = HEALTH_EVENTS.map((e) => e.id)
    expect(ids).toContain('hlt_chronic_checkup')
    expect(ids).toContain('hlt_chronic_flare')
    for (const e of [findEvent('hlt_chronic_checkup'), findEvent('hlt_chronic_flare')]) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.singleChoiceOk).toBeUndefined()
    }
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('确诊事件三选项都授 chronic_condition；规范用药/住院另授 managed，能省则省不授', () => {
    const onset = findEvent('hlt_chronic_onset')
    expect(onset.choices[0].addTags).toContain(CHRONIC_CONDITION_TAG)
    expect(onset.choices[0].addTags).toContain(CHRONIC_MANAGED_TAG)
    expect(onset.choices[1].addTags).toContain(CHRONIC_CONDITION_TAG)
    expect(onset.choices[1].addTags).toContain(CHRONIC_MANAGED_TAG)
    expect(onset.choices[2].addTags).toEqual([CHRONIC_CONDITION_TAG])
  })
})

describe('第 43 轮：风险增速分化（孪生对照，验收①）', () => {
  it('chronicRiskRate：未患病 0 / 失控 4 / 管理 1', () => {
    expect(chronicRiskRate([])).toBe(0)
    expect(chronicRiskRate(['other_tag'])).toBe(0)
    expect(chronicRiskRate([CHRONIC_CONDITION_TAG])).toBe(CHRONIC_RISK_UNMANAGED)
    expect(chronicRiskRate([CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG])).toBe(CHRONIC_RISK_MANAGED)
  })

  it('同病同起点：失控线与良好线 5 年后风险值差 = (4−1)×2×5 = 30（62+ 年龄系数 ×2）', () => {
    const start = 50
    let unmanaged = start
    let managed = start
    for (let i = 0; i < 5; i++) {
      unmanaged = accumulateHealthRisk([CHRONIC_CONDITION_TAG], 62 + i, unmanaged, chronicRiskRate([CHRONIC_CONDITION_TAG]))
      managed = accumulateHealthRisk([CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG], 62 + i, managed, chronicRiskRate([CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG]))
    }
    expect(unmanaged).toBe(90) // 50 + 4×2×5
    expect(managed).toBe(60) // 50 + 1×2×5
  })

  it('并发症资格兑现时点：同病 risk 50 起，失控 1 年过 58 线、管理 1 年未过（事件级资格切换）', () => {
    const flare = findEvent('hlt_chronic_flare')
    const base = { age: 62, money: 30000 }
    // 起点 risk 50：双方都未过 58 线，都不可用
    const s0 = makeGame(1, { ...base, healthRisk: 50, tags: [CHRONIC_CONDITION_TAG], relations: [] })
    expect(isEventAvailable(s0, flare)).toBe(false)
    // 推 1 年：失控增速 4×2=8 → 58 可用；管理增速 1×2=2 → 52 不可用
    const sUnmanaged = makeGame(1, {
      ...base,
      healthRisk: 50,
      tags: [CHRONIC_CONDITION_TAG],
      relations: [],
    })
    const afterUn = advanceYear(sUnmanaged)
    expect(afterUn.healthRisk).toBe(58)
    expect(isEventAvailable(afterUn, flare)).toBe(true)

    const sManaged = makeGame(1, {
      ...base,
      healthRisk: 50,
      tags: [CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG],
      cooldowns: { [CHRONIC_MANAGED_TAG]: 64 },
      relations: [],
    })
    const afterMg = advanceYear(sManaged)
    expect(afterMg.healthRisk).toBe(52)
    expect(isEventAvailable(afterMg, flare)).toBe(false)
  })
})

describe('第 43 轮：managed 过期语义（验收②）', () => {
  it('无到期戳：结算补戳（age+2）且标记保留；到期年移除并年志提示失访', () => {
    // 无戳 → 补戳
    const s1 = makeGame(7, { age: 63, tags: [CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG], relations: [] })
    const next = advanceYear(s1)
    expect(next.tags).toContain(CHRONIC_MANAGED_TAG)
    expect(next.cooldowns[CHRONIC_MANAGED_TAG]).toBe(64 + CHRONIC_MANAGED_YEARS)
    // 到期：戳 = 66 → 66 岁结算移除
    const s2 = makeGame(7, {
      age: 63,
      tags: [CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG],
      cooldowns: { [CHRONIC_MANAGED_TAG]: 66 },
      relations: [],
    })
    let cur = s2
    while (cur.age < 66 && cur.phase === 'playing') cur = advanceYear(cur)
    expect(cur.tags).not.toContain(CHRONIC_MANAGED_TAG)
    expect(cur.cooldowns[CHRONIC_MANAGED_TAG]).toBeUndefined()
    expect(cur.yearLog.join('\n')).toContain('好一阵没去复查了')
  })

  it('过期后复查可回到管理态（链路闭环）', () => {
    const checkup = findEvent('hlt_chronic_checkup')
    const lost = makeGame(1, { age: 65, money: 20000, tags: [CHRONIC_CONDITION_TAG], relations: [] })
    expect(isEventAvailable(lost, checkup)).toBe(true)
    const after = applyChoice(lost, checkup, choiceIndex(checkup, '抽血化验，按医嘱调药')).state
    expect(after.tags).toContain(CHRONIC_MANAGED_TAG)
  })

  it('复查事件资格只认患病者；未患病不可用', () => {
    const checkup = findEvent('hlt_chronic_checkup')
    expect(isEventAvailable(makeGame(1, { age: 65, money: 20000, tags: [CHRONIC_CONDITION_TAG], relations: [] }), checkup)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 65, money: 20000, relations: [] }), checkup)).toBe(false)
  })
})

describe('第 43 轮：年度复查用药开支', () => {
  it('患病年扣 1200×物价系数（63 岁 → 1,380），未患病零感知（对照法逐元精确）', () => {
    const factor = priceFactor(64) // 62+ → 1.15
    expect(factor).toBe(1.15)
    const sick = makeGame(7, { age: 63, money: 30000, tags: [CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG], cooldowns: { [CHRONIC_MANAGED_TAG]: 70 }, relations: [] })
    const healthy = makeGame(7, { age: 63, money: 30000, relations: [] })
    const a = advanceYear(sick)
    const b = advanceYear(healthy)
    const expectedCost = Math.round(CHRONIC_ANNUAL_COST * factor)
    expect(expectedCost).toBe(1380)
    expect(b.money - a.money).toBe(expectedCost)
    expect(a.yearLog.join('\n')).toContain('慢病复查与用药')
    expect(b.yearLog.join('\n')).not.toContain('慢病复查与用药')
  })

  it('风险增速接入年度结算：失控患病年 risk +8（62+），未患病沿用既有口径', () => {
    const sick = makeGame(7, { age: 63, healthRisk: 50, tags: [CHRONIC_CONDITION_TAG], relations: [] })
    const healthy = makeGame(7, { age: 63, healthRisk: 50, relations: [] })
    const a = advanceYear(sick)
    const b = advanceYear(healthy)
    expect(a.healthRisk).toBe(50 + CHRONIC_RISK_UNMANAGED * riskAgeFactor(64))
    expect((a.healthRisk ?? 0) - (b.healthRisk ?? 0)).toBe(CHRONIC_RISK_UNMANAGED * riskAgeFactor(64))
  })
})
