// 第 88 轮：体制内线测试（考公路线+体制内生涯+岗位系数）
// 验收口径（PROMPT-V5.md 第 88 轮）：
// - A1 titles 不变量（全 11 岗位）+computeSalary 系数断言（0.85/0.9/缺省 1）
// - A2 考公链正反（无备考不可考试/落榜清标记可再战/录取转岗+tag/在编防重）
// - A3 录取支流 seed 确定性（同 seed 同 age 同结果；academics 门槛恒落榜）
// - A4 退休金加成（pensionBonus 1.1）；寒冬豁免门控通道预验（tagsNone civil_servant）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateEvents } from './validateEvents'
import { isEventAvailable, visibleChoices, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { computeSalary } from '../data/careers'
import { JOB_CATALOG, getJob } from '../data/careers'
import { retirePatch } from './career'
import { ALL_EVENTS } from '../data/events'
import { CIVILSERVICE_EVENTS } from '../data/events/civilservice'
import { civilExamAdmitted, CIVIL_EXAM_PASS_RATE, CIVIL_EXAM_ACADEMICS } from './civilservice'
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
const bachelor = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  education: 'bachelor',
  skills: { ...(makeGame().skills), academics: 60 },
  ...patch,
})

describe('第 88 轮：岗位与系数（A1）', () => {
  it('titles 不变量：11 岗位 titles 长度=maxLevel 且 titles[0]=title', () => {
    expect(JOB_CATALOG).toHaveLength(11)
    for (const j of JOB_CATALOG) {
      if (j.titles) {
        expect(j.titles).toHaveLength(j.maxLevel ?? 4)
        expect(j.titles[0]).toBe(j.title)
      }
    }
    const civil = getJob('civil_servant')
    expect(civil?.titles).toEqual(['科员', '副主任科员', '主任科员', '副处级'])
    const inst = getJob('public_institution')
    expect(inst?.titles?.[3]).toBe('管理六级职员')
  })
  it('computeSalary 系数：公务员 0.85/事业编 0.9/无字段岗位 1（缺省零变化）', () => {
    const civil = getJob('civil_servant')!
    const inst = getJob('public_institution')!
    const clerk = getJob('office_clerk')!
    // 绝对值口径：civil minEducation=bachelor（bachelor 无溢价）；inst/clerk minEducation=college
    // （bachelor 高一档 +5% 学历溢价）；level 1/工龄 0/30 岁行业系数 1.0
    expect(computeSalary('bachelor', 30, civil, 1, 0)).toBe(35700) // 42000×0.85
    expect(computeSalary('bachelor', 30, inst, 1, 0)).toBe(34000) // 36000×1.05×0.9
    expect(computeSalary('bachelor', 30, clerk, 1, 0)).toBe(46200) // 44000×1.05（无系数）
  })
  it('退休金加成：公务员退休 pension=基准×1.1（与同薪无加成岗位对照）', () => {
    const civState = makeGame(7, {
      age: 62,
      career: { kind: 'employed', jobId: 'civil_servant', jobTitle: '科员', level: 1, salary: 42000, yearsAtJob: 5, salaryMul: 1 },
      workYears: 5,
    })
    const r1 = retirePatch(civState)
    expect(r1.ok).toBe(true)
    const sameSalary = makeGame(7, {
      age: 62,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 42000, yearsAtJob: 5, salaryMul: 1 },
      workYears: 5,
    })
    const r2 = retirePatch(sameSalary)
    expect(r2.ok).toBe(true)
    // pensionFromSalary 各自取整——加成 1.1 倍允许 ±200 元取整容差，方向恒正
    const p1 = (r1.career as { pension: number }).pension
    const p2 = (r2.career as { pension: number }).pension
    expect(p1).toBeGreaterThanOrEqual(p2 * 1.09)
    expect(p1).toBeLessThanOrEqual(p2 * 1.11)
  })
})

describe('第 88 轮：录取支流（A3）', () => {
  it('同 seed/age/academics 恒同果；academics 低于 55 恒落榜；概率表冻结', () => {
    expect(CIVIL_EXAM_PASS_RATE).toBe(0.45)
    expect(CIVIL_EXAM_ACADEMICS).toBe(45)
    for (const age of [22, 28, 34]) {
      expect(civilExamAdmitted(20260917, age, 60)).toBe(civilExamAdmitted(20260917, age, 60))
    }
    expect(civilExamAdmitted(42, 30, 44)).toBe(false)
    expect(civilExamAdmitted(42, 31, 44)).toBe(false)
  })
})

