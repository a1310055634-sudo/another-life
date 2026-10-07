// 第 116 轮（V7）创业事件族探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round116_probe.ts
// 零泄漏覆盖：非 entrepreneur×4 链事件、散列门关×2、钱门（辞职需 3 万）、biz_failed 门。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent } from '../src/engine/events'
import { mulberry32 } from '../src/engine/rng'
import { ventureCloseAt, ventureProfitAt } from '../src/engine/venture'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState } from '../src/engine/types'

const ENT_IDS = ['ven_quit_resign', 'ven_first_year', 'ven_first_profit', 'ven_scale_or_hold', 'vent_close_day', 'vent_back_to_work']
const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }

const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  ENT_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '探针' })
  return { ...base, age, ...patch }
}

// ── 1. 错误状态从不入候选（零泄漏）──────────────────────────
let leak = 0
let checked = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of [28, 33, 40, 45]) {
    const ent = { ...makeState(seed, age, { career: { kind: 'unemployed' as const, weeks: 1 }, money: 20000, tags: ['entrepreneur'] }) }
    const profitOn = ventureProfitAt(seed, age)
    const closeOn = ventureCloseAt(seed, age)
    // 非 entrepreneur（在职+有钱）→ 五个链事件不得入候选（辞职链头本应可用）
    const worker = makeState(seed, age, { career: EMPLOYED, money: 50000 })
    if (availableEvents(worker, WEIGHTED).some((e) => ENT_IDS.slice(1).includes(e.id))) leak++
    // entrepreneur + 进账门关 → 第一笔进账不得入候选
    if (!profitOn && availableEvents(ent, WEIGHTED).some((e) => e.id === 'ven_first_profit')) leak++
    // entrepreneur + 风险门关 → 关门不得入候选
    if (!closeOn && availableEvents(ent, WEIGHTED).some((e) => e.id === 'vent_close_day')) leak++
    // 无 biz_failed → 重新上班不得入候选
    if (availableEvents(makeState(seed, age), WEIGHTED).some((e) => e.id === 'vent_back_to_work')) leak++
    // entrepreneur 且两门全关 → 启动期/扩张仍应可用，进账+关门同时缺席须成立
    if (!profitOn && !closeOn && availableEvents(ent, WEIGHTED).some((e) => ['ven_first_profit', 'vent_close_day'].includes(e.id))) leak++
    checked += 5
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent（在职有钱局=辞职链头可达）──────────
const hits: Record<string, number> = {}
for (const id of ENT_IDS) hits[id] = 0
let draws = 0
let resignDrawn = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of [28, 33, 40]) {
    const st = makeState(seed, age, { career: EMPLOYED, money: 50000 })
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 977 + age))
    draws++
    if (ev && ENT_IDS.includes(ev.id)) hits[ev.id]++
    if (ev?.id === 'ven_quit_resign') resignDrawn++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 →`, ENT_IDS.map((id) => `${id} ${hits[id]}`).join('、'))
console.log(`[链头可达] 辞职事件抽中 ${resignDrawn} 次（须 >0）`)
if (resignDrawn === 0) process.exit(1)
console.log('PROBE PASS')
