// 第 105 轮：ach_old_friend（莫逆之交）人类可达性裁决 —— 纯只读量测，不改任何产品源码。
// 问：全池 friend 亲密增益的「单年理论上限」是多少？攒到 55 岁需要多少年、靠什么事件？
// 输出为纯 ASCII 数字，避免中文编码问题。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'src/data/events')
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))
let best = []
let all = []
for (const f of files) {
  const txt = readFileSync(join(DIR, f), 'utf8')
  // 逐事件切块
  const blocks = txt.split(/\n  \{\n/).slice(1)
  for (const b of blocks) {
    const id = (b.match(/id: '([^']+)'/) ?? [])[1]
    if (!id) continue
    const minAge = Number((b.match(/minAge: (\d+)/) ?? [])[1] ?? -1)
    const maxAge = Number((b.match(/maxAge: (\d+)/) ?? [])[1] ?? -1)
    const cd = Number((b.match(/cooldown: (\d+)/) ?? [])[1] ?? -1)
    const wt = Number((b.match(/weight: (\d+)/) ?? [])[1] ?? -1)
    // 只统计 friend 增益：relation: { kind: 'friend', deltaCloseness: N }
    const gains = [...b.matchAll(/relation:\s*\{\s*kind:\s*'friend',\s*deltaCloseness:\s*(-?\d+)\s*\}/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n > 0)
    if (!gains.length) continue
    // 也统计「新建朋友」事件（add:true）
    const adds = [...b.matchAll(/relation:\s*\{\s*kind:\s*'friend',\s*add:\s*true/g)].length
    const maxGain = Math.max(...gains)
    const sumGain = gains.reduce((a, b) => a + b, 0)
    const rec = { file: f, id, minAge, maxAge, cd, wt, maxGain, sumGain, gains: gains.join(','), adds }
    all.push(rec)
    best.push(rec)
  }
}
best.sort((a, b) => b.maxGain - a.maxGain)
console.log('=== friend-positive events total: ' + all.length)
console.log('=== top-20 by max single-choice deltaCloseness ===')
console.log('maxGain sumGain minAge maxAge cd wt  id')
for (const r of best.slice(0, 20)) {
  console.log(`${String(r.maxGain).padStart(6)} ${String(r.sumGain).padStart(6)} ${String(r.minAge).padStart(5)} ${String(r.maxAge).padStart(5)} ${String(r.cd).padStart(3)} ${String(r.wt).padStart(3)}  ${r.id} [${r.file}] gains=${r.gains}`)
}
console.log('=== events that ADD a new friend ===')
for (const r of all.filter((x) => x.adds > 0)) console.log(`  ${r.id} [${r.file}] age ${r.minAge}-${r.maxAge}`)

// 年龄带统计：55 岁前可用的 friend 增益事件
const pre55 = all.filter((r) => r.minAge < 55)
console.log('=== friend-gain events with minAge<55: ' + pre55.length)
const byDecade = {}
for (const r of pre55) {
  const k = `${Math.floor(r.minAge / 10) * 10}s`
  byDecade[k] = (byDecade[k] ?? 0) + 1
}
console.log('by minAge decade: ' + JSON.stringify(byDecade))
// 理论上限：假设每 18-54 年每年都能拿到全池最高的单事件增益（极宽松上界）
const top = pre55.map((r) => ({ r, perYear: r.maxGain / Math.max(1, r.cd) }))
top.sort((a, b) => b.perYear - a.perYear)
console.log('=== top-8 by annual-cap rate (maxGain / cooldown) ===')
for (const t of top.slice(0, 8)) console.log(`  ${t.r.id}  gain=${t.r.maxGain} cd=${t.r.cd} rate=${t.perYear.toFixed(2)}/yr age=${t.r.minAge}-${t.r.maxAge}`)