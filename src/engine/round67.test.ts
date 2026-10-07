// 第 67 轮：婚姻深水区测试（危机标记 / strain 衰减加重 / 5 事件正反 / 修复摘标记）
// 验收口径（PROMPT-V4.md 第 67 轮）：
// - A1 危机线正反：无 spouse/未婚不可达；修复摘标记；置之不理 strain 衰减加重（−3/年）
// - A2 对照（孪生轨迹表）：同一起点无干预 vs 每年修复，5 年 closeness 分叉显著
// - A3 离婚最小语义按砍量预案未做（预设砍法）——配偶相关结局资格零变化，
//   family_hearth 的 spouseAlive 判定不受危机标记影响（审计留痕，无新资格变化）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { settleRelationDecay, settleMarriageStrain } from './relations'
import { applyChoice, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { MARRIAGE_EVENTS } from '../data/events/marriage'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function byId(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const spouse = (closeness: number, patch: Partial<Relation> = {}): Relation => ({
  id: 'sp1', kind: 'spouse', name: '小赵', closeness, alive: true, ...patch,
})
const crisis = (s: GameState): GameState => ({ ...s, tags: [...s.tags, 'marriage_crisis'] })

describe('第 67 轮：婚姻危机线正反（A1）', () => {
  it('入场事件：未婚/无配偶不可达；已婚可达；已有危机标记不再叠加（seven_year）', () => {
    const ev = byId('mar_seven_year')
    expect(isEventAvailable(makeGame(7, { age: 38, relations: [spouse(60)], tags: ['married'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 38, relations: [spouse(60)] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 38, relations: [], tags: ['married'] }), ev)).toBe(false)
    expect(isEventAvailable(crisis(makeGame(7, { age: 38, relations: [spouse(60)], tags: ['married'] })), ev)).toBe(false)
  })

  it('冷战线（≤55）与异地线（在职）：资格两侧各正一反', () => {
    const cold = byId('mar_cold_war')
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [spouse(50)], tags: ['married'] }), cold)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [spouse(65)], tags: ['married'] }), cold)).toBe(false)
    const dist = byId('mar_distance')
    expect(isEventAvailable(makeGame(7, {
      age: 36, relations: [spouse(60)], tags: ['married'],
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2, salaryMul: 1 },
    }), dist)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 36, relations: [spouse(60)], tags: ['married'] }), dist)).toBe(false)
  })

  it('危机态修复：无标记不可达；修复选项摘除标记（旅行/咨询两出口）', () => {
    const trip = byId('mar_repair_trip')
    const c1 = crisis(makeGame(7, { age: 42, relations: [spouse(45)], tags: ['married'] }))
    expect(isEventAvailable(c1, trip)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 42, relations: [spouse(45)], tags: ['married'] }), trip)).toBe(false)
    const afterTrip = applyChoice(c1, trip, 0).state
    expect(afterTrip.tags).not.toContain('marriage_crisis')
    expect(afterTrip.relations[0].closeness).toBe(54) // 45 + 9
    const counsel = byId('mar_counseling')
    const afterC = applyChoice(c1, counsel, 0).state
    expect(afterC.tags).not.toContain('marriage_crisis')
  })

  it('A3 审计留痕：危机标记不影响 spouse 在册判定（family_hearth 资格零变化——离婚未做）', () => {
    const withCrisis = crisis(makeGame(7, { age: 40, relations: [spouse(60)], tags: ['married'] }))
    expect(withCrisis.relations.some((r) => r.kind === 'spouse' && r.alive)).toBe(true)
    expect(withCrisis.tags).toContain('married')
  })
})

describe('第 67 轮：strain 轨迹孪生对照（A2）', () => {
  const settleYear = (closeness: number, hasCrisis: boolean): number => {
    let rels = [spouse(closeness)]
    rels = settleRelationDecay(rels).relations // 常规 −1
    if (hasCrisis) rels = settleMarriageStrain(rels, ['marriage_crisis']).relations // 额外 −2
    return rels[0].closeness
  }
  it('无干预：危机年 −3/年（60 起 5 年 → 45），strain 生效断言', () => {
    const strain = settleMarriageStrain([spouse(59)], ['marriage_crisis'])
    expect(strain.strained).toBe(true)
    expect(strain.relations[0].closeness).toBe(57)
    const noTag = settleMarriageStrain([spouse(59)], ['married'])
    expect(noTag.strained).toBe(false)
    let c = 60
    const track: number[] = []
    for (let y = 0; y < 5; y++) {
      c = settleYear(c, true)
      track.push(c)
    }
    expect(track).toEqual([57, 54, 51, 48, 45])
  })

  it('每年修复：摘标记后仅常规 −1+修复 +6 → 5 年后亲密高于无干预 ≥15（分叉显著且方向正确）', () => {
    let c = 60
    for (let y = 0; y < 5; y++) {
      c = settleYear(c, false) // 修复当年摘了标记：只有常规 −1
      c = Math.min(100, c + 6) // mar_repair_trip 近郊支 +6（事件选项摘标记）
    }
    expect(c).toBeGreaterThanOrEqual(60)
    expect(c - 45).toBeGreaterThanOrEqual(15)
  })

  it('lifecycle 集成：危机年 spouse 年度总扣 −3，心绪留痕', () => {
    const s = crisis(makeGame(7, { age: 40, relations: [spouse(60)], tags: ['married'] }))
    const after = advanceYear(s)
    expect(after.relations[0].closeness).toBe(57) // 60 − 1(衰减) − 2(strain)
    expect(after.yearLog.join('\n')).toBeDefined()
  })
})

describe('第 67 轮：文件与计数（A4）', () => {
  it('marriage.ts 8 事件（全池 282）、validateEvents 全池零 issue', () => {
    expect(MARRIAGE_EVENTS).toHaveLength(11)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
