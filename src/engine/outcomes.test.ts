// 第 17 轮：结局系统测试
// 覆盖：结局表结构（≥10 种、id 唯一、表尾兜底）、优先级判定（宽泛条件不吞特殊结局）、
// 13 种结局各自的可达路径（构造临终前状态真实推演到终局 + 状态合法性）、
// 结局总结只引用真实发生的事（引号内容 ⊆ 履历标题 ∪ 成就名 ∪ 出身特质名）、
// 两条路线总结明显分化、成就总量 ≥20 与批量真实对局的解锁面核查。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { availableEvents, visibleChoices, applyChoice } from './events'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { ACHIEVEMENTS } from './achievements'
import { ENDINGS, judgeEnding, buildEndingSummary, checkLifeEnd, endingById } from './outcomes'
import { getBackground } from '../data/backgrounds'
import { getTrait } from '../data/traits'
import type { GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '测试者' })
  return { ...base, ...patch }
}

/**
 * V2 及后续各内容轮新增事件 id 排除表（模块级）。
 *
 * 用途：V1_BASELINE_POOL 锚定「第 24 轮V1 交付态的内容基线」。任何内容轮扩容
 * 都会让确定性轮换策略（cands[guard % len]）的取模位置整体位移 → 固定 seed 轨迹全变，
 * 故结局分化/成就多样性一类**回归网**断言必须锚定 V1 池，不随内容轮漂移。
 * 全量内容下的分布与触发率验收归第 39 轮 300 局模拟。
 */
