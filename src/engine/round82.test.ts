// 第 82 轮：压力恢复带测试（V4 挂账④清偿——阶段压力项 ≤0 且年初压力 >55 → 额外 −2/年）
// 验收口径（PROMPT-V5.md 第 82 轮 A1）：
// - 退休年双 −4−2；有增量年（在职/待业/学生/零工）不恢复；55 边界（>55 严格）
// - 与 ≥80 健康侵蚀、≥70 幸福拖累共存；advanceYear 集成 + burnout <60 自动摘除联动
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear, naturalAttrDrift, STRESS_RECOVERY_FLOOR, STRESS_RECOVERY_RATE } from './lifecycle'
import type { GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const retired = (): GameState['career'] => ({ kind: 'retired', pension: 20000 })
const employed = (): GameState['career'] => ({
  kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2, salaryMul: 1,
})
const attrsStress = (stress: number): GameState['attrs'] => ({ ...makeGame().attrs, stress })

function stressDriftOf(patch: Partial<GameState>): number {
  const s = makeGame(7, patch)
  return naturalAttrDrift(s, { next: () => 0 }).drift.stress ?? 0
}

describe('第 82 轮：压力恢复带', () => {
  it('A1 退休年双 −4−2：恢复带在场（stress 漂移 −6）', () => {
    expect(stressDriftOf({ age: 66, career: retired(), attrs: attrsStress(60) })).toBe(-6)
  })

  it('A1 有增量年不恢复：在职（+2）/待业（+4）/学生（+2）/零工（+1）', () => {
    expect(stressDriftOf({ age: 40, career: employed(), attrs: attrsStress(80) })).toBe(2)
    expect(stressDriftOf({ age: 40, career: { kind: 'unemployed', weeks: 3 }, attrs: attrsStress(80) })).toBe(4)
    expect(stressDriftOf({ age: 20, career: { kind: 'student', stage: 'college', yearsLeft: 2 }, attrs: attrsStress(80) })).toBe(2)
    expect(stressDriftOf({ age: 30, career: { kind: 'none' }, attrs: attrsStress(60) })).toBe(1)
  })

  it('A1 边界：55 不恢复（严格 >55），56 恢复；常量冻结', () => {
    expect(STRESS_RECOVERY_FLOOR).toBe(55)
    expect(STRESS_RECOVERY_RATE).toBe(2)
    expect(stressDriftOf({ age: 66, career: retired(), attrs: attrsStress(55) })).toBe(-4)
    expect(stressDriftOf({ age: 66, career: retired(), attrs: attrsStress(56) })).toBe(-6)
  })

  it('A1 与既有惩罚共存：≥80 健康侵蚀 −3 与 ≥70 幸福 −2 同年同在（45 岁无年龄健康曲线干扰）', () => {
    const { drift, notes } = naturalAttrDrift(makeGame(7, { age: 45, career: retired(), attrs: attrsStress(85) }), { next: () => 0 })
    expect(drift.stress).toBe(-6)
    expect(drift.health).toBe(-3)
    expect(drift.happiness).toBe(-2)
    expect(notes).toContain('长期高压开始侵蚀你的身体')
  })

  it('集成：退休年 70 → 64；burnout 借恢复带落入 <60 自动摘除', () => {
    const s = makeGame(7, { age: 66, career: retired(), money: 150000, attrs: attrsStress(70) })
    const after = advanceYear(s)
    expect(after.attrs.stress).toBe(64)
    const b = makeGame(7, { age: 66, career: retired(), money: 150000, attrs: attrsStress(58), tags: ['burnout'] })
    const afterB = advanceYear(b)
    expect(afterB.attrs.stress).toBe(52)
    expect(afterB.tags).not.toContain('burnout')
    expect(afterB.yearLog.join('\n')).toContain('压力终于落下来了')
  })
})
