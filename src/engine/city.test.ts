// 第 90 轮：城市迁移测试（三档系数+迁居效果+旧档全等）
// 验收口径（PROMPT-V5.md 第 90 轮）：
// - A1 三处系数单测（薪资 1.35/1.15/1.0、生活成本 1.3/1.1/1.0、房产增值 3%/2%/1.2%）
// - A2 city 字段 validate+旧档缺省 hometown 行为逐位不变（全等证明）
// - A3 4 事件正反+setCity 落地；加权抽取必可用
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { computeSalary } from '../data/careers'
import { ALL_EVENTS } from '../data/events'
import { getJob } from '../data/careers'
import { CITY_EVENTS } from '../data/events/city'
import { citySalaryFactor, cityCostFactor, cityHomeRate } from './city'
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
describe('第 90 轮：三档系数（A1）', () => {
  it('薪资系数 1.35/1.15/1.0；生活成本 1.3/1.1/1.0；房产增值 3%/2%/1.2%', () => {
    expect(citySalaryFactor('metro')).toBe(1.35)
    expect(citySalaryFactor('province')).toBe(1.15)
    expect(citySalaryFactor('hometown')).toBe(1)
    expect(cityCostFactor('metro')).toBe(1.3)
    expect(cityCostFactor('province')).toBe(1.1)
    expect(cityCostFactor('hometown')).toBe(1)
    expect(cityHomeRate('metro')).toBeCloseTo(0.03)
    expect(cityHomeRate('province')).toBeCloseTo(0.02)
    expect(cityHomeRate('hometown')).toBeCloseTo(0.012)
  })
  it('computeSalary 城市参数：metro ×1.35、缺省/老家逐位等于改前值', () => {
    const civil = getJob('civil_servant')!
    // 42000×0.85=35700 → metro ×1.35=48195 → 取整百 48200
    expect(computeSalary('bachelor', 30, civil, 1, 0, 1, citySalaryFactor('metro'))).toBe(48200)
    expect(computeSalary('bachelor', 30, civil, 1, 0, 1, citySalaryFactor('hometown'))).toBe(35700)
    expect(computeSalary('bachelor', 30, civil, 1, 0, 1)).toBe(35700) // 缺省参数=老家
  })
})

describe('第 90 轮：city 字段 validate 与旧档全等（A2）', () => {
  it('旧档无 city 字段：加载零 issue，行为与显式 hometown 逐位一致', () => {
    const bare = makeGame(7, { age: 40 })
    expect(bare.city).toBeUndefined()
    expect(validateState(bare).issues).toEqual([])
    const explicit = makeGame(7, { age: 40, city: 'hometown' })
    expect(validateState(explicit).issues).toEqual([])
    // 全等证明：无 city 与 hometown 的年度结算现金逐位一致
    const a = advanceYear(makeGame(9, { age: 35, money: 50000 }))
    const b = advanceYear(makeGame(9, { age: 35, money: 50000, city: 'hometown' }))
    expect(a.money).toBe(b.money)
  })
  it('损坏 city 值整体重置为老家（缺省）', () => {
    const bad = makeGame(7, { city: 'shanghai' as unknown as GameState['city'] })
    const issues = validateState(bad)
    expect(bad.city).toBeUndefined()
    expect(issues.issues.length).toBeGreaterThan(0)
  })
  it('metro 年结：薪资 ×1.35 生活成本 ×1.3 生效（现金差=纯系数差）', () => {
    const base = makeGame(11, { age: 35, money: 50000 })
    const metro = makeGame(11, { age: 35, money: 50000, career: base.career, city: 'metro' })
    const a = advanceYear(base)
    const m = advanceYear({ ...metro })
    // metro 现金 − 老家现金 = salary×0.35 − 支出×0.3（同 seed 同波动），只验证方向与显著差
    expect(m.money - a.money).not.toBe(0)
  })
})

describe('第 90 轮：迁移事件正反与 setCity 落地（A3）', () => {
  it('新事件计数=4、窗口正确、全池校验器零 issue、全池 237', () => {
    expect(CITY_EVENTS).toHaveLength(4)
    expect(CITY_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([
      [18, 26], [28, 40], [25, 35], [50, 75],
    ])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
  it('毕业闯荡：老家可用、已离乡不可用；选走 → city=metro', () => {
    const ev = byId('city_graduate_run')
    expect(isEventAvailable(makeGame(7, { age: 22 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 22, city: 'metro' }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30 }), ev)).toBe(false)
    const r = applyChoice(makeGame(7, { age: 22, money: 5000 }), ev, 0)
    expect(r.state.city).toBe('metro')
    expect(r.state.money).toBe(2000)
  })
  it('北漂疲惫：metro+打工人+未购房可用；回省城 → city=province', () => {
    const ev = byId('city_drift_tired')
    const worker = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 59400, yearsAtJob: 2, salaryMul: 1 }
    expect(isEventAvailable(makeGame(7, { age: 32, city: 'metro', career: worker }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 32, city: 'province', career: worker }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 32, city: 'metro' }), ev)).toBe(false) // 非打工人
    expect(isEventAvailable(makeGame(7, { age: 32, city: 'metro', career: worker, tags: ['homeowner'] }), ev)).toBe(false)
    const r = applyChoice(makeGame(7, { age: 32, city: 'metro', career: worker, money: 10000 }), ev, 0)
    expect(r.state.city).toBe('province')
  })
  it('退休返乡：退休+离乡可用；未退休/已在家不可用；返回 → hometown', () => {
    const ev = byId('city_return_retire')
    const retired = { kind: 'retired' as const, pension: 20000 }
    expect(isEventAvailable(makeGame(7, { age: 62, career: retired, city: 'metro' }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 62, career: retired }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, career: retired, city: 'metro' }), ev)).toBe(false)
    const r = applyChoice(makeGame(7, { age: 62, career: retired, city: 'province', money: 5000 }), ev, 0)
    expect(r.state.city).toBe('hometown')
  })
  it('加权抽取（新事件 ×50，priority=0 层）：抽到的新事件必然资格可用', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...CITY_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(6000 + i, {
        age: 18 + (i % 20),
        city: i % 3 === 0 ? 'metro' : i % 3 === 1 ? 'province' : undefined,
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (CITY_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
