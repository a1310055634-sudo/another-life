// 第 82 轮（V5）：stress 高段动力学治本探针。
// 四个子命令：
//   life18  --label=before|after  复刻 outcomes.test 的 18 局固定 seed 模拟（V1 基线池+轮换策略），
//                                 逐年记录压力轨迹/职业压力项/burnout，供逐局归因对照。
//   balance --label=before|after  240 局（4 背景×6 特质×10 seed，8 策略轮换）全池模拟，
//                                 统计峰值压力/≥80 占比/burnout 授予率/结局分布/终龄——A2 对照表。
//   compare18 before.json after.json      逐局位移表+首分歧年归因（断言恢复条件成立）。
//   compareBalance b.json a.json          A2 前后对照表（≥80 下降/burnout>3%/结局漂移 ±5pp）。
// 用法：npx tsx scripts/round82_stress_probe.ts <子命令> [...]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { jobStressPerYear } from '../src/data/careers'
import { RETIRE_AGE } from '../src/engine/career'
import { judgeEnding } from '../src/engine/outcomes'
import { validateState } from '../src/engine/validate'
import { isV2Strategy, pickV2 } from './strategy_v2'
import type { GameState, EventChoice } from '../src/engine/types'

const OUT_DIR = '.round82'
const BURNOUT_TAG = 'burnout'

