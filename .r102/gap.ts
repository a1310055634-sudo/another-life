// 第 102 轮 · 二次缺口扫描：late.ts（51–78 段）逐主题饱和度 + 逐岁覆盖
// 运行：npx tsx .r102/gap.ts
import { ALL_EVENTS } from '../src/data/events'

console.log('=== 逐岁覆盖（18–78）===')
const rows: string[] = []
for (let age = 18; age <= 78; age++) {
  const n = ALL_EVENTS.filter((e) => e.maxAge >= age && e.minAge <= age).length
  rows.push(`${age}:${n}`)
}
console.log(rows.join('  '))

console.log('\n=== late.ts 既有事件窗口分布（51–78 段专属盘点）===')
import { LATE_EVENTS } from '../src/data/events/late'
const byWin = new Map<string, string[]>()
for (const e of LATE_EVENTS) {
  const k = `[${e.minAge},${e.maxAge}]`
  if (!byWin.has(k)) byWin.set(k, [])
  byWin.get(k)!.push(e.id)
}
for (const k of [...byWin.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  console.log(`${k.padEnd(12)} ${byWin.get(k)!.join(', ')}`)
}

console.log('\n=== 二次缺口扫描：候选新主题在全池的命中数 ===')
const SCAN2: Record<string, string[]> = {
  丧偶: ['丧偶', '老伴去世', '先走', '鳏', '寡', '爱人去世', '配偶去世'],
  保健品理疗: ['保健品', '理疗', '按摩', '养生', '偏方', '疗程', '秘方', '神医'],
  养老同住安排: ['搬来同住', '同住', '养老院', '住一起', '接到城里', '照顾老人'],
  遗嘱公证: ['遗嘱', '公证', '继承', '身后事', '骨灰盒', '墓地'],
  白内障助听: ['白内障', '助听器', '老花镜', '听力', '耳背', '换晶状体'],
  老友离世: ['老友去世', '同学去世', '又少一个', '讣告', '灵堂'],
  '助人/被帮': ['帮扶', '资助', '低保', '救助站', '社区救助', '水滴筹'],
  记忆与认知: ['忘事', '记性', '认知', '阿尔茨海默', '失智', '痴呆'],
  交通与驾照: ['驾照', '年检', '车', '违章', '扣分', '驾'],
  房产与居住: ['回迁', '老房子', '拆迁', '物业费', '电梯', '贷款买房'],
  手足晚年: ['兄弟姐妹', '手足', '嫂子', '弟媳', '姐姐', '哥哥'],
  宗教与信仰: ['庙', '烧香', '祈祷', '信仰', '皈依', '观音'],
  慢性病自我管理: ['慢病', '糖尿病', '高血压', '吃药', '常年', '复诊'],
  丧事与白事: ['白事', '出殡', '守灵', '吊唁', '花圈'],
  婚姻晚年: ['老两口', '晚年夫妻', '一起走', '老伴', '老伴儿'],
}

for (const [theme, words] of Object.entries(SCAN2)) {
  const hits: string[] = []
  for (const e of ALL_EVENTS) {
    const hay = `${e.title}|${e.text}|${e.choices.map((c) => `${c.text}${c.summary ?? ''}${c.tooltip ?? ''}`).join('|')}`
    const matched = words.filter((w) => hay.includes(w))
    if (matched.length) hits.push(`${e.id}[${matched.join(',')}]`)
  }
  const mark = hits.length === 0 ? ' ★零命中' : hits.length <= 2 ? ' ○稀疏' : ''
  console.log(`\n【${theme}】命中 ${hits.length}${mark}：${hits.slice(0, 12).join('  ')}`)
}

console.log('\n=== 通用生活候选：midlife.ts 现有窗口 ===')
import { MIDLIFE_EVENTS } from '../src/data/events/midlife'
const mw = new Map<string, string[]>()
for (const e of MIDLIFE_EVENTS) {
  const k = `[${e.minAge},${e.maxAge}]`
  if (!mw.has(k)) mw.set(k, [])
  mw.get(k)!.push(e.id)
}
for (const k of [...mw.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  console.log(`${k.padEnd(12)} ${mw.get(k)!.join(', ')}`)
}
