// 第 25 轮：关系动态测试（亲密度年度自然衰减 + 维护事件 + 父母健康下滑线）
// 验收口径：
// - 30 年不维护的朋友降至疏远阈值（friend -2/年 → 25 年归零走既有疏远兜底）
// - 维护事件真实恢复亲密度（问候/纪念日精确增量；维护线 vs 不维护线分化）
// - 照护选择有真实成本（rel_parent_frail 三条照护线授予 cared_for_parents，转钱线不授）
// - estranged 与已移除关系不衰减（不重复伤害）；衰减不消耗 RNG，同 seed 复现不受影响
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, checkCondition, conditionFailReason, isEventAvailable, visibleChoices } from './events'
import { validateState } from './validate'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { RELATIONSHIP_EVENTS } from '../data/events/relationship'
import { aliveOf } from './relations'
import {
  RELATION_DECAY_RATE,
  RELATION_YELLOW_LINE,
  settleRelationDecay,
} from './relations'
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

/** 按文本找到选项的【原始索引】（applyChoice 按完整 choices 数组定位） */
function choiceIndex(event: GameEvent, text: string): number {
  const i = event.choices.findIndex((c) => c.text === text)
  if (i === -1) throw new Error(`选项不存在: ${text}`)
  return i
}

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(ev, text)).state
}

const rel = (id: string, kind: Relation['kind'], closeness: number, extra: Partial<Relation> = {}): Relation => ({
  id,
  kind,
  name: id,
  closeness,
  alive: true,
  ...extra,
})

describe('衰减模型纯函数（settleRelationDecay）', () => {
  it('速率表：稳定关系（配偶/恋人/父母/孩子）慢于朋友（"配偶低、朋友高"），宠物零衰减，全部非负', () => {
    expect(RELATION_DECAY_RATE.friend).toBe(2)
    expect(RELATION_DECAY_RATE.partner).toBe(1)
    expect(RELATION_DECAY_RATE.partner).toBe(1)
    expect(RELATION_DECAY_RATE.spouse).toBeLessThan(RELATION_DECAY_RATE.friend)
    expect(RELATION_DECAY_RATE.parent).toBeLessThan(RELATION_DECAY_RATE.friend)
    expect(RELATION_DECAY_RATE.spouse).toBe(1)
    expect(RELATION_DECAY_RATE.child).toBe(1)
    expect(RELATION_DECAY_RATE.pet).toBe(0)
    expect(RELATION_DECAY_RATE.sibling).toBe(1) // 第 64 轮手足：稳定关系口径
    expect(RELATION_DECAY_RATE.colleague).toBe(2) // 第 115 轮同事：朋友口径（离开工位就淡）
    expect(RELATION_DECAY_RATE.neighbor).toBe(1) // 第 115 轮邻居：稳定关系口径（抬头不见低头见）
    for (const rate of Object.values(RELATION_DECAY_RATE)) expect(rate).toBeGreaterThanOrEqual(0)
  })

  it('按种类衰减：朋友 -2、父母 -1、配偶 -1、宠物不动；纯函数不修改入参', () => {
    const rels: Relation[] = [
      rel('f1', 'friend', 50),
      rel('p1', 'parent', 55),
      rel('s1', 'spouse', 70),
      rel('pet1', 'pet', 60),
    ]
    const out = settleRelationDecay(rels)
    expect(out.relations.find((r) => r.id === 'f1')!.closeness).toBe(48)
    expect(out.relations.find((r) => r.id === 'p1')!.closeness).toBe(54)
    expect(out.relations.find((r) => r.id === 's1')!.closeness).toBe(69)
    expect(out.relations.find((r) => r.id === 'pet1')!.closeness).toBe(60)
    expect(rels[0].closeness).toBe(50)
  })

  it('estranged 与已移除（alive=false）的关系不衰减——疏远语义不重复伤害', () => {
    const rels: Relation[] = [
      rel('f1', 'friend', 40, { alive: false, estranged: true }),
      rel('f2', 'friend', 40, { alive: false }),
    ]
    const out = settleRelationDecay(rels)
    expect(out.relations[0].closeness).toBe(40)
    expect(out.relations[1].closeness).toBe(40)
    expect(out.warnings).toHaveLength(0)
  })

  it('clamp 到 0 不穿底；升不反弹', () => {
    const out = settleRelationDecay([rel('f1', 'friend', 1)])
    expect(out.relations[0].closeness).toBe(0)
    expect(out.relations[0].alive).toBe(true)
  })

  it('跌破黄灯线（20）当年恰提示一次；20 → 20 不提示；持续低位不重复提示', () => {
    expect(RELATION_YELLOW_LINE).toBe(20)
    const cross = settleRelationDecay([rel('f1', 'friend', 21)])
    expect(cross.warnings).toEqual([{ kind: 'friend', name: 'f1' }])
    const atLine = settleRelationDecay([rel('f1', 'friend', 22)])
    expect(atLine.relations[0].closeness).toBe(20)
    expect(atLine.warnings).toHaveLength(0)
    const alreadyLow = settleRelationDecay([rel('f1', 'friend', 10)])
    expect(alreadyLow.warnings).toHaveLength(0)
  })
})