// ── V1 基线池（与 src/engine/outcomes.test.ts 的 V2_NEW_EVENT_IDS 同步，R82 快照；
//    沿用 round39_balance_sim.ts 的独立副本先例——本表仅探针使用） ──
const V2_NEW_EVENT_IDS = [
  'hlt_drink_toast', 'hlt_desk_years', 'hlt_checkup_mild_flags', 'hlt_checkup_red_flags',
  'hlt_chronic_onset', 'rel_friend_checkin', 'rel_parent_greeting', 'rel_anniversary',
  'rel_parent_frail', 'fam_child_junior', 'fam_child_senior', 'fam_child_gaokao',
  'fam_child_first_job', 'fam_child_wedding', 'fam_grandchild',
  'youth_livehouse', 'mid_nav_memory', 'late_group_rumor',
  'mid_young_boss', 'mid_industry_collapse', 'mid_second_child', 'mid_sandwich',
  'mid_partner_career_gap', 'mid_friend_fallout', 'mid_budget_downgrade', 'mid_reunion_compare',
  'late_smartphone', 'late_friends_fade', 'late_will', 'late_late_companion',
  'late_grand_rules', 'late_farewell_preparation', 'late_volunteer_lead',
  'late_story_grandchild', 'late_senior_college',
  'rel_parent_critical', 'rel_parent_deathbed', 'rel_parent_funeral',
  'rel_parent_memorial', 'rel_parent_relics', 'rel_parent_last_one',
  'hlt_chronic_checkup', 'hlt_chronic_flare', 'fam_grandchild_time',
  'rel_old_flame', 'rel_colleague_crush', 'rel_hobby_club', 'rel_app_match',
  'late_morning_walk', 'late_teeth', 'late_old_letter', 'late_neighbor_watch',
  'late_cheap_eats', 'late_solo_birthday', 'late_balcony_plants', 'late_old_radio',
  'edu_exam_prep', 'edu_admit_master', 'edu_degree_payoff',
  'sib_loan', 'sib_venture', 'sib_care_split', 'sib_inheritance',
  'sib_fallout_reconcile', 'sib_reunion', 'sib_old_companion', 'sib_memorial',
  'frd_late_talk', 'frd_bestman', 'frd_cross_city', 'frd_quarrel_reconcile',
  'mar_seven_year', 'mar_cold_war', 'mar_distance', 'mar_repair_trip', 'mar_counseling',
  'mid_burnout_onset', 'mid_burnout_insomnia', 'mid_burnout_slump',
  'mid_burnout_therapy', 'mid_burnout_sabbatical', 'late_burnout_rekindle',
  'pet_vet_visit', 'pet_companion', 'pet_aging_care', 'pet_farewell_choice',
  'youth_takeout_shelf', 'mid_livestream_cart', 'mid_rideshare_story',
  'late_family_group_rumor', 'late_teach_ride_hailing', 'late_old_phone_decade',
  // 第 85 轮医疗与保险（V5；池 214→218）
  'ins_buy_young', 'ins_buy_mid', 'ins_declined', 'hlt_major_surgery',
  // 第 86 轮房产线（V5；池 218→220）
  'home_living', 'home_sell_forced',
  // 第 87 轮基金线（V5；池 220→223）
  'fin_fund_start', 'fin_fund_take_profit', 'fin_fund_cut_loss',
  // 第 88 轮体制内线（V5；池 223→228）
  'civ_exam_prep', 'civ_exam', 'civ_office_politics', 'civ_secondment', 'civ_ceiling',
  // 第 89 轮 35 岁危机（V5；池 228→233）
  'mc_layoff', 'mc_bench', 'mc_resume', 'mc_free_lance', 'mc_moat',
  // 第 90 轮城市迁移（V5；池 233→237）
  'city_graduate_run', 'city_drift_tired', 'city_province_hq', 'city_return_retire',
  // 第 91 轮婚恋多元化（V5；池 237→242）
  'div_sign_papers', 'div_single_life', 'div_remarry', 'fam_dink', 'life_childfree',
  // 第 92 轮留学与职校（V5；池 242→248）
  'ab_choice', 'ab_study', 'ab_job_hunt', 'ab_gap', 'voc_night_school', 'voc_craft_master',
  // 第 93 轮自媒体名声线（V5；池 248→253）
  'fame_start', 'fame_update', 'fame_viral', 'fame_cash', 'fame_hate',
  // 第 95 轮结局深化（V5；池 253→255）
  'yk_sudden', 'late_donation',
  // 第 112 轮死亡窄门（V7：lethal 事件直接致死引擎；池 290→292）。
  // 注：本副本自 R95 后未随 101 轮起的扩池更新（陈旧副本已登记 V7 R112 账本遗留，
  // 复用本探针前须先补齐 101–110 轮事件 id，否则 18 局对照会出现假位移）。
  'hlt_accident_blink', 'hlt_verge_fever',
  // 第 113 轮心理健康线（V7：low_mood 状态线 5 枚；池 292→297）
  'mood_low_tide', 'mood_self_care', 'mood_talk', 'mood_professional', 'mood_clear_sky',
  // 第 114 轮育儿参与线（V7：child_path 轻分化 4 枚；池 297→301）
  'par_interest_class', 'par_teen_door', 'par_form_night', 'par_path_visible',
  // 第 115 轮同事与邻里（V7：colleague/neighbor 新关系种类 8 枚；池 301→305）
  'wl_office_deskmate', 'wl_new_neighbor', 'wl_late_night', 'wl_one_seat',
  'wl_farewell_dinner', 'wl_hallway_chat', 'wl_renovation_noise', 'wl_good_neighbor',
  // 第 116 轮创业事件族（V7：entrepreneur 链 6 枚；池 309→315）
  'ven_quit_resign', 'ven_first_year', 'ven_first_profit', 'ven_scale_or_hold',
  'vent_close_day', 'vent_back_to_work',
  // 第 117 轮遗嘱与遗产分配（V7：will_done 链 3 枚；池 315→318）
  'late_will_split', 'late_will_amend', 'late_final_wish',
  // 第 118 轮年关系统（V7：离乡年关抉择层 3 枚；池 318→321）
  'ny_where', 'ny_questions', 'ny_stay_dinner',
  // 第 119 轮性格成长（V7：persona_shifted 轻机制 2 枚；池 321→323）
  'persona_shift_moment', 'persona_echo',
  // 第 120 轮养老方式线（V7：elder_* 三向 4 枚；池 323→327）
  'elder_how', 'elder_institution_life', 'elder_two_gen', 'elder_home_tweak',
  // 第 123 轮时代纵深 IV（V7：纯氛围 3 枚定向薄桶；池 327→330）
  'era4_jobs_dawn', 'era4_group_buy', 'era4_ny_delivery',
  // 第 124 轮事件池扩容（V7：新线联动 10+老线补密 9；池 330→349）
  'lk_spouse_venture', 'lk_venture_ny', 'lk_mood_work', 'par_kid_city', 'wl_col_fame',
  'will_sibling_table', 'elder_sibling_care', 'persona_after_close', 'ny_blood_child', 'nb_elder_help',
  'mar_money_style', 'mar_anniversary_upgrade', 'mar_double_shift',
  'frd_old_wall', 'frd_half_marathon', 'pet_vet_checkup', 'pet_rainy_walk',
  'par_parent_phone_fun', 'par_parent_reunion',
]
const V1_POOL = ALL_EVENTS.filter((e) => !V2_NEW_EVENT_IDS.includes(e.id))

