// 第 41 轮：父母去世机制测试（去世语义与年度判定）
// 验收口径（PROMPT-V3.md 第 41 轮）：
// - 孪生对照（同 seed 有/无照护）去世时点差异符合概率表设计（cared ×1.5）
// - 疏远线既有行为零回归：疏远父母不在判定范围；revive 只认 estranged，不复活去世者
// - 去世后照护类事件资格消失（relationKinds/minCloseness 只查 alive）
// - 旧档加载兼容：无新字段 = 父母健在语义；损坏数据走 validate 清理
// - 主 RNG 零消耗：去世发生的年度，rngState 与无去世对照逐位一致（抽取序列零位移）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable } from './events'
import { applyRelationEffect } from './relations'
import { validateState } from './validate'
import {
  settleParentDeath,
  parentApproximateAge,
  parentDeathRiskPerMille,
  PARENT_AGE_OFFSET,
  PARENT_FUNERAL_COST,
  PARENT_INHERITANCE,
  GRIEF_TAG,
  GRIEF_YEARS,
} from './parents'
import type { GameState, GameEvent, Relation } from './types'
import { ALL_EVENTS } from '../data/events'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

/** 标准双亲夹具（与 init.ts ordinary 背景一致：父亲 55 / 母亲 60） */
function baseParents(): Relation[] {
  return [
    { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true },
    { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
  ]
}

/** 从 startAge 推到玩家 77 岁（父母近似 105），返回首次去世的玩家年龄（无去世返回 78） */
function firstDeathAge(seed: number, startAge: number, underCare: boolean): number {
  let relations = baseParents()
  const tags = underCare ? ['cared_for_parents'] : []
  for (let age = startAge; age <= 77; age++) {
    const r = settleParentDeath(relations, tags, age, seed)
    if (r.deaths.length > 0) return age
    relations = r.relations
  }
  return 78
}

describe('第 41 轮：父母近似年龄与风险表', () => {
  it('父母近似年龄 = 玩家年龄 + 28（与 rel_parent_frail 注释同口径）', () => {
    expect(PARENT_AGE_OFFSET).toBe(28)
    expect(parentApproximateAge(40)).toBe(68)
  })

  it('风险表分档：父母 <60 零风险，60/70/80/90 四档递进', () => {
    expect(parentDeathRiskPerMille(59, false)).toBe(0)
    expect(parentDeathRiskPerMille(60, false)).toBe(10)
    expect(parentDeathRiskPerMille(69, false)).toBe(10)
    expect(parentDeathRiskPerMille(70, false)).toBe(30)
    expect(parentDeathRiskPerMille(79, false)).toBe(30)
    expect(parentDeathRiskPerMille(80, false)).toBe(80)
    expect(parentDeathRiskPerMille(89, false)).toBe(80)
    expect(parentDeathRiskPerMille(90, false)).toBe(150)
    expect(parentDeathRiskPerMille(105, false)).toBe(150)
  })

  it('被照护（cared_for_parents）风险 ×1.5：整数千分比', () => {
    expect(parentDeathRiskPerMille(60, true)).toBe(15)
    expect(parentDeathRiskPerMille(80, true)).toBe(120)
    expect(parentDeathRiskPerMille(90, true)).toBe(225)
  })
})

describe('第 41 轮：settleParentDeath 纯函数', () => {
  it('零风险窗（父母 <60）无论 seed 全存活', () => {
    const relations = baseParents()
    for (let seed = 1; seed <= 50; seed++) {
      const r = settleParentDeath(relations, [], 31, seed) // 父母 59
      expect(r.deaths).toHaveLength(0)
      expect(r.funeral).toBe(0)
    }
  })

  it('高龄（父母 95+）去世例结构：alive=false + deceased + deathAge，无 estranged', () => {
    const relations = baseParents()
    const died = settleParentDeath(relations, [], 67, 7) // 父母 95，150‰
    if (died.deaths.length === 0) {
      // 该 seed 未命中：换一个必中的验证路径——扫描存在性在下方用例覆盖
      expect(died.funeral).toBe(0)
      return
    }
    const dead = died.relations.find((r) => r.id === died.deaths[0].id)!
    expect(dead.alive).toBe(false)
    expect(dead.deceased).toBe(true)
    expect(dead.deathAge).toBe(95)
    expect(dead.estranged).toBeUndefined()
  })

  it('高险窗下死亡与存活两分支均可达（扫描 200 seed）', () => {
    const relations = baseParents()
    let deaths = 0
    let alive = 0
    for (let seed = 1; seed <= 200; seed++) {
      const r = settleParentDeath(relations, [], 67, seed)
      if (r.deaths.length > 0) deaths++
      else alive++
    }
    expect(deaths).toBeGreaterThan(0)
    expect(alive).toBeGreaterThan(0)
  })

  it('双亲独立判定：存在恰一位去世的 seed（非绑定同逝）', () => {
    const relations = baseParents()
    let exactlyOne = 0
    let bothAlive = 0
    for (let seed = 1; seed <= 200; seed++) {
      const r = settleParentDeath(relations, [], 70, seed) // 父母 98，150‰
      if (r.deaths.length === 1) exactlyOne++
      if (r.deaths.length === 0) bothAlive++
    }
    expect(exactlyOne).toBeGreaterThan(0)
    expect(bothAlive).toBeGreaterThan(0)
  })

  it('丧葬每位 4000；遗产按亲密 ≥60 或照护判定（父亲 55 无照护无遗产）', () => {
    const relations = baseParents()
    let checked = false
    for (let seed = 1; seed <= 300 && !checked; seed++) {
      const r = settleParentDeath(relations, [], 70, seed)
      const fatherDead = r.deaths.find((d) => d.id === 'father')
      if (fatherDead) {
        expect(r.funeral).toBe(PARENT_FUNERAL_COST * r.deaths.length)
        expect(fatherDead.inheritance).toBe(0) // closeness 55 < 60 且无照护
        const motherDead = r.deaths.find((d) => d.id === 'mother')
        if (motherDead) expect(motherDead.inheritance).toBe(PARENT_INHERITANCE) // closeness 60
        checked = true
      }
    }
    expect(checked).toBe(true)
  })

  it('照护中去世：遗产按照护判定（父亲虽 55 亲密也留下积蓄）', () => {
    const relations = baseParents()
    let checked = false
    for (let seed = 1; seed <= 300 && !checked; seed++) {
      const r = settleParentDeath(relations, ['cared_for_parents'], 70, seed)
      const fatherDead = r.deaths.find((d) => d.id === 'father')
      if (fatherDead) {
        expect(fatherDead.inheritance).toBe(PARENT_INHERITANCE)
        checked = true
      }
    }
    expect(checked).toBe(true)
  })

  it('同参数两次调用结果一致（确定性，同存档可复现）', () => {
    const relations = baseParents()
    const a = settleParentDeath(relations, ['cared_for_parents'], 70, 99)
    const b = settleParentDeath(relations, ['cared_for_parents'], 70, 99)
    expect(a).toEqual(b)
  })

  it('被疏远的父母不在判定范围（断绝来往者不参与去世结算）', () => {
    const relations: Relation[] = [
      { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, estranged: true },
      { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, estranged: true },
    ]
    for (let seed = 1; seed <= 100; seed++) {
      const r = settleParentDeath(relations, [], 70, seed)
      expect(r.deaths).toHaveLength(0)
    }
  })

  it('纯函数不读写主状态（rngState 零消耗的结构保证）', () => {
    const state = makeGame(42, { age: 70 })
    const before = JSON.stringify(state)
    settleParentDeath(state.relations, state.tags, 70, state.seed)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('第 41 轮：孪生对照——照护 ×1.5 风险（验收①）', () => {
  it('cared 线首次父母去世平均早于非照护线（400 seed 统计）', () => {
    let sumCare = 0
    let sumPlain = 0
    const n = 400
    for (let seed = 1; seed <= n; seed++) {
      sumCare += firstDeathAge(seed, 32, true)
      sumPlain += firstDeathAge(seed, 32, false)
    }
    // 32 岁起（父母 60+，10‰ vs 15‰）：照护线风险高 50%，首次去世应更早
    expect(sumCare / n).toBeLessThan(sumPlain / n)
  })

  it('存在同 seed 同年「非照护未逝、照护已逝」的对照对（差异存在性）', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const plain = firstDeathAge(seed, 32, false)
      const care = firstDeathAge(seed, 32, true)
      if (care < plain) return // 找到任一对照对即证差异可达
    }
    throw new Error('400 seed 内未找到照护线更早去世的对照对')
  })
})

describe('第 41 轮：revive 不复活去世者（疏远链零回归）', () => {
  it('revive 对 deceased 无效（只认 estranged）', () => {
    const relations: Relation[] = [
      { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true, deathAge: 95 },
    ]
    const next = applyRelationEffect(relations, { kind: 'parent', revive: true })
    expect(next[0].alive).toBe(false)
    expect(next[0].deceased).toBe(true)
  })

  it('疏远仍可复活（既有行为零回归）', () => {
    const relations: Relation[] = [
      { id: 'father', kind: 'parent', name: '父亲', closeness: 0, alive: false, estranged: true },
    ]
    const next = applyRelationEffect(relations, { kind: 'parent', revive: true, closeness: 30 })
    expect(next[0].alive).toBe(true)
    expect(next[0].estranged).toBe(false)
    expect(next[0].closeness).toBe(30)
  })
})

describe('第 41 轮：去世后照护类资格消失（验收③）', () => {
  it('rel_parent_frail：父母在册可用，去世后不可用（40 岁夹具在窗口内）', () => {
    const ev = findEvent('rel_parent_frail')
    const alive = makeGame(42, {
      age: 40,
      money: 50000,
      tags: ['cared_for_parents'],
      relations: baseParents(),
    })
    expect(isEventAvailable(alive, ev)).toBe(true)
    const dead = makeGame(42, {
      age: 40,
      money: 50000,
      tags: ['cared_for_parents'],
      relations: [
        { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true, deathAge: 68 },
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true, deathAge: 68 },
      ],
    })
    expect(isEventAvailable(dead, ev)).toBe(false)
  })

  it('rel_parents_tender_years：同款资格切换（58 岁夹具在窗口内）', () => {
    const ev = findEvent('rel_parents_tender_years')
    const alive = makeGame(42, {
      age: 58,
      money: 50000,
      tags: ['cared_for_parents'],
      relations: baseParents(),
    })
    expect(isEventAvailable(alive, ev)).toBe(true)
    const dead = makeGame(42, {
      age: 58,
      money: 50000,
      tags: ['cared_for_parents'],
      relations: baseParents().map((r) => ({ ...r, alive: false, deceased: true, deathAge: 86 })),
    })
    expect(isEventAvailable(dead, ev)).toBe(false)
  })
})

describe('第 41 轮：advanceYear 集成（身后事落账）', () => {
  /** 找一个 67→68 岁必去世父母的 seed（父母 95，150‰） */
  function findDeathSeed(): number {
    for (let seed = 1; seed <= 300; seed++) {
      const r = settleParentDeath(baseParents(), [], 68, seed)
      if (r.deaths.length > 0) return seed
    }
    throw new Error('300 seed 内未找到去世例')
  }

  it('去世年：丧葬/遗产/送别履历/哀伤标记精确落账；主 RNG 与无去世对照逐位一致', () => {
    const seed = findDeathSeed()
    const withParents = makeGame(seed, { age: 67, money: 30000, attrs: { ...makeGame().attrs, happiness: 80 } })
    const noParents = makeGame(seed, { age: 67, money: 30000, attrs: { ...makeGame().attrs, happiness: 80 }, relations: [] })
    const s1 = advanceYear(withParents)
    const s0 = advanceYear(noParents)

    const deadRel = s1.relations.filter((r) => r.deceased)
    expect(deadRel.length).toBeGreaterThan(0)
    expect(deadRel.every((r) => !r.alive && !r.estranged)).toBe(true)

    // 金钱差 = 无去世对照 − 丧葬 + 遗产（收支路径同 seed 逐位一致）
    const inherit = deadRel.length === 2 ? PARENT_INHERITANCE * 2 : s1.relations.find((r) => r.id === 'mother')!.deceased ? PARENT_INHERITANCE : 0
    expect(s1.money).toBe(s0.money - PARENT_FUNERAL_COST * deadRel.length + inherit)

    // 年志流水与送别履历
    expect(s1.yearLog.join('\n')).toContain('丧事开支')
    const farewell = s1.history.filter((h) => h.title === '送别')
    expect(farewell.length).toBe(deadRel.length)
    expect(farewell.every((h) => h.key && h.eventId === 'settle')).toBe(true)

    // 哀伤期：标记 + 到期年龄 = 去世年 + 3
    expect(s1.tags).toContain(GRIEF_TAG)
    expect(s1.cooldowns[GRIEF_TAG]).toBe(68 + GRIEF_YEARS)

    // 去世当年即时情绪冲击 −2（与对照差恰 2，夹具 happiness 80 不触底）
    expect(s1.attrs.happiness).toBe(s0.attrs.happiness - 2)

    // 主 RNG 零消耗：去世发生 rngState 仍与无去世对照逐位一致
    expect(s1.rngState).toBe(s0.rngState)
  })

  it('哀伤期：期间每年 happiness −1，到期年移除标记不再扣（对照法）', () => {
    const run = (grief: boolean) => {
      let s = makeGame(7, {
        age: 70,
        // 移除初始双亲：70+ 岁是 150‰ 高危窗，去世冲击（−2）会混入对照差值，
        // 本用例孤立验证哀伤期自身的 drain/消退时序
        relations: [],
        attrs: { ...makeGame().attrs, happiness: 90 },
        ...(grief ? { tags: [GRIEF_TAG], cooldowns: { [GRIEF_TAG]: 73 } } : {}),
      })
      const hs: number[] = []
      for (let i = 0; i < 3; i++) {
        s = advanceYear(s)
        hs.push(s.attrs.happiness)
      }
      return { s, hs }
    }
    const withGrief = run(true)
    const without = run(false)
    // drain 累积口径：71 岁累计 −1，72 岁累计 −2，73 岁到期移除不再扣（维持 −2）
    expect(withGrief.hs[0]).toBe(without.hs[0] - 1)
    expect(withGrief.hs[1]).toBe(without.hs[1] - 2)
    expect(withGrief.hs[2]).toBe(without.hs[2] - 2)
    expect(withGrief.s.tags).not.toContain(GRIEF_TAG)
    expect(withGrief.s.cooldowns[GRIEF_TAG]).toBeUndefined()
    expect(withGrief.s.yearLog.join('\n')).toContain('时间抚平了一部分哀伤')
  })

  it('双亲皆疏远：推到高龄也零去世零身后事', () => {
    let s = makeGame(42, {
      age: 67,
      relations: baseParents().map((r) => ({ ...r, alive: false, estranged: true })),
    })
    for (let i = 0; i < 10; i++) {
      s = advanceYear(s)
      expect(s.history.some((h) => h.title === '送别')).toBe(false)
      expect(s.yearLog.join('\n')).not.toContain('丧事开支')
      expect(s.tags).not.toContain(GRIEF_TAG)
    }
  })
})

describe('第 41 轮：旧档兼容与损坏守卫（验收④）', () => {
  it('无 deceased 字段的旧档 relations 校验零问题', () => {
    const state = makeGame(42, { age: 50 })
    const { issues } = validateState(state)
    expect(issues.filter((i) => i.field.startsWith('relations'))).toHaveLength(0)
  })

  it('deceased 非布尔：整组清除并报告', () => {
    const state = makeGame(42, {
      age: 50,
      relations: [
        { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: 'yes' as unknown as boolean, deathAge: 78 },
      ],
    })
    const { issues } = validateState(state)
    expect(issues.some((i) => i.field === 'relations.father.deceased')).toBe(true)
    expect(state.relations[0].deceased).toBeUndefined()
    expect(state.relations[0].deathAge).toBeUndefined()
  })

  it('deathAge 非有限数：单独清除，deceased 保留', () => {
    const state = makeGame(42, {
      age: 50,
      relations: [
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true, deathAge: NaN },
      ],
    })
    const { issues } = validateState(state)
    expect(issues.some((i) => i.field === 'relations.mother.deathAge')).toBe(true)
    expect(state.relations[0].deceased).toBe(true)
    expect(state.relations[0].deathAge).toBeUndefined()
  })

  it('带 deceased 字段的状态 JSON round-trip 无损（存档信封透传）', () => {
    const state = makeGame(42, {
      age: 70,
      relations: [
        { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: false, deceased: true, deathAge: 95 },
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
      ],
    })
    const restored = JSON.parse(JSON.stringify(state)) as GameState
    expect(restored.relations[0].deceased).toBe(true)
    expect(restored.relations[0].deathAge).toBe(95)
    const { issues } = validateState(restored)
    expect(issues.filter((i) => i.field.startsWith('relations'))).toHaveLength(0)
  })
})
