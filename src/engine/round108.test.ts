// 第 108 轮：晚年丧偶与独居重建线（4 枚）测试。
//
// 本轮的核心不是「加了四枚事件」，而是回答一个语义问题：
// **丧偶这件事，怎么做才不是凭空发丧偶？**
// 任务书给的兜底方案是「反向门控 + 叙事」（要求无 spouse 才触发），
// 但该方案对从未结婚的人成立 = 违反 §7 资格红线，且叙事与状态矛盾
// （结局 family_hearth 判定含 spouseAlive）。引擎的效果校验器
// （validateEvents.ts:189-193）本身就禁止这种 remove 写法。
// 故本轮走任务书的第一优先方案：RelationEffect.remove 真实状态变更。
//
// 本文件逐条把上述推理变成可执行断言，防止后续轮「顺手改回叙事模拟」。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { isEventAvailable, applyChoice, visibleChoices } from './events'
import { validateEvents } from './validateEvents'
import { LATE_EVENTS } from '../data/events/late'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState, Relation } from './types'

const NEW_IDS = [
  'late_widow_first_year',
  'late_widow_social_rebuild',
  'late_widow_living_alone',
  'late_widow_new_mate_boundary',
] as const

const byId = (id: string): GameEvent => {
  const e = LATE_EVENTS.find((x) => x.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const rel = (kind: Relation['kind'], closeness = 60): Relation => ({
  id: `r_${kind}`,
  kind,
  name: `测试${kind}`,
  closeness,
  alive: true,
})

/** 有在册配偶的晚年状态（丧偶事件①的正向前提） */
const withSpouse = (patch: Partial<GameState> = {}) =>
  makeGame(42, { age: 60, relations: [rel('spouse', 70)], tags: ['married'], ...patch })

describe('第 108 轮 A1：撞题扫描与差异化判据', () => {
  it('四枚全部注册进 late.ts 与全池，id 唯一', () => {
    for (const id of NEW_IDS) {
      expect(LATE_EVENTS.some((e) => e.id === id)).toBe(true)
      expect(ALL_EVENTS.some((e) => e.id === id)).toBe(true)
    }
    const ids = ALL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('数据层校验全绿（validateEvents 对全池零问题）', () => {
    expect(validateEvents(LATE_EVENTS)).toEqual([])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('差异化判据①：四枚与既有「老友去世线」在关系门控上互斥', () => {
    // late_friends_fade / late_friend_funeral 要求 friend 在册；本轮四枚都不要求 friend
    const friendDeath = ['late_friends_fade', 'late_friend_funeral']
    for (const fid of friendDeath) {
      const fe = LATE_EVENTS.find((e) => e.id === fid)!
      expect(fe.requires?.relationKinds).toContain('friend')
    }
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.requires?.relationKinds ?? []).not.toContain('friend')
    }
  })

  it('差异化判据②：与搭伴线 late_late_companion 不重叠（后者要求无 partner/spouse）', () => {
    const mate = byId('late_late_companion')
    expect(mate.requires?.relationKindsNone).toEqual(expect.arrayContaining(['partner', 'spouse']))
    // 本轮事件②③④ 与之同门控，事件① 则是反向（要求 spouse 在册），
    // 故二者不会同时可触发——不需要额外断言，但记录该结构事实
    expect(byId('late_widow_living_alone').requires?.relationKindsNone)
      .toEqual(expect.arrayContaining(['spouse', 'partner']))
  })

  it('差异化判据③：四枚文本互不重复（标题与正文首句均不同）', () => {
    const titles = NEW_IDS.map((id) => byId(id).title)
    expect(new Set(titles).size).toBe(4)
    const heads = NEW_IDS.map((id) => byId(id).text.slice(0, 12))
    expect(new Set(heads).size).toBe(4)
  })

  it('差异化判据④：与既有父母去世线题材分离（本轮无一条要求 parent 关系）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.requires?.relationKinds ?? []).not.toContain('parent')
      const choicesRequireParent = e.choices.some((c) =>
        (c.requires?.relationKinds ?? []).includes('parent'),
      )
      expect(choicesRequireParent).toBe(false)
    }
  })
})

describe('第 108 轮 A2：门控正反——防凭空丧偶是本轮最关键的语义断言', () => {
  it('正：配偶在册 + 窗口内 → 事件① 可触发（叙事说的每一句都在状态里兑现）', () => {
    const g = withSpouse()
    expect(isEventAvailable(g, byId('late_widow_first_year'))).toBe(true)
  })

  it('反：无配偶在册 → 事件① 绝不触发（不给单身汉凭空发丧偶，§7 资格红线）', () => {
    const g = makeGame(42, { age: 60, relations: [], tags: [] })
    expect(isEventAvailable(g, byId('late_widow_first_year'))).toBe(false)
    // 即便挂上 married 标记但关系不在册（状态被外力改坏的情形），仍不触发
    const g2 = makeGame(42, { age: 60, relations: [], tags: ['married'] })
    expect(isEventAvailable(g2, byId('late_widow_first_year'))).toBe(false)
  })

  it('反：疏远（alive=false）的配偶不算在册，事件① 不触发', () => {
    const deadSpouse: Relation = { ...rel('spouse', 20), alive: false, estranged: true }
    const g = makeGame(42, { age: 60, relations: [deadSpouse], tags: ['married'] })
    expect(isEventAvailable(g, byId('late_widow_first_year'))).toBe(false)
  })

  it('反：事件②③④ 在配偶在册时一律不触发（重建线是下游，不能逆流）', () => {
    const g = withSpouse({ age: 70 })
    for (const id of ['late_widow_social_rebuild', 'late_widow_living_alone', 'late_widow_new_mate_boundary']) {
      expect(isEventAvailable(g, byId(id))).toBe(false)
    }
  })

  it('正：事件① 选择后 spouse 真被移除、married 被摘除（状态与叙事一致）', () => {
    const g = withSpouse()
    const ev = byId('late_widow_first_year')
    const next = applyChoice(g, ev, 0).state
    expect(next.relations.some((r) => r.kind === 'spouse')).toBe(false)
    expect(next.tags.includes('married')).toBe(false)
    expect(next.tags.includes('widowed')).toBe(true)
  })

  it('正：三个选项都真移除 spouse（不能有一个选项让状态与叙事脱节）', () => {
    for (let i = 0; i < 3; i++) {
      const g = withSpouse()
      const ev = byId('late_widow_first_year')
      const next = applyChoice(g, ev, i).state
      expect(next.relations.some((r) => r.kind === 'spouse')).toBe(false)
      expect(next.tags.includes('widowed')).toBe(true)
    }
  })

  it('正：事件① 触发后 spouse 已不在册，once 语义使其不再二次触发', () => {
    const g0 = withSpouse()
    const ev = byId('late_widow_first_year')
    const g1 = applyChoice(g0, ev, 1).state
    expect(g1.seenEvents).toContain('late_widow_first_year')
    expect(isEventAvailable(g1, ev)).toBe(false)
  })

  it('正：事件② 的门控是 widowed 标记 + 无配偶（承接①的下游）', () => {
    const g = makeGame(42, {
      age: 60,
      relations: [],
      tags: ['widowed'],
    })
    expect(isEventAvailable(g, byId('late_widow_social_rebuild'))).toBe(true)
    // 无 widowed 标记则不触发（哪怕确实没配偶）
    const g2 = makeGame(42, { age: 60, relations: [], tags: [] })
    expect(isEventAvailable(g2, byId('late_widow_social_rebuild'))).toBe(false)
  })

  it('正：事件③④ 对任何单身者开放（含 widowed 与终身单身两种来源）', () => {
    for (const tags of [['widowed'], ['never_married']]) {
      const g = makeGame(42, { age: 70, relations: [], tags })
      expect(isEventAvailable(g, byId('late_widow_living_alone'))).toBe(true)
      expect(isEventAvailable(g, byId('late_widow_new_mate_boundary'))).toBe(true)
    }
  })

  it('窗口正反：事件① 在 minAge-1 不可达 / 窗口内可达 / maxAge+1 不可达', () => {
    const ev = byId('late_widow_first_year')
    expect(isEventAvailable(withSpouse({ age: ev.minAge - 1 }), ev)).toBe(false)
    expect(isEventAvailable(withSpouse({ age: ev.minAge }), ev)).toBe(true)
    expect(isEventAvailable(withSpouse({ age: ev.maxAge }), ev)).toBe(true)
    expect(isEventAvailable(withSpouse({ age: ev.maxAge + 1 }), ev)).toBe(false)
  })

  it('窗口正反：四枚全部 minAge ≥ 51 / maxAge ≤ 78（late.ts 文件级硬约束）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.minAge).toBeGreaterThanOrEqual(51)
      expect(e.maxAge).toBeLessThanOrEqual(78)
    }
  })

  it('A2 全域扫描：任何「有配偶在册」的状态都收不到事件②③④ 的候选', () => {
    for (const age of [56, 60, 65, 70, 77]) {
      const g = withSpouse({ age })
      for (const id of ['late_widow_social_rebuild', 'late_widow_living_alone', 'late_widow_new_mate_boundary']) {
        expect(isEventAvailable(g, byId(id))).toBe(false)
      }
    }
  })
})

