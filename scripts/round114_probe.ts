// 第 114 轮（V7）育儿参与线探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round114_probe.ts
// 零泄漏覆盖：无娃/孩子年龄窗外/dink/无 child_path 标记/「全部选项带 requires」可见性。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent, visibleChoices } from '../src/engine/events'
import { mulberry32 } from '../src/engine/rng'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState, Relation } from '../src/engine/types'

const PAR_IDS = ['par_interest_class', 'par_teen_door', 'par_form_night', 'par_path_visible']
const PATHS = ['child_path_academic', 'child_path_vocational', 'child_path_work']

const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  PAR_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

const childOfAge = (childAge: number, playerAge: number): Relation => ({
  id: 'c_p',
  kind: 'child',
  name: '小满',
  closeness: 60,
  alive: true,
  birthAge: playerAge - childAge,
})

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '探针' })
  return { ...base, age, ...patch }
}

// ── 1. 错误状态从不入候选（零泄漏）──────────────────────────
let leak = 0
let checked = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of [28, 33, 40, 45, 50, 55]) {
    // 无娃 → 四事件全部不得入候选
    if (availableEvents(makeState(seed, age), WEIGHTED).some((e) => PAR_IDS.includes(e.id))) leak++
    // 孩子 3 岁（窗外）→ 兴趣班/青春期门/填报前夜不得入候选
    const toddler = { ...makeState(seed, age), relations: [childOfAge(3, age)] }
    if (availableEvents(toddler, WEIGHTED).some((e) => ['par_interest_class', 'par_teen_door', 'par_form_night'].includes(e.id))) leak++
    // 有娃 8 岁 + dink → 兴趣班不得入候选
    const dink = { ...makeState(seed, age, { tags: ['dink'] }), relations: [childOfAge(8, age)] }
    if (availableEvents(dink, WEIGHTED).some((e) => e.id === 'par_interest_class')) leak++
    // 孩子 23 岁无路径标记 → 显形不得入候选
    const noPath = { ...makeState(seed, age), relations: [childOfAge(23, age)] }
    if (availableEvents(noPath, WEIGHTED).some((e) => e.id === 'par_path_visible')) leak++
    // 有娃 8 岁正常局 → 兴趣班可见选项 ≥2（两档花费均 <大额隐藏线，负债年亦然）
    const ok = { ...makeState(seed, age, { money: -5000 }), relations: [childOfAge(8, age)] }
    const ev = ALL_EVENTS.find((e) => e.id === 'par_interest_class')!
    if (availableEvents(ok, WEIGHTED).some((e) => e.id === 'par_interest_class') && visibleChoices(ok, ev).length < 2) leak++
    checked += 5
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent（构造有娃局：8 岁孩子）────────────
const hits: Record<string, number> = {}
for (const id of PAR_IDS) hits[id] = 0
let draws = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of [28, 33, 40, 45]) {
    const st = { ...makeState(seed, age), relations: [childOfAge(8, age)] }
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 3571 + age))
    draws++
    if (ev && PAR_IDS.includes(ev.id)) hits[ev.id]++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 →`, PAR_IDS.map((id) => `${id} ${hits[id]}`).join('、'))

// ── 3. 显形三向分化抽验：命中标记局的可见选项恰为「命中支+无条件支」────
let visOk = 0
let visTotal = 0
for (let seed = 1; seed <= 100; seed++) {
  for (const path of PATHS) {
    const st = {
      ...makeState(seed, 50, { tags: ['child_path_academic', 'child_path_vocational', 'child_path_work'].includes(path) ? [path] : [] }),
      relations: [childOfAge(23, 50)],
    } as GameState
    const texts = visibleChoices(st, ALL_EVENTS.find((e) => e.id === 'par_path_visible')!).map((c) => c.text)
    visTotal++
    if (texts.length === 2) visOk++
  }
}
console.log(`[显形分化] ${visTotal} 个构造局中可见选项恰 2（命中支+无条件支）：${visOk}（须 = total）`)
if (visOk !== visTotal) process.exit(1)
console.log('PROBE PASS')
