// 第 16 轮：晚年内容扩充测试
// 覆盖：16 个新事件数据校验与晚年年龄边界、8 个读中年及以前标记事件的数据级审计、
// 事件级/选项级门控矩阵、退休机制（事件提前退休 + 到 65 岁自动退休 + 退休金折算边界）、
// 关键效果落地（手术根治/戒烟/回忆录/帮带孙辈/单身领宠）、6 个晚年成就正反判定、
// 三种中年状态（富足在职/单身清贫/已退休）固定 seed 玩到终局的分化与事件池存活。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable, visibleChoices, applyChoice, availableEvents } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { LATE_EVENTS } from '../data/events/late'
import { ALL_EVENTS } from '../data/events'
import { evaluateAchievements, unlockAchievements } from './achievements'
import {
  RETIRE_AGE,
  RETIRE_PENSION_MUL,
  EARLY_PENSION_MUL,
  PENSION_MIN,
  PENSION_MAX,
  pensionFromSalary,
  retirePatch,
} from './career'
import type { GameEvent, GameState, Relation } from './types'

const byId = (id: string): GameEvent => {
  const e = LATE_EVENTS.find((x) => x.id === id)
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

describe('数据完整性与晚年边界', () => {
  it('第 16 轮 16 个 + 第 27 轮氛围 1 个 + 第 29 轮晚年加密 9 个 + 第 47 轮热力补密 8 个 + 第 68 轮倦怠复发 1 个 + 第 70 轮氛围 3 个 + 第 101 轮 4 个 + 第 102 轮薄桶补密 9 个（共 52 个），全部通过 validateEvents，并入池后 ID 无重复', () => {
    expect(LATE_EVENTS).toHaveLength(65)
    expect(validateEvents(LATE_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('全部新事件的年龄窗口落在晚年段（minAge ≥ 51）', () => {
    for (const e of LATE_EVENTS) {
      expect(e.minAge).toBeGreaterThanOrEqual(51)
      expect(e.maxAge).toBeLessThanOrEqual(78)
    }
  })

  it('六大主题（退休/关系/健康/传承/回顾/晚年生计）覆盖 6 个类别', () => {
    const cats = new Set(LATE_EVENTS.map((e) => e.category))
    expect(cats.has('career')).toBe(true) // 退休准备
    expect(cats.has('relationship')).toBe(true)
    expect(cats.has('health')).toBe(true)
    expect(cats.has('education')).toBe(true) // 传帮带
    expect(cats.has('money')).toBe(true) // 小店交接/晚年生计
    expect(cats.has('life')).toBe(true) // 回忆录/热爱传承
    expect(cats.size).toBe(6)
  })

  it('≥6 个事件读取中年及以前的标记（第 14/15 轮埋点的晚年回响）', () => {
    // 中年及以前埋下的标记
    const EARLIER_MARKERS = [
      'cert_track', 'mentor_bond', 'chronic_pain', 'light_smoker', 'avoided_doctor',
      'shop_dream', 'overseas_bond', 'studied_abroad', 'exchanged', 'repaid_mentor',
      'dream_full', 'side_creates', 'dream_bloom', 'artist_path',
    ]
    const gated = LATE_EVENTS.filter((e) =>
      [e.requires, ...e.choices.map((c) => c.requires)].some((cond) =>
        (cond?.tagsAny ?? []).some((t) => EARLIER_MARKERS.includes(t)),
      ),
    )
    expect(gated.length).toBeGreaterThanOrEqual(6)
    // 审计过的名单固定，防止后续改条件悄悄丢掉中年线的晚年回响
    expect(gated.map((e) => e.id).sort()).toEqual(
      [
        'late_mentor_young', 'late_second_surgery', 'late_quit_smoking', 'late_health_debt',
        'late_shop_handover', 'late_overseas_call', 'late_mentor_visit', 'late_dream_legacy',
      ].sort(),
    )
  })
})

describe('事件级门控矩阵（条件不满足则不可触发）', () => {
  it('late_retirement_paperwork 仅 52~64 岁在职者可见（65 岁走自动退休）', () => {
    const ev = byId('late_retirement_paperwork')
    expect(isEventAvailable(makeGame(42, { age: 58, career: EMPLOYED() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58, career: { kind: 'none' } }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 51, career: EMPLOYED() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: RETIRE_AGE, career: EMPLOYED() }), ev)).toBe(false)
  })

  it('late_single_golden 仅无伴侣无配偶者可见；late_growing_old_together 仅已婚可见', () => {
    const single = byId('late_single_golden')
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('friend')] }), single)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('spouse')] }), single)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('partner')] }), single)).toBe(false)
    // 疏远（alive=false）的配偶不算存活关系：单身事件仍可见
    const estrangedSpouse: Relation = { ...relation('spouse'), alive: false, estranged: true }
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [estrangedSpouse] }), single)).toBe(true)

    const together = byId('late_growing_old_together')
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('spouse')] }), together)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('friend')] }), together)).toBe(false)
  })

  it('late_grandchild 需要有孩标记与存活的孩子关系；late_second_surgery 需要 chronic_pain', () => {
    const grand = byId('late_grandchild')
    expect(isEventAvailable(makeGame(42, { age: 60, tags: ['has_child'], relations: [relation('child')] }), grand)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, tags: ['has_child'] }), grand)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 60, relations: [relation('child')] }), grand)).toBe(false)

    expect(isEventAvailable(makeGame(42, { age: 55, tags: ['chronic_pain'] }), byId('late_second_surgery'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 55 }), byId('late_second_surgery'))).toBe(false)
  })

  it('标记门控四件套：戒烟/体检债/小店交接/师恩回响', () => {
    expect(isEventAvailable(makeGame(42, { age: 58, tags: ['light_smoker'] }), byId('late_quit_smoking'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58 }), byId('late_quit_smoking'))).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 58, tags: ['avoided_doctor'] }), byId('late_health_debt'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58, tags: ['shop_dream'] }), byId('late_shop_handover'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58, tags: ['repaid_mentor'] }), byId('late_mentor_visit'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58, tags: ['mentor_bond'] }), byId('late_mentor_visit'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 58 }), byId('late_mentor_visit'))).toBe(false)
  })

  it('late_tight_years 仅手头紧（存款 < 2 万）可见——低收入晚年内容', () => {
    const ev = byId('late_tight_years')
    expect(isEventAvailable(makeGame(42, { age: 60, money: 5000 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, money: 30000 }), ev)).toBe(false)
  })

  it('late_mentor_young 需要带徒资质标记，在职/退休/零工身份均可', () => {
    const ev = byId('late_mentor_young')
    expect(isEventAvailable(makeGame(42, { age: 60, career: { kind: 'retired', pension: 20000 }, tags: ['cert_track'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, career: { kind: 'none' }, tags: ['mentor_bond'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, career: EMPLOYED(), tags: ['cert_track'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 60, career: EMPLOYED() }), ev)).toBe(false)
  })
})

describe('选项级条件（不满足则该按钮隐藏）', () => {
  it('二次手术自费根治需要 3 万存款；越洋探望需要 3 万', () => {
    const surgery = byId('late_second_surgery')
    expect(visibleChoices(makeGame(42, { age: 55, tags: ['chronic_pain'], money: 50000 }), surgery)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 55, tags: ['chronic_pain'], money: 10000 }), surgery)).toHaveLength(2)
    const abroad = byId('late_overseas_call')
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['studied_abroad'], money: 50000 }), abroad)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['studied_abroad'], money: 5000 }), abroad)).toHaveLength(2)
  })

  it('老伴手术请护工需要 2.4 万；帮带孙辈出钱方案需要 1.5 万', () => {
    const together = byId('late_growing_old_together')
    expect(visibleChoices(makeGame(42, { age: 60, relations: [relation('spouse')], money: 40000 }), together)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 60, relations: [relation('spouse')], money: 10000 }), together)).toHaveLength(2)
    const grand = byId('late_grandchild')
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['has_child'], relations: [relation('child')], money: 30000 }), grand)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['has_child'], relations: [relation('child')], money: 5000 }), grand)).toHaveLength(2)
  })

  it('适老化改造全面方案需要 3 万；回顾展需要 1.2 万', () => {
    const home = byId('late_age_friendly_home')
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['homeowner'], money: 50000 }), home)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['homeowner'], money: 8000 }), home)).toHaveLength(2)
    const legacy = byId('late_dream_legacy')
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['dream_kept'], money: 30000 }), legacy)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 60, tags: ['dream_kept'], money: 5000 }), legacy)).toHaveLength(2)
  })
})

