// 第 44 轮：关系真实化测试（名字池 / 搭伴离世 / 孙辈关系与含饴弄孙）
// 验收口径（PROMPT-V3.md 第 44 轮）：
// - 取名 seed 确定性：同 seed 同 salt 同序数必得同名，跨局自然分散
// - 旧档（名字字段缺失）展示降级不露 undefined
// - grandchild 仅在子女成家链路后出现（fam_grandchild 里程碑门槛），含饴弄孙每孙辈至多一次
// - 搭伴真实化：partner 关系 + late_companionship 标记 + 8% 年离世判定（复用第 41 轮身后事语义）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { RELATIONSHIP_EVENTS } from '../data/events/relationship'
import {
  CHILD_NICKNAMES,
  GRANDCHILD_NICKNAMES,
  COMPANION_NAMES,
  pickName,
} from '../data/names'
import { applyRelationEffect, RELATION_DECAY_RATE, relationsLine, relationDeltaChips } from './relations'
import { childAge, pickChildByStage } from './children'
import {
  settleCompanionDeath,
  GRIEF_COMPANION_TAG,
  LATE_COMPANIONSHIP_TAG,
  COMPANION_FUNERAL_COST,
} from './parents'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

describe('第 44 轮：取名池与 seed 确定性（验收①）', () => {
  it('pickName 纯函数：同参必同名、池内取值、不同 salt 分散', () => {
    expect(pickName(CHILD_NICKNAMES, 42, 20, 3)).toBe(pickName(CHILD_NICKNAMES, 42, 20, 3))
    for (let salt = 18; salt < 60; salt++) {
      expect(CHILD_NICKNAMES).toContain(pickName(CHILD_NICKNAMES, 42, salt, 1))
    }
    const spread = new Set(CHILD_NICKNAMES.map((_, i) => pickName(CHILD_NICKNAMES, 42, 20, i)))
    expect(spread.size).toBeGreaterThan(1) // 不同序数至少两种名
  })

  it('name 缺省的 child/grandchild/partner add：名字来自对应池且同参数复现', () => {
    const a = applyRelationEffect([], { kind: 'child', add: true, closeness: 60 }, 26, 26, 42)
    const b = applyRelationEffect([], { kind: 'child', add: true, closeness: 60 }, 26, 26, 42)
    expect(a[0].name).toBe(b[0].name)
    expect(CHILD_NICKNAMES).toContain(a[0].name)
    const g = applyRelationEffect([], { kind: 'grandchild', add: true }, 55, 55, 7)
    expect(GRANDCHILD_NICKNAMES).toContain(g[0].name)
    const p = applyRelationEffect([], { kind: 'partner', add: true, closeness: 55 }, 60, 60, 7)
    expect(COMPANION_NAMES).toContain(p[0].name)
    // 不同 seed 分散：8 个 seed 至少两种名
    const names = new Set(
      Array.from({ length: 8 }, (_, i) => applyRelationEffect([], { kind: 'child', add: true }, 26, 26, i + 1)[0].name),
    )
    expect(names.size).toBeGreaterThanOrEqual(2)
  })

  it('静态具名不受影响：带 name 的 add 维持事件数据写死的名字', () => {
    const r = applyRelationEffect([], { kind: 'friend', add: true, name: '书友小杜' }, 20)
    expect(r[0].name).toBe('书友小杜')
  })

  it('旧档名字字段缺失：顶栏摘要与增量文案降级泛称不露 undefined（验收②）', () => {
    const broken: Relation[] = [
      { id: 'c1', kind: 'child', name: undefined as unknown as string, closeness: 60, alive: true },
    ]
    const s = makeGame(1, { age: 40, relations: broken })
    expect(relationsLine(s)).not.toContain('undefined')
    expect(relationsLine(s)).toContain('孩子')
    const chips = relationDeltaChips([], broken)
    expect(chips.join('|')).not.toContain('undefined')
  })
})

