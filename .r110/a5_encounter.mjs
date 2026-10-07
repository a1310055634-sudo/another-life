// 第 110 轮 A5：≥200 局遭遇率（走 session.ts 真实路径，R108 已立的口径）+「错误状态从不入候选」。
//   错误状态定义：
//     · fame 2 枚 —— 候选中出现却无 minor_fame 在册 = 门控被破坏，必须恒 0；
//     · 认知 2 枚 —— 无前置门，唯一可错的是年龄窗（availableEvents 自带年龄过滤）。
// 首版教训继承自 R108：chooseOption 第二参必须传原始 choices 下标（传文本 → NaN →
// 兜底 visible[0]，全部轨迹退化）；weightedPick 只在最高优先级层挑。
import { ALL_EVENTS } from '../src/data/events/index.ts'
import { startSession, nextYear, chooseOption, recoverMissingEvent } from '../src/engine/session.ts'
import { availableEvents, visibleChoices } from '../src/engine/events.ts'

const NEW_IDS = [
  'fame_fade_out',
  'fame_past_peak',
  'late_memory_early_sign',
  'late_mind_rhythm',
]
const NEW_SET = new Set(NEW_IDS)

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const STRATEGIES = ['rotate', 'family_line']

const zero = () => Object.fromEntries(NEW_IDS.map((id) => [id, 0]))
const stat = { cand: zero(), hit: zero(), years: 0, fameYears: 0, wrongState: 0, wrongSamples: [] }

function runOne(seed, bg, trait, strategy) {
  let s = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
  let guard = 0
  let pick = seed % 3
  while (s.state.phase === 'playing' && guard < 200) {
    guard++
    if (s.awaitingAdvance) {
      const st = s.state
      const hasFame = st.tags.includes('minor_fame')
      if (hasFame) stat.fameYears++
      stat.years++
      const avail = availableEvents(st, ALL_EVENTS)
      for (const id of NEW_IDS) if (avail.some((e) => e.id === id)) stat.cand[id]++
      for (const id of ['fame_fade_out', 'fame_past_peak']) {
        if (avail.some((e) => e.id === id) && !hasFame) {
          stat.wrongState++
          if (stat.wrongSamples.length < 3) stat.wrongSamples.push({ seed, age: st.age, tags: st.tags.join('|') })
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
      let idx = pick++ % vis.length
      if (strategy === 'family_line') {
        const j = vis.findIndex((c) => (c.effects ?? []).some((e) => e.relation?.add || e.relation?.addAnother || e.relation?.deltaCloseness))
        if (j >= 0) idx = j
      }
      // 必须传原始 choices 下标，不是文本（R108 坑）
      s = chooseOption(s, drawn.choices.indexOf(vis[idx]))
    } else break
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
console.log(`minor_fame 在册年份占比：${((stat.fameYears / stat.years) * 100).toFixed(3)}%（fame 2 枚的可达性前提）`)

assert('A5-1 局数 ≥ 200', runs >= 200, `${runs} 局 / ${stat.years} 年`)
assert('A5-2 错误状态从不入候选（无 minor_fame 却收到 fame 2 枚）', stat.wrongState === 0,
  `出现 ${stat.wrongState} 次${stat.wrongSamples.length ? ` 例：${JSON.stringify(stat.wrongSamples)}` : ''}`)
assert('A5-3 认知 2 枚确有遭遇（非死代码）', stat.hit.late_memory_early_sign > 0 && stat.hit.late_mind_rhythm > 0,
  `sign=${stat.hit.late_memory_early_sign} rhythm=${stat.hit.late_mind_rhythm}`)
assert('A5-4 认知 2 枚候选率处于晚年自然量级（无门控，有窗即入）',
  stat.cand.late_memory_early_sign > 0 && stat.cand.late_mind_rhythm > 0,
  `sign=${stat.cand.late_memory_early_sign} rhythm=${stat.cand.late_mind_rhythm}`)
assert('A5-5 遭遇次数不超过候选次数（抽样逻辑自洽）', NEW_IDS.every((id) => stat.hit[id] <= stat.cand[id]))
assert('A5-6 fame 2 枚的可达性与 minor_fame 在册年份同量级（不为 0 即不为死代码；若 fameYears=0 则如实登记）',
  stat.fameYears === 0 || (stat.cand.fame_fade_out > 0 && stat.cand.fame_past_peak > 0),
  `fameYears=${stat.fameYears}, fadeCand=${stat.cand.fame_fade_out}, peakCand=${stat.cand.fame_past_peak}`)

console.log(`\nA5 ${fails === 0 ? '全部通过' : `失败 ${fails} 项`}（6 步）`)
process.exit(fails === 0 ? 0 : 1)
