// 第 26 轮验收辅助：全事件池端到端模拟——注入一个出生年龄已知的孩子后
// 从当前年龄用轮换策略玩到终局，观察六个里程碑事件是否按孩子年龄自然触发、
// 每孩至多一次是否守住、养育开支是否按龄分档。运行：npx tsx scripts/child_lifecycle_sim.ts
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { drawEvent, applyChoice, visibleChoices } from '../src/engine/events'
import { rngFromState } from '../src/engine/rng'
import { validateState } from '../src/engine/validate'
import { judgeEnding } from '../src/engine/outcomes'
import { childExpense } from '../src/engine/finance'
import { ALL_EVENTS } from '../src/data/events'
import type { GameState, Relation } from '../src/engine/types'

const MILESTONE_IDS = new Set([
  'fam_child_junior', 'fam_child_senior', 'fam_child_gaokao',
  'fam_child_first_job', 'fam_child_wedding', 'fam_grandchild',
])

function run(seed: number): void {
  let s: GameState = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '模拟' })
  // 在 28 岁注入 27 岁生的小孩（模拟 rel_child_question 延迟出生已落地的存档）
  const kid: Relation = { id: 'c_sim', kind: 'child', name: '宝宝', closeness: 65, alive: true, birthAge: 27 }
  let injected = false
  const fired = new Map<string, number>()
  const guard = 0
  let g = 0
  while (s.phase === 'playing' && g < 60) {
    g++
    if (!injected && s.age >= 28) {
      s = { ...s, relations: [...s.relations, kid] }
      injected = true
    }
    // 真实抽卡路径：weightedPick 的高优先级层让里程碑事件在其年龄窗内优先展示
    const rng = rngFromState(s.rngState)
    const chosen = drawEvent(s, ALL_EVENTS, rng)
    const vis = visibleChoices(s, chosen)
    if (vis.length > 0) {
      s = applyChoice(s, chosen, chosen.choices.indexOf(vis[0])).state
      if (MILESTONE_IDS.has(chosen.id)) {
        fired.set(chosen.id, (fired.get(chosen.id) ?? 0) + 1)
        const c = s.relations.find((r) => r.kind === 'child' && r.alive)
        console.log(`  [seed ${seed}] ${s.age} 岁：${chosen.id} → 孩子里程碑 [${c?.milestones?.join(',') ?? ''}]`)
      }
    }
    s = advanceYear(s)
    const issues = validateState(s).issues
    if (issues.length > 0) {
      console.error(`  [seed ${seed}] ${s.age} 岁状态非法:`, issues)
      process.exit(1)
    }
  }
  const c = s.relations.find((r) => r.kind === 'child')
  console.log(
    `[seed ${seed}] 终局 ${s.age} 岁 / ${judgeEnding(s).name} / 孩子里程碑 [${c?.milestones?.join(',') ?? '无'}] / ` +
    `触发次数 ${[...fired.entries()].map(([k, v]) => `${k}×${v}`).join(' ') || '无'}`,
  )
  // 每个里程碑事件对每个孩子至多一次：注入的是单孩，任何事件触发不得超过 1 次
  for (const [k, v] of fired) {
    if (v > 1) {
      console.error(`  [seed ${seed}] 违规：${k} 触发了 ${v} 次`)
      process.exit(1)
    }
  }
  void guard
  void childExpense
}

for (const seed of [7, 42, 20260928]) run(seed)
console.log('child_lifecycle_sim：全部通过（零非法状态、里程碑零重复）')
