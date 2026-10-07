// 第 15 轮：中年内容扩充测试
// 覆盖：19 个新事件数据校验与中年年龄边界、8 个读青年标记事件的数据级审计、
// 事件级/选项级门控矩阵、关键效果落地（转型/根治/标记授予/离职补偿）、
// 孩子养育开支的单年增量孪生对照、5 个中年成就正反判定、
// 双线（不同青年经历）固定 seed 玩到 50 岁的分化与状态合法性。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable, visibleChoices, applyChoice, availableEvents } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { MIDLIFE_EVENTS } from '../data/events/midlife'
import { ALL_EVENTS } from '../data/events'
import { evaluateAchievements, unlockAchievements } from './achievements'
import type { GameEvent, GameState, Relation } from './types'

const byId = (id: string): GameEvent => {
  const e = MIDLIFE_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const EMPLOYED = (salary = 60000, level = 1) =>
  ({ kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level, salary, yearsAtJob: 4 }) as const

const relation = (kind: Relation['kind'], closeness = 60): Relation => ({
  id: `r_${kind}`,
  kind,
  name: `测试${kind}`,
  closeness,
  alive: true,
})

describe('数据完整性与中年边界', () => {
  it('第 15 轮新增 19 个 + 第 27 轮氛围 mid_nav_memory + 第 28 轮危机带 8 个 + 第 68 轮倦怠线 5 个 + 第 70 轮氛围 2 个 + 第 101 轮 3 个 + 第 102 轮薄桶补密 2 个（共 40 个），全部通过 validateEvents，并入池后 ID 无重复', () => {
    expect(MIDLIFE_EVENTS).toHaveLength(40)
    expect(validateEvents(MIDLIFE_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('全部新事件的年龄窗口落在中年段（31～50 岁）', () => {
    for (const e of MIDLIFE_EVENTS) {
      expect(e.minAge).toBeGreaterThanOrEqual(31)
      expect(e.maxAge).toBeLessThanOrEqual(50)
    }
  })

  it('五大主题（职业/重新学习/财务/关系/健康）全部覆盖', () => {
    const cats = new Set(MIDLIFE_EVENTS.map((e) => e.category))
    expect(cats.has('career')).toBe(true)
    expect(cats.has('education')).toBe(true)
    expect(cats.has('money')).toBe(true)
    expect(cats.has('relationship')).toBe(true)
    expect(cats.has('health')).toBe(true)
    expect(cats.size).toBeGreaterThanOrEqual(5)
  })

  it('≥8 个事件读取青年阶段的标记（职业/财务/关系/历史）', () => {
    // 第 14 轮青年事件埋点 + 引擎职业历史标记
    const YOUTH_MARKERS = [
      'go_big_city', 'stay_hometown', 'stable_path', 'exchanged', 'studied_abroad',
      'grinder', 'mentor_bond', 'biz_partner', 'dream_kept', 'dream_bloom',
      'artist_path', 'installment', 'gap_year', 'job_hunting', 'work_early',
    ]
    // 事件级或选项级 requires 引用青年标记都算数（军令状读 grinder 属于选项级）
    const gated = MIDLIFE_EVENTS.filter((e) =>
      [e.requires, ...e.choices.map((c) => c.requires)].some((cond) =>
        (cond?.tagsAny ?? []).some((t) => YOUTH_MARKERS.includes(t)),
      ),
    )
    expect(gated.length).toBeGreaterThanOrEqual(8)
    // 审计过的名单固定，防止后续改条件悄悄丢掉青年线回响
    expect(gated.map((e) => e.id).sort()).toEqual(
      [
        'mid_layoff_wave', 'mid_age_trap', 'mid_mentor_reversal', 'mid_biz_payout',
        'mid_installment_payoff', 'mid_dream_rekindle', 'mid_abroad_reconnect',
        'mid_hometown_house',
      ].sort(),
    )
  })
})

describe('事件级门控矩阵（条件不满足则不可触发）', () => {
  it('mid_layoff_wave 仅在职者可见', () => {
    const ev = byId('mid_layoff_wave')
    expect(isEventAvailable(makeGame(42, { age: 36, career: EMPLOYED() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 36, career: { kind: 'none' } }), ev)).toBe(false)
  })

  it('mid_age_trap 仅「待业+有求职/被裁历史」可见（读取青年求职标记）', () => {
    const ev = byId('mid_age_trap')
    expect(
      isEventAvailable(makeGame(42, { age: 36, career: { kind: 'unemployed', weeks: 10 }, tags: ['job_hunting'] }), ev),
    ).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 36, career: EMPLOYED(), tags: ['job_hunting'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 36, career: { kind: 'unemployed', weeks: 10 } }), ev)).toBe(false)
  })

  it('mid_mentor_reversal 需要 mentor_bond；mid_biz_payout 需要 biz_partner', () => {
    expect(isEventAvailable(makeGame(42, { age: 38, tags: ['mentor_bond'] }), byId('mid_mentor_reversal'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38 }), byId('mid_mentor_reversal'))).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38, tags: ['biz_partner'] }), byId('mid_biz_payout'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38 }), byId('mid_biz_payout'))).toBe(false)
  })

  it('mid_installment_payoff 需要 installment；mid_dream_rekindle 需要青年热爱标记', () => {
    expect(isEventAvailable(makeGame(42, { age: 35, tags: ['installment'] }), byId('mid_installment_payoff'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 35 }), byId('mid_installment_payoff'))).toBe(false)
    for (const tag of ['dream_kept', 'dream_bloom', 'artist_path']) {
      expect(isEventAvailable(makeGame(42, { age: 40, tags: [tag] }), byId('mid_dream_rekindle'))).toBe(true)
    }
    expect(isEventAvailable(makeGame(42, { age: 40 }), byId('mid_dream_rekindle'))).toBe(false)
  })

  it('mid_abroad_reconnect 需要留学/交换标记，纯大城市闯荡者不触发', () => {
    const ev = byId('mid_abroad_reconnect')
    expect(isEventAvailable(makeGame(42, { age: 37, tags: ['studied_abroad'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 37, tags: ['exchanged'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 37, tags: ['go_big_city'] }), ev)).toBe(false)
  })

  it('mid_hometown_house 需要留乡/回乡标记，大城市线不触发', () => {
    const ev = byId('mid_hometown_house')
    expect(isEventAvailable(makeGame(42, { age: 39, tags: ['stay_hometown'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 39, tags: ['stable_path'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 39, tags: ['go_big_city'] }), ev)).toBe(false)
  })

  it('mid_marriage_flat 仅已婚可见；mid_child_interest / mid_teen_door 仅已育可见', () => {
    expect(isEventAvailable(makeGame(42, { age: 35, tags: ['married'] }), byId('mid_marriage_flat'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 35 }), byId('mid_marriage_flat'))).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 35, tags: ['has_child'] }), byId('mid_child_interest'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 35 }), byId('mid_child_interest'))).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38, tags: ['has_child'] }), byId('mid_teen_door'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38 }), byId('mid_teen_door'))).toBe(false)
  })

  it('mid_old_injury 需要 chronic_pain；mid_smoke_break 需要高压力', () => {
    expect(isEventAvailable(makeGame(42, { age: 41, tags: ['chronic_pain'] }), byId('mid_old_injury'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 41 }), byId('mid_old_injury'))).toBe(false)
    const stressed = { age: 41, attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 60 } }
    const calm = { ...stressed, attrs: { ...stressed.attrs, stress: 40 } }
    expect(isEventAvailable(makeGame(42, stressed), byId('mid_smoke_break'))).toBe(true)
    expect(isEventAvailable(makeGame(42, calm), byId('mid_smoke_break'))).toBe(false)
  })
})

