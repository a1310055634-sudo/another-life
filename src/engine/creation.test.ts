// 第 7 轮测试：角色创建与开局差异（24 组合、平衡、特质权重透传、开局分化）
import { describe, it, expect } from 'vitest'
import type { AttrKey, GameEvent } from './types'
import { createNewGame, previewStart } from './init'
import { validateState } from './validate'
import { drawEvent, visibleChoices, isEventAvailable } from './events'
import { mulberry32 } from './rng'
import { startSession, nextYear, chooseOption } from './session'
import { validateEvents } from './validateEvents'
import { BACKGROUNDS } from '../data/backgrounds'
import { TRAITS } from '../data/traits'
import { BASIC_EVENTS } from '../data/events/basic'

const POOL: GameEvent[] = BASIC_EVENTS

/** 六个比较维度：五维属性（压力取反）+ 金钱 */
function dimsOf(bgId: string, traitId: string) {
  const s = createNewGame({ seed: 0, backgroundId: bgId, traitId: traitId, name: 'T' })
  return {
    health: s.attrs.health,
    happiness: s.attrs.happiness,
    smarts: s.attrs.smarts,
    social: s.attrs.social,
    noStress: 100 - s.attrs.stress,
    money: s.money,
  } as Record<string, number>
}

describe('第 7 轮：创建数据齐全', () => {
  it('至少 4 种背景、6 种特质', () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(4)
    expect(TRAITS.length).toBeGreaterThanOrEqual(6)
  })

  it('每条背景与特质的优点/代价/影响方向文案齐全且不空洞', () => {
    for (const b of [...BACKGROUNDS, ...TRAITS] as Array<typeof BACKGROUNDS[number] | typeof TRAITS[number]>) {
      expect(b.pros.trim().length).toBeGreaterThanOrEqual(6)
      expect(b.cons.trim().length).toBeGreaterThanOrEqual(2)
      expect(b.influence.trim().length).toBeGreaterThanOrEqual(4)
    }
  })

  it('每个特质都有明确代价（负属性增量、压力正增量或降权方向）', () => {
    for (const t of TRAITS) {
      const hasAttrCost = (['health', 'happiness', 'smarts', 'social'] as const).some(
        (k) => (t.attrs[k] ?? 0) < 0,
      )
      const hasStressCost = (t.attrs.stress ?? 0) > 0
      const hasDownweight = Object.values(t.categoryWeight ?? {}).some((w) => w < 1)
      expect(hasAttrCost || hasStressCost || hasDownweight).toBe(true)
    }
  })

  it('每个特质都有专属标记，且标记互不重复', () => {
    const tags = TRAITS.map((t) => t.tags ?? []).flat()
    expect(new Set(tags).size).toBe(tags.length)
  })
})

describe('第 7 轮：开局预览与全部合法组合', () => {
  it('全部背景×特质组合都能创建、通过校验，且 previewStart 与真实开局一致', () => {
    for (const bg of BACKGROUNDS) {
      for (const tr of TRAITS) {
        const seed = 1000 + bg.id.length * 31 + tr.id.length
        const s = createNewGame({ seed, backgroundId: bg.id, traitId: tr.id, name: '预览' })
        expect(validateState(s).issues).toEqual([])

        const p = previewStart(bg.id, tr.id)
        expect(p.attrs).toEqual(s.attrs)
        expect(p.money).toBe(s.money)
        expect(p.education).toBe(s.education)
        expect(p.tags).toEqual(s.tags)
      }
    }
  })

  it('previewStart 对相同参数是确定性的', () => {
    expect(previewStart('rural', 'studious')).toEqual(previewStart('rural', 'studious'))
  })

  it('特质标签并入初始标记，可被事件条件引用', () => {
    for (const tr of TRAITS) {
      const s = createNewGame({ seed: 5, backgroundId: 'ordinary', traitId: tr.id, name: 'T' })
      for (const tag of tr.tags ?? []) {
        expect(s.tags).toContain(tag)
      }
    }
    // 背景标记同样保留
    const w = createNewGame({ seed: 5, backgroundId: 'wealthy', traitId: 'studious', name: 'T' })
    expect(w.tags).toEqual(expect.arrayContaining(['bg_wealthy', 'has_connections', 'bookworm']))
  })
})

