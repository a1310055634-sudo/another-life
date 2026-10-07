// 第 50 轮：成就二期测试（41→46，逐枚正反 + 可达路线 + 动态计数）
// 验收口径（PROMPT-V3.md 第 50 轮）：
// - 每枚新成就正反测试（check 两侧）+ 可达路线记录（注释对应 V3 机制来源）
// - 不误奖励富裕开局：新成就 check 均不读存款线（构造 bg_wealthy 态逐枚断言不误授）
// - 成就总数动态显示（HomePage 读 ACHIEVEMENTS 长度，无硬编码 41/46）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { ACHIEVEMENTS, evaluateAchievements } from './achievements'
import { validateState } from './validate'
import type { GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function unlockedIds(s: GameState): string[] {
  return evaluateAchievements(s).map((a) => a.id)
}

function has(id: string, s: GameState): boolean {
  return unlockedIds(s).includes(id)
}

describe('第 50 轮：成就二期数据完整性', () => {
  it('成就 41→46：id 唯一、新 5 枚在册、无 hidden（隐藏成就保持恰 3 枚）', () => {
    // R100 同步：52 → 59（第 100 轮成就四期 +7）
    expect(ACHIEVEMENTS).toHaveLength(66)
    const newIds = [
      'ach_final_sendoff',
      'ach_grandparent_time',
      'ach_chronic_lived',
      'ach_match_made',
      'ach_next_door',
    ]
    for (const id of newIds) expect(ACHIEVEMENTS.find((a) => a.id === id)).toBeDefined()
    expect(ACHIEVEMENTS.filter((a) => a.hidden).length).toBe(3)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(66)
  })

  it('全成就 check 幂等纯函数（同态两次结果一致）', () => {
    const s = makeGame(7)
    expect(evaluateAchievements(s).map((a) => a.id)).toEqual(evaluateAchievements(s).map((a) => a.id))
  })
})

describe('第 50 轮：逐枚正反（验收①）', () => {
  it('送终：有送别履历 ✓ / 无 ✗（可达路线：第 41 轮概率表，父母 90+ 年 15%）', () => {
    const withFarewell = makeGame(1, {
      age: 70,
      history: [{ age: 68, eventId: 'settle', title: '送别', choice: '', summary: '母亲去世了', key: true }],
    })
    expect(has('ach_final_sendoff', withFarewell)).toBe(true)
    expect(has('ach_final_sendoff', makeGame(1, { age: 70 }))).toBe(false)
  })

  it('含饴弄孙：办过下午的孙辈 ✓ / 只有孙辈没办 ✗ / 无孙辈 ✗（路线：fam_grandchild→time 链）', () => {
    const gc = (milestones: string[]): Relation => ({
      id: 'g1', kind: 'grandchild', name: '豆豆', closeness: 50, alive: true, birthAge: 52, milestones,
    })
    expect(has('ach_grandparent_time', makeGame(1, { age: 60, relations: [gc(['ms_spoil_afternoon'])] }))).toBe(true)
    expect(has('ach_grandparent_time', makeGame(1, { age: 60, relations: [gc([])] }))).toBe(false)
    expect(has('ach_grandparent_time', makeGame(1, { age: 60, relations: [] }))).toBe(false)
  })

  it('带病延年：确诊+72 岁 ✓ / 确诊+65 岁 ✗ / 未确诊 72 岁 ✗（路线：onset 最早 62 → 72 蕴含 ≥10 年）', () => {
    const base = { money: 20000, relations: [] }
    expect(has('ach_chronic_lived', makeGame(1, { age: 72, seenEvents: ['hlt_chronic_onset'], ...base }))).toBe(true)
    expect(has('ach_chronic_lived', makeGame(1, { age: 65, seenEvents: ['hlt_chronic_onset'], ...base }))).toBe(false)
    expect(has('ach_chronic_lived', makeGame(1, { age: 72, ...base }))).toBe(false)
  })

  it('相识即缘分：went_* 任一 + married ✓ / 已婚无入口标记 ✗ / 有标记未婚 ✗（路线：46 轮入口→求婚链）', () => {
    const base = { age: 40, money: 20000, relations: [] }
    expect(has('ach_match_made', makeGame(1, { tags: ['married', 'went_app'], ...base }))).toBe(true)
    expect(has('ach_match_made', makeGame(1, { tags: ['married', 'went_blind_date'], ...base }))).toBe(true)
    expect(has('ach_match_made', makeGame(1, { tags: ['married'], ...base }))).toBe(false)
    expect(has('ach_match_made', makeGame(1, { tags: ['went_app'], ...base }))).toBe(false)
  })

  it('远亲不如对门：neighbor_bond ✓ / 无 ✗（路线：第 47 轮对门钥匙事件）', () => {
    expect(has('ach_next_door', makeGame(1, { age: 66, tags: ['neighbor_bond'] }))).toBe(true)
    expect(has('ach_next_door', makeGame(1, { age: 66 }))).toBe(false)
  })

  it('不误奖励富裕开局：bg_wealthy 构造态对新 5 枚全不误授（存款线零依赖）', () => {
    const wealthy = makeGame(1, {
      age: 72,
      money: 2_000_000,
      relations: [],
      tags: ['bg_wealthy', 'ever_employed', 'retired'],
    })
    for (const id of [
      'ach_final_sendoff',
      'ach_grandparent_time',
      'ach_chronic_lived',
      'ach_match_made',
      'ach_next_door',
    ]) {
      expect(`${id} wealthy=${has(id, wealthy)}`).toBe(`${id} wealthy=false`)
    }
  })
})

describe('第 50 轮：行为级可达（真实推进解锁）', () => {
  it('送终：送别履历在册 → 成就解锁且跨年结算不回退（advanceYear 集成）', () => {
    // 送别履历由第 41 轮去世结算产生（概率表路径已有 round41 孪生覆盖）；
    // 此处验证成就判定读得到它，且解锁落账跨年稳定。
    const withDeath = makeGame(1, {
      age: 76,
      tags: ['ever_employed', 'retired'],
      relations: [
        { id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: false, deceased: true, deathAge: 100 },
      ],
      history: [{ age: 74, eventId: 'settle', title: '送别', choice: '', summary: '母亲去世了', key: true }],
    })
    expect(has('ach_final_sendoff', withDeath)).toBe(true)
    const next = advanceYear(withDeath)
    expect(next.achievements).toContain('ach_final_sendoff')
    expect(validateState(next).issues).toEqual([])
  })

  it('带病延年：确诊局真实推进到 72 岁 → 成就解锁（session 路径不适用，用结算集成）', () => {
    const diagnosed = makeGame(1, {
      age: 71,
      money: 20000,
      relations: [],
      tags: ['chronic_condition'],
      seenEvents: ['hlt_chronic_onset'],
    })
    const next = advanceYear(diagnosed)
    expect(next.age).toBe(72)
    expect(next.achievements).toContain('ach_chronic_lived')
  })
})
