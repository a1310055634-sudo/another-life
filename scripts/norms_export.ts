// 第 96 轮（V5）：同龄人对照 norms 导出——新策略池千局跑分位表 → src/data/norms.ts。
// 与 round39 同路（startSession→drawEvent→chooseOption→nextYear），9 策略轮换覆盖
// 24 组合 × 45 seed = 1080 局。生成物 norms.ts 文件头注明复跑命令与日期。
// 运行：npx tsx scripts/norms_export.ts [局数=1080]
import { writeFileSync } from 'node:fs'
import { startSession, chooseOption, nextYear } from '../src/engine/session'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import { isV2Strategy, pickV2 } from './strategy_v2'
import type { GameState, EventChoice } from '../src/engine/types'
import { isV3Strategy, pickV3 } from './strategy_v3'
import { availableActions, performAction } from '../src/engine/actions'

const TARGET = Number(process.argv[2] ?? '1080')
const STRATEGIES_BASE = ['rotate', 'health_aware', 'survival_best', 'balanced', 'family_line', 'family_line_v2', 'study_line', 'friend_line', 'civ_line']
// 第 104 轮：并入 V3 三策略（career_civil / investor / action_balanced），
// 与 R103 起的千局基线同口径——否则展示用的分位表与本轮对照基准不是同一个策略池。
const STRATEGIES = [...STRATEGIES_BASE, 'career_civil', 'investor', 'action_balanced']

// 第 104 轮：action_balanced 的行动轮选取（与 strategy_v3.pickActionForTurn 同款固定轮换，
// 遇不可用顺延；此处内联以免把 V3 的策略判定也拖进展示数据的生成路径）。
const ACTION_ROTATION = ['act_gym', 'act_study', 'act_checkup', 'act_recharge'] as const
function ACTION_ROTATION_PICK(availIds: string[], turn: number): string | null {
  if (!availIds.length) return null
  const avail = new Set(availIds)
  const start = turn % ACTION_ROTATION.length
  for (let k = 0; k < ACTION_ROTATION.length; k++) {
    const id = ACTION_ROTATION[(start + k) % ACTION_ROTATION.length]
    if (avail.has(id)) return id
  }
  return null
}

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const SEEDS = Array.from({ length: Math.ceil(TARGET / 24) }, (_, i) => 70000 + i * 137)

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  return score
}
function pickIndex(vis: EventChoice[], strategy: string, s: GameState, turn: number): number {
  if (isV3Strategy(strategy)) {
    return pickV3(vis, strategy, {
      health: s.attrs.health, money: s.money, age: s.age, smarts: s.attrs.smarts,
      category: undefined, tags: s.tags,
    })
  }
  if (isV2Strategy(strategy)) {
    return pickV2(vis, strategy, { health: s.attrs.health, money: s.money, age: s.age, smarts: s.attrs.smarts, category: undefined })
  }
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'health_aware' && s.attrs.health < 40) {
    let best = -1
    let bestGain = 0
    vis.forEach((c, i) => {
      const g = c.effects.reduce((acc, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? acc + (e.delta ?? 0) : acc), 0)
      if (g > bestGain) { bestGain = g; best = i }
    })
    if (best >= 0) return best
  }
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

interface Sample { money: number; age: number; achievements: number; happinessAvg: number }
const samples: Sample[] = []

let played = 0
let idx = 0
outer: for (const seed of SEEDS) {
  for (const bg of BACKGROUNDS) {
    for (const trait of TRAITS) {
      const strategy = STRATEGIES[idx % STRATEGIES.length]
      idx++
      played++
      let session = startSession({ seed, backgroundId: bg, traitId: trait, name: '样本' }, ALL_EVENTS)
      let guard = 0
      const happinessSeries: number[] = [session.state.attrs.happiness]
      while (session.state.phase === 'playing' && guard < 200) {
        guard++
        if (session.awaitingAdvance) {
          // 第 104 轮：action_balanced 的行动轮（与 round39 同款口径）——
          // 该策略的语义就是「每年做点行动」，不带行动轮等于策略名不副实。
          if (strategy === 'action_balanced') {
            const availIds = availableActions(session.state).map((a) => a.id)
            const pickedId = ACTION_ROTATION_PICK(availIds, guard)
            if (pickedId) {
              session = { ...session, state: performAction(session.state, pickedId).state }
            }
          }
          session = nextYear(session, ALL_EVENTS)
          happinessSeries.push(session.state.attrs.happiness)
          continue
        }
        if (!session.currentEvent) break
        const vis = session.currentEvent.choices.filter((c) => {
          void c
          return true
        })
        const visible = ((): EventChoice[] => {
          // 与 round39 同款：chooseOption 内部按可见性兜底，这里直接传原始下标位置 0..n
          return vis
        })()
        const pick = pickIndex(visible, strategy, session.state, guard)
        const choice = session.currentEvent.choices[pick] ?? session.currentEvent.choices[0]
        session = chooseOption(session, session.currentEvent.choices.indexOf(choice))
        if (guard > 200) break outer
      }
      const s = session.state
      samples.push({
        money: s.money,
        age: s.age,
        achievements: s.achievements.length,
        happinessAvg: happinessSeries.reduce((a, b) => a + b, 0) / Math.max(1, happinessSeries.length),
      })
      if (played >= TARGET) break outer
    }
  }
}

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const pos = q * (sorted.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? sorted[lo] : Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo))
}

const dims = {
  money: samples.map((s) => s.money),
  age: samples.map((s) => s.age),
  achievements: samples.map((s) => s.achievements),
  happinessAvg: samples.map((s) => Math.round(s.happinessAvg)),
}
const qs = [0.1, 0.25, 0.5, 0.75, 0.9]
const norms: Record<string, Record<string, number>> = {}
for (const [k, xs] of Object.entries(dims)) {
  const bucket: Record<string, number> = {}
  for (const q of qs) {
    bucket[`p${Math.round(q * 100)}`] = quantile(xs, q)
  }
  norms[k] = bucket
}

const date = new Date().toISOString().slice(0, 10)
const header = `// 第 96 轮（V5）生成物：同龄人对照分位表（千局模拟 ${samples.length} 局）。
// 复跑命令：npx tsx scripts/norms_export.ts ${TARGET}
// 生成日期：${date}；策略池：9 策略轮换（与 round39 --pool=new 同源）。
// 纯展示数据：仅供 EndingPage「同龄人对照」卡读取，不参与任何引擎结算。
export interface NormDimension { p10: number; p25: number; p50: number; p75: number; p90: number }
export interface Norms { sampleCount: number; generatedAt: string; money: NormDimension; age: NormDimension; achievements: NormDimension; happinessAvg: NormDimension }

export const NORMS: Norms = ${JSON.stringify({ sampleCount: samples.length, generatedAt: date, ...norms }, null, 2)}
`

writeFileSync('src/data/norms.ts', header, { encoding: 'utf-8' })
console.log(`norms.ts written: ${samples.length} samples`)
console.log(JSON.stringify(norms, null, 1))