describe('第 7 轮：组合平衡（防止全面最优）', () => {
  const combos = BACKGROUNDS.flatMap((bg) =>
    TRAITS.map((tr) => ({ id: `${bg.id}+${tr.id}`, d: dimsOf(bg.id, tr.id) })),
  )

  it('没有任何组合在全部六个维度上同时压过所有其他组合', () => {
    for (const c of combos) {
      const keys = Object.keys(c.d)
      const dominatesAll = combos.every(
        (o) => o === c || keys.every((k) => c.d[k] >= o.d[k]),
      )
      expect(dominatesAll).toBe(false)
    }
  })

  it('每个背景至少有一块明显短板（属性维度落后最优者 ≥10）', () => {
    for (const bg of BACKGROUNDS) {
      const keys: AttrKey[] = ['health', 'happiness', 'smarts', 'social']
      const biggestGap = Math.max(
        ...keys.map((k) => {
          const max = Math.max(...BACKGROUNDS.map((b) => b.attrs[k] ?? 0))
          return max - (bg.attrs[k] ?? 0)
        }),
      )
      const stressGap = Math.min(...BACKGROUNDS.map((b) => b.attrs.stress ?? 0))
      const stressPenalty = (bg.attrs.stress ?? 0) - stressGap
      expect(biggestGap >= 10 || stressPenalty >= 10).toBe(true)
    }
  })

  it('富裕与贫寒的组合之间不会出现"钱多且属性全不差"的绝对优势', () => {
    const rich = dimsOf('wealthy', 'laid_back')
    const poor = dimsOf('rural', 'studious')
    const keys = Object.keys(rich)
    const richDominatesPoor = keys.every((k) => rich[k] >= poor[k])
    expect(richDominatesPoor).toBe(false)
  })
})

describe('第 7 轮：特质权重接入事件抽取（session 透传）', () => {
  /** 5 个教育 + 5 个职业事件，等权重、无 once/cooldown */
  function eduCareerPool(): GameEvent[] {
    const mk = (category: 'education' | 'career', i: number): GameEvent => ({
      id: `syn_${category}_${i}`,
      category,
      title: category,
      text: 't',
      minAge: 18,
      maxAge: 99,
      weight: 10,
      choices: [
        { text: 'a', effects: [{ attr: 'happiness', delta: 1 }] },
        { text: 'b', effects: [{ attr: 'happiness', delta: -1 }] },
      ],
    })
    return [
      ...Array.from({ length: 5 }, (_, i) => mk('education', i)),
      ...Array.from({ length: 5 }, (_, i) => mk('career', i)),
    ]
  }

  it('书虫的教育事件占比显著高于无教育加成的特质（100 个 seed 的首轮抽取）', () => {
    const pool = eduCareerPool()
    const eduCount = (traitId: string) => {
      let n = 0
      for (let seed = 0; seed < 100; seed++) {
        const s = startSession({ seed, backgroundId: 'ordinary', traitId, name: 'T' }, pool)
        if (s.currentEvent?.category === 'education') n++
      }
      return n
    }
    const pro = eduCount('studious') // 教育 ×1.5 → 期望占比 0.6
    const control = eduCount('frugal') // 教育无加成 → 期望占比 0.5
    expect(pro).toBeGreaterThan(control + 4)
    expect(pro).toBeGreaterThanOrEqual(53)
    expect(control).toBeLessThanOrEqual(58)
  })

  it('引擎层 drawEvent 对任意权重函数方向正确（权重有下限 1：0.01 倍实际份额 ≈9%）', () => {
    const pool = eduCareerPool()
    let edu = 0
    const N = 200
    for (let i = 0; i < N; i++) {
      const s = createNewGame({ seed: i, backgroundId: 'ordinary', traitId: 'sociable', name: 'T' })
      const e = drawEvent(s, pool, mulberry32(1000 + i), (ev) => (ev.category === 'education' ? 0.01 : 1))
      if (e.category === 'education') edu++
    }
    // weightedPick 的权重下限为 1：教育 5×1 对职业 5×10，期望份额 ≈9%，远低于无加成的 50%
    expect(edu).toBeLessThanOrEqual(N * 0.15)
    expect(edu).toBeGreaterThan(0)
  })

  it('新特质同样满足同 seed 复现', () => {
    const run = (traitId: string) => {
      let s = startSession({ seed: 777, backgroundId: 'single_parent', traitId, name: 'T' }, POOL)
      for (let i = 0; i < 8 && s.state.phase === 'playing'; i++) {
        s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, i % 2)
      }
      return JSON.stringify(s.state)
    }
    for (const tr of TRAITS) {
      expect(run(tr.id)).toBe(run(tr.id))
    }
  })
})

