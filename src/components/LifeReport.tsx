// 第 37 轮：人生报告关键数据与关键抉择金句（结局页报告式版面的数据区）。
// 纯展示组件：素材只读真实状态（属性/快照/关系/工龄/成就/履历），不写任何状态，
// 不做结局判定（那仍是 engine/outcomes 的职责）。空状态自适应：
// 旧档无快照 → 峰值退化为终局资产；无关键抉择履历 → 金句卡整体隐藏，绝不露占位符。
// 呈现轮约束：不引用引擎内部数值逻辑，只读字段与 fmtMoney。
import type { GameState } from '../engine/types'
import { fmtMoney } from './AttrBar'

/** 关键数据卡的五格素材（展示串在此定型，EndingPage 直接用） */
export interface ReportStats {
  /** 终龄（岁） */
  age: number
  /** 峰值资产（元）：逐年快照最高点与终局资产的较大者；旧档无快照退化为终局资产 */
  peakMoney: number
  /** 家庭一格的短文案：伴侣/恋人 · N 孩，无亲缘则宠物，再无则独身 */
  familyText: string
  /** 累计正式工龄（年；v2 前旧档缺省视为 0） */
  workYears: number
  /** 已解锁成就数 */
  achCount: number
}

/** 从真实状态汇总报告五格（纯函数，只读） */
export function buildReportStats(state: GameState): ReportStats {
  const spouse = state.relations.find((r) => r.kind === 'spouse' && r.alive)
  const partner = state.relations.find((r) => r.kind === 'partner' && r.alive)
  const kids = state.relations.filter((r) => r.kind === 'child' && r.alive)
  const pets = state.relations.filter((r) => r.kind === 'pet' && r.alive)
  const familyParts: string[] = []
  if (spouse) familyParts.push('伴侣')
  else if (partner) familyParts.push('恋人')
  if (kids.length > 0) familyParts.push(`${kids.length} 孩`)
  let familyText: string
  if (familyParts.length > 0) familyText = familyParts.join(' · ')
  else if (pets.length > 0) familyText = `${pets.length} 宠相伴`
  else familyText = '独身'

  const peakMoney =
    state.snapshots.length > 0
      ? Math.max(state.money, ...state.snapshots.map((s) => s.money))
      : state.money

  return {
    age: state.age,
    peakMoney,
    familyText,
    workYears: state.workYears ?? 0,
    achCount: state.achievements.length,
  }
}

/** 关键抉择金句素材：一条真实发生的关键履历及其所选选项 */
export interface ReportQuote {
  age: number
  title: string
  choice: string
}

/**
 * 选一条「关键抉择」金句：★ 关键履历全部由年度结算产生（毕业/晋升/疏远/还清房贷等，
 * 自身无选项），故金句取「关键年份里玩家真实做出的选择」——某 age 出现过 ★ 条目即视为
 * 人生转折年，该年的事件选项（choice 非空）成为候选，多条取最后一则（离终点最近的抉择
 * 最能概括一生）。没有关键年份、或转折年都无玩家选择时返回 null，金句卡整体隐藏。
 */
export function pickKeyQuote(state: GameState): ReportQuote | null {
  const keyAges = new Set(state.history.filter((h) => h.key).map((h) => h.age))
  const cands = state.history.filter((h) => h.choice.trim().length > 0 && keyAges.has(h.age))
  if (cands.length === 0) return null
  const last = cands[cands.length - 1]
  return { age: last.age, title: last.title, choice: last.choice }
}

/** 关键数据 + 关键抉择两个报告卡（EndingPage 报告头的下一节） */
export function LifeReport({ state }: { state: GameState }) {
  const stats = buildReportStats(state)
  const quote = pickKeyQuote(state)
  return (
    <>
      <section className="card">
        <h3 className="card-subtitle">关键数据</h3>
        <div className="report-stats">
          <div className="report-stat">
            <span>终龄</span>
            <b>{stats.age} 岁</b>
          </div>
          <div className="report-stat">
            <span>峰值资产</span>
            <b>{fmtMoney(stats.peakMoney)}</b>
          </div>
          <div className="report-stat">
            <span>家庭</span>
            <b>{stats.familyText}</b>
          </div>
          <div className="report-stat">
            <span>工龄</span>
            <b>{stats.workYears} 年</b>
          </div>
          <div className="report-stat">
            <span>成就</span>
            <b>{stats.achCount} 枚</b>
          </div>
        </div>
      </section>

      {quote && (
        <section className="card">
          <h3 className="card-subtitle">关键抉择</h3>
          <blockquote className="report-quote">
            <p>{quote.choice}</p>
            <cite>
              —— {quote.age} 岁 · {quote.title}
            </cite>
          </blockquote>
        </section>
      )}
    </>
  )
}