describe('年度结算接线（advanceYear）', () => {
  it('推进一年：朋友 50→48、父母 55→54；衰减不消耗 RNG（波动序列与 rngState 不受影响）', () => {
    const a = makeGame(7, {
      age: 30,
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 50)],
    })
    const b = advanceYear(a)
    expect(b.relations.find((r) => r.id === 'f1')!.closeness).toBe(48)
    expect(b.relations.find((r) => r.id === 'father')!.closeness).toBe(54)
    // 衰减前后 rngState 一致（对照：只带零衰减宠物的同 seed 局）——衰减不消耗随机数
    const c = advanceYear(makeGame(7, { age: 30, relations: [rel('pet1', 'pet', 60)] }))
    expect(b.rngState).toBe(c.rngState)
  })

  it('当年新增/复活的关系来年起算（延迟关系落地当年不被衰减）', () => {
    // 相亲认真去见 → 次年延迟落地 partner；落地当年不得被衰减（与"标记次年生效"同时序）。
    // 落地值 45→55 为第 39 轮平衡有意调整（300 局对照：45 落地配 −1/年衰减 + 旧求婚门槛
    // 使婚姻链 0% 可达），断言锚定新常量。
    const single = makeGame(7, { age: 26 })
    const next = choose(single, 'rel_blind_date', '认真去见一见')
    const after = advanceYear(next)
    expect(aliveOf(after.relations, 'partner')?.closeness).toBe(55)
    // 再推一年才衰减（partner -1）
    expect(advanceYear(after).relations.find((r) => r.kind === 'partner')!.closeness).toBe(54)
  })

  it('30 年不维护的朋友降至疏远阈值：alive=false + estranged + 标记 + 疏远当年年志 + 履历', () => {
    let s = makeGame(7, {
      age: 28,
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 50)],
    })
    // yearLog 只保留当前年：疏远发生在第 25 年（50 − 2×25 = 0），在翻转当年捕获年志
    let brokeLog = ''
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) {
      s = advanceYear(s)
      if (!brokeLog && s.relations.find((r) => r.id === 'f1')?.alive === false) {
        brokeLog = s.yearLog.find((l) => l.includes('断了来往')) ?? ''
      }
    }
    const f = s.relations.find((r) => r.id === 'f1')!
    expect(f.alive).toBe(false)
    expect(f.estranged).toBe(true)
    expect(s.tags).toContain('estranged_friend')
    expect(brokeLog).toContain('断了来往')
    expect(s.history.some((h) => h.title === '疏远' && h.summary.includes('f1'))).toBe(true)
  })

  it('30 年不维护的配偶仍存活（-1/年 × 30 = -30，衰减低于朋友）', () => {
    let s = makeGame(7, {
      age: 28,
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('sp1', 'spouse', 80)],
    })
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) s = advanceYear(s)
    const sp = s.relations.find((r) => r.id === 'sp1')!
    expect(sp.alive).toBe(true)
    expect(sp.closeness).toBe(50)
  })

  it('跌破黄灯线的年志提示恰一次（跨年后不再重复）', () => {
    let s = makeGame(7, {
      age: 40,
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 22)],
    })
    s = advanceYear(s) // 22 → 20（不提示）
    expect(s.yearLog.some((l) => l.includes('f1'))).toBe(false)
    s = advanceYear(s) // 20 → 18（跌破，提示一次）
    expect(s.yearLog.filter((l) => l.includes('你和f1之间的话越来越少了'))).toHaveLength(1)
    s = advanceYear(s) // 18 → 16（已在低位，不重复提示）
    expect(s.yearLog.filter((l) => l.includes('你和f1之间的话越来越少了'))).toHaveLength(0)
  })

  it('衰减归零的关系由既有疏远兜底同年接手（不另建破裂机制）', () => {
    const s = makeGame(7, { age: 30, relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 2)] })
    const after = advanceYear(s)
    const f = after.relations.find((r) => r.id === 'f1')!
    expect(f.alive).toBe(false)
    expect(f.estranged).toBe(true)
  })
})

