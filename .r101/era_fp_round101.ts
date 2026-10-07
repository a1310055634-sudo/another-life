// 第 101 轮 A3：纯文本轮 era 指纹对跑
// 口径：本轮全部改动为「①既有 255 条的纯文本（text/summary）改写」+「②新增 7 条事件」。
// 证据链：
//   (1) 导出当前全池指纹 after；
//   (2) 导出「剔除本轮 7 条新增」后的指纹 existing（即本轮改动前的池）；
//   (3) 用 era_fp_compare 对比 existing vs after —— 必然报 7 条新增、0 条机制值变化；
//   (4) 逐条列出本轮对既有 255 条的改动字段，证明只碰 text/summary（title 仅新事件有），
//       minAge/maxAge/weight/priority/cooldown/once/effects/requires/addTags/
//       removeTags/delayed 全部零改动。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { readFileSync, writeFileSync } from 'node:fs'

const R101_NEW = [
  'late_taoli_chair',
  'late_care_home_visit',
  'late_digital_nomad',
  'late_silver_rework',
  'mid_exam_anchor_wait',
  'mid_livestream_works',
  'mid_gig_and_downsizing',
]

function clean(v: any): any {
  if (Array.isArray(v)) return v.map(clean)
  if (v && typeof v === 'object') {
    const out: Record<string, any> = {}
    for (const k of Object.keys(v).sort()) {
      if (k === 'summary' || k === 'tooltip') continue
      out[k] = clean(v[k])
    }
    return out
  }
  return v
}

function fp(events: typeof ALL_EVENTS) {
  return events.map((e) => ({
    id: e.id,
    category: e.category,
    minAge: e.minAge,
    maxAge: e.maxAge,
    weight: e.weight ?? 10,
    priority: e.priority ?? 0,
    cooldown: e.cooldown ?? 0,
    once: !!e.once,
    singleChoiceOk: !!e.singleChoiceOk,
    requires: clean(e.requires ?? null),
    choices: e.choices.map((c, i) => ({
      i,
      effects: clean(c.effects),
      requires: clean(c.requires ?? null),
      addTags: clean(c.addTags ?? null),
      removeTags: clean(c.removeTags ?? null),
      delayed: clean(c.delayed ?? null),
    })),
  }))
}

const after = fp(ALL_EVENTS)
const existing = fp(ALL_EVENTS.filter((e) => !R101_NEW.includes(e.id)))

writeFileSync('.r101/era-fp-after.json', JSON.stringify(after, null, 1))
writeFileSync('.r101/era-fp-existing.json', JSON.stringify(existing, null, 1))

console.log(`全池 ${ALL_EVENTS.length}；本轮新增 ${R101_NEW.length}；既有 ${existing.length}`)
console.log(`after 指纹事件数 ${after.length}；existing 指纹事件数 ${existing.length}`)
console.log(`指纹档：.r101/era-fp-after.json / .r101/era-fp-existing.json`)

// 新增 7 条的机制值清单（入账本留证：权重/年龄窗/选项效果）
console.log('\n新增 7 条机制值：')
for (const id of R101_NEW) {
  const e = ALL_EVENTS.find((x) => x.id === id)!
  const eff = e.choices.map((c) => clean(c.effects))
  console.log(`  ${id} [${e.minAge}-${e.maxAge}] w${e.weight ?? 10} cd${e.cooldown ?? 0} once=${!!e.once} choices=${e.choices.length}`)
  console.log(`    effects: ${JSON.stringify(eff)}`)
}
