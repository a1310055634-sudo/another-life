import { ALL_EVENTS } from '../src/data/events/index.ts'
const byTitle = new Map()
for (const e of ALL_EVENTS) {
  byTitle.set(e.title, [...(byTitle.get(e.title) ?? []), e.id])
}
const dups = [...byTitle.entries()].filter(([, ids]) => ids.length > 1)
console.log(`重复标题组数：${dups.length}`)
for (const [t, ids] of dups.slice(0, 20)) console.log(`  「${t}」→ ${ids.join(', ')}`)
const NEW = ['fame_fade_out', 'fame_past_peak', 'late_memory_early_sign', 'late_mind_rhythm']
console.log(`\n四枚新标题与全池碰撞：`, dups.some(([, ids]) => ids.some((i) => NEW.includes(i))) ? '有' : '零')
