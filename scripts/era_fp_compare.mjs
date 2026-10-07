// 第 27 轮指纹对比：原 137 事件机制值必须零变化；新增事件单列核对
import { readFileSync } from 'node:fs'

const [beforePath, afterPath] = process.argv.slice(2)
const before = JSON.parse(readFileSync(beforePath, 'utf8'))
const after = JSON.parse(readFileSync(afterPath, 'utf8'))

// 兼容旧版指纹（含 summary/tooltip）：两侧同口径剥除文本字段再比较
function strip(v) {
  if (Array.isArray(v)) return v.map(strip)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) {
      if (k === 'summary' || k === 'tooltip') continue
      out[k] = strip(v[k])
    }
    return out
  }
  return v
}
for (const e of before) for (const c of e.choices) { c.effects = strip(c.effects); c.requires = strip(c.requires); c.addTags = strip(c.addTags); c.removeTags = strip(c.removeTags); c.delayed = strip(c.delayed); delete c.summary; delete c.tooltip }
for (const e of after) for (const c of e.choices) { c.effects = strip(c.effects); c.requires = strip(c.requires); c.addTags = strip(c.addTags); c.removeTags = strip(c.removeTags); c.delayed = strip(c.delayed); delete c.summary; delete c.tooltip }

const beforeIds = new Set(before.map((e) => e.id))
const afterById = new Map(after.map((e) => [e.id, e]))
const beforeById = new Map(before.map((e) => [e.id, e]))

const changed = []
for (const b of before) {
  const a = afterById.get(b.id)
  if (!a) { changed.push(`${b.id}: 消失！`); continue }
  if (JSON.stringify(b) !== JSON.stringify(a)) changed.push(`${b.id}: 机制值有变化！`)
}
const added = after.filter((e) => !beforeIds.has(e.id))

console.log(`原池事件数: ${before.length}，其中机制值变化: ${changed.length}`)
if (changed.length) console.log(changed.join('\n'))
console.log(`新增事件: ${added.length} 个`)
for (const e of added) {
  console.log(`\n=== ${e.id} [${e.minAge}-${e.maxAge}] w${e.weight} cat=${e.category}`)
  for (const c of e.choices) console.log(`  choice#${c.i} effects=${JSON.stringify(c.effects)}`)
}
process.exit(changed.length ? 1 : 0)