describe('退休机制（第 16 轮补齐的引擎缺口）', () => {
  it('retirePatch：按最后年薪折算退休金，岗位标记转为行业经历；非在职 no-op', () => {
    // 第 22 轮起退休金挂钩缴费年限：缴满 25 年系数 1.0，与旧全额口径一致（60000×0.4=24000）
    const s = makeGame(42, { age: 60, career: EMPLOYED(60000), workYears: 25 })
    const patch = retirePatch(s)
    expect(patch.ok).toBe(true)
    expect(patch.career).toMatchObject({ kind: 'retired', pension: 24000 })
    expect(patch.addTags).toContain('ex_office_clerk')
    expect(patch.addTags).toContain('retired')
    expect(patch.removeTags).toContain('job_office_clerk')
    expect(retirePatch(makeGame(42, { age: 60, career: { kind: 'none' } })).ok).toBe(false)
  })

  it('退休金折算边界：下限保底、上限封顶、提前退休打折', () => {
    expect(pensionFromSalary(20000)).toBe(PENSION_MIN) // 8000 → 保底 12000
    expect(pensionFromSalary(200000)).toBe(PENSION_MAX) // 80000 → 封顶 60000
    expect(pensionFromSalary(60000)).toBe(24000)
    expect(pensionFromSalary(60000, EARLY_PENSION_MUL)).toBe(19200)
    expect(pensionFromSalary(60000, RETIRE_PENSION_MUL)).toBe(24000)
  })

  it('到 65 岁年度结算自动退休：拿全额退休金、年志与 key 履历落账', () => {
    const s = makeGame(7, { age: 64, career: EMPLOYED(80000, 2), money: 50000, workYears: 25 })
    const next = advanceYear(s)
    expect(next.career).toMatchObject({ kind: 'retired', pension: 32000 })
    expect(next.tags).toContain('retired')
    expect(next.tags).not.toContain('job_office_clerk')
    expect(next.history.some((h) => h.title === '退休' && h.key && h.age === 65)).toBe(true)
    expect(next.yearLog.some((l) => l.includes('退休'))).toBe(true)
    expect(validateState(next).issues).toEqual([])
  })

  it('64 岁时不触发自动退休（未到龄），65 岁在职工次年年金生效', () => {
    const s = makeGame(7, { age: 63, career: EMPLOYED(80000, 2) })
    const next = advanceYear(s)
    expect(next.career.kind).toBe('employed')
  })

  it('事件提前退休：retire 效果带 mul 折算，retired/retired_early 标记落账', () => {
    const ev = byId('late_retirement_paperwork')
    const s = makeGame(42, { age: 55, career: EMPLOYED(60000), money: 10000, workYears: 25 })
    const vis = visibleChoices(s, ev)
    const rawIdx = ev.choices.findIndex((c) => c.text.includes('提前办了') && vis.includes(c))
    const out = applyChoice(s, ev, rawIdx).state
    expect(out.career).toMatchObject({ kind: 'retired', pension: 19200 })
    expect(out.tags).toContain('retired')
    expect(out.tags).toContain('retired_early')
    expect(out.tags).toContain('ex_office_clerk')
    expect(out.money).toBe(10000) // 退休不收钱
  })
})

