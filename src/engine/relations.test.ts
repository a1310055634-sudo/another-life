// 第 11 轮：关系系统测试
// 覆盖：多实例关系管理（add/delta/remove/convertFrom/revive）、亲密度 clamp、
// 新条件（maxCloseness / relationKindsNone）、延迟关系效果、亲密度归零自动疏远
// （fin_debt_calls 反复消耗亲情的兜底）、ChoiceDelta 关系增量、事件校验、
// 婚姻路线 vs 单身路线玩到中年全面分化、同 seed 复现。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, checkCondition, visibleChoices, isEventAvailable } from './events'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { RELATIONSHIP_EVENTS } from '../data/events/relationship'
import {
  applyRelationEffect,
  aliveOf,
  relationDeltaChips,
  relationsLine,
  settleEstrangement,
  estrangementTag,
} from './relations'
import { startSession } from './session'
import type { GameEvent, GameState, Relation, RelationEffect } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

/** 按文本找到可见选项的【原始索引】（applyChoice 按完整 choices 数组定位；找不到则测试失败） */
function choiceIndex(state: GameState, event: GameEvent, text: string): number {
  const vis = visibleChoices(state, event)
  const i = event.choices.findIndex((c) => c.text === text && vis.includes(c))
  if (i === -1) throw new Error(`选项不可见: ${text}（可见 ${vis.length} 个）`)
  return i
}

function choose(state: GameState, eventId: string, text: string): GameState {
  return applyChoice(state, findEvent(eventId), choiceIndex(state, findEvent(eventId), text)).state
}

