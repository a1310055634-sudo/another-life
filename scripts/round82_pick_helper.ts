// 第 99 轮：把 round82_stress_probe 的 pickIndex 策略函数原样外置为可导入模块，
// 供性能决算脚本复用——**逻辑零改动**，仅从 const 改为 export function，
// 保证 R99 决算的 400 局与 R82 探针口径一致（可横向对比）。
// R82 原表常量（探针内保留，本模块仅搬运函数体所依赖的外部常量）。
import { isV2Strategy, pickV2 } from './strategy_v2'
import type { EventChoice } from '../src/engine/types'

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }

/** R82 原函数 choiceScore：逐选项打分（用于 survival_best / balanced 等策略） */
export function choiceScoreProbe(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  for (const d of c.delayed ?? []) {
    const de = (d as { effect?: { attr?: string; delta?: number; money?: number } }).effect
    if (de?.attr && de.delta) score += de.delta * (ATTR_WEIGHT[de.attr] ?? 0) * 0.7
    if (de?.money) score += (de.money / 30000) * 0.7
  }
  return score
}

/** R82 原函数 pickIndex：8 策略轮换下的选项选择（V5 行动系统接入后事件池已变，此处保持 R82 口径） */
export function pickIndexProbe(
  vis: EventChoice[], strategy: string, health: number, money: number,
  turn: number, age = 30, smarts = 60, category?: string,
): number {
  if (isV2Strategy(strategy)) return pickV2(vis, strategy, { health, money, age, smarts, category })
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'health_aware' && health < 40) {
    let best = -1, bestGain = 0
    vis.forEach((c, i) => {
      const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
      if (g > bestGain) { bestGain = g; best = i }
    })
    if (best >= 0) return best
  }
  if (strategy === 'balanced') {
    if (money < 0) {
      let best = -1, bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.money && e.money > 0 ? s + e.money : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
    if (health < 45) {
      let best = -1, bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
  }
  if (strategy === 'survival_best') {
    let best = 0, bestScore = -Infinity
    vis.forEach((c, i) => {
      const sc = choiceScoreProbe(c)
      if (sc > bestScore) { bestScore = sc; best = i }
    })
    return best
  }
  if (strategy === 'family_line' && category === 'relationship') return 0
  // family_line（非relationship）/ study_line / friend_line 交给 V2 家族；兜底取最高分
  let best = 0, bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScoreProbe(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}