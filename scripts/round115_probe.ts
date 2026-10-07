// 第 115 轮（V7）同事与邻里探针：权重×50 抽取统计 + 错误状态从不入候选断言
// 运行：npx tsx scripts/round115_probe.ts
// 零泄漏覆盖：无同事×4 同事向事件、无邻居×3 邻居向事件、在职门控（散伙饭/加班夜）、
// 远亲不如近邻的亲密门+负面标记门、入口事件的 relationKindsNone 防重门。
import { createNewGame } from '../src/engine/init'
import { availableEvents, drawEvent, visibleChoices } from '../src/engine/events'
import { mulberry32 } from '../src/engine/rng'
import { ALL_EVENTS } from '../src/data/events'
import type { GameEvent, GameState, Relation } from '../src/engine/types'

const COL_IDS = ['wl_office_deskmate', 'wl_late_night', 'wl_one_seat', 'wl_farewell_dinner']
const NB_IDS = ['wl_new_neighbor', 'wl_hallway_chat', 'wl_renovation_noise', 'wl_good_neighbor']
const ALL_WL = [...COL_IDS, ...NB_IDS]

const WEIGHTED: GameEvent[] = ALL_EVENTS.map((e) =>
  ALL_WL.includes(e.id) ? { ...e, weight: (e.weight ?? 10) * 50 } : e,
)

const EMPLOYED = { kind: 'employed' as const, jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2 }
const UNEMPLOYED = { kind: 'unemployed' as const, weeks: 3 }
const rel = (id: string, kind: 'colleague' | 'neighbor', closeness: number): Relation => ({
  id, kind, name: '测试关系', closeness, alive: true,
})

function makeState(seed: number, age: number, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'studious', name: '探针' })
  return { ...base, age, ...patch }
}

// ── 1. 错误状态从不入候选（零泄漏）──────────────────────────
let leak = 0
let checked = 0
for (let seed = 1; seed <= 250; seed++) {
  for (const age of [25, 33, 40, 55, 65]) {
    const bare = makeState(seed, age, { career: EMPLOYED })
    // 无同事 → 三个同事深化事件不得入候选（入口事件 wl_office_deskmate 在此状态本就应可用）
    if (availableEvents(bare, WEIGHTED).some((e) => ['wl_late_night', 'wl_one_seat', 'wl_farewell_dinner'].includes(e.id))) leak++
    // 无邻居 → 三个邻居深化事件不得入候选（入口事件 wl_new_neighbor 在此状态本就应可用）
    if (availableEvents(bare, WEIGHTED).some((e) => ['wl_hallway_chat', 'wl_renovation_noise', 'wl_good_neighbor'].includes(e.id))) leak++
    // 已有同事 → 入口事件不得入候选（relationKindsNone 防重）
    const hasCol = { ...bare, relations: [...bare.relations, rel('c_x', 'colleague', 60)] }
    if (availableEvents(hasCol, WEIGHTED).some((e) => e.id === 'wl_office_deskmate')) leak++
    // 在职 → 散伙饭（失业专属）不得入候选
    const col = { ...bare, relations: [...bare.relations, rel('c_x', 'colleague', 60)] }
    if (availableEvents(col, WEIGHTED).some((e) => e.id === 'wl_farewell_dinner')) leak++
    // 失业+有同事 → 加班夜/名额（在职专属）不得入候选
    const unemployedCol = { ...makeState(seed, age, { career: UNEMPLOYED }), relations: [rel('c_x', 'colleague', 60)] }
    if (availableEvents(unemployedCol, WEIGHTED).some((e) => ['wl_late_night', 'wl_one_seat'].includes(e.id))) leak++
    // 邻居亲密 45（<50）或无负面标记 → 远亲不如近邻不得入候选
    const coldNb = { ...bare, relations: [rel('n_x', 'neighbor', 45)] }
    if (availableEvents(coldNb, WEIGHTED).some((e) => e.id === 'wl_good_neighbor')) leak++
    const warmNoTag = { ...makeState(seed, age), relations: [rel('n_x', 'neighbor', 60)] }
    if (availableEvents(warmNoTag, WEIGHTED).some((e) => e.id === 'wl_good_neighbor')) leak++
    checked += 7
  }
}
console.log(`[零泄漏] 检查 ${checked} 个错误状态 → 泄漏 ${leak}（须 0）`)
if (leak > 0) process.exit(1)

// ── 2. 权重×50 真实 drawEvent（有同事+有邻居+负面标记的构造局）────
const hits: Record<string, number> = {}
for (const id of ALL_WL) hits[id] = 0
let draws = 0
for (let seed = 1; seed <= 250; seed++) {
  for (const age of [25, 33, 40, 55]) {
    const st = {
      ...makeState(seed, age, { career: EMPLOYED, tags: ['low_mood'] }),
      relations: [rel('c_p', 'colleague', 60), rel('n_p', 'neighbor', 60)],
    } as GameState
    const ev = drawEvent(st, WEIGHTED, mulberry32(seed * 31337 + age))
    draws++
    if (ev && ALL_WL.includes(ev.id)) hits[ev.id]++
  }
}
console.log(`[权重×50] ${draws} 次真实抽取 →`, ALL_WL.map((id) => `${id} ${hits[id]}`).join('、'))
console.log('PROBE PASS')
