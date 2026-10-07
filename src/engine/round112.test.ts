// 第 112 轮（V7 首轮）：事件直接致死引擎与死亡窄门
// 覆盖：lethal 校验三重守卫（once/支流门控/全池 ≤2 枚）、两枚窄门事件门控矩阵、
// 支流散列确定性、致死整合（含「年轻年健康漂移复苏」回归——death_young 千局 0 现身的
// 结构性根因：仅归零健康会被 <30 岁 +1/年的自然漂移救活，lethal_struck 标记即判死）。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, visibleChoices, isEventAvailable, availableEvents } from './events'
import { validateEvents } from './validateEvents'
import { checkLifeEnd, judgeEnding } from './outcomes'
import { accidentRiskAt, illnessRiskAt, suddenRiskAt } from './suddendeath'
import { ALL_EVENTS } from '../data/events'
import { HEALTH_EVENTS } from '../data/events/health'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'risk_taker', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

/** 按文本找到可见选项的【原始索引】（applyChoice 按完整 choices 数组定位） */
function choiceIndex(state: GameState, event: GameEvent, text: string): number {
  const vis = visibleChoices(state, event)
  const i = event.choices.findIndex((c) => c.text === text && vis.includes(c))
  if (i === -1) throw new Error(`选项不可见: ${text}（可见 ${vis.length} 个）`)
  return i
}

/** 扫 seed 找散列命中/未命中的样本（确定性：命中集合对固定算法恒定） */
function scanSeeds(fn: (seed: number, age: number) => boolean, age: number): { hit: number[]; miss: number[] } {
  const hit: number[] = []
  const miss: number[] = []
  for (let s = 1; s <= 400 && (hit.length < 3 || miss.length < 3); s++) {
    if (fn(s, age)) hit.push(s)
    else miss.push(s)
  }
  return { hit, miss }
}

// 合规 lethal 事件模板（once + accidentRisk 门控 + ≥2 选项）
function lethalEvent(id: string): GameEvent {
  return {
    id,
    category: 'health',
    title: '测试窄门',
    text: '测试正文',
    minAge: 18,
    maxAge: 35,
    once: true,
    requires: { accidentRisk: true },
    choices: [
      { text: '走窄门', effects: [{ lethal: true }] },
      { text: '绕开', effects: [{ attr: 'stress', delta: 1 }] },
    ],
  }
}

describe('lethal 校验守卫（validateEvents，A1）', () => {
  it('缺 once：lethal 出现在可复现事件上被拒绝', () => {
    const bad = lethalEvent('t_lethal_noonce')
    bad.once = undefined
    const issues = validateEvents([bad])
    expect(issues.some((i) => i.field.includes('lethal') && i.problem.includes('once'))).toBe(true)
  })

  it('缺支流门控：无散列门的 lethal 被拒绝', () => {
    const bad = lethalEvent('t_lethal_nogate')
    bad.requires = { tagsAny: ['risk_taker'] }
    const issues = validateEvents([bad])
    expect(issues.some((i) => i.field.includes('lethal') && i.problem.includes('支流散列门控'))).toBe(true)
  })

  it('合规 lethal（once+散列门）零 issue', () => {
    expect(validateEvents([lethalEvent('t_lethal_ok')])).toEqual([])
  })

  it('全池第 3 枚 lethal 被上限守卫拒绝', () => {
    const pool = [lethalEvent('t_l1'), lethalEvent('t_l2'), lethalEvent('t_l3')]
    const issues = validateEvents(pool)
    expect(issues.some((i) => i.eventId === 't_l3' && i.problem.includes('上限 2 枚'))).toBe(true)
    expect(issues.some((i) => i.eventId === 't_l1' && i.problem.includes('上限'))).toBe(false)
  })

  it('现役全池：validateEvents 零 issue，lethal 事件恰为首批两枚', () => {
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    const lethalIds = ALL_EVENTS.filter((e) => e.choices.some((c) => c.effects.some((ef) => ef.lethal))).map((e) => e.id)
    expect(lethalIds.sort()).toEqual(['hlt_accident_blink', 'hlt_verge_fever'])
  })
})

