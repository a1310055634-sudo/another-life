// 第 106 轮 A1 抽查：每 V5 机制抽 1 处「README/SPEC 文档描述 ↔ 代码实现」对照。
// 只读，逐项打印实测值，任何不符即 FAIL。
import { readFileSync } from 'node:fs'
import { STRESS_RECOVERY_FLOOR, STRESS_RECOVERY_RATE } from '../src/engine/lifecycle'
import { ACTION_DEFS } from '../src/data/actions'
import { REBATE_EMPLOYED, REBATE_RESIDENT, REBATE_RETIRED } from '../src/engine/insurance'
import { HOME_APPRECIATION } from '../src/engine/home'
import { CITY_SALARY, CITY_COST, CITY_HOME_RATE } from '../src/engine/city'
import { FAME_VIRAL_RATE, FAME_HATE_RATE } from '../src/engine/fame'
import { JOB_CATALOG } from '../src/data/careers'
import { BACKGROUNDS } from '../src/data/backgrounds'
import { TRAITS } from '../src/data/traits'
import { NORMS } from '../src/data/norms'

const read = (p) => readFileSync(p, 'utf8')
const checks = []
const ck = (name, doc, code, ok) => checks.push({ name, doc, code, ok })

// —— 机制逐项 ——
ck('压力恢复', 'STRESS_RECOVERY_FLOOR=55 / RATE=2', `${STRESS_RECOVERY_FLOOR}/${STRESS_RECOVERY_RATE}`,
  STRESS_RECOVERY_FLOOR === 55 && STRESS_RECOVERY_RATE === 2)
ck('主动行动', '6 个行动', `${ACTION_DEFS.length} 个`, ACTION_DEFS.length === 6)
ck('医保三档', '0.70/0.50/0.85', `${REBATE_EMPLOYED}/${REBATE_RESIDENT}/${REBATE_RETIRED}`,
  REBATE_EMPLOYED === 0.70 && REBATE_RESIDENT === 0.50 && REBATE_RETIRED === 0.85)
ck('房产复利', 'HOME_APPRECIATION=0.02', String(HOME_APPRECIATION), HOME_APPRECIATION === 0.02)
ck('城市薪资系数', '1.35/1.15/1.0', JSON.stringify(CITY_SALARY),
  CITY_SALARY.metro === 1.35 && CITY_SALARY.province === 1.15 && CITY_SALARY.hometown === 1)
ck('城市成本系数', '1.3/1.1/1.0', JSON.stringify(CITY_COST),
  CITY_COST.metro === 1.3 && CITY_COST.province === 1.1 && CITY_COST.hometown === 1)
ck('城市购房率', '3%/2%/1.2%', JSON.stringify(CITY_HOME_RATE),
  CITY_HOME_RATE.metro === 0.03 && CITY_HOME_RATE.province === 0.02 && CITY_HOME_RATE.hometown === 0.012)
ck('名声窗口', 'viral<0.35 / hate<0.25', `${FAME_VIRAL_RATE}/${FAME_HATE_RATE}`,
  FAME_VIRAL_RATE === 0.35 && FAME_HATE_RATE === 0.25)
ck('岗位数', '11 个岗位', `${JOB_CATALOG.length} 个`, JOB_CATALOG.length === 11)
ck('背景数', '4 个背景', `${BACKGROUNDS.length} 个`, BACKGROUNDS.length === 4)
ck('天赋数', '6 个天赋', `${TRAITS.length} 个`, TRAITS.length === 6)
ck('分位表样本', '1080 局', `${NORMS.sampleCount} 局`, NORMS.sampleCount === 1080)
ck('分位表四维', '现金/终龄/成就/幸福', Object.keys(NORMS).filter(k => k !== 'sampleCount' && k !== 'generatedAt').join(','),
  ['money', 'age', 'achievements', 'happinessAvg'].every(k => k in NORMS))

// —— 存储键：README 断言 6 个，逐个回查源码 ——
const saveSrc = read('src/engine/init.ts') + read('src/save/storage.ts')
const legacySrc = read('src/legacy.ts')
const soundSrc = read('src/sound.ts')
const ambSrc = read('src/ambient.ts')
const tutSrc = read('src/components/Tutorial.tsx')
const blSrc = read('src/engine/bloodline.ts')
for (const [k, label, src] of [
  ['another-life:save', '存档', saveSrc],
  ['another-life:legacy', '往生录', legacySrc],
  ['another-life:sound', '音效', soundSrc],
  ['another-life:ambient', '环境音', ambSrc],
  ['another-life:tutorial', '引导记忆', tutSrc],
  ['another-life:bloodline', '血脉', blSrc],
]) ck(`存储键 ${k}`, `README 列 ${label} 键`, src.includes(k) ? '源码含此键' : '★源码未找到', src.includes(k))

// —— 存档版本恒为 2 ——
ck('存档版本', 'SAVE_VERSION 恒为 2', (saveSrc.match(/SAVE_VERSION\s*=\s*(\d+)/) || [])[1] ?? '未找到',
  (saveSrc.match(/SAVE_VERSION\s*=\s*(\d+)/) || [])[1] === '2')

// —— GameState 无 bloodline 字段、无年份字段 ——
const typesSrc = read('src/engine/types.ts')
const gsBlock = typesSrc.slice(typesSrc.indexOf('export interface GameState'), typesSrc.indexOf('export interface GameState') + 4000)
ck('GameState 无 bloodline', '存档结构零改动', gsBlock.includes('bloodline') ? '★含 bloodline' : '不含（符合）', !gsBlock.includes('bloodline'))
const yearField = gsBlock.match(/^\s*(year|date|birthYear)\??:/m)
ck('GameState 无年份字段', '无日历年约束', yearField ? '★含 ' + yearField[1] : '不含（符合）', !yearField)

// —— 单选白名单唯一：全池扫 singleChoiceOk: true 的事件 id ——
const { readdirSync } = await import('node:fs')
const evDir = 'src/data/events'
const allSingle = []
for (const f of readdirSync(evDir)) {
  if (!f.endsWith('.ts') || f === 'index.ts') continue
  const s = read(`${evDir}/${f}`)
  const lines = s.split(/\r?\n/)
  let curId = null
  for (const ln of lines) {
    const m = ln.match(/^\s*id:\s*'([a-z0-9_]+)'/)
    if (m) { curId = m[1]; continue }
    if (/^\s*singleChoiceOk:\s*true/.test(ln) && curId) allSingle.push(curId)
  }
}
ck('单选白名单', '唯一 hlt_body_intensive', allSingle.length ? allSingle.join(',') : '（池内无标记）',
  allSingle.length === 1 && allSingle[0] === 'hlt_body_intensive')

// —— 输出 ——
let fail = 0
for (const c of checks) {
  if (!c.ok) fail++
  console.log(`${c.ok ? 'PASS' : 'FAIL'} | ${c.name} | 文档=${c.doc} | 代码=${c.code}`)
}
console.log(`\nA1 抽查：${checks.length - fail}/${checks.length} PASS`)
process.exit(fail ? 1 : 0)