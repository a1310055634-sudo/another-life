// 第 28 轮：中年危机带加密（35～45 岁）测试
// 覆盖：8 个新事件数据规格与正反可用性矩阵、负债时大额隐藏后仍 ≥2 有效抉择、
// RelationEffect.addAnother（第 26 轮遗留的二胎多孩语义）引擎行为与校验器豁免、
// 二胎延迟出生落地盖章 birthAge 与多孩开支衔接、友尽线真实疏远、
// 有偶有孩/有偶无孩/单身三种中年状态的真实抽卡模拟（各自能抽到符合处境的事件）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable, visibleChoices, applyChoice, availableEvents, drawEvent } from './events'
import { validateEvents, type EventValidationIssue } from './validateEvents'
import { validateState } from './validate'
import { applyRelationEffect } from './relations'
import { childExpense } from './finance'
import { mulberry32 } from './rng'
import { MIDLIFE_EVENTS } from '../data/events/midlife'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState, Relation } from './types'

const NEW28 = [
  'mid_young_boss',
  'mid_industry_collapse',
  'mid_second_child',
  'mid_sandwich',
  'mid_partner_career_gap',
  'mid_friend_fallout',
  'mid_budget_downgrade',
  'mid_reunion_compare',
]

const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const EMPLOYED = (salary = 60000, level = 1) =>
  ({ kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level, salary, yearsAtJob: 4 }) as const

const rel = (kind: Relation['kind'], closeness = 60, extra: Partial<Relation> = {}): Relation => ({
  id: `r_${kind}_${Math.random().toString(36).slice(2, 7)}`,
  kind,
  name: `测试${kind}`,
  closeness,
  alive: true,
  ...extra,
})

/** 用文本找到目标选项的「原始下标」，并确认它当前可见 */
function rawIndexOf(state: GameState, ev: GameEvent, keyword: string): number {
  const idx = ev.choices.findIndex((c) => c.text.includes(keyword) && visibleChoices(state, ev).includes(c))
  if (idx < 0) throw new Error(`选项不可见或不存在: ${keyword}`)
  return idx
}

/** 中年家庭夹具：配偶 + 已知出生年龄的孩子（玩家 36 岁 → 大宝 8 岁） */
const FAMILY = {
  relations: [rel('spouse', 70), rel('child', 72, { birthAge: 28 })],
  tags: ['married', 'has_child'],
}

describe('数据完整性（第 28 轮 +8）', () => {
  it('8 个新事件全部存在、年龄窗落在 35～45、通过校验器、并入池后 ID 无重复', () => {
    for (const id of NEW28) {
      const e = byId(id)
      expect(e.minAge).toBe(35)
      expect(e.maxAge).toBe(45)
    }
    expect(validateEvents(MIDLIFE_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('新事件不引用青年阶段标记（第 15 轮青年回响名单保持精确 8 个）', () => {
    const YOUTH_MARKERS = [
      'go_big_city', 'stay_hometown', 'stable_path', 'exchanged', 'studied_abroad',
      'grinder', 'mentor_bond', 'biz_partner', 'dream_kept', 'dream_bloom',
      'artist_path', 'installment', 'gap_year', 'job_hunting', 'work_early',
    ]
    const gated = NEW28.filter((id) => {
      const e = byId(id)
      return [e.requires, ...e.choices.map((c) => c.requires)].some((cond) =>
        (cond?.tagsAny ?? []).some((t) => YOUTH_MARKERS.includes(t)),
      )
    })
    expect(gated).toEqual([])
  })

  it('每个新事件在负债状态下仍有 ≥2 个可结算选项（大额隐藏不产生假选择）', () => {
    for (const id of NEW28) {
      const e = byId(id)
      // 各事件的可触发夹具：统一给家庭/房贷/职业等门槛素材
      const state = makeGame(42, {
        age: 38,
        money: -5000,
        career: EMPLOYED(),
        relations: [...FAMILY.relations, rel('parent', 60), rel('friend', 40)],
        tags: [...FAMILY.tags],
        mortgage: { principal: 300000, balance: 200000, annualPayment: 23900, yearsLeft: 15 },
      })
      // 只对真正可触发的事件断言选项数（reunion 无门槛恒可触发；其余按各自门槛）
      if (!isEventAvailable(state, e)) continue
      expect(visibleChoices(state, e).length).toBeGreaterThanOrEqual(2)
    }
    // 负债线专项：四件大额被隐藏的对照
    expect(visibleChoices(makeGame(42, { age: 38, money: -5000, career: EMPLOYED(), relations: FAMILY.relations, tags: FAMILY.tags }), byId('mid_second_child'))).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 38, money: -5000, relations: [rel('friend', 40)] }), byId('mid_friend_fallout'))).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 38, money: -5000, career: EMPLOYED() }), byId('mid_industry_collapse'))).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 38, money: -5000, relations: [rel('spouse', 60)], tags: ['married'] }), byId('mid_partner_career_gap'))).toHaveLength(2)
  })
})

