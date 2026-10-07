// 第 86 轮（V5）：房产系统对照探针——孪生注入法。
// 同 seed 同策略跑两局：A=无房基线，B=开局注入房产（basis=value=40 万，18 岁盖章）。
// 统计：终局现金差、现金峰值差、广义资产峰值差（终局现金+持有现值——「峰值上移」
// 在广义口径成立：复利增值+卖出变现；纯持有局现金峰值持平或略降=维护费，如实分列）。
// 运行：npx tsx scripts/round86_home_probe.ts [局数=120]
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import type { GameState, EventChoice } from '../src/engine/types'

const N = Number(process.argv[2] ?? '120')
const SEED_BASE = 86000

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  return score
}

function play(seed: number, injectHome: boolean) {
  let s: GameState = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '对照者' })
  if (injectHome) s = { ...s, home: { basis: 400000, value: 400000, purchasedAtAge: 18 } }
  let guard = 0
  let peakMoney = s.money
  let homeEvents = 0
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
        if (ev.id === 'home_living' || ev.id === 'home_sell_forced') homeEvents++
      }
    }
    s = advanceYear(s)
    if (s.money > peakMoney) peakMoney = s.money
  }
  const broadPeak = peakMoney + (s.home?.value ?? 0)
  return {
    ending: judgeEnding(s).id,
    age: s.age,
    money: s.money,
    peakMoney,
    broadPeak,
    homeValue: s.home?.value ?? 0,
    homeEvents,
  }
}

const pairs: Array<{ seed: number; a: ReturnType<typeof play>; b: ReturnType<typeof play> }> = []
for (let i = 0; i < N; i++) pairs.push({ seed: SEED_BASE + i, a: play(SEED_BASE + i, false), b: play(SEED_BASE + i, true) })

const mean = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0)
const soldB = pairs.filter((p) => p.b.homeEvents > 0 && p.b.homeValue === 0).length
const livingB = pairs.filter((p) => p.b.homeEvents > 0 && p.b.homeValue > 0).length
const untouchedB = pairs.filter((p) => p.b.homeEvents === 0).length

console.log(`孪生对数: ${N}`)
console.log(`B 局房产事件参与: 卖出变现 ${soldB} / 纯持有 ${livingB} / 未触房产事件 ${untouchedB}`)
console.log(`终局现金均值: A=${mean(pairs.map((p) => p.a.money))} B=${mean(pairs.map((p) => p.b.money))}`)
console.log(`现金峰值均值: A=${mean(pairs.map((p) => p.a.peakMoney))} B=${mean(pairs.map((p) => p.b.peakMoney))}`)
console.log(`广义资产峰值均值(现金+持有现值): A=${mean(pairs.map((p) => p.a.broadPeak))} B=${mean(pairs.map((p) => p.b.broadPeak))}`)
const up = pairs.filter((p) => p.b.broadPeak > p.a.broadPeak).length
console.log(`B 广义峰值 > A 的局数: ${up}/${N}（${((up / N) * 100).toFixed(1)}%）——方向结论：广义峰值上移`)
const soldUps = pairs.filter((p) => p.b.homeValue === 0 && p.b.homeEvents > 0 && p.b.peakMoney > p.a.peakMoney).length
console.log(`卖出变现局现金峰值上移: ${soldUps}/${soldB || 0}（现金口径「峰值上移」仅变现局成立）`)
