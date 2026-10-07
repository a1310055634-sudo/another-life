// 第 39 轮全量平衡模拟（唯一数值轮）：300 局，全部走 src/engine/session.ts 真实游玩路径
// （startSession → drawEvent 加权抽事件 → chooseOption → nextYear，与 App 完全同路）。
// V1 旧模拟器（final_acceptance_sim）用确定性轮换取事件，绕过了引擎加权抽取，
// 会系统性低估链式内容（婚恋→生育→子女里程碑）的可达性——本轮弃用该取法。
//   A 段 120 局：4 背景 × 6 特质 × 5 seed，策略按组合下标轮换（rotate/health_aware/
//     survival_best/balanced）——总体分布概览；
//   B 段 120 局：同一批组合全部走 rotate（机器人轮换策略）——专项核查 V1 遗留
//     「机器人策略下债务结局占比 48% 偏高」在新机制下的现状；
//   C 段 60 局：随机策略（mulberry32 种子化，逐局可复现）——非策略性玩法样本。
// 统计：结局/等级分布、终龄分布、保底比例、V2 新事件触发率（38 个逐个）、
// 单选违规、once 违规、NaN/越界、卡死。运行：npx tsx scripts/round39_balance_sim.ts
import { startSession, chooseOption, nextYear, recoverMissingEvent } from '../src/engine/session'
import { availableEvents, visibleChoices } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { ACHIEVEMENTS } from '../src/engine/achievements'

/** 成就按 id 排序的快表（解锁率输出用） */
const ACHIEVEMENTS_SORTED = [...ACHIEVEMENTS].sort((a, b) => a.id.localeCompare(b.id))
import { judgeEnding, ENDINGS } from '../src/engine/outcomes'
import type { Session, } from '../src/engine/session'
import type { EventChoice, GameState } from '../src/engine/types'

const BACKGROUNDS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const SEEDS = [11, 20260917, 77, 5, 902, 314, 606, 808, 111, 222, 733, 909, 415, 626, 837]
const MAX_YEARS = 60
// 第 46 轮：+family_line——见到婚恋/家庭机会就抓的主动型（人类态度代理，第 58 轮千局主力）
const STRATEGIES = ['rotate', 'health_aware', 'survival_best', 'balanced', 'family_line'] as const
// 第 61 轮（V4）：策略池新旧开关。--pool=old（默认）= R58 原样（A 段轮换 5 旧策略、
// F 段 family_line），用于基线复现对照；--pool=new = A 段轮换 5 旧+3 新、F 段 family_line_v2。
// V2 策略实现在 ./strategy_v2.ts（含单测式自检，selfCheckV2 失败即 exit 1 不烧千局）。
import { isV2Strategy, pickV2, selfCheckV2 } from './strategy_v2'
// 第 103 轮（V5）：V3 策略实现在 ./strategy_v3.ts（career_civil / investor / action_balanced）。
// 同样含构造卡自检（selfCheckV3），失败即 exit 1 不烧千局。
import { isV3Strategy, pickActionForTurn, pickV3, selfCheckV3 } from './strategy_v3'
import { availableActions, performAction } from '../src/engine/actions'
const POOL = process.argv.includes('--pool=new') ? 'new' : 'old'
// 第 83 轮（V5）：--actions 开关——事件结算后、年结前插入一次主动行动（轮换选取）。
// 缺省关闭：不调 performAction 即逐位旧行为，保证与既有基线对照干净。
const ACTIONS_ON = process.argv.includes('--actions')
// 第 62 轮：--combos=N 抽测旗标——只取前 N 个组合（A/B/C 随之缩减，F 恒 100 局）。
// 第 103 轮：新池缺省 300（旧池缺省 360，两者皆可被 --combos=N 覆盖）。
//   配比口径（任务书）：新池 A300/B300/C120/F100/civil60/investor60/action60 = 1000。
const COMBOS_LIMIT = Number((process.argv.find((a) => a.startsWith('--combos=')) ?? '').split('=')[1] ?? '')
  || (POOL === 'new' ? 300 : 360)
// 第 103 轮（V5）：V3 三策略各自开一个专项段（各 60 局），与 G 段 civ_line 并列。
const V3_SEGMENT_SIZE = 60
const STRATEGIES_A: readonly string[] = POOL === 'new'
  ? [...STRATEGIES, 'family_line_v2', 'study_line', 'friend_line', 'civ_line']
  : STRATEGIES
const STRATEGY_F = POOL === 'new' ? 'family_line_v2' : 'family_line'

const ATTR_WEIGHT: Record<string, number> = {
  health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2,
}