describe('选项级条件（不满足则该按钮隐藏）', () => {
  it('mid_layoff_wave 军令状只有 grinder 可见', () => {
    const ev = byId('mid_layoff_wave')
    const g = makeGame(42, { age: 36, career: EMPLOYED() })
    expect(visibleChoices(g, ev)).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 36, career: EMPLOYED(), tags: ['grinder'] }), ev)).toHaveLength(3)
  })

  it('mid_industry_shift 技术岗选项需要本科+学业 55', () => {
    const ev = byId('mid_industry_shift')
    const bachelor = makeGame(42, {
      age: 36, career: EMPLOYED(), education: 'bachelor',
      skills: { academics: 60, vocational: 0 },
    })
    expect(visibleChoices(bachelor, ev)).toHaveLength(3)
    const college = makeGame(42, {
      age: 36, career: EMPLOYED(), education: 'college',
      skills: { academics: 60, vocational: 0 },
    })
    expect(visibleChoices(college, ev)).toHaveLength(2)
    const lowAcademic = makeGame(42, {
      age: 36, career: EMPLOYED(), education: 'bachelor',
      skills: { academics: 40, vocational: 0 },
    })
    expect(visibleChoices(lowAcademic, ev)).toHaveLength(2)
  })

  it('mid_school_district 买房选项需要 15 万存款；mid_abroad_reconnect 入股需要 4 万', () => {
    const district = byId('mid_school_district')
    expect(visibleChoices(makeGame(42, { age: 35, tags: ['has_child'], money: 160000 }), district)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 35, tags: ['has_child'], money: 50000 }), district)).toHaveLength(2)
    const invest = byId('mid_abroad_reconnect')
    expect(visibleChoices(makeGame(42, { age: 37, tags: ['studied_abroad'], money: 50000 }), invest)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 37, tags: ['studied_abroad'], money: 20000 }), invest)).toHaveLength(2)
  })

  it('mid_mentor_reversal 内荐需要交际 55；mid_teen_door 请长辈需要交际 50', () => {
    const mentor = byId('mid_mentor_reversal')
    const socialHigh = makeGame(42, {
      age: 38, tags: ['mentor_bond'],
      attrs: { health: 70, happiness: 50, smarts: 50, social: 60, stress: 40 },
    })
    const socialLow = makeGame(42, {
      age: 38, tags: ['mentor_bond'],
      attrs: { health: 70, happiness: 50, smarts: 50, social: 40, stress: 40 },
    })
    expect(visibleChoices(socialHigh, mentor)).toHaveLength(3)
    expect(visibleChoices(socialLow, mentor)).toHaveLength(2)
    const teen = byId('mid_teen_door')
    const parentHigh = makeGame(42, {
      age: 40, tags: ['has_child'],
      attrs: { health: 70, happiness: 50, smarts: 50, social: 55, stress: 40 },
    })
    const parentLow = makeGame(42, {
      age: 40, tags: ['has_child'],
      attrs: { health: 70, happiness: 50, smarts: 50, social: 40, stress: 40 },
    })
    expect(visibleChoices(parentHigh, teen)).toHaveLength(3)
    expect(visibleChoices(parentLow, teen)).toHaveLength(2)
  })

  it('mid_age_trap 老本行选项需要职业技能 25', () => {
    const ev = byId('mid_age_trap')
    const skilled = makeGame(42, {
      age: 36, career: { kind: 'unemployed', weeks: 8 }, tags: ['laid_off'],
      skills: { academics: 30, vocational: 30 },
    })
    expect(visibleChoices(skilled, ev)).toHaveLength(4)
    const unskilled = makeGame(42, {
      age: 36, career: { kind: 'unemployed', weeks: 8 }, tags: ['laid_off'],
      skills: { academics: 30, vocational: 10 },
    })
    expect(visibleChoices(unskilled, ev)).toHaveLength(3)
  })
})

