// 第 110 轮 A4：年龄热力图前后对照（与 R108 同款口径：同一公式、池中剔除本轮 4 枚即为「前」）。
import { ALL_EVENTS } from '../src/data/events/index.ts'

const NEW_IDS = new Set([
  'fame_fade_out',
  'fame_past_peak',
  'late_memory_early_sign',
  'late_mind_rhythm',
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

const byLabel = (l) => table.find((x) => x.b.label === l)

// 定向目标：名声 2 枚喂中段覆盖，认知 2 枚补晚年（题材使然，与 R108 错题）
assert('A4-1 桶 36-45 覆盖 +2', byLabel('36-45').s1.cover === byLabel('36-45').s0.cover + 2,
  `${byLabel('36-45').s0.cover} → ${byLabel('36-45').s1.cover}`)
assert('A4-2 桶 46-55 覆盖 +2', byLabel('46-55').s1.cover === byLabel('46-55').s0.cover + 2,
  `${byLabel('46-55').s0.cover} → ${byLabel('46-55').s1.cover}`)
assert('A4-3 桶 56-65 覆盖 +1 且专属 +1', byLabel('56-65').s1.cover === byLabel('56-65').s0.cover + 1
  && byLabel('56-65').s1.excl === byLabel('56-65').s0.excl + 1,
  `${byLabel('56-65').s0.cover}/${byLabel('56-65').s0.excl} → ${byLabel('56-65').s1.cover}/${byLabel('56-65').s1.excl}`)
assert('A4-4 桶 66-77 覆盖 +1 且专属 +1', byLabel('66-77').s1.cover === byLabel('66-77').s0.cover + 1
  && byLabel('66-77').s1.excl === byLabel('66-77').s0.excl + 1,
  `${byLabel('66-77').s0.cover}/${byLabel('66-77').s0.excl} → ${byLabel('66-77').s1.cover}/${byLabel('66-77').s1.excl}`)
// 未涉及桶回归守卫
assert('A4-5 桶 18-25 未被波及', byLabel('18-25').s0.cover === byLabel('18-25').s1.cover,
  `${byLabel('18-25').s0.cover} → ${byLabel('18-25').s1.cover}`)
assert('A4-6 桶 26-35 未被波及', byLabel('26-35').s0.cover === byLabel('26-35').s1.cover,
  `${byLabel('26-35').s0.cover} → ${byLabel('26-35').s1.cover}`)
// 与 round47.test 的硬断言同源复核
assert('A4-7 66-77 覆盖 = 95（与 round47.test 断言同源）', byLabel('66-77').s1.cover === 95)

console.log(`\nA4 ${fails === 0 ? '全部通过' : `失败 ${fails} 项`}（7 步）`)
process.exit(fails === 0 ? 0 : 1)
