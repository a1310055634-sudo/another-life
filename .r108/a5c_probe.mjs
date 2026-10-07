// 探针：定位「候选 552 次却只遭遇 1 次」的真实原因。
// 关键怀疑点（按可能性排序）：
//   ① 我在 awaitingAdvance 态采样 availableEvents，而引擎在 advanceAndDraw 里
//      **先 advanceYear 再抽**——中间的关系/年龄变动会把候选刷掉；
//   ② weightedPick 只在最高优先级层里挑，① 常被优先级挤掉；
//   ③ chooseOption 的第二参是**下标**，此前误传文本 → 每次都兜底到第一个可见选项，
//      策略多样性归零，玩家行为退化。
// 本探针在同一年内同时记录「我算的候选」与「引擎真抽到的 id」，逐项对账。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { startSession, nextYear, chooseOption } from '../src/engine/session.ts'
import { availableEvents, visibleChoices } from '../src/engine/events.ts'
import { isEventAvailable } from '../src/engine/events.ts'

const E1 = 'late_widow_first_year'
const E1_EVENT = ALL_EVENTS.find((e) => e.id === E1)
let sampledCand = 0
let actualCand = 0
let hit = 0
let inTop = 0
let lostByAdvance = 0
let lostByPriority = 0
const drawnWhenCandidate = new Map()
let shareSum = 0
let topSizeSum = 0
let runs = 0

for (const strategy of ['rotate', 'family_line']) {
  for (const bg of ['ordinary', 'wealthy', 'rural', 'single_parent']) {
    for (const trait of ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']) {
      for (let k = 0; k < 9; k++) {
        const seed = 7000 + runs * 13
        let s = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
        let guard = 0
        let pick = seed % 3
        while (s.state.phase === 'playing' && guard < 200) {
          guard++
          if (s.awaitingAdvance) {
            const mine = isEventAvailable(s.state, ALL_EVENTS.find((e) => e.id === E1))
            if (mine) sampledCand++
            s = nextYear(s, ALL_EVENTS)
          } else if (s.currentEvent) {
            const drawn = s.currentEvent
            const avail = availableEvents(s.state, ALL_EVENTS)
            if (isEventAvailable(s.state, E1_EVENT)) {
              actualCand++
              const maxP = Math.max(...avail.map((e) => e.priority ?? 0))
              const top = avail.filter((e) => (e.priority ?? 0) === maxP)
              if (top.some((e) => e.id === E1)) {
                inTop++
                const tw = top.reduce((s2, e) => s2 + Math.max(1, e.weight ?? 10), 0)
                shareSum += (top.length === 1 ? 1 : Math.max(1, E1_EVENT.weight ?? 10) / tw)
                topSizeSum += top.length
              }
            }
            if (drawn.id === E1) {
              hit++
              drawnWhenCandidate.set(E1, (drawnWhenCandidate.get(E1) ?? 0) + 1)
            }
            const vis = visibleChoices(s.state, drawn)
            if (vis.length === 0) break
            let idx = pick++ % vis.length
            if (strategy === 'family_line') {
              const j = vis.findIndex((c) => (c.effects ?? []).some((e) => e.relation?.add || e.relation?.addAnother || e.relation?.deltaCloseness))
              if (j >= 0) idx = j
            }
            s = chooseOption(s, idx) // ← 下标，不是文本
          } else break
        }
        runs++
      }
    }
  }
}

console.log(`局数 ${runs}`)
console.log(`① 我在 advanceYear 之前判它可用：${sampledCand} 次`)
console.log(`① 引擎 advanceYear 之后真正判它可用（= 实际候选年）：${actualCand} 次`)
console.log(`  其中 advanceYear 把它刷掉：${sampledCand - actualCand} 次`)
console.log(`① 处于最高优先级层：${inTop} 次（占候选年 ${((inTop / actualCand) * 100).toFixed(1)}%）`)
console.log(`  这些年份里 ① 的平均权重占比：${((shareSum / inTop) * 100).toFixed(2)}%，最高层平均候选数 ${(topSizeSum / inTop).toFixed(1)}`)
console.log(`  按占比估算的期望遭遇次数：${shareSum.toFixed(2)} 次`)
console.log(`① 真被抽中：${hit} 次`)
console.log(`\n候选年里被抽到的其他事件 top10：`)
;[...drawnWhenCandidate.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([id, n]) => console.log(`  ${id}：${n}`))