describe('选项效果正确应用（按原始 choices 下标定位）', () => {
  /** 用文本找到目标选项的「原始下标」，并确认它当前可见 */
  function rawIndexOf(state: GameState, ev: GameEvent, keyword: string): number {
    const idx = ev.choices.findIndex((c) => c.text.includes(keyword) && visibleChoices(state, ev).includes(c))
    if (idx < 0) throw new Error(`选项不可见或不存在: ${keyword}`)
    return idx
  }

  it('分期一次结清：扣 9000、installment 标记移除', () => {
    const ev = byId('mid_installment_payoff')
    const s = makeGame(42, { age: 35, money: 20000, tags: ['installment'] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '一次结清')).state
    expect(out.money).toBe(11000)
    expect(out.tags).not.toContain('installment')
  })

  it('旧伤手术：chronic_pain 移除、health_comeback 授予、一年后健康 +8 的延迟效果入队', () => {
    const ev = byId('mid_old_injury')
    const s = makeGame(42, { age: 43, money: 60000, tags: ['chronic_pain'] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '彻底手术')).state
    expect(out.money).toBe(35000)
    expect(out.tags).not.toContain('chronic_pain')
    expect(out.tags).toContain('health_comeback')
    const heal = out.pending.find((p) => p.attr === 'health' && p.delta === 8)
    expect(heal).toBeDefined()
    expect(heal!.dueAge).toBe(44)
  })

  it('旧伤康复训练：授予 rehab_program 标记与周期性费用（补上第 12 轮机制缺口）', () => {
    const ev = byId('mid_old_injury')
    const s = makeGame(42, { age: 43, money: 10000, tags: ['chronic_pain'] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '康复训练')).state
    expect(out.tags).toContain('rehab_program')
    expect(out.tags).toContain('chronic_pain') // 理疗只缓解，不根治
    const fee = out.pending.find((p) => p.money === -3000)
    expect(fee).toBeDefined()
    expect(fee!.repeat).toBe(2)
  })

  it('接下香烟：light_smoker 授予（补上授予途径缺口）、压力即时 -5', () => {
    const ev = byId('mid_smoke_break')
    const s = makeGame(42, {
      age: 38, career: EMPLOYED(),
      attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 60 },
    })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '接过烟')).state
    expect(out.tags).toContain('light_smoker')
    expect(out.attrs.stress).toBe(55)
  })

  it('裁员拿补偿：进入待业、账户 +24000', () => {
    const ev = byId('mid_layoff_wave')
    const s = makeGame(42, { age: 36, career: EMPLOYED(60000), money: 10000 })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, 'N+1')).state
    expect(out.career.kind).toBe('unemployed')
    expect(out.money).toBe(34000)
  })

  it('中年摆摊创业：真实入职 stall_vendor 并落下 mid_pivot 标记', () => {
    const ev = byId('mid_age_trap')
    const s = makeGame(42, {
      age: 36, career: { kind: 'unemployed', weeks: 8 }, tags: ['job_hunting'],
      skills: { academics: 30, vocational: 30 }, money: 30000,
    })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '摆摊创业')).state
    expect(out.career).toMatchObject({ kind: 'employed', jobId: 'stall_vendor', level: 1 })
    expect(out.tags).toContain('mid_pivot')
    expect(out.money).toBe(15000)
  })

  it('翻新老屋接父母住： homeowner/cared_for_parents 落账、父子亲密度 +12', () => {
    const ev = byId('mid_hometown_house')
    const s = makeGame(42, {
      age: 39, tags: ['stay_hometown'], money: 80000,
      relations: [relation('parent', 50)],
    })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '翻新')).state
    expect(out.tags).toContain('homeowner')
    expect(out.tags).toContain('cared_for_parents')
    expect(out.money).toBe(20000)
    expect(out.relations.find((r) => r.kind === 'parent')!.closeness).toBe(62)
  })

  it('辞职全职创作：quitJob 生效（进入待业）、dream_full 授予（中年转型的激进路线真实存在）', () => {
    const ev = byId('mid_dream_rekindle')
    const s = makeGame(42, { age: 40, career: EMPLOYED(60000), tags: ['dream_kept'], money: 30000 })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '全职')).state
    expect(out.career.kind).toBe('unemployed')
    expect(out.tags).toContain('dream_full')
    expect(out.money).toBe(20000)
  })
})

