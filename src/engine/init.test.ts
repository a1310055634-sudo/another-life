import { describe, it, expect } from 'vitest'
import { createNewGame, SAVE_VERSION } from './init'
import { validateState } from './validate'
import { mulberry32 } from './rng'
import { clampAttr, sanitizeMoney, applyEffects } from './attrs'
import { BACKGROUNDS } from '../data/backgrounds'
import { TRAITS } from '../data/traits'

describe('RNG', () => {
  it('同 seed 产出完全相同的序列', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同 seed 序列不同', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(
      Array.from({ length: 5 }, () => b.next()),
    )
  })

  it('int 在闭区间内', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('属性与金钱收敛', () => {
  it('clampAttr 限制在 0～100', () => {
    expect(clampAttr('health', -5)).toBe(0)
    expect(clampAttr('health', 150)).toBe(100)
    expect(clampAttr('health', 50.4)).toBe(50)
  })

  it('clampAttr 对 NaN/Infinity 给出中性值', () => {
    expect(clampAttr('health', NaN)).toBe(50)
    expect(clampAttr('stress', Infinity)).toBe(0)
  })

  it('sanitizeMoney 处理非法值与极端值', () => {
    expect(sanitizeMoney(NaN)).toBe(0)
    expect(sanitizeMoney(Infinity)).toBe(0) // 异常值归零，不给玩家横财
    expect(sanitizeMoney(-Infinity)).toBe(0)
    expect(sanitizeMoney(100.6)).toBe(101)
  })

  it('applyEffects 不修改原对象且收敛结果', () => {
    const attrs = { health: 95, happiness: 50, smarts: 50, social: 50, stress: 0 }
    const { attrs: next, money } = applyEffects(attrs, 1000, [
      { attr: 'health', delta: 20 },
      { attr: 'stress', delta: -30 },
      { money: -99999999 },
    ])
    expect(next.health).toBe(100)
    expect(next.stress).toBe(0)
    expect(money).toBe(-99998999)
    expect(attrs.health).toBe(95)
  })
})

describe('createNewGame', () => {
  it('同参数产出完全一致的初始状态', () => {
    const a = createNewGame({ seed: 2026, backgroundId: 'ordinary', traitId: 'studious', name: '测试' })
    const b = createNewGame({ seed: 2026, backgroundId: 'ordinary', traitId: 'studious', name: '测试' })
    expect(b).toEqual(a)
  })

  it('富裕家庭起始资金 20 万，农家子弟 300 元', () => {
    const rich = createNewGame({ seed: 1, backgroundId: 'wealthy', traitId: 'laid_back', name: 'A' })
    const poor = createNewGame({ seed: 1, backgroundId: 'rural', traitId: 'laid_back', name: 'B' })
    expect(rich.money).toBe(200000)
    expect(poor.money).toBe(300)
    expect(rich.tags).toContain('bg_wealthy')
    expect(poor.tags).toContain('hardworking')
  })

  it('特质修正叠加在背景之上且不越界', () => {
    const s = createNewGame({ seed: 3, backgroundId: 'rural', traitId: 'studious', name: 'C' })
    // rural smarts 60 + studious +8 = 68
    expect(s.attrs.smarts).toBe(68)
    // laid_back stress -15 不会为负：rural 30 + laid_back -15 = 15
    const l = createNewGame({ seed: 3, backgroundId: 'ordinary', traitId: 'laid_back', name: 'D' })
    expect(l.attrs.stress).toBe(5) // ordinary 20 - 15
  })

  it('单亲家庭只有母亲；其他家庭父母双全', () => {
    const sp = createNewGame({ seed: 9, backgroundId: 'single_parent', traitId: 'sociable', name: 'E' })
    expect(sp.relations.map((r) => r.id)).toEqual(['mother'])
    const or = createNewGame({ seed: 9, backgroundId: 'ordinary', traitId: 'sociable', name: 'F' })
    expect(or.relations).toHaveLength(2)
  })

  it('空名字时用 seed 随机姓名（确定性）', () => {
    const a = createNewGame({ seed: 77, backgroundId: 'ordinary', traitId: 'sociable' })
    const b = createNewGame({ seed: 77, backgroundId: 'ordinary', traitId: 'sociable' })
    expect(a.name.length).toBeGreaterThan(0)
    expect(a.name).toBe(b.name)
  })

  it('初始年龄 18、版本号、阶段 playing', () => {
    const s = createNewGame({ seed: 5, backgroundId: 'wealthy', traitId: 'ambitious', name: 'G' })
    expect(s.age).toBe(18)
    expect(s.version).toBe(SAVE_VERSION)
    expect(s.phase).toBe('playing')
  })

  it('全部背景×特质组合都能生成并通过校验', () => {
    for (const bg of BACKGROUNDS) {
      for (const tr of TRAITS) {
        const s = createNewGame({ seed: 100 + bg.id.length, backgroundId: bg.id, traitId: tr.id, name: 'X' })
        const { issues } = validateState(s)
        expect(issues).toEqual([])
      }
    }
  })
})

describe('validateState', () => {
  it('正常状态无问题', () => {
    const s = createNewGame({ seed: 11, backgroundId: 'ordinary', traitId: 'studious', name: 'H' })
    expect(validateState(s).issues).toEqual([])
  })

  it('属性越界被报告', () => {
    const s = createNewGame({ seed: 11, backgroundId: 'ordinary', traitId: 'studious', name: 'I' })
    s.attrs.health = 120
    s.attrs.smarts = -3
    const issues = validateState(s).issues
    expect(issues.map((i) => i.field)).toContain('attrs.health')
    expect(issues.map((i) => i.field)).toContain('attrs.smarts')
  })

  it('金钱 NaN 被报告并自动修复为有限值', () => {
    const s = createNewGame({ seed: 11, backgroundId: 'ordinary', traitId: 'studious', name: 'J' })
    ;(s as { money: number }).money = NaN
    const { issues } = validateState(s)
    expect(issues.map((i) => i.field)).toContain('money')
    expect(Number.isFinite(s.money)).toBe(true)
  })
})