describe('第 7 轮：开局真正产生不同玩法', () => {
  /** 固定策略（永远选第 1 个可见选项）推进 years 年 */
  function runYears(bgId: string, traitId: string, seed: number, years: number) {
    let s = startSession({ seed, backgroundId: bgId, traitId, name: 'T' }, POOL)
    let steps = 0
    while (s.state.phase === 'playing' && s.state.age < 18 + years && steps < years * 2) {
      s = s.awaitingAdvance ? nextYear(s, POOL) : chooseOption(s, 0)
      steps++
    }
    return s
  }

  it('两种极端开局同样玩 10 年，履历、金钱、标记全面分化', () => {
    const a = runYears('wealthy', 'ambitious', 2026, 10)
    const b = runYears('rural', 'studious', 2026, 10)
    expect(a.state.money).not.toBe(b.state.money)
    expect(a.state.history.map((h) => h.eventId)).not.toEqual(b.state.history.map((h) => h.eventId))
    expect(a.state.tags).not.toEqual(b.state.tags)
  })

  it('「家里的安排」只有富裕开局会遇到；穷开局 30 个 seed × 12 年一次都不会出现', () => {
    let seenByRich = 0
    for (let seed = 0; seed < 30; seed++) {
      const rich = runYears('wealthy', 'sociable', seed, 12)
      if (rich.state.seenEvents.includes('youth_family_bankroll')) seenByRich++
      const poor = runYears('rural', 'sociable', seed, 12)
      expect(poor.state.seenEvents).not.toContain('youth_family_bankroll')
    }
    expect(seenByRich).toBeGreaterThanOrEqual(1)
  })

  it('「妈妈塞过来的钱」只有农家/单亲开局会遇到', () => {
    let seen = 0
    for (let seed = 0; seed < 30; seed++) {
      for (const bg of ['rural', 'single_parent'] as const) {
        const s = runYears(bg, 'laid_back', seed, 10)
        if (s.state.seenEvents.includes('youth_home_remittance')) seen++
      }
      for (const bg of ['wealthy', 'ordinary'] as const) {
        const s = runYears(bg, 'laid_back', seed, 10)
        expect(s.state.seenEvents).not.toContain('youth_home_remittance')
      }
    }
    expect(seen).toBeGreaterThanOrEqual(1)
  })

  it('「夜市摊位」对敢闯敢赌多一个赌注选项，对其他人不可见', () => {
    const stall = POOL.find((e) => e.id === 'youth_night_stall')!
    expect(stall.choices).toHaveLength(4)
    for (const tr of TRAITS) {
      const s = createNewGame({ seed: 1, backgroundId: 'ordinary', traitId: tr.id, name: 'T' })
      const visible = visibleChoices(s, stall)
      if (tr.id === 'risk_taker') expect(visible).toHaveLength(4)
      else expect(visible).toHaveLength(3)
    }
  })

  it('新门控事件全部通过数据校验器', () => {
    expect(validateEvents(POOL)).toEqual([])
    // 第 19 轮：新增阶段性续卡事件 youth_gym_renew（基础池 19→20）
    expect(POOL.length).toBe(20)
  })

  it('「深夜的键盘声」对独居/住家里的角色不可达（第 10 轮复验修复：独居者无室友）', () => {
    const dorm = POOL.find((e) => e.id === 'youth_dorm_conflict')!
    const base = createNewGame({ seed: 1, backgroundId: 'ordinary', traitId: 'bookworm', name: 'T' })
    // 学生宿舍（无居住标记）与合租者（未标记）仍可见
    expect(isEventAvailable({ ...base, age: 21 }, dorm)).toBe(true)
    // 独居与住家里：没有室友，事件不再出现
    expect(isEventAvailable({ ...base, age: 21, tags: [...base.tags, 'independent_living'] }, dorm)).toBe(false)
    expect(isEventAvailable({ ...base, age: 21, tags: [...base.tags, 'lived_with_parents'] }, dorm)).toBe(false)
  })
})