describe('事件级正反可用性矩阵（8 个新事件）', () => {
  it('mid_young_boss 仅 35～45 岁在职者可见', () => {
    const ev = byId('mid_young_boss')
    expect(isEventAvailable(makeGame(42, { age: 36, career: EMPLOYED() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 34, career: EMPLOYED() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 46, career: EMPLOYED() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38, career: { kind: 'unemployed', weeks: 4 } }), ev)).toBe(false)
  })

  it('mid_industry_collapse 仅 35～45 岁在职者可见', () => {
    const ev = byId('mid_industry_collapse')
    expect(isEventAvailable(makeGame(42, { age: 40, career: EMPLOYED() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 34, career: EMPLOYED() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 40, career: { kind: 'none' } }), ev)).toBe(false)
  })

  it('mid_second_child 需要配偶在身边且已育；单身/无孩线不可见', () => {
    const ev = byId('mid_second_child')
    expect(isEventAvailable(makeGame(42, { age: 36, ...FAMILY }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 36, relations: FAMILY.relations, tags: ['married'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 36, relations: [rel('child', 70, { birthAge: 28 })], tags: ['has_child'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 34, ...FAMILY }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 46, ...FAMILY }), ev)).toBe(false)
  })

  it('mid_sandwich 需要孩子在养且父母在世；缺一头即不可见', () => {
    const ev = byId('mid_sandwich')
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [...FAMILY.relations, rel('parent', 60)], tags: ['has_child'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('parent', 60)], tags: ['has_child'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38, relations: FAMILY.relations, tags: [] }), ev)).toBe(false)
    // 孩子疏远（alive=false）后视为没有孩子在养
    const estrangedKid = { ...rel('child', 0), alive: false, estranged: true, birthAge: 28 }
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('parent', 60), estrangedKid], tags: ['has_child'] }), ev)).toBe(false)
  })

  it('mid_partner_career_gap 仅已婚可见（恋人/单身线不可见）', () => {
    const ev = byId('mid_partner_career_gap')
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('spouse', 60)] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('partner', 60)] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38 }), ev)).toBe(false)
  })

  it('mid_friend_fallout 需要存活朋友且亲密度 ≤55（走下坡的友情才会撞上借钱局）', () => {
    const ev = byId('mid_friend_fallout')
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('friend', 40)] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('friend', 70)] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 38 }), ev)).toBe(false)
    // 亲密度 55 恰在门槛上可见；56 不可见
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('friend', 55)] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38, relations: [rel('friend', 56)] }), ev)).toBe(false)
  })

  it('mid_budget_downgrade 需要名下有未还清的房贷（还清/无贷不可见）', () => {
    const ev = byId('mid_budget_downgrade')
    const withLoan = { mortgage: { principal: 300000, balance: 100000, annualPayment: 23900, yearsLeft: 8 } }
    expect(isEventAvailable(makeGame(42, { age: 38, ...withLoan }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 38 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 34, ...withLoan }), ev)).toBe(false)
  })

  it('mid_reunion_compare 无前置门槛，35～45 岁恒可见', () => {
    const ev = byId('mid_reunion_compare')
    expect(isEventAvailable(makeGame(42, { age: 38 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 34 }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 46 }), ev)).toBe(false)
  })
})