function partnerState(closeness: number, patch: Partial<GameState> = {}): GameState {
  return makeGame(7, {
    age: 28,
    money: 50000,
    relations: [
      { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true },
      { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
      { id: 'partner_1', kind: 'partner', name: '小赵', closeness, alive: true },
    ],
    ...patch,
  })
}

const REL: Relation = { id: 'f1', kind: 'friend', name: '阿伟', closeness: 50, alive: true }

describe('关系效果基础（applyRelationEffect）', () => {
  it('add：默认亲密度 50，可自定义初始亲密度，id 唯一确定', () => {
    const a = applyRelationEffect([], { kind: 'friend', add: true }, 23)
    expect(a).toHaveLength(1)
    expect(a[0].closeness).toBe(50)
    expect(a[0].id).toBe('friend_23_0')
    const b = applyRelationEffect([], { kind: 'friend', add: true, name: '驴友老周', closeness: 45 }, 23)
    expect(b[0].name).toBe('驴友老周')
    expect(b[0].closeness).toBe(45)
  })

  it('add：已有存活同类关系时不新增（多实例靠多个 add 调用累积）', () => {
    const next = applyRelationEffect([REL], { kind: 'friend', add: true }, 1)
    expect(next).toHaveLength(1)
  })

  it('deltaCloseness 夹在 0～100', () => {
    const low = applyRelationEffect([REL], { kind: 'friend', deltaCloseness: -999 })
    expect(low[0].closeness).toBe(0)
    const high = applyRelationEffect([REL], { kind: 'friend', deltaCloseness: 999 })
    expect(high[0].closeness).toBe(100)
    expect(low).not.toBe([REL])
    expect(low[0].alive).toBe(true)
  })

  it('remove 只移除第一条存活同类关系', () => {
    const two: Relation[] = [
      { id: 'f1', kind: 'friend', name: '阿伟', closeness: 50, alive: true },
      { id: 'f2', kind: 'friend', name: '老周', closeness: 60, alive: true },
    ]
    const next = applyRelationEffect(two, { kind: 'friend', remove: true })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('f2')
  })

  it('convertFrom：partner 转 spouse 保留 id 与名字', () => {
    const next = applyRelationEffect(
      [REL, { id: 'p1', kind: 'partner', name: '小赵', closeness: 70, alive: true }],
      { kind: 'spouse', convertFrom: 'partner' },
    )
    const spouse = next.find((r) => r.kind === 'spouse')!
    expect(spouse.id).toBe('p1')
    expect(spouse.name).toBe('小赵')
    expect(spouse.closeness).toBe(70)
    expect(next.some((r) => r.kind === 'partner')).toBe(false)
  })

  it('revive：复活已疏远关系（保留 id/名字），无疏远关系时无效', () => {
    const estranged: Relation[] = [{ ...REL, alive: false, estranged: true, closeness: 0 }]
    const next = applyRelationEffect(estranged, { kind: 'friend', revive: true, closeness: 30 })
    expect(next[0].alive).toBe(true)
    expect(next[0].estranged).toBe(false)
    expect(next[0].closeness).toBe(30)
    expect(next[0].id).toBe('f1')
    // 没有疏远关系：revive 是 no-op
    const none = applyRelationEffect([REL], { kind: 'friend', revive: true, closeness: 30 })
    expect(none).toEqual([REL])
  })
})

describe('新关系条件', () => {
  it('maxCloseness：亲密度高于上限则不满足，无存活关系也不满足', () => {
    const cold = partnerState(20)
    expect(checkCondition(cold, { relationKinds: ['partner'], maxCloseness: { partner: 25 } })).toBe(true)
    expect(checkCondition(cold, { relationKinds: ['partner'], maxCloseness: { partner: 15 } })).toBe(false)
    expect(checkCondition(partnerState(40), { maxCloseness: { partner: 25 } })).toBe(false)
    expect(checkCondition(makeGame(7), { maxCloseness: { friend: 25 } })).toBe(false)
  })

  it('relationKindsNone：有存活关系则不满足；疏远（alive=false）不算存活', () => {
    expect(checkCondition(partnerState(70), { relationKindsNone: ['partner', 'spouse'] })).toBe(false)
    expect(checkCondition(makeGame(7), { relationKindsNone: ['partner', 'spouse'] })).toBe(true)
    const estrangedPartner = partnerState(0, {})
    estrangedPartner.relations = estrangedPartner.relations.map((r) =>
      r.kind === 'partner' ? { ...r, closeness: 0 } : r,
    )
    const settled = settleEstrangement(estrangedPartner.relations).relations
    expect(checkCondition({ ...estrangedPartner, relations: settled }, { relationKindsNone: ['partner'] })).toBe(true)
  })

  it('minCloseness 只看存活关系（疏远后不再满足）', () => {
    const s = partnerState(0)
    const settled = settleEstrangement(s.relations).relations
    expect(checkCondition(s, { minCloseness: { partner: 10 } })).toBe(false)
    expect(checkCondition({ ...s, relations: settled }, { minCloseness: { partner: 10 } })).toBe(false)
    expect(checkCondition(partnerState(40), { minCloseness: { partner: 10 } })).toBe(true)
  })
})

describe('关系事件接线', () => {
  it('求婚：partner→spouse 转变 + married 标记 + 婚礼花费', () => {
    const s = partnerState(70)
    expect(isEventAvailable(s, findEvent('rel_propose'))).toBe(true)
    const next = choose(s, 'rel_propose', '办一场体面的婚礼，把亲戚朋友都请来')
    expect(aliveOf(next.relations, 'spouse')?.name).toBe('小赵')
    expect(aliveOf(next.relations, 'partner')).toBeNull()
    expect(next.tags).toContain('married')
    expect(next.money).toBe(20000)
  })

  it('求婚：钱不够时大婚礼选项隐藏、旅行结婚与等待仍可见', () => {
    const poor = partnerState(70, { money: 10000 })
    const ev = findEvent('rel_propose')
    const texts = visibleChoices(poor, ev).map((c) => c.text)
    expect(texts).not.toContain('办一场体面的婚礼，把亲戚朋友都请来')
    expect(texts).toContain('旅行结婚，两个人说走就走')
    expect(texts).toContain('再等等，先把自己的事安顿好')
  })

  it('岔路口：分手移除 partner 并打 broke_up 标记', () => {
    const cold = partnerState(20)
    expect(isEventAvailable(cold, findEvent('rel_crossroads'))).toBe(true)
    const next = choose(cold, 'rel_crossroads', '长痛不如短痛，分开吧')
    expect(aliveOf(next.relations, 'partner')).toBeNull()
    expect(next.tags).toContain('broke_up')
    const chips = relationDeltaChips(cold.relations, next.relations)
    expect(chips.some((c) => c.includes('小赵') && c.includes('走出了你的生活'))).toBe(true)
  })

  it('岔路口：感情尚热时不可触发（maxCloseness 25）', () => {
    expect(isEventAvailable(partnerState(40), findEvent('rel_crossroads'))).toBe(false)
  })

  it('冷战：找朋友评理选项只在有朋友时可见', () => {
    const withFriend = partnerState(50, { relations: [...partnerState(50).relations, REL] })
    const without = partnerState(50)
    const ev = findEvent('rel_quarrel_coldwar')
    expect(visibleChoices(withFriend, ev).some((c) => c.text.includes('共同好友'))).toBe(true)
    expect(visibleChoices(without, ev).some((c) => c.text.includes('共同好友'))).toBe(false)
  })

  it('相亲：单身专属；认真去见→次年延迟确定关系（延迟关系效果）', () => {
    expect(isEventAvailable(partnerState(70), findEvent('rel_blind_date'))).toBe(false)
    const single = makeGame(7, { age: 26 })
    expect(isEventAvailable(single, findEvent('rel_blind_date'))).toBe(true)
    const next = choose(single, 'rel_blind_date', '认真去见一见')
    expect(next.tags).toContain('went_blind_date')
    expect(next.pending).toHaveLength(1)
    const after = advanceYear(next)
    const p = aliveOf(after.relations, 'partner')
    expect(p?.name).toBe('小赵')
    // 落地值 45→55 为第 39 轮平衡有意调整（婚姻链可达性，见 round39.test）
    expect(p?.closeness).toBe(55)
    expect(after.yearLog.some((l) => l.includes('确定了关系'))).toBe(true)
  })

  it('一个人的完整：单身专属；徒步团新增朋友关系', () => {
    expect(isEventAvailable(partnerState(70), findEvent('rel_single_fullness'))).toBe(false)
    const single = makeGame(7, { age: 30 })
    const next = choose(single, 'rel_single_fullness', '加入周末徒步团')
    const f = aliveOf(next.relations, 'friend')
    expect(f?.name).toBe('驴友老周')
    expect(f?.closeness).toBe(45)
  })

  it('破裂重建：estranged_friend 标记解锁旧号码事件，拨通后朋友复活、标记清除', () => {
    const s = makeGame(7, {
      age: 30,
      tags: ['estranged_friend'],
      relations: [
        { id: 'father', kind: 'parent', name: '父亲', closeness: 55, alive: true },
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
        { id: 'friend_18_2', kind: 'friend', name: '阿伟', closeness: 0, alive: false, estranged: true },
      ],
    })
    expect(isEventAvailable(s, findEvent('rel_reconnect_friend'))).toBe(true)
    const next = choose(s, 'rel_reconnect_friend', '拨通那个号码')
    const f = next.relations.find((r) => r.id === 'friend_18_2')!
    expect(f.alive).toBe(true)
    expect(f.estranged).toBe(false)
    expect(f.closeness).toBe(30)
    expect(next.tags).not.toContain('estranged_friend')
    expect(isEventAvailable(s, findEvent('rel_reconnect_friend'))).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30 }), findEvent('rel_reconnect_friend'))).toBe(false)
  })

  it('两个人的下一步：仅限已婚；要孩子→次年孩子出生', () => {
    const dating = partnerState(80)
    expect(isEventAvailable(dating, findEvent('rel_child_question'))).toBe(false)
    const married = partnerState(80)
    married.relations = married.relations.map((r) => (r.kind === 'partner' ? { ...r, kind: 'spouse' } : r))
    expect(isEventAvailable(married, findEvent('rel_child_question'))).toBe(true)
    const next = choose(married, 'rel_child_question', '要个孩子吧')
    expect(next.tags).toContain('has_child')
    const after = advanceYear(next)
    const child = aliveOf(after.relations, 'child')
    expect(child?.name).toBe('宝宝')
    expect(child?.closeness).toBe(65)
  })

  it('已育夫妻不再触发「两个人的下一步」（引擎孩子 add 只支持一个，重复选只会扣钱+谎报孩子出生）', () => {
    const married = partnerState(80)
    married.relations = married.relations.map((r) => (r.kind === 'partner' ? { ...r, kind: 'spouse' } : r))
    married.tags = [...married.tags, 'married']
    // 丁克/还在犹豫（无 has_child 标记）时事件可达，夫妻可以改主意
    expect(isEventAvailable(married, findEvent('rel_child_question'))).toBe(true)
    // 已经有孩子后事件不可达（浏览器实测抓到：32 岁要娃、37 岁再次扣 5000 却无二胎）
    married.tags = [...married.tags, 'has_child']
    expect(isEventAvailable(married, findEvent('rel_child_question'))).toBe(false)
  })

  it('和家里没话说：仅低亲密度触发；高亲密度不可见', () => {
    const low = makeGame(7, { age: 30 })
    low.relations = low.relations.map((r) => ({ ...r, closeness: 10 }))
    const high = makeGame(7, { age: 30 })
    expect(isEventAvailable(low, findEvent('rel_parent_low'))).toBe(true)
    expect(isEventAvailable(high, findEvent('rel_parent_low'))).toBe(false)
  })

  it('收养流浪猫：宠物关系带名字（顶栏不显示类别默认名「宠物」）', () => {
    const s = makeGame(7, { age: 20 })
    const next = choose(s, 'youth_pet_stray', '带回家，收养它')
    expect(aliveOf(next.relations, 'pet')?.name).toBe('小猫')
  })

  it('过年没回的家：需要 estranged_parent 标记；拨通电话复活父母关系', () => {
    const s = makeGame(7, {
      age: 30,
      tags: ['estranged_parent'],
      relations: [
        { id: 'father', kind: 'parent', name: '父亲', closeness: 0, alive: false, estranged: true },
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true },
      ],
    })
    expect(isEventAvailable(s, findEvent('rel_estranged_parent'))).toBe(true)
    const next = choose(s, 'rel_estranged_parent', '先拨一个电话')
    const father = next.relations.find((r) => r.id === 'father')!
    expect(father.alive).toBe(true)
    expect(father.estranged).toBe(false)
    expect(father.closeness).toBe(20)
    expect(next.tags).not.toContain('estranged_parent')
  })
})

