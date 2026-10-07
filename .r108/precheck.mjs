// 第 108 轮前置盘点（开工前实测，不信任何快照）：
//   ①丧偶系关键词全池扫描——证实「命中 0」是否仍然成立
//   ②既有晚年陪伴/独居向事件清单——防撞题
//   ③late.ts 现值（文件级计数 / 年龄窗 / category 种类）
//   ④关系系统是否已有 remove 类效果（决定「反向门控 + 叙事」是否仍是最优方案）
//   ⑤relationKindsNone 语义确认（反向门控能不能真的挡住「有 spouse」）
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src', 'data', 'events')
const files = readdirSync(root).filter((f) => f.endsWith('.ts') && f !== 'index.ts')

// ① 丧偶系关键词扫描（双向：既扫 title/text 正文，也扫 id）
const WIDOW_WORDS = ['丧偶', '老伴去世', '老伴走', '先走', '鳏', '寡', '配偶去世', '爱人去世',
  '老伴不在', '老伴离世', '葬礼', '追悼', '过世', '走了', '离世', '病故', '过身']
const hits = []
let eventCount = 0
for (const f of files) {
  const src = readFileSync(join(root, f), 'utf8')
  // 逐事件切块：id: 'xxx' 开始
  const blocks = src.split(/\n\s*\{\s*\n/).slice(1)
  for (const b of blocks) {
    const idM = b.match(/id:\s*'([^']+)'/)
    if (!idM) continue
    eventCount++
    for (const w of WIDOW_WORDS) {
      if (b.includes(w)) hits.push(`${f}:${idM[1]} ← 「${w}」`)
    }
  }
}
console.log(`=== ①丧偶系关键词扫描（${WIDOW_WORDS.length} 词 × 全池 ${eventCount} 事件）===`)
console.log(hits.length === 0 ? '命中 0 —— 空洞仍然成立' : hits.join('\n'))

// ② 既有晚年陪伴 / 独居向事件
const COMPANION_RE = /陪伴|老伴|老伴在|独居|一个人|相伴|孤单|养老|黄昏|同龄|老友|团聚/
console.log('\n=== ② 既有晚年陪伴/独居向事件（防撞题）===')
for (const f of files) {
  const src = readFileSync(join(root, f), 'utf8')
  const blocks = src.split(/\n\s*\{\s*\n/).slice(1)
  for (const b of blocks) {
    const idM = b.match(/id:\s*'([^']+)'/)
    const titleM = b.match(/title:\s*'([^']*)'/)
    if (!idM || !titleM) continue
    const ageM = b.match(/minAge:\s*(\d+),\s*maxAge:\s*(\d+)/)
    if (!ageM || Number(ageM[1]) < 51) continue
    if (!COMPANION_RE.test(titleM[1]) && !COMPANION_RE.test(b.slice(0, 400))) continue
    console.log(`  ${f}: ${idM[1]}  [${ageM[1]}-${ageM[2]}]  ${titleM[1]}`)
  }
}

// ③ late.ts 现值
const late = readFileSync(join(root, 'late.ts'), 'utf8')
const lateIds = [...late.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
const lateCats = [...late.matchAll(/category:\s*'([^']+)'/g)].map((m) => m[1])
const lateAges = [...late.matchAll(/minAge:\s*(\d+),\s*maxAge:\s*(\d+)/g)].map((m) => [+m[1], +m[2]])
console.log('\n=== ③ late.ts 现值 ===')
console.log(`  事件数 ${lateIds.length}`)
console.log(`  category 种类 ${[...new Set(lateCats)].length} = ${[...new Set(lateCats)].sort().join(',')}`)
console.log(`  minAge 范围 ${Math.min(...lateAges.map((a) => a[0]))} / maxAge 上限 ${Math.max(...lateAges.map((a) => a[1]))}`)

// ④⑤ 关系系统：remove 类效果 + relationKindsNone 语义
const rel = readFileSync(join(process.cwd(), 'src', 'engine', 'relations.ts'), 'utf8')
console.log('\n=== ④ 关系系统 remove 类效果（只读核查）===')
const removeHits = [...rel.matchAll(/remove[A-Za-z]*|relationRemove|killRelation|spouse_dead|widow/gi)].map((m) => m[0])
console.log(removeHits.length ? [...new Set(removeHits)].join(', ') : '无 remove / widow 类语义 → 维持「反向门控 + 叙事」方案')

const types = readFileSync(join(process.cwd(), 'src', 'engine', 'types.ts'), 'utf8')
const cnd = types.match(/relationKindsNone\??:[^\n]*/)
console.log('  EventCondition.relationKindsNone 声明:', cnd ? cnd[0].trim() : '未找到')