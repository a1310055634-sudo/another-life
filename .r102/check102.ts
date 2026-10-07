// 第 102 轮自检：validateEvents + 文件级计数 + 热力图关键桶
import { ALL_EVENTS } from '../src/data/events'
import { validateEvents } from '../src/engine/validateEvents'
import { LATE_EVENTS } from '../src/data/events/late'
import { MIDLIFE_EVENTS } from '../src/data/events/midlife'
import { MARRIAGE_EVENTS } from '../src/data/events/marriage'
import { FRIEND_EVENTS } from '../src/data/events/friends'
import { PET_EVENTS } from '../src/data/events/pets'
import { PARENT_EVENTS } from '../src/data/events/parents'

console.log(`全池 ${ALL_EVENTS.length} 事件（基线 262，目标 282）\n`)
console.log('文件\t现值\t基线')
for (const [n, arr, base] of [
  ['marriage', MARRIAGE_EVENTS, 5],
  ['friends', FRIEND_EVENTS, 4],
  ['pets', PET_EVENTS, 4],
  ['parents', PARENT_EVENTS, 6],
  ['late', LATE_EVENTS, 43],
  ['midlife', MIDLIFE_EVENTS, 38],
] as const) {
  console.log(`${n}\t${arr.length}\t${base}`)
}

const issues = validateEvents(ALL_EVENTS)
console.log(`\nvalidateEvents：${issues.length} 条 issue`)
for (const i of issues.slice(0, 20)) console.log(`  ${i.eventId} / ${i.field} / ${i.problem}`)

// late.ts 6 类别约束
const cats = new Set(LATE_EVENTS.map((e) => e.category))
console.log(`\nlate.ts 类别数 = ${cats.size}（断言须恒为 6）：${[...cats].join(',')}`)
console.log(`late.ts 年龄窗越界：${LATE_EVENTS.filter((e) => e.minAge < 51 || e.maxAge > 78).map((e) => e.id).join(',') || '零'}`)
console.log(`midlife.ts 年龄窗越界：${MIDLIFE_EVENTS.filter((e) => e.minAge < 31 || e.maxAge > 50).map((e) => e.id).join(',') || '零'}`)

// 桶覆盖 / 专属
const B: Array<[string, number, number]> = [['18-25', 18, 25], ['26-35', 26, 35], ['36-45', 36, 45], ['46-55', 46, 55], ['56-65', 56, 65], ['66-77', 66, 77]]
console.log('\n桶\t覆盖\t专属\t（基线覆盖/专属）')
const BASE: Record<string, [number, number]> = {
  '18-25': [117, 6], '26-35': [193, 1], '36-45': [162, 0], '46-55': [140, 0], '56-65': [105, 1], '66-77': [84, 6],
}
for (const [label, lo, hi] of B) {
  const covering = ALL_EVENTS.filter((e) => e.maxAge >= lo && e.minAge <= hi)
  const exclusive = covering.filter((e) => e.minAge >= lo && e.maxAge <= hi)
  const b = BASE[label]
  console.log(`${label}\t${covering.length}\t${exclusive.length}\t（${b[0]}/${b[1]}）`)
}

// 新事件选项数与重名检查
const NEW = ['mar_money_talk', 'mar_new_year_side', 'mar_handwritten_letter', 'frd_generation_friend', 'frd_care_watch', 'pet_major_care', 'pet_family_dispute', 'par_remarry', 'par_roles_reverse', 'late_half_retire', 'late_chronic_routine', 'late_elevator_wait', 'late_repair_thing', 'late_peer_gap', 'late_hearing_aid', 'late_friend_funeral', 'late_kid_faraway', 'late_body_shake', 'mid_empty_day', 'mid_handover_year']
console.log(`\n新事件 ${NEW.length} 枚逐条（选项数 / 效果签名唯一性 / 单选禁用）：`)
for (const id of NEW) {
  const e = ALL_EVENTS.find((x) => x.id === id)
  if (!e) { console.log(`  ${id}\t缺失！`); continue }
  const sigs = e.choices.map((c) => JSON.stringify(c.effects ?? []))
  const uniq = new Set(sigs).size
  console.log(`  ${id}\t选项${e.choices.length}\t签名唯一${uniq}/${sigs.length}\tsingleChoiceOk=${e.singleChoiceOk === undefined ? '无' : '有'}`)
}