describe('选项级门槛与隐藏矩阵', () => {
  it('mid_reunion_compare 做东选项需要 2 万存款；普通人只见赴约与不去', () => {
    const ev = byId('mid_reunion_compare')
    expect(visibleChoices(makeGame(42, { age: 38, money: 25000 }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 38, money: 15000 }), ev)).toHaveLength(2)
  })

  it('mid_budget_downgrade 摊牌选项只在有配偶时出现', () => {
    const ev = byId('mid_budget_downgrade')
    const loan = { mortgage: { principal: 300000, balance: 100000, annualPayment: 23900, yearsLeft: 8 } }
    expect(visibleChoices(makeGame(42, { age: 38, ...loan, relations: [rel('spouse', 60)] }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 38, ...loan }), ev)).toHaveLength(2)
  })
})

describe('选项效果正确落地（按原始 choices 下标）', () => {
  it('mid_young_boss 硬顶：压力 +4、一年后幸福 -3 延迟入队', () => {
    const ev = byId('mid_young_boss')
    const s = makeGame(42, {
      age: 36,
      career: EMPLOYED(),
      attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 40 },
    })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '硬顶')).state
    expect(out.attrs.stress).toBe(44)
    const d = out.pending.find((p) => p.attr === 'happiness' && p.delta === -3)
    expect(d).toBeDefined()
    expect(d!.dueAge).toBe(37)
  })

  it('mid_young_boss 骑驴找马：授予 job_hunting（失业后可与三十五岁简历线衔接）', () => {
    const ev = byId('mid_young_boss')
    const s = makeGame(42, { age: 36, career: EMPLOYED() })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '骑驴找马')).state
    expect(out.tags).toContain('job_hunting')
  })

  it('mid_industry_collapse 下车：进入待业、补偿 18000 到账、落下 laid_off', () => {
    const ev = byId('mid_industry_collapse')
    const s = makeGame(42, { age: 38, career: EMPLOYED(60000), money: 20000 })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '下车')).state
    expect(out.career.kind).toBe('unemployed')
    expect(out.money).toBe(38000)
    expect(out.tags).toContain('laid_off')
  })

  it('mid_industry_collapse 押注：-12000、两年后 +26000 延迟入队', () => {
    const ev = byId('mid_industry_collapse')
    const s = makeGame(42, { age: 38, career: EMPLOYED(60000), money: 50000 })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '押上')).state
    expect(out.money).toBe(38000)
    const d = out.pending.find((p) => p.money === 26000)
    expect(d).toBeDefined()
    expect(d!.dueAge).toBe(40)
  })

  it('mid_budget_downgrade 降级：幸福 -2 压力 -2、一年后省下 6000 延迟入队', () => {
    const ev = byId('mid_budget_downgrade')
    const s = makeGame(42, {
      age: 38,
      mortgage: { principal: 300000, balance: 100000, annualPayment: 23900, yearsLeft: 8 },
      attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 40 },
    })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '降级')).state
    expect(out.attrs.happiness).toBe(48)
    expect(out.attrs.stress).toBe(38)
    const d = out.pending.find((p) => p.money === 6000)
    expect(d).toBeDefined()
  })

  it('mid_friend_fallout 算清旧账：亲密度 -60 触底，来年疏远兜底接手（友尽真实发生）', () => {
    const ev = byId('mid_friend_fallout')
    const s = makeGame(42, { age: 38, relations: [rel('friend', 40)] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '算清')).state
    expect(out.relations[0].closeness).toBe(0)
    const ended = advanceYear(out)
    const f = ended.relations[0]
    expect(f.alive).toBe(false)
    expect(f.estranged).toBe(true)
    expect(ended.tags).toContain('estranged_friend')
    expect(ended.yearLog.some((l) => l.includes('断了来往'))).toBe(true)
    expect(validateState(ended).issues).toEqual([])
  })

  it('mid_friend_fallout 再帮最后一次：-10000、朋友 +6、两年后还回一半', () => {
    const ev = byId('mid_friend_fallout')
    const s = makeGame(42, { age: 38, money: 30000, relations: [rel('friend', 40)] })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '再帮最后')).state
    expect(out.money).toBe(20000)
    expect(out.relations[0].closeness).toBe(46)
    const d = out.pending.find((p) => p.money === 6000)
    expect(d).toBeDefined()
  })
})

