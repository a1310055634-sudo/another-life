// 第 110 轮：全池/文件级计数断言同步（286→290 / FAME 5→7 / LATE 56→58）。
// 只动 ASCII 字面量，二进制读写，零中文经过任何 shell。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/engine'
let changed = 0
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.test.ts')) continue
  const p = join(dir, f)
  const before = readFileSync(p, 'latin1')
  let after = before
    .replaceAll('toHaveLength(286)', 'toHaveLength(290)')
    .replaceAll('FAME_EVENTS).toHaveLength(5)', 'FAME_EVENTS).toHaveLength(7)')
    .replaceAll('LATE_EVENTS).toHaveLength(56)', 'LATE_EVENTS).toHaveLength(58)')
  if (after !== before) {
    writeFileSync(p, after, 'latin1')
    changed++
    console.log('OK', p)
  }
}
console.log(`changed ${changed} files`)