describe('选项效果正确应用（按原始 choices 下标定位）', () => {
  /** 用文本找到目标选项的「原始下标」，并确认它当前可见 */
  function rawIndexOf(state: GameState, ev: GameEvent, keyword: string): number {
    const idx = ev.choices.findIndex((c) => c.text.includes(keyword) && visibleChoices(state, ev).includes(c))
    if (idx < 0) throw new Error(`选项不可见或不存在: ${keyword}`)
    return idx
  }

  it('二次手术根治：扣 3 万、chronic_pain 移除、一年后健康 +7 的延迟效果入队', () => {
    const ev = byId('late_second_surgery')
    const s = makeGame(42, { age: 55, money: 60000, tags: ['chronic_pain'] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '做彻底')).state
    expect(out.money).toBe(30000)
    expect(out.tags).not.toContain('chronic_pain')
    expect(out.tags).toContain('health_comeback')
    const heal = out.pending.find((p) => p.attr === 'health' && p.delta === 7)
    expect(heal).toBeDefined()
    expect(heal!.dueAge).toBe(56)
  })

  it('彻底戒烟：light_smoker 移除、quit_smoking 授予、延迟健康回报入队', () => {
    const ev = byId('late_quit_smoking')
    const s = makeGame(42, { age: 58, tags: ['light_smoker'] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '扔了')).state
    expect(out.tags).not.toContain('light_smoker')
    expect(out.tags).toContain('quit_smoking')
    const heal = out.pending.find((p) => p.attr === 'health' && p.delta === 4)
    expect(heal).toBeDefined()
  })

  it('回忆录：memoir 标记授予；帮带孙辈：grandparent_duty 授予、亲子亲密度 +8', () => {
    const memoir = byId('late_memoir')
    const out1 = applyChoice(makeGame(42, { age: 60 }), memoir, rawIndexOf(makeGame(42, { age: 60 }), memoir, '写下来')).state
    expect(out1.tags).toContain('memoir')

    const grand = byId('late_grandchild')
    const s2 = makeGame(42, { age: 60, tags: ['has_child'], relations: [relation('child', 65)] })
    const out2 = applyChoice(s2, grand, rawIndexOf(s2, grand, '全力帮带')).state
    expect(out2.tags).toContain('grandparent_duty')
    expect(out2.relations.find((r) => r.kind === 'child')!.closeness).toBe(73)
  })

  it('单身互助社：新增朋友关系；领养猫：新增宠物关系 + pet_owner 标记', () => {
    const ev = byId('late_single_golden')
    const s = makeGame(42, { age: 62, relations: [] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '互助社')).state
    expect(out.tags).toContain('mutual_aid')
    expect(out.relations.some((r) => r.kind === 'friend' && r.alive)).toBe(true)

    const s2 = makeGame(42, { age: 62, relations: [] })
    const out2 = applyChoice(s2, ev, rawIndexOf(s2, ev, '领养')).state
    expect(out2.tags).toContain('pet_owner')
    expect(out2.relations.some((r) => r.kind === 'pet' && r.alive)).toBe(true)
  })

  it('小店交给伙计：shop_handover 落账；回忆录/圆梦展等选项对无标记角色天然不可见', () => {
    const ev = byId('late_shop_handover')
    const s = makeGame(42, { age: 60, tags: ['shop_dream'], money: 10000 })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '伙计')).state
    expect(out.tags).toContain('shop_handover')
    expect(out.money).toBe(25000)
  })
})