describe('第 88 轮：考公链与体制内事件（A2）', () => {
  it('新事件计数=5、窗口正确、全池校验器零 issue', () => {
    expect(CIVILSERVICE_EVENTS).toHaveLength(5)
    expect(CIVILSERVICE_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([
      [20, 35], [20, 40], [28, 50], [25, 45], [30, 55],
    ])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('链路正反：大专可备考（事业编通道）；考试资格=学位+功底 45（备考非唯一门票）；在编不可考', () => {
    const prep = byId('civ_exam_prep')
    const exam = byId('civ_exam')
    expect(isEventAvailable(makeGame(7, { age: 28, ...bachelor() }), prep)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 28, education: 'college', skills: { ...(makeGame().skills), academics: 60 } }), prep)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 28 }), prep)).toBe(false) // 高中及以下不可
    expect(isEventAvailable(makeGame(7, { age: 28, ...bachelor(), tags: ['civil_servant'] }), prep)).toBe(false) // 在编不考
    // 考试资格：college+学位 且 academics≥45（裸考真实存在，备考是达标途径之一）
    expect(isEventAvailable(makeGame(7, { age: 28, education: 'college', skills: { ...(makeGame().skills), academics: 60 } }), exam)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 28, education: 'college', skills: { ...(makeGame().skills), academics: 44 } }), exam)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 41, education: 'college', skills: { ...(makeGame().skills), academics: 60 } }), exam)).toBe(false) // 35+40 窗外
    expect(isEventAvailable(makeGame(7, { age: 28, education: 'college', skills: { ...(makeGame().skills), academics: 60 }, tags: ['civil_servant'] }), exam)).toBe(false) // 在编
  })

  it('录取转岗：academics 达标+可用 seed → 入职科员+civil_servant 标记+备考标记清除', () => {
    // 找一个 28 岁录取为真的 seed
    let seed = -1
    for (let s0 = 1; s0 < 500; s0++) {
      if (civilExamAdmitted(s0, 28, 60)) { seed = s0; break }
    }
    expect(seed).toBeGreaterThan(0)
    const s = makeGame(seed, { age: 28, ...bachelor(), tags: ['civil_exam_prep'] })
    const ev = byId('civ_exam')
    const r = applyChoice(s, ev, 0)
    expect(r.state.career.kind).toBe('employed')
    expect(r.state.career.kind === 'employed' && r.state.career.jobId).toBe('civil_servant')
    expect(r.state.tags).toContain('civil_servant')
    expect(r.state.tags).toContain('job_civil_servant')
  })

  it('落榜再战：academics 不足恒落榜→备考标记移除（可再备考）', () => {
    const s = makeGame(42, { age: 28, ...bachelor({ skills: { ...(makeGame().skills), academics: 50 } }), tags: ['civil_exam_prep'] })
    const ev = byId('civ_exam')
    const r = applyChoice(s, ev, 0)
    expect(r.state.tags).not.toContain('civil_exam_prep')
    expect(r.state.tags).not.toContain('civil_servant')
    expect(r.state.career.kind).not.toBe('employed')
  })

  it('寒冬豁免门控通道预验：tagsNone civil_servant 门控在位（在编不可用）', () => {
    // R89 行业寒冬事件将以同一通道豁免体制内——此处用 civ_exam 的 tagsNone 预验语义
    const exam = byId('civ_exam')
    expect(exam.requires?.tagsNone).toContain('civil_servant')
    const withTag = makeGame(7, { age: 28, ...bachelor(), tags: ['civil_exam_prep', 'civil_servant'] })
    expect(isEventAvailable(withTag, exam)).toBe(false)
  })

  it('体制内生涯事件：无编不可用；在编可用且 promotionAvailable 控制遴选选项', () => {
    const politics = byId('civ_office_politics')
    const ceiling = byId('civ_ceiling')
    expect(isEventAvailable(makeGame(7, { age: 35 }), politics)).toBe(false)
    const inJob = makeGame(7, {
      age: 35,
      career: { kind: 'employed', jobId: 'civil_servant', jobTitle: '科员', level: 1, salary: 35700, yearsAtJob: 3, salaryMul: 1 },
      tags: ['civil_servant', 'job_civil_servant'],
    })
    expect(isEventAvailable(inJob, politics)).toBe(true)
    expect(isEventAvailable(inJob, ceiling)).toBe(true)
    // level 1 可晋升 → 遴选冲刺选项可见；两条选项均可见（≥2 红线）
    const vis = visibleChoices(inJob, ceiling)
    expect(vis.length).toBe(2)
    // 满级（level 4）→ promotionAvailable false → 冲刺隐藏，只剩留守 1 项=事件不可用（天花板体感）
    const maxed = makeGame(7, {
      age: 35,
      career: { kind: 'employed', jobId: 'civil_servant', jobTitle: '副处级', level: 4, salary: 50000, yearsAtJob: 10, salaryMul: 1 },
      tags: ['civil_servant', 'job_civil_servant'],
    })
    expect(visibleChoices(maxed, ceiling).length).toBe(1)
    expect(isEventAvailable(maxed, ceiling)).toBe(false)
  })

  it('加权抽取（新事件 ×50，priority=0 层）：抽到的新事件必然资格可用', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...CIVILSERVICE_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(4000 + i, {
        age: 30,
        education: 'bachelor',
        skills: { ...(makeGame().skills), academics: 60 },
        money: 20000,
        tags: i % 2 === 0 ? ['civil_exam_prep', 'job_civil_servant'] : [],
        career:
          i % 3 === 0
            ? { kind: 'employed', jobId: 'civil_servant', jobTitle: '科员', level: 1, salary: 35700, yearsAtJob: 2, salaryMul: 1 }
            : { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 30000, yearsAtJob: 2, salaryMul: 1 },
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (CIVILSERVICE_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
