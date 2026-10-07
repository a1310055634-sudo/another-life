import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { mulberry32 } from './rng'
import {
  checkCondition,
  visibleChoices,
  isEventAvailable,
  availableEvents,
  weightedPick,
  drawEvent,
  applyChoice,
  fallbackEvent,
} from './events'
import { validateEvents } from './validateEvents'
import { advanceYear } from './lifecycle'
import type { GameEvent, GameState } from './types'

/** 造一个基础 18 岁状态 */
function baseState(over: Partial<GameState> = {}): GameState {
  const s = createNewGame({ seed: 42, backgroundId: 'ordinary', traitId: 'studious' })
  return { ...s, ...over }
}

/** 快速造事件 */
function ev(over: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'test_event',
    category: 'life',
    title: '测试事件',
    text: '这是 {name} 的一次测试。',
    minAge: 18,
    maxAge: 60,
    choices: [
      { text: '选项甲', effects: [{ attr: 'happiness', delta: 3 }] },
      { text: '选项乙', effects: [{ money: -500 }] },
    ],
    ...over,
  }
}

describe('checkCondition 条件筛选', () => {
  it('年龄区间：窗口外不可触发', () => {
    const s = baseState({ age: 20 })
    expect(checkCondition(s, { minAge: 18, maxAge: 25 })).toBe(true)
    expect(checkCondition(s, { minAge: 21 })).toBe(false)
    expect(checkCondition(s, { maxAge: 19 })).toBe(false)
  })

  it('属性上下限', () => {
    const s = baseState({ attrs: { health: 60, happiness: 40, smarts: 70, social: 50, stress: 30 } })
    expect(checkCondition(s, { minAttr: { health: 60 } })).toBe(true)
    expect(checkCondition(s, { minAttr: { health: 61 } })).toBe(false)
    expect(checkCondition(s, { maxAttr: { stress: 30 } })).toBe(true)
    expect(checkCondition(s, { maxAttr: { stress: 29 } })).toBe(false)
  })

  it('教育、职业类别与职级', () => {
    const s = baseState({
      education: 'bachelor',
      career: { kind: 'employed', jobId: 'j1', jobTitle: '职员', level: 2, salary: 80000, yearsAtJob: 1 },
    })
    expect(checkCondition(s, { education: ['bachelor', 'master'] })).toBe(true)
    expect(checkCondition(s, { education: ['phd'] })).toBe(false)
    expect(checkCondition(s, { careerKinds: ['employed'] })).toBe(true)
    expect(checkCondition(s, { careerKinds: ['student'] })).toBe(false)
    expect(checkCondition(s, { jobLevels: [2, 3] })).toBe(true)
    expect(checkCondition(s, { jobLevels: [1] })).toBe(false)
  })

  it('历史标记 tagsAll / tagsAny / tagsNone', () => {
    const s = baseState({ tags: ['gaozhong', 'sporty'] })
    expect(checkCondition(s, { tagsAll: ['gaozhong', 'sporty'] })).toBe(true)
    expect(checkCondition(s, { tagsAll: ['gaozhong', 'rich'] })).toBe(false)
    expect(checkCondition(s, { tagsAny: ['rich', 'sporty'] })).toBe(true)
    expect(checkCondition(s, { tagsAny: ['rich'] })).toBe(false)
    expect(checkCondition(s, { tagsNone: ['rich'] })).toBe(true)
    expect(checkCondition(s, { tagsNone: ['sporty'] })).toBe(false)
  })

  it('财务区间', () => {
    const s = baseState({ money: 50000 })
    expect(checkCondition(s, { moneyAtLeast: 50000 })).toBe(true)
    expect(checkCondition(s, { moneyAtLeast: 50001 })).toBe(false)
    expect(checkCondition(s, { moneyBelow: 50000 })).toBe(false)
    expect(checkCondition(s, { moneyBelow: 50001 })).toBe(true)
  })

  it('关系状态与亲密度', () => {
    const s = baseState({
      relations: [
        { id: 'r1', kind: 'friend', name: '老友', closeness: 70, alive: true },
        { id: 'r2', kind: 'partner', name: '恋人', closeness: 20, alive: true },
      ],
    })
    expect(checkCondition(s, { relationKinds: ['friend'] })).toBe(true)
    expect(checkCondition(s, { relationKinds: ['child'] })).toBe(false)
    expect(checkCondition(s, { minCloseness: { friend: 70 } })).toBe(true)
    expect(checkCondition(s, { minCloseness: { friend: 71 } })).toBe(false)
    expect(checkCondition(s, { minCloseness: { partner: 50 } })).toBe(false)
  })

  it('条件为空视为满足', () => {
    expect(checkCondition(baseState(), undefined)).toBe(true)
  })
})

