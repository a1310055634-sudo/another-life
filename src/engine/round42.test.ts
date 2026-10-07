// 第 42 轮：父母去世事件线测试（正反可用性 + 病危提速 + 三状态模拟 + 链路闭环）
// 验收口径（PROMPT-V3.md 第 42 轮）：
// - 每事件正反可用性测试（在册/去世/标记资格两侧）
// - 三状态模拟（父母健在长线 / 病危线 / 去世线）各能抽到对应处境事件，
//   且错误状态从不进入候选（逐年在册状态动态核对）
// - 病危提速 ×5 属数值语义改动：附孪生对照（critical 线首次去世显著更早）
// - singleChoiceOk 白名单纪律不破（新事件全无标记）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import {
  applyChoice,
  conditionFailReason,
  drawEvent,
  isEventAvailable,
} from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { PARENT_EVENTS } from '../data/events/parents'
import { mulberry32 } from './rng'
import {
  settleParentDeath,
  parentDeathRiskPerMille,
  CRITICAL_TAG,
  CRITICAL_YEARS,
  GRIEF_TAG,
  PARENT_AGE_OFFSET,
} from './parents'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

/** 双亲在册夹具（与 ordinary 初始一致） */
function aliveParents(): Relation[] {
  return [
    { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true },
    { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
  ]
}

/** 双亲去世夹具：deathAge 按「玩家 playerAgeAtDeath + 28」口径（与结算一致） */
function deadParents(playerAgeAtDeath: number, extra: Partial<Relation> = {}): Relation[] {
  const deathAge = playerAgeAtDeath + PARENT_AGE_OFFSET
  return [
    { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true, deathAge, ...extra },
    { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true, deathAge, ...extra },
  ]
}

const PARENT_IDS = PARENT_EVENTS.map((e) => e.id)

/** 新事件权重 ×50 的放大池（验证「抽得到、抽了能结算」，非公平频率） */
function amplify(): GameEvent[] {
  return ALL_EVENTS.map((e) =>
    PARENT_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
  )
}

interface SimYear {
  age: number
  parentsAlive: number
  avail: string[]
  drawn: string | null
}

/** 逐年推进：记录每年在册父母数、新事件可用集、实际抽中 */
function simulate(start: GameState, years: number, seed: number): { state: GameState; years: SimYear[] } {
  const pool = amplify()
  const rng = mulberry32(seed)
  let s = start
  const rows: SimYear[] = []
  for (let i = 0; i < years && s.phase === 'playing'; i++) {
    const parentsAlive = s.relations.filter((r) => r.kind === 'parent' && r.alive).length
    const avail = PARENT_EVENTS.filter((e) => isEventAvailable(s, e)).map((e) => e.id)
    const ev = drawEvent(s, pool, rng)
    rows.push({ age: s.age, parentsAlive, avail, drawn: ev?.id ?? null })
    s = advanceYear(s)
  }
  return { state: s, years: rows }
}

describe('第 42 轮：数据规格与校验', () => {
  it('六个事件入池（第 102 轮 +par_remarry / +par_roles_reverse → 8 个）：id 精确、每事件 ≥2 选项、validateEvents 零 issue', () => {
    expect(PARENT_EVENTS).toHaveLength(10)
    expect(PARENT_EVENTS.map((e) => e.id)).toEqual([
      'rel_parent_critical',
      'rel_parent_deathbed',
      'rel_parent_funeral',
      'rel_parent_memorial',
      'rel_parent_relics',
      'rel_parent_last_one',
      'par_remarry',
      'par_roles_reverse',
      'par_parent_phone_fun',
      'par_parent_reunion',
    ])
    for (const e of PARENT_EVENTS) expect(e.choices.length).toBeGreaterThanOrEqual(2)
    expect(validateEvents(PARENT_EVENTS)).toEqual([])
    // singleChoiceOk 白名单纪律：新事件全无标记
    for (const e of PARENT_EVENTS) expect(e.singleChoiceOk).toBeUndefined()
  })
})

describe('第 42 轮：正反可用性矩阵（验收①）', () => {
  it('rel_parent_critical：在册 ✓ / 无父母 ✗ / 去世双亲 ✗（40 岁在窗口内）', () => {
    const ev = findEvent('rel_parent_critical')
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: aliveParents() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: [] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: deadParents(17) }), ev)).toBe(false)
  })

  it('rel_parent_deathbed：病危标记+在册 ✓ / 无标记 ✗ / 标记但已去世 ✗', () => {
    const ev = findEvent('rel_parent_deathbed')
    expect(
      isEventAvailable(makeGame(1, { age: 45, money: 30000, tags: [CRITICAL_TAG], relations: aliveParents() }), ev),
    ).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: aliveParents() }), ev)).toBe(false)
    expect(
      isEventAvailable(makeGame(1, { age: 45, money: 30000, tags: [CRITICAL_TAG], relations: deadParents(17) }), ev),
    ).toBe(false)
  })

  it('rel_parent_funeral：去世 1/2 年内 ✓ / 在册 ✗ / 去世 4 年 ✗（once 窗口外）', () => {
    const ev = findEvent('rel_parent_funeral')
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: deadParents(44) }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 46, money: 30000, relations: deadParents(44) }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: aliveParents() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(1, { age: 48, money: 30000, relations: deadParents(44) }), ev)).toBe(false)
  })

  it('rel_parent_memorial：去世 3 年内 ✓ / 4 年外 ✗；relics：6 年内 ✓ / 7 年外 ✗', () => {
    const memorial = findEvent('rel_parent_memorial')
    const relics = findEvent('rel_parent_relics')
    expect(isEventAvailable(makeGame(1, { age: 47, money: 30000, relations: deadParents(44) }), memorial)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 48, money: 30000, relations: deadParents(44) }), memorial)).toBe(false)
    expect(isEventAvailable(makeGame(1, { age: 48, money: 30000, relations: deadParents(44) }), relics)).toBe(true)
    expect(isEventAvailable(makeGame(1, { age: 51, money: 30000, relations: deadParents(44) }), relics)).toBe(false)
  })

  it('rel_parent_last_one：双亲皆逝+3 年内 ✓ / 一位在世 ✗ / 无送别档案 ✗', () => {
    const ev = findEvent('rel_parent_last_one')
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: deadParents(44) }), ev)).toBe(true)
    const oneAlive: Relation[] = [
      ...deadParents(44).slice(1),
      { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true } as Relation,
    ]
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: oneAlive }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: aliveParents() }), ev)).toBe(false)
  })

  it('once 消耗后不可再触发；去世档案缺 deathAge 不触发身后事（档案不完整不叙事）', () => {
    const funeral = findEvent('rel_parent_funeral')
    expect(
      isEventAvailable(makeGame(1, { age: 45, money: 30000, seenEvents: ['rel_parent_funeral'], relations: deadParents(44) }), funeral),
    ).toBe(false)
    const noAge: Relation[] = [
      { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true },
      { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true },
    ]
    expect(isEventAvailable(makeGame(1, { age: 45, money: 30000, relations: noAge }), funeral)).toBe(false)
  })

  it('资格不满足时的玩家语言文案（conditionFailReason 镜像）', () => {
    const s = makeGame(1, { age: 45, money: 30000, relations: aliveParents() })
    expect(conditionFailReason(s, { parentDiedWithin: 2 })).toBe('这条属于刚刚送别过父母的日子')
    expect(conditionFailReason(s, { parentsAllDeceased: true })).toBe('这条属于双亲都已谢世的人')
  })
})