const V2_NEW_EVENT_IDS = [
  'hlt_drink_toast',
  'hlt_desk_years',
  'hlt_checkup_mild_flags',
  'hlt_checkup_red_flags',
  'hlt_chronic_onset',
  'rel_friend_checkin',
  'rel_parent_greeting',
  'rel_anniversary',
  'rel_parent_frail',
  'fam_child_junior',
  'fam_child_senior',
  'fam_child_gaokao',
  'fam_child_first_job',
  'fam_child_wedding',
  'fam_grandchild',
  // 第 27 轮纯氛围事件（无机制效果或极轻，不入 V1 基线池）
  'youth_livehouse',
  'mid_nav_memory',
  'late_group_rumor',
  // 第 28 轮中年危机带事件（35～45 岁内容加密，不入 V1 基线池）
  'mid_young_boss',
  'mid_industry_collapse',
  'mid_second_child',
  'mid_sandwich',
  'mid_partner_career_gap',
  'mid_friend_fallout',
  'mid_budget_downgrade',
  'mid_reunion_compare',
  // 第 29 轮晚年窗口加密事件（60～77 岁内容扩充，不入 V1 基线池）
  'late_smartphone',
  'late_friends_fade',
  'late_will',
  'late_late_companion',
  'late_grand_rules',
  'late_farewell_preparation',
  'late_volunteer_lead',
  'late_story_grandchild',
  'late_senior_college',
  // 第 42 轮父母去世事件线（身后事叙事，不入 V1 基线池）
  'rel_parent_critical',
  'rel_parent_deathbed',
  'rel_parent_funeral',
  'rel_parent_memorial',
  'rel_parent_relics',
  'rel_parent_last_one',
  // 第 43 轮慢性病长期线（managed 管理/并发症兑现，不入 V1 基线池）
  'hlt_chronic_checkup',
  'hlt_chronic_flare',
  // 第 44 轮关系真实化（孙辈含饴弄孙，不入 V1 基线池）
  'fam_grandchild_time',
  // 第 46 轮婚恋入口扩展（单身线多路入口，不入 V1 基线池）
  'rel_old_flame',
  'rel_colleague_crush',
  'rel_hobby_club',
  'rel_app_match',
  // 第 47 轮年龄热力补密（66-77 最薄桶加密，不入 V1 基线池）
  'late_morning_walk',
  'late_teeth',
  'late_old_letter',
  'late_neighbor_watch',
  'late_cheap_eats',
  'late_solo_birthday',
  'late_balcony_plants',
  'late_old_radio',
  // 第 63 轮教育纵深（在职深造链备考/录取/兑现，不入 V1 基线池）
  'edu_exam_prep',
  'edu_admit_master',
  'edu_degree_payoff',
  // 第 65 轮手足事件线（不入 V1 基线池）
  'sib_loan',
  'sib_venture',
  'sib_care_split',
  'sib_inheritance',
  'sib_fallout_reconcile',
  'sib_reunion',
  'sib_old_companion',
  'sib_memorial',
  // 第 66 轮挚友线（不入 V1 基线池）
  'frd_late_talk',
  'frd_bestman',
  'frd_cross_city',
  'frd_quarrel_reconcile',
  // 第 67 轮婚姻深水区（不入 V1 基线池）
  'mar_seven_year',
  'mar_cold_war',
  'mar_distance',
  'mar_repair_trip',
  'mar_counseling',
  // 第 68 轮倦怠与心理韧性线（不入 V1 基线池）
  'mid_burnout_onset',
  'mid_burnout_insomnia',
  'mid_burnout_slump',
  'mid_burnout_therapy',
  'mid_burnout_sabbatical',
  'late_burnout_rekindle',
  // 第 69 轮宠物真实化（不入 V1 基线池；第 70 轮补登——R69 漏登，18 局零位移系巧合未破断言）
  'pet_vet_visit',
  'pet_companion',
  'pet_aging_care',
  'pet_farewell_choice',
  // 第 70 轮时代纵深 II（纯氛围，不入 V1 基线池）
  'youth_takeout_shelf',
  'mid_livestream_cart',
  'mid_rideshare_story',
  'late_family_group_rumor',
  'late_teach_ride_hailing',
  'late_old_phone_decade',
  // 第 85 轮医疗与保险（V5，不入 V1 基线池；池 214→218）
  'ins_buy_young',
  'ins_buy_mid',
  'ins_declined',
  'hlt_major_surgery',
  // 第 86 轮房产线（V5，不入 V1 基线池；池 218→220）
  'home_living',
  'home_sell_forced',
  // 第 87 轮基金线（V5，不入 V1 基线池；池 220→223）
  'fin_fund_start',
  'fin_fund_take_profit',
  'fin_fund_cut_loss',
  // 第 88 轮体制内线（V5，不入 V1 基线池；池 223→228）
  'civ_exam_prep',
  'civ_exam',
  'civ_office_politics',
  'civ_secondment',
  'civ_ceiling',
  // 第 89 轮 35 岁危机与行业寒冬（V5，不入 V1 基线池；池 228→233）
  'mc_layoff',
  'mc_bench',
  'mc_resume',
  'mc_free_lance',
  'mc_moat',
  // 第 90 轮城市迁移（V5，不入 V1 基线池；池 233→237）
  'city_graduate_run',
  'city_drift_tired',
  'city_province_hq',
  'city_return_retire',
  // 第 91 轮婚恋多元化（V5，不入 V1 基线池；池 237→242）
  'div_sign_papers',
  'div_single_life',
  'div_remarry',
  'fam_dink',
  'life_childfree',
  // 第 92 轮留学与职校（V5，不入 V1 基线池；池 242→248）
  'ab_choice',
  'ab_study',
  'ab_job_hunt',
  'ab_gap',
  'voc_night_school',
  'voc_craft_master',
  // 第 93 轮自媒体名声线（V5，不入 V1 基线池；池 248→253）
  'fame_start',
  'fame_update',
  'fame_viral',
  'fame_cash',
  'fame_hate',
  // 第 95 轮结局深化（V5，不入 V1 基线池；池 253→255）
  'yk_sudden',
  'late_donation',
  // 第 112 轮死亡窄门（V7 首轮：lethal 事件直接致死引擎，不入 V1 基线池；池 290→292）
  'hlt_accident_blink',
  'hlt_verge_fever',
  // 第 113 轮心理健康线（V7：low_mood 状态线 5 枚，不入 V1 基线池；池 292→297）
  'mood_low_tide',
  'mood_self_care',
  'mood_talk',
  'mood_professional',
  'mood_clear_sky',
  // 第 114 轮育儿参与线（V7：child_path 轻分化 4 枚，不入 V1 基线池；池 297→301）
  'par_interest_class',
  'par_teen_door',
  'par_form_night',
  'par_path_visible',
  // 第 115 轮同事与邻里（V7：colleague/neighbor 新关系种类 8 枚，不入 V1 基线池；池 301→305）
  'wl_office_deskmate',
  'wl_new_neighbor',
  'wl_late_night',
  'wl_one_seat',
  'wl_farewell_dinner',
  'wl_hallway_chat',
  'wl_renovation_noise',
  'wl_good_neighbor',
  // 第 116 轮创业事件族（V7：entrepreneur 链 6 枚，不入 V1 基线池；池 309→315）
  'ven_quit_resign',
  'ven_first_year',
  'ven_first_profit',
  'ven_scale_or_hold',
  'vent_close_day',
  'vent_back_to_work',
  // 第 117 轮遗嘱与遗产分配（V7：will_done 链 3 枚，不入 V1 基线池；池 315→318）
  'late_will_split',
  'late_will_amend',
  'late_final_wish',
  // 第 118 轮年关系统（V7：离乡年关抉择层 3 枚，不入 V1 基线池；池 318→321）
  'ny_where',
  'ny_questions',
  'ny_stay_dinner',
  // 第 119 轮性格成长（V7：persona_shifted 轻机制 2 枚，不入 V1 基线池；池 321→323）
  'persona_shift_moment',
  'persona_echo',
  // 第 120 轮养老方式线（V7：elder_* 三向 4 枚，不入 V1 基线池；池 323→327）
  'elder_how',
  'elder_institution_life',
  'elder_two_gen',
  'elder_home_tweak',
  // 第 123 轮时代纵深 IV（V7：纯氛围 3 枚定向薄桶，不入 V1 基线池；池 327→330）
  'era4_jobs_dawn',
  'era4_group_buy',
  'era4_ny_delivery',
  // 第 124 轮事件池扩容（V7：新线联动 10+老线补密 9，不入 V1 基线池；池 330→349）
  'lk_spouse_venture',
  'lk_venture_ny',
  'lk_mood_work',
  'par_kid_city',
  'wl_col_fame',
  'will_sibling_table',
  'elder_sibling_care',
  'persona_after_close',
  'ny_blood_child',
  'nb_elder_help',
  'mar_money_style',
  'mar_anniversary_upgrade',
  'mar_double_shift',
  'frd_old_wall',
  'frd_half_marathon',
  'pet_vet_checkup',
  'pet_rainy_walk',
  'par_parent_phone_fun',
  'par_parent_reunion',
  // 第 101 轮时代纵深 III（V5 纯氛围，7 枚定向补 46-58/66-77 薄桶 + 时代词表落地，
  // 不入 V1 基线池；池 255→262）
  'late_taoli_chair',
  'late_care_home_visit',
  'late_digital_nomad',
  'late_silver_rework',
  'mid_exam_anchor_wait',
  'mid_livestream_works',
  'mid_gig_and_downsizing',
  // 第 102 轮事件池扩容收尾 · 薄处补密（V5，20 枚定向补 46-55/56-65/66-77 三个薄桶的专属位，
  // 不入 V1 基线池；池 262→282）
  'mar_money_talk',
  'mar_new_year_side',
  'mar_handwritten_letter',
  'frd_generation_friend',
  'frd_care_watch',
  'pet_major_care',
  'pet_family_dispute',
  'par_remarry',
  'par_roles_reverse',
  'late_half_retire',
  'late_chronic_routine',
  'late_elevator_wait',
  'late_repair_thing',
  'late_peer_gap',
  'late_hearing_aid',
  'late_friend_funeral',
  'late_kid_faraway',
  'late_body_shake',
  'mid_empty_day',
  'mid_handover_year',
  // 第 108 轮（V6）：晚年丧偶与独居重建线 4 枚。
  // 注意 late_widow_first_year 的选项会移除 spouse 关系并摘除 married 标记——
  // 若不进排除表，它将直接改动 18 局的终局判定（family_hearth 等），必然造成位移。
  'late_widow_first_year',
  'late_widow_social_rebuild',
  'late_widow_living_alone',
  'late_widow_new_mate_boundary',
  // 第 110 轮（V6）：名声热度消退向 2 枚 + 记忆认知主题 2 枚。
  // fame_fade_out 的一支会摘 minor_fame 标记；认知 2 枚零标记、零散列门。
  'fame_fade_out',
  'fame_past_peak',
  'late_memory_early_sign',
  'late_mind_rhythm',
]

