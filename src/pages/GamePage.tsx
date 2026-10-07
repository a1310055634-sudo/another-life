import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import type { AttrKey, GameState } from '../engine/types'
import { ATTR_KEYS } from '../engine/attrs'
import { EDU_LABELS, SKILL_LABELS, studentLabel } from '../engine/education'
import { employedLabel } from '../engine/career'
import type { ChoiceDelta, Session } from '../engine/session'
import { relationsLine } from '../engine/relations'
import { visibleChoices } from '../engine/events'
import { ACTION_DONE_KEY, availableActions, isActionAvailable } from '../engine/actions'
import { ACTION_DEFS, type ActionDef } from '../data/actions'
import { setAmbientStage } from '../ambient'
import { AttrBar, fmtMoney, fmtSigned, ATTR_LABELS } from '../components/AttrBar'
import { CountUp } from '../components/CountUp'
import { buildCurve, AssetCurve } from '../components/AssetCurve'
import EventCard from '../components/EventCard'
import { Tutorial } from '../components/Tutorial'
import MilestoneOverlay from '../components/MilestoneOverlay'
import { milestonesAtAge } from '../components/milestones'

interface Props {
  session: Session
  onChoose: (index: number) => void
  onNext: () => void
  onRestart: () => void
  /** 第 84 轮：本年主动行动（事件结算后、进入下一年前，每年至多一项） */
  onAction?: (actionId: string) => void
  /** 存档中的事件 ID 无法还原时的恢复提示（点击跳过该年继续） */
  notice?: string | null
  onSkipYear?: () => void
  /** 自动保存失败原因（非空时显示警告横幅） */
  saveError?: string | null
  onExport?: () => void
}

/** 第 33 轮：金钱变化数字走 count-up 滚动，其余 delta 维持纯文本 */
function deltaContent(d: ChoiceDelta): ReactNode {
  if (d.job) return d.job
  if (d.relation) return d.relation
  if (typeof d.money === 'number')
    return (
      <>
        金钱 <CountUp value={d.money} format={fmtSigned} />
      </>
    )
  if (d.skill) return `${SKILL_LABELS[d.skill]} ${fmtSigned(d.delta ?? 0)}`
  return `${d.attr ? ATTR_LABELS[d.attr] : ''} ${fmtSigned(d.delta ?? 0)}`
}

/** 当前身份的一句话描述 */
export function careerText(state: GameState): string {
  const c = state.career
  switch (c.kind) {
    case 'student':
      return studentLabel(c.stage, c.yearsLeft)
    case 'employed':
      return employedLabel(c.jobTitle, c.level, c.salary)
    case 'unemployed':
      return '待业中'
    case 'retired': {
      const wan = c.pension / 10000
      const wanText = wan >= 10 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '')
      return `已退休（年退休金 ${wanText} 万）`
    }
    default:
      return '打零工'
  }
}

