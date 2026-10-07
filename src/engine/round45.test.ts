// 第 45 轮：财务时序修正测试（新生儿落地当年口粮）
// 验收口径（PROMPT-V3.md 第 45 轮）：
// - 新生儿落地当年即计口粮（修正 baseYearFinance 读年初关系快照的时序偏差），
//   孪生对照逐元精确：落地年 money 差 = −CHILD_EXPENSE_INFANT（年初落地按全年计）
// - 年志「孩子的吃穿用度」在落地年出现（可感可解释）
// - 静态孩子（已在册）与旧档行为零回归（对照恒等）
// - 18–21 岁贴补子项让位：见 PROGRESS 第 45 轮账本（数据信号不存在 + 第 27 轮文本已收编自洽）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { CHILD_EXPENSE_INFANT, CHILD_EXPENSE_K12, CHILD_EXPENSE_COLLEGE, childExpenseFor } from './finance'
import type { GameState, PendingEffect, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

/** 延迟出生的 pending（rel_child_question 同款：years=1，次年初落地） */
function childPending(dueAge: number): PendingEffect[] {
  return [
    {
      id: 'pending_child_test',
      dueAge,
      relation: { kind: 'child', add: true, closeness: 65 },
      summary: '家里的宝宝出生了',
    },
  ]
}

describe('第 45 轮：新生儿落地当年口粮（孪生对照）', () => {
  it('落地当年即计：25→26 岁出生年，与无孩对照差 = −14,000（婴幼儿档全年）', () => {
    const withChild = makeGame(7, { age: 25, money: 50000, pending: childPending(26), relations: [] })
    const without = makeGame(7, { age: 25, money: 50000, relations: [] })
    const a = advanceYear(withChild)
    const b = advanceYear(without)
    // 孩子已在册且当年开支已计
    const born = a.relations.find((r) => r.kind === 'child')
    expect(born).toBeDefined()
    expect(a.age).toBe(26)
    expect(b.money - a.money).toBe(CHILD_EXPENSE_INFANT)
    expect(a.yearLog.join('\n')).toContain('孩子的吃穿用度')
    // 结算干净
    expect(validateState(a).issues).toEqual([])
  })

  it('修正前口径反证不再成立：出生次年（27 岁）差仍为 −14,000（持续计费非一次性）', () => {
    const withChild = makeGame(7, { age: 26, money: 50000, relations: [
      { id: 'c1', kind: 'child', name: '小满', closeness: 65, alive: true, birthAge: 26 },
    ] })
    const without = makeGame(7, { age: 26, money: 50000, relations: [] })
    const a = advanceYear(withChild)
    const b = advanceYear(without)
    expect(b.money - a.money).toBe(CHILD_EXPENSE_INFANT) // 1 岁仍按婴幼儿档
  })

  it('静态在册孩子行为零回归：3 岁（K12 前婴幼儿档）与 10 岁（K12 档）对照恒等', () => {
    const kidAt = (birthAge: number): Relation => ({
      id: 'c1', kind: 'child', name: '安安', closeness: 60, alive: true, birthAge,
    })
    const at8 = makeGame(7, { age: 20, money: 40000, relations: [kidAt(17)] }) // 3 岁
    const b8 = advanceYear(makeGame(7, { age: 20, money: 40000, relations: [] }))
    const a8 = advanceYear(at8)
    expect(b8.money - a8.money).toBe(CHILD_EXPENSE_INFANT)
    const at15 = makeGame(7, { age: 20, money: 40000, relations: [kidAt(10)] }) // 10 岁
    const b15 = advanceYear(makeGame(7, { age: 20, money: 40000, relations: [] }))
    const a15 = advanceYear(at15)
    expect(b15.money - a15.money).toBe(CHILD_EXPENSE_K12)
  })

  it('childExpenseFor 分档锚点不变：≤5 婴幼儿/6-17 K12/18-21 贴补/22+ 停付（第 26 轮口径）', () => {
    const kid = (birthAge: number): Relation => ({
      id: 'c', kind: 'child', name: '安安', closeness: 60, alive: true, birthAge,
    })
    expect(childExpenseFor(kid(20), 25)).toBe(CHILD_EXPENSE_INFANT) // 5 岁
    expect(childExpenseFor(kid(14), 25)).toBe(CHILD_EXPENSE_K12) // 11 岁
    expect(childExpenseFor(kid(7), 25)).toBe(CHILD_EXPENSE_COLLEGE) // 18 岁
    expect(childExpenseFor(kid(2), 25)).toBe(0) // 23 岁
  })
})
