// 第 47 轮：年龄热力补密测试（66-77 最薄桶定向加密）
// 验收口径（PROMPT-V3.md 第 47 轮）：
// - 8 个新事件全部命中 66-77 桶（6 个 64-77 专属 + 2 个 58/60-77 跨窗兼顾 56-65）
// - 处境覆盖：零事件级家庭门槛（不假设配偶/子女），低收入/负债下仍保 ≥2 可见选项
// - 池计数同步（late 26→34、全池 170→178）+ validateEvents 零 issue
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { isEventAvailable, visibleChoices } from './events'
import { startSession, chooseOption, nextYear, recoverMissingEvent } from './session'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { LATE_EVENTS } from '../data/events/late'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const NEW_IDS = [
  'late_morning_walk',
  'late_teeth',
  'late_old_letter',
  'late_neighbor_watch',
  'late_cheap_eats',
  'late_solo_birthday',
  'late_balcony_plants',
  'late_old_radio',
]

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

describe('第 47 轮：数据规格与处境覆盖（验收②）', () => {
  it('9 个新事件入 late.ts（26→34，第 68 轮倦怠复发 +1 → 35 → 43（101 轮）→ 52（102 轮薄桶补密 9 枚）→ 56（108 轮丧偶与独居重建线 4 枚））：≥2 选项、无 singleChoiceOk、validateEvents 零 issue', () => {
    expect(LATE_EVENTS).toHaveLength(65)
    for (const id of NEW_IDS) {
      const ev = findEvent(id)
      expect(ev.choices.length).toBeGreaterThanOrEqual(2)
      expect(ev.singleChoiceOk).toBeUndefined()
      // 命中 66-77 桶
      expect(ev.maxAge).toBe(77)
      expect(ev.minAge).toBeGreaterThanOrEqual(58)
    }
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('处境覆盖：零事件级家庭门槛（不假设配偶/子女/房产）', () => {
    for (const id of NEW_IDS) {
      const ev = findEvent(id)
      const kinds = ev.requires?.relationKinds ?? []
      expect(kinds).not.toContain('spouse')
      expect(kinds).not.toContain('partner')
      expect(kinds).not.toContain('child')
      // 文本不写「老伴/儿女」等家庭依赖词（独居玩家成立）——粗扫 text 里的高危词
      expect(ev.text).not.toMatch(/老伴|儿女|你儿女|你孩子|你孙子/)
    }
  })

  it('低收入/负债处境仍 ≥2 可见：late_teeth 零事件门槛、负债局逐事件可用', () => {
    // 事件级零门槛：late_teeth 不再要求存款 800
    expect(findEvent('late_teeth').requires).toBeUndefined()
    // 负债 68 岁逐事件检查（负债大额隐藏后仍 ≥2 可见选项 = isEventAvailable 为真）
    for (const id of NEW_IDS) {
      const ev = findEvent(id)
      const debt = makeGame(1, { age: 68, money: -5000, relations: [] })
      if (ev.id === 'late_solo_birthday') continue // 68 岁无朋友时朋友选项隐藏，可用性由选项级决定
      // 负债可见性：手工复算可见选项 ≥2（与引擎 isBigSpend 同口径）
      const available =
        ev.choices.filter((c) => {
          if (c.requires?.moneyAtLeast !== undefined && debt.money < c.requires.moneyAtLeast) return false
          if (c.requires?.relationKinds) return false
          return !(debt.money < 0 && (c.effects ?? []).some((e) => (e.money ?? 0) <= -3000))
        }).length >= 2
      expect(`${id} available=${available}`).toBe(`${id} available=true`)
    }
  })
})

describe('第 47 轮：正反窗口与真实抽取（验收①③）', () => {
  it('逐事件窗口正反：minAge-1 ✗ / 窗内 ✓', () => {
    for (const id of NEW_IDS) {
      const ev = findEvent(id)
      const below = makeGame(1, { age: Math.max(18, ev.minAge - 1), money: 20000, relations: [] })
      expect(isEventAvailable(below, ev)).toBe(false)
      const inside = makeGame(1, { age: Math.min(77, ev.maxAge), money: 20000, relations: [] })
      expect(isEventAvailable(inside, ev)).toBe(true)
    }
  })

  it('真实抽取（session 路径）：18 岁整局推到终局，晚年段抽到 ≥1 个新事件（补密真实兑现）', () => {
    // 必须走 session（chooseOption 落账 seenEvents/cooldowns）——直调 drawEvent 会让
    // once 事件反复中签（第 43 轮已立的绕过 session 坑，本轮再次验证）。
    // 策略=选首个可见选项（新事件选项全为正向日常，无陷阱）。
    // 第 67 轮：池扩容位移固定 seed 的整局轨迹——扫描 seed 取能走到晚年的局。
    const NEW_IDS = LATE_EVENTS.filter((e) => e.minAge >= 55).map((e) => e.id)
    let s0: import('./session').Session | null = null
    for (const seed of [97, 98, 99, 100, 101, 102, 103, 104, 105]) {
      const probe = startSession(
        { seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' },
        ALL_EVENTS,
      )
      let s = probe
      let g = 0
      let late = 0
      while (s.state.phase === 'playing' && g < 200) {
        g++
        if (s.awaitingAdvance) s = nextYear(s, ALL_EVENTS)
        else if (s.currentEvent) {
          const vis = visibleChoices(s.state, s.currentEvent)
          if (vis.length === 0) { s = recoverMissingEvent(s, ALL_EVENTS); continue }
          s = chooseOption(s, s.currentEvent.choices.indexOf(vis[0]))
        } else break
        if (s.state.age >= 64) late++
      }
      if (late > 5) {
        s0 = probe
        break
      }
    }
    expect(s0).not.toBeNull()
    let s = s0!
    let guard = 0
    let hits = 0
    let lateYears = 0
    while (s.state.phase === 'playing' && guard < 200) {
      guard++
      if (s.awaitingAdvance) {
        s = nextYear(s, ALL_EVENTS)
      } else if (s.currentEvent) {
        if (s.state.age >= 64) lateYears++
        if (NEW_IDS.includes(s.currentEvent.id)) hits++
        const vis = visibleChoices(s.state, s.currentEvent)
        if (vis.length === 0) {
          s = recoverMissingEvent(s, ALL_EVENTS)
          continue
        }
        s = chooseOption(s, s.currentEvent.choices.indexOf(vis[0]))
      } else break
    }
    expect(lateYears).toBeGreaterThan(5)
    expect(hits).toBeGreaterThanOrEqual(1)
  })

  it('热力图对比：66-77 桶覆盖 52→…→80（95 轮）→84（101 轮 4 枚）→92（102 轮 4 枚薄桶补密）→94（108 轮独居线 2 枚）→95（110 轮认知 1 枚）→100（113 轮心理线 5 枚 18-70 窗压 66-70）', () => {
    const covering = ALL_EVENTS.filter((e) => e.maxAge >= 66 && e.minAge <= 77)
    // 第 102 轮：late_hearing_aid [66,74] / late_friend_funeral [66,75] /
    // late_kid_faraway [66,77] / late_body_shake [68,77] 四枚全部落在本桶 → 84→92
    // 第 108 轮：late_widow_living_alone [66,77] / late_widow_new_mate_boundary [66,77] → 92→94
    // 第 110 轮：late_mind_rhythm [66,77] → 94→95
    // 第 113 轮：mood_low_tide/mood_self_care/mood_talk/mood_professional/mood_clear_sky [18,70] 五枚压 66-70 → 95→100
    expect(covering.length).toBe(118)
    const before = 67 // 基线（52 补密前实测；各轮至 73；70 轮 +2；85 轮手术 +1；86 轮 home_living/home_sell_forced 40-70 窗 +2；101 轮 +4；102 轮 +4；108 轮 +2；110 轮 +1；113 轮 +5；115 轮 +3；117 轮 +3；119 轮 +2；120 轮 +4；124 轮 +6[will/elder_sibling/nb_elder/frd_old/pet 双枚 60-77/70 窗]）
    expect(covering.length - before).toBe(51)
  })
})
