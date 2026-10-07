// 存档层（第 18 轮）：Session 的序列化、校验、版本迁移与存储读写。
// 全部为纯函数，Storage 通过参数注入（浏览器适配见 browser.ts），可脱离 DOM 测试。
// 原则：读取/解析失败绝不写入 —— 原始存档始终保留，供恢复或导出。
import type { GameEvent, GameState } from '../engine/types'
import type { ChoiceDelta, Session } from '../engine/session'
import { SAVE_VERSION } from '../engine/init'
import { validateState } from '../engine/validate'

/** localStorage 里的存档键 */
export const SAVE_KEY = 'another-life:save'

/** 存档信封版本。与 GameState.version（引擎状态版本）相互独立，各自校验 */
export const SAVE_FILE_VERSION = 2

export interface SaveData {
  saveVersion: number
  savedAt: number
  state: GameState
  /** 池中事件按 ID 还原；ended 阶段为 null */
  currentEventId: string | null
  awaitingAdvance: boolean
  lastSummary: string
  lastDeltas: ChoiceDelta[]
}

export interface SaveMeta {
  name: string
  age: number
  savedAt: number
  phase: string
  /** 本局已解锁成就 ID（第 19 轮首页成就入口读取；缺失/非数组时为空列表） */
  achievements: string[]
}

/** 可注入的存储接口（localStorage / 测试内存实现都长这样） */
export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── 版本迁移 ────────────────────────────────────────────────
// 策略：saveVersion 相同直接读；更高版本拒绝（保留原档，提示更新游戏）；
// 更低版本沿迁移链逐级升级，缺任何一环则拒绝。未来结构变更时在链尾追加。

export interface SaveMigration {
  from: number
  to: number
  migrate: (data: Record<string, unknown>) => Record<string, unknown>
}

export const SAVE_MIGRATIONS: SaveMigration[] = [
  {
    from: 1,
    to: 2,
    // 第 21 轮：新增年度快照。旧档补空数组——不伪造历史快照，
    // 从加载后的下一年度结算开始积累；信封与状态版本一并升级。
    migrate: (data) => {
      const state = data.state
      if (!isObj(state)) throw new Error('存档缺少角色状态')
      return {
        ...data,
        saveVersion: 2,
        state: { ...state, version: SAVE_VERSION, snapshots: [] },
      }
    },
  },
]

export function applyMigrations(
  data: Record<string, unknown>,
  fromVersion: number,
  target: number,
  chain: SaveMigration[] = SAVE_MIGRATIONS,
): { ok: true; data: Record<string, unknown> } | { ok: false; reason: string } {
  let cur = fromVersion
  let obj = data
  while (cur < target) {
    const step = chain.find((m) => m.from === cur && m.to > cur)
    if (!step) {
      return { ok: false, reason: `存档版本过旧（v${cur}），缺少到 v${cur + 1} 的迁移路径；原存档未被改动` }
    }
    try {
      obj = step.migrate(obj)
    } catch (e) {
      return { ok: false, reason: `存档迁移 v${cur}→v${step.to} 失败：${msg(e)}` }
    }
    if (!isObj(obj)) return { ok: false, reason: `存档迁移 v${cur}→v${step.to} 后结构非法` }
    cur = step.to
  }
  return { ok: true, data: obj }
}

// ── 序列化 / 反序列化 ───────────────────────────────────────

/** Session → 可 JSON 化的存档对象。state 本身就是纯数据，原样放入信封 */
export function serializeSession(session: Session, now = Date.now()): SaveData {
  return {
    saveVersion: SAVE_FILE_VERSION,
    savedAt: Math.floor(now),
    state: session.state,
    currentEventId: session.currentEvent?.id ?? null,
    awaitingAdvance: session.awaitingAdvance,
    lastSummary: session.lastSummary,
    lastDeltas: session.lastDeltas,
  }
}

/** 从存档对象重建 Session：事件按 ID 从池中还原；未知 ID 不重抽，交由上层提示恢复 */
export function sessionFromSaveData(
  data: SaveData,
  pool: GameEvent[],
): { session: Session; unknownEventId: string | null } {
  const currentEvent = data.currentEventId
    ? pool.find((e) => e.id === data.currentEventId) ?? null
    : null
  const unknownEventId = data.currentEventId && !currentEvent ? data.currentEventId : null
  return {
    session: {
      state: data.state,
      currentEvent,
      awaitingAdvance: data.awaitingAdvance,
      lastSummary: data.lastSummary,
      lastDeltas: data.lastDeltas,
    },
    unknownEventId,
  }
}

export type DeserializeResult =
  | { ok: true; session: Session; data: SaveData; unknownEventId: string | null }
  | { ok: false; reason: string }

/**
 * 解析存档文本并严格校验。任何一步失败都返回原因，不做任何写入；
 * 未知事件 ID 不算损坏 —— 返回 ok 但带 unknownEventId，由 UI 提供显式恢复。
 */