describe('第 42 轮：病危提速 ×5（数值改动附对照）', () => {
  it('风险查表：病危 ×5、照护 ×1.5 与病危叠加按序放大', () => {
    expect(parentDeathRiskPerMille(60, false, false)).toBe(10)
    expect(parentDeathRiskPerMille(60, false, true)).toBe(50)
    expect(parentDeathRiskPerMille(60, true, true)).toBe(75)
    expect(parentDeathRiskPerMille(59, false, true)).toBe(0) // 零风险窗不提速
  })

  it('孪生对照：病危线首次父母去世显著早于无病危线（300 seed × 38 年）', () => {
    const firstDeath = (seed: number, underCritical: boolean): number => {
      let relations = aliveParents()
      const tags = underCritical ? [CRITICAL_TAG] : []
      for (let age = 40; age <= 77; age++) {
        const r = settleParentDeath(relations, tags, age, seed)
        if (r.deaths.length > 0) return age
        relations = r.relations
      }
      return 78
    }
    let sumCrit = 0
    let sumPlain = 0
    const n = 300
    for (let seed = 1; seed <= n; seed++) {
      sumCrit += firstDeath(seed, true)
      sumPlain += firstDeath(seed, false)
    }
    // 40 岁起父母 68：1%/年 vs 5%/年（且随年龄段放大）——病危线应显著更早
    expect(sumCrit / n).toBeLessThan(sumPlain / n)
  })

  it('病危标记到期清理：无戳补戳（age+3）、到期年移除且当年不吃提速', () => {
    // 无戳：打标次年结算补到期戳
    const s1 = makeGame(7, { age: 50, tags: [CRITICAL_TAG], relations: aliveParents() })
    const next = advanceYear(s1)
    if (next.tags.includes(CRITICAL_TAG)) {
      expect(next.cooldowns[CRITICAL_TAG]).toBe(51 + CRITICAL_YEARS)
    }
    // 到期：戳 = 52 → 52 岁结算时移除
    const s2 = makeGame(7, { age: 50, tags: [CRITICAL_TAG], cooldowns: { [CRITICAL_TAG]: 52 }, relations: aliveParents() })
    let cur = s2
    while (cur.age < 52 && cur.phase === 'playing') cur = advanceYear(cur)
    expect(cur.tags).not.toContain(CRITICAL_TAG)
    expect(cur.cooldowns[CRITICAL_TAG]).toBeUndefined()
  })
})

