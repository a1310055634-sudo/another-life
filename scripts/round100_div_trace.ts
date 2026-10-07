// 第 100 轮诊断 XIII：破而后立链路逐局追踪——div_sign_papers 之后卡在哪一环。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import type { GameState } from '../src/engine/types'

const TARGETS = ['mar_seven_year', 'mar_cold_war', 'mar_distance', 'div_sign_papers', 'rel_old_flame', 'rel_colleague_crush', 'late_late_companion', 'div_remarry']
const KW: Record<string, string> = {
  mar_seven_year: '各忙各的',
  mar_cold_war: '谁先低头谁输',
  mar_distance: '接受外派',
  div_sign_papers: '签。好聚好散',
  rel_old_flame: '重新联系上',
  rel_colleague_crush: '约周末吃个饭',
  late_late_companion: '处处看吧',
  div_remarry: '领证。这次是真的',
}
const stageDone: Record<string, (s: GameState) => boolean> = {
  mar_seven_year: (s) => s.tags.includes('marriage_crisis'),
  mar_cold_war: (s) => s.tags.includes('marriage_crisis'),
  mar_distance: (s) => s.tags.includes('marriage_crisis'),
  div_sign_papers: (s) => s.tags.includes('divorced'),
  rel_old_flame: (s) => s.relations.some((r) => r.kind === 'partner' && r.alive),
  rel_colleague_crush: (s) => s.relations.some((r) => r.kind === 'partner' && r.alive),
  late_late_companion: (s) => s.relations.some((r) => r.kind === 'partner' && r.alive),
  div_remarry: (s) => s.tags.includes('married'),
}

function play(seed: number, bg: string, trait: string, base: string, verbose: boolean) {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '复婚者' })
  s = { ...s, age: 34, money: 100000 }
  const rng = mulberry32(seed ^ 0x100)
  let guard = 0
  const log: string[] = []
  while (s.phase === 'playing' && guard < 130) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    let ev: (typeof cands)[number] | undefined
    for (const id of TARGETS) {
      if (stageDone[id] && stageDone[id](s)) continue
      const hit = cands.find((e) => e.id === id)
      if (hit) { ev = hit; break }
    }
    ev = ev ?? weightedPick(cands, rng)
    const vis = visibleChoices(s, ev)
    if (vis.length > 0) {
      let idx = -1
      const kw = KW[ev.id]
      if (kw) { const i = vis.findIndex((c) => c.text.includes(kw)); if (i >= 0) idx = i }
      if (idx < 0) idx = pickIndexProbe(vis, base, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
      if (TARGETS.includes(ev.id)) {
        log.push('age' + s.age + ' ' + ev.id + '→「' + vis[idx].text + '」 married=' + s.tags.includes('married') + ' crisis=' + s.tags.includes('marriage_crisis') + ' divorced=' + s.tags.includes('divorced') + ' partner=' + s.relations.filter((r) => r.kind === 'partner').length + ' spouse=' + s.relations.filter((r) => r.kind === 'spouse').length)
      }
      s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
    }
    s = advanceYear(s)
  }
  if (verbose) {
    console.log('局 ' + seed + ' ' + bg + '/' + trait + '/' + base)
    for (const l of log) console.log('' + l)
    console.log('  终局: married=' + s.tags.includes('married') + ' divorced=' + s.tags.includes('divorced') + ' 关系=' + s.relations.map((r) => r.kind + (r.alive ? '' : '†')).join(',') + ' age=' + s.age)
    console.log('  seen: ' + s.seenEvents.filter((e) => TARGETS.includes(e)).join(', '))
  }
  return s
}

const BGS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const BASES = ['rotate', 'study_line', 'civ_line', 'balanced', 'survival_best', 'family_line_v2']
let n = 0
let hit = 0
const stats: Record<string, number> = {}
for (const bg of BGS) for (const tr of TRAITS) for (const sd of [11, 20260917, 77, 902]) {
  const base = BASES[n % BASES.length]
  const s = play(sd, bg, tr, base, n < 2)
  const ok = s.seenEvents.includes('div_sign_papers') && s.tags.includes('married') && s.relations.some((r) => r.kind === 'spouse' && r.alive)
  if (ok) hit++
  const key = (s.seenEvents.includes('div_remarry') ? '到过div_remarry ' : '') + (s.tags.includes('married') ? '终局已婚 ' : '') + 'partner' + s.relations.filter((r) => r.kind === 'partner').length + ' age' + s.age
  stats[key] = (stats[key] ?? 0) + 1
  n++
}
console.log('\n96 局终局态统计：')
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('  ' + v + '×  ' + k)
console.log('\n达成破而后立： ' + hit + '/96')