// outcomes.test.ts 的 18 局开局表（6 开局 × 3 seed，与源文件逐字一致）
const LIFE18_STARTS = [
  { bg: 'ordinary', trait: 'studious' },
  { bg: 'rural', trait: 'ambitious' },
  { bg: 'wealthy', trait: 'sociable' },
  { bg: 'ordinary', trait: 'frugal' },
  { bg: 'single_parent', trait: 'studious' },
  { bg: 'rural', trait: 'frugal' },
]
const LIFE18_SEEDS = [11, 20260917, 77]

// 与 outcomes.test.ts playFullLife 同款轮换策略（V1 基线池）
function playLife18(seed: number, bg: string, trait: string) {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
  let guard = 0
  const years: Array<{ age: number; stressStart: number; careerKind: string; careerStress: number; stressEnd: number }> = []
  let maxStress = 0
  let yearsGE80 = 0
  let everBurnout = false
  while (s.phase === 'playing' && guard < 60) {
    guard++
    const stressStart = s.attrs.stress
    const cands = availableEvents(s, V1_POOL)
    if (cands.length > 0) {
      const chosen = cands[guard % cands.length]
      const vis = visibleChoices(s, chosen)
      if (vis.length > 0) {
        const choice = vis[(guard - 1) % vis.length]
        s = applyChoice(s, chosen, chosen.choices.indexOf(choice)).state
      }
    }
    // drift 时刻的职业语义：advanceYear 的 naturalAttrDrift 用「结算后」职业——
    // 事件改职（applyChoice 后）+ 到龄自动退休（employed 且本年年龄 ≥ RETIRE_AGE → retired）。
    // 首版探针记的是年初职业，把 65 岁退休年标成 employed，归因表因此误报「条件不成立」。
    const driftKind =
      s.career.kind === 'employed' && s.age + 1 >= RETIRE_AGE ? 'retired' : s.career.kind
    const careerStress =
      driftKind === 'employed' ? jobStressPerYear(s)
        : driftKind === 'student' ? 2
          : driftKind === 'unemployed' ? 4
            : driftKind === 'retired' ? -4
              : 1
    s = advanceYear(s)
    const issues = validateState(s).issues
    if (issues.length > 0) throw new Error(`${seed}/${bg}/${trait} 第 ${s.age} 岁状态非法: ${JSON.stringify(issues)}`)
    maxStress = Math.max(maxStress, s.attrs.stress)
    if (s.attrs.stress >= 80) yearsGE80++
    if (s.tags.includes(BURNOUT_TAG)) everBurnout = true
    years.push({ age: s.age, stressStart, careerKind: driftKind, careerStress, stressEnd: s.attrs.stress })
  }
  return {
    seed, bg, trait,
    ending: judgeEnding(s).id,
    age: s.age,
    money: s.money,
    achCount: s.achievements.length,
    maxStress, yearsGE80, everBurnout,
    years,
  }
}

// ── 240 局全池 balance 采样（8 策略按组合下标轮换，V4 新池口径的缩小版） ──
const BALANCE_BG = ['ordinary', 'wealthy', 'rural', 'single_parent']
const BALANCE_TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const BALANCE_SEEDS = [11, 20260917, 77, 5, 902, 314, 606, 808, 111, 222]
const STRATEGIES8 = ['rotate', 'health_aware', 'survival_best', 'balanced', 'family_line', 'family_line_v2', 'study_line', 'friend_line']

