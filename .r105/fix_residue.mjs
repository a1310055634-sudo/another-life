// 删除 save_robustness_verify.mjs 第 293 行的残留尾巴（Edit 改行残留）。
// 纯 ASCII 操作，node fs 按 UTF-8 读写，不经 shell，无 GBK 化风险。
import fs from 'node:fs'
const P = 'scripts/save_robustness_verify.mjs'
const lines = fs.readFileSync(P, 'utf8').split('\n')
const idx = 292 // 0-based
if (!lines[idx].includes('}]) name:')) {
  console.error('ABORT: line 293 is not the residue line -> ' + lines[idx])
  process.exit(1)
}
lines.splice(idx, 1)
fs.writeFileSync(P, lines.join('\n'), 'utf8')
console.log('removed line 293. new line 293 = ' + (lines[292] ?? ''))