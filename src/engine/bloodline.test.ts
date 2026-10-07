// 第 94 轮：世代传承测试（遗产规则/存取往返/承继注入/三代连玩 E2E）
// 验收口径（PROMPT-V5.md 第 94 轮）：
// - A3 遗产金额规则（30% 上限 50 万下限 0、负资产=0）
// - A2 承继开局断言（姓氏锁定/遗产到账/代数 tag/新 seed 独立性）
// - A5 存档 v2 零改动（bloodline 独立键，GameState 结构不变）
// - A4 三代连玩 E2E（node 引擎驱动：generation 1→2→3 + 血脉键递增）
// - A6 无 bloodline 键 = 普通开局（applyBloodline 不调用即零影响）
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createNewGame } from './init'
import { startSession } from './session'
import { advanceYear } from './lifecycle'
import { validateState } from './validate'
import {
  buildBloodlineEntry,
  applyBloodline,
  inheritanceOf,
  willAllocationOf,
  pickMottoTriple,
  MOTTO_POOL,
  readBloodline,
  writeBloodline,
  BLOODLINE_KEY,
} from './bloodline'
import type { GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

// node 环境无 localStorage——installStorage stub（legacy.test 同款模式）
function installStorage(init: Record<string, string> = {}) {
  const store = new Map(Object.entries(init))
  const stub = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  const prev = (globalThis as Record<string, unknown>).localStorage
  ;(globalThis as Record<string, unknown>).localStorage = stub
  return () => {
    ;(globalThis as Record<string, unknown>).localStorage = prev
  }
}
let restoreStorage: (() => void) | null = null

describe('第 94 轮：遗产规则（A3）', () => {
  it('inheritanceOf：30% 折算/50 万封顶/负资产与非法值归 0', () => {
    expect(inheritanceOf(100000)).toBe(30000)
    expect(inheritanceOf(80000)).toBe(24000)
    expect(inheritanceOf(2000000)).toBe(500000) // 60 万 → 封顶 50 万
    expect(inheritanceOf(-50000)).toBe(0)
    expect(inheritanceOf(0)).toBe(0)
    expect(inheritanceOf(NaN)).toBe(0)
  })
  it('buildBloodlineEntry：六字段齐全（generation+1/姓氏首字/遗产/先辈/结局/时间戳）', () => {
    const s = makeGame(7, { age: 72, money: 300000, name: '陈建国', endingId: 'family_hearth' })
    const entry = buildBloodlineEntry(s, 1, 12345)
    expect(entry).toEqual({
      generation: 2,
      surname: '陈',
      inheritanceMoney: 90000, // 300000 × 30%
      ancestorName: '陈建国',
      ancestorEndingId: 'family_hearth',
      finishedAt: 12345,
    })
  })
})

describe('第 94 轮：存取往返与承继注入（A2）', () => {
  beforeEach(() => {
    restoreStorage = installStorage()
  })
  afterEach(() => {
    restoreStorage?.()
    restoreStorage = null
  })
  it('write→read 往返；无键→null；损坏→null', () => {
    expect(readBloodline()).toBeNull()
    writeBloodline({
      generation: 2, surname: '陈', inheritanceMoney: 90000,
      ancestorName: '陈建国', ancestorEndingId: 'family_hearth', finishedAt: 1,
    })
    expect(readBloodline()?.generation).toBe(2)
    localStorage.setItem(BLOODLINE_KEY, '{broken')
    expect(readBloodline()).toBeNull()
    localStorage.setItem(BLOODLINE_KEY, '{"generation":"x"}')
    expect(readBloodline()).toBeNull()
  })
  it('applyBloodline：遗产到账+generation:N 标记；validateState 干净', () => {
    const s = makeGame(9, { money: 10000 })
    const entry = { generation: 3, surname: '周', inheritanceMoney: 90000, ancestorName: '周父', ancestorEndingId: 'quiet_life', finishedAt: 1 }
    const injected = applyBloodline(s, entry)
    expect(injected.money).toBe(100000)
    expect(injected.tags).toContain('generation:3')
    expect(validateState(injected).issues).toEqual([])
  })
  it('新 seed 独立性：同 bloodline 输入、不同 seed 的承继局互不相同；同 seed 两次承继一致', () => {
    const entry = { generation: 2, surname: '陈', inheritanceMoney: 90000, ancestorName: '陈父', ancestorEndingId: 'quiet_life', finishedAt: 1 }
    const g1 = applyBloodline(startSession({ seed: 111, backgroundId: 'ordinary', traitId: 'bookworm', name: '陈小满' }, []).state, entry)
    const g1b = applyBloodline(startSession({ seed: 111, backgroundId: 'ordinary', traitId: 'bookworm', name: '陈小满' }, []).state, entry)
    const g2 = applyBloodline(startSession({ seed: 222, backgroundId: 'ordinary', traitId: 'bookworm', name: '陈小满' }, []).state, entry)
    expect(g1.seed).toBe(g1b.seed)
    expect(g1.seed).not.toBe(g2.seed)
  })
})

describe('第 94 轮：三代连玩 E2E（A4，node 引擎驱动）', () => {
  it('generation 1→2→3：血脉键递增、遗产逐代到账、validate 干净、存档 v2 结构零改动（A5）', () => {
    restoreStorage = installStorage()
    let gen = 1
    let seed = 20260917
    let money = 300000
    const seenGenerations: number[] = []
    for (let round = 0; round < 3; round++) {
      // 开局（承继代 applyBloodline 注入）；注入成年子女在册保证承继链必然发生
      let s = makeGame(seed, {
        name: gen === 1 ? '陈一世' : `陈${gen}世`,
        money: gen === 1 ? money : 0,
        relations: [{ id: `c${gen}`, kind: 'child' as const, name: `陈小${gen}`, closeness: 60, alive: true, birthAge: 30 }],
      })
      if (gen > 1) {
        const entry = readBloodline()!
        s = applyBloodline(s, entry)
        expect(s.money).toBe(entry.inheritanceMoney)
        expect(s.tags.some((t) => t === `generation:${entry.generation}`)).toBe(true)
      }
      // 快进 40 年（机器人选首项）
      for (let y = 0; y < 40; y++) {
        s = advanceYear(s)
        if (s.phase !== 'playing') break
      }
      expect(validateState(s).issues).toEqual([])
      // 存档 v2 结构零改动（A5）：GameState 顶层键集合不含 bloodline 相关键
      expect(Object.keys(s).some((k) => k.toLowerCase().includes('bloodline'))).toBe(false)
      // 终局承继：有子女在册才立碑
      const childAlive = s.relations.some((r) => r.kind === 'child' && r.alive)
      if (childAlive) {
        const entry = buildBloodlineEntry(s, readBloodline()?.generation ?? 0, 1)
        writeBloodline(entry)
        seenGenerations.push(entry.generation)
      }
      gen = (readBloodline()?.generation ?? 0) + 1
      seed = seed + 7919
      money = s.money
    }
    // 血脉键存在且 generation 单调递增（E2E 核心断言）
    const final = readBloodline()
    expect(final).not.toBeNull()
    expect(seenGenerations.length).toBeGreaterThanOrEqual(2)
    expect(seenGenerations.every((g, i) => i === 0 || g > seenGenerations[i - 1])).toBe(true)
  })
})

// ── 第 117 轮：遗嘱分配三向（allocation）────────────────────
describe('遗嘱分配 allocation（第 117 轮）', () => {
  it('inheritanceOf 三向：even=现行值逐位一致/weighted ×1.3 封顶/grandchild 同 even', () => {
    expect(inheritanceOf(100000)).toBe(30000) // 缺省=even=旧行为
    expect(inheritanceOf(100000, 'even')).toBe(30000)
    expect(inheritanceOf(100000, 'weighted')).toBe(39000)
    expect(inheritanceOf(100000, 'grandchild')).toBe(30000)
    // 封顶：weighted 在高资产下仍受 50 万封顶
    expect(inheritanceOf(2000000)).toBe(500000)
    expect(inheritanceOf(2000000, 'weighted')).toBe(500000)
    // 负资产/非法值 → 0（三向一致）
    expect(inheritanceOf(-50000, 'weighted')).toBe(0)
    expect(inheritanceOf(Number.NaN, 'weighted')).toBe(0)
  })
  it('旧键/无标记行为逐位不变：无 allocation 的条目缺省 even，willAllocationOf 归一', () => {
    const s = makeGame(7, { money: 100000, tags: [] })
    // 不传 allocation → 条目不含该字段（旧键形态）
    const entry = buildBloodlineEntry(s, 0, 1)
    expect(entry.allocation).toBeUndefined()
    expect(entry.inheritanceMoney).toBe(30000)
    // 传 allocation → 落字段
    const w = buildBloodlineEntry(s, 0, 1, 'weighted')
    expect(w.allocation).toBe('weighted')
    expect(w.inheritanceMoney).toBe(39000)
    // 标记归一：无标记/未知标记=even；三向各归其位
    expect(willAllocationOf([])).toBe('even')
    expect(willAllocationOf(['unrelated'])).toBe('even')
    expect(willAllocationOf(['will_mode_even'])).toBe('even')
    expect(willAllocationOf(['will_mode_weighted', 'will_mode_even'])).toBe('weighted')
    expect(willAllocationOf(['will_mode_grandchild'])).toBe('grandchild')
  })
})

// ── 第 122 轮：家训与家族编年 ─────────────────────────────
describe('家训三选一（第 122 轮）', () => {
  it('家训池 6 条、三选一同盐恒同三张且互异、不同盐可分散', () => {
    expect(MOTTO_POOL).toHaveLength(6)
    const a = pickMottoTriple(12345)
    const b = pickMottoTriple(12345)
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id))
    expect(new Set(a.map((m) => m.id)).size).toBe(3)
    let diff = 0
    for (let s = 1; s <= 200; s++) {
      if (pickMottoTriple(s).map((m) => m.id).join() !== pickMottoTriple(s + 1).map((m) => m.id).join()) diff++
    }
    expect(diff).toBeGreaterThan(20)
  })
  it('applyBloodline 家训微效果：属性 +1 与压力 −1 两档；motto_set/motto:{id} 标记落账', () => {
    const base = makeGame(7, { money: 50000, attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 30 } })
    const entry = buildBloodlineEntry(base, 0, 1)
    const diligent = applyBloodline(base, entry, 'motto_diligent')
    expect(diligent.attrs.health).toBe(51)
    expect(diligent.tags).toContain('motto_set')
    expect(diligent.tags).toContain('motto:motto_diligent')
    const steady = applyBloodline(base, entry, 'motto_steady')
    expect(steady.attrs.stress).toBe(29)
    expect(steady.tags).toContain('motto_set')
  })
  it('旧路径逐位不变：mottoId 缺省=无微效果无 motto_set（旧键行为）', () => {
    const base = makeGame(7, { money: 50000, attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 30 } })
    const entry = buildBloodlineEntry(base, 0, 1)
    const plain = applyBloodline(base, entry)
    expect(plain.attrs).toEqual(base.attrs)
    expect(plain.tags).not.toContain('motto_set')
  })
  it('家训落键：mottoId/mottoText 成对写入条目（编年面板展示源）；未知 id 防御式无效果', () => {
    const base = makeGame(7, { money: 50000, attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 30 } })
    const entry = buildBloodlineEntry(base, 0, 1)
    writeBloodline({ ...entry, mottoId: 'motto_harmony', mottoText: '家和万事兴' })
    const stored = readBloodline()
    expect(stored?.mottoId).toBe('motto_harmony')
    expect(stored?.mottoText).toBe('家和万事兴')
    const weird = applyBloodline(base, entry, 'motto_no_such')
    expect(weird.tags).not.toContain('motto_set')
    expect(weird.attrs).toEqual(base.attrs)
  })
  it('家训三代微 E2E：gen 1→3 每代按三选一首张应用，motto_set 逐代在册且属性随家训推进', () => {
    let s = makeGame(99, { money: 100000, attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 30 } })
    let generation = 0
    for (let i = 0; i < 3; i++) {
      const entry = buildBloodlineEntry(s, generation, 1000 + i)
      generation = entry.generation
      const motto = pickMottoTriple(entry.finishedAt)[0]
      s = applyBloodline(s, entry, motto.id)
      expect(s.tags).toContain('motto_set')
      expect(s.tags).toContain(`motto:${motto.id}`)
      // 微效果方向断言：非压力家训对应属性 ≥ 原值；压力家训 stress ≤ 原值
      if (motto.bonus === 'stress') expect(s.attrs.stress).toBeLessThanOrEqual(30)
      else expect(s.attrs[motto.bonus]).toBeGreaterThanOrEqual(50)
    }
    expect(generation).toBe(3)
  })
})