describe('选项可见性', () => {
  it('不满足条件的选项被隐藏，满足的保留', () => {
    const e = ev({
      choices: [
        { text: '人人可选', effects: [] },
        { text: '要有钱', effects: [], requires: { moneyAtLeast: 1_000_000 } },
        { text: '要有朋友', effects: [], requires: { relationKinds: ['friend'] } },
      ],
    })
    const s = baseState()
    const visible = visibleChoices(s, e)
    expect(visible.map((c) => c.text)).toEqual(['人人可选'])
  })

  it('所有选项都不可见时事件不可用', () => {
    const e = ev({
      choices: [
        { text: '要很有钱', effects: [], requires: { moneyAtLeast: 1_000_000 } },
        { text: '要有博士学历', effects: [], requires: { education: ['phd'] } },
      ],
    })
    expect(isEventAvailable(baseState(), e)).toBe(false)
  })
})

describe('事件可用性：年龄 / once 去重 / 冷却', () => {
  it('年龄窗口外不可用', () => {
    const e = ev({ minAge: 30, maxAge: 40 })
    expect(isEventAvailable(baseState({ age: 25 }), e)).toBe(false)
    expect(isEventAvailable(baseState({ age: 35 }), e)).toBe(true)
    expect(isEventAvailable(baseState({ age: 41 }), e)).toBe(false)
  })

  it('once 事件发生一次后不再出现', () => {
    const e = ev({ id: 'once_ev', once: true })
    const s = baseState({ seenEvents: [] })
    expect(isEventAvailable(s, e)).toBe(true)
    const s2 = baseState({ seenEvents: ['once_ev'] })
    expect(isEventAvailable(s2, e)).toBe(false)
  })

  it('非 once 事件仍记录已见，但可按冷却回归', () => {
    const e = ev({ id: 'repeat_ev', cooldown: 3 })
    const s = baseState({ seenEvents: ['repeat_ev'], cooldowns: { repeat_ev: 23 } })
    expect(isEventAvailable(s, e)).toBe(false) // 22 岁仍在冷却
    expect(isEventAvailable({ ...s, age: 23 }, e)).toBe(true) // 冷却解除
  })

  it('availableEvents 只保留可用事件', () => {
    const pool = [ev({ id: 'a', minAge: 40 }), ev({ id: 'b' }), ev({ id: 'c', once: true })]
    const s = baseState({ seenEvents: ['c'] })
    expect(availableEvents(s, pool).map((e) => e.id)).toEqual(['b'])
  })
})

describe('加权抽取与固定 seed', () => {
  const pool = [
    ev({ id: 'w1', weight: 90 }),
    ev({ id: 'w2', weight: 10 }),
    ev({ id: 'w3', weight: 10 }),
  ]

  it('同 seed 抽取序列完全一致', () => {
    const seq1 = Array.from({ length: 30 }, () => {
      const r = mulberry32(7)
      return Array.from({ length: 5 }, () => weightedPick(pool, r).id).join(',')
    })
    const seq2 = Array.from({ length: 30 }, () => {
      const r = mulberry32(7)
      return Array.from({ length: 5 }, () => weightedPick(pool, r).id).join(',')
    })
    expect(seq1).toEqual(seq2)
    // 同一 rng 连续推进的序列也可复现
    const r = mulberry32(7)
    const one = Array.from({ length: 10 }, () => weightedPick(pool, r).id)
    const r2 = mulberry32(7)
    const two = Array.from({ length: 10 }, () => weightedPick(pool, r2).id)
    expect(one).toEqual(two)
  })

  it('高权重事件被抽中的频率显著更高', () => {
    const r = mulberry32(7)
    const counts: Record<string, number> = { w1: 0, w2: 0, w3: 0 }
    for (let i = 0; i < 2000; i++) counts[weightedPick(pool, r).id]++
    expect(counts.w1 / 2000).toBeGreaterThan(0.7)
  })

  it('priority 层：高优先级事件优先被抽', () => {
    const p = [ev({ id: 'low', priority: 0 }), ev({ id: 'high', priority: 5 })]
    const picked = weightedPick(p, mulberry32(1))
    expect(picked.id).toBe('high')
  })

  it('traitWeight 透传：特质放大类别权重影响抽取', () => {
    const p = [ev({ id: 'life_ev', category: 'life', weight: 1 }), ev({ id: 'edu_ev', category: 'education', weight: 1 })]
    const r = mulberry32(7)
    let lifeCount = 0
    for (let i = 0; i < 500; i++) {
      if (weightedPick(p, r, (e) => (e.category === 'life' ? 20 : 1)).id === 'life_ev') lifeCount++
    }
    expect(lifeCount / 500).toBeGreaterThan(0.85)
  })
})

