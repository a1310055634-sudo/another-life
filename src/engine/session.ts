// 回合会话：把"创建角色 → 抽事件 → 选择 → 进入下一年"封装成纯函数状态机。
// UI 只负责展示，所有规则与防重复守卫都在这一层，可脱离 DOM 测试。
import type { AttrKey, EventCategory, GameEvent, GameState } from './types'
import { createNewGame, type NewGameOptions } from './init'
import { rngFromState } from './rng'
import { applyChoice, drawEvent } from './events'
import { advanceYear } from './lifecycle'
import { relationDeltaChips } from './relations'
import { unlockAchievements } from './achievements'
import { getTrait } from '../data/traits'

/** 选择产生的即时变化（供 UI 展示属性/金额/技能增减） */export interface ChoiceDelta {
  attr?: AttrKey
  skill?: 'academics' | 'vocational'
  delta?: number
  money?: number
  /** 职业/身份变化描述（入职、升职、失业……） */
  job?: string
  /** 关系变化描述（新增恋人、亲密增减、结婚、疏远……） */
  relation?: string
}

export interface Session {
  state: GameState
  /** 当前待选择的事件；ended 阶段为 null */
  currentEvent: GameEvent | null
  /** true = 本年事件已结算，等待"进入下一年" */
  awaitingAdvance: boolean
  lastSummary: string
  lastDeltas: ChoiceDelta[]
}

/** 把正文里的 {name} 占位符替换为角色名 */
export function interpolate(text: string, name: string): string {
  return text.replace(/\{name\}/g, name)
}

/** 池缺失/非数组时按空池处理，事件引擎会用保底事件让游戏继续 */
function safePool(pool: unknown): GameEvent[] {
  return Array.isArray(pool) ? (pool as GameEvent[]) : []
}

/** 职业/身份变化的一句话描述（未变化返回 undefined） */
function careerDeltaText(
  b: GameState['career'],
  a: GameState['career'],
): string | undefined {
  if (b.kind === a.kind) {
    if (a.kind === 'employed' && b.kind === 'employed') {
      if (a.jobTitle !== b.jobTitle) return `转行：${a.jobTitle}`
      if (a.level > b.level) return `升职：${a.jobTitle} · 职级 ${a.level}`
      if (a.salary !== b.salary) return `年薪调整为 ${a.salary.toLocaleString('zh-CN')} 元`
    }
    return undefined
  }
  switch (a.kind) {
    case 'employed': return `入职：${a.jobTitle}`
    case 'student': return '重回校园'
    case 'unemployed': return b.kind === 'employed' ? '失业了' : '开始待业'
    case 'retired': return '退休了'
    default: return b.kind === 'employed' ? '离开了岗位' : undefined
  }
}

/** 由角色特质的 categoryWeight 生成权重放大函数（第 7 轮：特质影响事件抽取） */
function traitWeightFor(traitId: string): ((e: GameEvent) => number) | undefined {
  const cw = getTrait(traitId).categoryWeight as Partial<Record<EventCategory, number>> | undefined
  if (!cw) return undefined
  return (e: GameEvent) => cw[e.category] ?? 1
}

/** 为当前状态抽一个事件（含特质权重），并把消耗后的 RNG 状态写回（保证可复现） */
function drawForState(state: GameState, pool: GameEvent[]): { state: GameState; event: GameEvent } {
  const rng = rngFromState(state.rngState)
  const event = drawEvent(state, safePool(pool), rng, traitWeightFor(state.traitId))
  return { state: { ...state, rngState: rng.state() }, event }
}

/** 创建角色并抽出 18 岁的第一个事件 */
export function startSession(options: NewGameOptions, pool: GameEvent[]): Session {
  const base = createNewGame(options)
  const { state, event } = drawForState(base, pool)
  return { state, currentEvent: event, awaitingAdvance: false, lastSummary: '', lastDeltas: [] }
}

/**
 * 应用玩家在当前事件中的选择。
 * 已结算后再调用（双击/重放）是 no-op，杜绝重复结算。
 */
export function chooseOption(session: Session, choiceIndex: number): Session {
  if (session.awaitingAdvance || session.state.phase !== 'playing' || !session.currentEvent) {
    return session
  }
  const before = session.state
  // 选择结算后立刻判定成就（第 13 轮）：入职/结婚/生子等选择驱动的成就即时解锁，
  // 解锁写入 achievements 并追加 key 履历（eventId 'ach'），结果面板据此展示提示。
  const applied = applyChoice(before, session.currentEvent, choiceIndex)
  const { state } = unlockAchievements(applied.state)
  const summary = applied.summary

  const deltas: ChoiceDelta[] = []
  for (const key of Object.keys(before.attrs) as AttrKey[]) {
    const d = state.attrs[key] - before.attrs[key]
    if (d !== 0) deltas.push({ attr: key, delta: d })
  }
  for (const key of ['academics', 'vocational'] as const) {
    const d = (state.skills?.[key] ?? 0) - (before.skills?.[key] ?? 0)
    if (d !== 0) deltas.push({ skill: key, delta: d })
  }
  const moneyDelta = state.money - before.money
  if (moneyDelta !== 0) deltas.push({ money: moneyDelta })
  const jobDelta = careerDeltaText(before.career, state.career)
  if (jobDelta) deltas.push({ job: jobDelta })
  for (const chip of relationDeltaChips(before.relations, state.relations)) {
    deltas.push({ relation: chip })
  }

  return { ...session, state, awaitingAdvance: true, lastSummary: summary, lastDeltas: deltas }
}

/**
 * 进入下一年：年度结算 → 若未结束则抽出新一年的事件。
 * 未结算事件前调用是 no-op。
 */
export function nextYear(session: Session, pool: GameEvent[]): Session {
  if (!session.awaitingAdvance || session.state.phase !== 'playing') {
    return session
  }
  return advanceAndDraw(session, pool)
}

/**
 * 恢复存档时发现事件 ID 在当前池中不存在（版本差异）：
 * 玩家在提示横幅上显式点击「跳过这一年」后调用，走正常年度结算并抽出新年事件。
 * 与 nextYear 的区别：不要求 awaitingAdvance（存档可能停在事件未选择的状态）。
 * 恢复必须由玩家主动触发，引擎不做静默重抽。
 */
export function recoverMissingEvent(session: Session, pool: GameEvent[]): Session {
  if (session.state.phase !== 'playing') {
    return session
  }
  return advanceAndDraw(session, pool)
}

function advanceAndDraw(session: Session, pool: GameEvent[]): Session {
  const next = advanceYear(session.state)
  if (next.phase === 'ended') {
    return { ...session, state: next, currentEvent: null, awaitingAdvance: false }
  }
  const { state, event } = drawForState(next, pool)
  return { state, currentEvent: event, awaitingAdvance: false, lastSummary: '', lastDeltas: [] }
}
