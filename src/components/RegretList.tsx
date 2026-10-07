// 第 121 轮（V7）：「另一条路上」遗憾清单——终局页的克制回望（呈现层，引擎只读）。
// 数据源 = history 中 key:true 且 choice 非空的转折条目（玩家真实选择过的岔路口），
// 按 eventId 只读查事件表取「同事件其他选项之一」的文本作另一条路的意象。
// 措辞纪律：以「另一条路上的人」视角，禁「你本应该」式追责语气；至多 3 条；
// 无合资格转折 → 整卡不渲染（降级，无 NaN/空节点）。
import { ALL_EVENTS } from '../data/events'
import type { HistoryEntry } from '../engine/types'

export interface RegretEntry {
  age: number
  title: string
  choice: string
  alt: string
}

/** 克制措辞禁句自查用（round121.test 断言零命中） */
export const REGRET_FORBIDDEN = ['你本应该', '你本来应该', '你早该', '后悔了吧']

/** 转折履历 → 遗憾条目（至多 3 条；playerName 用于选项文本的 {name} 占位符插值） */
export function buildRegretEntries(history: HistoryEntry[], playerName: string): RegretEntry[] {
  const out: RegretEntry[] = []
  for (const h of history) {
    if (out.length >= 3) break
    if (!h.key || !h.choice || h.choice.length === 0) continue
    const ev = ALL_EVENTS.find((e) => e.id === h.eventId)
    if (!ev) continue
    const altChoice = ev.choices.find((c) => c.text !== h.choice)
    if (!altChoice) continue
    out.push({
      age: h.age,
      title: h.title,
      choice: h.choice,
      alt: altChoice.text.replace(/\{name\}/g, playerName),
    })
  }
  return out
}

export function RegretList({ history, playerName }: { history: HistoryEntry[]; playerName: string }) {
  const entries = buildRegretEntries(history, playerName)
  if (entries.length === 0) return null
  return (
    <section className="card regret-section" aria-label="另一条路上">
      <h3 className="card-subtitle">另一条路上</h3>
      <p className="regret-note">
        在那些岔路口，还有另一条路。走在那条路上的人，也在过着自己的一生。
      </p>
      <ul className="regret-rows">
        {entries.map((e, i) => (
          <li key={`${e.age}-${i}`} className="regret-row">
            <span className="regret-age">
              {e.age} 岁 · {e.title}
            </span>
            <span className="regret-alt">如果当初——{e.alt}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
