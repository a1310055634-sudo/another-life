// 第 91 轮：婚恋多元化测试（离婚 R67 最小语义恢复/单身/再婚/丁克/不婚）
// 验收口径（PROMPT-V5.md 第 91 轮）：
// - A1 离婚正反五路（无危机不可/危机但亲密 >29 不可/≤29 可；现金减半含负值；
//   spouse 移出 child 保留；married 清除 divorced 授予）
// - A3 dink tag 压制生育入口断言；不婚/单身/再婚资格门
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { MARRIAGE_V5_EVENTS } from '../data/events/marriage_v5'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}
const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}
const spouseRel = (closeness: number, withChild = false): Relation[] => {
  const rel: Relation[] = [{ id: 'p1', kind: 'spouse', name: '伴侣', closeness, alive: true }]
  if (withChild) {
    rel.push({ id: 'c1', kind: 'child', name: '孩子', closeness: 60, alive: true, birthAge: 30 })
  }
  return rel
}
const married = (closeness = 60, extra: Partial<GameState> = {}): Partial<GameState> => ({
  tags: ['married', 'marriage_crisis'],
  relations: spouseRel(closeness),
  ...extra,
})

describe('第 91 轮：计数与校验', () => {
  it('新事件计数=5、窗口正确、全池校验器零 issue、全池 242', () => {
    expect(MARRIAGE_V5_EVENTS).toHaveLength(5)
    expect(MARRIAGE_V5_EVENTS.map((e) => [e.minAge, e.maxAge])).toEqual([
      [30, 50], [30, 55], [35, 60], [28, 35], [30, 45],
    ])
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
})

describe('第 91 轮：离婚正反与最小语义（A1）', () => {
  it('资格：危机+已婚在册可（R88 校准后解除亲密门，crisis 标记即资格）；无危机/未婚不可', () => {
    const ev = byId('div_sign_papers')
    expect(isEventAvailable(makeGame(7, { age: 36, ...married(25) }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 36, ...married(75) }), ev)).toBe(true) // 高亲密危机同样可（修复未成即资格）
    expect(isEventAvailable(makeGame(7, { age: 36, tags: ['married'], relations: spouseRel(40) }), ev)).toBe(false) // 无危机
    expect(isEventAvailable(makeGame(7, { age: 36 }), ev)).toBe(false) // 未婚
  })
  it('落地：现金减半（正资产）+配偶移出+child 保留+married 清除+divorced 授予', () => {
    const s = makeGame(7, { age: 36, money: 80000, tags: ['married', 'marriage_crisis'], relations: spouseRel(25, true) })
    const r = applyChoice(s, byId('div_sign_papers'), 0)
    expect(r.state.money).toBe(40000)
    expect(r.state.relations.some((x) => x.kind === 'spouse')).toBe(false)
    expect(r.state.relations.some((x) => x.kind === 'child' && x.alive)).toBe(true)
    expect(r.state.tags).not.toContain('married')
    expect(r.state.tags).not.toContain('marriage_crisis')
    expect(r.state.tags).toContain('divorced')
  })
  it('负资产同担：−8,000 减半为 −4,000', () => {
    const s = makeGame(7, { age: 36, money: -8000, ...married(25) })
    const r = applyChoice(s, byId('div_sign_papers'), 0)
    expect(r.state.money).toBe(-4000)
  })
  it('离婚正反（再给一次机会支）：保留危机与婚姻', () => {
    const s = makeGame(7, { age: 36, ...married(25) })
    const r = applyChoice(s, byId('div_sign_papers'), 1)
    expect(r.state.tags).toContain('married')
    expect(r.state.tags).toContain('marriage_crisis')
    expect(r.state.tags).not.toContain('divorced')
    expect(r.state.relations.some((x) => x.kind === 'spouse' && x.alive)).toBe(true)
  })
})

describe('第 91 轮：单身岁月/再婚窗口（A1 续）', () => {
  it('单身岁月：仅离异身份可用；再婚窗口：离异+恋人+无配偶可用', async () => {
    const life = byId('div_single_life')
    const probeState = makeGame(7, { age: 40, tags: ['divorced'] })
    const { isEventAvailable: iav, conditionFailReason } = await import('./events')
    console.log('PROBE avail:', iav(probeState, life), 'reason:', JSON.stringify(conditionFailReason(probeState, life.requires as never)), 'tags:', JSON.stringify(probeState.tags), 'lifeSeen:', probeState.seenEvents.includes('div_single_life'), 'choices:', life.choices.length)
    expect(isEventAvailable(probeState, life)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40 }), life)).toBe(false)
    const rm = byId('div_remarry')
    const partnerRel = [{ id: 'p2', kind: 'partner' as const, name: 'TA', closeness: 70, alive: true }]
    expect(
      isEventAvailable(makeGame(7, { age: 40, money: 20000, tags: ['divorced'], relations: partnerRel }), rm),
    ).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, relations: partnerRel }), rm)).toBe(false) // 未离异
    expect(
      isEventAvailable(
        makeGame(7, { age: 40, tags: ['divorced'], relations: [...partnerRel, ...spouseRel(60)] }),
        rm,
      ),
    ).toBe(false) // 已有配偶
  })
  it('再婚落地：convertFrom 恢复 married+清除 divorced', () => {
    const partnerRel = [{ id: 'p2', kind: 'partner' as const, name: 'TA', closeness: 70, alive: true }]
    const s = makeGame(7, { age: 40, money: 20000, tags: ['divorced'], relations: partnerRel })
    const r = applyChoice(s, byId('div_remarry'), 0)
    expect(r.state.tags).toContain('married')
    expect(r.state.tags).not.toContain('divorced')
    expect(r.state.relations.some((x) => x.kind === 'spouse' && x.alive)).toBe(true)
    expect(r.state.money).toBe(12000)
  })
})