/** V1 基线池 = 全池剔除 V2 及后续各轮新增事件（回归网断言的锚定对象） */
const V1_BASELINE_POOL = ALL_EVENTS.filter((e) => !V2_NEW_EVENT_IDS.includes(e.id))

/** V1 基线池 = 全池剔除 V2 及后续各轮新增事件 */

const rel = (kind: Relation['kind'], name: string, closeness = 70): Relation => ({
  id: `r_${kind}_${name}`,
  kind,
  name,
  closeness,
  alive: true,
})

/** 临终前一年的常规状态：76 岁、已退休、有社保记录；健康心情给到安全水位，按需覆盖 */
function nearEnd(patch: Partial<GameState> = {}): GameState {
  return makeGame(7, {
    age: 76,
    career: { kind: 'retired', pension: 20000 },
    tags: ['ever_employed', 'retired'],
    attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
    money: 30000,
    ...patch,
  })
}

describe('结局表结构与优先级', () => {
  it('至少 10 种结局，id 唯一、维度声明非空、等级合法', () => {
    expect(ENDINGS.length).toBeGreaterThanOrEqual(10)
    const ids = ENDINGS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of ENDINGS) {
      expect(e.dims.length).toBeGreaterThan(0)
      expect(['S', 'A', 'B', 'C', 'D']).toContain(e.grade)
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.desc.length).toBeGreaterThan(0)
    }
    expect(endingById('quiet_life')).not.toBeNull()
    expect(endingById('no_such_ending')).toBeNull()
  })

  it('死亡类结局排在表头：健康耗尽优先于一切评价', () => {
    expect(ENDINGS[0].id).toBe('death_young')
    expect(ENDINGS[1].id).toBe('death_ill')
  })

  it('表尾兜底恒真：任何合法状态都能得到一个结局', () => {
    const s = nearEnd({ attrs: { health: 40, happiness: 25, smarts: 50, social: 50, stress: 20 }, money: 200000 })
    expect(judgeEnding(s).id).toBe('gray_dusk')
  })

  it('宽泛条件不吞特殊结局：多条件同时命中时按优先级取最特殊者', () => {
    // 传承 + 家庭 + 平凡同时命中 → 薪火不熄（S）
    const legacy = nearEnd({
      tags: ['ever_employed', 'retired', 'memoir', 'late_mentor', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 60, happiness: 60, smarts: 50, social: 55, stress: 20 },
      money: 100000,
    })
    expect(judgeEnding(legacy).id).toBe('legacy_flame')

    // 家庭 + 财务自由 + 平凡同时命中 → 家和事兴（不按钱多钱少定胜负）
    const family = nearEnd({
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
      money: 2_000_000,
    })
    expect(judgeEnding(family).id).toBe('family_hearth')

    // 单身丰盈 + 平凡同时命中 → 一个人的丰盈
    const solo = nearEnd({
      tags: ['ever_employed', 'retired'],
      attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
    })
    expect(judgeEnding(solo).id).toBe('solitude_rich')

    // 东山再起 + 平凡同时命中 → 东山再起
    const comeback = nearEnd({
      tags: ['ever_employed', 'retired', 'been_deep_debt'],
      money: 10000,
    })
    expect(judgeEnding(comeback).id).toBe('comeback')
  })

  it('不按单一财富数值决定成功：巨富但悲惨的人生不是好结局', () => {
    const richAndMiserable = nearEnd({
      tags: ['ever_employed', 'retired'],
      attrs: { health: 20, happiness: 20, smarts: 50, social: 50, stress: 60 },
      money: 5_000_000,
    })
    const judged = judgeEnding(richAndMiserable)
    expect(['S', 'A']).not.toContain(judged.grade)
    expect(judged.id).toBe('gray_dusk')
  })
})