describe('保底机制', () => {
  it('事件池为空时返回保底事件，选项可用，游戏继续', () => {
    const s = baseState()
    const e = drawEvent(s, [], mulberry32(1))
    expect(e.id).toBe('fallback_quiet_year')
    expect(e.choices.length).toBeGreaterThanOrEqual(2)
    const applied = applyChoice(s, e, 0)
    expect(applied.state.history).toHaveLength(1)
    expect(applied.state.phase).toBe('playing')
  })

  it('候选全部被过滤时同样落入保底', () => {
    const s = baseState({ age: 20 })
    const pool = [ev({ id: 'old_only', minAge: 60 })]
    expect(drawEvent(s, pool, mulberry32(1)).id).toBe('fallback_quiet_year')
  })

  it('保底事件自身是合法数据', () => {
    const f = fallbackEvent()
    expect(f.choices.length).toBeGreaterThanOrEqual(2)
    expect(validateEvents([f])).toEqual([])
  })
})

describe('applyChoice 选择结算', () => {
  it('属性与金钱效果正确应用，且收敛在合法区间', () => {
    const e = ev({
      choices: [
        { text: '狂喜', effects: [{ attr: 'happiness', delta: 200 }, { money: 3000 }] },
        { text: '破财', effects: [{ money: -100000 }] },
      ],
    })
    const s = baseState({ money: 50000 })
    const a = applyChoice(s, e, 0)
    expect(a.state.attrs.happiness).toBe(100)
    expect(a.state.money).toBe(53000)
    const b = applyChoice(s, e, 1)
    expect(b.state.money).toBe(-50000) // 允许负债，但必须是有限数
    expect(Number.isFinite(b.state.money)).toBe(true)
  })

  it('重复点击同一索引不会得到不同结果（幂等输入→同输出）', () => {
    const e = ev()
    const s = baseState()
    expect(applyChoice(s, e, 0).state).toEqual(applyChoice(s, e, 0).state)
    // 越界索引兜底到第一个可见选项，不抛错、绝不结算隐藏选项
    expect(applyChoice(s, e, 99).state.history[0].choice).toBe('选项甲')
  })

  it('第 11 轮回归：隐藏选项存在时按原始索引定位，不得结算错位选项', () => {
    // UI（EventCard）渲染完整 choices 数组并回传原始下标；引擎必须按原始索引定位。
    // 修复前：applyChoice 误用可见列表索引——第 0 项被隐藏时，点原始 1 号（可见列表 0 号）
    // 会被结算成可见列表 1 号（错位），点最后一个可见选项则越界 fallback 到原始 0 号。
    const e = ev({
      choices: [
        { text: '隐藏的贵选项', effects: [{ attr: 'happiness', delta: 50 }], requires: { moneyAtLeast: 1_000_000 } },
        { text: '可见的A', effects: [{ attr: 'happiness', delta: 1 }] },
        { text: '可见的B', effects: [{ attr: 'happiness', delta: 2 }] },
      ],
    })
    const s = baseState({ money: 100 })
    const vis = visibleChoices(s, e)
    expect(vis.map((c) => c.text)).toEqual(['可见的A', '可见的B'])
    // UI 上点「可见的A」回传原始索引 1 → 必须结算 A（修复前会结算 B）
    expect(applyChoice(s, e, 1).state.attrs.happiness).toBe(s.attrs.happiness + 1)
    // 点「可见的B」回传原始索引 2 → 必须结算 B（修复前 visible[2] 越界 → 错误落到隐藏的贵选项）
    expect(applyChoice(s, e, 2).state.attrs.happiness).toBe(s.attrs.happiness + 2)
    // 传入不可见选项的索引（防御）：兜底结算第一个可见选项
    expect(applyChoice(s, e, 0).state.history[0].choice).toBe('可见的A')
  })

  it('记录 seenEvents、冷却与履历', () => {
    const e = ev({ id: 'hist_ev', cooldown: 2 })
    const s = baseState({ age: 22 })
    const a = applyChoice(s, e, 0)
    expect(a.state.seenEvents).toContain('hist_ev')
    expect(a.state.cooldowns.hist_ev).toBe(24)
    expect(a.state.history[0]).toMatchObject({ age: 22, eventId: 'hist_ev', choice: '选项甲' })
    expect(a.summary.length).toBeGreaterThan(0)
  })

  it('summary 中的 {name} 占位符被替换', () => {
    const e = ev({
      choices: [{ text: '走过', summary: '{name} 淡淡地走了过去', effects: [] }, { text: '留下', effects: [] }],
    })
    const s = baseState({ name: '陈默' })
    const a = applyChoice(s, e, 0)
    expect(a.summary).toBe('陈默 淡淡地走了过去')
  })

  it('延迟效果按 years 换算 dueAge 入队，到期后由年份结算生效', () => {
    const e = ev({
      choices: [
        {
          text: '开始健身',
          effects: [{ attr: 'health', delta: 2 }],
          delayed: [{ attr: 'health', delta: 5, years: 2, summary: '两年坚持下来，身体结实了不少' }],
        },
        { text: '不管了', effects: [] },
      ],
    })
    const s = baseState({ age: 20 })
    const chosen = applyChoice(s, e, 0).state
    expect(chosen.pending).toHaveLength(1)
    expect(chosen.pending[0].dueAge).toBe(22)

    let cur = advanceYear(chosen) // 21 岁：未到期
    expect(cur.pending).toHaveLength(1)
    expect(cur.attrs.health).toBe(chosen.attrs.health + 1) // 只有自然漂移
    cur = advanceYear(cur) // 22 岁：延迟效果到期
    expect(cur.pending).toHaveLength(0)
    const healthGain = cur.attrs.health - chosen.attrs.health
    expect(healthGain).toBeGreaterThanOrEqual(5) // 延迟 +5（自然漂移只增不减则更多）
  })

  it('关系效果：新增关系确定性生成 ID（同输入同结果）', () => {
    const e = ev({
      choices: [
        { text: '认识新朋友', effects: [{ relation: { kind: 'friend', add: true } }] },
        { text: '算了', effects: [] },
      ],
    })
    const s = baseState()
    const r1 = applyChoice(s, e, 0).state
    const r2 = applyChoice(s, e, 0).state
    expect(r1.relations.map((x) => x.id)).toEqual(r2.relations.map((x) => x.id))
    expect(r1.relations.some((x) => x.kind === 'friend')).toBe(true)
    // 已有活着的同类型关系时不再新增
    const again = applyChoice(r1, e, 0).state
    expect(again.relations.filter((x) => x.kind === 'friend' && x.alive)).toHaveLength(1)
  })

  it('addTags / removeTags 生效且去重', () => {
    const e = ev({
      choices: [
        { text: '创业', effects: [], addTags: ['startup', 'risk'], removeTags: ['stable'] },
        { text: '求稳', effects: [], addTags: ['stable'] },
      ],
    })
    const s = baseState({ tags: ['stable'] })
    const a = applyChoice(s, e, 0)
    expect(a.state.tags.sort()).toEqual(['risk', 'startup'])
  })
})

