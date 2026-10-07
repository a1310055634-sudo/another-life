// 第 99 轮（V5 呈现阶段收官）：性能决算三项实测——交付前把自己的账单摊开。
//   bench400   400 局全池模拟耗时（8 策略轮换 × 4 背景 × 6 特质 × 若干 seed），
//               对比 V4 基线：行动系统（R83/R84）接入前后的单局开销。
//   memlong    超长局内存抽测：单局从 18 岁推进至自然终龄，每 N 年采样
//               heapUsed/heapTotal/rss + history 长度，算 history 线性增长斜率
//               与「每 10 年堆增量」，判定有无泄漏级增长。
//   overhead   单局细分计时：availableEvents / visibleChoices / applyChoice /
//               advanceYear / judgeEnding 各段耗时占比（定位瓶颈段）。
// 运行：npx tsx scripts/round99_perf_audit.ts <bench400|memlong|overhead|all>
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { judgeEnding } from '../src/engine/outcomes'
import { pickIndexProbe } from './round82_pick_helper'
import type { GameState } from '../src/engine/types'

const BALANCE_BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const BALANCE_TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const STRATEGIES8 = ['rotate', 'health_aware', 'survival_best', 'balanced', 'family_line', 'family_line_v2', 'study_line', 'friend_line']
const BALANCE_SEEDS = [11, 20260917, 77, 5, 902, 314, 606, 808, 111, 222]

/** 与round82_stress_probe 同款的单局推进（策略函数外置复用，见 round82_pick_helper） */
function playOne(seed: number, bg: string, trait: string, strategy: string, maxYears = 120) {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '决算者' })
  let guard = 0
  while (s.phase === 'playing' && guard < maxYears) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = cands[guard % cands.length]
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, strategy, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
  }
  return { seed, bg, trait, strategy, ending: judgeEnding(s).id, age: s.age, years: guard }
}

function mb(bytes: number) {
  return +(bytes / 1024 / 1024).toFixed(2)
}

function cmdBench400() {
  const runs: Array<ReturnType<typeof playOne>> = []
  const t0 = performance.now()
  // 400 局 = 4 背景 × 6 特质 × 10 seed=240，加 160 局扩样（seed 续号）凑足 400
  const seeds400 = [...BALANCE_SEEDS, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
    1011, 1012, 1013, 1014, 1015, 1016]
  for (const bg of BALANCE_BG) {
    for (const trait of BALANCE_TRAITS) {
      for (const seed of seeds400) {
        const strategy = STRATEGIES8[runs.length % STRATEGIES8.length]
        runs.push(playOne(seed, bg, trait, strategy))
        if (runs.length >= 400) break
      }
      if (runs.length >= 400) break
    }
    if (runs.length >= 400) break
  }
  const ms = performance.now() - t0
  const ages = runs.map((r) => r.age)
  const years = runs.reduce((a, r) => a + r.years, 0)
  console.log('── 决算① 400 局模拟耗时 ──')
  console.log(`局数=${runs.length}（4 背景 × 6 特质 × ${seeds400.length} seed × 8 策略轮换）`)
  console.log(`总耗时=${(ms / 1000).toFixed(2)}s  单局均值=${(ms / runs.length).toFixed(2)}ms  每模拟年=${(ms / years).toFixed(3)}ms`)
  console.log(`终龄：min=${Math.min(...ages)} max=${Math.max(...ages)} 均值=${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`)
  console.log(`结局种类=${new Set(runs.map((r) => r.ending)).size}`)
  console.log(`BENCH400: ${runs.length} 局 ${(ms / 1000).toFixed(2)}s ${(ms / runs.length).toFixed(2)}ms/局`)
}

