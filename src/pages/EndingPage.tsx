import { ATTR_KEYS } from '../engine/attrs'
import { judgeEnding, buildEndingSummary } from '../engine/outcomes'
import { buildEndingEpilogue } from '../engine/epilogues'
import { NORMS } from '../data/norms'
import { buildPeerRows } from '../components/PeerCompare'
import { fmtMoney } from '../components/AttrBar'
import { buildCurve, AssetCurve } from '../components/AssetCurve'
import { buildRadar, LifeRadar } from '../components/LifeRadar'
import { LifeReport } from '../components/LifeReport'
import { RegretList } from '../components/RegretList'
import { downloadShareCard } from '../components/ShareCard'
import { playStamp } from '../sound'
import { ATTR_LABELS } from '../engine/attrs'
import { useEffect, useState } from 'react'
import type { Session } from '../engine/session'

// 第 75 轮：岁月长河——年代分段（十年一带，18-19 岁并入二十代）与段名
const RIVER_BANDS = [
  { min: 18, max: 29, label: '二十代 · 初入人间', short: '20 代' },
  { min: 30, max: 39, label: '三十代 · 而立前后', short: '30 代' },
  { min: 40, max: 49, label: '四十代 · 不惑将至', short: '40 代' },
  { min: 50, max: 59, label: '五十代 · 知命之年', short: '50 代' },
  { min: 60, max: 69, label: '六十代 · 花甲之年', short: '60 代' },
  { min: 70, max: 77, label: '七十代 · 古稀之年', short: '70 代' },
]
const bandIdx = (age: number): number => {
  const i = RIVER_BANDS.findIndex((b) => age >= b.min && age <= b.max)
  return i === -1 ? (age < 18 ? 0 : RIVER_BANDS.length - 1) : i
}

interface Props {
  session: Session
  onRestart: () => void
  /** 第 94 轮：以子女之名承继血脉（身后有子女在册时按钮可见） */
  onContinueBloodline?: () => void
}

