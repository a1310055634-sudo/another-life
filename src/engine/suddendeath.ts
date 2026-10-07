// 第 94 轮附挂（R95）：意外窄门散列——death_young 补现的年检窗口。
// 独立散列（盐 0xd34d7e5c "death salt" 变体），roll < 0.10 为「意外风险年」。
// 语义：风险门只决定「意外事件是否入卡」，生死仍由玩家选择（硬扛 vs 求医）。
import type { GameState } from './types'

const SUDDEN_SALT = 0xd34d7e5c

/** 意外风险年概率：10% */
export const SUDDEN_RISK_RATE = 0.1

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 该年是否为「意外风险年」（同参同果；主 rng 零消耗） */
export function suddenRiskAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ SUDDEN_SALT) >>> 0) + age * 104729)
  return rng() < SUDDEN_RISK_RATE
}

/** 意外风险在册判定（读 state.tags 的 risk_taker 在调用侧与 maxAttr health 组合） */
export function suddenRiskNow(state: Pick<GameState, 'seed' | 'age'>): boolean {
  return suddenRiskAt(state.seed, state.age)
}

// ── 第 112 轮：死亡窄门双散列 ─────────────────────────────
// lethal 窄门事件（hlt_accident_blink / hlt_verge_fever）各自的年检散列门。
// 与 suddenRisk（R95 意外风险年 10%）分开定盐定率：窄门事件走「once+低频」口径，
// 千局 death_young 目标带 1–3%，门太热会把窄门抽成常规事件。

const ACCIDENT_SALT = 0xacc1de05
/** 意外窄门年检概率：3% */
export const ACCIDENT_RISK_RATE = 0.03

/** 该年是否为「意外窄门年」（同参同果；主 rng 零消耗） */
export function accidentRiskAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ ACCIDENT_SALT) >>> 0) + age * 104729)
  return rng() < ACCIDENT_RISK_RATE
}

const ILLNESS_SALT = 0x51cc0a5e
/** 急病窄门年检概率：3% */
export const ILLNESS_RISK_RATE = 0.03

/** 该年是否为「急病窄门年」（同参同果；主 rng 零消耗） */
export function illnessRiskAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ ILLNESS_SALT) >>> 0) + age * 104729)
  return rng() < ILLNESS_RISK_RATE
}
