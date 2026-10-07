// 第100 轮诊断 X：零触发新成就的**子条件逐项拆解**——每局每步记录每个子条件
// 是否曾满足过（不只是终局），定位断点究竟卡在哪一环。
// 只读诊断，不改引擎/数据。
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import type { GameState } from '../src/engine/types'

const BASES = ['rotate', 'study_line', 'civ_line', 'balanced', 'survival_best', 'family_line_v2', 'health_aware', 'friend_line', 'family_line']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const BGS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const N = 400

/** 每个子条件：名字 → 判定函数（返回 true=本时刻满足） */
const CONDS: Record<string, (s: GameState) => boolean> = {
  'civil:tags有civil_servant': (s) => s.tags.includes('civil_servant'),
  'civil:workYears>=3': (s) => (s.workYears ?? 0) >= 3,
  'fame:tags有minor_fame': (s) => s.tags.includes('minor_fame'),
  'fame:money>=500000': (s) => s.money >= 500000,
  'fame:money>=200000': (s) => s.money >= 200000,
  'fame:money>=100000': (s) => s.money >= 100000,
  'divorce:seen过div_sign_papers': (s) => s.seenEvents.includes('div_sign_papers'),
  'divorce:tags曾有divorced': (s) => s.tags.includes('divorced'),
  'divorce:seen过div_remarry': (s) => s.seenEvents.includes('div_remarry'),
  'divorce:当前married': (s) => s.tags.includes('married'),
  'divorce:有在册配偶': (s) => s.relations.some((r) => r.kind === 'spouse' && r.alive),
  'divorce:married且有配偶': (s) => s.tags.includes('married') && s.relations.some((r) => r.kind === 'spouse' && r.alive),
  'abroad:曾有abroad_year': (s) => s.tags.includes('abroad_year'),
  'abroad:曾有studied_abroad': (s) => s.tags.includes('studied_abroad'),
  'abroad:seen过youth_study_abroad': (s) => s.seenEvents.includes('youth_study_abroad'),
  'abroad:seen过ab_choice': (s) => s.seenEvents.includes('ab_choice'),
  'abroad:seen过ab_study': (s) => s.seenEvents.includes('ab_study'),
  'abroad:edu=bachelor': (s) => s.education === 'bachelor',
  'abroad:edu∈[b,m,phd]': (s) => ['bachelor', 'master', 'phd'].includes(s.education),
  'abroad:edu∈[m,phd]': (s) => ['master', 'phd'].includes(s.education),
  'home:有房': (s) => s.home !== undefined,
  'home:mortgage_cleared': (s) => s.tags.includes('mortgage_cleared'),
  'home:有房且已还清': (s) => s.home !== undefined && s.tags.includes('mortgage_cleared'),
  'home:曾有homeowner': (s) => s.tags.includes('homeowner'),
  'home:曾背过房贷': (s) => s.tags.includes('homeowner') || s.tags.includes('mortgage_cleared'),
  'claim:seen过hlt_major_surgery': (s) => s.seenEvents.includes('hlt_major_surgery'),
  'claim:当前无insurance': (s) => !s.insurance,
  'claim:曾有insurance': (s) => s.insurance !== undefined || s.seenEvents.length > 0,
  'dink:tags有dink': (s) => s.tags.includes('dink'),
  'dink:终局无子女': (s) => !s.relations.some((r) => r.kind === 'child'),
}

const everHit = new Map<string, number>()     // 局内任一时刻满足过的局数
const endHit = new Map<string, number>()      // 终局仍满足的局数
const maxMoney = new Map<string, number>()
let n = 0

for (let bg_i = 0; bg_i < BGS.length; bg_i++) for (let t_i = 0; t_i < TRAITS.length; t_i++) for (let k = 0; k < 25; k++) {
  if (n >= N) break
  const seed = 90000 + n * 17
  const bg = BGS[n % 4]
  const trait = TRAITS[n % 6]
  const base = BASES[n % BASES.length]
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '拆解者' })
  const rng = mulberry32(seed ^ 0x100)
  const localEver = new Set<string>()
  let localMaxMoney = 0
  let guard = 0
  while (s.phase === 'playing' && guard < 130) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = weightedPick(cands, rng)
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndexProbe(vis, base, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
    localMaxMoney = Math.max(localMaxMoney, s.money)
    for (const [k2, fn] of Object.entries(CONDS)) if (fn(s)) localEver.add(k2)
  }
  for (const k2 of localEver) everHit.set(k2, (everHit.get(k2) ?? 0) + 1)
  for (const [k2, fn] of Object.entries(CONDS)) if (fn(s)) endHit.set(k2, (endHit.get(k2) ?? 0) + 1)
  maxMoney.set('', Math.max(maxMoney.get('') ?? 0, localMaxMoney))
  n++
}

console.log(`局数=${n}｜全局最高现金 = ${(maxMoney.get('') ?? 0).toLocaleString()}\n`)
console.log('子条件'.padEnd(32) + '局内曾满足   终局仍满足')
console.log('─'.repeat(60))
for (const [k] of Object.entries(CONDS)) {
  const e = everHit.get(k) ?? 0
  const d = endHit.get(k) ?? 0
  const bar = '█'.repeat(Math.round((e / n) * 30))
  console.log(`${k.padEnd(30)} ${String(e).padStart(4)}/${n} ${((e / n) * 100).toFixed(1).padStart(5)}%  ${String(d).padStart(4)}  ${bar}`)
}