// 第 12 轮：健康、压力与生活方式测试
// 覆盖：生活方式标记年度漂移、周期性延迟效果（repeat）、低健康分级预警、
// 单步伤害上限校验、恢复事件门控矩阵（低健康/负债/单身策略空间）、边界推进与同 seed 复现。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, visibleChoices, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { HEALTH_EVENTS } from '../data/events/health'
import { applyLifestyleDrift, lowHealthWarnings, HEALTH_SINGLE_HIT_LIMIT } from './health'
import type { GameEvent, GameState, PendingEffect } from './types'

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

const EMPLOYED = (salary = 60000) =>
  ({ kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary, yearsAtJob: 2 }) as const

function evWithHealthDelta(delta: number): GameEvent {
  return {
    id: 'test_hit',
    category: 'health',
    title: '测试',
    text: '测试',
    minAge: 18,
    maxAge: 80,
    choices: [
      { text: '甲', effects: [{ attr: 'health', delta }] },
      { text: '乙', effects: [] },
    ],
  }
}

describe('生活方式标记年度漂移（health.ts）', () => {
  it('各标记的漂移表符合设计量级（±1~2/年）', () => {
    const d = applyLifestyleDrift(['routine_exercise'])
    expect(d.drift.health).toBe(1)
    expect(d.drift.stress).toBe(-1)
    const owl = applyLifestyleDrift(['night_owl'])
    expect(owl.drift.health).toBe(-1)
    expect(owl.drift.happiness).toBe(-1)
    const smoker = applyLifestyleDrift(['light_smoker'])
    expect(smoker.drift.health).toBe(-2)
  })

  it('多标记叠加求和，未知标记忽略，空标记无漂移', () => {
    const both = applyLifestyleDrift(['routine_exercise', 'night_owl', 'unknown_tag'])
    expect(both.drift.health).toBe(0) // +1 与 -1 抵消
    expect(both.drift.stress).toBe(-1)
    expect(both.drift.happiness).toBe(-1)
    expect(applyLifestyleDrift([]).drift).toEqual({})
  })

  it('advanceYear 中标记真实生效：锻炼者三年后比对照健康多 3、压力少 3', () => {
    const exercised = makeGame(7, { age: 25, tags: ['routine_exercise'] })
    const control = makeGame(7, { age: 25, tags: [] })
    let a = exercised
    let b = control
    for (let i = 0; i < 3; i++) {
      a = advanceYear(a)
      b = advanceYear(b)
    }
    expect(a.attrs.health - b.attrs.health).toBe(3)
    expect(b.attrs.stress - a.attrs.stress).toBe(3)
  })

  it('熬夜标记同样经 advanceYear 落账（健康与幸福双降）', () => {
    const owl = makeGame(7, { age: 25, tags: ['night_owl'] })
    const control = makeGame(7, { age: 25, tags: [] })
    let a = owl
    let b = control
    for (let i = 0; i < 2; i++) {
      a = advanceYear(a)
      b = advanceYear(b)
    }
    expect(b.attrs.health - a.attrs.health).toBe(2)
    expect(b.attrs.happiness - a.attrs.happiness).toBe(2)
  })
})

describe('周期性延迟效果（PendingEffect.repeat）', () => {
  const rehabPending = (dueAge: number): PendingEffect => ({
    id: 'rehab_test',
    dueAge,
    money: -3000,
    attr: 'health',
    delta: 2,
    repeat: 2,
    summary: '理疗又做了一年，效果实在',
  })

  it('repeat 效果按年重复生效共 3 次（首施 + 2 次重复），随后停止', () => {
    // 90,000 起步让双方四年都留在 0～10 万免息区间，单年金钱差即纯周期效果
    const withRehab = makeGame(7, { age: 40, money: 90000, pending: [rehabPending(41)] })
    const control = makeGame(7, { age: 40, money: 90000, pending: [] })
    let a = withRehab
    let b = control
    let prevA = a.money
    let prevB = b.money
    let prevHA = a.attrs.health
    let prevHB = b.attrs.health
    for (let i = 0; i < 4; i++) {
      a = advanceYear(a)
      b = advanceYear(b)
      // 单年增量差（排除前些年差异的累积）
      const dm = (a.money - prevA) - (b.money - prevB)
      const dh = (a.attrs.health - prevHA) - (b.attrs.health - prevHB)
      prevA = a.money
      prevB = b.money
      prevHA = a.attrs.health
      prevHB = b.attrs.health
      if (i < 3) {
        expect(dm).toBe(-3000)
        expect(dh).toBe(2)
        expect(a.yearLog).toContain('理疗又做了一年，效果实在')
      } else {
        expect(dm).toBe(0)
        expect(dh).toBe(0)
      }
    }
    expect(a.pending).toHaveLength(0)
  })

  it('事件接线的康复年卡（hlt_old_body_maintenance 选项A）延迟效果带 repeat 入队', () => {
    const s = makeGame(7, { age: 58, money: 20000 })
    const ev = findEvent('hlt_old_body_maintenance')
    const chosen = applyChoice(s, ev, choiceIndex(s, ev, '办正规理疗年卡，按疗程来')).state
    expect(chosen.money).toBe(15000)
    const d = chosen.pending.find((p) => p.repeat !== undefined)
    expect(d).toBeDefined()
    expect(d!.repeat).toBe(2)
    expect(d!.money).toBe(-3000)
  })
})