describe('第 44 轮：grandchild 关系与含饴弄孙（验收③）', () => {
  it('孙辈 add 盖章 birthAge；childAge 按 grandchild 解析；年度衰减 0', () => {
    const g = applyRelationEffect([], { kind: 'grandchild', add: true, closeness: 50 }, 58, 58, 1)
    expect(g[0].birthAge).toBe(58)
    expect(childAge(g[0], 62, 'grandchild')).toBe(4)
    expect(childAge(g[0], 62)).toBeNull() // 缺省 kind='child' 不认孙辈
    expect(RELATION_DECAY_RATE.grandchild).toBe(0)
  })

  it('fam_grandchild 选择后孙辈关系建立（乳名池具名+birthAge），资格仍由 ms_wedding 门槛守住', () => {
    const ev = findEvent('fam_grandchild')
    const child: Relation = {
      id: 'c1', kind: 'child', name: '小满', closeness: 60, alive: true,
      birthAge: 25, milestones: ['ms_junior', 'ms_senior', 'ms_adult', 'ms_job', 'ms_wedding'],
    }
    const s = makeGame(1, { age: 55, money: 30000, relations: [child] })
    expect(isEventAvailable(s, ev)).toBe(true)
    const after = applyChoice(s, ev, 2).state // 包红包（零门槛选项）
    const gc = after.relations.find((r) => r.kind === 'grandchild')
    expect(gc).toBeDefined()
    expect(GRANDCHILD_NICKNAMES).toContain(gc!.name)
    expect(gc!.birthAge).toBe(55)
    // 无成家孩子时事件不可用
    const noWedding = makeGame(1, {
      age: 55, money: 30000,
      relations: [{ ...child, milestones: child.milestones!.filter((m) => m !== 'ms_wedding') }],
    })
    expect(isEventAvailable(noWedding, ev)).toBe(false)
  })

  it('含饴弄孙：3 岁 ✓ / 2 岁 ✗ / 无孙辈 ✗ / 已办过该孙辈 ✗（每孙辈至多一次）', () => {
    const ev = findEvent('fam_grandchild_time')
    const gc = (birthAge: number, milestones: string[] = []): Relation => ({
      id: `g${birthAge}`, kind: 'grandchild', name: '豆豆', closeness: 50, alive: true, birthAge, milestones,
    })
    const base = { age: 60, money: 30000 }
    expect(isEventAvailable(makeGame(1, { ...base, relations: [gc(56)] }), ev)).toBe(true) // 4 岁
    expect(isEventAvailable(makeGame(1, { ...base, relations: [gc(58)] }), ev)).toBe(false) // 2 岁
    expect(isEventAvailable(makeGame(1, { ...base, relations: [] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(1, { ...base, relations: [gc(56, ['ms_spoil_afternoon'])] }), ev)).toBe(false)
    // 双孙辈：大的办过来年轮到小的（milestonePending 逐孙独立）
    const two = makeGame(1, { ...base, relations: [gc(56, ['ms_spoil_afternoon']), gc(57)] })
    const picked = pickChildByStage(two.relations, 60, { kind: 'grandchild', atLeast: 3, milestonePending: 'ms_spoil_afternoon' })
    expect(picked?.birthAge).toBe(57)
  })

  it('含饴弄孙选择落地：milestone 记到目标孙辈、亲密度定向增长', () => {
    const ev = findEvent('fam_grandchild_time')
    const older: Relation = { id: 'g1', kind: 'grandchild', name: '豆豆', closeness: 50, alive: true, birthAge: 52, milestones: ['ms_spoil_afternoon'] }
    const younger: Relation = { id: 'g2', kind: 'grandchild', name: '糖糖', closeness: 50, alive: true, birthAge: 57 }
    const s = makeGame(1, { age: 60, money: 30000, relations: [older, younger] })
    const after = applyChoice(s, ev, 0).state
    expect(after.relations.find((r) => r.id === 'g2')!.milestones).toContain('ms_spoil_afternoon')
    expect(after.relations.find((r) => r.id === 'g2')!.closeness).toBe(55)
    expect(after.relations.find((r) => r.id === 'g1')!.closeness).toBe(50) // 不误伤已办过的
  })

  it('validateEvents 全池零 issue（含 milestoneTarget 对 grandchild 的扩展；第 46 轮 +4 → 28）', () => {
    expect(RELATIONSHIP_EVENTS).toHaveLength(28)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})

describe('第 44 轮：搭伴真实化与离世（验收④）', () => {
  const companion: Relation = { id: 'p1', kind: 'partner', name: '陶春', closeness: 55, alive: true }

  it('late_late_companion 选择后 partner 关系建立（伴侣名池具名）+ late_companionship 标记', () => {
    const ev = findEvent('late_late_companion')
    const s = makeGame(1, { age: 62, money: 20000, relations: [] })
    expect(isEventAvailable(s, ev)).toBe(true)
    const after = applyChoice(s, ev, 0).state
    const p = after.relations.find((r) => r.kind === 'partner')
    expect(p).toBeDefined()
    expect(COMPANION_NAMES).toContain(p!.name)
    expect(after.tags).toContain(LATE_COMPANIONSHIP_TAG)
  })

  it('settleCompanionDeath：无标记零判定；有标记按 8% 年率 roll，死亡结构符合第 41 轮语义', () => {
    const noTag = settleCompanionDeath([companion], [], 68, 7)
    expect(noTag.died).toBeNull()
    // 扫 300 seed 找到死亡例与存活例两分支
    let deaths = 0
    let alive = 0
    for (let seed = 1; seed <= 300; seed++) {
      const r = settleCompanionDeath([companion], [LATE_COMPANIONSHIP_TAG], 68, seed)
      if (r.died) {
        deaths++
        expect(r.funeral).toBe(COMPANION_FUNERAL_COST)
      } else alive++
    }
    expect(deaths).toBeGreaterThan(0)
    expect(alive).toBeGreaterThan(0)
    const died = settleCompanionDeath([companion], [LATE_COMPANIONSHIP_TAG], 68, 1)
    if (died.died) {
      const after = died.relations[0]
      expect(after.alive).toBe(false)
      expect(after.deceased).toBe(true)
      expect(after.deathAge).toBe(68)
      expect(after.estranged).toBeUndefined()
    }
  })

  it('advanceYear 集成：伴侣去世年丧葬落账 + grief_companion 哀伤期 + 送别履历；哀伤到期消退', () => {
    // 找一个 68→69 岁去世的 seed
    let seed = -1
    for (let s = 1; s <= 400; s++) {
      if (settleCompanionDeath([companion], [LATE_COMPANIONSHIP_TAG], 69, s).died) {
        seed = s
        break
      }
    }
    expect(seed).toBeGreaterThan(0)
    const withC = makeGame(seed, { age: 68, money: 20000, tags: [LATE_COMPANIONSHIP_TAG], relations: [companion] })
    const alone = makeGame(seed, { age: 68, money: 20000, relations: [] })
    const a = advanceYear(withC)
    const b = advanceYear(alone)
    if (a.relations.some((r) => r.kind === 'partner' && r.deceased)) {
      expect(b.money - a.money).toBe(COMPANION_FUNERAL_COST)
      expect(a.yearLog.join('\n')).toContain('丧事开支')
      expect(a.history.some((h) => h.title === '送别')).toBe(true)
      expect(a.tags).toContain(GRIEF_COMPANION_TAG)
      expect(a.cooldowns[GRIEF_COMPANION_TAG]).toBe(69 + 3)
    }
    // 哀伤期到期消退（复用泛化逻辑；yearLog 只保留当年，逐年捕获防覆盖）
    const grieving = makeGame(7, {
      age: 70,
      relations: [],
      attrs: { ...makeGame().attrs, happiness: 90 },
      tags: [GRIEF_COMPANION_TAG],
      cooldowns: { [GRIEF_COMPANION_TAG]: 72 },
    })
    let cur = grieving
    const logs: string[] = []
    for (let i = 0; i < 3 && cur.phase === 'playing'; i++) {
      cur = advanceYear(cur)
      logs.push(cur.yearLog.join('\n'))
    }
    expect(cur.tags).not.toContain(GRIEF_COMPANION_TAG)
    expect(logs.join('\n')).toContain('时间抚平了一部分哀伤')
  })
})
