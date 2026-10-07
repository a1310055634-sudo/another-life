// 第 83 轮：主动行动系统 I 测试（引擎与行动表）
// 验收口径（PROMPT-V5.md 第 83 轮）：
// - A1 资格正反：年龄窗外/职业不符/关系缺位/钱不够 各一
// - A2 cooldown 与每年至多一项（action_done 全局闸）
// - A4 history/年志集成（◆ 前缀条目）与体检 healthRisk 分级注记
// - A3（18 局零位移）与 A5（400 局抽测）由 outcomes.test/探针/round39 承担，不在本文件
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { availableActions, isActionAvailable, performAction, ACTION_DONE_KEY } from './actions'
import { ACTION_DEFS } from '../data/actions'
import type { GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const byId = (id: string) => {
  const a = ACTION_DEFS.find((x) => x.id === id)
  if (!a) throw new Error(`行动不存在: ${id}`)
  return a
}
const employed = (): GameState['career'] => ({
  kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2, salaryMul: 1,
})
const withParent = (): Array<GameState['relations'][number]> => ([
  { id: 'p1', kind: 'parent', name: '父亲', closeness: 50, alive: true },
])

describe('第 83 轮：主动行动——资格正反（A1）', () => {
  it('年龄窗外不可用：act_gym 75 岁不可用、40 岁可用', () => {
    expect(isActionAvailable(makeGame(7, { age: 75 }), byId('act_gym'))).toBe(false)
    expect(isActionAvailable(makeGame(7, { age: 40 }), byId('act_gym'))).toBe(true)
  })

  it('职业不符不可用：act_side_job 待业/退休不可用、在职可用', () => {
    expect(isActionAvailable(makeGame(7, { age: 30 }), byId('act_side_job'))).toBe(false)
    expect(isActionAvailable(makeGame(7, { age: 30, career: employed() }), byId('act_side_job'))).toBe(true)
  })

  it('关系缺位不可用：act_parents 无在册父母不可用、有则可用', () => {
    expect(isActionAvailable(makeGame(7, { age: 30, relations: [] }), byId('act_parents'))).toBe(false)
    expect(isActionAvailable(makeGame(7, { age: 30, relations: withParent() }), byId('act_parents'))).toBe(true)
  })

  it('钱不够不可用；扣款精确、效果落地（收费行动不致负债、免费行动负债年可用）', () => {
    expect(isActionAvailable(makeGame(7, { age: 30, money: 0 }), byId('act_gym'))).toBe(false)
    expect(isActionAvailable(makeGame(7, { age: 30, money: -100 }), byId('act_gym'))).toBe(false)
    expect(isActionAvailable(makeGame(7, { age: 30, money: 0 }), byId('act_recharge'))).toBe(true)
    expect(isActionAvailable(makeGame(7, { age: 30, money: -100 }), byId('act_recharge'))).toBe(true)
    const s = makeGame(7, { age: 30, money: 1000 })
    const r = performAction(s, 'act_gym')
    expect(r.ok).toBe(true)
    expect(r.state.money).toBe(400)
    expect(r.state.attrs.health).toBe(Math.min(100, s.attrs.health + 2))
    expect(r.state.attrs.stress).toBe(Math.max(0, s.attrs.stress - 2))
  })

  it('unknown id 与 ended 阶段拒绝', () => {
    expect(performAction(makeGame(7), 'nope').ok).toBe(false)
    expect(performAction(makeGame(7), 'nope').reason).toBe('unknown-action')
    const ended = { ...makeGame(7), phase: 'ended' as const }
    const r = performAction(ended, 'act_gym')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('unavailable')
  })
})

describe('第 83 轮：cooldown 与每年至多一项（A2）', () => {
  it('行动后同年全部行动不可用；次年恢复（cd1 可再做）', () => {
    let s = makeGame(7, { age: 30, money: 5000 })
    const r = performAction(s, 'act_gym')
    expect(r.ok).toBe(true)
    s = r.state
    expect(s.cooldowns[ACTION_DONE_KEY]).toBe(31)
    expect(availableActions(s)).toHaveLength(0)
    expect(performAction(s, 'act_recharge').reason).toBe('unavailable')
    const ids = availableActions(advanceYear(s)).map((a) => a.id) // 31 岁
    expect(ids).toContain('act_gym') // cd1 已过
    expect(ids).toContain('act_recharge')
  })

  it('cd3 行动三年内不可重复、到期恢复', () => {
    let s = makeGame(7, { age: 30, money: 50000 })
    s = performAction(s, 'act_study').state // 30 岁进修
    expect(s.cooldowns['act_study']).toBe(33)
    let cur = advanceYear(s) // 31 岁
    expect(isActionAvailable(cur, byId('act_study'))).toBe(false)
    expect(performAction(cur, 'act_study').reason).toBe('unavailable')
    cur = advanceYear(cur) // 32 岁
    expect(isActionAvailable(cur, byId('act_study'))).toBe(false)
    cur = advanceYear(cur) // 33 岁
    expect(isActionAvailable(cur, byId('act_study'))).toBe(true)
    expect(performAction(cur, 'act_study').ok).toBe(true)
  })
})

describe('第 83 轮：history/体检/关系落地（A4）', () => {
  it('行动落 ◆ 履历：eventId=action、title ◆ 前缀、summary 非空', () => {
    const s = makeGame(7, { age: 30, money: 5000 })
    const r = performAction(s, 'act_recharge')
    expect(r.ok).toBe(true)
    const h = r.state.history[r.state.history.length - 1]
    expect(h.eventId).toBe('action')
    expect(h.title.startsWith('◆')).toBe(true)
    expect(h.summary.length).toBeGreaterThan(0)
    expect(h.age).toBe(30)
  })

  it('体检按 healthRisk 分级注记（25/50 与 riskBand 同口径）且不改值', () => {
    const low = performAction(makeGame(7, { age: 30, money: 5000, healthRisk: 0 }), 'act_checkup')
    expect(low.summary).toContain('正常')
    const mid = performAction(makeGame(7, { age: 30, money: 5000, healthRisk: 30 }), 'act_checkup')
    expect(mid.summary).toContain('小毛病')
    const high = performAction(makeGame(7, { age: 30, money: 5000, healthRisk: 60 }), 'act_checkup')
    expect(high.summary).toContain('红字')
    expect(low.state.healthRisk).toBe(0)
    expect(mid.state.healthRisk).toBe(30)
    expect(high.state.healthRisk).toBe(60)
  })

  it('陪伴父母：closeness +4 与 300 元扣款精确', () => {
    const s = makeGame(7, { age: 30, money: 5000, relations: withParent() })
    const r = performAction(s, 'act_parents')
    expect(r.ok).toBe(true)
    expect(r.state.relations[0].closeness).toBe(54)
    expect(r.state.money).toBe(4700)
  })
})
