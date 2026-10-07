// 第 20 轮最终验收：固定 seed 批量模拟（120 局 = 4 背景 × 6 特质 × 5 seed）。
// 运行：npx tsx scripts/final_acceptance_sim.ts
// 统计：结局分布、终局年龄、保底事件比例、单选事件、once 违规、NaN/越界、卡死。
// 策略混采：rotate（轮换）/ health_aware（低健康择健康）/ survival_best（综合最优）/
// balanced（负债还债+低健康保健+综合最优）四策略轮换，逼近不同真实玩法路线。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import type { GameState, GameEvent, EventChoice } from '../src/engine/types'

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const SEEDS = [11, 20260917, 77, 5, 902]
const MAX_YEARS = 60 // SPEC：18~77 岁最长 60 年
const STRATEGIES = ['rotate', 'health_aware', 'survival_best', 'balanced'] as const

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
    const de = (d as { effect?: { attr?: string; delta?: number; money?: number } }).effect
    if (de?.attr && de.delta) score += de.delta * (ATTR_WEIGHT[de.attr] ?? 0) * 0.7
    if (de?.money) score += (de.money / 30000) * 0.7
  }
  return score
}

function bestGainIdx(vis: EventChoice[], test: (e: { attr?: string; delta?: number; money?: number }) => number): number {
  let best = -1
  let bestGain = 0
  vis.forEach((c, i) => {
    const g = c.effects.reduce((s, e) => s + test(e), 0)
    if (g > bestGain) { bestGain = g; best = i }
  })
  return best
}

function pickIndex(vis: EventChoice[], strategy: string, health: number, money: number, turn: number): number {
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'health_aware' && health < 40) {
    const h = bestGainIdx(vis, (e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0))
    if (h >= 0) return h
  }
  if (strategy === 'balanced') {
    if (money < 0) {
      const m = bestGainIdx(vis, (e) => (e.money && e.money > 0 ? e.money : 0))
      if (m >= 0) return m
    }
    if (health < 45) {
      const h = bestGainIdx(vis, (e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0))
      if (h >= 0) return h
    }
  }
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

interface YearRecord { eventId: string; visible: number; singleChoice: boolean }

function playFullLife(seed: number, bg: string, trait: string, strategy: string): {
  state: GameState
  years: YearRecord[]
  fallbacks: number
  eventDraws: Map<string, number>
  stuck: boolean
} {
  let s = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
  const years: YearRecord[] = []
  const eventDraws = new Map<string, number>()
  let fallbacks = 0
  let guard = 0
  let stuck = false
  while (s.phase === 'playing' && guard < MAX_YEARS) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev: GameEvent = cands[guard % cands.length]
      eventDraws.set(ev.id, (eventDraws.get(ev.id) ?? 0) + 1)
      const vis = visibleChoices(s, ev)
      const single = vis.length < 2 && !ev.singleChoiceOk
      years.push({ eventId: ev.id, visible: vis.length, singleChoice: single })
      if (vis.length > 0) {
        const idx = pickIndex(vis, strategy, s.attrs.health, s.money, guard)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    } else {
      fallbacks++
      years.push({ eventId: 'fallback_quiet_year', visible: 0, singleChoice: false })
    }
    s = advanceYear(s)
  }
  stuck = s.phase === 'playing'
  return { state: s, years, fallbacks, eventDraws, stuck }
}

const endings = new Map<string, number>()
const grades = new Map<string, number>()
const ages: number[] = []
const singleChoices = new Map<string, number>()
const onceViolations: string[] = []
const stuckRuns: string[] = []
const badValues: string[] = []
let totalEvents = 0
let totalFallbacks = 0
let runs = 0
const repeatTop: Array<[string, number]> = []

for (const bg of BACKGROUNDS) {
  for (const trait of TRAITS) {
    for (const [si, seed] of SEEDS.entries()) {
      const strategy = STRATEGIES[(si + BACKGROUNDS.indexOf(bg) + TRAITS.indexOf(trait)) % STRATEGIES.length]
      const { state: s, years, fallbacks, eventDraws, stuck } = playFullLife(seed, bg, trait, strategy)
      runs++
      totalEvents += years.length
      totalFallbacks += fallbacks
      const e = judgeEnding(s)
      endings.set(e.id, (endings.get(e.id) ?? 0) + 1)
      grades.set(e.grade, (grades.get(e.grade) ?? 0) + 1)
      ages.push(s.age)
      if (stuck) stuckRuns.push(`${bg}/${trait}/s${seed} 卡在 ${s.age} 岁`)
      // 数值健康检查
      const attrs = Object.entries(s.attrs)
      const badAttr = attrs.find(([, v]) => !Number.isFinite(v) || v < 0 || v > 100)
      if (badAttr) badValues.push(`${bg}/${trait}/s${seed} 属性 ${badAttr[0]}=${badAttr[1]}`)
      if (!Number.isFinite(s.money) || Math.abs(s.money) > 2_000_000_000) {
        badValues.push(`${bg}/${trait}/s${seed} money=${s.money}`)
      }
      if (s.age > 77) badValues.push(`${bg}/${trait}/s${seed} age=${s.age} 超终局年龄`)
      // 单选与 once 违规
      for (const y of years) {
        if (y.singleChoice) singleChoices.set(y.eventId, (singleChoices.get(y.eventId) ?? 0) + 1)
      }
      const poolOnce = new Set(ALL_EVENTS.filter((ev) => ev.once).map((ev) => ev.id))
      for (const [id, n] of eventDraws) {
        if (n > 1 && poolOnce.has(id)) onceViolations.push(`${id}×${n} (${bg}/${trait}/s${seed})`)
      }
      for (const [id, n] of eventDraws) repeatTop.push([id, n])
    }
  }
}

const ageDist = new Map<number, number>()
for (const a of ages) ageDist.set(a, (ageDist.get(a) ?? 0) + 1)
const repeatAgg = new Map<string, number>()
for (const [id, n] of repeatTop) repeatAgg.set(id, Math.max(repeatAgg.get(id) ?? 0, n))
const multi = [...repeatAgg.entries()].filter(([, n]) => n > 3).sort((a, b) => b[1] - a[1])

console.log(`=== ${runs} 局批量模拟（健康感知混采）===`)
console.log(`结局分布: ${[...endings.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`)
console.log(`等级分布: ${[...grades.entries()].sort().map(([k, v]) => `${k}×${v}`).join(' ')}`)
console.log(`终局年龄: min=${Math.min(...ages)} max=${Math.max(...ages)} 平均=${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`)
console.log(`事件抽取总数=${totalEvents}，保底事件=${totalFallbacks}（${((totalFallbacks / totalEvents) * 100).toFixed(1)}%）`)
console.log(`卡死局数=${stuckRuns.length}${stuckRuns.length ? '：' + stuckRuns.join('；') : ''}`)
console.log(`NaN/越界局数=${badValues.length}${badValues.length ? '：' + badValues.join('；') : ''}`)
console.log(`单选事件种类=${singleChoices.size}${singleChoices.size ? '：' + [...singleChoices.entries()].map(([k, v]) => `${k}×${v}`).join(' ') : ''}`)
console.log(`once 违规=${onceViolations.length}${onceViolations.length ? '：' + onceViolations.slice(0, 5).join('；') : ''}`)
console.log(`单局同一事件最大重复次数>3 的事件: ${multi.map(([k, v]) => `${k}(${v})`).join(' ') || '无'}`)
console.log(`结局种类数=${endings.size}（要求 ≥8）`)
