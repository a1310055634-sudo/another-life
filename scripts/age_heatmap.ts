// 第 47 轮：年龄热力图（可复跑的常驻工具）——各年龄桶的事件覆盖表。
// 覆盖 = 事件年龄窗 [minAge, maxAge] 与桶的交集非空；另列「专属覆盖」（窗口完全落在桶内）
// 与权重和，供内容补密定向。运行：npx tsx scripts/age_heatmap.ts [池文件过滤前缀，可选]
import { ALL_EVENTS } from '../src/data/events'

const BUCKETS: Array<{ label: string; lo: number; hi: number }> = [
  { label: '18-25', lo: 18, hi: 25 },
  { label: '26-35', lo: 26, hi: 35 },
  { label: '36-45', lo: 36, hi: 45 },
  { label: '46-55', lo: 46, hi: 55 },
  { label: '56-65', lo: 56, hi: 65 },
  { label: '66-77', lo: 66, hi: 77 },
]

console.log(`全池 ${ALL_EVENTS.length} 事件；覆盖=窗口与桶相交，专属=窗口完全落在桶内\n`)
console.log('桶\t覆盖数\t专属数\t权重和\t代表事件（按权重排序前 5）')
for (const b of BUCKETS) {
  const covering = ALL_EVENTS.filter((e) => e.maxAge >= b.lo && e.minAge <= b.hi)
  const exclusive = covering.filter((e) => e.minAge >= b.lo && e.maxAge <= b.hi)
  const weightSum = covering.reduce((s, e) => s + (e.weight ?? 10), 0)
  const top = [...covering]
    .sort((a, c) => (c.weight ?? 10) - (a.weight ?? 10))
    .slice(0, 5)
    .map((e) => e.id)
    .join(',')
  console.log(`${b.label}\t${covering.length}\t${exclusive.length}\t${weightSum}\t${top}`)
}

// 逐岁覆盖：找「真空岁」（当年无任何事件窗口覆盖）
const perAge = new Map<number, number>()
for (let age = 18; age <= 77; age++) {
  perAge.set(age, ALL_EVENTS.filter((e) => e.maxAge >= age && e.minAge <= age).length)
}
const thin = [...perAge.entries()].filter(([, n]) => n <= 12).map(([a, n]) => `${a}岁:${n}`).join(' ')
console.log(`\n覆盖最薄的岁（当年窗口数 ≤12）：${thin || '无'}`)