describe('addAnother：二胎多孩语义（第 26 轮遗留清偿）', () => {
  it('引擎单元：普通 add 在已有存活同类关系时 no-op（V1 语义不变），addAnother 追加第二条', () => {
    const base: Relation[] = [rel('child', 70, { birthAge: 28 })]
    const noop = applyRelationEffect(base, { kind: 'child', add: true, name: '宝宝', closeness: 65 }, 36, 36)
    expect(noop).toHaveLength(1)
    const added = applyRelationEffect(base, { kind: 'child', add: true, addAnother: true, name: '小宝', closeness: 60 }, 36, 36)
    expect(added).toHaveLength(2)
    const second = added[1]
    expect(second.name).toBe('小宝')
    expect(second.birthAge).toBe(36)
    expect(second.id).not.toBe(added[0].id)
    // 原数组未被修改（纯函数）
    expect(base).toHaveLength(1)
  })

  it('校验器：条件已保证孩子存在时普通 add 报「必然无效」，addAnother 豁免', () => {
    const mk = (addAnother?: boolean): GameEvent => ({
      id: 'test_add_child',
      category: 'relationship',
      title: '测试',
      text: '测试',
      minAge: 30,
      maxAge: 40,
      requires: { relationKinds: ['child'] },
      choices: [
        { text: '甲', effects: [{ relation: { kind: 'child', add: true, ...(addAnother ? { addAnother: true } : {}) } }] },
        { text: '乙', effects: [] },
      ],
    })
    const issuesOf = (g: GameEvent): EventValidationIssue[] => validateEvents([g])
    expect(issuesOf(mk()).some((i) => i.field.endsWith('.add'))).toBe(true)
    expect(issuesOf(mk(true)).filter((i) => i.field.endsWith('.add'))).toEqual([])
  })

  it('mid_second_child 要二胎：延迟一年落地，多出一名「小宝」且出生年龄盖章为落地年', () => {
    const ev = byId('mid_second_child')
    const s = makeGame(42, { age: 36, money: 100000, career: EMPLOYED(), ...FAMILY })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '添个伴')).state
    expect(out.money).toBe(95000)
    expect(out.relations).toHaveLength(2) // 尚未落地
    const p = out.pending.find((x) => x.relation?.add)
    expect(p).toBeDefined()
    expect(p!.relation!.addAnother).toBe(true)
    expect(p!.relation!.name).toBe('小宝')
    expect(p!.dueAge).toBe(37)
    const next = advanceYear(out)
    const kids = next.relations.filter((r) => r.kind === 'child' && r.alive)
    expect(kids).toHaveLength(2)
    const xiaobao = kids.find((k) => k.name === '小宝')
    expect(xiaobao).toBeDefined()
    expect(xiaobao!.birthAge).toBe(37)
    expect(next.tags).toContain('has_child')
    expect(validateState(next).issues).toEqual([])
  })

  it('多孩养育开支逐孩累加：K12 10000 + 婴幼儿 14000；孪生对照增量恰为 14000（年初在册口径）', () => {
    // 与第 26 轮孪生对照同口径：孩子在册开局，跨一次年度结算对照（差值=第二个孩子的增量）
    const base = { age: 36, money: 150000, career: EMPLOYED(), relations: [rel('spouse', 70), rel('child', 72, { birthAge: 28 })], tags: ['married', 'has_child'] }
    const withTwo = advanceYear(makeGame(7, { ...base, relations: [...base.relations, rel('child', 60, { birthAge: 37, name: '小宝' })] }))
    const withOne = advanceYear(makeGame(7, base))
    expect(withTwo.money - withOne.money).toBe(-14000)
    expect(childExpense(withTwo)).toBe(24000)
    expect(childExpense(withOne)).toBe(10000)
    // 年志保留既有「孩子的吃穿用度」口径
    expect(withTwo.yearLog.some((l) => l.includes('孩子的吃穿用度'))).toBe(true)
  })
})

