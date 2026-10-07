// 第 20 轮策略对照：轮换 / 健康感知 / 生存最优 三策略同池对比，
// 判断死亡偏斜是机器人策略后果还是数值问题。运行：npx tsx scripts/strategy_contrast.ts
// 第 61 轮（V4）：+family_line_v2/study_line/friend_line（实现在 ./strategy_v2.ts，
// 启动时先跑单测式自检，失败 exit 1）。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import { isV2Strategy, pickV2, selfCheckV2 } from './strategy_v2'
import type { GameState, EventChoice } from '../src/engine/types'

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const SEEDS = [11, 20260917, 77, 5, 902]

const ATTR_WEIGHT: Record<string, number> = {
  health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2,
}

function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  for (const d of c.delayed ?? []) {
    if (d.effect) {
      const de = d.effect as { attr?: string; delta?: number; money?: number }
      if (de.attr && de.delta) score += de.delta * (ATTR_WEIGHT[de.attr] ?? 0) * 0.7
      if (de.money) score += de.money / 30000 * 0.7
    }
  }
  return score
}

function pick(vis: EventChoice[], strategy: string, health: number, money: number, turn: number,
  age = 30, smarts = 60, category?: string,
): number {
  if (isV2Strategy(strategy)) return pickV2(vis, strategy, { health, money, age, smarts, category })
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'health_aware' && health < 40) {
    let best = -1
    let bestGain = 0
    vis.forEach((c, i) => {
      const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
      if (g > bestGain) { bestGain = g; best = i }
    })
    if (best >= 0) return best
  }
  if (strategy === 'balanced') {
    // 负债优先还债，健康低位优先健康，否则综合最优
    if (money < 0) {
      let best = -1
      let bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.money && e.money > 0 ? s + e.money : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
    if (health < 45) {
      let best = -1
      let bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
  }
  // 生存最优：综合增益最大的选项
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

function play(seed: number, bg: string, trait: string, strategy: string): GameState {
  let s = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
  let guard = 0
  while (s.phase === 'playing' && guard < 60) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = cands[guard % cands.length]
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pick(vis, strategy, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
  }
  return s
}

selfCheckV2()
for (const strategy of ['rotate', 'health_aware', 'survival_best', 'balanced', 'family_line_v2', 'study_line', 'friend_line']) {
  const endings = new Map<string, number>()
  const ages: number[] = []
  for (const bg of BACKGROUNDS) {
    for (const trait of TRAITS) {
      for (const seed of SEEDS) {
        const s = play(seed, bg, trait, strategy)
        const e = judgeEnding(s)
        endings.set(e.id, (endings.get(e.id) ?? 0) + 1)
        ages.push(s.age)
      }
    }
  }
  const avg = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)
  console.log(`[${strategy}] 平均终龄 ${avg} | ${[...endings.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`)
}