describe('低健康分级预警与"不毫无预兆地死"', () => {
  it('分级预警：40/25/12 三档各给对应提示，健康良好时无提示', () => {
    expect(lowHealthWarnings(39)).toEqual(['体检指标不太好看，该调整生活节奏了'])
    expect(lowHealthWarnings(24)).toEqual(['身体亮起了红灯，再硬扛下去会出大事'])
    expect(lowHealthWarnings(11)).toEqual(['你的身体已接近极限，随时可能倒下，必须立刻休息和治疗'])
    expect(lowHealthWarnings(80)).toEqual([])
  })

  it('advanceYear 后低健康年志必有预警（age25，健康 30 → 31 仍低于 40）', () => {
    const s = advanceYear(makeGame(7, { age: 25, attrs: { health: 30, happiness: 50, smarts: 50, social: 50, stress: 30 } }))
    expect(s.yearLog.some((n) => n.includes('体检指标不太好看'))).toBe(true)
  })

  it('从健康 13 的恶化线出发，预警年年出现、至少还有 3 年策略窗口，第 4 年才终局', () => {
    // 每年固定 -4（熬夜 -1 + 慢性压力侵蚀 -3），无事件介入
    let s = makeGame(7, {
      age: 40,
      money: 500000,
      attrs: { health: 13, happiness: 50, smarts: 50, social: 50, stress: 80 },
      tags: ['night_owl'],
    })
    for (let i = 0; i < 3; i++) {
      s = advanceYear(s)
      expect(s.phase).toBe('playing')
      expect(s.yearLog.some((n) => n.includes('已接近极限') || n.includes('亮起了红灯'))).toBe(true)
    }
    s = advanceYear(s)
    expect(s.phase).toBe('ended')
    expect(s.endingId).toBe('death_ill')
  })

  it('校验器：即时健康伤害超过上限的事件被检出，恰好等于上限合法', () => {
    expect(validateEvents([evWithHealthDelta(-(HEALTH_SINGLE_HIT_LIMIT + 1))]).length).toBeGreaterThan(0)
    expect(validateEvents([evWithHealthDelta(-HEALTH_SINGLE_HIT_LIMIT)])).toEqual([])
  })

  it('校验器：repeat 非法值（0/1.5）被检出，合法值通过', () => {
    const mk = (repeat: number | undefined): GameEvent => ({
      id: 'test_repeat',
      category: 'health',
      title: '测试',
      text: '测试',
      minAge: 18,
      maxAge: 80,
      choices: [
        {
          text: '甲',
          effects: [],
          delayed: [{ years: 1, attr: 'health', delta: 1, ...(repeat !== undefined ? { repeat } : {}) }],
        },
        { text: '乙', effects: [] },
      ],
    })
    expect(validateEvents([mk(0)]).some((i) => i.field.includes('repeat'))).toBe(true)
    expect(validateEvents([mk(1.5)]).some((i) => i.field.includes('repeat'))).toBe(true)
    expect(validateEvents([mk(2)])).toEqual([])
    expect(validateEvents([mk(undefined)])).toEqual([])
  })

  it('全事件池（163 个，含第 13～16/19/24～29/42 轮事件）通过校验器', () => {
    // 第 24 轮 +5（全部落在 health.ts，其他文件计数不动）：hlt_drink_toast、
    // hlt_desk_years、hlt_checkup_mild_flags、hlt_checkup_red_flags、hlt_chronic_onset
    // （HEALTH_EVENTS 7→12，池 122→127）
    // 第 25 轮 +4（全部落在 relationship.ts，健康文件计数不动）：rel_friend_checkin、
    // rel_parent_greeting、rel_anniversary、rel_parent_frail（池 127→131）
    // 第 26 轮 +6（全部落在 relationship.ts，健康文件计数不动）：fam_child_junior、
    // fam_child_senior、fam_child_gaokao、fam_child_first_job、fam_child_wedding、
    // fam_grandchild（池 131→137）
    // 第 27 轮 +3（纯氛围事件，各落一个文件，健康文件计数不动）：youth_livehouse、
    // mid_nav_memory、late_group_rumor（池 137→140）
    // 第 28 轮 +8（全部落在 midlife.ts，健康文件计数不动）：mid_young_boss、
    // mid_industry_collapse、mid_second_child、mid_sandwich、mid_partner_career_gap、
    // mid_friend_fallout、mid_budget_downgrade、mid_reunion_compare（池 140→148）
    // 第 29 轮 +9（全部落在 late.ts，健康文件计数不动）：late_smartphone、
    // late_friends_fade、late_will、late_late_companion、late_grand_rules、
    // late_farewell_preparation、late_volunteer_lead、late_story_grandchild、
    // late_senior_college（池 148→157）
    // 第 42 轮 +6（全部落在 data/events/parents.ts 新文件，健康文件计数不动）：
    // rel_parent_critical、rel_parent_deathbed、rel_parent_funeral、
    // rel_parent_memorial、rel_parent_relics、rel_parent_last_one（池 157→163）
    // 第 43 轮 +2（全部落在 health.ts，其他文件计数不动）：hlt_chronic_checkup、
    // hlt_chronic_flare（HEALTH_EVENTS 12→14，池 163→165）
    // 第 44 轮 +1（落 relationship.ts，健康文件计数不动）：fam_grandchild_time（池 165→166）
    // 第 46 轮 +4（落 relationship.ts，健康文件计数不动）：rel_old_flame、rel_colleague_crush、
    // rel_hobby_club、rel_app_match（池 166→170）
    // 第 47 轮 +8（全部落 late.ts，健康文件计数不动）：late_morning_walk、late_teeth、
    // late_old_letter、late_neighbor_watch、late_cheap_eats、late_solo_birthday、
    // late_balcony_plants、late_old_radio（池 170→178）
    expect(HEALTH_EVENTS).toHaveLength(16)
    expect(ALL_EVENTS).toHaveLength(349) // 63 轮 +3、65 轮 +8、66 轮 +4、67 轮 +5、68 轮倦怠线 +6（→204）
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})

describe('恢复事件门控矩阵（低健康/负债/单身都有策略空间）', () => {
  it('hlt_body_intensive 只在健康 ≤20 时触发', () => {
    const base = { age: 30, money: 50000, career: EMPLOYED() }
    const healthy = makeGame(7, { ...base, attrs: { health: 30, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    const sick = makeGame(7, { ...base, attrs: { health: 15, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    expect(isEventAvailable(healthy, findEvent('hlt_body_intensive'))).toBe(false)
    expect(isEventAvailable(sick, findEvent('hlt_body_intensive'))).toBe(true)
  })

  it('hlt_body_intensive 四状态选项矩阵：在职富人 3 项、待业富人 2 项、在职负债 2 项、待业负债 1 项', () => {
    const ev = findEvent('hlt_body_intensive')
    const sick = { age: 30, attrs: { health: 15, happiness: 50, smarts: 50, social: 50, stress: 40 } }
    expect(visibleChoices(makeGame(7, { ...sick, money: 50000, career: EMPLOYED() }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(7, { ...sick, money: 50000 }), ev)).toHaveLength(2)
    expect(visibleChoices(makeGame(7, { ...sick, money: -1000, career: EMPLOYED() }), ev)).toHaveLength(2)
    expect(visibleChoices(makeGame(7, { ...sick, money: -1000 }), ev)).toHaveLength(1)
  })

  it('hlt_body_intensive 住院选项真实结算：健康 +18、花钱、压力 +5', () => {
    const s = makeGame(7, {
      age: 30,
      money: 50000,
      career: EMPLOYED(),
      attrs: { health: 15, happiness: 50, smarts: 50, social: 50, stress: 40 },
    })
    const chosen = choose(s, 'hlt_body_intensive', '听医生的，住院系统调理')
    expect(chosen.attrs.health).toBe(33)
    expect(chosen.money).toBe(30000)
    expect(chosen.attrs.stress).toBe(45)
  })

  it('hlt_overwork_warning 需在职且压力 ≥60；硬扛选项次年落下 chronic_pain 病根', () => {
    const ev = findEvent('hlt_overwork_warning')
    const employedHigh = makeGame(7, { age: 30, money: 10000, career: EMPLOYED(), attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 70 } })
    const employedCalm = makeGame(7, { age: 30, money: 10000, career: EMPLOYED(), attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 50 } })
    const idleHigh = makeGame(7, { age: 30, money: 10000, attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 90 } })
    expect(isEventAvailable(employedHigh, ev)).toBe(true)
    expect(isEventAvailable(employedCalm, ev)).toBe(false)
    expect(isEventAvailable(idleHigh, ev)).toBe(false)

    const carry = choose(employedHigh, 'hlt_overwork_warning', '项目要紧，扛过去再说')
    expect(carry.attrs.health).toBe(57)
    const next = advanceYear(carry)
    expect(next.tags).toContain('chronic_pain')
    // 延迟 -2 当年入账；旧伤的年度漂移从次年起算（延迟效果授予的标记次年开始计漂移）
    expect(next.attrs.health).toBe(55)
    const after = advanceYear(next)
    expect(after.attrs.health).toBe(54) // 旧伤漂移 -1
  })

  it('hlt_partner_checkup 只对有配偶者开放；没钱时全面套餐隐藏；选TA的安排亲密度 +5', () => {
    const ev = findEvent('hlt_partner_checkup')
    const spouse = (money: number): GameState =>
      makeGame(7, {
        age: 35,
        money,
        attrs: { health: 50, happiness: 60, smarts: 58, social: 50, stress: 25 },
        relations: [{ id: 'spouse_1', kind: 'spouse', name: '爱人', closeness: 60, alive: true }],
      })
    expect(isEventAvailable(spouse(30000), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 35, money: 30000 }), ev)).toBe(false)

    const rich = visibleChoices(spouse(30000), ev)
    expect(rich).toHaveLength(3)
    const poor = visibleChoices(spouse(5000), ev)
    expect(poor.map((c) => c.text)).not.toContain('一起去，加钱做个全面套餐')

    const chosen = choose(spouse(30000), 'hlt_partner_checkup', '一起去，加钱做个全面套餐')
    expect(chosen.money).toBe(22000)
    expect(chosen.attrs.health).toBe(54)
    expect(chosen.relations[0].closeness).toBe(65)
  })

  it('hlt_night_owl_change 只对熬夜者开放；晨跑选项换标记并落账漂移', () => {
    const ev = findEvent('hlt_night_owl_change')
    const owl = makeGame(7, { age: 25, tags: ['night_owl'] })
    const earlyBird = makeGame(7, { age: 25, tags: [] })
    expect(isEventAvailable(owl, ev)).toBe(true)
    expect(isEventAvailable(earlyBird, ev)).toBe(false)

    const jogger = choose(makeGame(7, { age: 25, tags: ['night_owl'], money: 5000 }), 'hlt_night_owl_change', '干脆晨跑，用困意换多巴胺')
    expect(jogger.tags).toContain('routine_exercise')
    expect(jogger.tags).not.toContain('night_owl')
    expect(jogger.money).toBe(4500)
  })

  it('hlt_gym_injury 只对坚持锻炼者开放；贴膏药硬撑的延迟伤害次年入账', () => {
    const ev = findEvent('hlt_gym_injury')
    const fit = makeGame(7, { age: 30, tags: ['routine_exercise'], attrs: { health: 50, happiness: 60, smarts: 58, social: 50, stress: 25 } })
    expect(isEventAvailable(fit, ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, tags: [] }), ev)).toBe(false)

    const stubborn = choose(fit, 'hlt_gym_injury', '贴块膏药，继续练')
    expect(stubborn.attrs.health).toBe(48)
    const next = advanceYear(stubborn)
    expect(next.tags).toContain('chronic_pain')
    expect(next.attrs.health).toBe(47) // 延迟 -2 当年入账，但锻炼者仍有 routine_exercise 年度 +1
  })
})

describe('同 seed 复现与全量合法性', () => {
  it('带生活方式标记的推进完全可复现', () => {
    const a = makeGame(123, { age: 25, tags: ['routine_exercise'] })
    const b = makeGame(123, { age: 25, tags: ['routine_exercise'] })
    let x = a
    let y = b
    for (let i = 0; i < 3; i++) {
      x = advanceYear(x)
      y = advanceYear(y)
    }
    expect(x.attrs).toEqual(y.attrs)
    expect(x.money).toBe(y.money)
    expect(x.yearLog).toEqual(y.yearLog)
  })

  it('validateState 接受含生活方式标记与周期效果的状态', () => {
    const s = makeGame(7, {
      age: 30,
      tags: ['routine_exercise', 'chronic_pain'],
      pending: [{ id: 'p1', dueAge: 31, money: -3000, attr: 'health', delta: 2, repeat: 2 }],
    })
    expect(validateState(s).issues).toEqual([])
  })
})