describe('孩子的持续养育开支（第 15 轮补第 11 轮缺口）', () => {
  it('有存活孩子时年开支恰好 +10,000，且年志附注可解释', () => {
    const base = {
      age: 35,
      career: EMPLOYED(60000),
      money: 30000,
      attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 40 },
    }
    const noChild = advanceYear(makeGame(7, { ...base, relations: [relation('parent')] }))
    const withChild = advanceYear(
      makeGame(7, { ...base, relations: [relation('parent'), relation('child', 80)] }),
    )
    // 单年增量对照：两线起点相同，唯一差异是孩子 → 金钱差应精确等于养育开支
    expect(noChild.money - withChild.money).toBe(10000)
    expect(withChild.yearLog.some((l) => l.includes('孩子的吃穿用度'))).toBe(true)
    expect(noChild.yearLog.some((l) => l.includes('孩子的吃穿用度'))).toBe(false)
    for (const s of [noChild, withChild]) expect(validateState(s).issues).toEqual([])
  })

  it('孩子关系疏远（alive=false）后养育开支停止', () => {
    const base = { age: 35, career: EMPLOYED(60000), money: 30000 }
    const estranged: Relation = { ...relation('child', 80), alive: false, estranged: true }
    const alive = advanceYear(makeGame(7, { ...base, relations: [relation('child', 80)] }))
    const dead = advanceYear(makeGame(7, { ...base, relations: [estranged] }))
    expect(dead.money - alive.money).toBe(10000)
  })
})

