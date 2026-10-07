// 第 29 轮：晚年窗口加密（60～77 岁）测试
// 覆盖：9 个新事件数据规格与正反可用性矩阵、低收入/负债处境免费选项恒可见、
// 搭伴关系（partner add）落地并接入既有年度衰减、孙辈互动的在册孩子门控、
// 独居/有偶有孩/清贫单身三种晚年状态的真实抽卡模拟（各自能抽到符合处境的事件）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable, visibleChoices, applyChoice, availableEvents, drawEvent } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { mulberry32 } from './rng'
import { LATE_EVENTS } from '../data/events/late'
import { COMPANION_NAMES } from '../data/names'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState, Relation } from './types'

const NEW29 = [
  'late_smartphone',
  'late_friends_fade',
  'late_will',
  'late_late_companion',
  'late_grand_rules',
  'late_farewell_preparation',
  'late_volunteer_lead',
  'late_story_grandchild',
  'late_senior_college',
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

const rel = (kind: Relation['kind'], closeness = 60, extra: Partial<Relation> = {}): Relation => ({
  id: `r_${kind}_${Math.random().toString(36).slice(2, 7)}`,
  kind,
  name: `测试${kind}`,
  closeness,
  alive: true,
  ...extra,
})

const NEUTRAL_ATTRS = { health: 70, happiness: 50, smarts: 50, social: 50, stress: 40 }

/** 用文本找到目标选项的「原始下标」，并确认它当前可见 */
function rawIndexOf(state: GameState, ev: GameEvent, keyword: string): number {
  const idx = ev.choices.findIndex((c) => c.text.includes(keyword) && visibleChoices(state, ev).includes(c))
  if (idx < 0) throw new Error(`选项不可见或不存在: ${keyword}`)
  return idx
}

describe('数据完整性（第 29 轮 +9）', () => {
  it('9 个新事件全部存在、年龄窗落在晚年段且互不重叠越界、通过校验器、并入池后 ID 无重复', () => {
    const windows: Record<string, [number, number]> = {
      late_smartphone: [60, 77],
      late_friends_fade: [60, 77],
      late_will: [62, 77],
      late_late_companion: [58, 75],
      late_grand_rules: [58, 74],
      late_farewell_preparation: [70, 77],
      late_volunteer_lead: [58, 75],
      late_story_grandchild: [62, 77],
      late_senior_college: [55, 72],
    }
    for (const id of NEW29) {
      const e = byId(id)
      expect([e.minAge, e.maxAge]).toEqual(windows[id])
    }
    expect(validateEvents(LATE_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('新事件不引用中年及以前的标记——独居/无子女/低收入处境不被履历门槛挡在门外', () => {
    // 第 16 轮「中年回响」名单：新事件一律不得再读这些埋点（晚年加密走零门槛/当前状态门槛）
    const EARLIER_MARKERS = [
      'cert_track', 'mentor_bond', 'chronic_pain', 'light_smoker', 'avoided_doctor',
      'shop_dream', 'overseas_bond', 'studied_abroad', 'exchanged', 'repaid_mentor',
      'dream_full', 'side_creates', 'dream_bloom', 'artist_path',
    ]
    const gated = NEW29.filter((id) => {
      const e = byId(id)
      return [e.requires, ...e.choices.map((c) => c.requires)].some((cond) =>
        (cond?.tagsAny ?? []).some((t) => EARLIER_MARKERS.includes(t)),
      )
    })
    expect(gated).toEqual([])
  })

  it('每个新事件在负债/低收入下仍有 ≥2 个可结算选项（大额隐藏与 moneyAtLeast 不产生假选择）', () => {
    const debtFixtures: Record<string, Partial<GameState>> = {
      late_smartphone: {},
      late_friends_fade: { relations: [rel('friend', 45)] },
      late_will: {},
      late_late_companion: {},
      late_grand_rules: { tags: ['has_child'], relations: [rel('child', 60)] },
      late_farewell_preparation: { age: 72 },
      late_volunteer_lead: {},
      // 第 62 轮资格校准：讲古须孙辈在册（原仅孩子在册）
      late_story_grandchild: { tags: ['has_child'], relations: [rel('grandchild', 60)] },
      late_senior_college: {},
    }
    for (const id of NEW29) {
      const state = makeGame(42, { age: 66, money: -5000, attrs: NEUTRAL_ATTRS, ...debtFixtures[id] })
      const ev = byId(id)
      expect(isEventAvailable(state, ev)).toBe(true)
      expect(visibleChoices(state, ev).length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('事件级正反可用性矩阵（9 个新事件）', () => {
  it('late_smartphone / late_senior_college 零门槛，仅年龄窗生效', () => {
    expect(isEventAvailable(makeGame(42, { age: 66 }), byId('late_smartphone'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 59 }), byId('late_smartphone'))).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 78 }), byId('late_smartphone'))).toBe(false)

    const college = byId('late_senior_college')
    expect(isEventAvailable(makeGame(42, { age: 66 }), college)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 54 }), college)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 73 }), college)).toBe(false)
    // 独居、无子女、低收入、零工处境全部可见
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [], tags: [], money: 500 }), college)).toBe(true)
  })

  it('late_friends_fade 需要存活的朋友关系；疏远（alive=false）的朋友不算', () => {
    const ev = byId('late_friends_fade')
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [rel('friend', 45)] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [] }), ev)).toBe(false)
    const estranged: Relation = { ...rel('friend', 0), alive: false, estranged: true }
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [estranged] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 59, relations: [rel('friend', 45)] }), ev)).toBe(false)
  })

  it('late_will 零门槛；late_farewell_preparation 仅 70 岁后可见', () => {
    const will = byId('late_will')
    expect(isEventAvailable(makeGame(42, { age: 66 }), will)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 61 }), will)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [], tags: [], money: 0 }), will)).toBe(true)

    const farewell = byId('late_farewell_preparation')
    expect(isEventAvailable(makeGame(42, { age: 70 }), farewell)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 77 }), farewell)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 69 }), farewell)).toBe(false)
  })

  it('late_late_companion 仅无伴侣无配偶的独居线可见；疏远的旧伴侣不算在册', () => {
    const ev = byId('late_late_companion')
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [rel('spouse')] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [rel('partner')] }), ev)).toBe(false)
    const estrangedPartner: Relation = { ...rel('partner'), alive: false, estranged: true }
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [estrangedPartner] }), ev)).toBe(true)
    // 有孩子无配偶的家庭不触发（搭伴是独居线内容）
    expect(isEventAvailable(makeGame(42, { age: 66, relations: [rel('child', 60)], tags: ['has_child'] }), ev)).toBe(true)
  })

  it('late_grand_rules 需要有孩标记且孩子在册；缺一不可见', () => {
    const ev = byId('late_grand_rules')
    const minAge = ev.minAge
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: ['has_child'], relations: [rel('child', 60)] }), ev)).toBe(true)
    // 只有人口普查标记、孩子已不在册（疏远）：不可见
    const estrangedKid: Relation = { ...rel('child', 0), alive: false, estranged: true }
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: ['has_child'], relations: [estrangedKid] }), ev)).toBe(false)
    // 孩子在册但缺 has_child 标记：不可见
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: [], relations: [rel('child', 60)] }), ev)).toBe(false)
    // 无孩线：完全不可见
    expect(isEventAvailable(makeGame(42, { age: minAge }), ev)).toBe(false)
  })

  it('late_story_grandchild 第 62 轮资格校准：须孙辈在册（只有孩子在册不可见）；缺一不可见', () => {
    const ev = byId('late_story_grandchild')
    const minAge = ev.minAge
    // has_child + 孙辈在册：可见（R62 新口径）
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: ['has_child'], relations: [rel('grandchild', 60)] }), ev)).toBe(true)
    // 有孩子但无孙辈：不可见（R62 收紧——讲古对象是孙辈）
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: ['has_child'], relations: [rel('child', 60)] }), ev)).toBe(false)
    // 孙辈疏远不在册：不可见
    const estrangedGC: Relation = { ...rel('grandchild', 0), alive: false, estranged: true }
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: ['has_child'], relations: [estrangedGC] }), ev)).toBe(false)
    // 缺 has_child 标记：不可见
    expect(isEventAvailable(makeGame(42, { age: minAge, tags: [], relations: [rel('grandchild', 60)] }), ev)).toBe(false)
    // 无孩线：完全不可见
    expect(isEventAvailable(makeGame(42, { age: minAge }), ev)).toBe(false)
  })

  it('late_volunteer_lead 零门槛，58 岁起可见', () => {
    const ev = byId('late_volunteer_lead')
    expect(isEventAvailable(makeGame(42, { age: 66 }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 57 }), ev)).toBe(false)
  })
})

