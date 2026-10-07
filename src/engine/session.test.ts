// 第 6 轮测试：基础事件池 + 回合会话流程（选项效果正确应用、防重复结算、可复现、连续可玩）
import { describe, it, expect } from 'vitest'
import type { AttrKey, GameEvent, GameState } from './types'
import { ATTR_KEYS, clampAttr, sanitizeMoney } from './attrs'
import { startSession, chooseOption, nextYear, interpolate, type Session } from './session'
import { validateEvents } from './validateEvents'
import { visibleChoices } from './events'
import { ALL_EVENTS } from '../data/events'
import { DEFAULT_MAX_AGE } from './outcomes'

const POOL: GameEvent[] = ALL_EVENTS

/** 与 attrs.ts 语义一致的人工期望计算：所有效果求和后一次性收敛 */
function expectedAttrsMoney(pre: GameState, event: GameEvent, choiceIndex: number) {
  const sum = { health: 0, happiness: 0, smarts: 0, social: 0, stress: 0 }
  let money = pre.money
  const choice = event.choices[choiceIndex]
  for (const e of choice.effects) {
    if (e.attr && typeof e.delta === 'number') sum[e.attr as AttrKey] += e.delta
    if (typeof e.money === 'number') money += e.money
  }
  const attrs = {} as Record<AttrKey, number>
  for (const k of ATTR_KEYS) attrs[k] = clampAttr(k, pre.attrs[k] + sum[k])
  // 第 112 轮：lethal（直接致死）镜像引擎语义——健康归零（lethal_struck 标记同步授予，
  // 本函数只管 attrs/money 收敛，标记与致死链路由 round112.test 单独断言）
  if (choice.effects.some((e) => e.lethal)) attrs.health = 0
  return { attrs, money: sanitizeMoney(money) }
}

describe('第 6 轮：基础事件池数据质量', () => {
  it('事件池通过校验器，无任何问题', () => {
    expect(validateEvents(POOL)).toEqual([])
  })

  it('至少 12 个事件，覆盖青年/中年/晚年三个年龄段', () => {
    expect(POOL.length).toBeGreaterThanOrEqual(12)
    const hasYouth = POOL.some((e) => e.minAge < 31)
    const hasMid = POOL.some((e) => e.minAge >= 31 && e.maxAge <= 58)
    const hasLate = POOL.some((e) => e.minAge >= 51)
    expect(hasYouth && hasMid && hasLate).toBe(true)
  })

  it('每个事件 2～4 个选项，且任意两个选项的效果组合不完全相同', () => {
    for (const e of POOL) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.choices.length).toBeLessThanOrEqual(4)
      const signatures = e.choices.map((c) => JSON.stringify([c.effects, c.addTags ?? []]))
      expect(new Set(signatures).size).toBe(e.choices.length)
    }
  })
})

describe('第 6 轮：选项效果正确应用', () => {
  it('任意事件的任意【可见】选项，属性与金钱效果都精确收敛地落到状态上', () => {
    for (const event of POOL) {
      const session = startSession({ seed: 20260926, backgroundId: 'ordinary', traitId: 'studious' }, POOL)
      // 第 7 轮起选项可带 requires（如特质门控）；玩家只能选可见选项，
      // 因此按可见选项索引逐一注入验证，隐藏选项不属于可结算范围。
      const visible = visibleChoices(session.state, event)
      for (let ci = 0; ci < visible.length; ci++) {
        const injected: Session = { ...session, currentEvent: event }
        // applyChoice 按原始 choices 索引定位（第 11 轮起语义明确）：传可见选项的原始下标
        const rawIdx = event.choices.indexOf(visible[ci])
        const s = chooseOption(injected, rawIdx)

        const want = expectedAttrsMoney(session.state, event, rawIdx)
        expect(s.state.attrs).toEqual(want.attrs)
        expect(s.state.money).toBe(want.money)
        expect(s.awaitingAdvance).toBe(true)
        // 第 13 轮起选择后可能紧跟成就履历条目（eventId 'ach'），取最后一条选择条目比对
        const lastChoiceEntry = [...s.state.history].reverse().find((h) => h.eventId !== 'ach')
        expect(lastChoiceEntry?.eventId).toBe(event.id)
        expect(lastChoiceEntry?.choice).toBe(visible[ci].text)
      }
      expect(visible.length).toBeGreaterThanOrEqual(1)
    }
    // 选项级 requires 的语义由 education.test / creation.test 在可达状态下覆盖
    expect(POOL.every((e) => e.choices.length >= 2)).toBe(true)
  })

  it('lastDeltas 与状态实际变化一致', () => {
    const session = startSession({ seed: 42, backgroundId: 'ordinary', traitId: 'studious' }, POOL)
    const event = session.currentEvent!
    // 找一个带效果的选项
    const ci = event.choices.findIndex((c) => c.effects.length > 0)
    expect(ci).toBeGreaterThanOrEqual(0)
    const s = chooseOption(session, ci)

    const attrDeltas = s.lastDeltas.filter((d) => d.attr)
    expect(attrDeltas.length).toBeGreaterThan(0)
    for (const d of attrDeltas) {
      expect(d.delta).not.toBe(0)
      const before = session.state.attrs[d.attr as AttrKey]
      const after = s.state.attrs[d.attr as AttrKey]
      if (before > 0 && before < 100) expect(d.delta).toBe(after - before)
    }
  })

  it('正文占位符 {name} 被替换为角色名', () => {
    const session = startSession({ seed: 7, name: '测试者', backgroundId: 'ordinary', traitId: 'studious' }, POOL)
    expect(interpolate(session.currentEvent!.text, session.state.name)).not.toContain('{name}')
  })
})