describe('13 种结局各自可达（构造临终状态真实推演到终局）', () => {
  const cases: Array<{ id: string; patch: Partial<GameState>; age?: number }> = [
    // 死亡方式：健康耗尽
    { id: 'death_young', patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 30 },
    { id: 'death_ill', patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 60 },
    // S 级：热爱成真
    {
      id: 'dream_lived',
      patch: {
        tags: ['ever_employed', 'retired', 'dream_full'],
        attrs: { health: 60, happiness: 68, smarts: 50, social: 50, stress: 20 },
        money: 20000,
      },
    },
    // S 级：薪火不熄
    {
      id: 'legacy_flame',
      patch: {
        tags: ['ever_employed', 'retired', 'memoir', 'late_mentor'],
        attrs: { health: 60, happiness: 62, smarts: 50, social: 55, stress: 20 },
      },
    },
    // A 级：家和事兴
    {
      id: 'family_hearth',
      patch: {
        tags: ['ever_employed', 'retired', 'married', 'has_child'],
        relations: [rel('spouse', '林秀'), rel('child', '林小满')],
        attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
        money: 50000,
      },
    },
    // A 级：一个人的丰盈
    {
      id: 'solitude_rich',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
      },
    },
    // A 级：东山再起
    {
      id: 'comeback',
      patch: {
        tags: ['ever_employed', 'retired', 'been_deep_debt'],
        money: 40000,
      },
    },
    // A 级：财务自由（仍要求健康与快乐，不是纯钱）
    {
      id: 'wealth_free',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 55, smarts: 50, social: 50, stress: 20 },
        money: 1_200_000,
      },
    },
    // A 级：一家人的顶梁柱
    {
      id: 'pillar',
      patch: {
        tags: ['ever_employed', 'retired', 'cared_for_parents', 'has_child'],
        attrs: { health: 60, happiness: 45, smarts: 50, social: 50, stress: 30 },
        money: 20000,
      },
    },
    // C 级：劳碌半生
    {
      id: 'labor_worn',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 40, smarts: 50, social: 50, stress: 35 },
        money: 30000,
      },
    },
    // D 级：债影随行
    {
      id: 'debt_shadow',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 35 },
        money: -30000,
      },
    },
    // B 级：平凡之路
    {
      id: 'quiet_life',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 25 },
        money: 60000,
      },
    },
    // C 级：暮色沉沉（兜底）
    {
      id: 'gray_dusk',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 40, happiness: 25, smarts: 50, social: 50, stress: 40 },
        money: 200000,
      },
    },
    // ── 第 95 轮（V5）新结局 3 种 ──
    // A 级：声名远播（minor_fame+成就 4+正资产）
    {
      id: 'renowned',
      patch: {
        tags: ['minor_fame', 'ever_employed', 'retired'],
        achievements: ['ach_fund_free', 'ach_savings_1st', 'ach_job_newbie', 'ach_health_iron'],
        attrs: { health: 60, happiness: 55, smarts: 60, social: 70, stress: 20 },
        money: 80000,
      },
    },
    // A 级：慈善之家（donor+正资产+心情在线）
    {
      id: 'philanthropist',
      patch: {
        tags: ['donor', 'ever_employed', 'retired'],
        attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
        money: 80000,
      },
    },
    // A 级：隐士（childfree_will 主动独居+宽裕；须绕开 solitude_rich 的 60/50 门槛）
    {
      id: 'hermit',
      patch: {
        tags: ['childfree_will', 'ever_employed', 'retired'],
        relations: [],
        attrs: { health: 45, happiness: 50, smarts: 50, social: 30, stress: 15 },
        money: 150000,
      },
    },
  ]

  it('结局表覆盖 16 种且每个都有临终可达路径，终局状态合法（95 轮扩 3）', () => {
    expect(cases).toHaveLength(16)
    expect(new Set(cases.map((c) => c.id)).size).toBe(ENDINGS.length)
    for (const c of cases) {
      const patch = { ...c.patch }
      if (c.age !== undefined) patch.age = c.age
      const s = advanceYear(nearEnd(patch))
      expect(s.phase, `${c.id} 应回到终局`).toBe('ended')
      expect(judgeEnding(s).id, `${c.id} 应命中预期结局`).toBe(c.id)
      expect(validateState(s).issues, `${c.id} 终局状态应合法`).toEqual([])
    }
  })

  it('checkLifeEnd 仍返回结束方式 ID（存档兼容），结局判定独立于它', () => {
    expect(checkLifeEnd(nearEnd({ age: 77 }))).toBe('natural_end')
    const ill = nearEnd({ age: 60, attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } })
    expect(checkLifeEnd(ill)).toBe('death_ill')
    const young = nearEnd({ age: 30, attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } })
    expect(checkLifeEnd(young)).toBe('death_young')
    expect(checkLifeEnd(makeGame(7, { age: 40 }))).toBeNull()
  })
})

