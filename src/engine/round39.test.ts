// 第 39 轮（全量平衡模拟）。
// 锁定本轮五处平衡调整常量（全部为事件数据门槛/权重/落地值，引擎零改动），并以
// 确定性资格断言固化婚姻链语义：恋人 ≥50 有求婚资格、45/54 无；少年恋落地 60、
// 相亲落地 55 具备 5~10 年自然求婚窗。300 局前后对照数据见 PROGRESS.md 第 39 轮
// 与 scripts/round39_balance_sim.ts（npx tsx 可复跑）。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createNewGame } from './init'
import { isEventAvailable, visibleChoices } from './events'
import { RELATION_DECAY_RATE } from './relations'
import { ALL_EVENTS } from '../data/events'
import type { GameState, Relation } from './types'

const relSrc = readFileSync(new URL('../data/events/relationship.ts', import.meta.url), 'utf8')
const basicSrc = readFileSync(new URL('../data/events/basic.ts', import.meta.url), 'utf8')

const findEvent = (id: string) => {
  const ev = ALL_EVENTS.find((e) => e.id === id)
  expect(ev, `事件 ${id} 应在池中`).toBeTruthy()
  return ev!
}

const rel = (kind: Relation['kind'], name: string, closeness: number): Relation => ({
  id: `r_${kind}_${name}`,
  kind,
  name,
  closeness,
  alive: true,
})

function withRels(patch: Partial<GameState> = {}, relations: Relation[] = []): GameState {
  // age 30 / money 40000：propose minAge 门槛之上、三个求婚选项全部可见的稳定夹具
  return { ...createNewGame({ seed: 7, backgroundId: 'ordinary', traitId: 'frugal', name: '测试者' }), age: 30, money: 40000, ...patch, relations }
}

describe('第 39 轮平衡常量锁定（事件数据）', () => {
  it('求婚：资格线 minCloseness 50、权重 18（原 65/12 使 300 局 0 婚姻）', () => {
    const ev = findEvent('rel_propose')
    expect(ev.requires?.minCloseness?.partner).toBe(50)
    expect(ev.weight).toBe(18)
    expect(ev.requires?.relationKindsNone).toContain('spouse')
  })

  it('恋人维护（rel_partner_low）：cooldown 3（原 5 叠加衰减封死链路）', () => {
    const ev = findEvent('rel_partner_low')
    expect(ev.cooldown).toBe(3)
    expect(ev.requires?.minCloseness?.partner).toBe(40)
  })

  it('初恋落地 60、相亲落地 55（热恋溢价，资格窗 5~10 年）', () => {
    expect(basicSrc).toContain("closeness: 60 } },")
    expect(relSrc).toContain("closeness: 55 }")
  })

  it('生育之问（rel_child_question）：weight 22（下游子女里程碑/孙辈链唯一入口）', () => {
    const ev = findEvent('rel_child_question')
    expect(ev.weight).toBe(22)
    expect(ev.requires?.relationKinds).toContain('spouse')
  })

  it('衰减率未被本轮触碰（第 25 轮校准结论维持）：partner/spouse −1', () => {
    expect(RELATION_DECAY_RATE.partner).toBe(1)
    expect(RELATION_DECAY_RATE.spouse).toBe(1)
  })
})

describe('婚姻链资格语义（确定性）', () => {
  it('恋人 ≥50 有求婚资格（落地 55/60 即资格）；45/54 无', () => {
    const ev = findEvent('rel_propose')
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 55)]), ev)).toBe(true)
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 60)]), ev)).toBe(true)
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 50)]), ev)).toBe(true)
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 45)]), ev)).toBe(false)
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 49)]), ev)).toBe(false)
  })

  it('已有配偶不再求婚；恋人维护事件窗口 ≥40 起效', () => {
    const propose = findEvent('rel_propose')
    const married = withRels({ tags: ['married'] }, [rel('spouse', '林晓', 70)])
    expect(isEventAvailable(married, propose)).toBe(false)
    const low = findEvent('rel_partner_low')
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 42)]), low)).toBe(true)
    expect(isEventAvailable(withRels({}, [rel('partner', '林晓', 38)]), low)).toBe(false)
  })

  it('求婚选项：钱不够办大婚礼时旅行结婚仍可见（穷局仍有婚姻出口）', () => {
    const ev = findEvent('rel_propose')
    // money 9000：够旅行结婚（8000）不够大婚礼（30000）
    const poor = { ...withRels({}, [rel('partner', '林晓', 60)]), money: 9000 }
    const texts = visibleChoices(poor, ev).map((c) => c.text)
    expect(texts).not.toContain('办一场体面的婚礼，把亲戚朋友都请来')
    expect(texts).toContain('旅行结婚，两个人说走就走')
  })
})
