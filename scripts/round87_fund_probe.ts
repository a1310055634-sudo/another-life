// 第 87 轮（V5）：基金定投对照探针——孪生注入法。
// 同 seed 同策略跑两局：A=未开户基线，B=开局注入基金持仓（年投 6,000、市值 0）。
// 统计：终局现金分布（p10/p50/p90+标准差——「波动加大」）、断供率、赎回参与、
// 广义资产（现金+市值）对照。
// 运行：npx tsx scripts/round87_fund_probe.ts [局数=120]
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import type { GameState, EventChoice } from '../src/engine/types'

const N = Number(process.argv[2] ?? '120')
const SEED_BASE = 87000

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  return score
}

function play(seed: number, injectFund: boolean) {
  let s: GameState = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '对照者' })
  if (injectFund) s = { ...s, fund: { annualContribution: 6000, units: 0 } }
  let guard = 0
  const cashSeries: number[] = []
  let fundEvents = 0
  let redeemed = false
  let paused = false
  while (s.phase === 'playing' && guard < 60) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = cands[guard % cands.length]
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        let best = 0
        let bestScore = -Infinity
        vis.forEach((c, i) => {
          const sc = choiceScore(c)
          if (sc > bestScore) { bestScore = sc; best = i }
        })
        s = applyChoice(s, ev, ev.choices.indexOf(vis[best])).state
        if (ev.id === 'fin_fund_take_profit' || ev.id === 'fin_fund_cut_loss') fundEvents++
      }
    }
    s = advanceYear(s)
    if (s.yearLog.some((l) => l.includes('定投断供了'))) paused = true
    if (s.fund === undefined && fundEvents > 0) redeemed = true
    cashSeries.push(s.money)
  }
  const sorted = [...cashSeries].sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0
  const mean = cashSeries.reduce((a, b) => a + b, 0) / Math.max(1, cashSeries.length)
  const std = Math.sqrt(cashSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, cashSeries.length))
  return {
    ending: judgeEnding(s).id,
    age: s.age,
    money: s.money,
    p10: q(0.1),
    p50: q(0.5),
    p90: q(0.9),
    std: Math.round(std),
    broadPeak: Math.max(...cashSeries) + (s.fund?.units ?? 0),
    fundValue: s.fund?.units ?? 0,
    fundEvents,
    redeemed,
    paused,
  }
}

const pairs: Array<{ seed: number; a: ReturnType<typeof play>; b: ReturnType<typeof play> }> = []
for (let i = 0; i < N; i++) pairs.push({ seed: SEED_BASE + i, a: play(SEED_BASE + i, false), b: play(SEED_BASE + i, true) })

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
const A = pairs.map((p) => p.a)
const B = pairs.map((p) => p.b)
console.log(`孪生对数: ${N}`)
console.log(`B 局基金事件参与: 赎回 ${B.filter((p) => p.redeemed).length} / 仍持有 ${N - B.filter((p) => p.redeemed).length} / 断供发生过 ${B.filter((p) => p.paused).length}`)
console.log(`终局现金均值: A=${mean(A.map((p) => p.money))} B=${mean(B.map((p) => p.money))}`)
const pct = (label: string, pick: (p: ReturnType<typeof play>) => number) => {
  const av = A.map(pick).sort((x, y) => x - y)
  const bv = B.map(pick).sort((x, y) => x - y)
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]
  console.log(`终局现金 ${label}: A p10=${q(av, 0.1)} p50=${q(av, 0.5)} p90=${q(av, 0.9)} ｜ B p10=${q(bv, 0.1)} p50=${q(bv, 0.5)} p90=${q(bv, 0.9)}`)
}
pct('分位', (p) => p.money)
console.log(`年度现金序列标准差均值: A=${mean(A.map((p) => p.std))} B=${mean(B.map((p) => p.std))}（B>A = 波动加大）`)
console.log(`广义资产峰值均值(现金+市值): A=${mean(A.map((p) => p.broadPeak))} B=${mean(B.map((p) => p.broadPeak))}`)
const up = pairs.filter((p) => p.b.money > p.a.money).length
console.log(`B 终局现金 > A 的局数: ${up}/${N}（定投期现金流出，终局方向如实呈现）`)