const ATTR_WEIGHT: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
function choiceScore(c: EventChoice): number {
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR_WEIGHT[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  for (const d of c.delayed ?? []) {
    const de = (d as { effect?: { attr?: string; delta?: number; money?: number } }).effect
    if (de?.attr && de.delta) score += de.delta * (ATTR_WEIGHT[de.attr] ?? 0) * 0.7
    if (de?.money) score += (de.money / 30000) * 0.7
  }
  return score
}
function pickIndex(vis: EventChoice[], strategy: string, health: number, money: number, turn: number, age = 30, smarts = 60, category?: string): number {
  if (isV2Strategy(strategy)) return pickV2(vis, strategy, { health, money, age, smarts, category })
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'health_aware' && health < 40) {
    let best = -1, bestGain = 0
    vis.forEach((c, i) => {
      const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
      if (g > bestGain) { bestGain = g; best = i }
    })
    if (best >= 0) return best
  }
  if (strategy === 'balanced') {
    if (money < 0) {
      let best = -1, bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.money && e.money > 0 ? s + e.money : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
    if (health < 45) {
      let best = -1, bestGain = 0
      vis.forEach((c, i) => {
        const g = c.effects.reduce((s, e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? s + (e.delta ?? 0) : s), 0)
        if (g > bestGain) { bestGain = g; best = i }
      })
      if (best >= 0) return best
    }
  }
  if (strategy === 'family_line' && category === 'relationship') return 0
  let best = 0, bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

function playBalance(seed: number, bg: string, trait: string, strategy: string) {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
  let guard = 0
  let maxStress = 0, yearsGE80 = 0, everBurnout = false
  while (s.phase === 'playing' && guard < 60) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      const ev = cands[guard % cands.length]
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        const idx = pickIndex(vis, strategy, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
    maxStress = Math.max(maxStress, s.attrs.stress)
    if (s.attrs.stress >= 80) yearsGE80++
    if (s.tags.includes(BURNOUT_TAG)) everBurnout = true
  }
  return { seed, bg, trait, strategy, ending: judgeEnding(s).id, age: s.age, money: s.money, maxStress, yearsGE80, everBurnout }
}

function summarizeBalance(runs: ReturnType<typeof playBalance>[]) {
  const n = runs.length
  const peaks = runs.map((r) => r.maxStress).sort((a, b) => a - b)
  const p = (q: number) => peaks[Math.min(peaks.length - 1, Math.floor(q * peaks.length))] ?? 0
  const endings = new Map<string, number>()
  for (const r of runs) endings.set(r.ending, (endings.get(r.ending) ?? 0) + 1)
  return {
    n,
    meanPeakStress: +(peaks.reduce((a, b) => a + b, 0) / n).toFixed(2),
    p50PeakStress: p(0.5),
    p90PeakStress: p(0.9),
    everGE80Rate: +(runs.filter((r) => r.maxStress >= 80).length / n * 100).toFixed(1),
    meanYearsGE80: +(runs.reduce((a, r) => a + r.yearsGE80, 0) / n).toFixed(2),
    burnoutRate: +(runs.filter((r) => r.everBurnout).length / n * 100).toFixed(1),
    meanAge: +(runs.reduce((a, r) => a + r.age, 0) / n).toFixed(1),
    meanMoney: Math.round(runs.reduce((a, r) => a + r.money, 0) / n),
    endingDist: Object.fromEntries([...endings.entries()].sort()),
  }
}

function argOf(prefix: string): string | null {
  const a = process.argv.find((x) => x.startsWith(prefix))
  return a ? a.slice(prefix.length) : null
}

const cmd = process.argv[2]
mkdirSync(OUT_DIR, { recursive: true })

if (cmd === 'life18') {
  const label = argOf('--label=') ?? 'run'
  const runs = []
  for (const start of LIFE18_STARTS) {
    for (const seed of LIFE18_SEEDS) {
      runs.push(playLife18(seed, start.bg, start.trait))
    }
  }
  const out = { label, capturedAt: new Date().toISOString(), runs }
  writeFileSync(join(OUT_DIR, `life18-${label}.json`), JSON.stringify(out, null, 1))
  console.log(`18 局（${label}）已写入 ${OUT_DIR}/life18-${label}.json`)
  for (const r of runs) {
    console.log(`${r.seed}/${r.bg}/${r.trait} → ${r.ending} ${r.age}岁 ¥${r.money} 峰值压力${r.maxStress} ≥80年${r.yearsGE80} burnout=${r.everBurnout ? 1 : 0}`)
  }
} else if (cmd === 'balance') {
  const label = argOf('--label=') ?? 'run'
  const runs = []
  for (let bi = 0; bi < BALANCE_BG.length; bi++) {
    for (let ti = 0; ti < BALANCE_TRAITS.length; ti++) {
      for (const seed of BALANCE_SEEDS) {
        runs.push(playBalance(seed, BALANCE_BG[bi], BALANCE_TRAITS[ti], STRATEGIES8[(bi * BALANCE_TRAITS.length + ti) % STRATEGIES8.length]))
      }
    }
  }
  const summary = summarizeBalance(runs)
  writeFileSync(join(OUT_DIR, `balance-${label}.json`), JSON.stringify({ label, capturedAt: new Date().toISOString(), summary, runs }, null, 1))
  console.log(`balance 240 局（${label}）→ ${OUT_DIR}/balance-${label}.json`)
  console.log(JSON.stringify(summary, null, 1))
} else if (cmd === 'compare18') {
  const before = JSON.parse(readFileSync(process.argv[3], 'utf8'))
  const after = JSON.parse(readFileSync(process.argv[4], 'utf8'))
  const key = (r: { seed: number; bg: string; trait: string }) => `${r.seed}/${r.bg}/${r.trait}`
  const bMap = new Map(before.runs.map((r: any) => [key(r), r]))
  let displaced = 0
  const rows: string[] = []
  for (const a of after.runs as any[]) {
    const b = bMap.get(key(a))
    if (!b) { rows.push(`${key(a)}: before 缺失`); continue }
    const same = b.ending === a.ending && b.age === a.age && b.money === a.money
    if (same) { rows.push(`${key(a)}: 零位移（${a.ending} ${a.age}岁）`); continue }
    displaced++
    // 首分歧年 = 逐年 stressEnd 序列第一个不同处
    let divIdx = -1
    const len = Math.min(b.years.length, a.years.length)
    for (let i = 0; i < len; i++) {
      if (b.years[i].stressEnd !== a.years[i].stressEnd) { divIdx = i; break }
    }
    let attribution = 'stress 序列无逐点分歧（clamp 收敛或结局层漂移）'
    if (divIdx >= 0) {
      const y = a.years[divIdx]
      const holds = y.careerStress <= 0 && y.stressStart > 55
      attribution = `首分歧 ${y.age} 岁（careerStress=${y.careerStress} stressStart=${y.stressStart} → 恢复条件${holds ? '成立' : '【不成立——须查明】'}，stress ${b.years[divIdx].stressEnd}→${y.stressEnd}）`
    }
    rows.push(`${key(a)}: ${b.ending}/${b.age}岁/¥${b.money} → ${a.ending}/${a.age}岁/¥${a.money} ｜ ${attribution}`)
  }
  console.log(`位移 ${displaced}/${after.runs.length} 局`)
  for (const r of rows) console.log(r)
} else if (cmd === 'compareBalance') {
  const before = JSON.parse(readFileSync(process.argv[3], 'utf8')).summary
  const after = JSON.parse(readFileSync(process.argv[4], 'utf8')).summary
  const row = (k: string, b: any, a: any, unit = '') => console.log(`${k}: ${b}${unit} → ${a}${unit}`)
  row('局数', before.n, after.n)
  row('峰值压力均值', before.meanPeakStress, after.meanPeakStress)
  row('峰值压力 p90', before.p90PeakStress, after.p90PeakStress)
  row('曾达 ≥80 占比', before.everGE80Rate, after.everGE80Rate, '%')
  row('人均 ≥80 年数', before.meanYearsGE80, after.meanYearsGE80)
  row('burnout 授予率', before.burnoutRate, after.burnoutRate, '%')
  row('平均终龄', before.meanAge, after.meanAge)
  const endings = new Set([...Object.keys(before.endingDist), ...Object.keys(after.endingDist)])
  console.log('结局分布（前后 → Δpp）:')
  for (const e of [...endings].sort()) {
    const b = ((before.endingDist[e] ?? 0) / before.n * 100)
    const a = ((after.endingDist[e] ?? 0) / after.n * 100)
    const flag = Math.abs(a - b) > 5 ? ' ←超 ±5pp' : ''
    console.log(`  ${e}: ${b.toFixed(1)}% → ${a.toFixed(1)}%（Δ${(a - b).toFixed(1)}pp）${flag}`)
  }
} else {
  console.log('用法: npx tsx scripts/round82_stress_probe.ts <life18|balance|compare18|compareBalance> [...]')
  process.exit(1)
}