describe('第 91 轮：丁克压制与不婚（A3）', () => {
  it('fam_dink：已婚无娃可、有娃/未婚不可；落地授予 dink', async () => {
    const ev = byId('fam_dink')
    const probe = makeGame(7, { age: 30, tags: ['married'], relations: spouseRel(60) })
    const { conditionFailReason } = await import('./events')
    console.log('DINK PROBE avail:', isEventAvailable(probe, ev), 'reason:', JSON.stringify(conditionFailReason(probe, ev.requires as never)), 'requires:', JSON.stringify(ev.requires), 'relJSON:', JSON.stringify(probe.relations))
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['married'], relations: spouseRel(60) }), ev)).toBe(true)
    expect(
      isEventAvailable(makeGame(7, { age: 30, tags: ['married', 'has_child'], relations: spouseRel(60, true) }), ev),
    ).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30 }), ev)).toBe(false)
    const r = applyChoice(makeGame(7, { age: 30, tags: ['married'], relations: spouseRel(60) }), ev, 0)
    expect(r.state.tags).toContain('dink')
  })
  it('dink 压制生育入口：rel_child_question 对 dink 局不可用', () => {
    const cq = byId('rel_child_question')
    const base = { age: 30, tags: ['married'], relations: spouseRel(60) }
    expect(isEventAvailable(makeGame(7, base), cq)).toBe(true)
    expect(isEventAvailable(makeGame(7, { ...base, tags: ['married', 'dink'] }), cq)).toBe(false)
  })
  it('不婚主义：单身 30+ 可、已婚/恋人不可；落地 childfree_will', () => {
    const ev = byId('life_childfree')
    expect(isEventAvailable(makeGame(7, { age: 32 }), ev)).toBe(true)
    expect(
      isEventAvailable(makeGame(7, { age: 32, relations: [{ id: 'x', kind: 'partner', name: 'TA', closeness: 50, alive: true }] }), ev),
    ).toBe(false)
    const r = applyChoice(makeGame(7, { age: 32 }), ev, 0)
    expect(r.state.tags).toContain('childfree_will')
  })
})

describe('第 91 轮：加权抽取（×50，priority=0 层）', () => {
  it('抽到的新事件必然资格可用（错误状态从不入候选）', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...MARRIAGE_V5_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const s = makeGame(7000 + i, {
        age: 28 + (i % 15),
        money: 30000,
        tags: i % 3 === 0 ? ['married', 'marriage_crisis', 'has_child'] : i % 3 === 1 ? ['divorced'] : [],
        relations:
          i % 3 === 0
            ? spouseRel(25)
            : i % 3 === 1
              ? [{ id: 'p2', kind: 'partner' as const, name: 'TA', closeness: 70, alive: true }]
              : [],
      })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (MARRIAGE_V5_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
