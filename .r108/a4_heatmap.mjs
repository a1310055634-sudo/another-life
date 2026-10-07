// 第 108 轮 A4：年龄热力图前后对照（目标桶 56-65 / 66-77 须双升）。
//
// 口径说明：直接跑 scripts/age_heatmap.ts 只能拿到「后」；「前」由本脚本把
// 本轮 4 枚从池中剔除后按完全相同的公式重算——这样前后差异只可能来自本轮
// 新增，不掺任何口径漂移（此前多轮栽在「换脚本换口径」上）。
import { ALL_EVENTS } from '../src/data/events/index.ts'

const NEW_IDS = new Set([
  'late_widow_first_year',
  'late_widow_social_rebuild',
  'late_widow_living_alone',
  'late_widow_new_mate_boundary',
])

const BUCKETS = [
  { label: '18-25', lo: 18, hi: 25 },
  { label: '26-35', lo: 26, hi: 35 },
  { label: '36-45', lo: 36, hi: 45 },
  { label: '46-55', lo: 46, hi: 55 },
  { label: '56-65', lo: 56, hi: 65 },
  { label: '66-77', lo: 66, hi: 77 },
]

const before = ALL_EVENTS.filter((e) => !NEW_IDS.has(e.id))
const after = ALL_EVENTS

const stat = (pool, b) => {
  const covering = pool.filter((e) => e.maxAge >= b.lo && e.minAge <= b.hi)
  const exclusive = covering.filter((e) => e.minAge >= b.lo && e.maxAge <= b.hi)
  return {
    cover: covering.length,
    excl: exclusive.length,
    weight: covering.reduce((s, e) => s + (e.weight ?? 10), 0),
  }
}

let fails = 0
const assert = (name, cond, detail) => {
  if (!cond) fails++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log(`池 ${before.length} → ${after.length}（+${after.length - before.length}）\n`)
console.log('桶\t覆盖前\t覆盖后\t专属前\t专属后\t权重前\t权重后')
const table = []
for (const b of BUCKETS) {
  const s0 = stat(before, b)
  const s1 = stat(after, b)
  table.push({ b, s0, s1 })
  console.log(`${b.label}\t${s0.cover}\t${s1.cover}\t${s0.excl}\t${s1.excl}\t${s0.weight}\t${s1.weight}`)
}

const t1 = table.find((x) => x.b.label === '56-65')
const t2 = table.find((x) => x.b.label === '66-77')

assert('A4-1 桶 56-65 覆盖上升', t1.s1.cover > t1.s0.cover, `${t1.s0.cover} → ${t1.s1.cover}（+${t1.s1.cover - t1.s0.cover}）`)
assert('A4-2 桶 56-65 专属上升', t1.s1.excl > t1.s0.excl, `${t1.s0.excl} → ${t1.s1.excl}（+${t1.s1.excl - t1.s0.excl}）`)
assert('A4-3 桶 66-77 覆盖上升', t2.s1.cover > t2.s0.cover, `${t2.s0.cover} → ${t2.s1.cover}（+${t2.s1.cover - t2.s0.cover}）`)
assert('A4-4 桶 66-77 专属上升', t2.s1.excl > t2.s0.excl, `${t2.s0.excl} → ${t2.s1.excl}（+${t2.s1.excl - t2.s0.excl}）`)

// 未涉及桶不得被本轮改动波及（回归守卫：若此处变红，说明有事件越界写进了别的桶）
for (const row of table.slice(0, 4)) {
  assert(`A4-x 桶 ${row.b.label} 覆盖未被波及`, row.s0.cover === row.s1.cover, `${row.s0.cover} → ${row.s1.cover}`)
}

// 逐岁最薄口径同步复算
const thin = (pool, th) => {
  const out = []
  for (let age = 18; age <= 77; age++) {
    const n = pool.filter((e) => e.maxAge >= age && e.minAge <= age).length
    if (n <= th) out.push(`${age}岁:${n}`)
  }
  return out.join(' ')
}
const t0s = thin(before, 12)
const t1s = thin(after, 12)
console.log(`\n覆盖最薄的岁（≤12）前：${t0s || '无'}`)
console.log(`覆盖最薄的岁（≤12）后：${t1s || '无'}`)

const STEP_TOTAL = BUCKETS.length + 2
console.log(`\nA4 ${fails === 0 ? '全部通过' : `失败 ${fails} 项`}（${STEP_TOTAL} 步）`)
process.exit(fails === 0 ? 0 : 1)