/** V2/V3 新事件（与 outcomes.test V2_NEW_EVENT_IDS 同源，逐个报告触发率） */
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
  // 第 42 轮父母去世事件线
  'rel_parent_critical', 'rel_parent_deathbed', 'rel_parent_funeral',
  'rel_parent_memorial', 'rel_parent_relics', 'rel_parent_last_one',
  // 第 43 轮慢性病长期线
  'hlt_chronic_checkup', 'hlt_chronic_flare',
  // 第 44 轮关系真实化
  'fam_grandchild_time',
  // 第 46 轮婚恋入口扩展
  'rel_old_flame', 'rel_colleague_crush', 'rel_hobby_club', 'rel_app_match',
  // 第 47 轮年龄热力补密
  'late_morning_walk', 'late_teeth', 'late_old_letter', 'late_neighbor_watch',
  'late_cheap_eats', 'late_solo_birthday', 'late_balcony_plants', 'late_old_radio',
  // 第 63 轮教育纵深（在职深造链）
  'edu_exam_prep', 'edu_admit_master', 'edu_degree_payoff',
  // 第 65 轮手足事件线
  'sib_loan', 'sib_venture', 'sib_care_split', 'sib_inheritance',
  'sib_fallout_reconcile', 'sib_reunion', 'sib_old_companion', 'sib_memorial',
  // 第 66 轮挚友线
  'frd_late_talk', 'frd_bestman', 'frd_cross_city', 'frd_quarrel_reconcile',
  // 第 67 轮婚姻深水区
  'mar_seven_year', 'mar_cold_war', 'mar_distance', 'mar_repair_trip', 'mar_counseling',
  // 第 68 轮倦怠与心理韧性线
  'mid_burnout_onset', 'mid_burnout_insomnia', 'mid_burnout_slump',
  'mid_burnout_therapy', 'mid_burnout_sabbatical', 'late_burnout_rekindle',
  // 第 69 轮宠物真实化
  'pet_vet_visit', 'pet_companion', 'pet_aging_care', 'pet_farewell_choice',
  // 第 70 轮时代纵深 II（纯氛围）
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
  // 第 112 轮死亡窄门（V7：lethal 事件直接致死引擎；池 290→292）
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
  // 第 101 轮时代纵深 III 纯氛围 7 枚（V5；池 255→262；定向补 66-77 与 40-50 薄桶）
  'late_taoli_chair', 'late_care_home_visit', 'late_digital_nomad', 'late_silver_rework',
  'mid_exam_anchor_wait', 'mid_livestream_works', 'mid_gig_and_downsizing',
  // 第 102 轮事件池扩容收尾 · 薄处补密 20 枚（V5；池 262→282；定向补 46-55/56-65/66-77 薄桶专属位）
  'mar_money_talk', 'mar_new_year_side', 'mar_handwritten_letter',
  'frd_generation_friend', 'frd_care_watch',
  'pet_major_care', 'pet_family_dispute',
  'par_remarry', 'par_roles_reverse',
  'late_half_retire', 'late_chronic_routine', 'late_elevator_wait', 'late_repair_thing',
  'late_peer_gap', 'late_hearing_aid', 'late_friend_funeral', 'late_kid_faraway', 'late_body_shake',
  'mid_empty_day', 'mid_handover_year',
  // 第 108 轮晚年丧偶与独居重建线 4 枚（V6；池 282→286；定向补 56-65 / 66-77 最薄桶）
  'late_widow_first_year', 'late_widow_social_rebuild',
  'late_widow_living_alone', 'late_widow_new_mate_boundary',
  // 第 110 轮名声消退向 2 枚 + 记忆认知 2 枚（V6；池 286→290；名声落 36-45/46-55 覆盖，认知落 56-65/66-77）
  'fame_fade_out', 'fame_past_peak',
  'late_memory_early_sign', 'late_mind_rhythm',
]

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

function bestGainIdx(vis: EventChoice[], test: (e: { attr?: string; delta?: number; money?: number }) => number): number {
  let best = -1
  let bestGain = 0
  vis.forEach((c, i) => {
    const g = c.effects.reduce((s, e) => s + test(e), 0)
    if (g > bestGain) { bestGain = g; best = i }
  })
  return best
}

