// 第 94 轮（V5）：世代传承——血脉延续。
// 独立 localStorage 键 another-life:bloodline（第 5 键），与存档 v2/往生录完全隔离；
// 纯函数 buildBloodlineEntry/applyBloodline + legacy 式 try/catch 存取。
// 遗产规则：inheritanceMoney = min(终局现金 × 30%, 500,000)，下限 0（负资产不继承债务）。
// 承继开局：姓氏锁定（先祖名首字）、遗产到账、generation:N 标记、新 seed 独立掷（App 侧）。
import type { GameState } from './types'

export const BLOODLINE_KEY = 'another-life:bloodline'

export interface BloodlineEntry {
  /** 承继代数：初代立碑 = 1，承继开局 = 先辈 generation + 1 */
  generation: number
  /** 家族姓氏（先辈名首字） */
  surname: string
  /** 遗产（元，已按规则折算） */
  inheritanceMoney: number
  /** 先辈姓名 */
  ancestorName: string
  /** 先辈结局 id */
  ancestorEndingId: string
  /** 承继时间戳（Date.now()） */
  finishedAt: number
  /** 遗嘱分配方式（第 117 轮，可选）：缺省 'even'=现行语义，旧键（无本字段）加载行为逐位不变 */
  allocation?: WillAllocation
  /** 家训 id（第 122 轮，可选）：承继开局三选一所定；旧键（无本字段）=无家训=旧行为 */
  mottoId?: string
  /** 家训文案（第 122 轮，可选；与 mottoId 成对落键，编年面板展示用） */
  mottoText?: string
}

/** 遗嘱分配方式（第 117 轮）：even 均分 / weighted 多帮衬（×1.3 仍封顶）/ grandchild 留孙辈（金额同均分，流向叙事） */
export type WillAllocation = 'even' | 'weighted' | 'grandchild'

/** 遗产分割比例：终局现金的 30% */
export const INHERIT_RATE = 0.3
/** 遗产上限（元） */
export const INHERIT_CAP = 500000
/** 多帮衬档系数（第 117 轮）：weighted = 基础额 ×1.3，仍受 50 万封顶 */
export const INHERIT_WEIGHTED_MUL = 1.3

/** 遗产折算：min(现金×30%, 50 万)，负资产→0；weighted 档 ×1.3 后同样封顶（第 117 轮） */
export function inheritanceOf(money: number, allocation: WillAllocation = 'even'): number {
  if (!Number.isFinite(money) || money <= 0) return 0
  const base = Math.round(money * INHERIT_RATE)
  if (allocation === 'weighted') return Math.min(Math.round(base * INHERIT_WEIGHTED_MUL), INHERIT_CAP)
  // even / grandchild 同额：孙辈向只改流向叙事，无孙辈时由事件层回落 even（防御式）
  return Math.min(base, INHERIT_CAP)
}

/** 从状态标记派生分配方式（第 117 轮）：late_will_split 三向落 tag，终局写入时归一；无标记=even=旧行为 */
export function willAllocationOf(tags: string[]): WillAllocation {
  if (tags.includes('will_mode_weighted')) return 'weighted'
  if (tags.includes('will_mode_grandchild')) return 'grandchild'
  return 'even'
}

// ── 第 122 轮：家训与家族编年 ──
// 家训池 6 条（各绑定开局微效果：指定属性 +1 或压力 −1，一档写死）；
// 承继开局三选一（pickMottoTriple 从祖先条目 finishedAt 派生散列，支流不耗主 rng、
// 同键同序恒同三张）；选中落 bloodline.mottoId/mottoText（可选字段，旧键=无家训=旧行为）
// + state tags motto_set/motto:{id}（成就系统只读 state，bloodline 键不可读——镜像纪律）。
export interface MottoDef {
  id: string
  text: string
  /** 微效果：'health' | 'happiness' | 'smarts' | 'social' 为对应属性 +1；'stress' 为压力 −1 */
  bonus: 'health' | 'happiness' | 'smarts' | 'social' | 'stress'
}

