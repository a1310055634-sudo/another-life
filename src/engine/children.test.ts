// 第 26 轮：子女生命阶段测试
// 覆盖：孩子年龄与里程碑目标解析（纯函数）、出生盖章与旧档兼容、
// 六个里程碑事件的正反可用性矩阵与每孩至多一次、单孩全阶段走通、
// 双孩同里程碑不同年分别触发（含亲密度定向不打错人）、
// 养育开支按孩子年龄分档与既有财务规则衔接、校验守卫。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { isEventAvailable, visibleChoices, applyChoice, conditionFailReason, checkCondition } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { RELATIONSHIP_EVENTS } from '../data/events/relationship'
import { ALL_EVENTS } from '../data/events'
import { childAge, pickChildByStage, markChildMilestone, CHILD_MILESTONES } from './children'
import { childExpense, childExpenseFor } from './finance'
import type { ChildStageCondition, GameEvent, GameState, Relation } from './types'

const byId = (id: string): GameEvent => {
  const e = RELATIONSHIP_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

/** 孩子：birthAge 缺省 = 未知年龄（旧档兼容语义） */
const child = (birthAge?: number, closeness = 65, id = 'c1', milestones?: string[]): Relation => ({
  id,
  kind: 'child',
  name: '宝宝',
  closeness,
  alive: true,
  ...(birthAge !== undefined ? { birthAge } : {}),
  ...(milestones !== undefined ? { milestones } : {}),
})

/** 六个里程碑事件与孩子年龄窗 */
const MILESTONES = [
  { id: 'fam_child_junior', marker: CHILD_MILESTONES.junior, atLeast: 12, below: 15 },
  { id: 'fam_child_senior', marker: CHILD_MILESTONES.senior, atLeast: 15, below: 18 },
  { id: 'fam_child_gaokao', marker: CHILD_MILESTONES.adult, atLeast: 18, below: 21 },
  { id: 'fam_child_first_job', marker: CHILD_MILESTONES.job, atLeast: 22, below: 25 },
  { id: 'fam_child_wedding', marker: CHILD_MILESTONES.wedding, atLeast: 26, below: 30 },
  { id: 'fam_grandchild', marker: CHILD_MILESTONES.grandchild, atLeast: 26, below: undefined },
] as const

/**
 * 造一个"孩子年龄为 childAge"的可行状态：玩家年龄 = 30 + childAge（保证 birthAge ≥ 18）。
 * 传入的 rel 原样使用——child() 不带 birthAge 时保持"未知年龄"语义。
 */
const atChildAge = (childAgeNow: number, extra: Partial<GameState> = {}, rel: Relation = child(30)): GameState =>
  makeGame(7, { age: 30 + childAgeNow, relations: [rel], ...extra })

const theChild = (s: GameState, id = 'c1'): Relation => {
  const r = s.relations.find((x) => x.id === id)
  if (!r) throw new Error(`找不到孩子 ${id}`)
  return r
}

describe('数据完整性与规则锁定', () => {
  it('第 26 轮新增 6 个子女阶段事件，通过 validateEvents，池 17→23（第 44 轮 +1 → 24，第 46 轮 +4 → 28）', () => {
    expect(RELATIONSHIP_EVENTS).toHaveLength(28)
    expect(validateEvents(RELATIONSHIP_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('六个事件的每个选项都携带 childMilestone 且与条件 milestonePending 一致（办过必留痕）', () => {
    for (const m of MILESTONES) {
      const ev = byId(m.id)
      expect(ev.priority, `${m.id} 应为关键节点优先`).toBe(2)
      const cs = ev.requires?.childStage
      expect(cs).toBeDefined()
      for (const c of ev.choices) {
        const eff = c.effects.find((e) => e.childMilestone !== undefined)
        expect(eff?.childMilestone, `${m.id} 选项「${c.text}」缺里程碑效果`).toBe(cs?.milestonePending)
        expect(eff?.childMilestone).toBe(m.marker)
      }
    }
  })

  it('孩子亲密度效果全部带 milestoneTarget（多孩不打错人），办在谁身上落在谁身上', () => {
    for (const m of MILESTONES) {
      const ev = byId(m.id)
      for (const c of ev.choices) {
        const rel = c.effects.find((e) => e.relation?.kind === 'child')?.relation
        expect(rel?.milestoneTarget, `${m.id} 选项「${c.text}」`).toBe(true)
      }
    }
  })

  it('validateEvents：childMilestone 缺 childStage 条件、或与 milestonePending 不一致都会报错', () => {
    const base = byId('fam_child_junior')
    const noCond: GameEvent = {
      ...base,
      id: 'test_no_cond',
      requires: undefined,
    }
    expect(validateEvents([noCond]).some((i) => i.field.includes('childMilestone'))).toBe(true)
    const mismatch: GameEvent = {
      ...base,
      id: 'test_mismatch',
      requires: { childStage: { atLeast: 12, below: 15, milestonePending: 'ms_other' } },
    }
    expect(validateEvents([mismatch]).some((i) => i.problem.includes('不一致'))).toBe(true)
  })
})

describe('孩子年龄与目标解析（纯函数）', () => {
  it('childAge：已知出生年龄精确推算；未知/非孩子/已疏远/未出生返回 null', () => {
    expect(childAge(child(27), 39)).toBe(12)
    expect(childAge(child(27), 27)).toBe(0)
    expect(childAge(child(), 39)).toBeNull()
    expect(childAge({ ...child(27), alive: false, estranged: true }, 39)).toBeNull()
    expect(childAge({ ...child(27), kind: 'friend' }, 39)).toBeNull()
    expect(childAge(child(45), 39)).toBeNull()
  })

  it('年龄窗 [atLeast, below)：下含上不含，边缘不漂移', () => {
    const cond: ChildStageCondition = { atLeast: 12, below: 15, milestonePending: 'ms_junior' }
    for (const age of [11, 15, 16]) {
      expect(pickChildByStage([child(30)], 30 + age, cond), `孩子 ${age} 岁不应命中`).toBeNull()
    }
    for (const age of [12, 13, 14]) {
      expect(pickChildByStage([child(30)], 30 + age, cond)?.id, `孩子 ${age} 岁应命中`).toBe('c1')
    }
  })

  it('milestonePending：已办过的孩子被跳过；milestoneDone：未成家的孩子不触发孙辈', () => {
    const junior: ChildStageCondition = { atLeast: 12, below: 15, milestonePending: 'ms_junior' }
    expect(pickChildByStage([child(30, 65, 'c1', ['ms_junior'])], 42, junior)).toBeNull()
    expect(pickChildByStage([child(30, 65, 'c1', ['ms_junior'])], 42, { atLeast: 12, milestonePending: 'ms_senior' })?.id).toBe('c1')

    const grand: ChildStageCondition = { atLeast: 29, milestonePending: 'ms_grandchild', milestoneDone: 'ms_wedding' }
    expect(pickChildByStage([child(30, 65, 'c1', ['ms_wedding'])], 59, grand)?.id).toBe('c1')
    expect(pickChildByStage([child(30, 65, 'c1', [])], 59, grand)).toBeNull()
  })

  it('多孩同年达标：解析到最年长的待办孩子（出生次序）', () => {
    const cond: ChildStageCondition = { atLeast: 12, below: 15, milestonePending: 'ms_junior' }
    const s = makeGame(7, { age: 42, relations: [child(30, 65, 'c1'), child(30, 60, 'c2')] })
    expect(pickChildByStage(s.relations, 42, cond)?.id).toBe('c1')
    // 大的办过之后轮到小的
    const done = markChildMilestone(s.relations, 'c1', 'ms_junior')
    expect(pickChildByStage(done, 42, cond)?.id).toBe('c2')
  })

  it('markChildMilestone：只动目标孩子、不重复写入、返回新数组不改入参', () => {
    const rels = [child(30, 65, 'c1'), child(28, 60, 'c2')]
    const next = markChildMilestone(rels, 'c1', 'ms_junior')
    expect(next[0].milestones).toEqual(['ms_junior'])
    expect(next[1].milestones).toBeUndefined()
    expect(rels[0].milestones).toBeUndefined()
    expect(markChildMilestone(next, 'c1', 'ms_junior')[0].milestones).toEqual(['ms_junior'])
  })
})

describe('出生盖章与旧档兼容', () => {
  it('rel_child_question 的延迟出生落地当年盖章 birthAge', () => {
    const ev = byId('rel_child_question')
    const s = makeGame(7, {
      age: 27,
      relations: [{ id: 'p1', kind: 'spouse', name: '伴侣', closeness: 70, alive: true }],
      money: 30000,
    })
    const chosen = applyChoice(s, ev, 0).state
    expect(chosen.tags).toContain('has_child')
    expect(chosen.relations.some((r) => r.kind === 'child')).toBe(false)
    const born = advanceYear(chosen)
    const c = born.relations.find((r) => r.kind === 'child')
    expect(c).toBeDefined()
    expect(c?.birthAge).toBe(28)
    expect(childAge(c!, born.age)).toBe(0)
  })

  it('旧档孩子（无 birthAge）：里程碑事件全部不触发，养育开支按旧口径 10,000', () => {
    const s = atChildAge(12, { tags: ['has_child'] }, child())
    for (const m of MILESTONES) {
      expect(isEventAvailable(s, byId(m.id)), `${m.id} 对未知年龄孩子不应触发`).toBe(false)
    }
    expect(childExpense(s)).toBe(10000)
  })

  it('has_child 标记不能替代真实孩子关系：无孩线完全不触发', () => {
    const tagOnly = makeGame(7, { age: 42, tags: ['has_child'] })
    const parentOnly = makeGame(7, {
      age: 42,
      relations: [{ id: 'p1', kind: 'parent', name: '母亲', closeness: 60, alive: true }],
    })
    for (const s of [tagOnly, parentOnly]) {
      for (const m of MILESTONES) {
        expect(isEventAvailable(s, byId(m.id))).toBe(false)
      }
    }
  })
})

describe('六个里程碑事件的正反可用性', () => {
  it('按孩子年龄精确开窗：11~29 岁逐岁对照', () => {
    const table: Array<{ age: number; want: string | null }> = [
      { age: 11, want: null },
      { age: 12, want: 'fam_child_junior' },
      { age: 14, want: 'fam_child_junior' },
      { age: 15, want: 'fam_child_senior' },
      { age: 17, want: 'fam_child_senior' },
      { age: 18, want: 'fam_child_gaokao' },
      { age: 20, want: 'fam_child_gaokao' },
      { age: 21, want: null },
      { age: 22, want: 'fam_child_first_job' },
      { age: 24, want: 'fam_child_first_job' },
      { age: 25, want: null },
      { age: 26, want: 'fam_child_wedding' },
      { age: 27, want: 'fam_child_wedding' },
      { age: 28, want: 'fam_child_wedding' },
      { age: 29, want: 'fam_child_wedding' },
      { age: 30, want: null },
    ]
    for (const { age, want } of table) {
      const s = atChildAge(age)
      for (const m of MILESTONES) {
        const avail = isEventAvailable(s, byId(m.id))
        expect(avail, `孩子 ${age} 岁：${m.id} 应为 ${m.id === want}`).toBe(m.id === want)
      }
    }
  })

  it('孙辈须先成家：29 岁未成家不触发，成家后触发（40 岁也在窗内）', () => {
    const ev = byId('fam_grandchild')
    expect(isEventAvailable(atChildAge(29, {}, child(30, 65, 'c1', ['ms_wedding'])), ev)).toBe(true)
    expect(isEventAvailable(atChildAge(40, {}, child(30, 65, 'c1', ['ms_wedding'])), ev)).toBe(true)
    expect(isEventAvailable(atChildAge(29), ev)).toBe(false)
  })

  it('办过的里程碑不再出现（每孩至多一次）；拒绝理由区分"已办过"与"没到年纪"', () => {
    const ev = byId('fam_child_junior')
    const done = atChildAge(12, {}, child(30, 65, 'c1', ['ms_junior']))
    expect(isEventAvailable(done, ev)).toBe(false)
    expect(conditionFailReason(done, ev.requires)).toBe('这件事已经给孩子办过了')
    const young = atChildAge(10)
    expect(conditionFailReason(young, ev.requires)).toBe('家里没有正处在这个年纪的孩子')
    expect(checkCondition(young, ev.requires)).toBe(false)
    expect(conditionFailReason(makeGame(7, { age: 42 }), ev.requires)).toBe('家里没有正处在这个年纪的孩子')
  })

  it('负债时大额选项隐藏，六个事件仍保有 ≥2 个可见抉择', () => {
    for (const m of MILESTONES) {
      const s = atChildAge(m.atLeast, { money: -5000 }, child(30, 65, 'c1', m.id === 'fam_grandchild' ? ['ms_wedding'] : undefined))
      const vis = visibleChoices(s, byId(m.id))
      expect(vis.length, `${m.id} 负债时可见选项`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('单孩全阶段走通（验收①）', () => {
  it('18 岁生的孩子：39→56 岁六站全部触发一次且只触发一次，里程碑按序累积', () => {
    const plan = [
      { age: 39, id: 'fam_child_junior', marker: CHILD_MILESTONES.junior },
      { age: 42, id: 'fam_child_senior', marker: CHILD_MILESTONES.senior },
      { age: 45, id: 'fam_child_gaokao', marker: CHILD_MILESTONES.adult },
      { age: 49, id: 'fam_child_first_job', marker: CHILD_MILESTONES.job },
      { age: 53, id: 'fam_child_wedding', marker: CHILD_MILESTONES.wedding },
      { age: 56, id: 'fam_grandchild', marker: CHILD_MILESTONES.grandchild },
    ]
    let s = makeGame(7, { age: 39, relations: [child(27)] })
    for (const step of plan) {
      const ev = byId(step.id)
      const cur: GameState = { ...s, age: step.age }
      expect(isEventAvailable(cur, ev), `${step.id} 应在玩家 ${step.age} 岁可用`).toBe(true)
      const vis = visibleChoices(cur, ev)
      expect(vis.length).toBeGreaterThanOrEqual(2)
      s = applyChoice(cur, ev, ev.choices.indexOf(vis[0])).state
      const c = theChild(s)
      expect(c.milestones, `${step.id} 后里程碑应留痕`).toContain(step.marker)
      expect(isEventAvailable({ ...s, age: step.age + 1 }, ev), `${step.id} 办过不应再出现`).toBe(false)
    }
    expect(theChild(s).milestones).toEqual([
      'ms_junior', 'ms_senior', 'ms_adult', 'ms_job', 'ms_wedding', 'ms_grandchild',
    ])
    expect(validateState(s).issues).toEqual([])
  })
})

describe('双孩同里程碑不同年分别触发（验收②）', () => {
  it('兄弟差两岁：小升初各自在自己 12 岁那年触发，互不重复', () => {
    const ev = byId('fam_child_junior')
    // 玩家 39 岁：老大（birthAge 27）12 岁，老二（birthAge 29）10 岁；给足存款保证两次都选到大额选项
    let s = makeGame(7, { age: 39, money: 50000, relations: [child(27, 65, 'c1'), child(29, 60, 'c2')] })
    expect(isEventAvailable(s, ev)).toBe(true)
    s = applyChoice(s, ev, 0).state
    expect(theChild(s, 'c1').milestones).toEqual(['ms_junior'])
    expect(theChild(s, 'c2').milestones).toBeUndefined()

    // 玩家 40 岁：老大 13（已办），老二 11 未到 → 不可用
    expect(isEventAvailable({ ...s, age: 40 }, ev)).toBe(false)
    // 玩家 41 岁：老二 12 岁 → 轮到老二
    const s41: GameState = { ...s, age: 41 }
    expect(isEventAvailable(s41, ev)).toBe(true)
    const before = theChild(s41, 'c2').closeness
    s = applyChoice(s41, ev, 0).state
    expect(theChild(s, 'c2').milestones).toEqual(['ms_junior'])
    expect(theChild(s, 'c1').milestones).toEqual(['ms_junior'])
    // 亲密度定向：选项 0 的 −2 落在办里程碑的老二身上，不打到老大
    expect(theChild(s, 'c2').closeness).toBe(before - 2)
  })

  it('双孩养育开支逐个累加（12 岁与 10 岁各 10,000，共 20,000）', () => {
    const s = makeGame(7, { age: 39, relations: [child(27), child(29)] })
    expect(childExpense(s)).toBe(20000)
  })
})

describe('养育开支按孩子年龄分档（验收③：与既有财务规则衔接）', () => {
  it('分档锚点：未知 10,000 / 婴幼儿 14,000 / K12 10,000 / 大学 8,000 / 22 岁起 0', () => {
    expect(childExpenseFor(child(), 39)).toBe(10000)
    expect(childExpenseFor(child(36), 39)).toBe(14000) // 3 岁
    expect(childExpenseFor(child(34), 39)).toBe(14000) // 5 岁
    expect(childExpenseFor(child(33), 39)).toBe(10000) // 6 岁
    expect(childExpenseFor(child(22), 39)).toBe(10000) // 17 岁
    expect(childExpenseFor(child(21), 39)).toBe(8000)  // 18 岁
    expect(childExpenseFor(child(18), 39)).toBe(8000)  // 21 岁
    expect(childExpenseFor(child(17), 39)).toBe(0)     // 22 岁
    expect(childExpenseFor(child(9), 39)).toBe(0)      // 30 岁
  })

  it('advanceYear 孪生对照：K12 孩子恰好 +10,000，婴幼儿 +14,000，年志可解释', () => {
    const base = {
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 4 } as const,
      money: 30000,
      attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 40 },
    }
    const noChild = advanceYear(makeGame(7, { age: 34, ...base, relations: [] }))
    const k12 = advanceYear(makeGame(7, { age: 34, ...base, relations: [child(25)] }))
    expect(noChild.money - k12.money).toBe(10000)
    expect(k12.yearLog.some((l) => l.includes('孩子的吃穿用度'))).toBe(true)

    const infant = advanceYear(makeGame(7, { age: 34, ...base, relations: [child(33)] }))
    expect(noChild.money - infant.money).toBe(14000)
  })

  it('22 岁自立当年开支归零、年志点明"担子轻了一截"；21 岁仍有大学贴补', () => {
    const base = {
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 4 } as const,
      money: 30000,
    }
    // 玩家 43→44 岁，孩子 21→22 岁：跨过自立线
    const before = makeGame(7, { age: 43, ...base, relations: [child(22)] })
    expect(childExpense(before)).toBe(8000)
    const after = advanceYear(before)
    expect(childExpense(after)).toBe(0)
    expect(after.yearLog.some((l) => l.includes('担子轻了一截'))).toBe(true)
    expect(after.yearLog.some((l) => l.includes('孩子的吃穿用度'))).toBe(false)
  })

  it('旧档未知年龄孩子在推进中维持 10,000（行为与第 15～25 轮一致）', () => {
    const s = advanceYear(makeGame(7, {
      age: 34,
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 4 },
      money: 30000,
      relations: [child()],
    }))
    expect(childExpense(s)).toBe(10000)
  })
})

describe('校验守卫（手改存档不炸引擎）', () => {
  it('非法 birthAge（NaN/未满 18/未来）被忽略并报告；合法值原样保留', () => {
    const mk = (birthAge?: number) => {
      const rel = child(birthAge)
      const s = makeGame(7, { age: 39, relations: [rel] })
      const { issues } = validateState(s)
      return { issues, rel }
    }
    const bad1 = mk(NaN)
    expect(bad1.issues.some((i) => i.field.includes('birthAge'))).toBe(true)
    expect(bad1.rel.birthAge).toBeUndefined()
    const bad2 = mk(15)
    expect(bad2.issues).toHaveLength(1)
    expect(bad2.rel.birthAge).toBeUndefined()
    const bad3 = mk(45)
    expect(bad3.issues).toHaveLength(1)
    expect(bad3.rel.birthAge).toBeUndefined()
    const ok = mk(27)
    expect(ok.issues).toEqual([])
    expect(ok.rel.birthAge).toBe(27)
  })

  it('损坏 milestones（非数组/非字符串条目）被清除；重复条目去重并报告', () => {
    const badRel = { ...child(27), milestones: [123, ''] as unknown as string[] }
    const bad = validateState(makeGame(7, { age: 39, relations: [badRel] }))
    expect(bad.issues).toHaveLength(1)
    expect(badRel.milestones).toBeUndefined()

    const dupRel = { ...child(27), milestones: ['ms_junior', 'ms_junior'] }
    const dup = validateState(makeGame(7, { age: 39, relations: [dupRel] }))
    expect(dup.issues).toHaveLength(1)
    expect(dupRel.milestones).toEqual(['ms_junior'])

    const okRel = { ...child(27), milestones: ['ms_junior', 'ms_senior'] }
    const ok = validateState(makeGame(7, { age: 39, relations: [okRel] }))
    expect(ok.issues).toEqual([])
    expect(okRel.milestones).toEqual(['ms_junior', 'ms_senior'])
  })

  it('有孩 30 年推进 validateState 干净（里程碑只在事件里产生，结算不越权）', () => {
    let s = makeGame(7, { age: 27, relations: [child()] })
    for (let i = 0; i < 30; i++) s = advanceYear(s)
    expect(s.phase).toBe('playing')
    expect(validateState(s).issues).toEqual([])
    // 纯结算不产生里程碑，事件仍按资格触发
    expect(theChild(s).milestones).toBeUndefined()
  })
})