describe('维护事件真实恢复', () => {
  it('朋友问候 rel_friend_checkin：三条路线 +5/+3/-4 精确；无门槛全员可用', () => {
    const s = makeGame(7, { age: 30, money: 50000, relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 40)] })
    expect(isEventAvailable(s, findEvent('rel_friend_checkin'))).toBe(true)
    const up = choose(s, 'rel_friend_checkin', '好好回一条，把见面定下来')
    expect(up.relations.find((r) => r.id === 'f1')!.closeness).toBe(45)
    const talk = choose(s, 'rel_friend_checkin', '直接拨过去，语音聊到后半夜')
    expect(talk.relations.find((r) => r.id === 'f1')!.closeness).toBe(43)
    const idle = choose(s, 'rel_friend_checkin', '点个赞，继续已读不回')
    expect(idle.relations.find((r) => r.id === 'f1')!.closeness).toBe(36)
  })

  it('父母问候 rel_parent_greeting：+8 精确（作用于第一条存活同类关系，引擎既有语义）；无父母关系不可触发', () => {
    const s = makeGame(7, { age: 30 })
    expect(isEventAvailable(s, findEvent('rel_parent_greeting'))).toBe(true)
    const call = choose(s, 'rel_parent_greeting', '陪他们聊一个钟头的家常')
    expect(call.relations.find((r) => r.id === 'father')!.closeness).toBe(63)
    const none = makeGame(7, { age: 30, relations: [] })
    expect(isEventAvailable(none, findEvent('rel_parent_greeting'))).toBe(false)
  })

  it('纪念日 rel_anniversary：+8/+5/-8 精确；单身不可触发', () => {
    const s = makeGame(7, {
      age: 30,
      money: 50000,
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('sp1', 'spouse', 70)],
    })
    expect(isEventAvailable(s, findEvent('rel_anniversary'))).toBe(true)
    const dinner = choose(s, 'rel_anniversary', '订下TA念叨了很久的那家餐厅')
    expect(dinner.money).toBe(47000)
    expect(dinner.relations.find((r) => r.id === 'sp1')!.closeness).toBe(78)
    const forgot = choose(s, 'rel_anniversary', '忙忘了，补救已经来不及')
    expect(forgot.relations.find((r) => r.id === 'sp1')!.closeness).toBe(62)
    const single = makeGame(7, { age: 30 })
    expect(isEventAvailable(single, findEvent('rel_anniversary'))).toBe(false)
  })

  it('负债时纪念日餐厅选项被大额门槛隐藏，仍有 2 个有效选项（≥2 规则）', () => {
    const debt = makeGame(7, {
      age: 30,
      money: -5000,
      relations: [rel('sp1', 'spouse', 70)],
    })
    const texts = visibleChoices(debt, findEvent('rel_anniversary')).map((c) => c.text)
    expect(texts).not.toContain('订下TA念叨了很久的那家餐厅')
    expect(texts).toContain('在家复刻第一顿饭的菜单')
    expect(texts).toContain('忙忘了，补救已经来不及')
  })

  it('维护净效应：每 3 年认真回一次问候（10 年 4 次 +20）恰好抵消衰减；不维护 10 年掉 20 点', () => {
    const maintained = (): GameState => {
      let s = makeGame(7, { age: 28, relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 40)] })
      for (let year = 0; year < 10; year++) {
        if (isEventAvailable(s, findEvent('rel_friend_checkin'))) {
          s = choose(s, 'rel_friend_checkin', '好好回一条，把见面定下来')
        }
        s = advanceYear(s)
      }
      return s
    }
    const neglected = (): GameState => {
      let s = makeGame(7, { age: 28, relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 40)] })
      for (let year = 0; year < 10; year++) s = advanceYear(s)
      return s
    }
    const m = maintained().relations.find((r) => r.id === 'f1')!
    const n = neglected().relations.find((r) => r.id === 'f1')!
    // 维护线：40 + 4×5（第 0/3/6/9 年各 +5）− 10×2 = 40（刚好守住）；不维护线：40 − 20 = 20
    expect(m.closeness).toBe(40)
    expect(m.alive).toBe(true)
    expect(n.closeness).toBe(20)
  })
})