export function deserializeSave(json: string, pool: GameEvent[]): DeserializeResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: '存档不是有效的 JSON 文本' }
  }
  if (!isObj(raw)) return { ok: false, reason: '存档结构不是对象' }

  const v = raw.saveVersion
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { ok: false, reason: '存档版本号缺失或非法' }
  }
  if (v > SAVE_FILE_VERSION) {
    return {
      ok: false,
      reason: `存档来自更高版本（v${v} > v${SAVE_FILE_VERSION}），请更新游戏后再试；原存档未被改动`,
    }
  }
  const migrated = applyMigrations(raw, v, SAVE_FILE_VERSION)
  if (!migrated.ok) return migrated
  const d = migrated.data

  const bad: string[] = []
  if (typeof d.savedAt !== 'number' || !Number.isFinite(d.savedAt)) bad.push('savedAt')
  if (typeof d.awaitingAdvance !== 'boolean') bad.push('awaitingAdvance')
  if (typeof d.lastSummary !== 'string') bad.push('lastSummary')
  if (!Array.isArray(d.lastDeltas)) bad.push('lastDeltas')
  if (d.currentEventId !== null && typeof d.currentEventId !== 'string') bad.push('currentEventId')
  if (!isObj(d.state)) bad.push('state')
  if (bad.length > 0) {
    return { ok: false, reason: `存档缺少或损坏以下字段：${bad.join('、')}` }
  }

  const state = d.state as unknown as GameState
  if (state.version !== SAVE_VERSION) {
    return { ok: false, reason: `存档状态版本不符（${String(state.version)}，期望 ${SAVE_VERSION}）` }
  }
  if (state.phase !== 'playing' && state.phase !== 'ended') {
    return { ok: false, reason: `存档阶段非法：${String(state.phase)}` }
  }
  // validateState 不覆盖、但引擎运转必须依赖的集合字段
  if (!Array.isArray(state.pending)) return { ok: false, reason: '存档的延迟效果列表损坏' }
  if (!Array.isArray(state.yearLog)) return { ok: false, reason: '存档的年度日志损坏' }
  if (!isObj(state.cooldowns)) return { ok: false, reason: '存档的事件冷却表损坏' }
  if (!Array.isArray(state.snapshots)) return { ok: false, reason: '存档的年度快照损坏' }

  // 会话语义校验：引擎不变式是"进行中的年份要么有待选择的事件，要么已结算在等推进"。
  // 两者皆无的存档恢复后既无事件卡也无"进入下一年"按钮（软死局），按损坏拒绝；
  // 事件 ID 存在但池中查不到不算此处损坏 —— 走 unknownEventId 的显式跳年恢复。
  if (state.phase === 'playing' && !d.awaitingAdvance && d.currentEventId === null) {
    return { ok: false, reason: '存档语义非法：进行中的年份既没有待选择的事件，也没有待推进的结算' }
  }

  const { issues } = validateState(state)
  if (issues.length > 0) {
    const head = issues.slice(0, 3).map((i) => `${i.field}：${i.problem}`).join('；')
    return { ok: false, reason: `存档状态校验未通过（${head}${issues.length > 3 ? ' 等' : ''}）` }
  }

  const data = d as unknown as SaveData
  const { session, unknownEventId } = sessionFromSaveData(data, pool)
  return { ok: true, session, data, unknownEventId }
}

// ── 存储读写（全部捕获存储异常，转成结果而非抛出） ────────────

export type SaveResult = { ok: true } | { ok: false; error: string }

/** 写入自动存档；存储抛错（隐私模式/配额满）时返回失败原因，绝不静默 */
export function saveSessionTo(
  session: Session,
  storage: SaveStorage,
  now = Date.now(),
): SaveResult {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serializeSession(session, now)))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e) }
  }
}

export type LoadResult =
  | { ok: true; session: Session; data: SaveData; unknownEventId: string | null }
  | { ok: false; reason: string }

export function loadSessionFrom(storage: SaveStorage, pool: GameEvent[]): LoadResult {
  let raw: string | null
  try {
    raw = storage.getItem(SAVE_KEY)
  } catch (e) {
    return { ok: false, reason: `浏览器存储不可用：${msg(e)}` }
  }
  if (raw === null) return { ok: false, reason: '没有存档' }
  return deserializeSave(raw, pool)
}

export type SaveMetaRead =
  | { kind: 'none' }
  | { kind: 'ok'; meta: SaveMeta }
  | { kind: 'corrupt'; reason: string }
  | { kind: 'unavailable'; reason: string }

/** 轻量读取存档摘要（首页展示用）；不做完整校验，损坏时保留原文供导出 */
export function readSaveMetaFrom(storage: SaveStorage): SaveMetaRead {
  let raw: string | null
  try {
    raw = storage.getItem(SAVE_KEY)
  } catch (e) {
    return { kind: 'unavailable', reason: `浏览器存储不可用：${msg(e)}` }
  }
  if (raw === null) return { kind: 'none' }
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return { kind: 'corrupt', reason: '存档不是有效的 JSON 文本' }
  }
  if (!isObj(o)) return { kind: 'corrupt', reason: '存档结构不是对象' }
  const st = o.state
  if (!isObj(st)) return { kind: 'corrupt', reason: '存档缺少角色状态' }
  if (typeof st.name !== 'string' || typeof st.age !== 'number') {
    return { kind: 'corrupt', reason: '存档的角色信息损坏' }
  }
  return {
    kind: 'ok',
    meta: {
      name: st.name,
      age: st.age,
      savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0,
      phase: typeof st.phase === 'string' ? st.phase : 'playing',
      achievements: Array.isArray(st.achievements)
        ? (st.achievements as unknown[]).filter((a): a is string => typeof a === 'string')
        : [],
    },
  }
}

/** 清除存档（游戏终局时调用）。清不掉不阻断 —— 下次写入会覆盖 */
export function clearSaveFrom(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY)
  } catch {
    // 忽略：存储不可用时本来就写不进存档
  }
}
