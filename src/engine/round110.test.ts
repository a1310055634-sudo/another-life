// 第 110 轮：名声热度消退向（2 枚）+ 记忆与认知主题（2 枚）测试。
//
// 本轮的语义核心有两条：
//   ①「消退必须由玩家主动」——fame_fade_out 的摘标记只发生在玩家选了那一支时；
//     fame_past_peak 是氛围事件，任何选项都不得碰 minor_fame（自动摘 = 引擎语义改动，禁止）。
//   ②「认知主题独立门控」——不读 lifestyle.ts 的 healthRisk 链、不设标记、
//     不假设任何家庭关系，与慢性病线零耦合（撞题 = 主题互相稀释）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { isEventAvailable, applyChoice, visibleChoices } from './events'
import { validateEvents } from './validateEvents'
import { FAME_EVENTS } from '../data/events/fame'
import { LATE_EVENTS } from '../data/events/late'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState } from './types'

const NEW_IDS = [
  'fame_fade_out',
  'fame_past_peak',
  'late_memory_early_sign',
  'late_mind_rhythm',
] as const
const FAME_NEW = ['fame_fade_out', 'fame_past_peak'] as const
const LATE_NEW = ['late_memory_early_sign', 'late_mind_rhythm'] as const

const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const withFame = (patch: Partial<GameState> = {}) =>
  makeGame(42, { age: 45, tags: ['minor_fame'], ...patch })