describe('5 个中年成就的正反判定', () => {
  const has = (s: GameState, id: string) => evaluateAchievements(s).some((a) => a.id === id)

  it('ach_mid_pivot：转行标记+在职+职级≥2 且年过三十', () => {
    const base = { age: 34, tags: ['mid_pivot'] }
    expect(has(makeGame(42, { ...base, career: EMPLOYED(60000, 2) }), 'ach_mid_pivot')).toBe(true)
    expect(has(makeGame(42, { ...base, career: EMPLOYED(60000, 1) }), 'ach_mid_pivot')).toBe(false)
    expect(has(makeGame(42, { age: 30, tags: ['mid_pivot'], career: EMPLOYED(60000, 2) }), 'ach_mid_pivot')).toBe(false)
  })

  it('ach_pillar：有孩+照顾过父母+不负债 且年过三十', () => {
    const base = { age: 36, tags: ['has_child', 'cared_for_parents'] }
    expect(has(makeGame(42, { ...base, money: 0 }), 'ach_pillar')).toBe(true)
    expect(has(makeGame(42, { ...base, money: -1 }), 'ach_pillar')).toBe(false)
    expect(has(makeGame(42, { age: 30, tags: base.tags, money: 5000 }), 'ach_pillar')).toBe(false)
    expect(has(makeGame(42, { age: 36, tags: ['has_child'], money: 5000 }), 'ach_pillar')).toBe(false)
  })

  it('ach_warm_home：房+配偶+孩子三件套缺一不可', () => {
    expect(has(makeGame(42, { tags: ['homeowner', 'married', 'has_child'] }), 'ach_warm_home')).toBe(true)
    expect(has(makeGame(42, { tags: ['married', 'has_child'] }), 'ach_warm_home')).toBe(false)
    expect(has(makeGame(42, { tags: ['homeowner', 'has_child'] }), 'ach_warm_home')).toBe(false)
  })

  it('ach_health_comeback：手术标记+旧伤已除+健康≥50', () => {
    const ok = makeGame(42, { tags: ['health_comeback'], attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    expect(has(ok, 'ach_health_comeback')).toBe(true)
    const stillPain = makeGame(42, {
      tags: ['health_comeback', 'chronic_pain'],
      attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 40 },
    })
    expect(has(stillPain, 'ach_health_comeback')).toBe(false)
    const weak = makeGame(42, { tags: ['health_comeback'], attrs: { health: 45, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    expect(has(weak, 'ach_health_comeback')).toBe(false)
  })

  it('ach_dream_lived：全职热爱标记+幸福≥55', () => {
    const happy = makeGame(42, { tags: ['dream_full'], attrs: { health: 70, happiness: 56, smarts: 50, social: 50, stress: 40 } })
    expect(has(happy, 'ach_dream_lived')).toBe(true)
    const glum = makeGame(42, { tags: ['dream_full'], attrs: { health: 70, happiness: 54, smarts: 50, social: 50, stress: 40 } })
    expect(has(glum, 'ach_dream_lived')).toBe(false)
    expect(has(makeGame(42, { attrs: { health: 70, happiness: 80, smarts: 50, social: 50, stress: 40 } }), 'ach_dream_lived')).toBe(false)
  })

  it('unlockAchievements 幂等：同一成就不会重复解锁', () => {
    const s = makeGame(42, { tags: ['homeowner', 'married', 'has_child'] })
    const first = unlockAchievements(s)
    expect(first.unlocked.some((a) => a.id === 'ach_warm_home')).toBe(true)
    const second = unlockAchievements(first.state)
    expect(second.unlocked.some((a) => a.id === 'ach_warm_home')).toBe(false)
  })
})

describe('双线长线实测：两种青年经历玩到 50 岁（固定 seed）', () => {
  const SEED = 20260915

  /**
   * 机械策略：每年抽可用集第一个事件；pick 决定点第一个还是最后一个可见选项。
   * 两条线用不同的青年背景 + 相反的选项倾向，制造真实的经历分化。
   */
  function playTo50(backgroundId: string, traitId: string, pick: 'first' | 'last'): { state: GameState; seenMid: Set<string> } {
    let s = createNewGame({ seed: SEED, backgroundId, traitId, name: '中年实测' })
    const seenMid = new Set<string>()
    for (let year = 0; year < 32 && s.phase === 'playing'; year++) {
      for (const ev of availableEvents(s, ALL_EVENTS)) {
        if (MIDLIFE_EVENTS.some((m) => m.id === ev.id)) seenMid.add(ev.id)
      }
      const cands = availableEvents(s, ALL_EVENTS)
      if (cands.length > 0) {
        const vis = visibleChoices(s, cands[0])
        if (vis.length > 0) {
          const choice = pick === 'first' ? vis[0] : vis[vis.length - 1]
          s = applyChoice(s, cands[0], cands[0].choices.indexOf(choice)).state
        }
      }
      s = advanceYear(s)
    }
    return { state: s, seenMid }
  }

  it('两条不同青年线都能稳定推到 50 岁，状态始终合法', () => {
    const a = playTo50('rural', 'ambitious', 'first') // 农家+野心家：拼命三郎式青年
    const b = playTo50('wealthy', 'bookworm', 'last') // 富裕+书虫：安稳中带转向的青年
    for (const { state } of [a, b]) {
      expect(state.age).toBe(50)
      expect(state.phase).toBe('playing')
      expect(validateState(state).issues).toEqual([])
    }
    // 机械策略下 20 年中年窗口，每线至少真实见到 2 个中年新事件（池 19 个、多带门控）
    expect(a.seenMid.size).toBeGreaterThanOrEqual(2)
    expect(b.seenMid.size).toBeGreaterThanOrEqual(2)
  })

  it('不同青年经历在中年触达的中年事件集合不同（分化证据）', () => {
    const a = playTo50('rural', 'ambitious', 'first')
    const b = playTo50('wealthy', 'bookworm', 'last')
    // 至少存在一条线见到对方没见到的中年事件——青年标记门控造成的中年分叉
    const onlyA = [...a.seenMid].filter((id) => !b.seenMid.has(id))
    const onlyB = [...b.seenMid].filter((id) => !a.seenMid.has(id))
    expect(onlyA.length + onlyB.length).toBeGreaterThan(0)
    // once 事件在 seenEvents 里绝不重复登记（seenMid 只说明"进入过候选"，可能未被抽中）
    const checkOnce = (line: ReturnType<typeof playTo50>) => {
      for (const id of line.seenMid) {
        const ev = byId(id)
        if (ev.once) expect(line.state.seenEvents.filter((e) => e === id).length).toBeLessThanOrEqual(1)
      }
    }
    checkOnce(a)
    checkOnce(b)
  })
})
