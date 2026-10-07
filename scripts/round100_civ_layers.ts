// 第100 轮诊断 VI：civ_exam 进考场后的**逐层拆解**，判定 0% 是策略口径还是机制缺陷。
// 五层：①备考标记在册 → ②录取判定 → ③employPatch 入职是否 ok → ④career.jobId 是否落编 → ⑤civil_servant 标记是否入册
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import { civilExamAdmitted, CIVIL_EXAM_ACADEMICS, civilTargetJob } from '../src/engine/civilservice'
import { isEligibleFor, getJob } from '../src/data/careers'
import type { GameState } from '../src/engine/types'

const STRATS = [
  'rotate', 'study_line', 'civ_line', 'balanced',
  'survival_best', 'family_line_v2', 'health_aware', 'friend_line', 'family_line',
]
const N = 400
let attempts = 0            // 选中「进考场」次数
let noPrep = 0             // ① 无备考标记 → 引擎 no-op
let admitted = 0           // ② 录取
let rejected = 0           // ② 落榜
let employOk = 0           // ③ 入职成功
let employFailReason = new Map<string, number>() // ③ 入职失败原因
let jobLanded = 0          // ④ career.jobId ∈{civil_servant, public_institution}
let tagLanded = 0          // ⑤ civil_servant 标记入册
const jobHist = new Map<string, number>()
const eduAtAttempt = new Map<string, number>()
const sample: string[] = []

for (let n = 0; n < N; n++) {
  const seed = 5000 + n * 131   // 与 civ_trace 同 seed 口径，可交叉核对
  const bg = ['ordinary', 'wealthy', 'rural', 'single_parent'][n % 4]
  const trait = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker'][n % 6]
  const st = STRATS[n % STRATS.length]
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '考公者' })
  const rng = mulberry32(seed ^ 0x100)
  let guard = 0
  while (s.phase === 'playing' && guard < 120) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = weightedPick(cands, rng)
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, st, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        const chosen = vis[idx]
        if (ev.id === 'civ_exam' && chosen.effects.some((e) => (e as { civilExam?: boolean }).civilExam)) {
          attempts++
          const hasPrep = s.tags.includes('civil_exam_prep')
          const edu = s.education
          const acad = s.skills.academics
          eduAtAttempt.set(edu, (eduAtAttempt.get(edu) ?? 0) + 1)
          const pass = civilExamAdmitted(seed, s.age, acad)
          const target = civilTargetJob(edu)
          const job = getJob(target)
          const eligible = job ? isEligibleFor(s, job) : false
          let line = `  age${s.age} edu=${edu} acad=${acad} prep=${hasPrep} 录取=${pass} target=${target} 岗位门槛(ed=${job?.minEducation}/acad=${job?.minAcademics}) 达标=${eligible}`
          if (!hasPrep) { noPrep++; line += ' → ①无备考标记，引擎 no-op' }
          else if (!pass) { rejected++; line += ' → ②落榜（备考标记被摘）' }
          else {
            admitted++
            if (eligible) { employOk++; line += ' → ③入职成功' }
            else {
              const key = `门槛不足 edu${job?.minEducation}/acad${job?.minAcademics}`
              employFailReason.set(key, (employFailReason.get(key) ?? 0) + 1)
              line += ' → ③入职 no-op（录取却进不去）'
            }
          }
          if (sample.length < 14) sample.push(line)
        }
        s = applyChoice(s, ev, ev.choices.indexOf(chosen)).state
        if (s.career.kind === 'employed') jobHist.set(s.career.jobId, (jobHist.get(s.career.jobId) ?? 0) + 1)
        if (s.tags.includes('civil_servant')) tagLanded++
      }
    }
    s = advanceYear(s)
  }
}

console.log(`局数=${N}\n`)
console.log('① 选中「进考场」总次数 =', attempts)
console.log(`② 无备考标记导致引擎 no-op = ${noPrep} (${(noPrep / Math.max(1, attempts) * 100).toFixed(1)}%)`)
console.log(`③ 有效备考且录取 = ${admitted}  有效备考但落榜 = ${rejected}`)
console.log(`④ 录取后 employPatch 入职成功 = ${employOk}  失败 = ${admitted - employOk}`)
for (const [k, v] of [...employFailReason.entries()].sort((a, b) => b[1] - a[1])) console.log(`     失败原因：${k} × ${v}`)
console.log(`⑤ 观察到的编制岗位落位次数：`)
for (const k of ['civil_servant', 'public_institution']) console.log(`     ${k}=${jobHist.get(k) ?? 0}`)
console.log(`⑥ civil_servant 标记在册次数 = ${tagLanded}`)
console.log('\n⑦ 进考场时学历分布：', [...eduAtAttempt.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ') || '（无）')
console.log('\n⑧ 逐次样本：')
for (const x of sample) console.log(x)