export const MOTTO_POOL: MottoDef[] = [
  { id: 'motto_diligent', text: '一勤天下无难事', bonus: 'health' },
  { id: 'motto_harmony', text: '家和万事兴', bonus: 'happiness' },
  { id: 'motto_learning', text: '家学不可废', bonus: 'smarts' },
  { id: 'motto_neighbor', text: '远亲不如近邻', bonus: 'social' },
  { id: 'motto_loss_is_gain', text: '吃亏是福', bonus: 'happiness' },
  { id: 'motto_steady', text: '稳字当头', bonus: 'stress' },
]

/** 家训三选一（同盐恒同三张，去重；主 rng 零消耗） */
export function pickMottoTriple(salt: number): MottoDef[] {
  const rng = mulberry32(((salt ^ 0x6d0174a3) >>> 0) + 97)
  const picked: MottoDef[] = []
  const seen = new Set<number>()
  while (picked.length < 3) {
    const idx = Math.floor(rng() * MOTTO_POOL.length) % MOTTO_POOL.length
    if (seen.has(idx)) continue
    seen.add(idx)
    picked.push(MOTTO_POOL[idx])
  }
  return picked
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 按 id 查家训（未知 id 防御式返回 undefined=无微效果） */
export function mottoById(id: string | undefined): MottoDef | undefined {
  if (!id) return undefined
  return MOTTO_POOL.find((m) => m.id === id)
}

/** 终局态 → 血脉条目（终局页「以子女之名」按钮触发时调用）；allocation 可选（缺省不落字段=旧键形态） */
export function buildBloodlineEntry(
  state: GameState,
  prevGeneration: number,
  finishedAt = Date.now(),
  allocation?: WillAllocation,
): BloodlineEntry {
  return {
    generation: prevGeneration + 1,
    surname: state.name.charAt(0),
    inheritanceMoney: inheritanceOf(state.money, allocation),
    ancestorName: state.name,
    ancestorEndingId: state.endingId ?? 'unknown',
    finishedAt,
    ...(allocation !== undefined ? { allocation } : {}),
  }
}

/** 承继开局注入：遗产到账 + generation:N 标记（姓氏/名字由调用方处理） */
/** 承继开局注入：遗产到账 + generation:N 标记（姓氏/名字由调用方处理）；
 * 第 122 轮：mottoId 在册时应用家训微效果（属性 +1/压力 −1）+ motto_set/motto:{id} 标记；
 * mottoId 缺省（旧键/未选）=旧行为逐位不变。 */
export function applyBloodline(state: GameState, entry: BloodlineEntry, mottoId?: string): GameState {
  let attrs = { ...state.attrs }
  const tags = new Set(state.tags)
  tags.add(`generation:${entry.generation}`)
  const motto = mottoById(mottoId)
  if (motto) {
    if (motto.bonus === 'stress') attrs.stress = Math.max(0, attrs.stress - 1)
    else attrs[motto.bonus] = Math.min(100, attrs[motto.bonus] + 1)
    tags.add('motto_set')
    tags.add(`motto:${motto.id}`)
  }
  return {
    ...state,
    attrs,
    money: state.money + entry.inheritanceMoney,
    tags: [...tags],
  }
}

/** 读取血脉键（旧玩家/损坏数据/无 localStorage → null） */
export function readBloodline(): BloodlineEntry | null {
  try {
    const raw = localStorage.getItem(BLOODLINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BloodlineEntry> | null
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.generation !== 'number' ||
      typeof parsed.surname !== 'string' ||
      typeof parsed.inheritanceMoney !== 'number' ||
      typeof parsed.ancestorName !== 'string'
    ) {
      return null
    }
    return parsed as BloodlineEntry
  } catch {
    return null
  }
}

/** 写入血脉键（损坏数据/无 localStorage 静默失败，不阻塞主流程） */
export function writeBloodline(entry: BloodlineEntry): void {
  try {
    localStorage.setItem(BLOODLINE_KEY, JSON.stringify(entry))
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

/** 清除血脉键（重新开始血脉用；当前版本不暴露入口，预留） */
export function clearBloodline(): void {
  try {
    localStorage.removeItem(BLOODLINE_KEY)
  } catch {
    /* 同上 */
  }
}
