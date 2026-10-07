// 第 20 轮验收辅助：事件池年龄窗口分布 + 普通事件最少可见选项统计
// 运行：npx tsx scripts/window_stats.ts
import { ALL_EVENTS } from '../src/data/events'
import { visibleChoices, isEventAvailable } from '../src/engine/events'
import { createNewGame } from '../src/engine/init'
import type { GameState } from '../src/engine/types'

const stages = [
  ['青年 18-30', 18, 30],
  ['中年 31-50', 31, 50],
  ['晚年 51-77', 51, 77],
] as const

console.log(`事件池总数=${ALL_EVENTS.length}（SPEC §7 要求 ≥72）`)
for (const [label, lo, hi] of stages) {
  const n = ALL_EVENTS.filter((e) => e.minAge <= hi && e.maxAge >= lo).length
  console.log(`${label}: 与该窗口相交的事件 ${n} 个`)
}
// 各年龄点上（默认角色）可用事件量抽样
const s: GameState = createNewGame({ seed: 11, backgroundId: 'ordinary', traitId: 'studious', name: '统计' })
for (const age of [20, 35, 55, 65, 72]) {
  const probe = { ...s, age }
  const avail = ALL_EVENTS.filter((e) => {
    try {
      return isEventAvailable(probe, e)
    } catch {
      return false
    }
  })
  console.log(`普通开局 @${age} 岁: 可用事件 ${avail.length} 个`)
}
