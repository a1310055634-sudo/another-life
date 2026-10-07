// 第 106 轮 A1 事实盘点：以代码现读为准，产出 README/SPEC 所需的一切计数。
// 本脚本只读，不写任何项目文件。
import { ALL_EVENTS } from '../src/data/events/index'
import { ENDINGS } from '../src/engine/outcomes'
import { ACHIEVEMENTS } from '../src/engine/achievements'
import { ACTION_DEFS } from '../src/data/actions'
import { BACKGROUNDS } from '../src/data/backgrounds'
import { TRAITS } from '../src/data/traits'
import { JOB_CATALOG } from '../src/data/careers'

const byCategory: Record<string, number> = {}
for (const e of ALL_EVENTS) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1

const achRarity: Record<string, number> = {}
for (const a of ACHIEVEMENTS) achRarity[a.rarity] = (achRarity[a.rarity] ?? 0) + 1

const choiceCount = ALL_EVENTS.reduce((s, e) => s + e.choices.length, 0)
const condKeys: Record<string, number> = {}
let gated = 0
for (const e of ALL_EVENTS) {
  if (!e.requires) continue
  gated++
  for (const k of Object.keys(e.requires)) condKeys[k] = (condKeys[k] ?? 0) + 1
}
const singleChoice = ALL_EVENTS.filter((e) => e.choices.length < 2)
const optDist: Record<string, number> = {}
for (const e of ALL_EVENTS) optDist[e.choices.length] = (optDist[e.choices.length] ?? 0) + 1
const onceEv = ALL_EVENTS.filter((e) => e.once).length
const cdEv = ALL_EVENTS.filter((e) => (e.cooldown ?? 0) > 0).length
const whitelist = ALL_EVENTS.filter((e) => e.singleChoiceOk).map((e) => e.id)

console.log(JSON.stringify({
  events: ALL_EVENTS.length,
  eventCategories: byCategory,
  choices: choiceCount,
  optionsPerEvent: optDist,
  onceEvents: onceEv,
  cooldownEvents: cdEv,
  gatedEvents: gated,
  conditionKeys: condKeys,
  singleChoiceEvents: singleChoice.map((e) => e.id),
  singleChoiceWhitelist: whitelist,
  endings: ENDINGS.length,
  endingIds: ENDINGS.map((e: any) => e.id),
  achievements: ACHIEVEMENTS.length,
  achRarity,
  actions: ACTION_DEFS.length,
  backgrounds: BACKGROUNDS.length,
  traits: TRAITS.length,
  careers: JOB_CATALOG.length,
}, null, 2))