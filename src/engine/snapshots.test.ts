// 第 21 轮测试：年度快照（初始切面、逐年追加、全生涯逐点一致、终局年、职业摘要）
// 快照为资产曲线/雷达/人生报告采集原料：只验数据完整性，不做任何呈现。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { takeSnapshot } from './snapshot'
import type { GameState } from './types'
import { startSession, chooseOption, nextYear, type Session } from './session'
import { ALL_EVENTS } from '../data/events'

const OPTS = { seed: 20261001, backgroundId: 'ordinary', traitId: 'studious' } as const

/** 从 18 岁自动玩到终局，沿途收集每年结算后的切面（含 18 岁开局切面） */
function playFullLife(seed: number): { s: Session; facets: ReturnType<typeof takeSnapshot>[] } {
  let s = startSession({ ...OPTS, seed }, ALL_EVENTS)
  const facets = [takeSnapshot(s.state)]
  for (let i = 0; i < 200 && s.state.phase === 'playing'; i++) {
    const before = s.state
    s = s.awaitingAdvance ? nextYear(s, ALL_EVENTS) : chooseOption(s, 0)
    if (s.state.age !== before.age) facets.push(takeSnapshot(s.state))
  }
  return { s, facets }
}

describe('第 21 轮：年度快照', () => {
  it('创建角色即有 18 岁开局切面：恰一条，与初始状态一致', () => {
    const s = createNewGame({ ...OPTS, name: '快照员' })
    expect(s.snapshots).toHaveLength(1)
    expect(s.snapshots[0]).toEqual({
      age: 18,
      money: s.money,
      attrs: { ...s.attrs },
      career: { kind: 'none' },
    })
    expect(validateState(s).issues).toEqual([])
  })

  it('推进一年恰追加一条：末条 age/money/五维属性/职业与结算后状态逐字段一致', () => {
    const s = createNewGame(OPTS)
    const next = advanceYear(s)
    expect(next.phase).toBe('playing')
    expect(next.snapshots).toHaveLength(2)
    const last = next.snapshots[next.snapshots.length - 1]
    expect(last.age).toBe(next.age)
    expect(last.age).toBe(s.age + 1)
    expect(last.money).toBe(next.money)
    expect(last.attrs).toEqual(next.attrs)
    expect(last.career).toEqual({ kind: next.career.kind })
  })

  it('在职年的快照带职级；退休年的快照记退休身份', () => {
    const withJob = (state: GameState): GameState => ({
      ...state,
      career: {
        kind: 'employed',
        jobId: 'stall_vendor',
        jobTitle: '市集摊主',
        level: 3,
        salary: 40000,
        yearsAtJob: 1,
      },
    })
    // 工龄 1→2，未到 promoteEvery（4），职级保持 3：快照职级与结算后状态一致
    const working = advanceYear(withJob(createNewGame(OPTS)))
    if (working.career.kind !== 'employed') throw new Error('定向在职状态应保持在职')
    const lastWork = working.snapshots[working.snapshots.length - 1]
    expect(lastWork.career).toEqual({ kind: 'employed', level: working.career.level })

    // 64 岁 +1 年 = 65 岁，到龄自动退休（RETIRE_AGE=65），当年快照即退休切面
    const retired = advanceYear(withJob({ ...createNewGame(OPTS), age: 64 }))
    expect(retired.career.kind).toBe('retired')
    expect(retired.snapshots[retired.snapshots.length - 1].career).toEqual({ kind: 'retired' })
  })

  it('事件选择不追加快照，只有年度结算追加（一年恰一条）', () => {
    let s = startSession(OPTS, ALL_EVENTS)
    expect(s.state.snapshots).toHaveLength(1)
    const chosen = chooseOption(s, 0)
    expect(chosen.state.snapshots).toHaveLength(1)
    const advanced = nextYear(chosen, ALL_EVENTS)
    expect(advanced.state.snapshots).toHaveLength(2)
  })

  it('全生涯逐点一致（seed A）：18 岁到终龄逐年连续、每条与当年结算切面全等、终局年保有快照', () => {
    const { s, facets } = playFullLife(415)
    expect(s.state.phase).toBe('ended')
    const snaps = s.state.snapshots
    // 年龄序列恰为 18..终龄，无缺失、无重复
    expect(snaps.map((x) => x.age)).toEqual(
      Array.from({ length: snaps.length }, (_, i) => 18 + i),
    )
    expect(snaps.length).toBe(facets.length)
    // 每条快照与当年年度结算后的真实状态切面全等
    expect(snaps).toEqual(facets)
    // 终局年：结算先于结束检查，末条即终局切面
    expect(snaps[snaps.length - 1].age).toBe(s.state.age)
    expect(s.state.endingId).toBeTruthy()
    expect(validateState(s.state).issues).toEqual([])
  })

  it('全生涯逐点一致（seed B，另一条命运线）', () => {
    const { s, facets } = playFullLife(777)
    expect(s.state.phase).toBe('ended')
    expect(s.state.snapshots).toEqual(facets)
    expect(s.state.snapshots[0].age).toBe(18)
  })

  it('validateState：快照字段缺失或非数组被报告', () => {
    const s = createNewGame(OPTS)
    const broken = { ...s, snapshots: 'nope' as unknown as GameState['snapshots'] }
    expect(validateState(broken).issues.map((i) => i.field)).toContain('snapshots')
  })
})