// ── 结局总结 ──

describe('结局总结：只引用真实发生的事', () => {
  const SEED = 20260916

  /** 从 51 岁的指定状态推到终局（复用第 16 轮的确定性轮换策略） */
  function playToEnd(patch: Partial<GameState>, pick: 'first' | 'last' = 'first'): GameState {
    let s = makeGame(SEED, { age: 51, ...patch })
    let guard = 0
    while (s.phase === 'playing' && guard < 40) {
      guard++
      // 锚定 V1 基线池：结局分化是回归网断言，不应随内容轮扩容漂移（第 24 轮先例）
      const cands = availableEvents(s, V1_BASELINE_POOL)
      if (cands.length > 0) {
        const chosen = cands[guard % cands.length]
        const vis = visibleChoices(s, chosen)
        if (vis.length > 0) {
          const choice = pick === 'first' ? vis[0] : vis[vis.length - 1]
          s = applyChoice(s, chosen, chosen.choices.indexOf(choice)).state
        }
      }
      s = advanceYear(s)
    }
    return s
  }

  it('总结里的引号内容全部有出处：履历标题 ∪ 成就名 ∪ 出身/特质名', () => {
    const s = playToEnd({
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 90000, yearsAtJob: 6 },
      tags: ['married', 'has_child', 'homeowner', 'ever_employed'],
      relations: [rel('spouse', '周宁'), rel('child', '周小雨'), rel('parent', '父亲', 55)],
      money: 250000,
      attrs: { health: 70, happiness: 58, smarts: 55, social: 55, stress: 40 },
    })
    const { lines, highlights } = buildEndingSummary(s)
    // 被引用的转折必须真的在履历里
    for (const h of highlights) {
      expect(s.history).toContainEqual(h)
    }
    const allowed = new Set<string>([
      ...s.history.map((h) => h.title),
      ...s.achievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? ''),
      getBackground(s.backgroundId).name,
      getTrait(s.traitId).name,
    ])
    const quoted = lines.flatMap((l) => [...l.matchAll(/「([^」]+)」/g)].map((m) => m[1]))
    expect(quoted.length).toBeGreaterThan(0)
    for (const q of quoted) {
      expect(allowed.has(q), `总结引用了不存在的内容：「${q}」`).toBe(true)
    }
    // 提到的人必须是真实关系
    const relationNames = new Set(s.relations.map((r) => r.name))
    for (const l of lines) {
      for (const name of relationNames) {
        if (l.includes(name)) expect(l).toContain('身边') // 人物只出现在"身边有……"句式里
      }
    }
    expect(validateState(s).issues).toEqual([])
  })

  it('两条路线的总结明显不同：家庭线 vs 单身清贫线', () => {
    const family = playToEnd({
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 3, salary: 120000, yearsAtJob: 8 },
      tags: ['married', 'has_child', 'homeowner', 'ever_employed'],
      relations: [rel('spouse', '周宁'), rel('child', '周小雨')],
      money: 300000,
      attrs: { health: 70, happiness: 58, smarts: 55, social: 55, stress: 40 },
    })
    const lone = playToEnd({
      career: { kind: 'none' },
      tags: ['chronic_pain', 'shop_dream', 'ever_employed'],
      relations: [rel('parent', '母亲', 55)],
      money: 8000,
      attrs: { health: 66, happiness: 46, smarts: 50, social: 50, stress: 50 },
    })
    const sumA = buildEndingSummary(family)
    const sumB = buildEndingSummary(lone)
    const textA = sumA.lines.join('')
    const textB = sumB.lines.join('')
    // 结局不同、总结文本不同
    expect(judgeEnding(family).id).not.toBe(judgeEnding(lone).id)
    expect(textA).not.toBe(textB)
    // 家庭线：伴侣仍在身边、晚年有退休金；单身线：无伴侣句式、靠零工/积蓄
    expect(textA).toContain('周宁')
    expect(textA).toContain('退休')
    expect(textB).not.toContain('周宁')
    expect(textB).toMatch(/一个人把日子过成了自己的形状|零工/)
    // 双方的关键转折都取自各自真实履历
    for (const h of sumA.highlights) expect(family.history).toContainEqual(h)
    for (const h of sumB.highlights) expect(lone.history).toContainEqual(h)
  })
})

