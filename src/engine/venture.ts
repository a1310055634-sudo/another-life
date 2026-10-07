// 第 116 轮（V7）：创业成败散列——第一笔进账/关门窄门的年检窗口。
// 独立散列（盐各自独立），roll < rate 为「进账年/风险年」。与 R112 死亡窄门同模式：
// 主 rng 零消耗，同参同果。语义：门只决定事件是否入卡，成败仍由玩家选择承载。
const PROFIT_SALT = 0x7a2e0007

/** 第一笔进账年概率：50% */
export const VENTURE_PROFIT_RATE = 0.5

/** 该年是否为「进账年」（同参同果；主 rng 零消耗） */
export function ventureProfitAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ PROFIT_SALT) >>> 0) + age * 104729)
  return rng() < VENTURE_PROFIT_RATE
}

const CLOSE_SALT = 0xc10df00d

/** 关门风险年概率：40% */
export const VENTURE_CLOSE_RATE = 0.4

/** 该年是否为「关门风险年」（同参同果；主 rng 零消耗） */
export function ventureCloseAt(seed: number, age: number): boolean {
  const rng = mulberry32(((seed ^ CLOSE_SALT) >>> 0) + age * 104729)
  return rng() < VENTURE_CLOSE_RATE
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
