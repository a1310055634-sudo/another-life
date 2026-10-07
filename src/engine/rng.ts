/** 可设 seed 的伪随机数（mulberry32），状态可序列化，保证同 seed 同序列 */
export interface Rng {
  /** 返回 [0,1) 浮点 */
  next(): number
  /** 返回 [min,max] 整数（含两端） */
  int(min: number, max: number): number
  /** 返回当前内部状态（用于存档） */
  state(): number
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(min: number, max: number) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    state() {
      return a
    },
  }
}

/** 从序列化状态恢复 RNG */
export function rngFromState(state: number): Rng {
  return mulberry32(state)
}
