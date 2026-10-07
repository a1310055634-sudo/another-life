import { ALL_EVENTS } from '../src/data/events/index.ts'
const withP = ALL_EVENTS.filter((e) => e.priority !== undefined)
console.log('有 priority 的事件数：', withP.length)
const byP = new Map<number, string[]>()
for (const e of withP) {
  const k = e.priority!
  byP.set(k, [...(byP.get(k) ?? []), e.id])
}
for (const [p, ids] of [...byP.entries()].sort((a, b) => b[0] - a[0])) {
  console.log(`priority=${p}：${ids.length} 枚 → ${ids.slice(0, 14).join(', ')}${ids.length > 14 ? ' …' : ''}`)
}
const maxP = Math.max(...withP.map((x) => x.priority!))
console.log(`\n本轮四枚的 priority：${ALL_EVENTS.filter((e) => e.id.startsWith('late_widow')).map((e) => `${e.id}=${e.priority ?? '无'}`).join('  ')}`)
console.log(`无 priority（=0）的晚期事件数：${ALL_EVENTS.filter((e) => e.priority === undefined && e.minAge >= 51).length}`)
