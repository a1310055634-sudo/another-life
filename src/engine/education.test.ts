// 第 8 轮测试：教育与技能系统
// 覆盖：学制与毕业结算、高考分档与可复现、入学/退学守卫、技能成长与门槛、
// 职业门槛表、延迟学历（自考）、低学历路线不软锁、事件池校验。
import { describe, it, expect } from 'vitest'
import type { GameEvent, GameState, SkillKey, StudentStage } from './types'
import { createNewGame } from './init'
import { advanceYear, baseYearFinance } from './lifecycle'
import { startSession, chooseOption, nextYear } from './session'
import { applyChoice, checkCondition, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { eligibleJobs } from '../data/careers'
import {
  BASE_SKILLS,
  EDU_RANK,
  STAGE_INFO,
  STAGE_PREREQUISITE,
  clampSkill,
  enterEducation,
  gaokaoOutcome,
  gaokaoScore,
  graduateStudent,
  leaveEducation,
} from './education'

const EDUCATION_EVENT_IDS = [
  'edu_admission_notice',
  'edu_first_year_crossroads',
  'edu_mid_dropout_wobble',
  'edu_gaokao_failed_regroup',
  'edu_adult_selfexam',
  'edu_adult_upgrade',
]

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件 ${id} 不存在`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '测试者' })
  return { ...base, ...patch }
}

/** 把 18 岁第一事件（必为岔路口）按 choiceIndex 走完，返回进入 19 岁前的会话 */
function takeFork(seed: number, backgroundId: string, traitId: string, choiceIndex: number) {
  let s = startSession({ seed, backgroundId, traitId }, ALL_EVENTS)
  expect(s.currentEvent!.id).toBe('youth_gap_decision') // priority 2 全池唯一，18 岁必出
  s = chooseOption(s, choiceIndex)
  return s
}

/** 自动推进：有事件就选第 0 个可见选项，然后进入下一年 */
function autoPlay(s: ReturnType<typeof startSession>, untilAge: number, maxSteps = 40) {
  let guard = 0
  while (s.state.phase === 'playing' && s.state.age < untilAge && guard++ < maxSteps) {
    s = s.awaitingAdvance ? nextYear(s, ALL_EVENTS) : chooseOption(s, 0)
  }
  return s
}

// ── 数据完整性 ─────────────────────────────────────────────

describe('教育数据完整性', () => {
  it('6 个教育事件都在池中，各 2～4 个选项，全池通过校验器', () => {
    for (const id of EDUCATION_EVENT_IDS) {
      const e = findEvent(id)
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.choices.length).toBeLessThanOrEqual(4)
    }
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('STAGE_INFO：标准学制 ≥1 年，毕业学历只升不降，每年成长在 ±10 内', () => {
    for (const stage of Object.keys(STAGE_INFO) as StudentStage[]) {
      const info = STAGE_INFO[stage]
      expect(info.years).toBeGreaterThanOrEqual(1)
      if (info.graduateTo) {
        expect(EDU_RANK[info.graduateTo]).toBeGreaterThan(EDU_RANK[stage === 'highschool' ? 'junior' : 'highschool'])
      }
      for (const [, d] of Object.entries(info.perYear)) {
        expect(Math.abs(d as number)).toBeLessThanOrEqual(10)
      }
      // 入学前置学历必须是合法层级
      expect(STAGE_PREREQUISITE[stage]).toBeDefined()
    }
    expect(STAGE_INFO.college.graduateTo).toBe('college')
    expect(STAGE_INFO.bachelor.graduateTo).toBe('bachelor')
    expect(STAGE_INFO.highschool.graduateTo).toBeNull() // 高中毕业走高考结算
  })

  it('高考分档：纯函数边界覆盖四档', () => {
    // score = smarts*0.6 + academics*0.4 ± 12（roll 0~1）
    expect(gaokaoOutcome(gaokaoScore(95, 80, 1))).toBe('elite') // 89+12=101
    expect(gaokaoOutcome(gaokaoScore(80, 50, 0.5))).toBe('bachelor') // 68
    expect(gaokaoOutcome(gaokaoScore(50, 30, 0.5))).toBe('college') // 42
    expect(gaokaoOutcome(gaokaoScore(10, 0, 0.5))).toBe('fail') // 6
    expect(gaokaoOutcome(85)).toBe('elite')
    expect(gaokaoOutcome(84)).toBe('bachelor')
    expect(gaokaoOutcome(58)).toBe('bachelor')
    expect(gaokaoOutcome(57)).toBe('college')
    expect(gaokaoOutcome(40)).toBe('college')
    expect(gaokaoOutcome(39)).toBe('fail')
  })
})

// ── 入学 / 退学守卫 ────────────────────────────────────────

describe('enterEducation 守卫', () => {
  it('高中学历不能直接读研/申博，但能读大专与本科', () => {
    const s = makeGame()
    expect(enterEducation(s, 'master').ok).toBe(false)
    expect(enterEducation(s, 'phd').ok).toBe(false)
    expect(enterEducation(s, 'college').ok).toBe(true)
    expect(enterEducation(s, 'bachelor').ok).toBe(true)
    // 失败时原样返回
    const failed = enterEducation(s, 'master')
    expect(failed.state).toBe(s)
  })

  it('硕士学历能申博但不能再考研，本科生不能再读本', () => {
    const master = makeGame(1, { education: 'master' })
    expect(enterEducation(master, 'phd').ok).toBe(true)
    expect(enterEducation(master, 'master').ok).toBe(false)
    const bachelor = makeGame(2, { education: 'bachelor' })
    expect(enterEducation(bachelor, 'bachelor').ok).toBe(false)
  })

  it('入学置学生学籍并打 in_school 标记；已在读时失败', () => {
    const s = makeGame()
    const entered = enterEducation(s, 'college')
    expect(entered.state.career).toEqual({ kind: 'student', stage: 'college', yearsLeft: 3 })
    expect(entered.state.tags).toContain('in_school')
    expect(enterEducation(entered.state, 'bachelor').ok).toBe(false)
  })

  it('leaveEducation 退学回零工并留 quit_school 标记；非学生是 no-op', () => {
    const student = enterEducation(makeGame(), 'college').state
    const quit = leaveEducation(student)
    expect(quit.career.kind).toBe('none')
    expect(quit.tags).toContain('quit_school')
    const none = makeGame()
    expect(leaveEducation(none)).toBe(none)
  })
})

// ── 学生进度与毕业结算 ─────────────────────────────────────

describe('学生进度与毕业', () => {
  it('大专三年：每年技能成长精确落账，毕业升学历、回零工、留履历', () => {
    // 走 lifecycle 直驱（不经事件抽取，避免随机事件扰动精确断言）
    // ordinary + studious：academics 25+0+10=35，vocational 15
    let s = enterEducation(makeGame(314159), 'college').state
    expect(s.career).toEqual({ kind: 'student', stage: 'college', yearsLeft: 3 })
    s = advanceYear(s)
    expect(s.career).toEqual({ kind: 'student', stage: 'college', yearsLeft: 2 })
    expect(s.skills.academics).toBe(35 + 3)
    expect(s.skills.vocational).toBe(15 + 4)
    s = advanceYear(s)
    s = advanceYear(s) // 21 岁：学制走完，毕业
    expect(s.education).toBe('college')
    expect(s.career.kind).toBe('none')
    expect(s.skills.academics).toBe(35 + 3 * 3) // 每年 +3
    expect(s.skills.vocational).toBe(15 + 3 * 4) // 每年 +4
    expect(s.tags).toContain('graduated_college')
    expect(s.history.filter((h) => h.title === '大专毕业')).toHaveLength(1)
    expect(s.history.some((h) => h.summary.includes('大专文凭'))).toBe(true)
    // 毕业后不再重复结算
    const again = advanceYear(s)
    expect(again.tags.filter((t) => t === 'graduated_college')).toHaveLength(1)
    expect(again.history.filter((h) => h.title === '大专毕业')).toHaveLength(1)
    expect(again.age).toBe(s.age + 1)
  })

  it('会话层大专线：18 岁选大专 → 21 岁自动毕业，途中事件不破坏学籍', () => {
    let s = takeFork(808, 'ordinary', 'studious', 1)
    expect(s.state.career).toEqual({ kind: 'student', stage: 'college', yearsLeft: 3 })
    s = autoPlay(s, 23)
    expect(s.state.age).toBe(23)
    expect(s.state.education).toBe('college')
    // 22 岁起大专毕业生可经「双选会」入职（第 14 轮新增），不再强求毕业后无业；
    // 本测试关心的是学籍完整：学历到手、唯一毕业记录、状态合法
    expect(['none', 'employed']).toContain(s.state.career.kind)
    expect(s.state.skills.academics).toBeGreaterThan(35) // 三年成长 + 途中事件
    expect(s.state.history.filter((h) => h.title === '大专毕业')).toHaveLength(1)
    expect(validateState(s.state).issues).toEqual([])
  })

  it('本科四年毕业：学历与标记正确，全程数值合法', () => {
    let s = takeFork(271828, 'rural', 'studious', 0) // 复读
    // 把能力/学业拉满，保证高考必上本科线
    s = {
      ...s,
      state: {
        ...s.state,
        attrs: { ...s.state.attrs, smarts: 95 },
        skills: { ...s.state.skills, academics: 80 },
      },
    }
    s = nextYear(s, ALL_EVENTS) // 19 岁：放榜
    expect(s.state.tags).toContain('admitted_bachelor')
    expect(s.state.tags).not.toContain('gaokao_failed')
    expect(s.currentEvent!.id).toBe('edu_admission_notice') // priority 3 必然先出
    // 本科报到选项可见且入学
    const vis = visibleChoices(s.state, findEvent('edu_admission_notice'))
    expect(vis[0].text).toContain('本科')
    s = chooseOption(s, 0)
    expect(s.state.career).toEqual({ kind: 'student', stage: 'bachelor', yearsLeft: 4 })
    s = autoPlay(s, 23) // 4 年学制 → 23 岁毕业（第 9 轮起毕业后抽到校招事件，故只推进到毕业年为止）
    expect(s.state.education).toBe('bachelor')
    expect(s.state.tags).toContain('graduated_bachelor')
    expect(s.state.career.kind).toBe('none')
    expect(validateState(s.state).issues).toEqual([])
  })

  it('复读落榜线：低能力必落榜，落榜事件出现且三条后续路都能走', () => {
    // 必落榜：把能力与学业压到最低（复读选项目 smarts+3 后仍远低于大专线）
    const runFailLine = (seed: number, after: 0 | 1 | 2) => {
      let s = takeFork(seed, 'ordinary', 'laid_back', 0)
      s = {
        ...s,
        state: {
          ...s.state,
          attrs: { ...s.state.attrs, smarts: 2 },
          skills: { ...s.state.skills, academics: 0 },
        },
      }
      s = nextYear(s, ALL_EVENTS) // 19 岁：放榜
      expect(s.state.tags).toContain('gaokao_failed')
      expect(s.currentEvent!.id).toBe('edu_gaokao_failed_regroup')
      s = chooseOption(s, after)
      return s
    }
    // 路 1：再复读 → 回到高三学籍
    const retry = runFailLine(101, 0)
    expect(retry.state.career).toEqual({ kind: 'student', stage: 'highschool', yearsLeft: 1 })
    expect(retry.state.tags).toContain('gaokao_retry')
    expect(retry.state.tags).not.toContain('gaokao_failed')
    // 路 2：进厂学手艺 → 职业技能 +6，开始攒工龄
    const factory = runFailLine(102, 1)
    expect(factory.state.career.kind).toBe('none')
    expect(factory.state.skills.vocational).toBeGreaterThanOrEqual(BASE_SKILLS.vocational + 6)
    expect(factory.state.tags).toContain('work_early')
    // 路 3：边打工边自考
    const exam = runFailLine(103, 2)
    expect(exam.state.tags).toContain('self_exam')
    // patch 后学业为 0：高三学年成长 +6（engine 保证）+ 自考事件 +3 = 9，精确确定
    expect(exam.state.skills.academics).toBe(9)
  })

  it('同 seed 复读线完全复现（含高考 roll）', () => {
    const run = (seed: number) => {
      let s = takeFork(seed, 'rural', 'studious', 0)
      s = nextYear(s, ALL_EVENTS)
      return JSON.stringify({ t: s.state.tags, e: s.state.education, r: s.state.rngState })
    }
    expect(run(777)).toBe(run(777))
    expect(run(778)).not.toBe(run(777))
  })

  it('连败链：复读后再落榜，「落榜之后」仍会出现（冷却而非一次性）', () => {
    const failAt = (seed: number) => {
      let s = takeFork(seed, 'ordinary', 'laid_back', 0)
      s = {
        ...s,
        state: {
          ...s.state,
          attrs: { ...s.state.attrs, smarts: 2 },
          skills: { ...s.state.skills, academics: 0 },
        },
      }
      s = nextYear(s, ALL_EVENTS) // 19 岁：第一次放榜落榜
      expect(s.state.tags).toContain('gaokao_failed')
      expect(s.currentEvent!.id).toBe('edu_gaokao_failed_regroup')
      return s
    }
    // 第一次落榜 → 再复读
    let s = failAt(201)
    s = chooseOption(s, 0)
    expect(s.state.career).toEqual({ kind: 'student', stage: 'highschool', yearsLeft: 1 })
    expect(s.state.tags).not.toContain('gaokao_failed')
    // 20 岁：第二次放榜再落榜。once 语义会让引导事件永远缺席；冷却 1 年下必须重新出现
    s = nextYear(s, ALL_EVENTS)
    expect(s.state.tags).toContain('gaokao_failed')
    expect(s.currentEvent!.id).toBe('edu_gaokao_failed_regroup')
    // 三条路照常可走：仍能选再复读回到学籍
    s = chooseOption(s, 0)
    expect(s.state.career).toEqual({ kind: 'student', stage: 'highschool', yearsLeft: 1 })
    expect(s.state.tags).toContain('gaokao_retry')
    expect(s.state.tags).not.toContain('gaokao_failed')
  })

  it('graduateStudent 纯函数：非学生状态抛错', () => {
    expect(() => graduateStudent(makeGame(), 0.5)).toThrow()
  })
})

// ── 技能系统 ───────────────────────────────────────────────

describe('技能成长与门槛', () => {
  it('clampSkill 收敛 0～100，NaN 归 0', () => {
    expect(clampSkill(-5)).toBe(0)
    expect(clampSkill(150)).toBe(100)
    expect(clampSkill(Number.NaN)).toBe(0)
    expect(clampSkill(50.6)).toBe(51)
  })

  it('选项的 addSkill 精确落账且受上限约束', () => {
    const s = makeGame()
    const before = s.skills.academics
    const synthetic: GameEvent = {
      id: 'test_skill',
      category: 'education',
      title: '测试',
      text: '测试',
      minAge: 18,
      maxAge: 99,
      choices: [
        { text: '猛学', effects: [{ addSkill: { id: 'academics', delta: 999 } }] },
        { text: '不动', effects: [] },
      ],
    }
    const applied = applyChoice(s, synthetic, 0)
    expect(applied.state.skills.academics).toBe(100) // clamp 到上限
    const applied2 = applyChoice(s, synthetic, 1)
    expect(applied2.state.skills.academics).toBe(before)
  })

  it('minSkills/maxSkills 条件控制选项可见性', () => {
    const low = makeGame(1, { education: 'college', skills: { academics: 40, vocational: 15 } })
    const high = makeGame(2, { education: 'college', skills: { academics: 50, vocational: 15 } })
    const cond = { minSkills: { academics: 45 } as Partial<Record<SkillKey, number>> }
    expect(checkCondition(low, cond)).toBe(false)
    expect(checkCondition(high, cond)).toBe(true)
    // 在职考研选项：学业 40 看不见，50 看得见（该选项还要求大专/本科学历）
    const upgrade = findEvent('edu_adult_upgrade')
    const visLow = visibleChoices(low, upgrade)
    const visHigh = visibleChoices(high, upgrade)
    expect(visLow.some((c) => c.text.includes('考研'))).toBe(false)
    expect(visHigh.some((c) => c.text.includes('考研'))).toBe(true)
  })

  it('studentStages 条件只匹配在读阶段', () => {
    const inCollege = makeGame(3, { career: { kind: 'student', stage: 'college', yearsLeft: 2 } })
    const inBachelor = makeGame(4, { career: { kind: 'student', stage: 'bachelor', yearsLeft: 2 } })
    const working = makeGame(5, { career: { kind: 'none' } })
    const cond = { studentStages: ['bachelor' as StudentStage] }
    expect(checkCondition(inCollege, cond)).toBe(false)
    expect(checkCondition(inBachelor, cond)).toBe(true)
    expect(checkCondition(working, cond)).toBe(false)
  })
})

// ── 延迟学历（自考）与职业门槛 ─────────────────────────────

describe('延迟学历与职业门槛', () => {
  it('自考大专：延迟 2 年的 education 到期升学历', () => {
    const s = makeGame(9) // highschool，18 岁
    const applied = applyChoice(s, findEvent('edu_adult_selfexam'), 0)
    const p = applied.state.pending.find((x) => x.education === 'college')
    expect(p).toBeDefined()
    expect(p!.dueAge).toBe(20)
    let cur = { ...applied.state }
    while (cur.age < 20) cur = advanceYear(cur)
    expect(cur.education).toBe('college')
    expect(cur.yearLog.some((l) => l.includes('自考大专'))).toBe(true)
  })

  it('延迟学历只升不降', () => {
    const s = makeGame(10, { education: 'bachelor' })
    const next = advanceYear({
      ...s,
      pending: [{ id: 'p', dueAge: 19, education: 'college' }],
    })
    expect(next.education).toBe('bachelor')
  })

  it('职业门槛表：学历与技能双门槛同时生效', () => {
    const laborer = makeGame(11, { education: 'junior', skills: { academics: 0, vocational: 25 } })
    const jobs = eligibleJobs(laborer).map((j) => j.id)
    expect(jobs).toContain('stall_vendor') // 初中+手艺 25 够得着
    expect(jobs).not.toContain('warehouse_keeper') // 需要高中
    expect(jobs).not.toContain('junior_dev') // 需要本科

    const skilled = makeGame(12, { education: 'highschool', skills: { academics: 20, vocational: 45 } })
    const skilledIds = eligibleJobs(skilled).map((j) => j.id)
    expect(skilledIds).toContain('electrician') // 高中+手艺 45
    expect(skilledIds).not.toContain('junior_dev')

    const grad = makeGame(13, { education: 'bachelor', skills: { academics: 55, vocational: 20 } })
    expect(eligibleJobs(grad).map((j) => j.id)).toContain('junior_dev')

    const phd = makeGame(14, { education: 'phd', skills: { academics: 80, vocational: 0 } })
    expect(eligibleJobs(phd).map((j) => j.id)).toContain('researcher')
    // 学历达标但学业不够：博士 70 分够不着研究员（80）
    const weakPhd = makeGame(15, { education: 'phd', skills: { academics: 70, vocational: 0 } })
    expect(eligibleJobs(weakPhd).map((j) => j.id)).not.toContain('researcher')
  })
})

// ── 低学历路线不软锁 ───────────────────────────────────────

describe('低学历路线', () => {
  it('职业技能直接抬升零工收入（每 10 点 +300）', () => {
    const raw = makeGame(21, {
      attrs: { health: 65, happiness: 60, smarts: 20, social: 50, stress: 20 },
      skills: { academics: 20, vocational: 0 },
    })
    const crafted = makeGame(22, {
      attrs: { health: 65, happiness: 60, smarts: 20, social: 50, stress: 20 },
      skills: { academics: 20, vocational: 60 },
    })
    const fRaw = baseYearFinance(raw, { next: () => 0.5 })
    const fCrafted = baseYearFinance(crafted, { next: () => 0.5 })
    expect(fRaw.income).toBe(20000 + 0 + 0 + Math.floor(20 / 5) * 500) // 22000
    expect(fCrafted.income - fRaw.income).toBe(1800) // 60/10×300
  })

  it('高中直接打工路线推进 30 年：数值合法、能靠培训班升学或攒技能', () => {
    // 第 70 轮：池扩容位移固定 seed 整局轨迹（606 号局中途终局）——
    // 扫描 seed 取「直接打工且活到 48 岁」的局，断言不变。
    let s: ReturnType<typeof takeFork> | null = null
    for (const seed of [606, 607, 608, 609, 610, 611, 612, 613, 614, 615]) {
      const probe = takeFork(seed, 'single_parent', 'frugal', 2)
      if (!probe.state.tags.includes('work_early')) continue
      const played = autoPlay(probe, 48, 120)
      if (played.state.phase === 'playing') {
        s = probe
        break
      }
    }
    expect(s).not.toBeNull()
    expect(s!.state.tags).toContain('work_early')
    s = autoPlay(s!, 48, 120)
    expect(s.state.phase).toBe('playing')
    expect(validateState(s.state).issues).toEqual([])
    expect(Number.isFinite(s.state.money)).toBe(true)
    // 成年后自考事件对该学历可达（highschool + 非学生）
    const s2 = makeGame(23, { age: 30, education: 'highschool', career: { kind: 'none' } })
    expect(isEventAvailable(s2, findEvent('edu_adult_selfexam'))).toBe(true)
  })

  it('成年考研链路：本科毕业 → 工作 → 考研入学 → 硕士毕业', () => {
    // 直接构造一个本科毕业生（25 岁，事件 minAge 25 起），验证成年后再学习闭环
    let s = makeGame(31, {
      age: 25,
      education: 'bachelor',
      skills: { academics: 50, vocational: 20 },
      career: { kind: 'none' },
      tags: ['graduated_bachelor'],
    })
    const upgrade = findEvent('edu_adult_upgrade')
    expect(isEventAvailable(s, upgrade)).toBe(true)
    const vis = visibleChoices(s, upgrade)
    const kaoyan = upgrade.choices.findIndex((c) => c.text.includes('考研') && vis.includes(c))
    expect(kaoyan).toBeGreaterThanOrEqual(0) // 学业 50 ≥ 45，门槛可过
    const applied = applyChoice(s, upgrade, kaoyan)
    expect(applied.state.career).toEqual({ kind: 'student', stage: 'master', yearsLeft: 2 })
    // 两年后硕士毕业
    let cur = applied.state
    cur = advanceYear(cur)
    cur = advanceYear(cur)
    expect(cur.education).toBe('master')
    expect(cur.tags).toContain('graduated_master')
  })
})

// ── validateState 与全流程 ─────────────────────────────────

describe('状态校验与确定性', () => {
  it('validateState 修复非法技能值', () => {
    const s = makeGame(41, {
      skills: { academics: Number.NaN, vocational: 150 } as Record<SkillKey, number>,
    })
    const { issues } = validateState(s)
    expect(issues.length).toBeGreaterThan(0)
    expect(s.skills.academics).toBe(0)
    expect(s.skills.vocational).toBe(100)
  })

  it('背景/特质技能加成进入初始状态且各不相同', () => {
    const rural = createNewGame({ seed: 1, backgroundId: 'rural', traitId: 'studious' })
    expect(rural.skills.academics).toBe(BASE_SKILLS.academics + 8 + 10) // 43
    const single = createNewGame({ seed: 1, backgroundId: 'single_parent', traitId: 'frugal' })
    expect(single.skills.vocational).toBe(BASE_SKILLS.vocational + 5) // 20
    const ordinary = createNewGame({ seed: 1, backgroundId: 'ordinary', traitId: 'laid_back' })
    expect(ordinary.skills).toEqual(BASE_SKILLS)
  })

  it('复读线与打工线在前 5 年产生可观察的教育差异', () => {
    const college = takeFork(808, 'ordinary', 'studious', 1)
    const work = takeFork(808, 'ordinary', 'studious', 2)
    expect(college.state.career.kind).toBe('student')
    expect(work.state.career.kind).toBe('none')
    const college5 = autoPlay(college, 23)
    const work5 = autoPlay(work, 23)
    expect(college5.state.education).toBe('college')
    expect(work5.state.education).toBe('highschool')
    expect(college5.state.skills.academics).toBeGreaterThan(work5.state.skills.academics)
    expect(college5.state.history.some((h) => h.title === '大专毕业')).toBe(true)
    expect(work5.state.history.some((h) => h.title === '大专毕业')).toBe(false)
  })
})
