// 第 112 轮（V7 首轮）死亡窄门探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round112_probe.ts
// 口径沿用 R85–R95 新事件验证法：真实 drawEvent + 新事件权重×50；
// 「错误状态从不入候选」= 门控（性格/健康/散列/年龄窗）任一不满足时，
// availableEvents 全扫描（400 seed × 18–50 逐岁）零泄漏；
// 致死整链走 applyChoice → advanceYear（与 round112.test 同口径）。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent, visibleChoices, applyChoice } from '../src/engine/events'
import { advanceYear } from '../src/engine/lifecycle'
import { accidentRiskAt, illnessRiskAt } from '../src/engine/suddendeath'
import { mulberry32 } from '../src/engine/rng'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState } from '../src/engine/types'

const NEW_IDS = ['hlt_accident_blink', 'hlt_verge_fever']
const SICK_ATTRS = { health: 38, happiness: 50, smarts: 50, social: 50, stress: 5 }
const HEALTHY_ATTRS = { health: 90, happiness: 50, smarts: 50, social: 50, stress: 5 }

// 权重×50 池（既有一律不动）
const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  NEW_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'risk_taker', name: '探针' })
  return { ...base, age, ...patch }
}

// ── 1. 错误状态从不入候选（零泄漏扫描）───────────────────────
let leak = 0
let checked = 0
for (let seed = 1; seed <= 400; seed++) {
  for (let age = 18; age <= 50; age++) {
    // 意外窄门：非 risk_taker → 不得入候选
    const noTrait = makeState(seed, age, { tags: [] })
    if (availableEvents(noTrait, WEIGHTED).some((e) => e.id === 'hlt_accident_blink')) leak++
    checked++
    // 意外窄门：散列未命中 → 不得入候选
    if (!accidentRiskAt(seed, age)) {
      const s = makeState(seed, age)
      if (availableEvents(s, WEIGHTED).some((e) => e.id === 'hlt_accident_blink')) leak++
      checked++
    }
    // 急病窄门：健康 >45 → 不得入候选；散列未命中 → 不得入候选
    const healthy = makeState(seed, age, { attrs: { ...HEALTHY_ATTRS } })
    if (availableEvents(healthy, WEIGHTED).some((e) => e.id === 'hlt_verge_fever')) leak++
    checked++
    if (!illnessRiskAt(seed, age)) {
      const s = makeState(seed, age, { attrs: { ...SICK_ATTRS } })
      if (availableEvents(s, WEIGHTED).some((e) => e.id === 'hlt_verge_fever')) leak++
      checked++
    }
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent 抽中统计（每 seed 全窗口逐岁抽一次）────
const hits: Record<string, number> = { hlt_accident_blink: 0, hlt_verge_fever: 0 }
let draws = 0
for (let seed = 1; seed <= 400; seed++) {
  for (let age = 18; age <= 50; age++) {
    const st = makeState(seed, age, { attrs: { ...SICK_ATTRS } })
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 7919 + age))
    draws++
    if (ev && NEW_IDS.includes(ev.id)) hits[ev.id]++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 → hlt_accident_blink ${hits.hlt_accident_blink}、hlt_verge_fever ${hits.hlt_verge_fever}`)

// ── 3. 窄门年检率（散列直查，1000 seed × 窗口逐年）────────────────
let accYears = 0
const accTotal = 1000 * 18
for (let seed = 1; seed <= 1000; seed++)
  for (let age = 18; age <= 35; age++) if (accidentRiskAt(seed, age)) accYears++
let illYears = 0
const illTotal = 1000 * 21
for (let seed = 1; seed <= 1000; seed++)
  for (let age = 30; age <= 50; age++) if (illnessRiskAt(seed, age)) illYears++
console.log(`[年检率] 意外窄门 ${((accYears / accTotal) * 100).toFixed(2)}%（${accYears}/${accTotal}）｜急病窄门 ${((illYears / illTotal) * 100).toFixed(2)}%（${illYears}/${illTotal}）`)

// ── 4. 抽中后选致命支 → applyChoice + advanceYear 整链致死抽查 ────────
// 注：age 25 处 youth_city_or_hometown（V1 抉择，priority>0）整层遮蔽 priority=0
// 候选（weightedPick 分层，R85 在册行为）——意外窄门有效窗口自城市抉择解决后起，
// 抽查取 30 岁（遮蔽期外）。
let deaths = 0
let played = 0
for (let seed = 1; seed <= 4000 && played < 100; seed++) {
  const base = makeState(seed, 30)
  const st = { ...base, tags: [...new Set([...base.tags, 'risk_taker'])] }
  const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 104729))
  if (!ev || ev.id !== 'hlt_accident_blink') continue
  played++
  const vis = visibleChoices(st, ev)
  if (vis.length < 2) {
    console.log(`[致命抽查] seed=${seed} 可见选项 ${vis.length} <2（违规）`)
    process.exit(1)
  }
  const lethalChoice = ev.choices.find((c) => c.effects.some((ef) => ef.lethal) && vis.includes(c))
  if (!lethalChoice) {
    console.log(`[致命抽查] seed=${seed} 致命选项不可见（违规）`)
    process.exit(1)
  }
  const after = applyChoice(st, ev, ev.choices.indexOf(lethalChoice)).state
  const nx = advanceYear(after)
  if (nx.phase === 'ended' && nx.endingId === 'death_young') deaths++
  else {
    console.log(`[致命抽查] seed=${seed} 选致命支未判死（phase=${nx.phase} ending=${nx.endingId ?? 'null'}，违规）`)
    process.exit(1)
  }
}
console.log(`[致命抽查] 抽中意外窄门 ${played} 局，选致命支后 death_young ${deaths} 局（须 = played）`)
console.log('PROBE PASS')
