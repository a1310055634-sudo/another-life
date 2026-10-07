/**
 * 第 103 轮 A4 旧池开关保持 —— 对照装置生成器。
 *
 * 目的：本轮改了 round39_balance_sim.ts（新增 V3 import / pickIndex 分支 / 行动轮扩展 /
 * H-I-J 段 / A3 表），A4 要求「旧池复跑漂移 ≤±2%」。仓内无 git（项目非仓库），
 * 无改动前的旧池输出可比，故从现行脚本机械剥离本轮新增的可执行件，生成
 * 「等价于本轮改动前」的副本，再与现行脚本在 --pool=old 下逐位比对输出。
 *
 * 剥离清单（只动可执行语句；注释保留以免锚点漂移）：
 *   ① import { ... } from './strategy_v3'  → 本地空实现（非 V3 路径逐位等同原口径）
 *   ② pickIndex 里的 if (isV3Strategy(...)) 分支 → 删
 *   ③ 行动轮 if (ACTIONS_ON || strategy === 'action_balanced') → 退回 if (ACTIONS_ON)
 *   ④ if (POOL === 'new') { H/I/J 三段 } 整块 → 删
 *   ⑤ if (POOL === 'new') selfCheckV3()   → 删
 * 保留（不产生位移）：COMBOS_LIMIT 缺省（旧池恒 360）、C 段旧池奇偶口径、
 *   A3 观察表（只读 allRuns，不触碰随机流）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'scripts/round39_balance_sim.ts'
let src = readFileSync(SRC, 'utf8')
const before = src

function cut(needle: string, label: string): void {
  if (!src.includes(needle)) { console.error(`FAIL: 锚点未命中 —— ${label}`); process.exit(1) }
  src = src.replace(needle, '')
}

cut(
  `import { isV3Strategy, pickActionForTurn, pickV3, selfCheckV3 } from './strategy_v3'`,
  '① V3 import',
)

cut(
  `  if (isV3Strategy(strategy)) return pickV3(vis, strategy, { health, money, age, smarts, category, tags })
`,
  '② pickIndex V3 分支',
)

cut(
  `      if (ACTIONS_ON || strategy === 'action_balanced') {
        const availIds = availableActions(s.state).map((a) => a.id)
        const pickedId = pickActionForTurn(availIds, guard, strategy)
        if (pickedId) {
          s = { ...s, state: performAction(s.state, pickedId).state }
        }
      }
`,
  '③ 行动轮',
)

const hij = `if (POOL === 'new') {
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('H', c.seed, c.bg, c.trait, 'career_civil'))
  }
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('I', c.seed, c.bg, c.trait, 'investor'))
  }
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('J', c.seed, c.bg, c.trait, 'action_balanced'))
  }
}
`
cut(hij, '④ H/I/J 段')

cut(`if (POOL === 'new') selfCheckV3()
`, '⑤ selfCheckV3 调用')

// 补回本地空实现（放在 STRATEGY_F 定义之后即可，此处直接追加到 import 区尾部锚点）
src = src.replace(
  `import { availableActions, performAction } from '../src/engine/actions'`,
  `import { availableActions, performAction } from '../src/engine/actions'
// [A4 对照装置] strategy_v3 已剥离，以下为空实现/原口径还原
function isV3Strategy(_s: string): boolean { return false }
function pickV3(_v: EventChoice[], _s: string, _c: unknown): number { return 0 }
function selfCheckV3(): void { /* 剥离 */ }
function pickActionForTurn(availIds: string[], turn: number, _strategy: string): string | null {
  if (!availIds.length) return null
  return availIds[turn % availIds.length]
}`,
)

// 残留可执行引用检查（注释不算）
const lines = src.split(/\r?\n/)
const bad = lines
  .filter((l) => !l.trim().startsWith('//'))
  .filter((l) => /from '\.\/strategy_v3'|isV3Strategy\(strategy\)|selfCheckV3\(\)/.test(l) && !/^\s*function\s/.test(l))
  .filter((l) => /runOne\('[HIJ]'|action_balanced'\)\s*\{/.test(l))
if (bad.length) { console.error('FAIL: 残留可执行 V3 引用\n' + bad.join('\n')); process.exit(1) }

if (src === before) { console.error('FAIL: 零替换'); process.exit(1) }
// 输出落在 scripts/ 下：副本内含 '../src/...' 与 './strategy_v2' 相对 import，
// 放在 .r103/ 会解析失真，故与原文件同目录（对照装置用完即删）。
writeFileSync('scripts/_r103_oldpool_equiv.ts', src, 'utf8')
console.log(`OK: 生成 scripts/_r103_oldpool_equiv.ts（${before.length} → ${src.length} 字节，剥离 ${before.length - src.length}）`)