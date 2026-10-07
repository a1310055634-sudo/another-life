// 第 108 轮 A5：≥200 局遭遇率 + 「错误状态从不入候选」硬断言。
//
// 首版教训（本文件自身踩的坑，记在案）：用「造一个假状态 + 只按年龄 +1」的桩循环跑，
// 得到遭遇率全 0 的假红。根因是 weightedPick 先按 priority 过滤只保留最高优先级候选，
// 而桩状态从不让引擎结算事件、属性与关系，候选集与真实游玩完全不同——
// **遭遇率只能用 src/engine/session.ts 的真实路径测**（与 App 完全同路），
// 这与第 39 轮弃用旧模拟器的理由是同一条。
//
// 两个不可混淆的口径：
//   · 候选率 = 该年出现在 availableEvents 结果里的次数占比（门控是否正确）；
//   · 遭遇率 = 被 drawEvent 真正抽中的次数占比（是否抽得到）。
// 只报遭遇率会漏掉「门控写反了但恰好没抽中」的伪绿，故两条都统计，
// 并且单独统计「错误状态」——无配偶在册却收到事件① 的次数必须恒为 0。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { startSession, nextYear, chooseOption, recoverMissingEvent } from '../src/engine/session.ts'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events.ts'

const NEW_IDS = [
  'late_widow_first_year',
  'late_widow_social_rebuild',
  'late_widow_living_alone',
  'late_widow_new_mate_boundary',
]
const NEW_SET = new Set(NEW_IDS)

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
// 策略：与 round39_balance_sim 同名同义。family_line 是「见到婚恋机会就抓」的主动型，
// 用于给事件① 提供可达性；rotate 是中性轮换基线。两条都跑，分开报数。
const STRATEGIES = ['rotate', 'family_line']

const zero = () => Object.fromEntries(NEW_IDS.map((id) => [id, 0]))
const stat = { cand: zero(), hit: zero(), years: 0, wrongState: 0, wrongSamples: [], marriedYears: 0 }

function runOne(seed, bg, trait, strategy) {
  let s = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
  let guard = 0
  let pick = seed % 3
  while (s.state.phase === 'playing' && guard < 200) {
    guard++
    if (s.awaitingAdvance) {
      // 候选统计放在年结之前：此刻是引擎即将抽事件的真实状态
      const st = s.state
      if (st.relations.some((r) => r.kind === 'spouse' && r.alive)) stat.marriedYears++
      const avail = availableEvents(st, ALL_EVENTS)
      stat.years++
      for (const id of NEW_IDS) if (avail.some((e) => e.id === id)) stat.cand[id]++
      if (avail.some((e) => e.id === 'late_widow_first_year')) {
        if (!st.relations.some((r) => r.kind === 'spouse' && r.alive)) {
          stat.wrongState++
          if (stat.wrongSamples.length < 3) {
            stat.wrongSamples.push({ seed, age: st.age, tags: st.tags.join('|') })
          }
        }
      }
      s = nextYear(s, ALL_EVENTS)
    } else if (s.currentEvent) {
      const drawn = s.currentEvent
      if (NEW_SET.has(drawn.id)) stat.hit[drawn.id]++
      const vis = visibleChoices(s.state, drawn)
      if (vis.length === 0) {
        s = recoverMissingEvent(s, ALL_EVENTS)
        continue
      }
      let idx
      if (strategy === 'family_line') {
        // 主动型：优先选能带来/保住关系的选项
        idx = vis.findIndex((c) =>
          (c.effects ?? []).some((e) => e.relation?.add || e.relation?.addAnother || e.relation?.deltaCloseness),
        )
        if (idx < 0) idx = pick % vis.length
        else pick++
      } else {
        idx = pick++ % vis.length
      }
      // 注意：chooseOption 的第二参是**原始 choices 数组的下标**，不是选项文本。
      // 首版误传 vis[idx].text → 引擎取 event.choices[NaN] 得 undefined → 兜底到 visible[0]，
      // 全部运行退化成「永远选第一个可见选项」，轨迹与真实游玩完全不同，
      // 由此测出的候选数（552）与遭遇数（1）都是假的。故此处传下标。
      s = chooseOption(s, drawn.choices.indexOf(vis[idx]))
    } else {
      break
    }
  }
}

let runs = 0
for (const strategy of STRATEGIES) {
  for (const bg of BACKGROUNDS) {
    for (const trait of TRAITS) {
      for (let k = 0; k < 9; k++) {
        runOne(7000 + runs * 13, bg, trait, strategy)
        runs++
      }
    }
  }
}

