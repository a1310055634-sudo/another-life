/**
 * 第 104 轮 · A3 稀有度终校执行器。
 *
 * 分档原则（**有方向性**，不是朴素阈值）：
 *   朴素阈值法实测会把 legendary 从 1 枚推到 27 枚（一半成就是传奇）→ 标签失去意义，弃用。
 *   根因：机器人策略不做目标导向经营，千局口径对罕见成就**系统性低估**（R100 已实证）。
 *   故只用「两端错标」这一无争议方向：
 *
 *   方向一 · 降档：实测 ≥25% 却标稀档 —— 明确错标（多数人这局都会拿到）。
 *   方向二 · 升 common：实测 <5% 却标 common —— 明确错标（九成七的局都拿不到）。
 *   方向三 · 零触发升 legendary：机器口径不可达 ≠ 人类不可达；
 *           这 9 枚全为跨代深链（多标记合取 / 高亲密阈值 / 稀有前置），check 均为纯状态判定、引擎无缺陷。
 *
 *   **不动的**：其余 rare/epic 现值与机器实测大体相符的，不因机器稀缺而自动升档（避免 legendary 通胀）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

type R = 'common' | 'rare' | 'epic' | 'legendary'

/** [id, 现值断言, 目标值, 实测依据] */
const CHANGES: Array<[string, R, R, string]> = [
  // ── 方向一 · 降档（实测 ≥25% 却标稀档）──
  ['ach_debt_free',           'rare', 'common',    '实测 67.9%·两千局里三分之二拿到，标「稀有」与事实不符'],
  ['ach_iron_body',           'rare', 'common',    '实测 44.2%·近半数局的默认结果'],
  ['ach_memoir',              'rare', 'common',    '实测 41.7%·同类高频'],
  ['ach_pet_forever',         'rare', 'common',    '实测 27.8%·刚过 common 下沿但仍属多数可遇'],
  ['ach_clean_living',        'epic', 'common',    '实测 25.7%·标 epic 明显偏高'],

  // ── 方向二 · 升档（实测 <5% 却标 common）──
  ['ach_senior_level',        'common', 'rare',    '实测 2.9%·绝大多数局拿不到，不该是「人人都有」'],
  ['ach_independent',         'common', 'rare',    '实测 1.9%·同上'],

  // ── 方向三 · 零触发跨代深链（9 枚）──
  ['ach_fallen_and_risen',    'rare', 'legendary', '实测 0.0%·高考复读失败 ∧ 学历 college~phd 双前置深链'],
  ['ach_reunion',             'rare', 'legendary', '实测 0.0%·须先疏远父母 ∧ 父存活的反向路径，R61 已留构造测试在册'],
  ['ach_grandparent',         'rare', 'legendary', '实测 0.0%·祖辈尽孝标记 ∧ 有娃且亲子亲密 70（有娃率仅 2.0%）'],
  ['ach_sibling_bond',        'rare', 'legendary', '实测 0.0%·50 岁 ∧ 手足存续 ∧ 亲密 60（手足年衰减 1/年）'],
  ['ach_old_friend',          'rare', 'legendary', '实测 0.0%·55 岁 ∧ 挚友 85 亲密（普通友 2/年衰减）——**可达性存疑，登记为观察项**'],
  ['ach_dream_trilogy',       'epic', 'legendary', '实测 0.0%·dream_kept ∧ bloom ∧ full 三标记合取'],
  ['ach_phd',                 'epic', 'legendary', '实测 0.0%·education=phd 纯终态，机器深造线深度不够'],
  ['ach_soul_buddy',          'epic', 'legendary', '实测 0.0%·45 岁 ∧ bestFriend ∧ 亲密 75'],
  ['ach_rebuilt_after_divorce', 'epic', 'legendary', '实测 0.0%·离婚率本身 0.0%，前置从缺'],
]

const SRC = 'src/engine/achievements.ts'
let src = readFileSync(SRC, 'utf8')
const before = src

// 先做全量预检：每条必须命中恰好一次，且旧值与断言一致——任一不符即退出，不写盘
interface Plan { id: string; from: R; to: R; why: string }
const plans: Plan[] = []
for (const [id, from, to, why] of CHANGES) {
  const idIdx = src.indexOf(`id: '${id}'`)
  if (idIdx < 0) { console.error(`FAIL: 找不到 ${id}`); process.exit(1) }
  const entryEnd = src.indexOf('\n  },', idIdx)
  if (entryEnd < 0) { console.error(`FAIL: ${id} 的条目结尾定位失败`); process.exit(1) }
  const entry = src.slice(idIdx, entryEnd)
  const rarIdx = entry.indexOf(`rarity: '${from}'`)
  if (rarIdx < 0) {
    const actual = entry.match(/rarity: '(\w+)'/)?.[1]
    console.error(`FAIL: ${id} 现值断言失败——期望 '${from}'，实际 '${actual}'`)
    process.exit(1)
  }
  plans.push({ id, from, to, why })
}
if (new Set(plans.map((p) => p.id)).size !== plans.length) { console.error('FAIL: id 重复'); process.exit(1) }

// 逐条替换（倒序替换以免位移影响未处理条目）
const offsets: Array<{ id: string; abs: number; len: number; to: R }> = []
for (const [id, from, to] of CHANGES) {
  const idIdx = src.indexOf(`id: '${id}'`)
  const entryEnd = src.indexOf('\n  },', idIdx)
  const entry = src.slice(idIdx, entryEnd)
  const rarIdx = entry.indexOf(`rarity: '${from}'`)
  offsets.push({ id, abs: idIdx + rarIdx, len: `rarity: '${from}'`.length, to })
}
offsets.sort((a, b) => b.abs - a.abs)
for (const o of offsets) {
  src = src.slice(0, o.abs) + `rarity: '${o.to}'` + src.slice(o.abs + o.len)
}

// 落盘后再全量复验：每个 id 的 rarity 必须等于目标值
let bad = 0
for (const p of plans) {
  const idIdx = src.indexOf(`id: '${p.id}'`)
  const entryEnd = src.indexOf('\n  },', idIdx)
  const got = src.slice(idIdx, entryEnd).match(/rarity: '(\w+)'/)?.[1]
  if (got !== p.to) { console.error(`FAIL 复验: ${p.id} 期望 ${p.to} 实际 ${got}`); bad++ }
}
if (bad) process.exit(1)

// 分布复验
const dist: Record<string, number> = {}
for (const m of src.matchAll(/rarity: '(\w+)'/g)) dist[m[1]] = (dist[m[1]] ?? 0) + 1
const total = Object.values(dist).reduce((a, b) => a + b, 0)
if (total !== 59) { console.error(`FAIL: rarity 条目数 ${total} ≠ 59，不写盘`); process.exit(1) }

writeFileSync(SRC, src, 'utf8')
console.log(`OK: 改写 ${plans.length} 枚，字节 ${before.length} → ${src.length}`)
console.log('新分布：', JSON.stringify(dist), '合计', total)
console.log('\n逐条依据：')
for (const p of plans) console.log(`  ${p.id.padEnd(26)} ${p.from} → ${p.to.padEnd(9)} ${p.why}`)