describe('疏远兜底（亲密度归零自动破裂）', () => {
  it('settleEstrangement：0 触发、正亲密度不动', () => {
    const rels: Relation[] = [
      { id: 'f1', kind: 'friend', name: '阿伟', closeness: 0, alive: true },
      { id: 'f2', kind: 'friend', name: '老周', closeness: 5, alive: true },
    ]
    const out = settleEstrangement(rels)
    expect(out.broke).toEqual([{ kind: 'friend', name: '阿伟' }])
    expect(out.relations[0].alive).toBe(false)
    expect(out.relations[0].estranged).toBe(true)
    expect(out.relations[1].alive).toBe(true)
  })

  it('advanceYear：父母亲密度耗尽→疏远+标记+年志+履历', () => {
    const s = makeGame(7, { age: 30 })
    s.relations = s.relations.map((r) => ({ ...r, closeness: 0 }))
    const after = advanceYear(s)
    for (const r of after.relations) {
      expect(r.alive).toBe(false)
      expect(r.estranged).toBe(true)
    }
    expect(after.tags).toContain(estrangementTag('parent'))
    expect(after.yearLog.some((l) => l.includes('断了来往'))).toBe(true)
    expect(after.history.some((h) => h.title === '疏远')).toBe(true)
  })

  it('fin_debt_calls：家人疏远后「跟家里开口」自动隐藏，事件仍有出路', () => {
    const debt = makeGame(7, { age: 30, money: -30000 })
    const ev = findEvent('fin_debt_calls')
    expect(visibleChoices(debt, ev).some((c) => c.text.includes('跟家里开口'))).toBe(true)
    const estranged = advanceYear({ ...debt, relations: debt.relations.map((r) => ({ ...r, closeness: 0 })) })
    const texts = visibleChoices(estranged, ev).map((c) => c.text)
    expect(texts).not.toContain('跟家里开口，先把窟窿堵上一块')
    expect(texts.length).toBeGreaterThanOrEqual(1)
    expect(isEventAvailable(estranged, ev)).toBe(true)
  })
})

