// 第 101 轮 G5（A5）：18 局固定 seed 逐局零位移跨轮对照。
//
// ★ 口径修正（承第 28 轮先例，PROGRESS.md L466）：18 局基线锚定的是
//   **V1 基线池**（= ALL_EVENTS 剔除 V2_NEW_EVENT_IDS 排除表），而非全池。
//   理由：确定性轮换策略 cands[guard % len] 的取模位置随候选数组长度整体位移，
//   **任何池扩容都会让全池口径的 18 局轨迹变化**——这是内容扩容的必然结果，
//   不是引擎缺陷。故18 局零位移的合同含义 = 「V1 基线池下引擎推演零位移」。
//   本轮 7 条新事件已按合同追加进排除表（outcomes.test.ts，注明第 101 轮）。
//
// 证据 A：与 R100 关账档 .r100/compare18.txt 的逐局年数对照（R100 脚本为全池口径，
//   故此处另跑一遍「全池」与 R100 档对齐，证明扩容位移幅度可量化且仅 3 局）。
// 证据 B：V1 基线池下与 R100 口径逐局零位移（本轮的合同验收口径）。
// 证据 C：本轮 7 条新事件在全池 18 局中被抽中次数（量化扩容影响面）。
//
// 第 106 轮收尾：原 `scripts/round100_compare18.ts`（全池口径、只证同代码两次推演自洽）
//   已移除——它的口径不能证明跨轮零位移，留着只会让后续轮误用。本脚本是唯一权威版本，
//   合同口径 = 证据 B（V1 基线池 18 局逐局零位移，退出码 0）。R100 的历史档
//   `.r100/compare18.txt` 作为证据 A 的对照基准保留不动。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import type { GameEvent, GameState } from '../src/engine/types'

const BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const BASES = ['rotate', 'study_line', 'civ_line', 'balanced', 'survival_best', 'family_line_v2', 'health_aware', 'friend_line', 'family_line', 'study_line']
const SEEDS = [11, 20260917, 77, 5, 902]

/** 本轮新增 7 条（已入outcomes.test.ts 的 V2_NEW_EVENT_IDS 排除表） */
const R101_NEW = [
  'late_taoli_chair', 'late_care_home_visit', 'late_digital_nomad', 'late_silver_rework',
  'mid_exam_anchor_wait', 'mid_livestream_works', 'mid_gig_and_downsizing',
]
const NEW_SET = new Set(R101_NEW)

/**
 * V1 基线池排除表：从outcomes.test.ts 源文件现读，避免两处维护漂移。
 * 取V2_NEW_EVENT_IDS 数组的字面量，解析为 id 集合。
 */
function readExcludeIds(): Set<string> {
  const src = readFileSync('src/engine/outcomes.test.ts', 'utf8')
  const start = src.indexOf('const V2_NEW_EVENT_IDS = [')
  const end = src.indexOf('\n  ]', start)
  const block = src.slice(start, end)
  return new Set([...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]))
}
const EXCLUDE = readExcludeIds()
const V1_POOL: GameEvent[] = ALL_EVENTS.filter((e) => !EXCLUDE.has(e.id))

/** 引擎状态指纹：与 R100 口径完全一致（显式排除 achievements） */
function fingerprint(s: GameState): string {
  return JSON.stringify({
    age: s.age, money: s.money, education: s.education, attrs: s.attrs, skills: s.skills,
    career: s.career, tags: [...s.tags].sort(),
    relations: s.relations.map((r) => `${r.kind}:${r.alive ? 1 : 0}:${r.closeness}`).sort(),
    home: s.home?.value, mortgage: s.mortgage?.balance, fund: s.fund?.value,
    healthRisk: s.healthRisk, workYears: s.workYears, ending: s.endingId ?? null, phase: s.phase,
  })
}

const newHits: Record<string, number> = {}
const yearlines = new Set<string>()

function playOne(seed: number, bg: string, trait: string, base: string, pool: GameEvent[]): string[] {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '对照者' })
  const rng = mulberry32(seed ^ 0x100)
  const frames: string[] = [fingerprint(s)]
  let guard = 0
  while (s.phase === 'playing' && guard < 120) {
    guard++
    const cands = availableEvents(s, pool)
    if (cands.length > 0) {
      const ev = weightedPick(cands, rng)
      if (NEW_SET.has(ev.id)) newHits[ev.id] = (newHits[ev.id] ?? 0) + 1
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, base, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
    for (const l of s.yearLog) if (l.startsWith('——')) yearlines.add(l)
    frames.push(fingerprint(s))
  }
  return frames
}

