import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear, canAdvance, baseYearFinance } from './lifecycle'
import { checkLifeEnd, DEFAULT_MAX_AGE } from './outcomes'
import { validateState } from './validate'
import type { GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' })
  return { ...base, ...patch }
}

function makeEmployed(salary: number): GameState {
  return makeGame(7, {
    career: { kind: 'employed', jobId: 'clerk', jobTitle: '职员', level: 1, salary, yearsAtJob: 0 },
    age: 25,
  })
}

describe('advanceYear 基础', () => {
  it('年龄 +1，状态保持合法', () => {
    const s = makeGame()
    const next = advanceYear(s)
    expect(next.age).toBe(s.age + 1)
    expect(validateState(next).issues).toEqual([])
  })

  it('纯函数：不修改传入状态', () => {
    const s = makeGame()
    const snapshot = JSON.stringify(s)
    advanceYear(s)
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('同 seed 推进结果可复现', () => {
    const a = advanceYear(makeGame(99))
    const b = advanceYear(makeGame(99))
    expect(b).toEqual(a)
  })

  it('已结束状态推进是 no-op（防重复推进）', () => {
    const s = makeGame(5, { phase: 'ended', endingId: 'natural_end' })
    const before = JSON.stringify(s)
    expect(advanceYear(s)).toBe(s)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('canAdvance 守卫', () => {
    expect(canAdvance(makeGame())).toBe(true)
    expect(canAdvance(makeGame(1, { phase: 'ended' }))).toBe(false)
  })
})

describe('财务结算', () => {
  it('就业者收入大于开支时金钱增长', () => {
    const s = makeEmployed(120000)
    const next = advanceYear(s)
    expect(next.money).toBeGreaterThan(s.money)
    expect(next.yearLog.some((l) => l.includes('收入'))).toBe(true)
    expect(next.yearLog.some((l) => l.includes('支出'))).toBe(true)
  })

  it('低能力零工：青年期勉强糊口，26 岁后开销上涨转入持续负债', () => {
    // 低能力零工收入 21,300（含技能 +300）；青年支出 20,000 尚可 +1,300/年，
    // 26 岁起基础生活费涨到 26,000 → 净 -4,700/年，积蓄耗尽后进入负债
    let s = makeGame(11, {
      money: 10000,
      career: { kind: 'none' },
      attrs: { health: 65, happiness: 60, smarts: 10, social: 50, stress: 20 },
    })
    let guard = 0
    while (s.money >= 0 && guard < 30) {
      s = advanceYear(s)
      guard++
    }
    expect(s.money).toBeLessThan(0)
    expect(s.age).toBeGreaterThanOrEqual(26)
    expect(validateState(s).issues).toEqual([])
  })

  it('学生没钱也会负债但不崩溃', () => {
    const s = makeGame(12, {
      money: 0,
      career: { kind: 'student', stage: 'college', yearsLeft: 4 },
    })
    const next = advanceYear(s)
    expect(next.money).toBeLessThan(0)
    expect(Number.isFinite(next.money)).toBe(true)
  })

  it('退休者靠养老金生活', () => {
    const s = makeGame(13, {
      age: 66,
      career: { kind: 'retired', pension: 40000 },
      money: 50000,
    })
    const next = advanceYear(s)
    expect(next.money).toBeGreaterThan(40000) // 50000 + 40000±8% - 28000
    expect(next.money).toBeLessThan(80000)
  })

  it('无职业者有零工收入，随教育、能力与职业技能上浮且无波动', () => {
    const low = makeGame(41, { attrs: { health: 65, happiness: 60, smarts: 20, social: 50, stress: 20 } })
    const high = makeGame(42, {
      education: 'college',
      attrs: { health: 65, happiness: 60, smarts: 70, social: 50, stress: 20 },
    })
    const fLow = baseYearFinance(low, { next: () => 0.99 })
    const fHigh = baseYearFinance(high, { next: () => 0.99 })
    // 低能力：20000 + 0 + 技能300 + (20/5)*500 = 22300；高能力大专：20000 + 6000 + 300 + 7000 = 33300
    expect(fLow.income).toBe(22300)
    expect(fHigh.income).toBe(33300)
    // rng.next 拉到极值也不波动（零工收入按日结算、总额平稳）
    expect(baseYearFinance(low, { next: () => 0 }).income).toBe(22300)
    expect(baseYearFinance(low, { next: () => 1 }).income).toBe(22300)
  })

  it('baseYearFinance 波动保持在 ±8% 内', () => {
    const s = makeEmployed(100000)
    for (let i = 0; i < 50; i++) {
      const f = baseYearFinance(s, {
        next: () => i / 50,
      } as { next(): number })
      expect(f.income).toBeGreaterThanOrEqual(92000)
      expect(f.income).toBeLessThanOrEqual(108000)
    }
  })
})

describe('自然属性变化', () => {
  it('高压状态侵蚀健康并记录附注', () => {
    const s = makeGame(21, { attrs: { health: 80, happiness: 60, smarts: 50, social: 50, stress: 85 } })
    const next = advanceYear(s)
    expect(next.attrs.health).toBeLessThan(80)
    expect(next.yearLog.some((l) => l.includes('高压'))).toBe(true)
  })

  it('负债降低幸福并提升压力', () => {
    const s = makeGame(22, { money: -50000, attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 } })
    const next = advanceYear(s)
    expect(next.attrs.happiness).toBeLessThan(60)
    expect(next.attrs.stress).toBeGreaterThan(20)
  })
})

describe('延迟效果', () => {
  it('到期后生效并从挂起列表移除', () => {
    const s = makeGame(31, {
      age: 20,
      attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 10 },
      pending: [
        { id: 'p1', dueAge: 22, attr: 'smarts', delta: 10, summary: '多年积累终于兑现' },
        { id: 'p2', dueAge: 30, money: 50000 },
      ],
    })
    const y1 = advanceYear(s) // 21 岁：未到期
    expect(y1.pending).toHaveLength(2)
    expect(y1.attrs.smarts).toBe(50)
    const y2 = advanceYear(y1) // 22 岁：p1 生效
    expect(y2.attrs.smarts).toBe(60)
    expect(y2.pending).toHaveLength(1)
    expect(y2.yearLog.some((l) => l.includes('兑现'))).toBe(true)
    // 推到 30 岁：p2 生效。收入 = 20000 + 技能 300 + (能力/5)×500，能力用上一年末值；
    // 开支按年龄分层（≤25 岁 20,000，26 岁起 26,000）。
    // 21/22 岁能力 50 → +5,300/年；22 岁 p1 生效后 23 岁起能力 60 → +6,300/年（≤25）、
    // 26 岁起 +300/年。3000 + 5300×2 + 6300×3 + 300×4 + (300+50000) = 84000
    // （利息按年初余额计，年初最高 33,700 < 10 万，全程无利息）
    let cur = y2
    while (cur.age < 30) cur = advanceYear(cur)
    expect(cur.pending).toHaveLength(0)
    expect(cur.money).toBe(84000)
  })

  it('延迟标签写入 tags', () => {
    const s = makeGame(32, {
      age: 20,
      pending: [{ id: 'p3', dueAge: 21, addTags: ['woke_up'] }],
    })
    const next = advanceYear(s)
    expect(next.tags).toContain('woke_up')
  })

  it('延迟效果的 summary 同样替换 {name} 占位符（第 10 轮回归）', () => {
    const s = makeGame(35, {
      age: 20,
      pending: [{ id: 'p4', dueAge: 21, money: 1000, summary: '给{name}的回款到账' }],
    })
    const next = advanceYear(s)
    expect(next.yearLog.some((l) => l.includes('给测试者的回款到账'))).toBe(true)
    expect(next.yearLog.some((l) => l.includes('{name}'))).toBe(false)
  })
})

describe('结束检查', () => {
  it('健康归零触发死亡结局', () => {
    const s = makeGame(41, { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 }, age: 30 })
    const next = advanceYear(s)
    expect(next.phase).toBe('ended')
    expect(next.endingId).toBe('death_young')
  })

  it('达到最大年龄自然终局（DEFAULT_MAX_AGE=77，对齐 SPEC §1）', () => {
    const s = makeGame(42, { age: 76, attrs: { health: 90, happiness: 50, smarts: 50, social: 50, stress: 0 } })
    const next = advanceYear(s)
    expect(next.phase).toBe('ended')
    expect(next.endingId).toBe('natural_end')
    expect(next.age).toBe(77)
  })

  it('终局年龄单一来源：advanceYear 默认上限与 checkLifeEnd 一致（77）', () => {
    const s = makeGame(44, { age: 76, attrs: { health: 90, happiness: 50, smarts: 50, social: 50, stress: 0 } })
    expect(checkLifeEnd(s)).toBeNull() // 76 岁尚未到终局
    expect(checkLifeEnd({ ...s, age: DEFAULT_MAX_AGE })).toBe('natural_end')
    expect(advanceYear(s).age).toBe(DEFAULT_MAX_AGE) // 默认上限从同一常量取值
  })

  it('自定义 maxAge 生效', () => {
    const s = makeGame(43, { age: 30 })
    const next = advanceYear(s, { maxAge: 31 })
    expect(next.phase).toBe('ended')
    expect(next.endingId).toBe('natural_end')
  })
})

describe('连续推进到自然终局无非法值、无卡住', () => {
  it('从 18 岁推到终局，每一年状态合法', () => {
    let s = makeGame(2077)
    let steps = 0
    while (s.phase === 'playing' && steps < 100) {
      s = advanceYear(s)
      steps++
      const { issues } = validateState(s)
      expect(issues).toEqual([])
      for (const v of Object.values(s.attrs)) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
      expect(Number.isFinite(s.money)).toBe(true)
    }
    expect(s.phase).toBe('ended')
    expect(steps).toBeLessThanOrEqual(DEFAULT_MAX_AGE - 18)
  })

  it('负债玩家推到终局不会出现无法恢复的 NaN', () => {
    let s = makeGame(88, { money: -200000 })
    let steps = 0
    while (s.phase === 'playing' && steps < 100) {
      s = advanceYear(s)
      steps++
      expect(Number.isFinite(s.money)).toBe(true)
    }
    expect(s.phase).toBe('ended')
  })

  it('ended 后继续推进 10 次状态不变', () => {
    let s = makeGame(66)
    while (s.phase === 'playing') s = advanceYear(s)
    const ended = JSON.stringify(s)
    for (let i = 0; i < 10; i++) s = advanceYear(s)
    expect(JSON.stringify(s)).toBe(ended)
  })
})