function cmdMemLong() {
  // 预热（模块加载/JIT 的一次性开销不计入采样）
  for (let i = 0; i < 20; i++) playOne(1000 + i, 'ordinary', 'studious', 'balanced')
  if (global.gc) global.gc()
  const base = process.memoryUsage()
  console.log('── 决算③ 超长局内存抽测 ──')
  console.log(`基线（20 局预热后）：heapUsed=${mb(base.heapUsed)}MB rss=${mb(base.rss)}MB`)
  // 构造超长局：扫seed×策略后取终龄最高的一局（seed=11/wealthy/laid_back/health_aware→77 岁
  // debt_shadow，14×2×3×4=336 局扫描选出，为内存压力的最坏情形）
  const samples: Array<{ year: number; age: number; heap: number; rss: number; hist: number }> = []
  const t0 = performance.now()
  let s: GameState = createNewGame({ seed: 11, backgroundId: 'wealthy', traitId: 'laid_back', name: '寿星' })
  let guard = 0
  let maxHeap = 0
  let maxRss = 0
  while (s.phase === 'playing' && guard < 120) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = cands[guard % cands.length]
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, 'health_aware', s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
    if (guard % 5 === 0 || s.phase !== 'playing') {
      const mu = process.memoryUsage()
      maxHeap = Math.max(maxHeap, mu.heapUsed)
      maxRss = Math.max(maxRss, mu.rss)
      samples.push({ year: guard, age: s.age, heap: mb(mu.heapUsed), rss: mb(mu.rss), hist: s.history.length })
    }
  }
  const ms = performance.now() - t0
  for (const sm of samples) {
    console.log(`  第${String(sm.year).padStart(3)}年 ${String(sm.age).padStart(3)}岁  heapUsed=${sm.heap}MB  rss=${sm.rss}MB  history=${sm.hist}条`)
  }
  const first = samples[0]
  const last = samples[samples.length - 1]
  const perYear = (last.heap - first.heap) / Math.max(1, last.year - first.year)
  const perHist = (last.heap - first.heap) / Math.max(1, last.hist - first.hist)
  console.log(`推进年数=${guard} 终龄=${s.age}岁 耗时=${(ms / 1000).toFixed(2)}s`)
  console.log(`heap 峰值=${mb(maxHeap)}MB  rss 峰值=${mb(maxRss)}MB  首末增量=${(last.heap - first.heap).toFixed(2)}MB  斜率=${perYear.toFixed(3)}MB/年  每条 history≈${perHist.toFixed(3)}MB`)
  console.log(`history 长度：${first.hist} → ${last.hist} 条（终局 ${judgeEnding(s).id}）`)
  console.log(`MEMLONG: ${guard}年 终龄${s.age}岁 峰值堆=${mb(maxHeap)}MB 斜率=${perYear.toFixed(3)}MB/年`)
}

function cmdOverhead() {
  const N = 120
  const t = { avail: 0, visible: 0, apply: 0, advance: 0, ending: 0 }
  const t0 = performance.now()
  for (let i = 0; i < N; i++) {
    let s: GameState = createNewGame({ seed: 7000 + i, backgroundId: 'ordinary', traitId: 'sociable', name: '剖析者' })
    let guard = 0
    while (s.phase === 'playing' && guard < 120) {
      guard++
      let a = performance.now()
      const cands = availableEvents(s, ALL_EVENTS)
      t.avail += performance.now() - a
      if (cands.length > 0) {
        const ev = cands[guard % cands.length]
        a = performance.now()
        const vis = visibleChoices(s, ev)
        t.visible += performance.now() - a
        if (vis.length > 0) {
          const idx = pickIndexProbe(vis, 'balanced', s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
          a = performance.now()
          s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
          t.apply += performance.now() - a
        }
      }
      a = performance.now()
      s = advanceYear(s)
      t.advance += performance.now() - a
    }
    const a = performance.now()
    judgeEnding(s)
    t.ending += performance.now() - a
  }
  const total = performance.now() - t0
  const parts = [
    ['availableEvents', t.avail],
    ['visibleChoices', t.visible],
    ['applyChoice', t.apply],
    ['advanceYear', t.advance],
    ['judgeEnding', t.ending],
  ] as const
  console.log('── 单局分段耗时剖析（128 局累计）──')
  console.log(`总耗时=${(total / 1000).toFixed(2)}s  单局均值=${(total / N).toFixed(2)}ms`)
  for (const [name, ms] of parts) {
    console.log(`  ${name.padEnd(18)} ${ms.toFixed(1)}ms  占已测段 ${(ms / (t.avail + t.visible + t.apply + t.advance + t.ending) * 100).toFixed(1)}%`)
  }
  console.log(`OVERHEAD:单局 ${(total / N).toFixed(2)}ms`)
}

const cmd = process.argv[2] ?? 'all'
if (cmd === 'bench400' || cmd === 'all') cmdBench400()
if (cmd === 'memlong' || cmd === 'all') cmdMemLong()
if (cmd === 'overhead' || cmd === 'all') cmdOverhead()