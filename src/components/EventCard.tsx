import type { GameEvent, GameState } from '../engine/types'
import { choiceGateReason, visibleChoices } from '../engine/events'
import { interpolate } from '../engine/session'

const CATEGORY_LABELS: Record<GameEvent['category'], string> = {
  education: '学业',
  career: '事业',
  money: '财务',
  relationship: '人际',
  health: '健康',
  life: '生活',
}

interface Props {
  event: GameEvent
  state: GameState
  name: string
  onChoose: (index: number) => void
}

export default function EventCard({ event, state, name, onChoose }: Props) {
  // onChoose 仍传原始索引，结算按完整 choices 数组定位
  const visible = new Set(visibleChoices(state, event))
  return (
    <section className="card event-card">
      <span className={`tag tag-${event.category}`}>{CATEGORY_LABELS[event.category]}</span>
      <h2 className="event-title">{event.title}</h2>
      <p className="event-text">{interpolate(event.text, name)}</p>
      <div className="choices">
        {event.choices.map((c, i) => {
          if (visible.has(c)) {
            return (
              <button
                key={i}
                type="button"
                className="choice-btn"
                title={c.tooltip ?? c.text}
                onClick={() => onChoose(i)}
              >
                <span className="choice-index">{i + 1}</span>
                <span className="choice-body">
                  <span className="choice-text">{c.text}</span>
                  {c.tooltip && <span className="choice-tooltip">{c.tooltip}</span>}
                </span>
              </button>
            )
          }
          // 第 19 轮：被门槛挡住的选项不再静默消失，以禁用态展示 + 一行中文原因，
          // 让玩家明白这条路为什么暂时走不通、差在哪儿
          const reason = choiceGateReason(state, c)
          return (
            <button
              key={i}
              type="button"
              className="choice-btn locked"
              disabled
              aria-disabled="true"
              title={reason ?? '暂时无法选择'}
            >
              <span className="choice-index">{i + 1}</span>
              <span className="choice-body">
                <span className="choice-text">{c.text}</span>
                <span className="choice-lock">🔒 {reason ?? '暂时无法选择'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
