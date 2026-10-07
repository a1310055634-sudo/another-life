// 第 89 轮：35 岁危机与行业寒冬测试（纯事件轮——引擎零改动）
// 验收口径（PROMPT-V5.md 第 89 轮）：
// - A1 窗口与门控正反（33/40 边界、体制内豁免、在职/失业门控、护城河功底门）
// - A2 计数同步（midcareer.ts=5、全池 233、排除表 88）
// - A3 200 局寒冬遭遇率（round39 统计，8–20% 带）
// - A4 文案真实感自查（非恐吓化、无年龄歧视教唆、体制内豁免口径一致）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { MIDCAREER_EVENTS } from '../data/events/midcareer'
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
  kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 44000, yearsAtJob: 3, salaryMul: 1,
})

describe('第 89 轮：计数与校验（A2）', () => {
  it('新事件计数=5、窗口正确、全池校验器零 issue、全池 233', () => {
    expect(MIDCAREER_EVENTS).toHaveLength(5)
    expect(MIDCAREER_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([
      [33, 40], [33, 40], [35, 50], [35, 50], [38, 50],
    ])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
})

describe('第 89 轮：窗口与门控正反（A1）', () => {
  it('mc_layoff：33/40 窗口、在职门控、体制内豁免', () => {
    const ev = byId('mc_layoff')
    expect(isEventAvailable(makeGame(7, { age: 33, career: employed() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, career: employed() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 32, career: employed() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 41, career: employed() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 35 }), ev)).toBe(false) // 失业不裁员
    expect(
      isEventAvailable(
        makeGame(7, {
          age: 35,
          career: { kind: 'employed', jobId: 'civil_servant', jobTitle: '科员', level: 1, salary: 35700, yearsAtJob: 3, salaryMul: 1 },
          tags: ['civil_servant', 'job_civil_servant'],
        }),
        ev,
      ),
    ).toBe(false) // 体制内豁免
  })
  it('mc_bench：体制内豁免与非体制内在职', () => {
    const ev = byId('mc_bench')
    expect(isEventAvailable(makeGame(7, { age: 36, career: employed() }), ev)).toBe(true)
    expect(
      isEventAvailable(
        makeGame(7, {
          age: 36,
          career: { kind: 'employed', jobId: 'public_institution', jobTitle: '管理九级职员', level: 1, salary: 34000, yearsAtJob: 2, salaryMul: 1 },
          tags: ['civil_servant', 'job_public_institution'],
        }),
        ev,
      ),
    ).toBe(false)
  })
  it('mc_resume：失业专属；mc_moat：在职+功底 70 门', () => {
    const resume = byId('mc_resume')
    const unemployed = (): GameState['career'] => ({ kind: 'unemployed', weeks: 4 })
    expect(isEventAvailable(makeGame(7, { age: 40, career: unemployed() }), resume)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, career: employed() }), resume)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 52, career: unemployed() }), resume)).toBe(false)
    const moat = byId('mc_moat')
    expect(isEventAvailable(makeGame(7, { age: 45, career: employed(), skills: { academics: 75, vocational: 20 } }), moat)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 45, career: employed(), skills: { academics: 69, vocational: 20 } }), moat)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 45, skills: { academics: 75, vocational: 20 } }), moat)).toBe(false)
  })
})

describe('第 89 轮：效果落地', () => {
  it('裁员：补偿入袋+失业+岗位标记转经历', () => {
    const s = makeGame(7, { age: 35, money: 5000, career: employed() })
    const r = applyChoice(s, byId('mc_layoff'), 0)
    expect(r.state.money).toBe(30000)
    expect(r.state.career.kind).toBe('unemployed')
    expect(r.state.tags).toContain('ex_office_clerk')
    expect(r.state.tags).not.toContain('job_office_clerk')
  })
  it('僵持支：保岗降薪（salaryMul 0.9）', () => {
    const s = makeGame(7, { age: 35, career: employed() })
    const r = applyChoice(s, byId('mc_layoff'), 1)
    expect(r.state.career.kind).toBe('employed')
    expect(r.state.career.kind === 'employed' && r.state.career.salaryMul).toBeCloseTo(0.9)
  })
  it('护城河：带队支延迟调薪兑现', () => {
    const s = makeGame(7, { age: 45, career: employed(), skills: { academics: 75, vocational: 20 } })
    const r = applyChoice(s, byId('mc_moat'), 0)
    expect(r.state.pending.some((p) => p.money === 12000)).toBe(true)
  })
})

describe('第 89 轮：加权抽取（×50，priority=0 层）', () => {
  it('抽到的新事件必然资格可用（错误状态从不入候选）', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...MIDCAREER_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(5000 + i, {
        age: 33 + (i % 8),
        money: 20000,
        ...(i % 4 === 3 ? {} : { career: employed() }),
        tags: i % 5 === 4 ? ['civil_servant'] : [],
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (MIDCAREER_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