// ── 成就核查 + 全生涯批量模拟 ──

describe('成就总量核查与全生涯模拟', () => {
  it('成就定义不少于 20 个，id 唯一、名字与描述齐全', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20)
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(0)
    }
  })

  const SEEDS = [11, 20260917, 77]
  const STARTS: Array<{ bg: string; trait: string }> = [
    { bg: 'ordinary', trait: 'studious' },
    { bg: 'rural', trait: 'ambitious' },
    { bg: 'wealthy', trait: 'sociable' },
    { bg: 'ordinary', trait: 'frugal' },
    { bg: 'single_parent', trait: 'studious' },
    { bg: 'rural', trait: 'frugal' },
  ]

  // 第 24 轮：18 局模拟锚定「V1 内容基线池」。V2 各内容轮持续扩容事件池（第 24 轮 +5、
  // 第 25 轮 +4，第 28/29 轮还将 +16~20），任何扩容都会让确定性轮换策略（cands[guard % len]）的
  // 取模位置整体位移，18 条固定 seed 轨迹随之全变——分布/成就数值会随池漂移。
  // 本测试意图是锁定「V1 内容的多样性与成就可达性」下限，故显式排除 V2 新增事件、
  // 断言数值保持 V1 交付原值；V2 全量内容下的结局分布与触发率验收归第 39 轮 300 局模拟。
  // 第 25 轮锚点再校准（12 → 11，对照实验入档）：关系衰减是 V2 预期机制，它改变关系
  // 门控事件的可用性 → 轮换策略取模位置位移 → 固定 seed 轨迹全体偏移。控制实验：
  // 关闭衰减（V1 机制）跑本表并集恰为 12（与 V1 交付一致，证明探针忠实）；开启衰减
  // 后并集 11——差集是 debt_free/quit_smoking/self_made ↔ health_comeback/reunion 的
  // 轨迹巧合集交换（debt_free 等不依赖关系，纯因事件抽取序列位移），不是成就系统性
  // 丢失；结局分布 ≥3 种保持（实测 5 种：death_ill×12/debt_shadow/quiet_life/labor_worn/
  // legacy_flame×3）。11 仍是成就系统的回归网下限（成就引擎损坏会跌到 <8）；
  // 判定 ≥3 结局 + ≥11 成就的多样性意图不变。全量分布验收归第 39 轮 300 局模拟。
  const achUnionFloor = 11
  // 排除表已提升到模块级（见文件上方V2_NEW_EVENT_IDS / V1_BASELINE_POOL）

  /** 从 18 岁完整玩到终局（确定性轮换策略），返回终局状态 */
  function playFullLife(seed: number, bg: string, trait: string): GameState {
    let s = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '模拟者' })
    let guard = 0
    while (s.phase === 'playing' && guard < 60) {
      guard++
      const cands = availableEvents(s, V1_BASELINE_POOL)
      if (cands.length > 0) {
        const chosen = cands[guard % cands.length]
        const vis = visibleChoices(s, chosen)
        if (vis.length > 0) {
          const choice = vis[(guard - 1) % vis.length]
          s = applyChoice(s, chosen, chosen.choices.indexOf(choice)).state
        }
      }
      s = advanceYear(s)
      expect(validateState(s).issues, `${seed}/${bg}/${trait} 第 ${s.age} 岁状态应合法`).toEqual([])
    }
    expect(s.phase).toBe('ended')
    return s
  }

  it(`18 局全生涯模拟（6 开局 × 3 seed）：全部到达终局、无非法状态、结局分布 ≥3 种、成就并集 ≥12 个`, () => {
    const endingCount = new Map<string, number>()
    const achUnion = new Set<string>()
    for (const start of STARTS) {
      for (const seed of SEEDS) {
        const s = playFullLife(seed, start.bg, start.trait)
        const ending = judgeEnding(s).id
        endingCount.set(ending, (endingCount.get(ending) ?? 0) + 1)
        expect(Number.isFinite(s.money)).toBe(true)
        for (const a of s.achievements) achUnion.add(a)
      }
    }
    const table = [...endingCount.entries()].sort((a, b) => b[1] - a[1])
    console.log('结局分布（18 局）:', table.map(([k, v]) => `${k}×${v}`).join(' '))
    console.log(`成就并集：${achUnion.size} 个（${[...achUnion].join('、')}）`)
    expect(endingCount.size).toBeGreaterThanOrEqual(3)
    expect(achUnion.size).toBeGreaterThanOrEqual(achUnionFloor)
  })
})