describe('死亡窄门门控矩阵（A2）', () => {
  const acc = findEvent('hlt_accident_blink')
  const fever = findEvent('hlt_verge_fever')

  it('意外窄门：年龄窗外不可用（17/36）', () => {
    const s17 = makeGame(7, { age: 17 })
    const s36 = makeGame(7, { age: 36 })
    expect(isEventAvailable(s17, acc)).toBe(false)
    expect(isEventAvailable(s36, acc)).toBe(false)
  })

  it('意外窄门：非 risk_taker 不可用；散列未命中不可用；命中才可用', () => {
    const { hit, miss } = scanSeeds(accidentRiskAt, 25)
    const noTrait = makeGame(hit[0], { age: 25, tags: [] })
    expect(isEventAvailable(noTrait, acc)).toBe(false)
    const missState = makeGame(miss[0], { age: 25, tags: ['risk_taker'] })
    expect(isEventAvailable(missState, acc)).toBe(false)
    const hitState = makeGame(hit[0], { age: 25, tags: ['risk_taker'] })
    expect(isEventAvailable(hitState, acc)).toBe(true)
    // 全池候选扫描：错误状态（门未开）从不入候选
    const poolMiss = availableEvents(makeGame(miss[0], { age: 25, tags: ['risk_taker'] }), ALL_EVENTS)
    expect(poolMiss.some((e) => e.id === 'hlt_accident_blink')).toBe(false)
  })

  it('急病窄门：健康 >45 不可用；health ≤45 且散列命中可用；年龄窗外不可用', () => {
    const { hit, miss } = scanSeeds(illnessRiskAt, 40)
    const healthy = makeGame(hit[0], { age: 40, attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(isEventAvailable(healthy, fever)).toBe(false)
    const sickMiss = makeGame(miss[0], { age: 40, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(isEventAvailable(sickMiss, fever)).toBe(false)
    const sickHit = makeGame(hit[0], { age: 40, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(isEventAvailable(sickHit, fever)).toBe(true)
    const tooYoung = makeGame(hit[0], { age: 29, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    const tooOld = makeGame(hit[0], { age: 51, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(isEventAvailable(tooYoung, fever)).toBe(false)
    expect(isEventAvailable(tooOld, fever)).toBe(false)
  })

  it('贫困局恒有 ≥2 个可见选项（静养零花费；住院选项被负债大额隐藏不影响致命抉择的可达性）', () => {
    const { hit } = scanSeeds(illnessRiskAt, 40)
    const poor = makeGame(hit[0], { age: 40, money: 0, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(visibleChoices(poor, fever).length).toBeGreaterThanOrEqual(2)
    const rich = makeGame(hit[0], { age: 40, money: 100000, attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 } })
    expect(visibleChoices(rich, fever)).toHaveLength(3)
  })
})

describe('支流散列确定性（A3）', () => {
  it('同参同果：双散列逐 seed 复现一致', () => {
    for (let s = 1; s <= 60; s++) {
      for (const age of [18, 25, 33, 40, 50]) {
        expect(accidentRiskAt(s, age)).toBe(accidentRiskAt(s, age))
        expect(illnessRiskAt(s, age)).toBe(illnessRiskAt(s, age))
      }
    }
  })

  it('三盐互异：意外/急病/风险年散列序列不同（同盐必逐位一致=分歧零）', () => {
    let accVsSudden = 0
    let illVsAcc = 0
    for (let s = 1; s <= 400; s++) {
      if (accidentRiskAt(s, 25) !== suddenRiskAt(s, 25)) accVsSudden++
      if (illnessRiskAt(s, 25) !== accidentRiskAt(s, 25)) illVsAcc++
    }
    // 同率（3% vs 3%）异盐：分歧率 ≈ 2p(1−p) ≈ 5.8% → 400 seed 期望 ~23，取 >5 兜底
    expect(illVsAcc).toBeGreaterThan(5)
    expect(accVsSudden).toBeGreaterThan(5)
  })
})

describe('致死整合与漂移复苏回归（A2/A5/A6 核心）', () => {
  it('年轻局 lethal → 健康归零+标记 → 次年年结判 death_young（<30 岁漂移 +1 救不回来——结构性根因回归）', () => {
    const { hit } = scanSeeds(accidentRiskAt, 25)
    const s = makeGame(hit[0], { age: 25, tags: ['risk_taker'] })
    const ev = findEvent('hlt_accident_blink')
    const idx = choiceIndex(s, ev, '那个瞬间，终究没能躲开')
    const after = applyChoice(s, ev, idx).state
    expect(after.attrs.health).toBe(0)
    expect(after.tags).toContain('lethal_struck')
    const next = advanceYear(after)
    expect(next.phase).toBe('ended')
    expect(next.endingId).toBe('death_young')
  })

  it('中老年局 lethal → death_ill（≥40 岁按既有判定序分流）', () => {
    const { hit } = scanSeeds(illnessRiskAt, 45)
    const s = makeGame(hit[0], {
      age: 45,
      attrs: { health: 40, happiness: 50, smarts: 50, social: 50, stress: 10 },
    })
    const ev = findEvent('hlt_verge_fever')
    const idx = choiceIndex(s, ev, '吃片退烧药，硬扛过去')
    const after = applyChoice(s, ev, idx).state
    const next = advanceYear(after)
    expect(next.phase).toBe('ended')
    expect(next.endingId).toBe('death_ill')
  })

  it('幸存选项：不授予标记、不触发死亡、效果正常落账', () => {
    const { hit } = scanSeeds(accidentRiskAt, 25)
    const s = makeGame(hit[0], { age: 25, tags: ['risk_taker'] })
    const ev = findEvent('hlt_accident_blink')
    const idx = choiceIndex(s, ev, '千钧一发——死死抓住了护栏')
    const after = applyChoice(s, ev, idx).state
    expect(after.tags).not.toContain('lethal_struck')
    const next = advanceYear(after)
    expect(next.phase).not.toBe('ended')
    expect(next.endingId).toBeUndefined()
  })

  it('checkLifeEnd 标记语义：lethal_struck 在册即判死（健康被抬回也不复苏）', () => {
    const revived = makeGame(7, {
      age: 30,
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 0 },
      tags: ['lethal_struck'],
    })
    expect(checkLifeEnd(revived)).toBe('death_young')
    const oldRevived = { ...revived, age: 45 }
    expect(checkLifeEnd(oldRevived)).toBe('death_ill')
    const clean = { ...revived, tags: [] }
    expect(checkLifeEnd(clean)).toBeNull()
  })

  it('judgeEnding 分类回归（千局实证逃逸）：lethal_struck 且终局快照健康=1（漂移抬回）仍判死——checkLifeEnd 与 ENDINGS.when 双镜像', () => {
    const revived = makeGame(7, {
      age: 24,
      attrs: { health: 1, happiness: 30, smarts: 50, social: 50, stress: 20 },
      tags: ['lethal_struck'],
    })
    expect(judgeEnding(revived).id).toBe('death_young')
    const old45 = makeGame(7, {
      age: 45,
      attrs: { health: 2, happiness: 30, smarts: 50, social: 50, stress: 20 },
      tags: ['lethal_struck'],
    })
    expect(judgeEnding(old45).id).toBe('death_ill')
  })
})

describe('计数与池合规（A4/G7）', () => {
  it('health.ts 14→16、全池 290→292、新事件 category 合规', () => {
    expect(HEALTH_EVENTS).toHaveLength(16)
    expect(ALL_EVENTS).toHaveLength(349)
    for (const id of ['hlt_accident_blink', 'hlt_verge_fever']) {
      const e = findEvent(id)
      expect(e.category).toBe('health')
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(validateEvents([e])).toEqual([])
    }
  })
})