describe('父母健康下滑线（rel_parent_frail）', () => {
  it('照护三选（接同住/花钱/花精力）都授予 cared_for_parents，成本真实扣账', () => {
    const base = makeGame(7, { age: 35, money: 100000 })
    const moveIn = choose(base, 'rel_parent_frail', '接他们过来一起住')
    expect(moveIn.money).toBe(92000)
    expect(moveIn.tags).toContain('cared_for_parents')
    expect(moveIn.relations.find((r) => r.id === 'father')!.closeness).toBe(63)

    const reno = choose(base, 'rel_parent_frail', '出钱做适老化改造，再请个钟点护工')
    expect(reno.money).toBe(85000)
    expect(reno.tags).toContain('cared_for_parents')

    const visit = choose(base, 'rel_parent_frail', '每周雷打不动回去陪一天')
    expect(visit.money).toBe(99500)
    expect(visit.tags).toContain('cared_for_parents')
    expect(visit.attrs.health).toBeLessThan(base.attrs.health)
  })

  it('只转钱不算照护：不授标记，亲密度 -6（与 mid_parent_health「顾不上多过问」同构）', () => {
    const s = makeGame(7, { age: 35, money: 100000 })
    const wired = choose(s, 'rel_parent_frail', '转一笔钱过去，让他们自己安排')
    expect(wired.money).toBe(97500)
    expect(wired.tags).not.toContain('cared_for_parents')
    expect(wired.relations.find((r) => r.id === 'father')!.closeness).toBe(49)
  })

  it('无存活父母不可触发；年龄窗 32 岁起（父母 60+）；负债时大额选项隐藏仍剩 2 个抉择', () => {
    const young = makeGame(7, { age: 31 })
    expect(isEventAvailable(young, findEvent('rel_parent_frail'))).toBe(false)
    const aged = makeGame(7, { age: 35 })
    expect(isEventAvailable(aged, findEvent('rel_parent_frail'))).toBe(true)
    const orphan = makeGame(7, { age: 35, relations: [] })
    expect(isEventAvailable(orphan, findEvent('rel_parent_frail'))).toBe(false)
    const debt = makeGame(7, { age: 35, money: -8000 })
    const texts = visibleChoices(debt, findEvent('rel_parent_frail')).map((c) => c.text)
    expect(texts).not.toContain('接他们过来一起住')
    expect(texts).not.toContain('出钱做适老化改造，再请个钟点护工')
    expect(texts).toContain('每周雷打不动回去陪一天')
    expect(texts).toContain('转一笔钱过去，让他们自己安排')
  })

  it('条件镜像：checkCondition 与玩家语言门槛一致（15 万门槛的真实拒绝理由）', () => {
    const poor = makeGame(7, { age: 35, money: 5000 })
    const ev = findEvent('rel_parent_frail')
    const choice = ev.choices.find((c) => c.text.includes('适老化改造'))!
    expect(checkCondition(poor, choice.requires)).toBe(false)
    expect(conditionFailReason(poor, choice.requires)).toContain('存款')
  })
})

