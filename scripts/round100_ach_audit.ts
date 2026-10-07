// 第 100 轮（V5 成就四期）：400 局成就稀有度抽测。
// 全52 枚现值触发率基线（定位四枚旧 0% 成就的密度问题 + 为新成就稀有度定标），
// 以及新增 V5 机制成就的初校表（R104 终校）。
// 口径：4 背景 × 6 特质 × 25 seed = 600 局上限，取前 400 局；8 策略轮换（沿用R82 口径）。
// 运行：npx tsx scripts/round100_ach_audit.ts [--games=400] [--json]
import { writeFileSync, mkdirSync } from 'node:fs'
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { ACHIEVEMENTS, evaluateAchievements } from '../src/engine/achievements'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import type { GameState } from '../src/engine/types'

const BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
// 第 100 轮修正：首版沿用 R82 的 STRATEGIES8（8 策略），实测导致 27 枚成就零触发——
// 根因是rotate 按 guard 取模绕开教育/职业路线，且缺 civ_line（考公路线在 strategy_v2 里
// 定义但从不在 8 策略池中），教育线还要求 study_line + smarts>=55 才生效。
// 故本轮扩为 10 策略池：补 civ_line（体制内线），并把 smarts 低的局也能走教育线。
// 目标不是「让成就都触发」，而是让**每条机制线至少被真实走到过**，得到有意义的分母。
const STRATEGIES10 = [
  'rotate', 'health_aware', 'survival_best', 'balanced',
  'family_line', 'family_line_v2', 'study_line', 'friend_line',
  'civ_line', 'survival_best',
]
const SEEDS = [11, 20260917, 77, 5, 902, 314, 606, 808, 111, 222,
  1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
  1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020]

function argOf(prefix: string): string | null {
  const a = process.argv.find((x) => x.startsWith(prefix))
  return a ? a.slice(prefix.length) : null
}

const GAMES = Number(argOf('--games=') ?? '400')

/**
 * 单局推进到自然终龄，返回终局成就 id 集合。
 *
 * 第 100 轮修正（重要）：前两版用 `cands[guard % cands.length]` 取事件——那是**轮转抽样**，
 * 等于人为跳过绝大多数候选事件，实测 200 局 education 100% 停在highschool、局内从未出现
 * 任何升学历选项，导致 25～27 枚成就虚假零触发。真实玩法走`weightedPick`（priority+weight 加权），
 * 故本版改用 weightedPick + 独立 mulberry32(seed派生) 实例驱动，
 * 既复现真实事件分布，又满足随机支流纪律（不耗主 rng 流）。
 */
function playOne(seed: number, bg: string, trait: string, strategy: string): { achs: string[]; age: number; ending: string } {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '校准者' })
  const rng = mulberry32(seed ^ 0x100) // 独立实例：抽测专用，不参与引擎主 rng
  let guard = 0
  while (s.phase === 'playing' && guard < 120) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = weightedPick(cands, rng)
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, strategy, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
    if (guard % 10 === 0 && s.phase === 'playing') {
      // 中途也评估一次（成就按落账即入 state.achievements，此处仅兜底防漏）
      s = { ...s, achievements: Array.from(new Set([...s.achievements, ...evaluateAchievements(s).map((a) => a.id)])) }
    }
  }
  const final = evaluateAchievements(s)
  return {
    achs: Array.from(new Set([...s.achievements, ...final.map((a) => a.id)])),
    age: s.age,
    ending: s.endingId ?? 'unknown',
  }
}

const t0 = performance.now()
const hits = new Map<string, number>()
const perGame: Array<{ seed: number; bg: string; trait: string; strategy: string; age: number; count: number; achs: string[] }> = []
let i = 0
for (const bg of BG) {
  for (const trait of TRAITS) {
    for (const seed of SEEDS) {
      if (perGame.length >= GAMES) break
      const strategy = STRATEGIES10[i % STRATEGIES10.length]
      const r = playOne(seed, bg, trait, strategy)
      for (const a of r.achs) hits.set(a, (hits.get(a) ?? 0) + 1)
      perGame.push({ seed, bg, trait, strategy, age: r.age, count: r.achs.length, achs: r.achs })
      i++
    }
    if (perGame.length >= GAMES) break
  }
  if (perGame.length >= GAMES) break
}
const secs = (performance.now() - t0) / 1000

// ── 稀有度分布（R104 终校口径：按触发率分档，供本轮初校比对）──
function rateOf(id: string) {
  return +(((hits.get(id) ?? 0) / perGame.length) * 100).toFixed(1)
}
function bandOf(rate: number) {
  if (rate >= 60) return 'common常见'
  if (rate >= 20) return 'rare 少见'
  if (rate >= 3) return 'epic 珍稀'
  return 'legendary 传奇'
}

const rows = ACHIEVEMENTS.map((a) => {
  const rate = rateOf(a.id)
  return {
    id: a.id,
    name: a.name,
    defRarity: a.rarity,
    rate,
    count: hits.get(a.id) ?? 0,
    suggested: bandOf(rate),
    match: bandOf(rate).startsWith(a.rarity) ? '✓' : '✗',
  }
})
const zero = rows.filter((r) => r.count === 0)
const mismatch = rows.filter((r) => r.match === '✗')

console.log(`\n════ 第 100 轮 · 成就稀有度 ${GAMES} 局初校（耗时 ${secs.toFixed(1)}s）════`)
console.log(`局数=${perGame.length}　成就总数=${ACHIEVEMENTS.length}　平均每局解锁=${(perGame.reduce((a, r) => a + r.count, 0) / perGame.length).toFixed(2)} 枚`)
console.log(`零触发成就=${zero.length} 枚：${zero.map((r) => `${r.name}(${r.id})`).join('、') || '无'}`)
console.log(`稀有度档位不符建议=${mismatch.length} 枚：${mismatch.map((r) => `${r.name} ${r.defRarity}→${r.suggested}`).join('、') || '无'}`)

console.log('\n── 全清单触发率（按定义序）──')
for (const r of rows) {
  const bar = '█'.repeat(Math.round(r.rate / 2))
  console.log(`${String(r.rate).padStart(5)}% ${r.id.padEnd(26)} ${r.name.padEnd(8)} 定义=${r.defRarity.padEnd(9)} 建议=${r.suggested.padEnd(14)} ${r.match} ${bar}`)
}

const byRarity = new Map<string, number[]>()
for (const r of rows) {
  const k = r.defRarity
  if (!byRarity.has(k)) byRarity.set(k, [])
  byRarity.get(k)!.push(r.rate)
}
console.log('\n── 按定义稀有度分档均值 ──')
for (const [k, arr] of byRarity) {
  console.log(`${k.padEnd(10)} n=${String(arr.length).padStart(3)}  均值=${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}%  区间=${Math.min(...arr)}%–${Math.max(...arr)}%`)
}

if (process.argv.includes('--json')) {
  const out = { games: perGame.length, elapsedSec: +secs.toFixed(1), rows, zero: zero.map((z) => z.id), mismatch: mismatch.map((m) => m.id), perGame }
  writeFileSync('.r100/ach-400.json', JSON.stringify(out, null, 1), 'utf8')
  console.log('\nJSON 已写入 .r100/ach-400.json')
} else {
  try { writeFileSync('.r100/ach-400-summary.txt', rows.map((r) => `${r.rate}\t${r.id}\t${r.name}\t${r.defRarity}\t${r.suggested}`).join('\n'), 'utf8') } catch { /* 目录不存在则跳过 */ }
}
console.log(`ACH_AUDIT: ${perGame.length} 局 零触发=${zero.length} 档位不符=${mismatch.length}`)