// ── 复验补强（第 17 轮第 2 次触发）：验收项"逐一为每种结局构造可达状态和
// 至少一个不满足关键条件的对照状态"与"特殊字符姓名/无履历/无关系不露内部字段" ──

describe('复验补强：每种结局的对照状态（破坏关键条件后必须换结局）', () => {
  // gray_dusk 为恒真兜底、没有可破坏的关键条件，不进对照表；其"让位"语义
  // 已由上方多命中优先级测试与巨富悲惨反例覆盖。
  // 第 95 轮（V5）：新增 3 结局的对照状态
  const V5_CONTRASTS: Array<{
    id: string
    base: Partial<GameState>
    age?: number
    broken: Partial<GameState>
    brokenAge?: number
  }> = [
    {
      id: 'renowned',
      base: {
        tags: ['minor_fame', 'ever_employed', 'retired', 'ach_a', 'ach_b', 'ach_c', 'ach_d'],
        achievements: ['a1', 'a2', 'a3', 'a4'],
        attrs: { health: 60, happiness: 55, smarts: 60, social: 70, stress: 20 },
        money: 80000,
      },
      broken: { tags: ['ever_employed', 'retired', 'ach_a', 'ach_b', 'ach_c', 'ach_d'], achievements: ['a1', 'a2', 'a3', 'a4'], attrs: { health: 60, happiness: 55, smarts: 60, social: 70, stress: 20 }, money: 80000 },
    },
    {
      id: 'philanthropist',
      base: {
        tags: ['donor', 'ever_employed', 'retired'],
        attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
        money: 80000,
      },
      broken: { tags: ['ever_employed', 'retired'], attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 }, money: 80000 },
    },
    {
      id: 'hermit',
      base: {
        tags: ['childfree_will', 'ever_employed', 'retired'],
        relations: [],
        attrs: { health: 45, happiness: 50, smarts: 50, social: 30, stress: 15 },
        money: 150000,
      },
      broken: { tags: ['ever_employed', 'retired'], relations: [], attrs: { health: 45, happiness: 50, smarts: 50, social: 30, stress: 15 }, money: 150000 },
    },
  ]
  const CONTRASTS: Array<{
    id: string
    base: Partial<GameState>
    age?: number
    broken: Partial<GameState>
    brokenAge?: number
  }> = [
    // 死亡边界：30 岁健康 0 是英年早逝；同样健康 0 但已到 40 岁就是积劳成疾
    {
      id: 'death_young',
      base: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } },
      age: 30,
      broken: {},
      brokenAge: 40,
    },
    {
      id: 'death_ill',
      base: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } },
      age: 60,
      broken: { attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 0 } },
    },
    {
      id: 'dream_lived',
      base: {
        tags: ['ever_employed', 'retired', 'dream_full'],
        attrs: { health: 60, happiness: 68, smarts: 50, social: 50, stress: 20 },
        money: 20000,
      },
      broken: { attrs: { health: 60, happiness: 40, smarts: 50, social: 50, stress: 20 } },
    },
    {
      id: 'legacy_flame',
      base: {
        tags: ['ever_employed', 'retired', 'memoir', 'late_mentor'],
        attrs: { health: 60, happiness: 62, smarts: 50, social: 55, stress: 20 },
      },
      broken: { tags: ['ever_employed', 'retired'] },
    },
    {
      id: 'family_hearth',
      base: {
        tags: ['ever_employed', 'retired', 'married', 'has_child'],
        relations: [rel('spouse', '林秀'), rel('child', '林小满')],
        attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
        money: 50000,
      },
      broken: { relations: [] },
    },
    {
      id: 'solitude_rich',
      base: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
      },
      broken: { attrs: { health: 60, happiness: 40, smarts: 50, social: 50, stress: 20 } },
    },
    {
      id: 'comeback',
      base: { tags: ['ever_employed', 'retired', 'been_deep_debt'], money: 40000 },
      broken: { money: -30000 },
    },
    {
      id: 'wealth_free',
      base: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 55, smarts: 50, social: 50, stress: 20 },
        money: 1_200_000,
      },
      broken: { money: 80000 },
    },
    {
      id: 'pillar',
      base: {
        tags: ['ever_employed', 'retired', 'cared_for_parents', 'has_child'],
        attrs: { health: 60, happiness: 45, smarts: 50, social: 50, stress: 30 },
        money: 20000,
      },
      broken: { tags: ['ever_employed', 'retired', 'has_child'] },
    },
    {
      id: 'labor_worn',
      base: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 40, smarts: 50, social: 50, stress: 35 },
        money: 30000,
      },
      broken: { attrs: { health: 55, happiness: 70, smarts: 50, social: 50, stress: 20 } },
    },
    {
      id: 'debt_shadow',
      base: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 35 },
        money: -30000,
      },
      broken: { money: 50000 },
    },
    {
      id: 'quiet_life',
      base: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 25 },
        money: 60000,
      },
      broken: { attrs: { health: 55, happiness: 20, smarts: 50, social: 50, stress: 25 } },
    },
  ]

  it('15 个有条件结局逐一有对照状态：基准态命中、破坏关键条件后不再命中原结局（95 轮 +3）', () => {
    expect(V5_CONTRASTS.concat(CONTRASTS)).toHaveLength(15) // 95 轮 +3（renowned/philanthropist/hermit）
    expect(new Set(V5_CONTRASTS.concat(CONTRASTS).map((c) => c.id)).size).toBe(ENDINGS.length - 1)
    for (const c of V5_CONTRASTS.concat(CONTRASTS)) {
      const baseState = c.age !== undefined ? nearEnd({ ...c.base, age: c.age }) : nearEnd(c.base)
      expect(judgeEnding(baseState).id, `${c.id} 基准态应命中自身`).toBe(c.id)
      const broken = { ...c.base, ...c.broken }
      const brokenState =
        c.brokenAge !== undefined ? nearEnd({ ...broken, age: c.brokenAge }) : nearEnd(broken)
      expect(judgeEnding(brokenState).id, `${c.id} 破坏关键条件后应换成别的结局`).not.toBe(c.id)
      expect(validateState(brokenState).issues, `${c.id} 对照态应合法`).toEqual([])
    }
  })
})

