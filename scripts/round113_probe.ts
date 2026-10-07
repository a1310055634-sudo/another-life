// 第 113 轮（V7）心理健康线探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round113_probe.ts
// 口径沿用 R85–R113 新事件验证法：真实 drawEvent + 新事件权重×50；
// 零泄漏扫描覆盖四道门（授予双门/tagsNone、出口 tag 门、倾诉关系门、天晴幸福门）。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent } from '../src/engine/events'
import { mulberry32 } from '../src/engine/rng'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState, Relation } from '../src/engine/types'

const MOOD_IDS = ['mood_low_tide', 'mood_self_care', 'mood_talk', 'mood_professional', 'mood_clear_sky']
const EXIT_IDS = ['mood_self_care', 'mood_talk', 'mood_professional', 'mood_clear_sky']
const LOW_ATTRS = { health: 60, happiness: 30, smarts: 50, social: 50, stress: 70 }

const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  MOOD_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '探针' })
  return { ...base, age, ...patch }
}

const granted = (seed: number, age: number): GameState =>
  makeState(seed, age, { attrs: { ...LOW_ATTRS }, tags: ['low_mood'] })

const withFriend = (s: GameState): GameState => ({
  ...s,
  relations: [
    ...s.relations,
    { id: 'f_p', kind: 'friend', name: '老周', closeness: 60, alive: true } as Relation,
  ],
})

// ── 1. 错误状态从不入候选（零泄漏）──────────────────────────
let leak = 0
let checked = 0
const ages: number[] = []
for (let a = 18; a <= 70; a += 4) ages.push(a)
for (let seed = 1; seed <= 300; seed++) {
  for (const age of ages) {
    // 授予门：幸福 40（>35）→ 不得入候选；压力 60（<65）→ 不得入候选
    if (availableEvents(makeState(seed, age, { attrs: { ...LOW_ATTRS, happiness: 40 } }), WEIGHTED).some((e) => e.id === 'mood_low_tide')) leak++
    if (availableEvents(makeState(seed, age, { attrs: { ...LOW_ATTRS, stress: 60 } }), WEIGHTED).some((e) => e.id === 'mood_low_tide')) leak++
    // 授予门：已有标记 → 不得入候选
    if (availableEvents(granted(seed, age), WEIGHTED).some((e) => e.id === 'mood_low_tide')) leak++
    // 出口门：无标记 → 四出口不得入候选
    const noTag = makeState(seed, age, { attrs: { ...LOW_ATTRS } })
    if (availableEvents(noTag, WEIGHTED).some((e) => EXIT_IDS.includes(e.id))) leak++
    // 倾诉关系门：有标记但无活关系 → mood_talk 不得入候选
    const lonely = { ...granted(seed, age), relations: [] }
    if (availableEvents(lonely, WEIGHTED).some((e) => e.id === 'mood_talk')) leak++
    // 天晴幸福门：有标记但幸福 40（<55）→ 不得入候选
    const dark = makeState(seed, age, { attrs: { ...LOW_ATTRS }, tags: ['low_mood'] })
    if (availableEvents(dark, WEIGHTED).some((e) => e.id === 'mood_clear_sky')) leak++
    checked += 6
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent（授予局视角：四出口抽中统计）────────
const hits: Record<string, number> = {}
for (const id of MOOD_IDS) hits[id] = 0
let draws = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of ages) {
    const st = withFriend(granted(seed, age))
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 6007 + age))
    draws++
    if (ev && MOOD_IDS.includes(ev.id)) hits[ev.id]++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 →`, MOOD_IDS.map((id) => `${id} ${hits[id]}`).join('、'))

// ── 3. 出口通道密度：被授予局在 30–39 岁十年间至少一年有出口在候选 ────
let reachable = 0
let total = 0
for (let seed = 1; seed <= 400; seed++) {
  let any = false
  for (let age = 30; age <= 39; age++) {
    if (availableEvents(withFriend(granted(seed, age)), WEIGHTED).some((e) => EXIT_IDS.includes(e.id))) {
      any = true
      break
    }
  }
  total++
  if (any) reachable++
}
console.log(`[出口密度] ${total} 个被授予局中十年窗口内至少一年有出口在候选：${reachable}（${((reachable / total) * 100).toFixed(1)}%）`)
console.log('PROBE PASS')