describe('数据校验与回归保护', () => {
  it('关系事件 28 个（第 44 轮 +1 含饴弄孙、第 46 轮 +4 婚恋入口）；全池 208 个过校验器', () => {
    expect(RELATIONSHIP_EVENTS).toHaveLength(28)
    // 第 42 轮父母去世事件线落新文件 data/events/parents.ts（+6），relationship.ts 不动；
    // 第 43 轮慢病长期线 +2 全落 health.ts；第 44 轮 +1、第 46 轮 +4 落 relationship.ts；
    // 第 47 轮 +8 全落 late.ts；第 63 轮教育纵深 +3 全落 education.ts（178→181）；
    // 第 65 轮手足事件线 +8 落 siblings.ts（→189）；第 66 轮挚友线 +4 落 friends.ts（→193）；
    // 第 67 轮婚姻深水区 +5 落 marriage.ts（→198）；第 68 轮倦怠线 +6（midlife 5/late 1 → 204）
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })

  it('疏远复活链路不回归：estranged_friend 标记解锁旧号码，拨通后复活；复活后继续衰减', () => {
    const s = makeGame(7, {
      age: 30,
      tags: ['estranged_friend'],
      relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 0, { alive: false, estranged: true })],
    })
    const next = choose(s, 'rel_reconnect_friend', '拨通那个号码')
    const f = next.relations.find((r) => r.id === 'f1')!
    expect(f.alive).toBe(true)
    expect(f.closeness).toBe(30)
    // 复活把亲密度抬回 30；此后的年度推进照常衰减（friend −2 → 28）——
    // "来年起算"的豁免只保护结算中途落地的新关系，选择时即时复活的关系次年起正常经营
    const nextYear = advanceYear(next)
    expect(nextYear.relations.find((r) => r.id === 'f1')!.closeness).toBe(28)
  })

  it('validateState：衰减后的状态全部合法（30 年推进无关系结构问题）', () => {
    let s = makeGame(7, { age: 28, relations: [rel('father', 'parent', 55), rel('mother', 'parent', 60), rel('f1', 'friend', 50)] })
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) s = advanceYear(s)
    expect(validateState(s).issues).toEqual([])
  })

  it('条件读取：黄灯线以下才可见的低亲密度事件体系不受衰减破坏（rel_parent_low 语义）', () => {
    const s = makeGame(7, { age: 30 })
    const drained = advanceYear({ ...s, relations: s.relations.map((r) => ({ ...r, closeness: 1 })) })
    // 衰减 clamp 0 → 既有疏远兜底：疏远后 minCloseness 不满足、relationKinds 不算存活
    for (const r of drained.relations) {
      expect(r.alive).toBe(false)
    }
    expect(checkCondition(drained, { relationKinds: ['parent'] })).toBe(false)
    expect(checkCondition(drained, { maxCloseness: { parent: 15 } })).toBe(false)
  })
})