describe('端到端确定性：同 seed 完整流程可复现', () => {
  function runLife(seed: number): string {
    let s = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'sociable' })
    const pool = [
      ev({ id: 'e1', choices: [{ text: '甲', effects: [{ attr: 'smarts', delta: 2 }] }, { text: '乙', effects: [{ money: -200 }] }] }),
      ev({ id: 'e2', minAge: 20, choices: [{ text: '甲', effects: [{ attr: 'social', delta: 1 }] }, { text: '乙', effects: [{ attr: 'stress', delta: 2 }] }] }),
      ev({ id: 'e3', category: 'money', minAge: 25, choices: [{ text: '甲', effects: [{ money: 8000 }] }, { text: '乙', effects: [{ attr: 'happiness', delta: -1 }] }] }),
    ]
    const rng = mulberry32(s.rngState)
    for (let i = 0; i < 20 && s.phase === 'playing'; i++) {
      const e = drawEvent(s, pool, rng)
      const { state } = applyChoice(s, e, i % 2)
      s = advanceYear(state)
    }
    return JSON.stringify(s)
  }

  it('同一 seed 两次运行得到完全相同的最终状态', () => {
    expect(runLife(42)).toBe(runLife(42))
    expect(runLife(1234)).toBe(runLife(1234))
  })

  it('20 年循环无 NaN / 无非法属性', () => {
    let s = createNewGame({ seed: 99, backgroundId: 'rural', traitId: 'ambitious' })
    const pool = [ev({ id: 'x', choices: [{ text: '甲', effects: [{ attr: 'health', delta: 3 }] }, { text: '乙', effects: [{ money: 100 }] }] })]
    const rng = mulberry32(s.rngState)
    for (let i = 0; i < 20 && s.phase === 'playing'; i++) {
      const e = drawEvent(s, pool, rng)
      s = advanceYear(applyChoice(s, e, i % 2).state)
      for (const v of Object.values(s.attrs)) expect(Number.isFinite(v)).toBe(true)
      expect(Number.isFinite(s.money)).toBe(true)
    }
    expect(s.age).toBeGreaterThanOrEqual(38)
  })
})

