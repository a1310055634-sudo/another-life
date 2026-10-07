// 第 103 轮：V3 策略钩子盘点——统计各策略要识别的 Effect 在全池的分布
import { ALL_EVENTS } from '../src/data/events'
import type { Effect, EventChoice } from '../src/engine/types'

interface Hook {
  label: string
  test: (e: Effect) => number
}

const HOOKS: Hook[] = [
  { label: 'civilExam（考公笔试面试）', test: (e) => (e.civilExam ? 1 : 0) },
  { label: 'addTags civil_exam_prep', test: (e) => (e.addTags?.includes('civil_exam_prep') ? 1 : 0) },
  { label: 'addTags 体制内标记', test: (e) => (e.addTags?.filter((t) => t.includes('civil') || t.includes('servant')).length ?? 0) },
  { label: 'startEducation', test: (e) => (e.startEducation ? 1 : 0) },
  { label: 'setEducation', test: (e) => (e.setEducation ? 1 : 0) },
  { label: 'promote（晋升）', test: (e) => (e.promote ? 1 : 0) },
  { label: 'salaryMul（调薪）', test: (e) => (e.salaryMul ?? 0) },
  { label: 'loseJob（失业）', test: (e) => (e.loseJob ? 1 : 0) },
  { label: 'quitJob（辞职）', test: (e) => (e.quitJob ? 1 : 0) },
  { label: 'startJob', test: (e) => (e.startJob ? 1 : 0) },
  { label: 'ensureFund（定投开户）', test: (e) => (e.ensureFund ? 1 : 0) },
  { label: 'redeemFund（止盈赎回）', test: (e) => (e.redeemFund ? 1 : 0) },
  { label: 'buyHome（购房）', test: (e) => (e.buyHome ? 1 : 0) },
  { label: 'takeMortgage（贷款）', test: (e) => (e.takeMortgage ? 1 : 0) },
  { label: 'sellHome（卖房）', test: (e) => (e.sellHome ? 1 : 0) },
  { label: 'ensureInsurance（投保）', test: (e) => (e.ensureInsurance ? 1 : 0) },
  { label: 'claimInsurance（理赔）', test: (e) => (e.claimInsurance ? 1 : 0) },
  { label: 'addTags 投资/资产类', test: (e) => (e.addTags?.filter((t) => /fund|invest|asset|stock|基金|投资/.test(t)).length ?? 0) },
  { label: 'addTags 副业类', test: (e) => (e.addTags?.filter((t) => /side|gig|副业/.test(t)).length ?? 0) },
]

console.log(`全池 ${ALL_EVENTS.length} 事件\n`)
console.log('钩子\t出现事件数\t事件 id（最多 12）')
for (const h of HOOKS) {
  const hits = ALL_EVENTS.filter((e) => e.choices.some((c) => c.effects.some(h.test)))
  console.log(`${h.label}\t${hits.length}\t${hits.slice(0, 12).map((e) => e.id).join(', ')}${hits.length > 12 ? ' …' : ''}`)
}

// 体制内维护：看看 civil_servant 相关事件的选项长什么样
console.log('\n=== civil_servant 门控事件明细 ===')
for (const e of ALL_EVENTS.filter((x) => x.requires?.tagsAll?.includes('civil_servant') || x.requires?.tagsAny?.includes('civil_servant'))) {
  console.log(`\n[${e.id}] ${e.title} (${e.minAge}-${e.maxAge})`)
  for (const c of e.choices) {
    console.log(`  · ${c.text} → ${JSON.stringify(c.effects)}`)
  }
}

// 基金/投资事件明细
console.log('\n=== 基金事件明细 ===')
for (const e of ALL_EVENTS.filter((x) => x.choices.some((c) => c.effects.some((ef) => ef.ensureFund || ef.redeemFund)))) {
  console.log(`\n[${e.id}] ${e.title} (${e.minAge}-${e.maxAge}) requires=${JSON.stringify(e.requires ?? {})}`)
  for (const c of e.choices) {
    console.log(`  · ${c.text} → ${JSON.stringify(c.effects)}`)
  }
}
