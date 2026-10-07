// 第 92 轮：留学与职校双线测试（教育路径宽度）
// 验收口径（PROMPT-V5.md 第 92 轮）：
// - A1 留学链正反（学历不足/钱不够/smarts 不足/贷款变体/苦读落地学历升档）
// - A2 海归加成（salaryMul 1.05+签字费）与落差断言（returnee+失业门）
// - A3 职校线（vocational 12/大国工匠 minVocational 70 门+delayed 调薪）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { V5EDU_EVENTS } from '../data/events/v5edu'
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
const bachelor = (smarts = 65, money = 250000): Partial<GameState> => ({
  education: 'bachelor',
  skills: { academics: 60, vocational: 20 },
  attrs: { ...makeGame().attrs, smarts },
  money,
})

describe('第 92 轮：计数与校验', () => {
  it('新事件计数=6、窗口正确、全池校验器零 issue、全池 248', () => {
    expect(V5EDU_EVENTS).toHaveLength(6)
    expect(V5EDU_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([
      [20, 30], [20, 32], [24, 40], [24, 38], [22, 45], [30, 50],
    ])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
})

describe('第 92 轮：留学链正反（A1）', () => {
  it('留学抉择资格四路：达标可；钱不够/smarts 不足/大专不可；高中不可', () => {
    const ev = byId('ab_choice')
    expect(isEventAvailable(makeGame(7, { age: 24, ...bachelor() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 24, ...bachelor(65, 150000) }), ev)).toBe(false) // 钱不够
    expect(isEventAvailable(makeGame(7, { age: 24, ...bachelor(50, 250000) }), ev)).toBe(false) // smarts 不足
    expect(isEventAvailable(makeGame(7, { age: 24, education: 'college', skills: { academics: 60, vocational: 20 }, attrs: { ...makeGame().attrs, smarts: 65 }, money: 250000 }), ev)).toBe(false) // 大专不可（本科起步）
    expect(isEventAvailable(makeGame(7, { age: 24, education: 'highschool', money: 250000 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 24, education: 'master', attrs: { ...makeGame().attrs, smarts: 65 }, money: 250000 }), ev)).toBe(true) // 硕士深造亦可
  })
  it('自费支落地：扣 20 万+abroad_year 标记；贷款支：押金 2 万+三年学贷 18 万挂起', () => {
    const s = makeGame(7, { age: 24, ...bachelor() })
    const r1 = applyChoice(s, byId('ab_choice'), 0)
    expect(r1.state.money).toBe(50000)
    expect(r1.state.tags).toContain('abroad_year')
    const r2 = applyChoice(s, byId('ab_choice'), 1)
    expect(r2.state.money).toBe(230000)
    expect(r2.state.pending.filter((p) => p.money === -60000)).toHaveLength(3)
    expect(r2.state.tags).toContain('abroad_year')
  })
  it('苦读落地：学历升 master+smarts+6+returnee/studied_abroad 双标记+清 abroad_year', () => {
    const s = makeGame(7, { age: 25, education: 'bachelor', tags: ['abroad_year'], money: 100000 })
    const r = applyChoice(s, byId('ab_study'), 0)
    expect(r.state.education).toBe('master')
    expect(r.state.attrs.smarts).toBe(Math.min(100, makeGame(7).attrs.smarts + 6))
    expect(r.state.tags).toContain('returnee')
    expect(r.state.tags).toContain('studied_abroad')
    expect(r.state.tags).not.toContain('abroad_year')
    // 休学支：无学历升档、无 returnee、情绪代价
    const s2 = makeGame(7, { age: 25, education: 'bachelor', tags: ['abroad_year'], money: 100000 })
    const r2 = applyChoice(s2, byId('ab_study'), 1)
    expect(r2.state.education).toBe('bachelor')
    expect(r2.state.tags).not.toContain('returnee')
    expect(r2.state.attrs.happiness).toBe(s2.attrs.happiness - 3)
  })
})

describe('第 92 轮：海归加成与落差（A2）', () => {
  it('ab_job_hunt：returnee 专属；签字费支+在职调薪 1.05', () => {
    const ev = byId('ab_job_hunt')
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['returnee'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30 }), ev)).toBe(false)
    const worker = { career: { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 44000, yearsAtJob: 2, salaryMul: 1 } }
    const r = applyChoice(makeGame(7, { age: 30, tags: ['returnee'], money: 5000, ...worker }), ev, 0)
    expect(r.state.money).toBe(13000)
    expect(r.state.career.kind === 'employed' && r.state.career.salaryMul).toBeCloseTo(1.05)
  })
  it('ab_gap：returnee+无业可；在职不可；落地抉择', () => {
    const ev = byId('ab_gap')
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['returnee'] }), ev)).toBe(true)
    expect(
      isEventAvailable(
        makeGame(7, { age: 30, tags: ['returnee'], career: { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: 'x', level: 1, salary: 44000, yearsAtJob: 1, salaryMul: 1 } }),
        ev,
      ),
    ).toBe(false)
    const r = applyChoice(makeGame(7, { age: 30, tags: ['returnee'] }), ev, 1)
    expect(r.state.skills.academics).toBeGreaterThanOrEqual(3)
  })
})

describe('第 92 轮：职校线（A3）', () => {
  it('voc_night_school：在职可/失业不可；落地 vocational +12', () => {
    const ev = byId('voc_night_school')
    const worker = { career: { kind: 'employed' as const, jobId: 'electrician', jobTitle: '电工', level: 1, salary: 38000, yearsAtJob: 2, salaryMul: 1 } }
    expect(isEventAvailable(makeGame(7, { age: 30, ...worker }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30 }), ev)).toBe(false)
    const s = makeGame(7, { age: 30, money: 10000, ...worker })
    const r = applyChoice(s, ev, 0)
    expect(r.state.skills.vocational).toBe(Math.min(100, s.skills.vocational + 12))
  })
  it('voc_craft_master：vocational≥70 门（在职）；落地 delayed 调薪 12,000', () => {
    const ev = byId('voc_craft_master')
    const master = { career: { kind: 'employed' as const, jobId: 'electrician', jobTitle: '电工', level: 2, salary: 42000, yearsAtJob: 5, salaryMul: 1 } }
    expect(isEventAvailable(makeGame(7, { age: 40, ...master, skills: { academics: 40, vocational: 75 } }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, ...master, skills: { academics: 40, vocational: 69 } }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, skills: { academics: 40, vocational: 75 } }), ev)).toBe(false)
    const s = makeGame(7, { age: 40, ...master, skills: { academics: 40, vocational: 75 } })
    const r = applyChoice(s, ev, 0)
    expect(r.state.pending.some((p) => p.money === 12000)).toBe(true)
  })
})

describe('第 92 轮：加权抽取（×50，priority=0 层）', () => {
  it('抽到的新事件必然资格可用（错误状态从不入候选）', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...V5EDU_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(8000 + i, {
        age: 20 + (i % 25),
        education: i % 2 === 0 ? 'bachelor' : 'highschool',
        money: 300000,
        skills: { academics: 65, vocational: i % 3 === 0 ? 75 : 30 },
        career: i % 2 === 0 ? { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: 'x', level: 1, salary: 44000, yearsAtJob: 1, salaryMul: 1 } : { kind: 'none' },
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (V5EDU_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