describe('validateEvents 事件数据校验器', () => {
  it('合法事件池返回空问题清单', () => {
    const pool = [
      ev({ id: 'ok1' }),
      ev({ id: 'ok2', category: 'career', minAge: 25, maxAge: 45, weight: 5, cooldown: 3, once: true }),
    ]
    expect(validateEvents(pool)).toEqual([])
  })

  it('检测重复 ID', () => {
    const issues = validateEvents([ev({ id: 'dup' }), ev({ id: 'dup' })])
    expect(issues.some((i) => i.field === 'id' && i.problem.includes('重复'))).toBe(true)
  })

  it('检测选项缺失与过多', () => {
    expect(validateEvents([ev({ choices: [] })]).some((i) => i.field === 'choices')).toBe(true)
    expect(
      validateEvents([ev({ choices: [{ text: '只有一个', effects: [] }] })]).some((i) => i.field === 'choices'),
    ).toBe(true)
    expect(
      validateEvents([
        ev({
          choices: [1, 2, 3, 4, 5].map((n) => ({ text: `选项${n}`, effects: [] })),
        }),
      ]).some((i) => i.problem.includes('超过 4')),
    ).toBe(true)
  })

  it('检测年龄区间非法与完全不可达', () => {
    expect(validateEvents([ev({ minAge: 40, maxAge: 30 })]).some((i) => i.problem.includes('minAge'))).toBe(true)
    expect(validateEvents([ev({ minAge: 5, maxAge: 10 })]).some((i) => i.problem.includes('不可达'))).toBe(true)
  })

  it('检测条件自相矛盾与条件和事件窗口冲突', () => {
    const issues = validateEvents([ev({ requires: { minAttr: { health: 80 }, maxAttr: { health: 30 } } })])
    expect(issues.some((i) => i.problem.includes('自相矛盾'))).toBe(true)
    const issues2 = validateEvents([ev({ minAge: 18, maxAge: 30, requires: { minAge: 40 } })])
    expect(issues2.some((i) => i.problem.includes('永不可满足'))).toBe(true)
  })

  it('检测非法权重、冷却与数值效果', () => {
    expect(validateEvents([ev({ weight: -3 })]).some((i) => i.field === 'weight')).toBe(true)
    expect(validateEvents([ev({ cooldown: -1 })]).some((i) => i.field === 'cooldown')).toBe(true)
    const bad = ev({
      choices: [
        { text: '甲', effects: [{ attr: 'happiness', delta: Number.NaN }, { money: Number.POSITIVE_INFINITY }] },
        { text: '乙', effects: [] },
      ],
    })
    const issues = validateEvents([bad])
    expect(issues.some((i) => i.field.includes('delta'))).toBe(true)
    expect(issues.some((i) => i.field.includes('money'))).toBe(true)
  })

  it('检测延迟年数非法', () => {
    const bad = ev({
      choices: [{ text: '甲', effects: [], delayed: [{ attr: 'health', delta: 1, years: 0 }] }, { text: '乙', effects: [] }],
    })
    expect(validateEvents([bad]).some((i) => i.field.includes('delayed'))).toBe(true)
  })

  it('全部选项带条件时给出风险提示', () => {
    const risky = ev({
      choices: [
        { text: '甲', effects: [], requires: { moneyAtLeast: 1_000_000 } },
        { text: '乙', effects: [], requires: { education: ['phd'] } },
      ],
    })
    expect(validateEvents([risky]).some((i) => i.problem.includes('风险'))).toBe(true)
  })

  it('非数组输入与空文本均被捕获', () => {
    expect(validateEvents(null as unknown as GameEvent[])).toHaveLength(1)
    expect(validateEvents([ev({ title: '' })]).some((i) => i.field === 'title')).toBe(true)
    expect(validateEvents([ev({ text: '' })]).some((i) => i.field === 'text')).toBe(true)
  })
})