/** mulberry32 种子化随机（C 段随机策略与同局 once 判重共用） */
function lcg(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickIndex(
  vis: EventChoice[], strategy: string, health: number, money: number, turn: number, rnd: () => number,
  category?: string, age = 30, smarts = 60, tags: string[] = [],
): number {
  // 第 61 轮（V4）：V2 策略（family_line_v2/study_line/friend_line）委托共享实现
  if (isV2Strategy(strategy)) return pickV2(vis, strategy, { health, money, age, smarts, category })
  // 第 103 轮（V5）：V3 策略（career_civil/investor/action_balanced）委托 strategy_v3。
  // 传 tags 供 career_civil 判定体制内语境（civil_servant 门控）。
  if (isV3Strategy(strategy)) return pickV3(vis, strategy, { health, money, age, smarts, category, tags })
  if (strategy === 'rotate') return turn % vis.length
  if (strategy === 'random') return Math.floor(rnd() * vis.length) % vis.length
  if (strategy === 'health_aware' && health < 40) {
    const h = bestGainIdx(vis, (e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0))
    if (h >= 0) return h
  }
  if (strategy === 'balanced') {
    if (money < 0) {
      const m = bestGainIdx(vis, (e) => (e.money && e.money > 0 ? e.money : 0))
      if (m >= 0) return m
    }
    if (health < 45) {
      const h = bestGainIdx(vis, (e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0))
      if (h >= 0) return h
    }
  }
  // 第 46 轮家庭线策略（供千局）：见到婚恋/家庭机会就抓——relationship 类事件选
  // 第一个可见选项（全部入口/维护事件的「接受向」选项都在首位），其余走综合评分。
  // 人类「主动选择」的代理下界：比 rotate 盲转更接近真实玩家对婚恋机会的态度。
  if (strategy === 'family_line' && category === 'relationship') return 0
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

interface YearRecord { eventId: string; visible: number; singleChoice: boolean }

/** 真实路径整局推进：事件卡 → 选策略项 → 进入下一年，与 App/浏览器自动化同构 */
function playFullLife(
  seed: number, bg: string, trait: string, strategy: string,
): {
  state: GameState
  years: YearRecord[]
  fallbacks: number
  drawn: Set<string>
  stuck: boolean
} {
  let s: Session = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
  const years: YearRecord[] = []
  const drawn = new Set<string>()
  let fallbacks = 0
  let guard = 0
  const rnd = lcg(seed * 7919 + 13)
  // session 语义：nextYear 后 currentEvent 恒非空（引擎保底事件），故循环只有两态——
  // awaitingAdvance（进下一年）/ currentEvent（选策略项）；先判 awaitingAdvance
  // 再判 currentEvent（chooseOption 后事件驻留），否则重复结算死循环。
  while (s.state.phase === 'playing' && guard < 200) {
    guard++
    if (s.awaitingAdvance) {
      // 第 83 轮（V5）：--actions 时在年结前插入主动行动（每年至多 1 项由引擎闸保证）
      // 第 103 轮：action_balanced **策略自带行动策略**——即使 --actions 关闭也行动，
      // 使「行动系统的千局影响」可在不加全局混淆项的前提下单独测出；
      // 行动选取统一走 pickActionForTurn（非 V3 策略在 --actions 下沿用 R83 取模口径）。
      if (ACTIONS_ON || strategy === 'action_balanced') {
        const availIds = availableActions(s.state).map((a) => a.id)
        const pickedId = pickActionForTurn(availIds, guard, strategy)
        if (pickedId) {
          s = { ...s, state: performAction(s.state, pickedId).state }
        }
      }
      s = nextYear(s, ALL_EVENTS)
    } else if (s.currentEvent) {
      const vis = visibleChoices(s.state, s.currentEvent)
      if (vis.length === 0) {
        // 保底事件可见选项为空（理论不达）——走「跳过这一年」路径并记保底
        fallbacks++
        s = recoverMissingEvent(s, ALL_EVENTS)
        continue
      }
      // 求婚资格年计数：partner 在场且 rel_propose 入候选的年份（链路可达性分母）
      if (
        s.state.relations.some((r) => r.kind === 'partner' && r.alive) &&
        availableEvents(s.state, ALL_EVENTS).some((e) => e.id === 'rel_propose')
      ) {
        proposeEligibleYears++
      }
      drawn.add(s.currentEvent.id)
      const single = vis.length < 2 && !s.currentEvent.singleChoiceOk
      years.push({ eventId: s.currentEvent.id, visible: vis.length, singleChoice: single })
      const idx = pickIndex(vis, strategy, s.state.attrs.health, s.state.money, guard, rnd, s.currentEvent.category, s.state.age, s.state.attrs.smarts, s.state.tags)
      s = chooseOption(s, s.currentEvent.choices.indexOf(vis[idx]))
    } else {
      break
    }
  }
  const stuck = s.state.phase === 'playing'
  return { state: s.state, years, fallbacks, drawn, stuck }
}

interface RunResult {
  seg: string
  ending: string
  grade: string
  age: number
  years: YearRecord[]
  fallbacks: number
  drawn: Set<string>
  stuck: boolean
  bad: string[]
  married: boolean
  childCount: number
  mortgageEver: boolean
  /** 第 58 轮：终局完整状态（成就解锁率/送别覆盖/慢病覆盖统计用） */
  state: import('../src/engine/types').GameState
}

function runOne(seg: string, seed: number, bg: string, trait: string, strategy: string): RunResult {
  const { state: s, years, fallbacks, drawn, stuck } = playFullLife(seed, bg, trait, strategy)
  const e = judgeEnding(s)
  const bad: string[] = []
  for (const [k, v] of Object.entries(s.attrs)) {
    if (!Number.isFinite(v) || v < 0 || v > 100) bad.push(`属性 ${k}=${v}`)
  }
  if (!Number.isFinite(s.money) || Math.abs(s.money) > 2_000_000_000) bad.push(`money=${s.money}`)
  if (!Number.isFinite(s.healthRisk ?? 0) || (s.healthRisk ?? 0) < 0 || (s.healthRisk ?? 0) > 100) bad.push(`healthRisk=${s.healthRisk}`)
  if (s.mortgage && (!Number.isFinite(s.mortgage.balance) || s.mortgage.balance < 0)) bad.push(`mortgage.balance=${s.mortgage.balance}`)
  if (s.snapshots.some((x) => !Number.isFinite(x.money))) bad.push('snapshot money 非有限')
  if (s.age > 77) bad.push(`age=${s.age} 超终局年龄`)
  return {
    seg, ending: e.id, grade: e.grade, age: s.age, years, fallbacks, drawn, stuck, bad,
    married: s.tags.includes('married'),
    childCount: s.relations.filter((r) => r.kind === 'child').length,
    mortgageEver: s.history.some((h) => h.title.includes('房贷')),
    state: s,
  }
}

const allRuns: RunResult[] = []
let proposeEligibleYears = 0
const combos: Array<{ bg: string; trait: string; seed: number }> = []
for (const bg of BACKGROUNDS) {
  for (const trait of TRAITS) {
    for (const seed of SEEDS) combos.push({ bg, trait, seed })
  }
}
if (Number.isFinite(COMBOS_LIMIT) && COMBOS_LIMIT < combos.length) combos.length = COMBOS_LIMIT

combos.forEach((c, i) => {
  allRuns.push(runOne('A', c.seed, c.bg, c.trait, STRATEGIES_A[i % STRATEGIES_A.length]))
})
for (const c of combos) {
  allRuns.push(runOne('B', c.seed, c.bg, c.trait, 'rotate'))
}
for (const c of combos) {
  // 第 103 轮：新池 C 段按 i%5<2 取 120 局（任务书配比 C120）；旧池沿用 bg+trait 奇偶口径，
  // 该分支逐字保留以保证 A4「旧池复跑漂移 ≤±2%」有干净的对照基线。
  const take = POOL === 'new'
    ? combos.indexOf(c) % 5 < 2
    : (BACKGROUNDS.indexOf(c.bg) + TRAITS.indexOf(c.trait)) % 2 === 0
  if (take) allRuns.push(runOne('C', c.seed, c.bg, c.trait, 'random'))
}
// 第 58 轮 F 段：family_line 专项（婚恋/家庭链与家庭向事件的策略代理样本）
// 第 61 轮：--pool=new 时 F 段改用 family_line_v2（健康选优+虚弱不硬扛）
for (const c of combos.slice(0, 100)) {
  allRuns.push(runOne('F', c.seed, c.bg, c.trait, STRATEGY_F))
}
// 第 88 轮 G 段：civ_line 专项（考公路线的策略代理样本——备考/考试/体制内生涯；
// 全池池局里 civ 稀疏[教育投入被评分策略回避]，专项段使上岸率可测）
for (const c of combos.slice(0, 60)) {
  allRuns.push(runOne('G', c.seed, c.bg, c.trait, 'civ_line'))
}
// 第 103 轮（V5）：V3 三策略各开一个专项段（各 60 局）。
// H=career_civil（考公链+体制内，修正 civ_line 的备考标记死分支）
// I=investor（定投/止盈/购房/投保，稀疏钩子的专项代理）
// J=action_balanced（策略自带行动轮换，验证行动系统的千局影响）
// 仅 --pool=new 时存在；旧池段结构逐条不变（A4 对照干净的前提）。
if (POOL === 'new') {
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('H', c.seed, c.bg, c.trait, 'career_civil'))
  }
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('I', c.seed, c.bg, c.trait, 'investor'))
  }
  for (const c of combos.slice(0, V3_SEGMENT_SIZE)) {
    allRuns.push(runOne('J', c.seed, c.bg, c.trait, 'action_balanced'))
  }
}

