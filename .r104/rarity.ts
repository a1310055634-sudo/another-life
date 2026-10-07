/**
 * 第 104 轮 · A3 稀有度终校：按千局实测解锁率给出建议档位，与现值逐枚比对。
 * 只读，不改任何文件——输出即 A3 的决策依据表。
 *
 * 分档规则（以 1060 局实测解锁率为据，纯展示语义）：
 *   common   ≥ 25%   —— 多数人这辈子都会碰到
 *   rare     8–25%   —— 需要一点主动经营
 *   epic     2–8%    —— 要一条完整的路线
 *   legendary < 2%    —— 一辈子未必有一次
 */
import { readFileSync } from 'node:fs'
import { ACHIEVEMENTS } from '../src/engine/achievements'

const sim = readFileSync('.r104/sim_1000.txt', 'utf8')
const rate = new Map<string, number>()
for (const line of sim.split(/\r?\n/)) {
  const m = line.match(/^\s+(ach_\w+)\s+\d+ 局（([\d.]+)%）/u)
  if (m) rate.set(m[1], Number(m[2]))
}

function suggest(p: number): 'common' | 'rare' | 'epic' | 'legendary' {
  if (p >= 25) return 'common'
  if (p >= 8) return 'rare'
  if (p >= 2) return 'epic'
  return 'legendary'
}
const ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 } as const

const rows = ACHIEVEMENTS.map((a) => {
  const p = rate.get(a.id) ?? 0
  return { id: a.id, cur: a.rarity as keyof typeof ORDER, sug: suggest(p), p }
})
rows.sort((x, y) => y.p - x.p)

console.log(`成就全表 ${rows.length} 枚 · 模拟中零触发 ${rows.filter((r) => r.p === 0).length} 枚\n`)
console.log('id'.padEnd(30), '实测%'.padStart(7), '现值'.padStart(11), '建议'.padStart(11), '  判定')
for (const r of rows) {
  const same = r.cur === r.sug
  console.log(r.id.padEnd(30), String(r.p).padStart(7), r.cur.padStart(11), r.sug.padStart(11), same ? '  =' : `  ← 改`)
}

const changes = rows.filter((r) => r.cur !== r.sug)
console.log(`\n需改动 ${changes.length} 枚 / 共 ${rows.length} 枚`)
const dist = (sel: (r: typeof rows[number]) => boolean) => {
  const c: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (const r of rows.filter(sel)) c[r.cur]++
  return c
}
console.log('现值分布：', JSON.stringify(dist(() => true)))
console.log('建议分布：', JSON.stringify(dist(() => true)).replace(/.*/, (s) => s) && JSON.stringify(
  rows.reduce<Record<string, number>>((a, r) => { a[r.sug]++; return a }, { common: 0, rare: 0, epic: 0, legendary: 0 })))
console.log('\n零触发枚（建议 legendary，但需人工确认可达性）：')
for (const r of rows.filter((x) => x.p === 0)) console.log(`  ${r.id.padEnd(30)} 现值 ${r.cur}`)