export default function EndingPage({ session, onRestart, onContinueBloodline }: Props) {
  const { state } = session
  // 第 94 轮：世代传承——身后有子女在册方可承继血脉
  const childAlive = state.relations.some((r) => r.kind === 'child' && r.alive)
  // 第 75 轮：岁月长河过滤（全部/★转折/丧失；里程碑无独立标记砍档——账本记录）
  // 第 98 轮：人生高光——★转折中的玩家抉择精选（有抉择优先，按年升序，3～5 张）
  const isLoss = (h: { title: string }) => h.title === '送别'
  const highlightCards = (() => {
    const keys = state.history.filter((h) => h.key && !isLoss(h))
    const withChoice = keys.filter((h) => h.choice && h.choice.length > 0)
    const picked = (withChoice.length >= 3 ? withChoice : keys).slice(0, 5)
    return picked.length >= 3 ? picked : keys.slice(0, 5)
  })()

  // 第 96 轮：同龄人对照——终局四维 vs 千局分位（norms 生成物，纯展示）
  const happinessAvg =
    state.snapshots.length > 0
      ? state.snapshots.reduce((a, snap) => a + snap.attrs.happiness, 0) / state.snapshots.length
      : state.attrs.happiness
  const peerRows = buildPeerRows(
    { money: state.money, age: state.age, achievements: state.achievements.length, happinessAvg },
    NORMS,
  )
  const [riverFilter, setRiverFilter] = useState<'all' | 'key' | 'loss'>('all')
  const filteredHistory =
    riverFilter === 'loss'
      ? state.history.filter(isLoss)
      : riverFilter === 'key'
        ? state.history.filter((h) => h.key && !isLoss(h))
        : state.history
  const ending = judgeEnding(state)
  const summary = buildEndingSummary(state)
  const epilogue = buildEndingEpilogue(state, ending.id)
  // 第 35 轮：资产曲线（结局页直接展示，不折叠）；空/短快照（旧档）优雅隐藏
  const assetCurve = buildCurve(state.snapshots)
  // 第 36 轮：属性雷达——终值对比开局快照基准；旧档无快照时 buildRadar 自动降级为仅终值
  const firstSnap = state.snapshots.length > 0 ? state.snapshots[0] : null
  const radar = buildRadar(state.attrs, firstSnap?.attrs ?? null, firstSnap?.age ?? null)
  // 第 52 轮：结局盖章音（呈现层；音效关闭时 playStamp 内部安全早退）
  useEffect(() => {
    playStamp()
  }, [])

  return (
    <div className="ending">
      {/* 报告头：评级印章 + 结局名 */}
      <section className="card ending-card">
        <p className="ending-kicker">人生报告</p>
        <span
          className={`ending-grade grade-${ending.grade}`}
          role="img"
          aria-label={`人生评级 ${ending.grade} 级`}
        >
          <b>{ending.grade}</b>
          <i>级</i>
        </span>
        <h1 className="ending-name">{ending.name}</h1>
        <p className="ending-desc">{ending.desc}</p>
        <p className="ending-dims">
          {ending.dims.map((d) => (
            <span key={d} className="ending-dim">
              {d}
            </span>
          ))}
        </p>
        <p className="ending-facts">
          {state.name} · 终年 {state.age} 岁 · {fmtMoney(state.money)}
        </p>
        <div className="attr-grid">
          {ATTR_KEYS.map((k) => (
            <div key={k} className="ending-attr">
              {ATTR_LABELS[k]} <b>{state.attrs[k]}</b>
            </div>
          ))}
        </div>
      </section>

      {/* 报告数据区：关键数据五格 + 关键抉择金句（第 37 轮） */}
      <LifeReport state={state} />

      {/* 同龄人对照（第 96 轮）：终局数据 vs 千局分位表（norms 生成物，纯展示） */}
      <section className="card peer-compare" aria-label="同龄人对照">
        <h3 className="card-subtitle">同龄人对照</h3>
        <p className="peer-note">基于 {NORMS.sampleCount} 局模拟对照</p>
        <ul className="peer-rows">
          {peerRows.map((row) => (
            <li key={row.label} className="peer-row" aria-label={`你的${row.label}是${row.valueText}，${row.tier}`}>
              <span className="peer-label">{row.label}</span>
              <span className="peer-value">{row.valueText}</span>
              <span className="peer-tier">
                超过 {row.pct}% 的模拟人生 · {row.tier}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 图表区：资产曲线与属性雷达并排（窄屏自动堆叠） */}
      <div className="report-charts">
        {assetCurve && (
          <section className="card">
            <h3 className="card-subtitle">资产曲线</h3>
            <AssetCurve curve={assetCurve} />
          </section>
        )}
        <section className="card">
          <h3 className="card-subtitle">属性雷达</h3>
          <LifeRadar radar={radar} />
        </section>
      </div>

      <section className="card">
        <h3 className="card-subtitle">这一生</h3>
        <div className="ending-summary">
          {summary.lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </section>

      {/* 后记（第 30 轮）作为报告的收束段，金边区隔 */}
      {epilogue.length > 0 && (
        <section className="card report-epilogue">
          <h3 className="card-subtitle">后记</h3>
          <div className="ending-summary">
            {epilogue.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>
      )}

      {/* 第 54 轮：分享卡——canvas 绘制 1080×1440 PNG 下载（呈现层，零新依赖） */}
      <div className="share-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => downloadShareCard(state)}
          aria-label="把人生报告保存为一张图片"
        >
          保存分享卡（PNG）
        </button>
      </div>

      {summary.highlights.length > 0 && (
        <section className="card">
          <h3 className="card-subtitle">人生转折</h3>
          <ul className="ending-turning-points">
            {summary.highlights.map((h, i) => (
              <li key={i}>
                <span className="history-age">{h.age} 岁</span>
                <span className="history-body">
                  <b>{h.title}</b>
                  <em>{h.summary}</em>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 人生高光（第 98 轮）：★转折精选金句卡（3～5 张，排版精修） */}
      {highlightCards.length >= 3 && (
        <section className="card hl-section" aria-label="人生高光">
          <h3 className="card-subtitle">人生高光</h3>
          <div className="hl-cards">
            {highlightCards.map((h, i) => (
              <figure key={`${h.age}-${i}`} className="hl-card">
                <span className="hl-quote">「</span>
                <blockquote className="hl-text">{h.choice || h.summary}</blockquote>
                <figcaption className="hl-meta">
                  <span className="hl-age">{h.age} 岁</span>
                  <span className="hl-title">{h.title}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 另一条路上（第 121 轮）：关键岔路口的克制回望（呈现层只读；无合资格转折整卡不渲染） */}
      <RegretList history={state.history} playerName={state.name} />

      <section className="card">
        <h3 className="card-subtitle">人生时间线（{state.history.length} 件事）</h3>
        {state.history.length === 0 ? (
          <p className="history-empty">平淡的一生，没有留下刻痕。</p>
        ) : (
          <>
            {/* 第 75 轮：岁月长河——过滤档（全部/★转折/丧失）+ 年代分段导航 + 组头空态 */}
            <div className="river-filters" role="group" aria-label="时间线筛选">
              <button
                type="button"
                className={`river-chip${riverFilter === 'all' ? ' on' : ''}`}
                aria-pressed={riverFilter === 'all'}
                onClick={() => setRiverFilter('all')}
              >
                全部
              </button>
              <button
                type="button"
                className={`river-chip${riverFilter === 'key' ? ' on' : ''}`}
                aria-pressed={riverFilter === 'key'}
                onClick={() => setRiverFilter('key')}
              >
                ★转折
              </button>
              <button
                type="button"
                className={`river-chip${riverFilter === 'loss' ? ' on' : ''}`}
                aria-pressed={riverFilter === 'loss'}
                onClick={() => setRiverFilter('loss')}
              >
                丧失
              </button>
            </div>
            <div className="river-nav" role="navigation" aria-label="年代导航">
              {RIVER_BANDS.map((b, bi) => (
                <button
                  key={b.short}
                  type="button"
                  className="river-anchor"
                  onClick={() =>
                    document.getElementById(`river-seg-${bi}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  {b.short}
                </button>
              ))}
            </div>
            <div className="river">
              {RIVER_BANDS.map((b, bi) => {
                const entries = filteredHistory.filter((h) => bandIdx(h.age) === bi)
                return (
                  <div key={b.short} className="river-seg" id={`river-seg-${bi}`}>
                    <h4 className="river-seg-head">
                      {b.label} · {entries.length} 件
                    </h4>
                    {entries.length === 0 ? (
                      <p className="river-empty">这一段岁月静好，没有留下刻痕。</p>
                    ) : (
                      <ol className="life-timeline">
                        {entries.map((h, i) => (
                          <li key={i} className={h.key ? 'tl-key' : undefined}>
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
                      </ol>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {onContinueBloodline && childAlive && (
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onContinueBloodline}
        >
          以子女之名，再活一次 →
        </button>
      )}
      <button type="button" className="btn btn-primary btn-lg" onClick={onRestart}>
        再活一次
      </button>
    </div>
  )
}