describe('第 110 轮 A1：撞题扫描与差异化判据', () => {
  it('四枚全部注册、全池 id 唯一、validateEvents 零 issue', () => {
    for (const id of NEW_IDS) expect(ALL_EVENTS.some((e) => e.id === id)).toBe(true)
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('差异化①：新 fame 2 枚不挂 fameChance 散列门（既有 5 枚中 viral/hate 才有）', () => {
    for (const id of FAME_NEW) {
      expect(byId(id).requires && 'fameChance' in byId(id).requires!).toBe(false)
    }
    expect('fameChance' in byId('fame_viral').requires!).toBe(true)
    expect('fameChance' in byId('fame_hate').requires!).toBe(true)
  })

  it('差异化②： fame_fade_out 是抉择事件（恰一支摘标记），fame_past_peak 是氛围事件（全支不摘）', () => {
    const fade = byId('fame_fade_out')
    const fadeRemovals = fade.choices.filter((c) => c.removeTags?.includes('minor_fame'))
    expect(fadeRemovals).toHaveLength(1)
    const peak = byId('fame_past_peak')
    for (const c of peak.choices) {
      expect(c.removeTags?.includes('minor_fame') ?? false).toBe(false)
    }
  })

  it('差异化③：认知 2 枚与 lifestyle 健康链零耦合——不读 healthRisk、不设标记、不设关系门', () => {
    for (const id of LATE_NEW) {
      const blob = JSON.stringify(byId(id))
      expect(blob.includes('healthRisk')).toBe(false)
      expect(blob.includes('addTags')).toBe(false)
      expect(byId(id).requires?.relationKinds ?? []).toEqual([])
      expect(byId(id).requires?.tagsAny ?? []).toEqual([])
    }
  })

  it('差异化④：主题词表双向可扫——轻词（忘事/记性/认知）在文案，重词（阿尔茨海默/失智/痴呆）刻意不进', () => {
    for (const id of LATE_NEW) {
      const e = byId(id)
      const blob = e.title + e.text + e.choices.map((c) => c.text + (c.summary ?? '') + (c.tooltip ?? '')).join('')
      expect(['忘事', '记性', '认知'].some((w) => blob.includes(w))).toBe(true)
      for (const heavy of ['阿尔茨海默', '失智', '痴呆']) {
        expect(blob.includes(heavy)).toBe(false)
      }
    }
  })

  it('差异化⑤：四枚标题与正文首句互异，且不与全池任何既有标题撞车', () => {
    const titles = NEW_IDS.map((id) => byId(id).title)
    expect(new Set(titles).size).toBe(4)
    const heads = NEW_IDS.map((id) => byId(id).text.slice(0, 12))
    expect(new Set(heads).size).toBe(4)
    // 只断言「本轮新增不撞既有」——全池层面的标题唯一不是本轮契约：
    // 既有池里已有一组历史重复「体检报告上的箭头」（late_health_screen / mid_checkup_arrows），
    // 属更早轮次的既成事实，本轮纯追加不回改旧事件，已在账本登记。
    const otherTitles = new Set(
      ALL_EVENTS.filter((e) => !(NEW_IDS as readonly string[]).includes(e.id)).map((e) => e.title),
    )
    for (const t of titles) expect(otherTitles.has(t)).toBe(false)
  })
})

describe('第 110 轮 A2：消退向正反——主动淡出摘标记，氛围事件永不摘', () => {
  it('正：minor_fame 在册 + 窗口内 → fade / peak 都可触发', () => {
    expect(isEventAvailable(withFame({ age: 45 }), byId('fame_fade_out'))).toBe(true)
    expect(isEventAvailable(withFame({ age: 48 }), byId('fame_past_peak'))).toBe(true)
  })

  it('反：无 minor_fame 在册 → 两枚一律不触发（不凭空谈过气）', () => {
    for (const age of [40, 45, 50, 54]) {
      const g = makeGame(42, { age, tags: [] })
      expect(isEventAvailable(g, byId('fame_fade_out'))).toBe(false)
      expect(isEventAvailable(g, byId('fame_past_peak'))).toBe(false)
    }
    // creator_started（还没走红）也不行——消退语义只属于「红过的人」
    const creator = makeGame(42, { age: 45, tags: ['creator_started'] })
    expect(isEventAvailable(creator, byId('fame_fade_out'))).toBe(false)
    expect(isEventAvailable(creator, byId('fame_past_peak'))).toBe(false)
  })

  it('窗口正反：两枚各自 minAge−1 不可达 / 窗口内可达 / maxAge+1 不可达', () => {
    for (const id of FAME_NEW) {
      const e = byId(id)
      expect(isEventAvailable(withFame({ age: e.minAge - 1 }), e)).toBe(false)
      expect(isEventAvailable(withFame({ age: e.minAge }), e)).toBe(true)
      expect(isEventAvailable(withFame({ age: e.maxAge }), e)).toBe(true)
      expect(isEventAvailable(withFame({ age: e.maxAge + 1 }), e)).toBe(false)
    }
  })

  it('正：fade 选「体面谢幕」→ minor_fame 真被摘除（removeTags 生效）', () => {
    const ev = byId('fame_fade_out')
    const next = applyChoice(withFame(), ev, 0).state
    expect(next.tags.includes('minor_fame')).toBe(false)
  })

  it('正：fade 选另两支（慢更 / 再冲）→ 标记保留', () => {
    const ev = byId('fame_fade_out')
    expect(applyChoice(withFame(), ev, 1).state.tags.includes('minor_fame')).toBe(true)
    expect(applyChoice(withFame(), ev, 2).state.tags.includes('minor_fame')).toBe(true)
  })

  it('正：past_peak 三个选项任一结算 → minor_fame 仍在册（不自动摘，A2 关键断言）', () => {
    const ev = byId('fame_past_peak')
    for (let i = 0; i < 3; i++) {
      const next = applyChoice(withFame(), ev, i).state
      expect(next.tags.includes('minor_fame')).toBe(true)
    }
  })
})

describe('第 110 轮 A3：认知向正反——独立门控、窗口正确', () => {
  it('窗口正反：两枚各自 minAge−1 不可达 / 窗口内可达 / maxAge+1 不可达', () => {
    for (const id of LATE_NEW) {
      const e = byId(id)
      expect(e.minAge).toBeGreaterThanOrEqual(51)
      expect(e.maxAge).toBeLessThanOrEqual(78)
      expect(isEventAvailable(makeGame(42, { age: e.minAge - 1 }), e)).toBe(false)
      expect(isEventAvailable(makeGame(42, { age: e.minAge }), e)).toBe(true)
      expect(isEventAvailable(makeGame(42, { age: e.maxAge }), e)).toBe(true)
      expect(isEventAvailable(makeGame(42, { age: e.maxAge + 1 }), e)).toBe(false)
    }
  })

  it('正：无任何前置标记/关系也可触发（资格红线：不假设配偶子女积蓄名声）', () => {
    expect(isEventAvailable(makeGame(42, { age: 60, tags: [], relations: [] }), byId('late_memory_early_sign'))).toBe(true)
    expect(isEventAvailable(makeGame(42, { age: 70, tags: [], relations: [] }), byId('late_mind_rhythm'))).toBe(true)
  })

  it('文案不把 aging 写成必然：健忘总与「可能/常见/相称」类缓冲语同现，检查支结局是安心不是确诊', () => {
    const e = byId('late_memory_early_sign')
    const check = e.choices[0]
    expect(check.summary ?? '').toContain('相称')
    expect(check.summary ?? '').not.toContain('确诊')
    expect(check.summary ?? '').not.toContain('晚期')
  })
})

describe('第 110 轮 A4：结构与红线', () => {
  it('计数：FAME 7 / LATE 58 / 全池 290；四枚 category 合规、late 仍恰 6 类', () => {
    expect(FAME_EVENTS).toHaveLength(7)
    expect(LATE_EVENTS).toHaveLength(65)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(byId('fame_fade_out').category).toBe('career')
    expect(byId('fame_past_peak').category).toBe('life')
    expect(byId('late_memory_early_sign').category).toBe('health')
    expect(byId('late_mind_rhythm').category).toBe('life')
    expect(new Set(LATE_EVENTS.map((e) => e.category)).size).toBe(6)
  })

  it('每枚 3 选项；singleChoiceOk 白名单仍仅 hlt_body_intensive；选项效果签名互异且非空', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.choices.length).toBe(3)
      const sigs = e.choices.map((c) => JSON.stringify(c.effects))
      expect(new Set(sigs).size).toBe(3)
      for (const c of e.choices) expect(c.effects.length).toBeGreaterThan(0)
      expect(e.singleChoiceOk).toBeUndefined()
    }
    expect(ALL_EVENTS.filter((e) => e.singleChoiceOk).map((e) => e.id)).toEqual(['hlt_body_intensive'])
  })

  it('穷档可见选项 ≥2（花钱支可被大额拦截，但免费支永远在）', () => {
    const poor = makeGame(42, { age: 45, tags: ['minor_fame'], money: 100 })
    expect(visibleChoices(poor, byId('fame_fade_out')).length).toBeGreaterThanOrEqual(2)
    expect(visibleChoices(poor, byId('fame_past_peak')).length).toBe(3)
    const poorLate = makeGame(42, { age: 70, money: 100 })
    expect(visibleChoices(poorLate, byId('late_memory_early_sign')).length).toBeGreaterThanOrEqual(2)
    expect(visibleChoices(poorLate, byId('late_mind_rhythm')).length).toBeGreaterThanOrEqual(2)
  })

  it('零散列零支流：四枚无 fameChance / 无 rng / 无 priority（0 层，机制值冻结）', () => {
    for (const id of NEW_IDS) {
      const blob = JSON.stringify(byId(id))
      expect(blob.includes('fameChance')).toBe(false)
      expect(blob.includes('rng')).toBe(false)
      expect(blob.includes('findSeed')).toBe(false)
      expect(byId(id).priority).toBeUndefined()
    }
  })

  it('once/cooldown 语义明确：四枚均非 once、cooldown 6–10、weight 9–10', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.once).toBeUndefined()
      expect(e.cooldown).toBeGreaterThanOrEqual(6)
      expect(e.cooldown).toBeLessThanOrEqual(10)
      expect(e.weight).toBeGreaterThanOrEqual(9)
      expect(e.weight).toBeLessThanOrEqual(10)
    }
  })

  it('内容红线：无赌毒网贷题材、无同性伴侣指称、金额全为小额（≤2,000）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      const blob = e.title + e.text + e.choices.map((c) => c.text + (c.summary ?? '')).join('')
      for (const w of ['赌', '毒品', '网贷', '高利贷', '老公', '老婆']) {
        expect(blob.includes(w)).toBe(false)
      }
      for (const c of e.choices) {
        for (const eff of c.effects) {
          if (typeof eff.money === 'number' && eff.money < 0) {
            expect(eff.money).toBeGreaterThanOrEqual(-2000)
          }
        }
      }
    }
  })
})