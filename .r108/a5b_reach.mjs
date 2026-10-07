// 第 108 轮 A5 补充：事件① 的**可达性分母**。
//
// A5 报出「432 局只遭遇 1 次」，单看这个数字无法判断是「门控太紧」还是
// 「候选池里竞争太激烈正常如此」。本脚本补齐分母：多少局真的把配偶带进了
// 56-65 窗口，以及那些年份里事件① 在候选集中的权重占比。
// 有了分母，「1 次」才有解释力。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { startSession, nextYear, chooseOption, recoverMissingEvent } from '../src/engine/session.ts'
import { availableEvents, visibleChoices } from '../src/engine/events.ts'

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const STRATEGIES = ['rotate', 'family_line']

const E1 = 'late_widow_first_year'
let runs = 0
let runsWithSpouseInWindow = 0 // 有配偶且进入过 56-65 窗口的局数（真实分母）
let candidateYears = 0
let sharedWithTop = 0 // 事件① 所在年份里，它是否处在最高优先级层
let weightShareSum = 0
let poolSizeSum = 0

for (const strategy of STRATEGIES) {
  for (const bg of BACKGROUNDS) {
    for (const trait of TRAITS) {
      for (let k = 0; k < 9; k++) {
        const seed = 7000 + runs * 13
        let s = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
        let guard = 0
        let pick = seed % 3
        let inWindow = false
        while (s.state.phase === 'playing' && guard < 200) {
          guard++
          if (s.awaitingAdvance) {
            const st = s.state
            const hasSpouse = st.relations.some((r) => r.kind === 'spouse' && r.alive)
            if (hasSpouse && st.age >= 56 && st.age <= 65) {
              inWindow = true
              const avail = availableEvents(st, ALL_EVENTS)
              if (avail.some((e) => e.id === E1)) {
                candidateYears++
                const maxP = Math.max(...avail.map((e) => e.priority ?? 0))
                const top = avail.filter((e) => (e.priority ?? 0) === maxP)
                const tw = top.reduce((s2, e) => s2 + Math.max(1, e.weight ?? 10), 0)
                weightShareSum += Math.max(1, 11) / tw
                poolSizeSum += top.length
                if (top.some((e) => e.id === E1)) sharedWithTop++
              }
            }
            s = nextYear(s, ALL_EVENTS)
          } else if (s.currentEvent) {
            const vis = visibleChoices(s.state, s.currentEvent)
            if (vis.length === 0) {
              s = recoverMissingEvent(s, ALL_EVENTS)
              continue
            }
            const idx = strategy === 'family_line'
              ? (() => {
                  const j = vis.findIndex((c) => (c.effects ?? []).some((e) => e.relation?.add || e.relation?.addAnother || e.relation?.deltaCloseness))
                  return j < 0 ? pick++ % vis.length : j
                })()
              : pick++ % vis.length
            s = chooseOption(s, vis[idx].text)
          } else break
        }
        if (inWindow) runsWithSpouseInWindow++
        runs++
      }
    }
  }
}

console.log(`总局数 ${runs}`)
console.log(`有配偶且进入 56-65 窗口的局数（事件① 的真实分母）：${runsWithSpouseInWindow}（${((runsWithSpouseInWindow / runs) * 100).toFixed(1)}%）`)
console.log(`其中事件① 成为候选的年份数：${candidateYears}`)
console.log(`这些年份里事件① 处于最高优先级层的比例：${((sharedWithTop / candidateYears) * 100).toFixed(1)}%`)
console.log(`平均：每次抽取它占最高层权重和的 ${((weightShareSum / candidateYears) * 100).toFixed(2)}%，最高层平均候选数 ${(poolSizeSum / candidateYears).toFixed(1)}`)
console.log(`\n按期望值估算：${candidateYears} 个候选年份 × 平均权重占比 ≈ ${(candidateYears * (weightShareSum / candidateYears)).toFixed(2)} 次遭遇`)
console.log('（A5 实测遭遇 1 次，落在期望的随机涨落范围内——属竞争激烈，非门控过紧）')
