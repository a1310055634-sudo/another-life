import { ALL_EVENTS } from '../src/data/events/index.ts'
import { ENDINGS } from '../src/engine/outcomes.ts'
import { ACHIEVEMENTS } from '../src/engine/achievements.ts'

const cats = new Map()
let choices = 0
for (const e of ALL_EVENTS) {
  cats.set(e.category, (cats.get(e.category) ?? 0) + 1)
  choices += e.choices.length
}
const zh = { relationship: '关系', life: '生活', career: '职业', health: '健康', money: '金钱', education: '教育' }
console.log('池:', ALL_EVENTS.length)
console.log('分类:', [...cats.entries()].map(([k, v]) => `${zh[k] ?? k} ${v}`).join(' / '))
console.log('选项总数:', choices)
console.log('结局:', ENDINGS.length)
console.log('成就:', ACHIEVEMENTS.length)
const rare = new Map()
for (const a of ACHIEVEMENTS) rare.set(a.rarity ?? 'none', (rare.get(a.rarity ?? 'none') ?? 0) + 1)
console.log('成就稀有度:', [...rare.entries()].map(([k, v]) => `${k} ${v}`).join(' / '))