export default function GamePage({ session, onChoose, onNext, onRestart, onAction, notice, onSkipYear, saveError, onExport }: Props) {
  const { state } = session
  // 成就履历条目（eventId 'ach'）紧跟在选择条目之后，结果面板要展示的是选择本身
  const lastHistory = [...state.history].reverse().find((h) => h.eventId !== 'ach')
  // 本回合新解锁的成就（年龄匹配即可区分；同一年只有一个选择回合）
  const newAchievements = state.history.filter((h) => h.eventId === 'ach' && h.age === state.age)
  // 第 35 轮：资产曲线（履历区可折叠展示）；空/短快照（旧档）buildCurve 返回 null 整块隐藏
  const assetCurve = buildCurve(state.snapshots)
  // 第 55 轮：履历折叠的 ref（快捷键 C 切换开合）
  const historyRef = useRef<HTMLDetailsElement>(null)

  // 第 84 轮：主动行动——事件结算后（awaitingAdvance）出现行动条；
  // 行动后 action_done 全局闸让 availableActions 清空 → 切换为「已行动」注记态。
  const availActions = session.awaitingAdvance ? availableActions(state) : []
  const actionDone =
    session.awaitingAdvance && (state.cooldowns[ACTION_DONE_KEY] ?? 0) > state.age
  const lastAction = [...state.history]
    .reverse()
    .find((h) => h.eventId === 'action' && h.age === state.age)
  /** 置灰原因（tooltip）：钱不够/年龄/身份/关系/自身冷却——可用行动不显示 */
  const actionBlockReason = (a: ActionDef): string => {
    if (state.money - a.cost < 0) return `余额不足（需 ${a.cost} 元）`
    if (a.requires?.careerKinds && !a.requires.careerKinds.includes(state.career.kind)) return '身份不符'
    if (
      a.requires?.relationKinds &&
      !a.requires.relationKinds.some((k) => state.relations.some((r) => r.kind === k && r.alive))
    ) {
      return '条件不符'
    }
    return '冷却中'
  }

  // 第 55 轮：键盘操作——数字 1~5 选可见选项、Enter/空格推进跨年、C 切换履历折叠。
  // 只读引擎纯函数（visibleChoices）映射可见序号→原始索引；输入框聚焦时全部跳过。
  // 第 76 轮：环境音阶段跟随（青年 ≤40 / 中年 ≤60 / 晚年）——未开启时引擎内部只记阶段
  useEffect(() => {
    const a = state.age
    setAmbientStage(a <= 40 ? 'youth' : a <= 60 ? 'mid' : 'late')
  }, [state.age])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (session.awaitingAdvance) {
        // 第 84 轮：结算态键位——Enter/空格/0 推进（0=什么都不做，跳过行动）；
        // 数字 1~N 选中第 N 个可用行动（不可用/超位数字无操作）。
        if (e.key === 'Enter' || e.key === ' ' || e.key === '0') {
          e.preventDefault()
          onNext()
          return
        }
        if (onAction && /^[1-9]$/.test(e.key)) {
          const a = availActions[Number(e.key) - 1]
          if (a) {
            e.preventDefault()
            onAction(a.id)
          }
          return
        }
        return
      }
      if (!session.awaitingAdvance && session.currentEvent && /^[1-5]$/.test(e.key)) {
        const vis = visibleChoices(session.state, session.currentEvent)
        const choice = vis[Number(e.key) - 1]
        if (choice) onChoose(session.currentEvent.choices.indexOf(choice))
        return
      }
      if ((e.key === 'c' || e.key === 'C') && historyRef.current) {
        historyRef.current.open = !historyRef.current.open
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, onNext, onChoose, onAction, availActions])

  return (
    <>
      {/* 第 56 轮：首局开场引导浮层（完成/跳过后不再出现；纯覆盖层不阻塞引擎） */}
      <Tutorial />
      {/* 第 34 轮：跨年「翻开新的一年」转场。纯视觉层（aria-hidden + CSS pointer-events:none），
          不挡点击、不参与任何状态逻辑；key=年龄，进入新一年时重挂载重播一次，播完隐身。 */}
      <div className="year-flip" key={state.age} aria-hidden="true">
        <span className="year-flip-band">翻开新的一年 · {state.age} 岁</span>
      </div>

      {/* 第 97 轮：重大时刻全屏演出——本年新现的六类里程碑（同年 ≤2 张；reduced-motion 不渲染） */}
      <MilestoneOverlay key={`m-${state.age}`} milestones={milestonesAtAge(state, state.age)} />
      <section className="card topbar">
        <div className="topbar-main">
          <div>
            <span className="topbar-name">{state.name}</span>
            <span className="topbar-age">{state.age} 岁</span>
          </div>
          <div className="topbar-money">{fmtMoney(state.money)}</div>
        </div>
        <p className="topbar-status" aria-label="学历与身份">
          {EDU_LABELS[state.education]} · {careerText(state)}
          <span className="topbar-skills">
            {SKILL_LABELS.academics} {state.skills?.academics ?? 0} / {SKILL_LABELS.vocational}{' '}
            {state.skills?.vocational ?? 0}
          </span>
          {state.achievements.length > 0 && (
            <span className="topbar-ach" aria-label="已达成成就数">
              🏅 {state.achievements.length}
            </span>
          )}
        </p>
        <p className="topbar-status topbar-rel" aria-label="人际关系">
          关系：{relationsLine(state)}
        </p>
        <div className="attr-grid">
          {ATTR_KEYS.map((k) => (
            <AttrBar key={k} k={k} value={state.attrs[k as AttrKey]} />
          ))}
        </div>
      </section>

      {state.yearLog.length > 0 && (
        <section className="card yearlog">
          <h3 className="card-subtitle">{state.age} 岁这一年</h3>
          <ul>
            {state.yearLog.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {saveError && (
        <section className="banner warn-card" role="alert">
          <p>⚠️ {saveError}</p>
          {onExport && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExport}>
              导出存档文件
            </button>
          )}
        </section>
      )}

      {notice && (
        <section className="banner warn-card" role="alert">
          <p>ℹ️ {notice}</p>
          {onSkipYear && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onSkipYear}>
              跳过这一年，继续人生 →
            </button>
          )}
        </section>
      )}

      {!session.awaitingAdvance && session.currentEvent && (
        <EventCard event={session.currentEvent} state={state} name={state.name} onChoose={onChoose} />
      )}

      {session.awaitingAdvance && (
        <section className="card result-panel">
          <p className="result-label">
            {lastHistory ? `${state.age} 岁 · ${lastHistory.title}` : ''}
          </p>
          <p className="result-choice">你选择了「{lastHistory?.choice ?? ''}」</p>
          <p className="result-summary">{session.lastSummary}</p>
          <div className="delta-row">
            {session.lastDeltas.length === 0 && <span className="delta">内心毫无波澜</span>}
            {session.lastDeltas.map((d, i) => (
              <span
                key={i}
                className={`delta ${
                  d.relation !== undefined
                    ? 'rel'
                    : ((d.money ?? d.delta) ?? 0) >= 0
                      ? 'pos'
                      : 'neg'
                }`}
              >
                {deltaContent(d)}
              </span>
            ))}
          </div>
          {newAchievements.length > 0 && (
            <div className="ach-row" aria-live="polite">
              {newAchievements.map((h, i) => (
                <span key={i} className="ach-chip">
                  🏅 {h.summary.replace(/^达成成就「/, '').replace(/」$/, '')}
                </span>
              ))}
            </div>
          )}
          {/* 第 84 轮：本年主动行动条（可跳过——「进入下一年」即什么都不做）。
              年内已行动后切换为注记态；花费不足/身份/关系/冷却的按钮置灰带原因 tooltip。 */}
          {onAction && !actionDone && (
            <div className="action-bar" role="group" aria-label="本年主动行动">
              <p className="action-bar-label">今年还想做点什么？（可跳过）</p>
              <div className="action-bar-list">
                {ACTION_DEFS.filter((a) => a.minAge <= state.age && state.age <= a.maxAge).map((a) => {
                  const ok = isActionAvailable(state, a)
                  const keyNo = ok ? availActions.indexOf(a) + 1 : 0
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="btn action-btn"
                      disabled={!ok}
                      title={ok ? `${a.desc}${a.cost > 0 ? `（${a.cost} 元）` : ''}` : actionBlockReason(a)}
                      aria-label={ok ? `行动 ${keyNo}：${a.name}` : `${a.name}（${actionBlockReason(a)}）`}
                      onClick={() => {
                        if (ok) onAction(a.id)
                      }}
                    >
                      <span className="action-key" aria-hidden="true">{keyNo > 0 ? keyNo : '·'}</span>
                      <span className="action-name">{a.name}</span>
                      <span className="action-cost">{a.cost > 0 ? `${a.cost} 元` : '免费'}</span>
                    </button>
                  )
                })}
              </div>
              <p className="action-bar-hint">数字键选行动 · 0 或回车＝什么都不做</p>
            </div>
          )}
          {actionDone && lastAction && (
            <p className="action-done-note" aria-live="polite">
              <b>{lastAction.title}</b> {lastAction.summary}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
            进入下一年 →
          </button>
        </section>
      )}

      <details ref={historyRef} className="card history">
        <summary>人生履历（{state.history.length} 条）</summary>
        {state.history.length === 0 ? (
          <p className="history-empty">故事才刚刚开始。</p>
        ) : (
          <ul className="history-list">
            {[...state.history].reverse().map((h, i) => (
              // 第 19 轮：关键经历（毕业/晋升/疏远/成就）以 ★ 高亮，方便翻履历时抓住转折
              <li key={i} className={h.key ? 'history-key' : undefined}>
                <span className="history-age">
                  {h.key && <span className="history-star" aria-label="关键经历">★</span>}
                  {h.age} 岁
                </span>
                <span className="history-body">
                  <b>{h.title}</b>
                  <i>{h.choice}</i>
                  <em>{h.summary}</em>
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {assetCurve && (
        <details className="card asset-fold">
          <summary>资产曲线（{assetCurve.points.length} 年）</summary>
          <AssetCurve curve={assetCurve} />
        </details>
      )}

      <div className="game-actions">
        {onExport && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExport}>
            导出存档
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRestart}>
          放弃这局，回到首页
        </button>
      </div>
    </>
  )
}
