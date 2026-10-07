// 第 53 轮：往生录（多周目博物馆）——数据层（呈现层，不进引擎）。
// 独立 localStorage 键 another-life:legacy，与存档 v2（another-life:save）完全隔离；
// 每局终局由 App 在清档前追加一条，容量 50 条 FIFO（防止无限膨胀）。
// 损坏安全：JSON 解析失败/非数组一律返回空表且不写回（绝不因坏数据炸 UI）。
// 引擎只读：条目素材来自结算后的 GameState（judgeEnding/后记首句/快照峰值），
// 本模块不做任何引擎调用，只存取纯数据。
const LEGACY_KEY = 'another-life:legacy'
const LEGACY_CAP = 50

export interface LegacyEntry {
  /** 玩家名 */
  name: string
  endingId: string
  endingName: string
  /** 评级 S/A/B/C/D */
  grade: string
  /** 终龄 */
  age: number
  /** 峰值资产（快照峰值与终局值取大；可为负——负债结局合法） */
  peakMoney: number
  /** 一句墓志铭（后记首句或金句） */
  epitaph: string
  /** 本局解锁的成就 id（供跨周目收集去重统计） */
  achievements: string[]
  /** 本局 seed（幂等键：同 seed 同终龄的重复追加跳过，防 effect 双调） */
  seed: number
  /** 终局时间戳（Date.now()） */
  finishedAt: number
  // ── 第 73 轮（V4）展开式回顾扩展字段：旧条目缺省即降级展示，不重写旧数据 ──
  /** 关键抉择摘录（≤3 条，来自 history 的玩家抉择摘要；key 条目优先） */
  keyChoices?: string[]
  /** 资产峰值出现的年龄（快照峰值所在切面；无快照不写） */
  peakAge?: number
  // ── 第 94 轮（V5）世代传承扩展字段：旧条目缺省即不显示代数 ──
  /** 承继代数（≥2 显示「第 N 代」；初代/旧条目缺省） */
  generation?: number
}

/** 读取全部往生录（旧玩家/损坏数据 → 空数组，不写回） */
export function readLegacy(): LegacyEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is LegacyEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as LegacyEntry).name === 'string' &&
        typeof (e as LegacyEntry).endingId === 'string' &&
        typeof (e as LegacyEntry).age === 'number',
    )
  } catch {
    return []
  }
}

/** 追加一条（50 条 FIFO；同 seed 同终龄的末条重复跳过——effect 双调幂等） */
export function appendLegacy(entry: LegacyEntry): void {
  try {
    const list = readLegacy()
    const last = list[list.length - 1]
    if (last && last.seed === entry.seed && last.age === entry.age && last.endingId === entry.endingId) return
    list.push(entry)
    const trimmed = list.slice(Math.max(0, list.length - LEGACY_CAP))
    localStorage.setItem(LEGACY_KEY, JSON.stringify(trimmed))
  } catch {
    // 存储不可用（隐私模式等）：本次写入静默放弃，UI 空态自然
  }
}

/** 清空往生录（首页清空入口的二次确认通过后调用） */
export function clearLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // 存储不可用：静默
  }
}

/** 跨周目成就收集：全部往生录成就 id 的并集（去重） */
export function collectedAchievementIds(): string[] {
  const set = new Set<string>()
  for (const e of readLegacy()) {
    if (Array.isArray(e.achievements)) {
      for (const id of e.achievements) set.add(id)
    }
  }
  return [...set]
}