describe('第 6 轮：回合流程守卫', () => {
  it('同一事件重复点击选择按钮不会重复结算', () => {
    const session = startSession({ seed: 42, backgroundId: 'ordinary', traitId: 'studious' }, POOL)
    const once = chooseOption(session, 0)
    const twice = chooseOption(once, 1)
    expect(twice).toBe(once)
    expect(once.state.history.length).toBe(session.state.history.length + 1)
    expect(twice.state.history.length).toBe(once.state.history.length)
  })

  it('未做选择时"进入下一年"是 no-op', () => {
    const session = startSession({ seed: 42, backgroundId: 'ordinary', traitId: 'studious' }, POOL)
    const s = nextYear(session, POOL)
    expect(s).toBe(session)
    expect(s.state.age).toBe(session.state.age)
  })

  it('游戏结束后事件与推进都停止', () => {
    let s = startSession({ seed: 2026, backgroundId: 'rural', traitId: 'ambitious' }, POOL)
    for (let i = 0; i < 200 && s.state.phase === 'playing'; i++) {
      s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, 0)
    }
    expect(s.state.phase).toBe('ended')
    expect(s.state.endingId).toBeTruthy()
    expect(s.currentEvent).toBeNull()
    const frozen = chooseOption(s, 0)
    const frozenNext = nextYear(frozen, POOL)
    expect(frozenNext.state).toBe(s.state)
  })
})

describe('第 6 轮：连续可玩性', () => {
  it('固定 seed 从 18 岁连续玩到 30 岁以上，全程数值合法', () => {
    let s = startSession({ seed: 8888, backgroundId: 'single_parent', traitId: 'sociable' }, POOL)
    for (let i = 0; i < 40 && s.state.phase === 'playing' && s.state.age < 30; i++) {
      s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, 0)
    }
    expect(s.state.age).toBeGreaterThanOrEqual(30)
    expect(s.state.phase).toBe('playing')
    expect(s.currentEvent).not.toBeNull()
    expect(s.state.history.length).toBeGreaterThanOrEqual(12)
    expect(Number.isFinite(s.state.money)).toBe(true)
    expect(Number.isInteger(s.state.money)).toBe(true)
    for (const k of ATTR_KEYS) {
      expect(s.state.attrs[k]).toBeGreaterThanOrEqual(0)
      expect(s.state.attrs[k]).toBeLessThanOrEqual(100)
    }
  })

  it('多个 seed 玩到终局都不会卡死，且都能到达 ended', () => {
    for (const seed of [1, 2, 3, 20260926, 4294967295]) {
      let s = startSession({ seed, backgroundId: 'rural', traitId: 'laid_back' }, POOL)
      let guard = 0
      while (s.state.phase === 'playing' && guard < 120) {
        s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, guard % 3 === 0 ? 1 : 0)
        guard++
      }
      expect(s.state.phase).toBe('ended')
      expect(s.state.age).toBeLessThanOrEqual(DEFAULT_MAX_AGE)
    }
  })

  it('事件池完全缺失时仍可用保底事件继续游戏', () => {
    let s = startSession({ seed: 99, backgroundId: 'wealthy', traitId: 'studious' }, undefined as unknown as GameEvent[])
    expect(s.currentEvent).not.toBeNull()
    expect(s.currentEvent!.id).toBe('fallback_quiet_year')
    for (let i = 0; i < 6; i++) {
      s = nextYear(chooseOption(s, 0), undefined as unknown as GameEvent[])
    }
    expect(s.state.age).toBe(24)
    expect(s.state.phase).toBe('playing')
  })

  it('同一 seed、同一选择序列，两局的最终状态完全一致', () => {
    const run = () => {
      let s = startSession({ seed: 555, backgroundId: 'ordinary', traitId: 'ambitious' }, POOL)
      for (let i = 0; i < 26 && s.state.phase === 'playing'; i++) {
        s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, i % 3)
      }
      return JSON.stringify(s.state)
    }
    expect(run()).toBe(run())
  })
})
