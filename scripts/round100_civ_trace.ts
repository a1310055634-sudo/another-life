// 第100 轮诊断 V：civ_exam（civilExam 效果）真实链路追踪。
// 修正 gap2 的统计口径缺陷：civil_servant 由 effects.civilExam 授予，不在 addTags 里，
// 故 gap2 的 visHits/chosenHits（只扫 addTags）必然全 0 —— 那是探针 bug，不是机制缺陷。
// 本探针直接扫 effects.civilExam，并统计 academics 达标分布。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import { civilExamAdmitted, CIVIL_EXAM_ACADEMICS } from '../src/engine/civilservice'
import type { GameState } from '../src/engine/types'

const STRATS = [
  'rotate', 'study_line', 'civ_line', 'balanced',
  'survival_best', 'family_line_v2', 'health_aware', 'friend_line', 'family_line',
]
const N = 400
const stats = {
  prepVisible: 0, prepChosen: 0,
  examVisible: 0, examChosen: 0, examEnter: 0, examPass: 0,
  examChoseOption: 0, examChoseQuit: 0,
  examByAcadOk: 0, examByAcadFail: 0,
}
let gamesWithServant = 0
const acadAtExam: number[] = []
const trace: string[] = []

for (let n = 0; n < N; n++) {
  const seed = 5000 + n * 131
  const bg = ['ordinary', 'wealthy', 'rural', 'single_parent'][n % 4]
  const trait = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker'][n % 6]
  const st = STRATS[n % STRATS.length]
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '考公者' })
  const rng = mulberry32(seed ^ 0x100)
  let guard = 0
  let servant = false
  const lines: string[] = []
  while (s.phase === 'playing' && guard < 120) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = weightedPick(cands, rng)
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, st, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        const chosen = vis[idx]
        if (ev.id === 'civ_exam_prep') {
          stats.prepVisible++
          if (chosen.addTags?.includes('civil_exam_prep')) stats.prepChosen++
        }
        if (ev.id === 'civ_exam') {
          stats.examVisible++
          const enterIdx = vis.findIndex((c) => c.effects.some((e) => (e as { civilExam?: boolean }).civilExam))
          const enter = enterIdx >= 0 ? vis[enterIdx] : null
          if (enter) {
            stats.examChoseOption++
            if (idx === enterIdx) {
              stats.examChosen++
              const acad = s.skills.academics
              acadAtExam.push(acad)
              const pass = civilExamAdmitted(seed, s.age, acad)
              if (pass) stats.examByAcadOk++
              else if (acad >= CIVIL_EXAM_ACADEMICS) stats.examByAcadFail++
              stats.examEnter++
              if (pass) stats.examPass++
              if (lines.length < 6) lines.push(`  age${s.age} acad=${acad} → ${pass ? '录取' : '落榜'}`)
            }
          } else {
            stats.examChoseQuit++
          }
        }
        s = applyChoice(s, ev, ev.choices.indexOf(chosen)).state
        if (s.tags.includes('civil_servant')) servant = true
      }
    }
    s = advanceYear(s)
    if (s.tags.includes('civil_servant')) servant = true
  }
  if (servant) gamesWithServant++
  if (lines.length) trace.push(`局${n} ${bg}/${trait}/${st} seed=${seed} civil_servant=${servant}\n` + lines.join('\n'))
}

console.log(`局数=${N}\n`)
console.log('① civ_exam_prep：可见被抽中次数 =', stats.prepVisible, ' 其中选中「备考」 =', stats.prepChosen)
console.log('② civ_exam：可见被抽中次数 =', stats.examVisible, ' 其中选项含「进考场」 =', stats.examChoseOption, ' 全为「弃考」 =', stats.examChoseQuit)
console.log('   实际选中「进考场」 =', stats.examChosen)
console.log('③ 进考场者中：录取 =', stats.examPass, ' 落榜 =', stats.examEnter - stats.examPass)
console.log('   其中「功底达标但没考上」 =', stats.examByAcadFail)
console.log(`④ 最终带上 civil_servant 标记的局数：${gamesWithServant}/${N} (${(gamesWithServant / N * 100).toFixed(1)}%)`)
if (acadAtExam.length) {
  const sorted = [...acadAtExam].sort((a, b) => a - b)
  const sum = acadAtExam.reduce((a, b) => a + b, 0)
  console.log(`⑤ 进考场时 academics：n=${acadAtExam.length} 均值=${(sum / acadAtExam.length).toFixed(1)} 最低=${sorted[0]} P25=${sorted[Math.floor(sorted.length * 0.25)]} 中位=${sorted[Math.floor(sorted.length / 2)]} P75=${sorted[Math.floor(sorted.length * 0.75)]} 最高=${sorted[sorted.length - 1]}`)
  console.log(`   ≥门槛 ${CIVIL_EXAM_ACADEMICS} 的次数 = ${acadAtExam.filter((a) => a >= CIVIL_EXAM_ACADEMICS).length}/${acadAtExam.length}`)
}
console.log('\n⑥ 前若干局考公轨迹：')
for (const t of trace.slice(0, 6)) console.log(t)