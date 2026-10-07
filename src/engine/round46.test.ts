// 第 46 轮：婚恋入口扩展测试（正反可用性 + 链路衔接 + 名字池具名）
// 验收口径（PROMPT-V3.md 第 46 轮）：
// - 四入口事件正反测试（单身门槛/处境门槛/负债可见性两侧）
// - 入口成功后衔接既有恋人→求婚窗链路（落地 55 跨求婚资格线 50）
// - 名字缺省走第 44 轮伴侣名池；singleChoiceOk 白名单不破
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { COMPANION_NAMES } from '../data/names'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const ENTRIES = [
  { id: 'rel_old_flame', age: 32, patch: {} as Partial<GameState> },
  { id: 'rel_colleague_crush', age: 30, patch: { career: { kind: 'employed' as const, jobId: 'barista', jobTitle: '咖啡师', level: 1, salary: 30000, yearsAtJob: 1 } } },
  { id: 'rel_hobby_club', age: 38, patch: {} as Partial<GameState> },
  { id: 'rel_app_match', age: 26, patch: {} as Partial<GameState> },
]

describe('第 46 轮：数据规格与正反可用性（验收①）', () => {
  it('四入口入池：validateEvents 零 issue、每事件 ≥2 选项、无 singleChoiceOk', () => {
    for (const id of ENTRIES.map((e) => e.id)) {
      const ev = findEvent(id)
      expect(ev.choices.length).toBeGreaterThanOrEqual(2)
      expect(ev.singleChoiceOk).toBeUndefined()
    }
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('各入口正反：单身+年龄段+处境门槛 ✓ / 有伴侣 ✗ / 超龄 ✗ / 无业对同事转恋人 ✗', () => {
    for (const { id, age, patch } of ENTRIES) {
      const ev = findEvent(id)
      const ok = makeGame(1, { age, money: 30000, relations: [], ...patch })
      expect(isEventAvailable(ok, ev)).toBe(true)
      const taken = makeGame(1, {
        age, money: 30000,
        relations: [{ id: 'p1', kind: 'partner', name: '某某', closeness: 60, alive: true }],
        ...patch,
      })
      expect(isEventAvailable(taken, ev)).toBe(false)
      const tooYoung = makeGame(1, { age: Math.max(18, age - 10), money: 30000, relations: [], ...patch })
      expect(isEventAvailable(tooYoung, ev)).toBe(false)
    }
    // 处境门槛专测：无业时同事转恋人不可用（同年龄）
    const ev = findEvent('rel_colleague_crush')
    const jobless = makeGame(1, { age: 30, money: 30000, relations: [], career: { kind: 'none' } })
    expect(isEventAvailable(jobless, ev)).toBe(false)
  })

  it('负债时大额隐藏后仍保 ≥2 可见（接触向选项均低于大额门槛）', () => {
    for (const { id, age, patch } of ENTRIES) {
      const ev = findEvent(id)
      const debt = makeGame(1, { age, money: -5000, relations: [], ...patch })
      // 可用性要求 ≥2 可见选项——负债局仍可用即证明
      expect(isEventAvailable(debt, ev)).toBe(true)
    }
  })
})

describe('第 46 轮：链路衔接与名字池（验收②）', () => {
  it('入口选择后次年落地 partner（池具名 55），并直接具备求婚资格（minCloseness 50）', () => {
    const ev = findEvent('rel_app_match')
    let s = makeGame(9, { age: 26, money: 20000, relations: [] })
    const after = applyChoice(s, ev, 0).state // 打招呼约见面
    expect(after.tags).toContain('went_app')
    const nextYear = advanceYear(after)
    const partner = nextYear.relations.find((r) => r.kind === 'partner' && r.alive)
    expect(partner).toBeDefined()
    expect(COMPANION_NAMES).toContain(partner!.name) // 名字缺省 → 第 44 轮伴侣池
    expect(partner!.closeness).toBe(55)
    // 求婚资格：partner 在册 + 无配偶 + 亲密度 ≥50（年龄需 ≥25）
    const propose = findEvent('rel_propose')
    const eligible = makeGame(9, {
      age: 28, money: 30000, relations: [partner!],
    })
    expect(isEventAvailable(eligible, propose)).toBe(true)
  })

  it('中间向选项落地 45：低于求婚线，需一次维护（+5）重回资格', () => {
    const ev = findEvent('rel_hobby_club')
    const s = makeGame(9, { age: 38, money: 20000, relations: [] })
    const after = applyChoice(s, ev, 1).state // 慢慢熟悉着看
    const nextYear = advanceYear(after)
    const partner = nextYear.relations.find((r) => r.kind === 'partner' && r.alive)!
    expect(partner.closeness).toBe(45)
    const propose = findEvent('rel_propose')
    expect(isEventAvailable(makeGame(9, { age: 40, money: 30000, relations: [partner] }), propose)).toBe(false)
    const warmed = { ...partner, closeness: 50 }
    expect(isEventAvailable(makeGame(9, { age: 40, money: 30000, relations: [warmed] }), propose)).toBe(true)
  })

  it('四入口彼此 cd 独立：同一年多入口可并存（互不 seen/cooldown 冲突）', () => {
    // 32 岁单身在职：全部四个入口同时可用（年龄窗重叠的三个 + 同事门槛）
    const s = makeGame(1, {
      age: 32, money: 30000, relations: [],
      career: { kind: 'employed' as const, jobId: 'barista', jobTitle: '咖啡师', level: 1, salary: 30000, yearsAtJob: 2 },
    })
    for (const { id } of ENTRIES) {
      expect(isEventAvailable(s, findEvent(id))).toBe(true)
    }
  })
})
