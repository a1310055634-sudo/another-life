/**
 * 第 103 轮 · A3 两项偏离的成因探针（只读，不改任何产品/脚本文件）
 *
 * Q1 上岸率 0.2%（合理带 5–15%）：H 段 career_civil 专段 60 局，为何仍只有 2 局上岸？
 *    分解为三步可见性：① 全池有多少事件的某个选项带 civilExam effect；
 *    ② 千局中这些事件被抽到过几次（YearRecord）；③ career_civil 是否每次都选了 civilExam。
 * Q2 贫富差距 45.2 倍（合理带 8–20 倍）：p90 异常高，定位是哪个段拉上去的。
 */
import { readFileSync } from 'node:fs'
import { ALL_EVENTS } from '../src/data/events'

// —— Q1-①：全池 civilExam effect 分布 ——
const civEvents = ALL_EVENTS.filter((e) => e.choices.some((c) => c.effects.some((f) => f.civilExam)))
console.log(`[Q1-①] 全池带 civilExam effect 的事件：${civEvents.length} 枚`)
for (const e of civEvents) {
  const wins = e.choices.filter((c) => c.effects.some((f) => f.civilExam)).length
  console.log(`  ${e.id}  age[${e.minAge},${e.maxAge}]  cat=${e.category}  选项数=${e.choices.length}  其中报名向=${wins}`)
  for (const c of e.choices) {
    const f = c.effects.find((x) => x.civilExam)
    if (f) console.log(`      ↳ "${c.text}" civilExam=${JSON.stringify(f.civilExam)}  requires=${JSON.stringify(c.requires ?? null)}`)
  }
}

// —— Q1-①b：civil_exam_prep 标记的生产者 ——
const prepProducers = ALL_EVENTS.filter((e) =>
  e.choices.some((c) => (c.addTags ?? []).includes('civil_exam_prep') || c.effects.some((f) => (f.addTags ?? []).includes('civil_exam_prep'))))
console.log(`\n[Q1-①b] 生产 civil_exam_prep 的事件：${prepProducers.length} 枚`)
for (const e of prepProducers) console.log(`  ${e.id} age[${e.minAge},${e.maxAge}]`)

// —— Q2：从新池千局输出里取各段资产分位（脚本未分段打印，改由结局/等级侧面看）——
const simTxt = readFileSync('.r103/sim_new_1000.txt', 'utf8')
console.log(`\n[Q2] 新池千局资产行：`)
for (const line of simTxt.split(/\r?\n/)) {
  if (line.includes('资产分布') || line.includes('贫富差距') || line.includes('行动采纳率') || line.includes('行动总次数')) console.log('  ' + line.trim())
}
console.log(`\n[Q2] 等级分布行：`)
for (const line of simTxt.split(/\r?\n/)) if (line.includes('[等级分布]')) console.log('  ' + line.trim())