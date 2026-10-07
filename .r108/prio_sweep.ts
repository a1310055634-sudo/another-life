// 优先级扫描：事件① 目前 priority=无（=0），实测只有 19.6% 的候选年能进抽取层，
// 导致 432 局只遭遇 1 次（0.23% 的人生）——本轮旗舰内容等于玩家看不见。
// 这里不靠猜，直接把 priority 取 0/1/2/3 各跑一遍 432 局，用实测遭遇率选值。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { startSession, nextYear, chooseOption, recoverMissingEvent } from '../src/engine/session.ts'
import { availableEvents, visibleChoices } from '../src/engine/events.ts'

const E1 = 'late_widow_first_year'
const ev = ALL_EVENTS.find((e) => e.id === E1)!

function sweep(priority: number | undefined) {
  const saved = (ev as { priority?: number }).priority
  ;(ev as { priority?: number }).priority = priority
  let hits = 0
  let candYears = 0
  let topYears = 0
  let eligibleLives = 0
  let runs = 0
  for (const strategy of ['rotate', 'family_line']) {
    for (const bg of ['ordinary', 'wealthy', 'rural', 'single_parent']) {
      for (const trait of ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']) {
        for (let k = 0; k < 9; k++) {
          const seed = 7000 + runs * 13
          let s = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
          let guard = 0
          let pick = seed % 3
          let eligible = false
          while (s.state.phase === 'playing' && guard < 200) {
            guard++
            if (s.awaitingAdvance) {
              const avail = availableEvents(s.state, ALL_EVENTS)
              if (avail.some((e) => e.id === E1)) {
                eligible = true
                candYears++
                const maxP = Math.max(...avail.map((e) => e.priority ?? 0))
                if (avail.some((e) => e.id === E1 && (e.priority ?? 0) === maxP)) topYears++
              }
              s = nextYear(s, ALL_EVENTS)
            } else if (s.currentEvent) {
              if (s.currentEvent.id === E1) hits++
              const vis = visibleChoices(s.state, s.currentEvent)
              if (vis.length === 0) { s = recoverMissingEvent(s, ALL_EVENTS); continue }
              let idx = pick++ % vis.length
              if (strategy === 'family_line') {
                const j = vis.findIndex((c) => (c.effects ?? []).some((e) => e.relation?.add || e.relation?.addAnother || e.relation?.deltaCloseness))
                if (j >= 0) idx = j
              }
              s = chooseOption(s, idx)
            } else break
          }
          if (eligible) eligibleLives++
          runs++
        }
      }
    }
  }
  ;(ev as { priority?: number }).priority = saved
  return { priority: priority ?? 0, hits, candYears, topYears, eligibleLives, runs }
}

console.log('priority\t候选年\t入抽取层年\t可触发人生\t遭遇次数\t占全部人生\t占可触发人生')
for (const p of [undefined, 1, 2, 3]) {
  const r = sweep(p)
  console.log(
    `${r.priority}\t${r.candYears}\t${r.topYears}\t${r.eligibleLives}/${r.runs}\t${r.hits}\t` +
      `${((r.hits / r.runs) * 100).toFixed(2)}%\t${((r.hits / r.eligibleLives) * 100).toFixed(1)}%`,
  )
}
