// 第 66 轮：挚友线测试（朋友具名池 / 挚友标记升降 / 双档衰减 / 4 事件正反）
// 验收口径（PROMPT-V4.md 第 66 轮）：
// - A1 取名：FRIEND_NICKNAMES 池 seed 确定，静态具名仍优先，泛称兜底不露 undefined
// - A2 标记升降：≥60 盖、<40 摘、边界年精确（59 不升/60 升、40 摘/41 不摘）
// - A3 双档衰减：挚友 −1、普通朋友 −2（衰减表 friend=2 为普通档不变）
// - 旧档（无 bestFriend 字段）兼容；validate 守卫非布尔清除
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyRelationEffect, settleBestFriendMarks, settleRelationDecay, relationsLine } from './relations'
import { isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { FRIEND_EVENTS } from '../data/events/friends'
import { FRIEND_NICKNAMES } from '../data/names'
import type { GameEvent, GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function byId(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const friend = (closeness: number, patch: Partial<Relation> = {}): Relation => ({
  id: 'f1', kind: 'friend', name: '老周', closeness, alive: true, ...patch,
})

describe('第 66 轮：朋友取名池（A1）', () => {
  it('friend 无静态名时入池 seed 确定具名；静态具名优先；泛称兜底不露 undefined', () => {
    const a = applyRelationEffect([], { kind: 'friend', add: true, closeness: 55 }, 26, 26, 7)
    expect(FRIEND_NICKNAMES).toContain(a[0].name)
    const b = applyRelationEffect([], { kind: 'friend', add: true, closeness: 55 }, 26, 26, 7)
    expect(a[0].name).toBe(b[0].name) // 同参复现
    const named = applyRelationEffect([], { kind: 'friend', add: true, name: '书友小杜' }, 26)
    expect(named[0].name).toBe('书友小杜') // 静态具名优先
    const s = makeGame(7, {
      relations: [{ id: 'f9', kind: 'friend', name: undefined as unknown as string, closeness: 50, alive: true }],
    })
    expect(relationsLine(s)).toContain('朋友')
    expect(relationsLine(s)).not.toContain('undefined')
  })
})

describe('第 66 轮：挚友标记升降与双档衰减（A2/A3）', () => {
  it('升降正反：≥60 盖、<40 摘、59 不升、40 不摘（<40 严格）； promoted/demoted 回报名单', () => {
    const up = settleBestFriendMarks([friend(60)])
    expect(up.relations[0].bestFriend).toBe(true)
    expect(up.promoted).toEqual(['老周'])
    const hold = settleBestFriendMarks([friend(59)])
    expect(hold.relations[0].bestFriend).toBeUndefined()
    const down = settleBestFriendMarks([friend(39, { bestFriend: true })])
    expect(down.relations[0].bestFriend).toBe(false)
    expect(down.demoted).toEqual(['老周'])
    const edge = settleBestFriendMarks([friend(40, { bestFriend: true })])
    expect(edge.relations[0].bestFriend).toBe(true) // 40 不摘
  })

  it('双档衰减正解：普通 −2 / 挚友 −1（衰减表 friend=2 为普通档不变）', () => {
    const plain = settleRelationDecay([friend(65)])
    expect(plain.relations[0].closeness).toBe(63)
    const best = settleRelationDecay([friend(65, { bestFriend: true })])
    expect(best.relations[0].closeness).toBe(64)
    const falling = settleRelationDecay([friend(40, { bestFriend: true })])
    expect(falling.relations[0].closeness).toBe(39)
  })

  it('lifecycle 集成：friend 63 岁结 → 衰减 61 → 当年盖挚友标记，年志留痕', () => {
    const s = makeGame(7, { age: 40, relations: [friend(63)] })
    const after = advanceYear(s)
    const r = after.relations.find((x) => x.id === 'f1')!
    expect(r.closeness).toBe(61)
    expect(r.bestFriend).toBe(true)
    expect(after.yearLog.join('\n')).toContain('挚友')
  })

  it('旧档（无 bestFriend 字段）零 issue；bestFriend 非布尔清除（validate 守卫）', () => {
    const legacy = makeGame(7, { relations: [friend(50)] })
    expect(validateState(legacy).issues).toEqual([])
    const broken = makeGame(7, { relations: [friend(50, { bestFriend: 'yes' as unknown as boolean })] })
    validateState(broken)
    expect(broken.relations[0].bestFriend).toBeUndefined()
  })
})

describe('第 66 轮：挚友事件正反（A2）', () => {
  it('frd_late_talk：低幸福+朋友在册可用；幸福高位/无朋友不可用', () => {
    const ev = byId('frd_late_talk')
    const attrsLow = { ...makeGame().attrs, happiness: 35 }
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: attrsLow, relations: [friend(65)] }), ev)).toBe(true)
    const attrsHigh = { ...makeGame().attrs, happiness: 55 }
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: attrsHigh, relations: [friend(65)] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: attrsLow, relations: [] }), ev)).toBe(false)
  })

  it('frd_bestman：配偶与朋友同在可用（双键 AND）；缺一不可', () => {
    const ev = byId('frd_bestman')
    expect(isEventAvailable(makeGame(7, {
      age: 30,
      relations: [friend(65), { id: 'sp1', kind: 'spouse', name: '小赵', closeness: 70, alive: true }],
    }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, relations: [friend(65)] }), ev)).toBe(false)
  })

  it('frd_cross_city 修复线（≤55）/frd_quarrel_reconcile 口角线（≤35）：阈值两侧各正一反', () => {
    const visit = byId('frd_cross_city')
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [friend(50)] }), visit)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [friend(65)] }), visit)).toBe(false)
    const quarrel = byId('frd_quarrel_reconcile')
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [friend(30)] }), quarrel)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, relations: [friend(50)] }), quarrel)).toBe(false)
  })

  it('文件计数 6（全池 282）、validateEvents 全池零 issue', () => {
    expect(FRIEND_EVENTS).toHaveLength(8)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
