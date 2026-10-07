// 第 27 轮《时代质感》抽样走查：
// 1) 三个新氛围事件的规格检查（窗口落段、极轻效果、≥2 选项、有冷却、无 singleChoiceOk）
// 2) 时代锚点覆盖统计（青年/中年/晚年三段都要有锚点事件）
// 3) 年代矛盾扫描：校园词/职场词等"人生阶段专属词"不得出现在不匹配的年龄窗
//    （允许出现在"当年/那年/想起"等回忆语境中）
// 全部通过退出码 0；发现硬性矛盾退出码 1。
import { ALL_EVENTS } from '../src/data/events/index.ts'

let hard = 0
const warn = []

// ── 1. 新氛围事件规格 ────────────────────────────────────────
const ATMOS = [
  { id: 'youth_livehouse', min: 18, max: 30 },
  { id: 'mid_nav_memory', min: 31, max: 50 },
  { id: 'late_group_rumor', min: 51, max: 77 },
]
for (const spec of ATMOS) {
  const e = ALL_EVENTS.find((x) => x.id === spec.id)
  if (!e) { console.log(`✗ 缺少氛围事件 ${spec.id}`); hard++; continue }
  const problems = []
  if (e.minAge < spec.min || e.maxAge > spec.max) problems.push('年龄窗越段')
  if (e.category !== 'life') problems.push('category 应为 life')
  if (!e.singleChoiceOk === false && e.singleChoiceOk) problems.push('不得使用 singleChoiceOk')
  if (!e.cooldown || e.cooldown <= 0) problems.push('氛围事件应有冷却')
  if (e.once) problems.push('氛围事件不应 once')
  if (e.choices.length < 2) problems.push('选项不足 2 个')
  for (const c of e.choices) {
    for (const f of c.effects ?? []) {
      if (f.money && Math.abs(f.money) > 300) problems.push(`金额 ${f.money} 超出极轻范围`)
      if (f.delta && Math.abs(f.delta) > 2) problems.push(`属性增量 ${f.delta} 超出极轻范围`)
      if (f.addSkill || f.startJob || f.loseJob || f.quitJob || f.retire || f.startEducation || f.quitEducation) {
        problems.push('出现了超出极轻的效果')
      }
    }
    if ((c.requires ?? null) !== null) problems.push('氛围事件不应有选项门槛')
  }
  if (problems.length) { console.log(`✗ ${spec.id}: ${problems.join('；')}`); hard++ }
  else console.log(`✓ ${spec.id} [${e.minAge}-${e.maxAge}] 规格 OK（极轻效果 ×${e.choices.length} 选项）`)
}

// ── 2. 锚点覆盖 ─────────────────────────────────────────────
const ERA_WORDS = [
  'App', 'APP', '群', '扫码', '二维码', '短视频', '直播', '外卖', '快递', '微信',
  '视频', '手机', '导航', '网课', '朋友圈', '接龙', '抢票', '租房软件', '购票软件',
  '招聘软件', '记账', '@所有人', '语音', '电子', '政务', '公众号', '购票 App', '转票',
]
const inBand = (e, lo, hi) => e.minAge >= lo && e.maxAge <= hi
const hasEra = (e) => {
  const blob = [e.title, e.text, ...e.choices.map((c) => `${c.text} ${c.summary ?? ''}`)].join('\n')
  return ERA_WORDS.some((w) => blob.includes(w))
}
const youthCov = ALL_EVENTS.filter((e) => inBand(e, 18, 30) && hasEra(e)).length
const midCov = ALL_EVENTS.filter((e) => inBand(e, 31, 50) && hasEra(e)).length
const lateCov = ALL_EVENTS.filter((e) => e.minAge >= 51 && hasEra(e)).length
console.log(`锚点覆盖：青年窗内 ${youthCov} 个 / 中年窗内 ${midCov} 个 / 晚年(minAge≥51) ${lateCov} 个`)
if (youthCov < 8 || midCov < 8 || lateCov < 8) { console.log('✗ 某段锚点覆盖不足'); hard++ }

// ── 3. 阶段专属词矛盾扫描 ────────────────────────────────────
// 校园词只属于青年窗；在更晚的窗口出现时，必须处于回忆语境（±30 字内有当年/那年/想起/记得/十八岁那年）
const CAMPUS_WORDS = ['辅导员', '绩点', '社团招新', '自习室', '晚自习', '军训']
const RECALL = /当年|那年|想起|记得|回忆|十八岁那/
for (const e of ALL_EVENTS) {
  if (e.minAge >= 40) {
    const blob = [e.title, e.text, ...e.choices.map((c) => `${c.text} ${c.summary ?? ''}`)].join('\n')
    for (const w of CAMPUS_WORDS) {
      let idx = blob.indexOf(w)
      while (idx !== -1) {
        const ctx = blob.slice(Math.max(0, idx - 30), idx + w.length + 30)
        if (!RECALL.test(ctx)) {
          warn.push(`${e.id} [${e.minAge}-${e.maxAge}] 含校园词「${w}」且非回忆语境：…${ctx}…`)
        }
        idx = blob.indexOf(w, idx + 1)
      }
    }
  }
}
// 晚年事件里不得以"正在上学/住宿舍"的现在时出现"宿舍/室友"（1960s 生人在 55 岁不上学）
for (const e of ALL_EVENTS) {
  if (e.minAge >= 51) {
    const blob = [e.text, ...e.choices.map((c) => `${c.text} ${c.summary ?? ''}`)].join('\n')
    for (const w of ['宿舍', '室友']) {
      let idx = blob.indexOf(w)
      while (idx !== -1) {
        const ctx = blob.slice(Math.max(0, idx - 30), idx + w.length + 30)
        if (!RECALL.test(ctx)) warn.push(`${e.id} [${e.minAge}-${e.maxAge}] 含「${w}」且非回忆语境：…${ctx}…`)
        idx = blob.indexOf(w, idx + 1)
      }
    }
  }
}

if (warn.length) {
  console.log(`\n⚠ 供人工复核的锚点位置（${warn.length} 处）：`)
  console.log(warn.map((w) => `  - ${w}`).join('\n'))
} else {
  console.log('矛盾扫描：0 处阶段专属词错位')
}

console.log(hard === 0 ? '\n[era_texture_check: PASS]' : `\n[era_texture_check: FAIL ×${hard}]`)
process.exit(hard === 0 ? 0 : 1)