let fails = 0
const assert = (name, cond, detail) => {
  if (!cond) fails++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log(`局数 ${runs}（${STRATEGIES.join(' + ')} × 4 背景 × 6 特质 × 9 seed），采样年份 ${stat.years}\n`)
console.log('事件\t候选次数\t候选率\t遭遇次数\t遭遇率')
for (const id of NEW_IDS) {
  console.log(
    `${id}\t${stat.cand[id]}\t${((stat.cand[id] / stat.years) * 100).toFixed(3)}%\t${stat.hit[id]}\t${((stat.hit[id] / stat.years) * 100).toFixed(3)}%`,
  )
}
const totalCand = NEW_IDS.reduce((s, id) => s + stat.cand[id], 0)
const totalHit = NEW_IDS.reduce((s, id) => s + stat.hit[id], 0)
console.log(`\n四枚合计：候选 ${totalCand}（${((totalCand / stat.years) * 100).toFixed(3)}%）／遭遇 ${totalHit}（${((totalHit / stat.years) * 100).toFixed(3)}%）`)
console.log(`在册配偶年份占比：${((stat.marriedYears / stat.years) * 100).toFixed(2)}%（事件① 的可达性前提）`)

assert('A5-1 局数 ≥ 200', runs >= 200, `${runs} 局 / ${stat.years} 年`)
assert('A5-2 错误状态从不入候选（无配偶却收到事件①）', stat.wrongState === 0,
  `出现 ${stat.wrongState} 次${stat.wrongSamples.length ? ` 例：${JSON.stringify(stat.wrongSamples)}` : ''}`)
assert('A5-3 事件① 确有遭遇（非死代码）', stat.hit.late_widow_first_year > 0, `${stat.hit.late_widow_first_year} 次`)
assert('A5-4 四枚合计遭遇 > 0（整条线非死代码）', totalHit > 0, `${totalHit} 次`)
assert('A5-5 四枚各自至少进入过一次候选', NEW_IDS.every((id) => stat.cand[id] > 0),
  NEW_IDS.map((id) => `${id}=${stat.cand[id]}`).join(' '))
assert('A5-7 遭遇次数不超过候选次数（抽样逻辑自洽）', NEW_IDS.every((id) => stat.hit[id] <= stat.cand[id]))
assert('A5-8 事件① 的遭遇率处于罕见量级（人生转折，非日常刷屏）', (() => {
  const r = stat.hit.late_widow_first_year / stat.years
  return r > 0 && r < 0.02
})(), `${((stat.hit.late_widow_first_year / stat.years) * 100).toFixed(3)}%`)

// A5-9（替代首版的 A5-6）：「四枚各自都被抽中过」是概率命题，不是代码性质——
// 事件② 的门控是 widowed 标记，而该标记只由事件①（once，56-65 窗口）写入，
// 故② 在 432 局里只有 5 个候选年份，抽中 0 次完全在随机涨落内。
// 真正该断言的是**可达性**：把事件① 结算完的状态直接喂进 availableEvents，
// 事件② 必须在场。这是确定性的，不依赖运气。
const widowState = (() => {
  const ev1 = ALL_EVENTS.find((e) => e.id === 'late_widow_first_year')
  const base = startSession({ seed: 424242, backgroundId: 'ordinary', traitId: 'sociable', name: '模拟者' }, ALL_EVENTS)
  const s0 = {
    ...base.state,
    age: 60,
    relations: [{ id: 'r_spouse', kind: 'spouse', name: '模拟者配偶', closeness: 70, alive: true }],
    tags: [...base.state.tags, 'married'],
  }
  return applyChoice(s0, ev1, 0).state
})()
const afterWidow = availableEvents(widowState, ALL_EVENTS)
assert('A5-9 事件② 经由事件① 的 widowed 标记确定性可达（非死代码）',
  afterWidow.some((e) => e.id === 'late_widow_social_rebuild'),
  `①结算后 widowed=${widowState.tags.includes('widowed')}，②在候选中=${afterWidow.some((e) => e.id === 'late_widow_social_rebuild')}`)
assert('A5-10 事件① 结算后 spouse 确已离册（重建线的前提成立）',
  !widowState.relations.some((r) => r.kind === 'spouse'))

console.log(`\nA5 ${fails === 0 ? '全部通过' : `失败 ${fails} 项`}（10 步）`)
process.exit(fails === 0 ? 0 : 1)