describe('第 108 轮 A3：结构与红线', () => {
  it('每枚 ≥3 选项，且不新增 singleChoiceOk 白名单', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      expect(e.choices.length).toBeGreaterThanOrEqual(3)
      expect(e.singleChoiceOk).toBeUndefined()
    }
    // 全池 singleChoiceOk 仍仅 hlt_body_intensive 一处
    const whitelisted = ALL_EVENTS.filter((e) => e.singleChoiceOk).map((e) => e.id)
    expect(whitelisted).toEqual(['hlt_body_intensive'])
  })

  it('每事件内任意两个选项的效果组合不完全相同（session.test 同款不变量）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      const sigs = e.choices.map((c) => JSON.stringify(c.effects))
      expect(new Set(sigs).size).toBe(e.choices.length)
    }
  })

  it('无选项效果为空数组（「效果极轻」不是「效果为空」，R101 教训）', () => {
    for (const id of NEW_IDS) {
      for (const c of byId(id).choices) {
        expect(c.effects.length).toBeGreaterThan(0)
      }
    }
  })

  it('每枚都有可见选项（金额门控不得把选项全灭）', () => {
    const poor = makeGame(42, { age: 70, relations: [], tags: ['widowed'], money: 100 })
    const rich = makeGame(42, { age: 70, relations: [], tags: ['widowed'], money: 500000 })
    for (const id of NEW_IDS) {
      const e = byId(id)
      const richVisible = visibleChoices(rich, e).length
      expect(richVisible).toBeGreaterThanOrEqual(2)
    }
    // 事件③ 首个选项要 4800，穷光时它应被门控掉但不得让全事件归零
    expect(visibleChoices(poor, byId('late_widow_living_alone')).length).toBeGreaterThanOrEqual(2)
  })

  it('category 仍为 6 种（未引入第 7 类，late.test 的 toBe(6) 守卫）', () => {
    expect(new Set(LATE_EVENTS.map((e) => e.category)).size).toBe(6)
  })

  it('内容红线：无赌/毒/网贷题材词', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      const blob = e.title + e.text + e.choices.map((c) => c.text + (c.summary ?? '') + (c.tooltip ?? '')).join('')
      for (const w of ['赌', '毒品', '网贷', '借款APP', '高利贷']) {
        expect(blob.includes(w)).toBe(false)
      }
    }
  })

  it('内容红线：无同性伴侣线（四枚文本只出现中性或既有配偶指称）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      const blob = e.title + e.text
      expect(blob.includes('老公')).toBe(false)
      expect(blob.includes('老婆')).toBe(false)
    }
  })

  it('资格红线：四枚都不假设玩家有子女/手足（不硬塞儿女手足叙事作为前提）', () => {
    for (const id of NEW_IDS) {
      const e = byId(id)
      const blob = e.title + e.text
      // 允许在选项里提及（那是玩家自己的选择），但事件前提不得依赖
      expect(e.requires?.relationKinds ?? []).not.toContain('child')
      expect(e.requires?.relationKinds ?? []).not.toContain('sibling')
      expect(blob.includes('我儿')).toBe(false)
      expect(blob.includes('我妹')).toBe(false)
    }
  })

  it('不消费主 rng 流（本轮为纯数据事件，无 findSeed / rng 依赖）', () => {
    const src = NEW_IDS.map((id) => byId(id)).map((e) => JSON.stringify(e))
    expect(src.join('')).not.toContain('rng')
    expect(src.join('')).not.toContain('findSeed')
  })

  it('once / cooldown 语义明确：① once，其余三枚 cooldown 6–10', () => {
    expect(byId('late_widow_first_year').once).toBe(true)
    for (const id of ['late_widow_social_rebuild', 'late_widow_living_alone', 'late_widow_new_mate_boundary']) {
      const cd = byId(id).cooldown
      expect(cd).toBeGreaterThanOrEqual(6)
      expect(cd).toBeLessThanOrEqual(10)
    }
  })

  it('机制值冻结：金额口径为小额（数千至五千，无大额）', () => {
    const ev = byId('late_widow_living_alone')
    for (const c of ev.choices) {
      for (const eff of c.effects) {
        if (typeof eff.money === 'number') {
          expect(Math.abs(eff.money)).toBeLessThanOrEqual(6000)
        }
      }
    }
  })
})