describe('6 个晚年成就的正反判定', () => {
  const has = (s: GameState, id: string) => evaluateAchievements(s).some((a) => a.id === id)

  it('ach_silver_mentor：带徒标记 + 交际 ≥ 50', () => {
    const ok = makeGame(42, { tags: ['late_mentor'], attrs: { health: 70, happiness: 50, smarts: 50, social: 55, stress: 40 } })
    expect(has(ok, 'ach_silver_mentor')).toBe(true)
    const shy = makeGame(42, { tags: ['late_mentor'], attrs: { health: 70, happiness: 50, smarts: 50, social: 40, stress: 40 } })
    expect(has(shy, 'ach_silver_mentor')).toBe(false)
    expect(has(makeGame(42, { attrs: { health: 70, happiness: 50, smarts: 50, social: 90, stress: 40 } }), 'ach_silver_mentor')).toBe(false)
  })

  it('ach_quit_smoking：戒烟标记 + 健康 ≥ 45', () => {
    const ok = makeGame(42, { tags: ['quit_smoking'], attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    expect(has(ok, 'ach_quit_smoking')).toBe(true)
    const weak = makeGame(42, { tags: ['quit_smoking'], attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 40 } })
    expect(has(weak, 'ach_quit_smoking')).toBe(false)
    expect(has(makeGame(42, { tags: ['light_smoker'], attrs: { health: 80, happiness: 50, smarts: 50, social: 50, stress: 40 } }), 'ach_quit_smoking')).toBe(false)
  })

  it('ach_single_golden：60 岁后无存活伴侣/配偶且幸福 ≥ 60（疏远配偶不挡道）', () => {
    const solo = makeGame(42, { age: 62, relations: [relation('friend')], attrs: { health: 70, happiness: 65, smarts: 50, social: 50, stress: 40 } })
    expect(has(solo, 'ach_single_golden')).toBe(true)
    const coupled = makeGame(42, { age: 62, relations: [relation('spouse')], attrs: { health: 70, happiness: 65, smarts: 50, social: 50, stress: 40 } })
    expect(has(coupled, 'ach_single_golden')).toBe(false)
    const estrangedSpouse: Relation = { ...relation('spouse'), alive: false, estranged: true }
    const afterBreakup = makeGame(42, { age: 62, relations: [estrangedSpouse], attrs: { health: 70, happiness: 65, smarts: 50, social: 50, stress: 40 } })
    expect(has(afterBreakup, 'ach_single_golden')).toBe(true)
    const glum = makeGame(42, { age: 62, relations: [], attrs: { health: 70, happiness: 55, smarts: 50, social: 50, stress: 40 } })
    expect(has(glum, 'ach_single_golden')).toBe(false)
    expect(has(makeGame(42, { age: 58, relations: [], attrs: { health: 70, happiness: 70, smarts: 50, social: 50, stress: 40 } }), 'ach_single_golden')).toBe(false)
  })

  it('ach_grandparent：帮带标记 + 存活孩子亲密度 ≥ 70', () => {
    const ok = makeGame(42, { tags: ['grandparent_duty'], relations: [relation('child', 75)] })
    expect(has(ok, 'ach_grandparent')).toBe(true)
    const distant = makeGame(42, { tags: ['grandparent_duty'], relations: [relation('child', 60)] })
    expect(has(distant, 'ach_grandparent')).toBe(false)
    expect(has(makeGame(42, { relations: [relation('child', 90)] }), 'ach_grandparent')).toBe(false)
    const dead: Relation = { ...relation('child', 90), alive: false }
    expect(has(makeGame(42, { tags: ['grandparent_duty'], relations: [dead] }), 'ach_grandparent')).toBe(false)
  })

  it('ach_dream_passed_on：传承标记即可；ach_memoir：回忆录 + 60 岁', () => {
    expect(has(makeGame(42, { tags: ['dream_legacy'] }), 'ach_dream_passed_on')).toBe(true)
    expect(has(makeGame(42, { tags: ['dream_full'] }), 'ach_dream_passed_on')).toBe(false)

    expect(has(makeGame(42, { age: 62, tags: ['memoir'] }), 'ach_memoir')).toBe(true)
    expect(has(makeGame(42, { age: 55, tags: ['memoir'] }), 'ach_memoir')).toBe(false)
    expect(has(makeGame(42, { age: 70 }), 'ach_memoir')).toBe(false)
  })

  it('unlockAchievements 幂等：同一成就不会重复解锁', () => {
    const s = makeGame(42, { tags: ['dream_legacy'] })
    const first = unlockAchievements(s)
    expect(first.unlocked.some((a) => a.id === 'ach_dream_passed_on')).toBe(true)
    const second = unlockAchievements(first.state)
    expect(second.unlocked.some((a) => a.id === 'ach_dream_passed_on')).toBe(false)
  })
})

describe('三种中年状态玩到终局（固定 seed）', () => {
  const SEED = 20260916

  interface LineResult {
    state: GameState
    lateAvailable: Set<string>
    lateSeen: Set<string>
    fallbackYears: number
  }

  /**
   * 从 51 岁的指定中年状态推到终局（phase 变 ended 为止）。
   * 机械策略：每年在可用集中按「年份轮换」取一个事件、点第一个可见选项——
   * 确定性可复现，又不会让固定选第一个的把池尾的晚年事件饿死。
   * lateAvailable 记录每年进入候选的晚年事件；fallbackYears 记录候选为空的年份
   * （真实游戏里这些年会落保底事件——数量必须很少，证明晚年事件池不会耗尽）。
   */
  function playToEnd(patch: Partial<GameState>, pick: 'first' | 'last' = 'first'): LineResult {
    let s = makeGame(SEED, { age: 51, ...patch })
    const lateAvailable = new Set<string>()
    const lateSeen = new Set<string>()
    let fallbackYears = 0
    let guard = 0
    while (s.phase === 'playing' && guard < 40) {
      const year = guard
      guard++
      const cands = availableEvents(s, ALL_EVENTS)
      for (const ev of cands) {
        if (LATE_EVENTS.some((l) => l.id === ev.id)) lateAvailable.add(ev.id)
      }
      if (cands.length === 0) fallbackYears++
      if (cands.length > 0) {
        const chosen = cands[year % cands.length]
        const vis = visibleChoices(s, chosen)
        if (vis.length > 0) {
          const choice = pick === 'first' ? vis[0] : vis[vis.length - 1]
          s = applyChoice(s, chosen, chosen.choices.indexOf(choice)).state
        }
      }
      s = advanceYear(s)
      for (const id of s.seenEvents) {
        if (LATE_EVENTS.some((l) => l.id === id)) lateSeen.add(id)
      }
    }
    return { state: s, lateAvailable, lateSeen, fallbackYears }
  }

  it('富足在职线（有房有娃高薪）到终局：必已退休、状态合法、晚年内容可见', () => {
    const r = playToEnd({
      career: EMPLOYED(120000, 3),
      tags: ['married', 'has_child', 'homeowner', 'grinder', 'ever_employed'],
      relations: [relation('spouse', 70), relation('child', 70), relation('parent', 60)],
      money: 300000,
      attrs: { health: 70, happiness: 55, smarts: 55, social: 55, stress: 45 },
    })
    expect(r.state.phase).toBe('ended')
    expect(r.state.age).toBeGreaterThanOrEqual(74) // 自然走完，不会中途病故
    expect(r.state.career.kind).toBe('retired') // 提前退休或到龄自动退休，殊途同归
    expect(r.state.tags).toContain('retired')
    expect(validateState(r.state).issues).toEqual([])
    expect(Number.isFinite(r.state.money)).toBe(true)
    expect(r.lateAvailable.size).toBeGreaterThanOrEqual(4)
    expect(r.lateSeen.size).toBeGreaterThanOrEqual(1)
    expect(r.fallbackYears).toBeLessThanOrEqual(2)
  })

  it('单身清贫零工线（旧伤+拖延体检+小店梦）到终局：低收入内容真实可用', () => {
    const r = playToEnd({
      career: { kind: 'none' },
      tags: ['chronic_pain', 'avoided_doctor', 'repaid_mentor', 'shop_dream', 'ever_employed'],
      relations: [relation('parent', 55)],
      money: 8000,
      attrs: { health: 68, happiness: 48, smarts: 50, social: 50, stress: 50 },
    })
    expect(r.state.phase).toBe('ended')
    expect(r.state.age).toBeGreaterThanOrEqual(60)
    expect(validateState(r.state).issues).toEqual([])
    expect(Number.isFinite(r.state.money)).toBe(true)
    // 穷过：紧日子事件进入过候选；可能触发补助/搭伙/修理摊路线
    expect(r.lateAvailable.has('late_tight_years')).toBe(true)
    expect(r.lateAvailable.size).toBeGreaterThanOrEqual(4)
    expect(r.fallbackYears).toBeLessThanOrEqual(2)
  })

  it('已退休线（退休金+老伴+小店交接）到终局：两条线内容互不冲突', () => {
    const r = playToEnd({
      career: { kind: 'retired', pension: 24000 },
      tags: ['shop_dream', 'repaid_mentor', 'married', 'ever_employed'],
      relations: [relation('spouse', 70)],
      money: 60000,
      attrs: { health: 72, happiness: 55, smarts: 55, social: 55, stress: 35 },
    }, 'last')
    expect(r.state.phase).toBe('ended')
    expect(r.state.age).toBeGreaterThanOrEqual(65)
    expect(r.state.career.kind).toBe('retired')
    expect(validateState(r.state).issues).toEqual([])
    expect(Number.isFinite(r.state.money)).toBe(true)
    expect(r.lateAvailable.size).toBeGreaterThanOrEqual(4)
    expect(r.fallbackYears).toBeLessThanOrEqual(2)
  })

  it('三线 once 事件在 seenEvents 中绝不重复登记；三线晚年候选集合互有分化', () => {
    const a = playToEnd({
      career: EMPLOYED(120000, 3),
      tags: ['married', 'has_child', 'homeowner', 'ever_employed'],
      relations: [relation('spouse', 70), relation('child', 70)],
      money: 300000,
    })
    const b = playToEnd({
      career: { kind: 'none' },
      tags: ['chronic_pain', 'shop_dream', 'ever_employed'],
      relations: [relation('parent', 55)],
      money: 8000,
    })
    const c = playToEnd({
      career: { kind: 'retired', pension: 24000 },
      tags: ['shop_dream', 'married', 'ever_employed'],
      relations: [relation('spouse', 70)],
      money: 60000,
    }, 'last')
    for (const r of [a, b, c]) {
      for (const id of r.lateSeen) {
        const ev = byId(id)
        if (ev.once) {
          expect(r.state.seenEvents.filter((e) => e === id).length).toBeLessThanOrEqual(1)
        }
      }
    }
    const union = new Set([...a.lateAvailable, ...b.lateAvailable, ...c.lateAvailable])
    // 三线合计触达的晚年事件远多于单线，标记门控造成集合分化
    expect(union.size).toBeGreaterThanOrEqual(8)
    const onlyB = [...b.lateAvailable].filter((id) => !a.lateAvailable.has(id))
    const onlyA = [...a.lateAvailable].filter((id) => !b.lateAvailable.has(id))
    expect(onlyA.length + onlyB.length).toBeGreaterThan(0)
  })
})