function dist(counter: Map<string, number>): string {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')
}

const endingsAll = new Map<string, number>()
const endingsB = new Map<string, number>()
const gradesAll = new Map<string, number>()
const agesAll: number[] = []
let totalDraws = 0
let totalFallbacks = 0
const singleChoices = new Map<string, number>()
const onceViolations: string[] = []
const stuckRuns: string[] = []
const badRuns: string[] = []
const v2TriggerRuns = new Map<string, number>()
const v2DrawTotals = new Map<string, number>()
const poolOnce = new Set(ALL_EVENTS.filter((ev) => ev.once).map((ev) => ev.id))
let marriedRuns = 0
let withChildRuns = 0
let mortgageRuns = 0

for (const r of allRuns) {
  endingsAll.set(r.ending, (endingsAll.get(r.ending) ?? 0) + 1)
  gradesAll.set(r.grade, (gradesAll.get(r.grade) ?? 0) + 1)
  agesAll.push(r.age)
  totalDraws += r.years.length
  totalFallbacks += r.fallbacks
  if (r.stuck) stuckRuns.push(`${r.seg} ${r.ending}/${r.age}`)
  if (r.bad.length > 0) badRuns.push(`${r.seg}: ${r.bad.join('；')}`)
  if (r.seg === 'B') endingsB.set(r.ending, (endingsB.get(r.ending) ?? 0) + 1)
  if (r.married) marriedRuns++
  if (r.childCount > 0) withChildRuns++
  if (r.mortgageEver) mortgageRuns++
  for (const y of r.years) {
    if (y.singleChoice) singleChoices.set(y.eventId, (singleChoices.get(y.eventId) ?? 0) + 1)
  }
  for (const id of r.drawn) {
    v2DrawTotals.set(id, (v2DrawTotals.get(id) ?? 0) + 1)
    if (V2_NEW_EVENT_IDS.includes(id)) {
      v2TriggerRuns.set(id, (v2TriggerRuns.get(id) ?? 0) + 1)
    }
    if (poolOnce.has(id)) {
      // once 违规：同局同 once 事件出现两条以上履历
      const n = r.years.filter((y) => y.eventId === id).length
      if (n > 1) onceViolations.push(`${id} 同局×${n}（${r.seg} s${r.age}）`)
    }
  }
}