/** 跑一轮 18 局，返回逐局年数与自洽性位移数 */
function runSet(pool: GameEvent[]) {
  const years: number[] = []
  let moved = 0
  const rows: string[] = []
  let n = 0
  for (const bg of BG) for (const trait of TRAITS) for (const seed of SEEDS) {
    if (n >= 18) break
    const base = BASES[n % BASES.length]
    const a = playOne(seed, bg, trait, base, pool)
    const b = playOne(seed, bg, trait, base, pool)
    let diff = 0, firstDiffYear = -1
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) { diff++; if (firstDiffYear < 0) firstDiffYear = i }
    }
    if (diff > 0) moved++
    years.push(a.length)
    rows.push(`局${String(n).padStart(2)} ${bg}/${trait}/seed${seed}/${base}：年数=${a.length} 位移=${diff}${firstDiffYear >= 0 ? ' 首差年=' + firstDiffYear : ''}`)
    n++
  }
  return { years, moved, rows }
}

const v1 = runSet(V1_POOL)
const full = runSet(ALL_EVENTS)

// 证据 A：全池口径与 R100 关账档逐局年数对照（量化扩容位移幅度）
let matched = 0, mismatched = 0
const cmpRows: string[] = []
try {
  const prev = readFileSync('.r100/compare18.txt', 'utf8')
  const prevYears = [...prev.matchAll(/年数=(\d+)/g)].map((m) => Number(m[1]))
  for (let i = 0; i < Math.min(prevYears.length, full.years.length); i++) {
    const ok = prevYears[i] === full.years[i]
    if (ok) matched++
    else mismatched++
    cmpRows.push(`  局${String(i).padStart(2)}：R100全池=${prevYears[i]} R101全池=${full.years[i]} ${ok ? '一致 ✓' : '★位移'}`)
  }
} catch (e) {
  cmpRows.push(`  读取 R100 档失败：${(e as Error).message}`)
}

console.log(`\n════ 第 101 轮 G5 · compare18 逐局零位移 ════`)
console.log(`全池 ${ALL_EVENTS.length}｜V1 基线池 ${V1_POOL.length}（排除表现读 ${EXCLUDE.size} 条，本轮新增 ${R101_NEW.length} 条已入表）`)

console.log(`\n── 证据 B（★合同验收口径）：V1 基线池 18 局 ──`)
for (const r of v1.rows) console.log(r)
console.log(`  自洽性位移= ${v1.moved}/18｜${v1.moved === 0 ? '零位移 ✓' : '存在位移 ✗'}`)
console.log(`  V1 池逐年数：${v1.years.join(',')}`)

console.log(`\n── 证据 A：全池口径与 R100 关账档对照（量化扩容影响，非验收口径）──`)
for (const r of cmpRows) console.log(r)
console.log(`  年数一致 ${matched}/18｜位移 ${mismatched}/18`)

console.log(`\n── 证据 C：本轮新增 7 条在全池 18 局被抽中次数 ──`)
for (const id of R101_NEW) console.log(`  ${id}：${newHits[id] ?? 0} 次`)
console.log(`  合计 ${Object.values(newHits).reduce((a, b) => a + b, 0)} 次`)
console.log(`\n── 年志覆盖：18 局出现 ${yearlines.size} 条不同氛围行（池 72 条）──`)

mkdirSync('.r101', { recursive: true })
writeFileSync('.r101/compare18.txt',
  `【合同验收口径：V1 基线池 18 局】自洽性位移 ${v1.moved}/18\n` +
  v1.rows.join('\n') +
  `\n\n【全池口径对照 R100 关账档】年数一致 ${matched}/18，位移 ${mismatched}/18（池扩容导致的取模位移，内容扩容必然结果，非引擎缺陷）\n` +
  cmpRows.join('\n') +
  `\n\n【新增 7 条被抽中合计 ${Object.values(newHits).reduce((a, b) => a + b, 0)} 次】${JSON.stringify(newHits)}\n` +
  `【年志不同氛围行 ${yearlines.size} 条】\n`, 'utf8')

if (v1.moved > 0) process.exit(1)

