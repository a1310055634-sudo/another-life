// 第 101 轮前置盘点：66+ 事件清单（撞题扫描用）
import { ALL_EVENTS } from '../src/data/events/index.ts'

const old = ALL_EVENTS.filter((e) => e.maxAge >= 62)
console.log(`maxAge>=62 共 ${old.length} 条：`)
for (const e of old) console.log(`  ${e.id} [${e.minAge}-${e.maxAge}] ${e.title}`)

// 完全落在 66-77 桶的（定向补密目标桶）
const bucket = old.filter((e) => e.minAge >= 66)
console.log(`\n完全落在 66-77 桶（minAge>=66）共 ${bucket.length} 条：`)
for (const e of bucket) console.log(`  ${e.id} [${e.minAge}-${e.maxAge}] ${e.title}`)

// 逐岁覆盖（66-77）
console.log('\n66-77 逐岁窗口数：')
for (let age = 66; age <= 77; age++) {
  const n = ALL_EVENTS.filter((e) => e.maxAge >= age && e.minAge <= age).length
  console.log(`  ${age}岁: ${n}`)
}
