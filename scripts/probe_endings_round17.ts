// 诊断工具（第 17 轮引入，供第 20 轮批量调参复用）：
// 全生涯批量模拟的结局分布、死亡年龄与健康轨迹探针。运行：npx tsx scripts/probe_endings_round17.ts
// 注意：轮换机器人会反复选同一类选项，压力/健康螺旋是它自找的——
// 读数时区分「机器策略后果」与「数值问题」，数值平衡以第 20 轮 500 局批量模拟为准。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import type { GameState } from '../src/engine/types'

function playFullLife(seed: number, bg: string, trait: string, pickMod = 0): GameState {
  let s = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
  let guard = 0
  while (s.phase === 'playing' && guard < 60) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const chosen = cands[(guard + pickMod) % cands.length]
      const vis = visibleChoices(s, chosen)
      if (vis.length > 0) {
        const choice = vis[(guard + pickMod) % vis.length]
        s = applyChoice(s, chosen, chosen.choices.indexOf(choice)).state
      }
    }
    s = advanceYear(s)
  }
  return s
}

const rows: string[] = []
const endings = new Map<string, number>()
const SEEDS = [11, 20260917, 77, 5, 902]
const STARTS = [
  ['ordinary', 'studious'], ['rural', 'ambitious'], ['wealthy', 'sociable'],
  ['ordinary', 'frugal'], ['single_parent', 'studious'], ['rural', 'frugal'],
] as const
for (const [bg, trait] of STARTS) {
  for (const seed of SEEDS) {
    for (const pm of [0, 1]) {
      const s = playFullLife(seed, bg, trait, pm)
      const e = judgeEnding(s)
      endings.set(e.id, (endings.get(e.id) ?? 0) + 1)
      rows.push(
        `${bg}/${trait}/s${seed}/p${pm}: 终 ${s.age} 岁 ${e.id}(${e.grade}) ` +
        `健${s.attrs.health} 心${s.attrs.happiness} 压${s.attrs.stress} 钱${Math.round(s.money / 10000)}万 ` +
        `标签[${s.tags.filter((t) => ['chronic_pain', 'light_smoker', 'quit_smoking', 'health_comeback', 'avoided_doctor', 'workaholic_streak', 'night_owl', 'routine_exercise', 'been_deep_debt'].includes(t)).join(',')}]`,
      )
    }
  }
}
console.log(rows.join('\n'))
console.log('分布:', [...endings.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' '))
