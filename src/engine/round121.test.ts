// 第 121 轮（V7）：「另一条路上」遗憾清单——呈现层纯函数测试
// 覆盖：条数上限 3/非 key 与空 choice 跳过/未知 eventId 跳过/单选项事件跳过/
// {name} 占位符插值/alt≠已选文本（来源合法）/克制措辞禁句零命中。
// 浏览器级断言在 keyboard_verify K13 与 mobile_verify M20（CDP 真实局）。
import { describe, it, expect } from 'vitest'
import { buildRegretEntries, REGRET_FORBIDDEN } from '../components/RegretList'
import { ALL_EVENTS } from '../data/events'
import type { HistoryEntry } from '../engine/types'

const H = (age: number, eventId: string, title: string, choice: string, key = true): HistoryEntry => ({
  age,
  eventId,
  title,
  choice,
  summary: '结算摘要',
  key,
})

const relPropose = ALL_EVENTS.find((e) => e.id === 'rel_propose')!

describe('buildRegretEntries（A1 的引擎侧孪生断言）', () => {
  it('条数上限 3：多转折只取前 3', () => {
    const history = [
      H(20, 'rel_propose', relPropose.title, relPropose.choices[0].text),
      H(24, 'rel_propose', relPropose.title, relPropose.choices[0].text),
      H(28, 'rel_propose', relPropose.title, relPropose.choices[0].text),
      H(32, 'rel_propose', relPropose.title, relPropose.choices[0].text),
    ]
    expect(buildRegretEntries(history, '测试者')).toHaveLength(3)
  })
  it('非 key 条目与空 choice 条目跳过；单选项事件跳过（无「另一条路」可指）', () => {
    const noKey = H(20, 'rel_propose', relPropose.title, relPropose.choices[0].text, false)
    const noChoice: HistoryEntry = { age: 21, eventId: 'settle', title: '送别', choice: '', summary: '', key: true }
    const single = ALL_EVENTS.find((e) => e.choices.length === 1)
    const singleEntry = single ? [H(22, single.id, single.title, single.choices[0].text)] : []
    const history = [noKey, noChoice, ...singleEntry]
    expect(buildRegretEntries(history, '测试者')).toHaveLength(0)
  })
  it('未知 eventId 跳过（不 NaN 不空节点）', () => {
    expect(buildRegretEntries([H(20, 'no_such_event', '幽灵', '某选择')], '测试者')).toHaveLength(0)
  })
  it('来源合法：alt ∈ 同事件其他选项文本且 ≠ 已选；{name} 插值为玩家名', () => {
    const taken = relPropose.choices[0].text
    const entry = buildRegretEntries([H(24, 'rel_propose', relPropose.title, taken)], '林知远')[0]
    const otherTexts = relPropose.choices.filter((c) => c.text !== taken).map((c) => c.text.replace(/\{name\}/g, '林知远'))
    expect(otherTexts).toContain(entry.alt)
    expect(entry.alt).not.toBe(taken)
    expect(entry.alt).not.toContain('{name}')
  })
  it('克制措辞：生成的 alt 与禁句表零交集', () => {
    const history = [H(24, 'rel_propose', relPropose.title, relPropose.choices[0].text)]
    const alts = buildRegretEntries(history, '测试者').map((e) => e.alt)
    for (const f of REGRET_FORBIDDEN) for (const a of alts) expect(a.includes(f)).toBe(false)
  })
})