describe('第 42 轮：陪伴消耗标记与链路闭环', () => {
  it('选临终陪伴任一选项都消耗 parent_critical（removeTags 落地）', () => {
    const ev = findEvent('rel_parent_deathbed')
    for (let ci = 0; ci < ev.choices.length; ci++) {
      const s = makeGame(1, { age: 45, money: 30000, tags: [CRITICAL_TAG], relations: aliveParents() })
      const after = applyChoice(s, ev, ci).state
      expect(after.tags).not.toContain(CRITICAL_TAG)
    }
  })

  it('病危事件打标 → 次年临终陪伴进入候选（病危→陪伴链路闭环）', () => {
    const critical = findEvent('rel_parent_critical')
    const deathbed = findEvent('rel_parent_deathbed')
    let s = makeGame(1, { age: 45, money: 30000, relations: aliveParents() })
    expect(isEventAvailable(s, deathbed)).toBe(false)
    const after = applyChoice(s, critical, 0).state // 连夜买票回去
    expect(after.tags).toContain(CRITICAL_TAG)
    const nextYear = advanceYear(after)
    // 次年：标记在场（除非当年结算已补戳到期——CRITICAL_YEARS=3 不会）、父母在册 → 陪伴可用
    expect(isEventAvailable(nextYear, deathbed)).toBe(true)
  })
})

describe('第 42 轮：三状态模拟（验收②）', () => {
  const AFTER_DEATH_EVENTS = ['rel_parent_funeral', 'rel_parent_memorial', 'rel_parent_relics', 'rel_parent_last_one']

  it('状态 A（31→38 零风险窗）：父母恒在册、父母线事件全部不可用不出现', () => {
    const { state, years } = simulate(makeGame(11, { age: 31, money: 30000 }), 7, 11)
    expect(state.age).toBe(38)
    for (const row of years) {
      expect(row.parentsAlive).toBe(2) // 父母 <60 零风险窗，恒在册
      expect(row.avail).toEqual([])
      expect(row.drawn === null || !PARENT_IDS.includes(row.drawn)).toBe(true)
    }
  })

  it('状态 A2（45→59 在册长线）：病危可抽；父母仍在册的年份身后事四件从不入候选', () => {
    const { years } = simulate(makeGame(23, { age: 45, money: 50000 }), 13, 23)
    const drawnAll = years.map((r) => r.drawn).filter((d): d is string => d !== null)
    expect(drawnAll).toContain('rel_parent_critical') // 病危线 15 年窗 ×50 权重必中
    for (const row of years) {
      if (row.parentsAlive === 2) {
        for (const id of AFTER_DEATH_EVENTS) expect(row.avail).not.toContain(id)
      }
    }
  })

  it('状态 B（病危线 45→52）：临终陪伴在病危窗内可抽；陪伴后标记消耗', () => {
    let s = makeGame(31, { age: 45, money: 50000, tags: [CRITICAL_TAG], relations: aliveParents() })
    expect(isEventAvailable(s, findEvent('rel_parent_deathbed'))).toBe(true)
    const { years, state } = simulate(s, 6, 31)
    const drawnAll = years.map((r) => r.drawn).filter((d): d is string => d !== null)
    expect(drawnAll).toContain('rel_parent_deathbed') // priority 3 + weight ×50，病危窗内必中
    // 父母仍在册的年份：critical 与 deathbed 允许，身后事不允许
    for (const row of years) {
      if (row.parentsAlive === 2) {
        for (const id of AFTER_DEATH_EVENTS) expect(row.avail).not.toContain(id)
      }
    }
    expect(state.phase).toBe('playing')
  })

  it('状态 C（去世线 59 岁）：身后事组可抽可中；病危/陪伴恒不入候选', () => {
    const start = makeGame(41, {
      age: 59,
      money: 30000,
      tags: [GRIEF_TAG],
      relations: deadParents(58), // 去世于 58 岁 → 59 岁时 yearsAgo=1
    })
    const { years } = simulate(start, 6, 41)
    const drawnAll = years.map((r) => r.drawn).filter((d): d is string => d !== null)
    const afterDeathDrawn = drawnAll.filter((d) => AFTER_DEATH_EVENTS.includes(d))
    expect(afterDeathDrawn.length).toBeGreaterThanOrEqual(1) // 身后事组（priority 2-3 ×50）必中
    for (const row of years) {
      expect(row.parentsAlive).toBe(0)
      expect(row.avail).not.toContain('rel_parent_critical')
      expect(row.avail).not.toContain('rel_parent_deathbed')
    }
  })
})
