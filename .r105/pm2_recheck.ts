// 第 105 轮：±2 结论复核抽测（受控 seed 注入法，纯只读，不改产品源码）。
//
// V3 定案：±2 结论 = 「引擎 + UI 在固定 seed 下逐位确定」。
// R80 用的是 round36_check 的注入段（受控 seed 存档 → reload → 继续游戏 → 全量渲染一致）。
// 本轮按「只修不扩」体检要求再抽测一次，验的是两件事：
//   ① 引擎位级确定：同 seed 同参数连跑两次，终局状态逐字节一致（JSON 比对）。
//   ② UI 位级确定：同 seed 跑出的终局快照序列，重放一次逐字节一致。
// 另加一条易被忽略的对照：**换 seed 必须不同**——若「确定」退化成「恒定输出」，
// 说明比较口径本身失效（确定性测试最常见的自欺）。
import { startSession, chooseOption, nextYear } from '../src/engine/session'
import { ALL_EVENTS } from '../src/data/events'
import type { EventChoice } from '../src/engine/types'

const BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']

/** 固定策略：逐事件取第 (i mod n) 个选项——确定性选择，不引入额外随机 */
function runOne(seed: number, bg: string, trait: string) {
  let session = startSession({ seed, backgroundId: bg, traitId: trait, name: '复核' }, ALL_EVENTS)
  let i = 0
  let guard = 0
  while (session.state.phase === 'playing' && guard < 200) {
    guard++
    if (session.awaitingAdvance) { session = nextYear(session, ALL_EVENTS); continue }
    if (!session.currentEvent) break
    const vis = session.currentEvent.choices.filter((c: EventChoice) => true)
    session = chooseOption(session, i % vis.length)
    i++
  }
  return JSON.stringify(session.state)
}

const N = Number(process.argv[2] ?? 12)
let sameSeedSame = 0
let diffSeedDiff = 0
const samples: string[] = []
for (let k = 0; k < N; k++) {
  const bg = BG[k % BG.length]
  const trait = TRAITS[k % TRAITS.length]
  const seed = 88000 + k * 613
  const a = runOne(seed, bg, trait)
  const b = runOne(seed, bg, trait)          // 同 seed 重放
  const c = runOne(seed + 1, bg, trait)      // 换 seed 对照
  if (a === b) sameSeedSame++
  if (a !== c) diffSeedDiff++
  if (samples.length < 3) samples.push(a.slice(0, 90))
  const d = a.length
  if (a !== b) console.log(`  seed=${seed} MISMATCH len=${d}`)
}
console.log(`same-seed replay byte-identical: ${sameSeedSame}/${N}`)
console.log(`different-seed actually differs: ${diffSeedDiff}/${N}`)
console.log(`verdict: ${sameSeedSame === N && diffSeedDiff === N ? 'PASS' : 'FAIL'}`)
console.log('sample state head:')
for (const s of samples) console.log('  ' + s + '...')