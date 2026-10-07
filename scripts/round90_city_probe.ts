// 第 90 轮（V5）：城市迁移对照探针——孪生注入法。
// 同 seed 同策略两局：A=老家（缺省），B=开局迁入一线（city=metro）。
// 统计：终局现金、现金峰值、40 岁前购房时点（homeowner 标记出现年）、广义资产。
// 预期方向：metro 局薪资×1.35/成本×1.3 → 净现金流更厚 → 峰值上移；
// 「购房更晚」以首现 homeowner 标记年龄对照（金额门槛固定、现金流更厚→更早，
// 但生活成本更高→更晚，两力对冲——实测如实呈现，不做硬断言）。
// 运行：npx tsx scripts/round90_city_probe.ts [局数=120]
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import type { GameState, EventChoice } from '../src/engine/types'

const N = Number(process.argv[2] ?? '120')
const SEED_BASE = 90000

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  return score
}

function play(seed: number, metro: boolean) {
  let s: GameState = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '对照者' })
  if (metro) s = { ...s, city: 'metro' }
  let guard = 0
  let peakMoney = s.money
  let homeownerAge = -1
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
        if (s.tags.includes('homeowner') && homeownerAge < 0) homeownerAge = s.age
      }
    }
    s = advanceYear(s)
    if (s.money > peakMoney) peakMoney = s.money
  }
  return {
    ending: judgeEnding(s).id,
    age: s.age,
    money: s.money,
    peakMoney,
    homeownerAge,
    broadPeak: peakMoney + (s.home?.value ?? 0),
  }
}

const pairs: Array<{ seed: number; a: ReturnType<typeof play>; b: ReturnType<typeof play> }> = []
for (let i = 0; i < N; i++) pairs.push({ seed: SEED_BASE + i, a: play(SEED_BASE + i, false), b: play(SEED_BASE + i, true) })

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
const A = pairs.map((p) => p.a)
const B = pairs.map((p) => p.b)
const boughtB = pairs.filter((p) => p.b.homeownerAge > 0)
console.log(`孪生对数: ${N}`)
console.log(`终局现金均值: A=${mean(A.map((p) => p.money))} B(metro)=${mean(B.map((p) => p.money))}`)
console.log(`现金峰值均值: A=${mean(A.map((p) => p.peakMoney))} B=${mean(B.map((p) => p.peakMoney))}`)
console.log(`广义资产峰值均值: A=${mean(A.map((p) => p.broadPeak))} B=${mean(B.map((p) => p.broadPeak))}`)
const up = pairs.filter((p) => p.b.peakMoney > p.a.peakMoney).length
console.log(`B 现金峰值 > A 的局数: ${up}/${N}（${((up / N) * 100).toFixed(1)}%）`)
if (boughtB.length > 0) {
  const avgBuy = Math.round(boughtB.reduce((a, p) => a + (p.b.homeownerAge), 0) / boughtB.length)
  const twins = boughtB.map((p) => p.a.homeownerAge > 0 ? p.a.homeownerAge : -1)
  const boughtA = twins.filter((x) => x > 0)
  const avgBuyA = boughtA.length > 0 ? Math.round(boughtA.reduce((a, b) => a + b, 0) / boughtA.length) : -1
  console.log(`B 购房局数=${boughtB.length} 平均购房年龄=${avgBuy}${avgBuyA > 0 ? ` ｜ A 有房对照=${boughtA.length} 局均值 ${avgBuyA}` : ' ｜ A 无对照购房局'}`)
} else {
  console.log('B 购房局数=0（机器人现金流策略不购房——购房时点对照不可测，如实呈现）')
}