describe('三种中年状态的真实抽卡模拟（35～45 岁推进）', () => {
  const SEED = 20261028
  /** 新事件抽卡权重放大 50 倍——验收意图是「真实引擎抽得到、抽了能结算」，不是公平频率 */
  const traitWeight = (e: GameEvent) => (NEW28.includes(e.id) ? 50 : 1)

  interface LineResult {
    final: GameState
    drawn: string[]
    everAvailable: Set<string>
  }

  function runLine(_label: string, patch: Partial<GameState>): LineResult {
    let s = makeGame(SEED, {
      age: 35,
      money: 100000,
      career: EMPLOYED(60000),
      relations: [rel('friend', 40)],
      ...patch,
    })
    const drawn: string[] = []
    const everAvailable = new Set<string>()
    const rng = mulberry32(SEED)
    for (let year = 0; year < 11 && s.phase === 'playing'; year++) {
      for (const ev of availableEvents(s, ALL_EVENTS)) {
        if (NEW28.includes(ev.id)) everAvailable.add(ev.id)
      }
      const picked = drawEvent(s, ALL_EVENTS, rng, traitWeight)
      if (NEW28.includes(picked.id)) drawn.push(picked.id)
      const vis = visibleChoices(s, picked)
      if (vis.length > 0) {
        s = applyChoice(s, picked, picked.choices.indexOf(vis[0])).state
      }
      s = advanceYear(s)
    }
    expect(s.phase).toBe('playing')
    expect(validateState(s).issues).toEqual([])
    return { final: s, drawn, everAvailable }
  }

  const FAMILY_EVENT_CONDITIONS = [
    'mid_second_child',
    'mid_sandwich',
    'mid_partner_career_gap',
    'mid_budget_downgrade',
  ]

  it('有偶有孩：家庭事件可触发且被真实抽到；其余两线绝不触发', () => {
    const line = runLine('有偶有孩', { relations: [...FAMILY.relations, rel('parent', 60), rel('friend', 40)], tags: [...FAMILY.tags], mortgage: { principal: 300000, balance: 200000, annualPayment: 23900, yearsLeft: 15 } })
    // 家庭事件在该线可触发（二胎/挤压/配偶空窗至少其一进入过候选）
    const familyOnLine = line.everAvailable
    expect(
      familyOnLine.has('mid_second_child') || familyOnLine.has('mid_sandwich') || familyOnLine.has('mid_partner_career_gap'),
    ).toBe(true)
    // 真实抽到过新事件
    expect(line.drawn.length).toBeGreaterThanOrEqual(1)
  })

  it('有偶无孩：二胎与挤压事件从不进入候选；配偶空窗可见', () => {
    const line = runLine('有偶无孩', { relations: [rel('spouse', 70), rel('parent', 60), rel('friend', 40)], tags: ['married'] })
    expect(line.everAvailable.has('mid_second_child')).toBe(false)
    expect(line.everAvailable.has('mid_sandwich')).toBe(false)
    expect(line.everAvailable.has('mid_budget_downgrade')).toBe(false)
    expect(line.everAvailable.has('mid_partner_career_gap')).toBe(true)
    expect(line.drawn.every((id) => !FAMILY_EVENT_CONDITIONS.slice(0, 2).includes(id))).toBe(true)
  })

  it('单身：四个家庭结构事件全部不可见；职场与同学会线照常运转', () => {
    const line = runLine('单身', { relations: [rel('friend', 40)] })
    for (const id of FAMILY_EVENT_CONDITIONS) {
      expect(line.everAvailable.has(id)).toBe(false)
      expect(line.drawn).not.toContain(id)
    }
    expect(line.everAvailable.has('mid_young_boss')).toBe(true)
    expect(line.everAvailable.has('mid_reunion_compare')).toBe(true)
    expect(line.drawn.length).toBeGreaterThanOrEqual(1)
  })

  it('三线终局状态互不越权：单身线没有孩子与配偶，有孩线家庭完整', () => {
    const single = runLine('单身', { relations: [rel('friend', 40)] })
    expect(single.final.relations.some((r) => r.kind === 'child' || r.kind === 'spouse')).toBe(false)
    const withKid = runLine('有偶有孩', { relations: [...FAMILY.relations, rel('parent', 60), rel('friend', 40)], tags: [...FAMILY.tags] })
    expect(withKid.final.relations.filter((r) => r.kind === 'child' && r.alive).length).toBeGreaterThanOrEqual(1)
  })
})
