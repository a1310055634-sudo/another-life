// 第 101 轮前置盘点：V5 新事件（R85–R95 产物）的时代词密度审计
// 词表从 scripts/era_audit.mjs 现读抽取，不重抄，避免抄漏
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { readFileSync } from 'node:fs'

const src = readFileSync('scripts/era_audit.mjs', 'utf8')
const kwBlock = src.slice(src.indexOf('const KEYWORDS = ['), src.indexOf(']\n\nif (kwMode'))
const KEYWORDS = [...kwBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])

const V5_FILES = ['civilservice', 'midcareer', 'city', 'home', 'fund', 'insurance', 'fame', 'marriage_v5', 'v5edu']
const V5_IDS = new Set()
for (const f of V5_FILES) {
  const t = readFileSync(`src/data/events/${f}.ts`, 'utf8')
  for (const m of t.matchAll(/^ {4}id: '([^']+)'/gm)) V5_IDS.add(m[1])
}

const hit = (s: string) => KEYWORDS.filter((k) => s.includes(k))
const wordsOf = (e: any) =>
  new Set<string>([...hit(e.text), ...hit(e.title), ...e.choices.flatMap((c: any) => [...hit(c.text), ...hit(c.summary ?? '')])])

console.log(`现读词表 ${KEYWORDS.length} 词；V5 新事件文件 ${V5_FILES.length} 个，事件 ${V5_IDS.size} 条；全池 ${ALL_EVENTS.length}\n`)

let v5Hit = 0
const missList: string[] = []
for (const e of ALL_EVENTS) {
  if (!V5_IDS.has(e.id)) continue
  if (wordsOf(e).size) v5Hit++
  else missList.push(`${e.id}[${e.minAge}-${e.maxAge}]`)
}
console.log(`V5 新事件时代词命中 ${v5Hit}/${V5_IDS.size}；零命中 ${missList.length}`)
console.log(`零命中清单：${missList.join(' ') || '无'}\n`)

console.log('全池逐组时代词密度（按密度升序）')
const perFile = new Map<string, { n: number; hit: number; words: Set<string> }>()
for (const e of ALL_EVENTS) {
  const f = V5_FILES.find((v) => V5_IDS.has(e.id)) ?? '既有池'
  const cur = perFile.get(f) ?? { n: 0, hit: 0, words: new Set<string>() }
  cur.n++
  const ws = wordsOf(e)
  if (ws.size) cur.hit++
  ws.forEach((w) => cur.words.add(w))
  perFile.set(f, cur)
}
for (const [f, v] of [...perFile.entries()].sort((a, b) => a[1].hit / a[1].n - b[1].hit / b[1].n)) {
  console.log(`  ${f.padEnd(14)} ${v.hit}/${v.n} = ${((v.hit / v.n) * 100).toFixed(1)}%  命中词：${[...v.words].join(' ')}`)
}

// 任务书建议的 8 个待增时代词在全池的现有覆盖（去重前置检查）
const PROPOSED = ['考公上岸', '灵活就业', '直播带货', '副业刚需', '消费降级', '断舍离', '数字游民', '银发经济']
console.log('\n任务书建议 +8 词的现池覆盖（去重前置）：')
for (const w of PROPOSED) {
  const n = ALL_EVENTS.filter((e) => JSON.stringify(e).includes(w)).length
  console.log(`  「${w}」 命中事件 ${n} 条`)
}