describe('ChoiceDelta 关系增量', () => {
  it('亲密度变化出现在增量里', () => {
    const s = partnerState(50)
    const session = startSession(
      { seed: 7, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' },
      [findEvent('rel_partner_low')],
    )
    const withPartner: GameState = { ...session.state, ...s, history: [] }
    const before = withPartner
    const applied = applyChoice(before, findEvent('rel_partner_low'), 0)
    const chips = relationDeltaChips(before.relations, applied.state.relations)
    expect(chips.some((c) => c.includes('亲密 +'))).toBe(true)
  })

  it('求婚产生「结婚了」增量', () => {
    const s = partnerState(70)
    const applied = applyChoice(s, findEvent('rel_propose'), 0)
    const chips = relationDeltaChips(s.relations, applied.state.relations)
    expect(chips).toContain('和小赵结婚了')
  })

  it('新增关系产生「新增恋人」增量（session 链路）', () => {
    const base = createNewGame({ seed: 7, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
    const event = findEvent('rel_blind_date')
    // 直接走 applyChoice + 延迟落地，验证 yearLog 与关系增量链路
    const picked = applyChoice(base, event, 0)
    const after = advanceYear(picked.state)
    expect(aliveOf(after.relations, 'partner')).not.toBeNull()
    const chips = relationDeltaChips(after.relations, applyRelationEffect(after.relations, {
      kind: 'friend',
      add: true,
    } as RelationEffect, after.age))
    expect(chips.some((c) => c.startsWith('新增朋友'))).toBe(true)
  })

  it('顶栏关系行：只列存活关系', () => {
    const s = partnerState(70)
    expect(relationsLine(s)).toContain('小赵 70')
    expect(relationsLine(makeGame(7))).toContain('母亲 60')
  })
})

describe('关系数据校验', () => {
  it('全池（含 28 个关系事件：第 11/13 轮 13 个 + 第 25 轮 4 个 + 第 26 轮子女阶段 6 个 + 第 44 轮 1 个 + 第 46 轮婚恋入口 4 个）通过 validateEvents', () => {
    expect(RELATIONSHIP_EVENTS).toHaveLength(28)
    const issues = validateEvents(ALL_EVENTS)
    expect(issues).toEqual([])
  })

  it('坏数据：add 在已保证同类关系存在时必然无效', () => {
    const bad: GameEvent[] = [
      {
        id: 'bad_rel_add',
        category: 'relationship',
        title: '坏数据',
        text: 'x',
        minAge: 18,
        maxAge: 30,
        requires: { relationKinds: ['partner'] },
        choices: [
          { text: 'a', effects: [{ relation: { kind: 'partner', add: true } }] },
          { text: 'b', effects: [] },
        ],
      },
    ]
    const issues = validateEvents(bad)
    expect(issues.some((i) => i.field.includes('relation') && i.problem.includes('add'))).toBe(true)
  })

  it('坏数据：remove/convertFrom 缺少关系存在保证、min>max 亲密度、convertFrom 与目标相同', () => {
    const mk = (requires: GameEvent['requires'], effects: GameEvent['choices'][number]['effects']): GameEvent => ({
      id: 'bad_rel_remove',
      category: 'relationship',
      title: '坏数据',
      text: 'x',
      minAge: 18,
      maxAge: 30,
      requires,
      choices: [
        { text: 'a', effects },
        { text: 'b', effects: [] },
      ],
    })
    expect(validateEvents([mk(undefined, [{ relation: { kind: 'partner', remove: true } }])]).length).toBeGreaterThan(0)
    expect(
      validateEvents([mk(undefined, [{ relation: { kind: 'spouse', convertFrom: 'partner' } }])]).length,
    ).toBeGreaterThan(0)
    expect(
      validateEvents([
        mk({ minCloseness: { partner: 60 }, maxCloseness: { partner: 20 } }, []),
      ]).some((i) => i.problem.includes('自相矛盾')),
    ).toBe(true)
    expect(
      validateEvents([mk(undefined, [{ relation: { kind: 'spouse', convertFrom: 'spouse' } }])]).some((i) =>
        i.problem.includes('无意义'),
      ),
    ).toBe(true)
  })

  it('validateState：关系结构非法被标记，重复 id 被发现', () => {
    const s = makeGame(7)
    s.relations = [
      { id: 'x', kind: 'parent', name: '甲', closeness: 120, alive: true },
      { id: 'x', kind: 'alien' as never, name: '', closeness: 50, alive: 'yes' as never },
    ]
    const { issues } = validateState(s)
    expect(issues.some((i) => i.problem.includes('亲密度非法'))).toBe(true)
    expect(issues.some((i) => i.problem.includes('重复'))).toBe(true)
    expect(issues.some((i) => i.problem.includes('种类'))).toBe(true)
  })
})

describe('两条关系路线玩到中年（婚姻线 vs 单身线）', () => {
  const START = 26
  const END = 45

  function runMarriedRoute(): GameState {
    let s = partnerState(80, { age: START, money: 80000 })
    // 婚姻线也给一条朋友关系：婚后友情事件照常发生
    s = { ...s, relations: [...s.relations, REL] }
    s = choose(s, 'rel_propose', '旅行结婚，两个人说走就走')
    s = advanceYear(s)
    for (let age = s.age; age <= END; age++) {
      if (age === 28 && isEventAvailable(s, findEvent('rel_child_question'))) {
        s = choose(s, 'rel_child_question', '要个孩子吧')
      } else if (age % 4 === 0 && isEventAvailable(s, findEvent('rel_child_question'))) {
        s = choose(s, 'rel_child_question', '再等一年，先把住处安顿好')
      } else if (isEventAvailable(s, findEvent('rel_keep_friendship'))) {
        s = choose(s, 'rel_keep_friendship', '张罗一场聚会，你来订地方')
      }
      s = advanceYear(s)
      if (s.phase !== 'playing') break
    }
    return s
  }

  function runSingleRoute(): GameState {
    let s = makeGame(7, { age: START, money: 20000 })
    s = choose(s, 'rel_single_fullness', '加入周末徒步团')
    for (let age = s.age; age <= END; age++) {
      if (isEventAvailable(s, findEvent('rel_keep_friendship'))) {
        s = choose(s, 'rel_keep_friendship', '张罗一场聚会，你来订地方')
      } else if (isEventAvailable(s, findEvent('rel_single_fullness'))) {
        s = choose(s, 'rel_single_fullness', '把日子过成自己喜欢的样子')
      } else if (isEventAvailable(s, findEvent('rel_parent_low'))) {
        s = choose(s, 'rel_parent_low', '主动打个长电话回去')
      }
      s = advanceYear(s)
      if (s.phase !== 'playing') break
    }
    return s
  }

  it('婚姻线：有配偶有孩子，有已婚标记，孩子事件真实发生', () => {
    const s = runMarriedRoute()
    expect(s.tags).toContain('married')
    expect(s.tags).toContain('has_child')
    expect(aliveOf(s.relations, 'spouse')).not.toBeNull()
    expect(aliveOf(s.relations, 'child')).not.toBeNull()
    expect(s.history.some((h) => h.eventId === 'rel_propose')).toBe(true)
    expect(s.history.some((h) => h.eventId === 'rel_child_question')).toBe(true)
    expect(validateState(s).issues).toEqual([])
  })

  it('单身线：全程无伴侣/配偶/孩子，单身事件与友情事件真实发生', () => {
    const s = runSingleRoute()
    expect(s.tags).not.toContain('married')
    expect(s.tags).not.toContain('has_child')
    expect(aliveOf(s.relations, 'partner')).toBeNull()
    expect(aliveOf(s.relations, 'spouse')).toBeNull()
    expect(aliveOf(s.relations, 'child')).toBeNull()
    expect(aliveOf(s.relations, 'friend')).not.toBeNull()
    expect(s.history.some((h) => h.eventId === 'rel_single_fullness')).toBe(true)
    expect(s.history.some((h) => h.eventId === 'rel_keep_friendship')).toBe(true)
    expect(validateState(s).issues).toEqual([])
  })

  it('两条路线到中年履历/标记/关系全面分化，且数值合法', () => {
    const a = runMarriedRoute()
    const b = runSingleRoute()
    const eventSets = (s: GameState) => new Set(s.history.map((h) => h.eventId))
    const ea = eventSets(a)
    const eb = eventSets(b)
    expect([...ea].filter((e) => !eb.has(e)).length).toBeGreaterThan(0)
    expect([...eb].filter((e) => !ea.has(e)).length).toBeGreaterThan(0)
    for (const s of [a, b]) {
      expect(Number.isFinite(s.money)).toBe(true)
      expect(s.age).toBeGreaterThanOrEqual(START)
      expect(s.history.length).toBeGreaterThan(5)
    }
  })

  it('同 seed 同选择序列完全复现', () => {
    const replay = (): GameState => {
      let s = partnerState(80, { age: START, money: 80000 })
      s = choose(s, 'rel_propose', '旅行结婚，两个人说走就走')
      s = advanceYear(s)
      s = choose(s, 'rel_child_question', '要个孩子吧')
      s = advanceYear(s)
      s = advanceYear(s)
      return s
    }
    expect(JSON.stringify(replay())).toBe(JSON.stringify(replay()))
  })
})
