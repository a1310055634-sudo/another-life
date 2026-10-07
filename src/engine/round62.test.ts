// 第 62 轮：孙辈链路打通测试（fam_grandchild 闸门 29→26、婚礼窗 26–28→26–30、
// late_story_grandchild 资格校准的正反用例见 round29.test.ts 第 62 轮块）。
// 验收口径（PROMPT-V4.md 第 62 轮）：孙辈仅在子女成家链路后出现（V3 R44 验收
// 不推翻——ms_wedding 门槛保留），链路三站（成家→添孙→含饴弄孙）无缝衔接。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, isEventAvailable, visibleChoices } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
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

/** 玩家 30 岁生孩子：玩家年龄 = 30 + 孩子当前年龄 */
const child = (birthAge: number, milestones: string[] = []): Relation => ({
  id: 'c1', kind: 'child', name: '小满', closeness: 60, alive: true, birthAge, milestones,
})
const atChildAge = (age: number, rel: Relation): GameState =>
  makeGame(7, { age: 30 + age, relations: [rel] })

describe('第 62 轮：孙辈链路打通', () => {
  it('fam_grandchild 资格四路：无子女/未达龄/未成家不可达；26 岁成家即可达（原 29 闸放宽）', () => {
    const ev = byId('fam_grandchild')
    const wedded = ['ms_wedding']
    // ① 无子女：不可达
    expect(isEventAvailable(makeGame(7, { age: 60, relations: [] }), ev)).toBe(false)
    // ② 孩子 25 岁即已成家（未达龄）：不可达
    expect(isEventAvailable(atChildAge(25, child(30, wedded)), ev)).toBe(false)
    // ③ 孩子 26 岁已成家：可达（第 62 轮新窗口）
    expect(isEventAvailable(atChildAge(26, child(30, wedded)), ev)).toBe(true)
    // ④ 孩子 26 岁未成家：不可达（ms_wedding 门槛守住「仅在成家链路后」，V3 R44 验收不推翻）
    expect(isEventAvailable(atChildAge(26, child(30)), ev)).toBe(false)
    // 回归：≥29 岁成家仍可达（原窗口不收窄）
    expect(isEventAvailable(atChildAge(31, child(30, wedded)), ev)).toBe(true)
    // 每孩至多一次：办过 ms_grandchild 不再出现
    expect(isEventAvailable(atChildAge(26, child(30, [...wedded, 'ms_grandchild'])), ev)).toBe(false)
  })

  it('fam_child_wedding 婚礼窗 26–30（自 26–28 放宽）：29 岁仍可成家、30 岁关窗', () => {
    const ev = byId('fam_child_wedding')
    expect(isEventAvailable(atChildAge(26, child(30)), ev)).toBe(true)
    expect(isEventAvailable(atChildAge(29, child(30)), ev)).toBe(true)
    expect(isEventAvailable(atChildAge(30, child(30)), ev)).toBe(false)
  })

  it('孙链三站无缝衔接：26 岁成家→同岁可添孙（birthAge 盖章）→孙辈 3 岁含饴弄孙可达', () => {
    // 玩家 56 岁：孩子 26 岁已成家未办孙辈 → fam_grandchild 可见
    const s = atChildAge(26, child(30, ['ms_wedding']))
    const ev = byId('fam_grandchild')
    const vis = visibleChoices(s, ev)
    expect(vis.length).toBeGreaterThanOrEqual(2)
    const after = applyChoice(s, ev, ev.choices.indexOf(vis[vis.length - 1])).state
    const gc = after.relations.find((r) => r.kind === 'grandchild')
    expect(gc).toBeDefined()
    expect(gc!.birthAge).toBe(56)
    // 玩家 59 岁：孙辈 3 岁 → 含饴弄孙可达（改动前需玩家 62 岁）
    const spoil = byId('fam_grandchild_time')
    expect(isEventAvailable(makeGame(7, { age: 59, relations: [child(30, ['ms_wedding']), gc!] }), spoil)).toBe(true)
  })

  it('validateEvents 全池零 issue（63/65/66/67/68 轮 +3+8+4+5+6，全池计数 178→214）', () => {
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
})
