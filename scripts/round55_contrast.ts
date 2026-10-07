// 第 55 轮对比度走查（一次性）：token 色板 vs WCAG AA（正文 ≥4.5:1 / 大字与 UI ≥3:1）。
// 从 index.css :root 提取色值，计算关键文本对。跑完结果入账本。
import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')
const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
const vars: Record<string, string> = {}
for (const m of root.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})/g)) vars[m[1]] = m[2]

function lum(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(fg: string, bg: string): number {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (l1 + 0.05) / (l2 + 0.05)
}

// 关键文本对（前景, 背景, 用途, 阈值）
const PAIRS: Array<[string, string, string, number]> = [
  ['--ink', '--bg', '正文/页面底', 4.5],
  ['--ink', '--card', '正文/卡片', 4.5],
  ['--muted', '--bg', '次要文字/页面底', 4.5],
  ['--muted', '--card', '次要文字/卡片', 4.5],
  ['--pos-ink', '--bg', '正向文字', 4.5],
  ['--neg-ink', '--bg', '负向文字', 4.5],
  ['--gold', '--card', '金色强调/卡片', 3.0],
  ['--warn-ink', '--card', '警示文字/卡片', 4.5],
  ['--ink', '--surface-sunken', '正文/下陷面', 4.5],
]
console.log('token 对比度（WCAG AA：正文 ≥4.5，大字/UI ≥3.0）:')
let fails = 0
for (const [fg, bg, use, min] of PAIRS) {
  const f = vars[fg]
  const b = vars[bg]
  if (!f || !b) {
    console.log(`  ✗ 缺 token ${fg}=${f ?? '缺'} / ${bg}=${b ?? '缺'}（${use}）`)
    fails++
    continue
  }
  const r = Math.round(ratio(f, b) * 100) / 100
  const ok = r >= min
  if (!ok) fails++
  console.log(`  ${ok ? '✓' : '✗'} ${fg} on ${bg} = ${r}:1（需 ≥${min}，${use}）`)
}
// 属性五色作为 AttrBar 文字（on card）
for (const c of ['--c-health', '--c-happiness', '--c-smarts', '--c-social', '--c-stress']) {
  const f = vars[c]
  const b = vars['--card']
  if (!f || !b) continue
  const r = Math.round(ratio(f, b) * 100) / 100
  const ok = r >= 3.0 // 属性条标签为大字/图形伴文，3.0 档
  if (!ok && r < 3.0) console.log(`  △ ${c} on --card = ${r}:1（属性标签/图形档 3.0）`)
}
console.log(fails === 0 ? '\nCONTRAST: PASS（全部达标）' : `\nCONTRAST: ${fails} 项未达标`)
