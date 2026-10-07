// 第 9 轮测试：职业系统
// 覆盖：岗位门槛与学历溢价起薪、入职/离职/转行/再就业全循环（含标记交换）、
// 事件晋升与年度考核晋升、年薪调整、工龄/待业年度结算、岗位压力差异、
// 防软锁长跑、风险收益分化、事件可达性、同 seed 复现。
import { describe, it, expect } from 'vitest'
import type { GameEvent, GameState } from './types'
import { createNewGame } from './init'
import { advanceYear, naturalAttrDrift } from './lifecycle'
import { startSession, chooseOption, nextYear, type Session } from './session'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import {
  JOB_CATALOG,
  getJob,
  isEligibleFor,
  promotionThreshold,
  startingSalary,
} from '../data/careers'
import {
  applySalaryMul,
  employPatch,
  endEmploymentPatch,
  promotePatch,
  settleCareerYear,
} from './career'

const CAREER_EVENT_IDS = [
  'car_job_board',
  'car_office_recruit',
  'car_campus_recruit',
  'car_first_paycheck',
  'car_promotion_push',
  'car_industry_winter',
  'car_skill_pivot',
  'car_dev_midlife',
  'car_nurse_shifts',
  'car_teacher_class',
  'car_old_boss_call',
]

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件 ${id} 不存在`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' })
  return { ...base, ...patch }
}

/** 造一个在职状态（jobId 必须在 JOB_CATALOG 里） */
function makeEmployed(jobId: string, patch: Partial<GameState> = {}, level = 1): GameState {
  const job = getJob(jobId)!
  return makeGame(7, {
    age: 25,
    career: {
      kind: 'employed',
      jobId,
      jobTitle: job.title,
      level,
      salary: startingSalary({ ...makeGame(7), education: job.minEducation }, job),
      yearsAtJob: 0,
    },
    ...patch,
  })
}

// ── 职业表与门槛 ───────────────────────────────────────────

describe('职业表数据', () => {
  it('9 个岗位配置完整，覆盖至少 4 个职业方向，曲线参数为正', () => {
    expect(JOB_CATALOG.length).toBeGreaterThanOrEqual(9)
    const tracks = new Set(JOB_CATALOG.map((j) => j.track))
    expect(tracks.size).toBeGreaterThanOrEqual(4)
    for (const j of JOB_CATALOG) {
      expect(j.baseSalary).toBeGreaterThan(0)
      expect(j.levelRaise ?? 1.15).toBeGreaterThan(1)
      expect(j.maxLevel ?? 4).toBeGreaterThanOrEqual(1)
      expect(j.stressPerYear ?? 3).toBeGreaterThanOrEqual(0)
      expect(j.promoteEvery ?? 3).toBeGreaterThanOrEqual(1)
    }
  })

  it('isEligibleFor：学历与技能双门槛同时生效，压线可过', () => {
    const hs = { ...makeGame(1), education: 'highschool' as const, skills: { academics: 20, vocational: 25 } }
    expect(isEligibleFor(hs, getJob('warehouse_keeper')!)).toBe(true) // 高中+技能25 压线
    expect(isEligibleFor(hs, getJob('electrician')!)).toBe(false) // 技能 45 不够
    expect(isEligibleFor({ ...hs, education: 'junior' as const }, getJob('warehouse_keeper')!)).toBe(false)
    const bachelor = { ...makeGame(2), education: 'bachelor' as const, skills: { academics: 55, vocational: 15 } }
    expect(isEligibleFor(bachelor, getJob('junior_dev')!)).toBe(true)
    expect(isEligibleFor(bachelor, getJob('teacher')!)).toBe(false) // 学业 60 不够
  })

  it('起薪学历溢价：每高出门槛一档 +5%，取整到百元', () => {
    const s = { ...makeGame(3), education: 'college' as const }
    expect(startingSalary(s, getJob('office_clerk')!)).toBe(44000)
    expect(startingSalary({ ...s, education: 'bachelor' }, getJob('office_clerk')!)).toBe(46200)
    expect(startingSalary({ ...s, education: 'master' }, getJob('junior_dev')!)).toBe(100800)
    expect(startingSalary({ ...s, education: 'phd' }, getJob('junior_dev')!)).toBe(105600)
  })

  it('晋升技能门槛 = 岗位主门槛 + 每级 +8', () => {
    expect(promotionThreshold(getJob('junior_dev')!, 2)).toBe(63)
    expect(promotionThreshold(getJob('junior_dev')!, 3)).toBe(71)
    expect(promotionThreshold(getJob('electrician')!, 2)).toBe(53) // vocational 45+8
  })
})

// ── 入职 / 离职 / 转行 / 再就业 ────────────────────────────

describe('employPatch 入职', () => {
  it('门槛达标：入职成功，职级 1、溢价起薪、岗位标记与 ever_employed', () => {
    const s = { ...makeGame(1), skills: { academics: 20, vocational: 25 } }
    const patch = employPatch(s, 'stall_vendor')
    expect(patch.ok).toBe(true)
    // 高中学历高于初中门槛一档：30000×1.05 = 31500（第 22 轮起 EmployedState 带 salaryMul 字段）
    expect(patch.career).toEqual({
      kind: 'employed', jobId: 'stall_vendor', jobTitle: '市集摊主', level: 1, salary: 31500, yearsAtJob: 0, salaryMul: 1,
    })
    expect(patch.addTags).toContain('job_stall_vendor')
    expect(patch.addTags).toContain('ever_employed')
  })

  it('在读不能签劳动合同', () => {
    const student = makeGame(2, { career: { kind: 'student', stage: 'college', yearsLeft: 2 } })
    const patch = employPatch(student, 'stall_vendor')
    expect(patch.ok).toBe(false)
    expect(patch.reason).toContain('在读')
  })

  it('门槛不足与未知岗位被拒绝；在职重复入职同一岗位被拒绝', () => {
    const weak = makeGame(3) // vocational 15 < 20
    expect(employPatch(weak, 'stall_vendor').ok).toBe(false)
    expect(employPatch(weak, 'nonexistent_job').ok).toBe(false)
    const clerk = makeEmployed('office_clerk')
    expect(employPatch(clerk, 'office_clerk').ok).toBe(false)
  })

  it('转行：旧岗位标记转 ex_（经历保留），新岗位标记与起薪生效', () => {
    const clerk = makeEmployed('office_clerk', {
      skills: { academics: 35, vocational: 45 },
      tags: ['ever_employed', 'job_office_clerk'],
    })
    const patch = employPatch(clerk, 'electrician')
    expect(patch.ok).toBe(true)
    expect(patch.career.kind).toBe('employed')
    if (patch.career.kind === 'employed') {
      expect(patch.career.jobId).toBe('electrician')
      expect(patch.career.level).toBe(1) // 转行从头起步
      expect(patch.career.salary).toBe(52000)
    }
    expect(patch.removeTags).toContain('job_office_clerk')
    expect(patch.addTags).toContain('ex_office_clerk')
    expect(patch.addTags).toContain('job_electrician')
  })
})

describe('endEmploymentPatch 离职', () => {
  it('被裁：进入待业（weeks 0），job_ 转 ex_，留 laid_off 标记', () => {
    const dev = makeEmployed('junior_dev', { tags: ['ever_employed', 'job_junior_dev'] })
    const patch = endEmploymentPatch(dev, 'laid_off')
    expect(patch.ok).toBe(true)
    expect(patch.career).toEqual({ kind: 'unemployed', weeks: 0 })
    expect(patch.addTags).toEqual(['ex_junior_dev', 'laid_off'])
    expect(patch.removeTags).toEqual(['job_junior_dev'])
  })

  it('主动辞职留 resigned 标记；无业者离职是 no-op', () => {
    const dev = makeEmployed('junior_dev')
    const quit = endEmploymentPatch(dev, 'resigned')
    expect(quit.addTags).toContain('resigned')
    const none = makeGame(4)
    expect(endEmploymentPatch(none, 'laid_off').ok).toBe(false)
  })
})

describe('promotePatch 与调薪', () => {
  it('事件晋升：职级 +1、按倍率涨薪（程序员 1.28 倍精确）', () => {
    const dev = makeEmployed('junior_dev') // salary 96000
    const patch = promotePatch(dev)
    expect(patch.ok).toBe(true)
    expect(patch.career.kind).toBe('employed')
    if (patch.career.kind === 'employed') {
      expect(patch.career.level).toBe(2)
      expect(patch.career.salary).toBe(122900) // 96000×1.28=122880 → 百元取整 122900
      expect(patch.career.yearsAtJob).toBe(0)
    }
  })

  it('到顶后不能再晋升；无业者不能晋升', () => {
    const job = getJob('junior_dev')!
    const top = makeEmployed('junior_dev', {
      career: {
        kind: 'employed', jobId: 'junior_dev', jobTitle: job.title,
        level: 4, salary: 200000, yearsAtJob: 0,
      },
    })
    expect(promotePatch(top).ok).toBe(false)
    expect(promotePatch(makeGame(5)).ok).toBe(false)
  })

  // 第 22 轮公式化调薪：倍率写入 EmployedState.salaryMul 存量字段并按公式重推年薪；
  // 基准 96000 = 25 岁 · 职级 1 · 工龄 0 · 学历溢价 0 · 景气 1.0，单次应用与旧 adjustSalary 数值一致
  it('applySalaryMul：倍率写入存量字段并按公式重推（夹 0.5～2，百元取整）', () => {
    const base = makeEmployed('junior_dev')
    const cut = applySalaryMul(base, 0.88)
    expect(cut).toMatchObject({ kind: 'employed', salaryMul: 0.88, salary: 84500 }) // 96000×0.88=84480 → 84500
    const raised = applySalaryMul(base, 1.05)
    expect(raised).toMatchObject({ salaryMul: 1.05, salary: 100800 })
    const capped = applySalaryMul(base, 3)
    expect(capped).toMatchObject({ salaryMul: 2, salary: 192000 }) // 夹到 2 倍
    const floored = applySalaryMul(base, 0.1)
    expect(floored).toMatchObject({ salaryMul: 0.5, salary: 48000 }) // 夹到 0.5 倍
  })

  it('applySalaryMul：倍率叠加进存量字段，逐次相乘后夹界', () => {
    const base = makeEmployed('junior_dev')
    const once = applySalaryMul(base, 0.88)
    const twice = applySalaryMul({ ...base, career: once }, 0.88)
    expect(twice).toMatchObject({ kind: 'employed', salaryMul: 0.7744, salary: 74300 }) // 96000×0.7744=74342.4 → 74300
  })
})

// ── 年度结算：工龄 / 调薪 / 考核晋升 / 待业 ────────────────

describe('settleCareerYear 年度结算', () => {
  // 第 22 轮公式化：年薪不再 ×1.02 复利，改为工龄系数（首年 +3.5%）
  it('在职每年缴费年限 +1、年薪按公式重推（工龄系数首年 +3.5%，百元取整精确）', () => {
    const dev = makeEmployed('junior_dev') // 96000, yearsAtJob 0
    const out = settleCareerYear(dev, { academics: 30, vocational: 15 })
    expect(out.career).toMatchObject({ level: 1, salary: 99400, yearsAtJob: 1 }) // 96000×1.035=99360 → 99400
    expect(out.workYears).toBe(1)
    expect(out.history).toBeUndefined()
    expect(out.notes).toEqual([])
  })

  it('满年限且技能过门槛：年度考核晋升（职级系数随晋升重推，工龄不清零，精确）', () => {
    const job = getJob('junior_dev')!
    const dev = makeEmployed('junior_dev', { workYears: 2 })
    dev.career = { kind: 'employed', jobId: 'junior_dev', jobTitle: job.title, level: 1, salary: 96000, yearsAtJob: 2 }
    const out = settleCareerYear(dev, { academics: 63, vocational: 15 }) // 63 = 55+8 压线
    expect(out.career).toMatchObject({ level: 2, yearsAtJob: 0 })
    if (out.career.kind === 'employed') {
      // 96000×1.28(职级2)×1.105(工龄3年)=135782.4 → 135800；工龄系数不清零
      expect(out.career.salary).toBe(135800)
    }
    expect(out.workYears).toBe(3)
    expect(out.notes[0]).toContain('职级 2')
    expect(out.history?.title).toBe('升职')
  })

  it('技能不过门槛：只涨工龄不晋升', () => {
    const job = getJob('junior_dev')!
    const dev = makeEmployed('junior_dev', { workYears: 2 })
    dev.career = { kind: 'employed', jobId: 'junior_dev', jobTitle: job.title, level: 1, salary: 96000, yearsAtJob: 2 }
    const out = settleCareerYear(dev, { academics: 62, vocational: 15 }) // 差 1 分
    expect(out.career).toMatchObject({ level: 1, salary: 106100, yearsAtJob: 3 }) // 96000×1.105=106080 → 106100
    expect(out.notes).toEqual([])
  })

  it('职级到顶后不再晋升，工龄照常累计', () => {
    const job = getJob('warehouse_keeper')!
    const top = makeEmployed('warehouse_keeper')
    top.career = {
      kind: 'employed', jobId: 'warehouse_keeper', jobTitle: job.title,
      level: 3, salary: 45000, yearsAtJob: 5,
    }
    const out = settleCareerYear(top, { academics: 20, vocational: 99 })
    expect(out.career).toMatchObject({ level: 3, yearsAtJob: 6 })
    expect(out.history).toBeUndefined()
  })

  it('待业每年累计 52 周', () => {
    const out = settleCareerYear(makeGame(6, { career: { kind: 'unemployed', weeks: 0 } }), { academics: 0, vocational: 0 })
    expect(out.career).toEqual({ kind: 'unemployed', weeks: 52 })
  })
})

describe('岗位差异进入年度推进', () => {
  it('advanceYear：在职者收入用岗位年薪、支出按年龄分层+10%收入联动，工龄与调薪落账', () => {
    const dev = makeEmployed('junior_dev')
    const next = advanceYear(dev)
    expect(next.career).toMatchObject({ kind: 'employed', yearsAtJob: 1 })
    if (next.career.kind === 'employed') expect(next.career.salary).toBe(99400) // 96000×1.035(工龄系数)
    // 26 岁支出 26000+9600=35600：收入下限 88320 > 支出 → 必定存下钱
    expect(next.money).toBeGreaterThan(dev.money)
    expect(next.yearLog.some((l) => l.includes('收入'))).toBe(true)
  })

  it('advanceYear：满年限考核晋升写入年志与履历', () => {
    const job = getJob('junior_dev')!
    const dev = makeEmployed('junior_dev')
    dev.career = { kind: 'employed', jobId: 'junior_dev', jobTitle: job.title, level: 1, salary: 96000, yearsAtJob: 2 }
    dev.skills = { academics: 63, vocational: 15 }
    const next = advanceYear(dev)
    expect(next.career).toMatchObject({ level: 2, yearsAtJob: 0 })
    expect(next.yearLog.some((l) => l.includes('升到了职级 2'))).toBe(true)
    expect(next.history.some((h) => h.title === '升职' && h.summary.includes('职级 2'))).toBe(true)
  })

  it('岗位压力基调生效：护士 5 > 仓管 2 > 零工 1', () => {
    const mk = (attrs = { health: 60, happiness: 60, smarts: 50, social: 50, stress: 30 }) => attrs
    const nurse = makeEmployed('nurse', { attrs: mk(), age: 26 })
    const wh = makeEmployed('warehouse_keeper', { attrs: mk(), age: 26 })
    const none = makeGame(8, { attrs: mk() })
    expect(naturalAttrDrift(nurse, { next: () => 0.5 }).drift.stress).toBe(5)
    expect(naturalAttrDrift(wh, { next: () => 0.5 }).drift.stress).toBe(2)
    expect(naturalAttrDrift(none, { next: () => 0.5 }).drift.stress).toBe(1)
  })

  it('advanceYear：待业者失业周数累计', () => {
    const u = makeGame(9, { career: { kind: 'unemployed', weeks: 0 } })
    const next = advanceYear(u)
    expect(next.career).toEqual({ kind: 'unemployed', weeks: 52 })
  })
})

// ── 事件效果落地 ───────────────────────────────────────────

describe('职业事件效果应用', () => {
  it('招工启事：摆摊选项入职市集摊主，履历记录事件', () => {
    const s = { ...makeGame(11), skills: { academics: 20, vocational: 20 } }
    const applied = applyChoice(s, findEvent('car_job_board'), 0) // visible[0] = 摆摊
    expect(applied.state.career).toMatchObject({ kind: 'employed', jobId: 'stall_vendor', level: 1, salary: 31500 })
    expect(applied.state.tags).toContain('job_stall_vendor')
    expect(applied.state.tags).toContain('ever_employed')
    expect(applied.state.history[applied.state.history.length - 1]?.eventId).toBe('car_job_board')
    expect(applied.summary).not.toContain('{name}')
  })

  it('行业寒冬：辞职进入待业并留 resigned/ex_ 标记；降薪选项按倍率调整年薪', () => {
    const clerk = makeEmployed('office_clerk', { tags: ['ever_employed', 'job_office_clerk'] })
    const quit = applyChoice(clerk, findEvent('car_industry_winter'), 1)
    expect(quit.state.career).toEqual({ kind: 'unemployed', weeks: 0 })
    expect(quit.state.tags).toContain('resigned')
    expect(quit.state.tags).toContain('ex_office_clerk')
    expect(quit.state.tags).not.toContain('job_office_clerk')

    // 第 22 轮公式化调薪：年薪由基础工资×职级×工龄×景气×salaryMul 重推，
    // 手改的 salary 不再参与推导——44000(起薪)×1.08(职级2)×0.88 = 41817.6 → 41800
    const clerk2 = makeEmployed('office_clerk', {}, 2)
    const cut = applyChoice(clerk2, findEvent('car_industry_winter'), 2)
    expect(cut.state.career).toMatchObject({ kind: 'employed', salary: 41800, salaryMul: 0.88 })
  })

  it('35 岁危机：拿赔偿金走人 = +40000 并失业；无标记时事件不可达', () => {
    const dev = makeEmployed('junior_dev', { age: 35, tags: ['ever_employed', 'job_junior_dev'] })
    const event = findEvent('car_dev_midlife')
    const vis = visibleChoices(dev, event)
    const severance = event.choices.findIndex((c) => c.text.includes('赔偿金') && vis.includes(c))
    expect(severance).toBeGreaterThanOrEqual(0)
    const out = applyChoice(dev, event, severance)
    expect(out.state.career).toEqual({ kind: 'unemployed', weeks: 0 })
    expect(out.state.money).toBe(dev.money + 40000)
    expect(out.state.tags).toContain('laid_off')

    expect(isEventAvailable(makeGame(12, { age: 35 }), event)).toBe(false)
    expect(isEventAvailable(dev, event)).toBe(true)
    expect(isEventAvailable(makeGame(13, { age: 20, tags: ['job_junior_dev'] }), event)).toBe(false)
  })

  it('校园招聘：应届大专生可见护理岗门槛选项，全部选项条件互斥合理', () => {
    const grad = makeGame(14, {
      age: 22,
      career: { kind: 'none' },
      education: 'college',
      skills: { academics: 40, vocational: 45 },
      tags: ['graduated_college'],
    })
    const event = findEvent('car_campus_recruit')
    expect(isEventAvailable(grad, event)).toBe(true)
    const vis = visibleChoices(grad, event)
    expect(vis.some((c) => c.text.includes('护理'))).toBe(true) // 大专+技能45 压线可投
    expect(vis.some((c) => c.text.includes('代码'))).toBe(false) // 本科门槛不可见
    const applied = applyChoice(
      grad,
      event,
      event.choices.findIndex((c) => c.text.includes('护理') && vis.includes(c)),
    )
    expect(applied.state.career).toMatchObject({ kind: 'employed', jobId: 'nurse' })
  })

  it('返聘电话：ex_ 经历匹配岗位入口，无经历者不可达', () => {
    const exNurse = makeGame(15, {
      age: 40,
      career: { kind: 'unemployed', weeks: 52 },
      education: 'college',
      skills: { academics: 30, vocational: 45 },
      tags: ['ex_nurse', 'ever_employed', 'laid_off'],
    })
    const event = findEvent('car_old_boss_call')
    expect(isEventAvailable(exNurse, event)).toBe(true)
    const applied = applyChoice(exNurse, event, 0) // 回医院
    expect(applied.state.career).toMatchObject({ kind: 'employed', jobId: 'nurse' })
    // 再就业后离职方式标记被清除
    expect(applied.state.tags).not.toContain('laid_off')
    expect(applied.state.tags).toContain('job_nurse')
    expect(applied.state.tags).toContain('ex_nurse') // 经历仍在

    expect(isEventAvailable(makeGame(16, { age: 40, career: { kind: 'unemployed', weeks: 52 } }), event)).toBe(false)
  })

  it('部门提人：走技术线事件晋升立即生效；选项按技能门控', () => {
    const wh = makeEmployed('warehouse_keeper', {
      skills: { academics: 20, vocational: 40 },
      tags: ['ever_employed', 'job_warehouse_keeper'],
    })
    const event = findEvent('car_promotion_push')
    const vis = visibleChoices(wh, event)
    expect(vis.some((c) => c.text.includes('技术线'))).toBe(true)
    expect(vis.some((c) => c.text.includes('管理线'))).toBe(false) // 学业 40 门槛（20 < 40）
    const applied = applyChoice(
      wh,
      event,
      event.choices.findIndex((c) => c.text.includes('技术线') && vis.includes(c)),
    )
    expect(applied.state.career).toMatchObject({ kind: 'employed', level: 2 })
    if (applied.state.career.kind === 'employed') {
      expect(applied.state.career.salary).toBe(41000) // 38000×1.08=41040 → 41000
    }
  })

  it('会话层：求职选择的 lastDeltas 带「入职」描述', () => {
    const base = { ...makeGame(17), skills: { academics: 20, vocational: 20 } }
    const session: Session = {
      state: base,
      currentEvent: findEvent('car_job_board'),
      awaitingAdvance: false,
      lastSummary: '',
      lastDeltas: [],
    }
    const s = chooseOption(session, 0)
    const jobDelta = s.lastDeltas.find((d) => d.job)
    expect(jobDelta?.job).toBe('入职：市集摊主')
  })

  it('会话层：在职转行选择的 lastDeltas 带「转行」描述', () => {
    const wh = makeEmployed('warehouse_keeper', {
      skills: { academics: 20, vocational: 20 },
      tags: ['ever_employed', 'job_warehouse_keeper'],
    })
    const event = findEvent('car_skill_pivot')
    const rawIndex = event.choices.findIndex(
      (c) => c.text.includes('市集生意') && visibleChoices(wh, event).some((v) => v === c),
    )
    expect(rawIndex).toBeGreaterThanOrEqual(0)
    const s = chooseOption(
      { state: wh, currentEvent: event, awaitingAdvance: false, lastSummary: '', lastDeltas: [] },
      rawIndex,
    )
    expect(s.state.career).toMatchObject({ kind: 'employed', jobId: 'stall_vendor' })
    const jobDelta = s.lastDeltas.find((d) => d.job)
    expect(jobDelta?.job).toBe('转行：市集摊主')
  })
})

// ── 全循环与防软锁 ─────────────────────────────────────────

describe('就业循环与防软锁', () => {
  it('就业→被裁→再就业循环三轮：标记与状态每轮正确', () => {
    let s = { ...makeGame(21), skills: { academics: 30, vocational: 45 } }
    const applyTags = (tags: string[], patch: { addTags: string[]; removeTags: string[] }) =>
      [...new Set(tags.filter((t) => !patch.removeTags.includes(t)).concat(patch.addTags))]
    for (let i = 0; i < 3; i++) {
      const hire = employPatch(s, 'electrician')
      expect(hire.ok).toBe(true)
      s = { ...s, career: hire.career, tags: applyTags(s.tags, hire) }
      expect(s.tags.filter((t) => t === 'job_electrician')).toHaveLength(1)
      expect(s.tags).toContain('ever_employed')
      expect(s.tags).not.toContain('laid_off')
      if (i > 0) expect(s.tags.filter((t) => t === 'ex_electrician')).toHaveLength(1) // 第 2 轮起带着上轮经历

      const fire = endEmploymentPatch(s, 'laid_off')
      s = { ...s, career: fire.career, tags: applyTags(s.tags, fire) }
      expect(s.career).toEqual({ kind: 'unemployed', weeks: 0 })
      expect(s.tags).toContain('laid_off')
      expect(s.tags).toContain('ex_electrician')
      expect(s.tags.filter((t) => t === 'ex_electrician')).toHaveLength(1)
    }
  })

  it('待业低技能角色推 40 年：数值合法、不卡死、正常走完或仍在推进', () => {
    let s = makeGame(22, {
      age: 20,
      money: -50000,
      career: { kind: 'unemployed', weeks: 0 },
      skills: { academics: 5, vocational: 5 },
      attrs: { health: 60, happiness: 45, smarts: 20, social: 40, stress: 30 },
    })
    let guard = 0
    while (s.phase === 'playing' && guard < 60) {
      s = advanceYear(s)
      guard++
      expect(validateState(s).issues).toEqual([])
      expect(Number.isFinite(s.money)).toBe(true)
    }
    // 要么自然走完，要么 40 年后仍健康推进（无软锁卡死）
    expect(s.phase === 'ended' || s.age >= 60).toBe(true)
  })

  it('风险收益分化：同 seed 同技能，程序员 20 年净资产显著高于仓管', () => {
    const run = (jobId: 'junior_dev' | 'warehouse_keeper', academics: number, vocational: number) => {
      const job = getJob(jobId)!
      let s: GameState = makeGame(31, {
        age: 25,
        money: 0,
        education: job.minEducation,
        career: {
          kind: 'employed', jobId, jobTitle: job.title, level: 1,
          salary: 0, yearsAtJob: 0,
        },
        skills: { academics, vocational },
        attrs: { health: 60, happiness: 60, smarts: 60, social: 50, stress: 30 },
      })
      if (s.career.kind === 'employed') {
        s = { ...s, career: { ...s.career, salary: startingSalary(s, job) } }
      }
      for (let i = 0; i < 20; i++) s = advanceYear(s)
      return s.money
    }
    const devMoney = run('junior_dev', 90, 15)
    const whMoney = run('warehouse_keeper', 15, 90)
    expect(devMoney).toBeGreaterThan(whMoney)
    expect(devMoney).toBeGreaterThan(200000) // 高薪路线 20 年攒出可观察的差距
  })
})

// ── 数据校验、可达性与复现 ────────────────────────────────

describe('职业事件数据质量', () => {
  it('11 个职业事件入池，全池通过校验器', () => {
    for (const id of CAREER_EVENT_IDS) expect(findEvent(id)).toBeDefined()
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('行业寒冬只对在职者开放；校园招聘需要毕业标记且 18 岁应届不可触发', () => {
    expect(isEventAvailable(makeEmployed('office_clerk'), findEvent('car_industry_winter'))).toBe(true)
    expect(isEventAvailable(makeGame(41), findEvent('car_industry_winter'))).toBe(false)
    // 第 19 轮 ≥2 有效选项规则：默认态大专毕业生只剩 gap 一个可见选项（校招被排除），
    // 给足技能门槛后校招恢复可用——毕业标记门控的本测试意图不变
    expect(
      isEventAvailable(
        makeGame(42, { tags: ['graduated_college'], education: 'college', skills: { academics: 30, vocational: 45 } }),
        findEvent('car_campus_recruit'),
      ),
    ).toBe(true)
    expect(isEventAvailable(makeGame(43), findEvent('car_campus_recruit'))).toBe(false)
  })

  it('岗位专属事件只对在岗者开放（护士夜班/教师重点班）', () => {
    const nurse = makeEmployed('nurse', { age: 30, tags: ['job_nurse'] })
    const notNurse = makeEmployed('office_clerk', { age: 30, tags: ['job_office_clerk'] })
    expect(isEventAvailable(nurse, findEvent('car_nurse_shifts'))).toBe(true)
    expect(isEventAvailable(notNurse, findEvent('car_nurse_shifts'))).toBe(false)
    const teacher = makeEmployed('teacher', { age: 30, tags: ['job_teacher'] })
    expect(isEventAvailable(teacher, findEvent('car_teacher_class'))).toBe(true)
    expect(isEventAvailable(notNurse, findEvent('car_teacher_class'))).toBe(false)
  })

  it('校验器：startJob 引用不存在的岗位被检出', () => {
    const bad: GameEvent = {
      ...findEvent('car_job_board'),
      id: 'bad_job_id',
      choices: [
        {
          text: '去不存在的公司',
          effects: [{ startJob: { jobId: 'astronaut' } }],
        },
        { text: '算了', effects: [{ attr: 'happiness', delta: -1 }] },
      ],
    }
    const issues = validateEvents([bad])
    expect(issues.some((i) => i.field.includes('startJob.jobId') && i.problem.includes('astronaut'))).toBe(true)
  })

  it('校验器：离职/晋升/调薪效果与"仅学生"事件条件矛盾被检出；学生事件带 startJob 也被检出', () => {
    const base = findEvent('car_industry_winter')
    const badQuit: GameEvent = {
      ...base,
      id: 'bad_quit_student',
      requires: { ...base.requires, careerKinds: ['student'] },
    }
    const issues = validateEvents([badQuit])
    expect(issues.some((i) => i.problem.includes('离职/晋升/调薪'))).toBe(true)

    const badHire: GameEvent = {
      ...findEvent('car_job_board'),
      id: 'bad_hire_student',
      requires: { careerKinds: ['student'] },
      choices: [
        { text: '去打工', effects: [{ startJob: { jobId: 'stall_vendor' } }] },
        { text: '继续读书', effects: [{ attr: 'smarts', delta: 1 }] },
      ],
    }
    const hireIssues = validateEvents([badHire])
    expect(hireIssues.some((i) => i.problem.includes('在读不能签劳动合同'))).toBe(true)
  })

  it('校验器：非法 jobLevels（0/负数）与 jobLevels+careerKinds 矛盾被检出', () => {
    const badLevel: GameEvent = {
      ...findEvent('car_promotion_push'),
      id: 'bad_level_zero',
      requires: { careerKinds: ['employed'], jobLevels: [0, 2] },
    }
    const issues = validateEvents([badLevel])
    expect(issues.some((i) => i.field.includes('jobLevels') && i.problem.includes('≥1'))).toBe(true)

    const badCombo: GameEvent = {
      ...findEvent('car_promotion_push'),
      id: 'bad_level_combo',
      requires: { careerKinds: ['unemployed'], jobLevels: [1] },
    }
    const comboIssues = validateEvents([badCombo])
    expect(comboIssues.some((i) => i.problem.includes('careerKinds 不含 employed'))).toBe(true)
  })

  it('回归：待业者不可触发「只有一个坑位」（晋升竞争叙事不与待业状态脱节）', () => {
    const race = findEvent('mid_promotion_race')
    expect(race.requires?.careerKinds).toEqual(['employed'])
    expect(isEventAvailable(makeEmployed('office_clerk', { age: 35, tags: ['job_office_clerk'] }), race)).toBe(true)
    expect(isEventAvailable(makeGame(44, { age: 35, career: { kind: 'unemployed', weeks: 52 } }), race)).toBe(false)
  })

  it('同 seed、同选择序列：走职业路线的两局完全一致', () => {
    const run = () => {
      let session = startSession({ seed: 9527, backgroundId: 'single_parent', traitId: 'frugal' }, ALL_EVENTS)
      let guard = 0
      while (session.state.phase === 'playing' && session.state.age < 40 && guard < 120) {
        session = session.awaitingAdvance ? nextYear(session, ALL_EVENTS) : chooseOption(session, 0)
        guard++
      }
      return JSON.stringify(session.state)
    }
    expect(run()).toBe(run())
  })
})

// ── 第 2 次尝试回归：满级岗位不得看到必然无效的晋升选项 ──

describe('满级晋升选项可见性（promotionAvailable）', () => {
  it('maxLevel 3 的岗位在职级 3（顶）时，晋升选项隐藏、沉淀选项仍可见；职级 2 时可见', () => {
    const job = getJob('warehouse_keeper')!
    const event = findEvent('car_promotion_push')
    const top = makeEmployed('warehouse_keeper', {
      skills: { academics: 60, vocational: 60 },
      tags: ['ever_employed', 'job_warehouse_keeper'],
    })
    top.career = { kind: 'employed', jobId: 'warehouse_keeper', jobTitle: job.title, level: 3, salary: 45000, yearsAtJob: 1 }
    const topVis = visibleChoices(top, event)
    expect(topVis.some((c) => c.text.includes('管理线'))).toBe(false)
    expect(topVis.some((c) => c.text.includes('技术线'))).toBe(false)
    expect(topVis.some((c) => c.text.includes('沉淀'))).toBe(true)

    const mid = { ...top, career: { ...top.career, level: 2 } }
    expect(visibleChoices(mid, event).some((c) => c.text.includes('技术线'))).toBe(true)
  })

  it('教师职级 4（顶）隐藏重点班接班选项、职级 3 可见；研发 maxLevel 5 职级 4 仍可见晋升', () => {
    const tjob = getJob('teacher')!
    const event = findEvent('car_teacher_class')
    const t4 = makeEmployed('teacher', { age: 30, skills: { academics: 70, vocational: 20 }, tags: ['job_teacher'] })
    t4.career = { kind: 'employed', jobId: 'teacher', jobTitle: tjob.title, level: 4, salary: 80000, yearsAtJob: 1 }
    expect(visibleChoices(t4, event).some((c) => c.text.includes('重点班'))).toBe(false)
    const t3 = { ...t4, career: { ...t4.career, level: 3 } }
    expect(visibleChoices(t3, event).some((c) => c.text.includes('重点班'))).toBe(true)

    const rjob = getJob('rd_engineer')!
    const r4 = makeEmployed('rd_engineer', { age: 35, skills: { academics: 80, vocational: 20 }, tags: ['job_rd_engineer'] })
    r4.career = { kind: 'employed', jobId: 'rd_engineer', jobTitle: rjob.title, level: 4, salary: 150000, yearsAtJob: 1 }
    expect(visibleChoices(r4, findEvent('car_promotion_push')).some((c) => c.text.includes('管理线'))).toBe(true)
  })

  it('校验器：promote 选项缺 promotionAvailable 被检出；修复后的全池合规', () => {
    const bad: GameEvent = {
      ...findEvent('car_promotion_push'),
      id: 'car_bad_promote',
      choices: [
        { text: '硬冲一把', effects: [{ promote: true }], summary: '冲了' },
        { text: '算了', effects: [], summary: '算了' },
      ],
    }
    const issues = validateEvents([bad])
    expect(issues.some((i) => i.field.includes('promotionAvailable'))).toBe(true)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
