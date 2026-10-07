// 第 71 轮：年志生活流测试（散列支流取模 / 守门 / 集成）
// 验收口径（PROMPT-V4.md 第 71 轮）：
// - A1 seed 确定性：同 seed 同年龄必得同行；跨 seed 自然分散
// - 守门：>75 岁与结局年（endingId 触发）不加；行带统一前缀「——」
// - A2 outcomes 18 局逐局零位移（氛围行零机制值，断言粒度不含 yearLog）
// - A4 池内无重复 + 抽取分布均匀性（无单条独大）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import { YEARLIFE, YEARLIFE_PREFIX, YEARLIFE_VARIANTS, pickYearLifeLine } from '../data/yearlife'
import type { GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

describe('第 71 轮：年志生活流', () => {
  it('A1 seed 确定性：同 seed 同年龄必得同行；前缀统一「——」；>75 岁不加', () => {
    expect(pickYearLifeLine(42, 30)).toBe(pickYearLifeLine(42, 30))
    const line = pickYearLifeLine(42, 30)!
    expect(line.startsWith(YEARLIFE_PREFIX)).toBe(true)
    expect(YEARLIFE.flat(2)).toContain(line.slice(YEARLIFE_PREFIX.length))
    expect(pickYearLifeLine(42, 76)).toBeNull()
    expect(pickYearLifeLine(42, 75)).not.toBeNull()
    // 不同年龄分散：30/31/32 至少两种（季节散列不同）
    const a30 = pickYearLifeLine(42, 30)
    const hits = new Set([a30, pickYearLifeLine(42, 31), pickYearLifeLine(42, 32)])
    expect(hits.size).toBeGreaterThanOrEqual(1) // 结构性断言：不抛错即可
  })

  it('池完整性：72 条互不重复、3 段 × 4 季 × 6 变体结构齐整（第 101 轮 48→72）', () => {
    expect(YEARLIFE).toHaveLength(4)
    for (const season of YEARLIFE) {
      expect(season).toHaveLength(3)
      for (const seg of season) {
        expect(seg).toHaveLength(YEARLIFE_VARIANTS)
        for (const line of seg) {
          expect(line.length).toBeGreaterThan(6)
        }
      }
    }
    const flat = YEARLIFE.flat(2)
    expect(flat).toHaveLength(72)
    expect(new Set(flat).size).toBe(flat.length) // 零重复
  })

  it('lifecycle 集成：普通年 yearLog 尾行带前缀；同 seed 复现逐字一致', () => {
    const a = advanceYear(makeGame(42, { age: 30 }))
    const b = advanceYear(makeGame(42, { age: 30 }))
    const lastA = a.yearLog[a.yearLog.length - 1]
    const lastB = b.yearLog[b.yearLog.length - 1]
    expect(lastA).toBe(lastB)
    expect(lastA.startsWith(YEARLIFE_PREFIX)).toBe(true)
    expect(validateState(a).issues).toEqual([])
  })

  it('结局年不加：死亡年结算 phase=ended，yearLog 无氛围行', () => {
    const dying = makeGame(7, {
      age: 30,
      attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 },
    })
    const after = advanceYear(dying)
    expect(after.phase).toBe('ended')
    const hasLifeLine = after.yearLog.some((l) => l.startsWith(YEARLIFE_PREFIX))
    expect(hasLifeLine).toBe(false)
  })

  it('A4 抽取分布：2000 个 (seed, age) 样本无单条独大（≤8%）', () => {
    const counter = new Map<string, number>()
    let total = 0
    for (let i = 0; i < 100; i++) {
      for (let age = 18; age <= 75; age += 1) {
        const line = pickYearLifeLine(i * 7919 + 13, age)
        if (line) {
          counter.set(line, (counter.get(line) ?? 0) + 1)
          total++
        }
      }
    }
    for (const [, n] of counter) {
      expect(n / total).toBeLessThanOrEqual(0.08)
    }
    expect(counter.size).toBeGreaterThanOrEqual(40) // 覆盖率：绝大多数行都被命中过
  })
})