selfCheckV2()
// 第 103 轮：V3 构造卡自检（新池才跑——旧池不使用 V3 策略，自检无意义）
if (POOL === 'new') selfCheckV3()
const segCount = (seg: string) => allRuns.filter((r) => r.seg === seg).length
console.log(`=== 第 103 轮千局平衡模拟（池=${POOL}）：${allRuns.length} 局（session 真实路径；A 轮换 ${combos.length}×${STRATEGIES_A.length} 策略 / B rotate ${segCount('B')} / C random ${segCount('C')} / F ${STRATEGY_F} ${segCount('F')} / G civ_line ${segCount('G')}${POOL === 'new' ? ` / H career_civil ${segCount('H')} / I investor ${segCount('I')} / J action_balanced ${segCount('J')}` : ''}）===`)
console.log(`\n[结局分布·全部] ${dist(endingsAll)}`)
console.log(`[等级分布] ${[...gradesAll.entries()].sort().map(([k, v]) => `${k}×${v}`).join(' ')}`)
console.log(`[终龄] min=${Math.min(...agesAll)} max=${Math.max(...agesAll)} 平均=${(agesAll.reduce((a, b) => a + b, 0) / agesAll.length).toFixed(1)}`)
console.log(`[保底] 事件抽取 ${totalDraws} 次，保底 ${totalFallbacks} 次（${((totalFallbacks / totalDraws) * 100).toFixed(1)}%）`)
console.log(`[人生结构] 结婚率 ${(marriedRuns / allRuns.length * 100).toFixed(1)}% · 有娃率 ${(withChildRuns / allRuns.length * 100).toFixed(1)}% · 房贷经历率 ${(mortgageRuns / allRuns.length * 100).toFixed(1)}%`)
console.log(`\n[B 段·机器人策略结局分布] ${dist(endingsB)}`)
const debtB = endingsB.get('debt_shadow') ?? 0
console.log(`[B 段债务结局占比] ${(debtB / combos.length * 100).toFixed(1)}%（V1 遗留基准 48%）`)