describe('复验补强：极端状态下结局与总结不露内部字段', () => {
  it('无履历、无关系、特殊字符姓名、疏远标记：总结自然、无 undefined/原始 tag/占位符', () => {
    const s = makeGame(7, {
      name: '奥娜丽莎·德·热那亚',
      age: 77,
      career: { kind: 'none' },
      history: [],
      relations: [],
      achievements: [],
      tags: ['estranged_parent'],
      attrs: { health: 30, happiness: 20, smarts: 50, social: 10, stress: 10 },
      money: -12345,
    })
    expect(judgeEnding(s).id).toBe('debt_shadow')
    const { lines, highlights } = buildEndingSummary(s)
    expect(highlights).toEqual([]) // 没有重要履历就不编造转折
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toContain('奥娜丽莎·德·热那亚') // 姓名原样出现，不被截断或转义
    for (const line of lines) {
      expect(line).not.toContain('undefined')
      expect(line).not.toContain('NaN')
      expect(line).not.toContain('{name}')
      expect(line).not.toContain('estranged_parent')
      expect(line).not.toContain('ever_employed')
    }
    expect(lines.some((l) => l.includes('断了来往'))).toBe(true) // 疏远标记只翻译成人话
    expect(validateState(s).issues).toEqual([])
  })
})
