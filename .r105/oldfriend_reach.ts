// 第 105 轮：ach_old_friend（莫逆之交）人类可达性裁决探针 —— 纯只读，不改任何产品源码。
//
// R104 把本成就从 common 升到 legendary，理由是「机器不可达 ≠ 人类不可达」，
// 但同时显式登记「人类可达性亦存疑」，要求本轮用构造测试裁决。推理不算数，走真实引擎：
//   ① settleRelationDecay 年度衰减（普通友 −2 / 挚友 −1，纯函数）
//   ② 真实事件池 + 真实 requires 过滤 + session 路径 chooseOption
// 策略：每局「最大化 friend 亲密度」——在当前事件的可见选项里挑 relation 增益最大的那个，
//       没有增益就按 events.ts 原顺序选（不干预引擎选择逻辑）。
// 判定：55 岁及以后是否出现过 friend closeness ≥ 85。
import { startSession, chooseOption, nextYear, type Session } from '../src/engine/session'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, EventChoice } from '../src/engine/types'

interface ChoiceGain { idx: number; gain: number; text: string }

function bestFriendChoice(ev: GameEvent): ChoiceGain | null {
  let best: ChoiceGain | null = null
  ev.choices.forEach((c: EventChoice, idx: number) => {
    for (const eff of c.effects ?? []) {
      const rel = (eff as { relation?: { kind?: string; deltaCloseness?: number } }).relation
      if (rel?.kind === 'friend' && typeof rel.deltaCloseness === 'number' && rel.deltaCloseness > 0) {
        if (!best || rel.deltaCloseness > best.gain) best = { idx, gain: rel.deltaCloseness, text: c.text }
      }
    }
  })
  return best
}

function maxFriendCloseness(s: Session['state']): number {
  let m = -1
  for (const r of s.relations) if (r.kind === 'friend' && r.alive) m = Math.max(m, r.closeness)
  return m
}

const RUNS = Number(process.argv[2] ?? 80)
const BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']

let hits = 0
let peakAt55: number[] = []
let peakAfter55: number[] = []
const curves: number[] = []
let eventsUsed = 0

for (let i = 0; i < RUNS; i++) {
  const seed = 20260000 + i * 7919
  let session = startSession(
    { seed, backgroundId: BG[i % BG.length], traitId: TRAITS[i % TRAITS.length], name: '裁决' },
    ALL_EVENTS,
  )
  const curve: number[] = []
  let guard = 0
  while (session.state.phase === 'playing' && guard < 200) {
    guard++
    if (session.awaitingAdvance) {
      const ageBefore = session.state.age
      session = nextYear(session, ALL_EVENTS)
      curve[session.state.age] = maxFriendCloseness(session.state)
      if (session.state.age >= 55 && curve[55] !== undefined && peakAt55.length < RUNS) peakAt55.push(curve[55])
      continue
    }
    if (!session.currentEvent) break
    const pick = bestFriendChoice(session.currentEvent)
    const idx = pick ? pick.idx : 0
    if (pick) eventsUsed++
    session = chooseOption(session, idx)
  }
  for (let a = 55; a <= 80; a++) {
    if (typeof curve[a] === 'number') {
      if (a === 55) peakAt55.push(curve[a])
      if (a > 55) peakAfter55.push(curve[a])
      if (curve[a] >= 85) { hits++; break }
    }
  }
  if (i < 6) curves.push(curve.slice(18, 66))
}

const stat = (xs: number[]) => {
  if (!xs.length) return 'n=0'
  const s = [...xs].sort((a, b) => a - b)
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  return `n=${s.length} min=${s[0]} p50=${p(0.5)} p90=${p(0.9)} max=${s[s.length - 1]}`
}

console.log(`RUNS=${RUNS} runs hitting >=85 at age>=55: ${hits} (${((hits / RUNS) * 100).toFixed(1)}%)`)
console.log(`friend-gain choices actually taken: ${eventsUsed} (avg ${(eventsUsed / RUNS).toFixed(1)}/run)`)
console.log(`max friend closeness @55: ${stat(peakAt55)}`)
console.log(`max friend closeness @56-80: ${stat(peakAfter55)}`)
console.log('sample curves age18-65 (first 6 runs):')
for (const c of curves) console.log('  ' + c.map((v) => String(v ?? 0).padStart(3)).join(''))