// 第 103 轮（A3）：V5 新基线观察清单——任务书要求的 8 项率 + 资产分布 + 行动采纳。
// 与 R104 终校的「合理带」逐项对照；本表即 A3 交付物，也是 R104 的对照基准。
{
  const n = allRuns.length
  const pct = (k: number) => `${(k / n * 100).toFixed(1)}%`
  const tagRate = (t: string) => allRuns.filter((r) => r.state.tags.includes(t)).length
  const civilRuns = allRuns.filter((r) => r.state.tags.includes('civil_servant')).length
  const fundRuns = allRuns.filter((r) => r.state.fund !== undefined).length
  const homeRuns = allRuns.filter((r) => r.state.tags.includes('homeowner')).length
  const divorceRuns = allRuns.filter((r) => r.state.tags.includes('divorced')).length
  const abroadRuns = allRuns.filter((r) => r.state.tags.includes('overseas_bond') || r.state.tags.includes('studied_abroad')).length
  // 第 104 轮订正第二处量测 bug：原判据 `t.startsWith('fame_')` **匹配不到 `minor_fame`**
  // （minor_fame 不以 fame_ 开头），而 minor_fame 才是 fame.ts 的入场标记 →
  // 千局实测 minor_fame 有 9 局却被记成走红率 0.0%。
  // 正口径＝fame 标记全集：minor_fame ∪ {fame_start, fame_update, fame_viral, fame_cash, fame_hate}。
  const FAME_TAGS = new Set(['minor_fame', 'fame_start', 'fame_update', 'fame_viral', 'fame_cash', 'fame_hate'])
  const fameRuns = allRuns.filter((r) => r.state.tags.some((t) => FAME_TAGS.has(t))).length
  // 第 104 轮订正：原判据 `history.some(h => h.title.includes('投保'))` 是**量测 bug**——
  // history.title 存的是「事件标题」而非选项文本，而两个保险事件的标题是
  // 「社保之外，再添一份」/「人到中年，保障该补齐了」，均不含「投保」二字 → 恒假零。
  // 正口径＝保单在册（types.ts: insurance?: InsurancePolicy），与 events.ts 的兜底建单一致。
  const insuredRuns = allRuns.filter((r) => r.state.insurance !== undefined).length
  const actionRuns = allRuns.filter((r) => r.state.history.some((h) => h.eventId === 'action')).length
  const actionCount = allRuns.reduce((s, r) => s + r.state.history.filter((h) => h.eventId === 'action').length, 0)
  const moneySorted = allRuns.map((r) => r.state.money).sort((a, b) => a - b)
  const q = (p: number) => moneySorted[Math.min(moneySorted.length - 1, Math.floor(moneySorted.length * p))]
  const p50 = q(0.5)
  const p90 = q(0.9)
  console.log(`\n[第 103 轮 A3 · V5 新基线观察清单（池=${POOL}，${n} 局）]`)
  console.log(`  上岸率（civil_servant）      ${pct(civilRuns)}  合理带 5–15%（R104 终校对标）`)
  console.log(`  投资参与率（fund 在册）     ${pct(fundRuns)}  R104 终校对标`)
  console.log(`  购房率（homeowner）          ${pct(homeRuns)}  R104 终校对标`)
  console.log(`  离婚率（divorced）           ${pct(divorceRuns)}  合理带 5–12%`)
  console.log(`  留学率（overseas/studied）   ${pct(abroadRuns)}  合理带 2–6%`)
  console.log(`  走红率（fame_* 标记）        ${pct(fameRuns)}  合理带 4–10%`)
  console.log(`  投保率（保单在册 insurance）  ${pct(insuredRuns)}  R104 标定（R104 订正量测口径，旧判据恒假零）`)
  console.log(`  行动采纳率（履历含 action）  ${pct(actionRuns)}  R104 终校对标`)
  console.log(`  行动总次数 / 有行动局均次数 ${actionCount} 次 / ${(actionRuns ? (actionCount / actionRuns).toFixed(1) : '0')} 次`)
  console.log(`  资产分布 money p10/p50/p90   ${q(0.1)} / ${p50} / ${p90}`)
  console.log(`  贫富差距 p90/p50            ${p50 !== 0 ? (p90 / p50).toFixed(1) : 'n/a（p50=0）'} 倍  合理带 8–20 倍`)
  console.log(`  结局种类数                  ${endingsAll.size} 种  合理带 ≥8（R104 核 16 种全现）`)
  console.log(`  备考标记残留（civil_exam_prep）${tagRate('civil_exam_prep')} 局`)
  // 第 103 轮补：p90 异常高（45 倍 vs 合理带 8–20）需定位到段，故按段打资产分位。
  // 纯输出，不改随机流、不改策略——A4 旧池对照已在 .r103/ 验过逐位零差异。
  const segs = [...new Set(allRuns.map((r) => r.seg))].sort()
  console.log(`  ── 分段资产分位（定位 p90 来源）──`)
  for (const s of segs) {
    const ms = allRuns.filter((r) => r.seg === s).map((r) => r.state.money).sort((a, b) => a - b)
    if (!ms.length) continue
    const qq = (p: number) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]
    const m50 = qq(0.5)
    console.log(`    段 ${s}（${ms.length} 局）p10/p50/p90 = ${qq(0.1)} / ${m50} / ${qq(0.9)}  差距 ${m50 !== 0 ? (qq(0.9) / m50).toFixed(1) : 'n/a'} 倍`)
  }

  // ── 第 104 轮（V5 唯一数值轮）补齐任务书观察清单缺的四项 ──
  // 传承资格：bloodline.inheritanceOf 对 money ≤ 0 返回 0 → 遗产入账的局 = 终局现金 > 0 的局。
  const inheritRuns = allRuns.filter((r) => r.state.money > 0).length
  console.log(`  传承资格局占比（终局现金>0） ${pct(inheritRuns)}  R104 标定`)
  // 大病返贫：曾确诊慢病（seenEvents 含 hlt_chronic_onset）且终局负债。
  const chronicRuns = allRuns.filter((r) => r.state.seenEvents.includes('hlt_chronic_onset'))
  const chronicBroke = chronicRuns.filter((r) => r.state.money < 0).length
  console.log(`  大病返贫率（慢病∧负债）      ${pct(chronicBroke)}  其中慢病局 ${chronicRuns.length}（${(chronicRuns.length / n * 100).toFixed(1)}%）`)
  // 终龄与幸福分布（对照 R103 基线：终龄 51–77 均值 74.8）。
  const ages = allRuns.map((r) => r.state.age).sort((a, b) => a - b)
  const haps = allRuns.map((r) => r.state.attrs.happiness).sort((a, b) => a - b)
  const qa = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]
  console.log(`  终龄 p10/p50/p90            ${qa(ages, 0.1)} / ${qa(ages, 0.5)} / ${qa(ages, 0.9)}  min=${ages[0]} max=${ages[ages.length - 1]} 均值=${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`)
  console.log(`  幸福 p10/p50/p90            ${qa(haps, 0.1)} / ${qa(haps, 0.5)} / ${qa(haps, 0.9)}  均值=${(haps.reduce((a, b) => a + b, 0) / haps.length).toFixed(1)}`)

  // 第 104 轮 A4：16 结局全现核查——缺失结局的**资格年统计与归因**（不得静默）。
  // 三个缺失项都是多条件合取，逐个原子条件 + 合取后的实测占比。
  const has = (r: typeof allRuns[number], t: string) => r.state.tags.includes(t)
  const missing = [...new Set(ENDINGS.map((e) => e.id))].filter((id) => !endingsAll.has(id))
  console.log(`  ── A4 结局全现核查：${endingsAll.size}/${ENDINGS.length} 种出现，缺 ${missing.length} 种 ──`)
  for (const id of missing) {
    const r = (re: (x: typeof allRuns[number]) => boolean) => allRuns.filter(re).length
    console.log(`    ▸ ${id}`)
    if (id === 'death_young') {
      const early = allRuns.filter((x) => x.state.age < 40)
      console.log(`      原子·终局 age<40：${early.length} 局（${(early.length / n * 100).toFixed(1)}%）`)
      console.log(`      原子·health≤0：${r((x) => x.state.attrs.health <= 0)} 局`)
      console.log(`      归因：健康归零在 40 岁前——晚年代漂移使 health 缓降，早逝窗口极窄`)
    } else if (id === 'pillar') {
      console.log(`      原子·cared_for_parents：${r((x) => has(x, 'cared_for_parents'))} 局`)
      console.log(`      原子·has_child：${r((x) => has(x, 'has_child'))} 局`)
      console.log(`      原子·money≥0：${r((x) => x.state.money >= 0)} 局`)
      console.log(`      原子·happiness≥40：${r((x) => x.state.attrs.happiness >= 40)} 局`)
      const c1 = r((x) => has(x, 'cared_for_parents') && has(x, 'has_child'))
      const c2 = allRuns.filter((x) => has(x, 'cared_for_parents') && has(x, 'has_child') && x.state.money >= 0 && x.state.attrs.happiness >= 40).length
      console.log(`      合取·照护∧有娃：${c1} 局 → 再 ∧money≥0 ∧happiness≥40：${c2} 局`)
      console.log(`      归因：四项合取，瓶颈在 has_child（有娃率 ${(r((x) => has(x, 'has_child')) / n * 100).toFixed(1)}%）——前置婚姻链的概率决定`)
    } else if (id === 'renowned') {
      console.log(`      原子·minor_fame：${r((x) => has(x, 'minor_fame'))} 局`)
      console.log(`      原子·fame 标记全集：${r((x) => x.state.tags.some((t) => FAME_TAGS.has(t)))} 局`)
      console.log(`      原子·成就≥4：${r((x) => x.state.achievements.length >= 4)} 局`)
      console.log(`      原子·money≥0：${r((x) => x.state.money >= 0)} 局`)
      const c1 = r((x) => x.state.tags.some((t) => FAME_TAGS.has(t)) && x.state.achievements.length >= 4)
      const c2 = r((x) => x.state.tags.some((t) => FAME_TAGS.has(t)) && x.state.achievements.length >= 4 && x.state.money >= 0)
      console.log(`      合取·fame标记 ∧成就≥4：${c1} 局 → 再 ∧money≥0：${c2} 局`)
      const fameRunsX = allRuns.filter((x) => x.state.tags.some((t) => FAME_TAGS.has(t)))
      const achOfFame = fameRunsX.map((x) => x.state.achievements.length).sort((a, b) => a - b)
      console.log(`      有 fame 标记的 ${fameRunsX.length} 局，其成就数 min/中位/max = ${achOfFame[0] ?? '-'}/${achOfFame[Math.floor(achOfFame.length / 2)] ?? '-'}/${achOfFame[achOfFame.length - 1] ?? '-'}`)
      const fameEndings = new Map<string, number>()
      for (const x of fameRunsX) fameEndings.set(x.ending, (fameEndings.get(x.ending) ?? 0) + 1)
      console.log(`      其中 money≥0：${fameRunsX.filter((x) => x.state.money >= 0).length} 局 · 结局分布：${dist(fameEndings)}`)
      console.log(`      归因：fame 标记本身仅 ${fameRunsX.length} 局（${(fameRunsX.length / n * 100).toFixed(1)}%，合理带 4–10%），前置就稀；`)
      console.log(`            且其中仅 ${fameRunsX.filter((x) => x.state.money >= 0).length} 局终局现金≥0（其余落 debt_shadow/death_ill）——`)
      console.log(`            三条件全部满足的 ${c2} 局最终仍被更高优先级的结局（debt_shadow 等）截胡，合取与优先级双重收窄`)
    } else {
      console.log(`      归因：见 outcomes.ts 该结局的 when 条件逐项核对`)
    }
  }
}

