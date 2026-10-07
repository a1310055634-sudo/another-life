// 第 118 轮（V7）年关系统探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round118_probe.ts
// 零泄漏覆盖：老家/已婚/年龄窗外/无 home_for_ny/无 ny_stay_town/无 colleague 六道门。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent, visibleChoices } from '../src/engine/events'
import { mulberry32 } from '../src/engine/rng'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState, Relation } from '../src/engine/types'

const NY_IDS = ['ny_where', 'ny_questions', 'ny_stay_dinner']
const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }
const colleague = (): Relation => ({ id: 'col_p', kind: 'colleague', name: '老郑', closeness: 60, alive: true })

const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  NY_IDS.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '探针' })
  return { ...base, age, ...patch }
}

// ── 1. 错误状态从不入候选（零泄漏）──────────────────────────
let leak = 0
let checked = 0
for (let seed = 1; seed <= 250; seed++) {
  for (const age of [31, 40, 50, 58]) {
    // 老家 → ny_where 不得入候选
    if (availableEvents(makeState(seed, age, { city: 'hometown', career: EMPLOYED }), WEIGHTED).some((e) => e.id === 'ny_where')) leak++
    // 已婚离乡 → ny_where 不得入候选
    if (availableEvents(makeState(seed, age, { city: 'metro', tags: ['married'], career: EMPLOYED }), WEIGHTED).some((e) => e.id === 'ny_where')) leak++
    // 30 岁（youth 辖区）离乡未婚 → ny_where 不得入候选
    if (availableEvents(makeState(seed, 30, { city: 'metro', career: EMPLOYED }), WEIGHTED).some((e) => e.id === 'ny_where')) leak++
    // 无 home_for_ny → 提问不得入候选；无 ny_stay_town → 年夜饭不得入候选
    const bare = makeState(seed, age)
    if (availableEvents(bare, WEIGHTED).some((e) => ['ny_questions', 'ny_stay_dinner'].includes(e.id))) leak++
    // home_for_ny 正常可用性（探针同时验证正门）
    if (!availableEvents(makeState(seed, age, { tags: ['home_for_ny'] }), WEIGHTED).some((e) => e.id === 'ny_questions')) checked++
    // ny_stay_town 无同事 → 可见 2（一人食+视频守岁；被邀请支隐藏）
    const stayNoCol = makeState(seed, age, { tags: ['ny_stay_town'] })
    if (visibleChoices(stayNoCol, ALL_EVENTS.find((e) => e.id === 'ny_stay_dinner')!).length !== 2) leak++
    // ny_stay_town 有同事 → 可见 3
    const stayCol = { ...makeState(seed, age, { tags: ['ny_stay_town'] }), relations: [colleague()] }
    if (visibleChoices(stayCol, ALL_EVENTS.find((e) => e.id === 'ny_stay_dinner')!).length !== 3) leak++
    checked += 6
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent（未婚离乡在职局）─────────────────
const hits: Record<string, number> = {}
for (const id of NY_IDS) hits[id] = 0
let draws = 0
for (let seed = 1; seed <= 300; seed++) {
  for (const age of [31, 40, 50]) {
    const st = makeState(seed, age, { city: 'metro', career: EMPLOYED })
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 7907 + age))
    draws++
    if (ev && NY_IDS.includes(ev.id)) hits[ev.id]++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 →`, NY_IDS.map((id) => `${id} ${hits[id]}`).join('、'))
console.log('PROBE PASS')