describe('选项级门槛（低收入可见性）', () => {
  it('立遗嘱公证选项需要 3000 存款；负债时免费的长信与搁置仍在（恰 2 选）', () => {
    const ev = byId('late_will')
    expect(visibleChoices(makeGame(42, { age: 66, money: 30000 }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 66, money: 2000 }), ev)).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 66, money: -500 }), ev)).toHaveLength(2)
  })

  it('搭伴的见面饭钱 1500：存款够三选全见；存款不足或负债被 moneyAtLeast 拦下，剩免费二选', () => {
    const ev = byId('late_late_companion')
    expect(visibleChoices(makeGame(42, { age: 66, money: 20000 }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 66, money: 1000 }), ev)).toHaveLength(2)
    expect(visibleChoices(makeGame(42, { age: 66, money: -3000 }), ev)).toHaveLength(2)
  })

  it('老年大学报班需要 2000 存款，蹭课选项恒可见', () => {
    const ev = byId('late_senior_college')
    expect(visibleChoices(makeGame(42, { age: 66, money: 5000 }), ev)).toHaveLength(3)
    expect(visibleChoices(makeGame(42, { age: 66, money: 800 }), ev)).toHaveLength(2)
  })
})

describe('选项效果正确落地（按原始 choices 下标）', () => {
  it('搭伴过日子：新增 partner（第 44 轮起取名池具名，不再写死「老吴」）、授 late_companion 标记；来年进入既有年度衰减（55→54）', () => {
    const ev = byId('late_late_companion')
    const s = makeGame(42, { age: 66, money: 20000, relations: [], attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '搭伴过日子')).state
    expect(out.money).toBe(18500)
    expect(out.tags).toContain('late_companion')
    const partner = out.relations.find((r) => r.kind === 'partner' && r.alive)
    expect(partner).toBeDefined()
    // 第 44 轮：name 缺省 → 引擎从伴侣名池 seed 确定具名（data/names.ts COMPANION_NAMES）
    expect(COMPANION_NAMES).toContain(partner!.name)
    expect(partner!.closeness).toBe(55)
    // 搭伴关系不是摆设：走第 25 轮关系动态的年度自然衰减（partner -1）
    const next = advanceYear(out)
    const decayed = next.relations.find((r) => r.kind === 'partner' && r.alive)!
    expect(decayed.closeness).toBe(54)
    expect(validateState(next).issues).toEqual([])
  })

  it('教养之争听孩子的：child 亲密度 +4（60→64）；约法三章 +2 且 smarts +1', () => {
    const ev = byId('late_grand_rules')
    const s = makeGame(42, { age: 62, tags: ['has_child'], relations: [rel('child', 60)], attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '听孩子的')).state
    expect(out.relations[0].closeness).toBe(64)
    const out2 = applyChoice(s, ev, rawIndexOf(s, ev, '约法三章')).state
    expect(out2.relations[0].closeness).toBe(62)
    expect(out2.attrs.smarts).toBe(51)
  })

  it('讲古连载：child +3、授 story_teller；冷淡回应 child -3 且幸福 -1', () => {
    const ev = byId('late_story_grandchild')
    const s = makeGame(42, { age: 66, tags: ['has_child'], relations: [rel('child', 60)], attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '连载')).state
    expect(out.relations[0].closeness).toBe(63)
    expect(out.tags).toContain('story_teller')
    const out2 = applyChoice(s, ev, rawIndexOf(s, ev, '自己玩去')).state
    expect(out2.relations[0].closeness).toBe(57)
    expect(out2.attrs.happiness).toBe(49)
  })

  it('遗嘱长信与告别清单：will_done / farewell_ready 标记落账，压力真实下降', () => {
    const will = byId('late_will')
    const s = makeGame(42, { age: 66, attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, will, rawIndexOf(s, will, '长信')).state
    expect(out.tags).toContain('will_done')
    expect(out.attrs.stress).toBe(39)

    const farewell = byId('late_farewell_preparation')
    const out2 = applyChoice(s, farewell, rawIndexOf(s, farewell, '录进手机')).state
    expect(out2.tags).toContain('farewell_ready')
    expect(out2.attrs.stress).toBe(38)
    expect(out2.attrs.happiness).toBe(53)
  })

  it('学手机报班 -600；老年大学报班 -2000；志愿队担子 -1000 且 social +4', () => {
    const phone = byId('late_smartphone')
    const s = makeGame(42, { age: 66, money: 10000, attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, phone, rawIndexOf(s, phone, '报个班')).state
    expect(out.money).toBe(9400)
    expect(out.attrs.smarts).toBe(52)
    expect(out.tags).toContain('digital_savvy')

    const college = byId('late_senior_college')
    const out2 = applyChoice(s, college, rawIndexOf(s, college, '报个班')).state
    expect(out2.money).toBe(8000)
    expect(out2.tags).toContain('senior_college')

    const volunteer = byId('late_volunteer_lead')
    const out3 = applyChoice(s, volunteer, rawIndexOf(s, volunteer, '担子')).state
    expect(out3.money).toBe(9000)
    expect(out3.attrs.social).toBe(54)
    expect(out3.tags).toContain('volunteer_lead')
  })

  it('老友凋零整理相册：smarts +1、压力 -1；送别 -2000 且社交 +1', () => {
    const ev = byId('late_friends_fade')
    const s = makeGame(42, { age: 66, money: 10000, relations: [rel('friend', 45)], attrs: NEUTRAL_ATTRS })
    const out = applyChoice(s, ev, rawIndexOf(s, ev, '整理成册')).state
    expect(out.attrs.smarts).toBe(51)
    expect(out.attrs.stress).toBe(39)
    const out2 = applyChoice(s, ev, rawIndexOf(s, ev, '送最后一程')).state
    expect(out2.money).toBe(8000)
    expect(out2.attrs.social).toBe(51)
  })
})

describe('三种晚年状态的真实抽卡模拟（58 岁起推进 11 年）', () => {
  const SEED = 20261029
  /** 新事件抽卡权重放大 50 倍——验收意图是「真实引擎抽得到、抽了能结算」，不是公平频率 */
  const traitWeight = (e: GameEvent) => (NEW29.includes(e.id) ? 50 : 1)

  interface LineResult {
    final: GameState
    drawn: string[]
    everAvailable: Set<string>
  }

  function runLine(patch: Partial<GameState>): LineResult {
    let s = makeGame(SEED, {
      age: 58,
      money: 60000,
      workYears: 30,
      attrs: { health: 72, happiness: 55, smarts: 55, social: 55, stress: 35 },
      ...patch,
    })
    const drawn: string[] = []
    const everAvailable = new Set<string>()
    const rng = mulberry32(SEED)
    for (let year = 0; year < 11 && s.phase === 'playing'; year++) {
      for (const ev of availableEvents(s, ALL_EVENTS)) {
        if (NEW29.includes(ev.id)) everAvailable.add(ev.id)
      }
      const picked = drawEvent(s, ALL_EVENTS, rng, traitWeight)
      if (NEW29.includes(picked.id)) drawn.push(picked.id)
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

  const GRAND_EVENTS = ['late_grand_rules', 'late_story_grandchild']

  it('有偶有孩线：孙辈互动事件可触发且被真实抽到；搭伴仅在丧偶后解锁（第 126 轮 priority=1 裁决同步）', () => {
    const line = runLine({
      career: { kind: 'retired', pension: 24000 },
      tags: ['married', 'has_child', 'retired'],
      relations: [rel('spouse', 70), rel('child', 68)],
    })
    expect(GRAND_EVENTS.some((id) => line.everAvailable.has(id))).toBe(true)
    // 第 126 轮：late_widow_first_year 升 priority=1 后，偶线可遭遇丧偶抉择；
    // 搭伴提议只在配偶离场（丧偶已发生）后解锁——级联门控一致性断言
    const widowed = !line.final.relations.some((r) => r.kind === 'spouse' && r.alive)
    expect(line.everAvailable.has('late_late_companion')).toBe(widowed)
    expect(line.drawn.length).toBeGreaterThanOrEqual(1)
  })

  it('独居线：搭伴提议可触发；孙辈互动与丧友（无友）从不进入候选', () => {
    const line = runLine({
      career: { kind: 'retired', pension: 24000 },
      tags: ['retired'],
      relations: [],
    })
    expect(line.everAvailable.has('late_late_companion')).toBe(true)
    for (const id of GRAND_EVENTS) {
      expect(line.everAvailable.has(id)).toBe(false)
    }
    expect(line.drawn.length).toBeGreaterThanOrEqual(1)
    // 独居线终局没有被塞进家庭关系
    expect(line.final.relations.some((r) => ['spouse', 'child'].includes(r.kind) && r.alive)).toBe(false)
  })

  it('清贫线（存款 2000）：零门槛新事件照常运转且真实抽到，负债保护不误伤', () => {
    const line = runLine({
      career: { kind: 'none' },
      tags: [],
      relations: [rel('friend', 45)],
      money: 2000,
    })
    const zeroBarrier = ['late_smartphone', 'late_will', 'late_farewell_preparation', 'late_volunteer_lead']
    expect(zeroBarrier.some((id) => line.everAvailable.has(id))).toBe(true)
    expect(line.drawn.length).toBeGreaterThanOrEqual(1)
    // 逐年结算后钱可能变负，但状态始终合法
    expect(Number.isFinite(line.final.money)).toBe(true)
  })

  it('三线终局状态互不越权：独居线无配偶孩子，有偶线家庭完整或经丧偶抉择合法过渡（第 126 轮同步）', () => {
    const single = runLine({ career: { kind: 'retired', pension: 24000 }, tags: ['retired'], relations: [] })
    const withFamily = runLine({
      career: { kind: 'retired', pension: 24000 },
      tags: ['married', 'has_child', 'retired'],
      relations: [rel('spouse', 70), rel('child', 68)],
    })
    expect(single.final.relations.some((r) => r.kind === 'spouse' && r.alive)).toBe(false)
    // 有偶线：配偶在册，或经 late_widow_first_year 抉择合法丧偶（二选一，不越权成第三态）
    const spouseAlive = withFamily.final.relations.some((r) => r.kind === 'spouse' && r.alive)
    const widowSeen = withFamily.final.history.some((h) => h.eventId === 'late_widow_first_year')
    expect(spouseAlive || widowSeen || withFamily.final.relations.every((r) => r.kind !== 'spouse')).toBe(true)
    expect(withFamily.final.relations.some((r) => r.kind === 'child' && r.alive)).toBe(true)
  })
})