// 第 58 轮：F 段（family_line 专项）分组统计
const runsF = allRuns.filter((r) => r.seg === 'F')
const marriedF = runsF.filter((r) => r.married).length
const endingsF = new Map<string, number>()
for (const r of runsF) endingsF.set(r.ending, (endingsF.get(r.ending) ?? 0) + 1)
console.log(`\n[F 段·family_line 专项 ${runsF.length} 局] 结婚率 ${(marriedF / Math.max(1, runsF.length) * 100).toFixed(1)}%（机器人混合对照见人生结构行）· 结局 ${dist(endingsF)}`)

// 第 58 轮：成就解锁率（全表——稀有度终校准素材；R104 订正表头过期的「46 枚」标签）
const achRuns = new Map<string, number>()
let sendoffRuns = 0
let sendoffTotal = 0
let chronicDiagnosed = 0
let chronicLivedRuns = 0
for (const r of allRuns) {
  for (const id of r.state.achievements) achRuns.set(id, (achRuns.get(id) ?? 0) + 1)
  const farewells = r.state.history.filter((h) => h.title === '送别').length
  if (farewells > 0) sendoffRuns++
  sendoffTotal += farewells
  if (r.state.seenEvents.includes('hlt_chronic_onset')) {
    chronicDiagnosed++
    if (r.state.age >= 72) chronicLivedRuns++
  }
}
console.log(`\n[成就解锁率]（全表，稀有度终校准素材；R104 订正过期的「46 枚」标签，实测行数=${achRuns.size}）`)
for (const a of ACHIEVEMENTS_SORTED) {
  const n = achRuns.get(a.id) ?? 0
  console.log(`  ${a.id.padEnd(24)} ${String(n).padStart(4)} 局（${((n / allRuns.length) * 100).toFixed(1)}%）[${a.rarity}]`)
}
console.log(`\n[父母/搭伴去世覆盖] 经历送别局数 ${sendoffRuns}（${(sendoffRuns / allRuns.length * 100).toFixed(1)}%）· 人均送别 ${(sendoffTotal / allRuns.length).toFixed(2)} 次`)
console.log(`[慢病覆盖] 确诊局 ${chronicDiagnosed}（${(chronicDiagnosed / allRuns.length * 100).toFixed(1)}%）· 其中存活到 72+（带病延年达标）${chronicLivedRuns} 局`)
console.log(`\n[卡死局数] ${stuckRuns.length}${stuckRuns.length ? '：' + stuckRuns.join('；') : ''}`)
console.log(`[NaN/越界局数] ${badRuns.length}${badRuns.length ? '：' + badRuns.slice(0, 5).join('；') : ''}`)
console.log(`[单选违规] ${[...singleChoices.entries()].map(([k, v]) => `${k}×${v}`).join(' ') || '无'}`)
console.log(`[once 违规] ${onceViolations.length === 0 ? '无' : onceViolations.slice(0, 8).join('；')}`)
console.log(`\n[V2 新事件触发率]（出现该事件的真实局数 / ${allRuns.length} 局）`)
const never = V2_NEW_EVENT_IDS.filter((id) => (v2TriggerRuns.get(id) ?? 0) === 0)
for (const id of V2_NEW_EVENT_IDS) {
  const runs = v2TriggerRuns.get(id) ?? 0
  console.log(`  ${id.padEnd(26)} ${String(runs).padStart(3)} 局（${((runs / allRuns.length) * 100).toFixed(1)}%）抽取 ${v2DrawTotals.get(id) ?? 0} 次`)
}
console.log(`\n[零触发 V2 事件] ${never.length === 0 ? '无' : never.join('、')}`)
console.log(`[V1 婚恋链抽取次数] ${['youth_crush', 'rel_blind_date', 'rel_partner_low', 'rel_quarrel_coldwar', 'rel_propose', 'rel_child_question'].map((id) => `${id}=${v2DrawTotals.get(id) ?? 0}`).join(' ')} · 求婚资格年=${proposeEligibleYears}`)
console.log(`[结局种类数] ${endingsAll.size}（要求 ≥8）`)
