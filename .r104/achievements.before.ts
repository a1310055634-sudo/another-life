// 第 13 轮：成就系统。
// 成就是结构化数据 + 纯函数判定：check 只读 GameState，不消耗 RNG、不修改状态。
// unlockAchievements 负责落账：写入 state.achievements，并追加一条 key 履历
// （eventId 固定 'ach'），成就因此同时进入人生履历，供结局总结引用。
import type { GameState, HistoryEntry } from './types'
import { getJob } from '../data/careers'

/** 稀有度（第 31 轮，数据先行）：呈现轮（第 32+）再消费美化 */
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  check: (s: GameState) => boolean
  /** 稀有度（第 31 轮）：common 常见 / rare 少见 / epic 珍稀 / legendary 传奇 */
  rarity: AchievementRarity
  /** 隐藏成就（第 31 轮）：解锁前不透露名称与条件（首页成就列表遮罩显示） */
  hidden?: boolean
}

/** 拥有任一标记 */
const hasAny = (s: GameState, tags: string[]) => tags.some((t) => s.tags.includes(t))

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── 教育 ──
  {
    id: 'ach_first_degree',
    name: '学有所成',
    desc: '取得本科及以上学历',
    check: (s) => ['bachelor', 'master', 'phd'].includes(s.education),
    rarity: 'rare', // 第 79 轮千局终校 1.9%：深造线机器人下界（人类中等），common 档明显偏低
  },
  {
    id: 'ach_self_made',
    name: '大器晚成',
    desc: '走过自考路，拿到大专及以上学历',
    check: (s) => s.tags.includes('self_exam') && ['college', 'bachelor', 'master', 'phd'].includes(s.education),
    rarity: 'rare',
  },
  {
    id: 'ach_fallen_and_risen',
    name: '落榜不落志',
    desc: '高考落榜之后，仍拿到了大专及以上学历',
    check: (s) =>
      s.seenEvents.includes('edu_gaokao_failed_regroup') &&
      ['college', 'bachelor', 'master', 'phd'].includes(s.education),
    rarity: 'rare',
  },
  // ── 职业 ──
  {
    id: 'ach_first_job',
    name: '初入职场',
    desc: '获得第一份正式工作',
    check: (s) => s.tags.includes('ever_employed'),
    rarity: 'common',
  },
  {
    id: 'ach_senior_level',
    name: '中层骨干',
    desc: '职级升到 3',
    check: (s) => s.career.kind === 'employed' && s.career.level >= 3,
    rarity: 'common',
  },
  {
    id: 'ach_comeback',
    name: '东山再起',
    desc: '离开一个行业之后，又在新的岗位上重新开始',
    check: (s) => s.career.kind === 'employed' && s.tags.some((t) => t.startsWith('ex_')),
    rarity: 'rare',
  },
  // ── 财务 ──
  {
    id: 'ach_100k',
    name: '第一个十万',
    desc: '存款攒到 10 万元',
    check: (s) => s.money >= 100000,
    rarity: 'common',
  },
  {
    id: 'ach_debt_free',
    name: '无债一身轻',
    desc: '从 5 万元以上的深负债中爬回正资产',
    check: (s) => s.tags.includes('been_deep_debt') && s.money >= 0,
    rarity: 'rare', // 第 58 轮千局校准：49.4%（原 epic 高估稀有度）
  },
  {
    id: 'ach_landlord',
    name: '收租的人',
    desc: '盘下一间铺面，每年都有租金进账',
    check: (s) => s.tags.includes('landlord'),
    rarity: 'rare',
  },
  // ── 关系 ──
  {
    id: 'ach_family',
    name: '三口之家',
    desc: '结了婚，也有了孩子',
    check: (s) => s.tags.includes('married') && s.tags.includes('has_child'),
    rarity: 'rare', // 第 58 轮千局校准：2.3%（原 common 低估稀有度）
  },
  {
    id: 'ach_pet',
    name: '铲屎官',
    desc: '把一只小家伙接回了家',
    check: (s) => s.tags.includes('pet_owner'),
    rarity: 'common',
  },
  {
    id: 'ach_reunion',
    name: '破镜重圆',
    desc: '和疏远的家人重新坐到了一张饭桌上',
    check: (s) =>
      s.seenEvents.includes('rel_estranged_parent') && s.relations.some((r) => r.kind === 'parent' && r.alive),
    rarity: 'rare',
  },
  // ── 健康 ──
  {
    id: 'ach_iron_body',
    name: '老当益壮',
    desc: '60 岁以后仍保持着 65 以上的健康',
    check: (s) => s.age >= 60 && s.attrs.health >= 65,
    rarity: 'rare',
  },
  {
    id: 'ach_reborn',
    name: '重获新生',
    desc: '健康见底之后，又把它一点点养了回来',
    check: (s) => s.seenEvents.includes('hlt_body_intensive') && s.attrs.health >= 45,
    rarity: 'epic',
  },
  // ── 生活方式 ──
  {
    id: 'ach_independent',
    name: '自己的门钥匙',
    desc: '搬出来，一个人过日子',
    check: (s) => hasAny(s, ['independent_living']),
    rarity: 'common',
  },
  // ── 青年路线（第 14 轮）──
  {
    id: 'ach_city_rooted',
    name: '在大城市站稳脚跟',
    desc: '去了大城市闯荡，并攒下了 5 万元',
    check: (s) => s.tags.includes('go_big_city') && s.money >= 50000,
    rarity: 'rare',
  },
  {
    id: 'ach_dream_kept',
    name: '热爱未熄',
    desc: '把热爱养在业余，直到它开花的那天',
    check: (s) => s.tags.includes('dream_kept') && s.tags.includes('dream_bloom'),
    rarity: 'rare',
  },
  {
    id: 'ach_young_savings',
    name: '二十岁的积蓄',
    desc: '不靠家里，在 22 岁及以前白手攒下 2 万元（富裕出身除外）',
    check: (s) => s.age <= 22 && s.money >= 20000 && !s.tags.includes('bg_wealthy'),
    rarity: 'rare',
  },
  {
    id: 'ach_torch_passed',
    name: '薪火相传',
    desc: '接过前辈的指点，也接过了他的职级',
    check: (s) =>
      s.tags.includes('mentor_bond') && s.career.kind === 'employed' && s.career.level >= 2,
    rarity: 'rare',
  },
  {
    id: 'ach_early_wedding',
    name: '二十几岁的婚礼',
    desc: '在 30 岁及以前步入婚姻',
    check: (s) => s.tags.includes('married') && s.age <= 30,
    rarity: 'rare',
  },
  // ── 中年路线（第 15 轮）──
  {
    id: 'ach_mid_pivot',
    name: '中年转身',
    desc: '过了而立之年转行，还在新岗位上升了一级',
    check: (s) =>
      s.age >= 31 && s.tags.includes('mid_pivot') && s.career.kind === 'employed' && s.career.level >= 2,
    rarity: 'epic',
  },
  {
    id: 'ach_pillar',
    name: '一家人的顶梁柱',
    desc: '上有老下有小，日子还稳稳当当',
    check: (s) =>
      s.age >= 31 &&
      s.tags.includes('has_child') &&
      s.tags.includes('cared_for_parents') &&
      s.money >= 0,
    rarity: 'epic',
  },
  {
    id: 'ach_warm_home',
    name: '烟火气',
    desc: '房子、伴侣和孩子，热气腾腾的一家人',
    check: (s) => s.tags.includes('homeowner') && s.tags.includes('married') && s.tags.includes('has_child'),
    rarity: 'rare',
  },
  {
    id: 'ach_health_comeback',
    name: '旧伤不疼了',
    desc: '和纠缠多年的旧伤彻底和解',
    check: (s) => s.tags.includes('health_comeback') && !s.tags.includes('chronic_pain') && s.attrs.health >= 50,
    rarity: 'epic',
  },
  {
    id: 'ach_dream_lived',
    name: '把热爱过成日子',
    desc: '中年放手一搏，靠热爱过上了好日子',
    check: (s) => s.tags.includes('dream_full') && s.attrs.happiness >= 55,
    rarity: 'epic',
  },
  // ── 晚年路线（第 16 轮）──
  {
    id: 'ach_silver_mentor',
    name: '桃李晚年',
    desc: '晚年仍在带徒弟，把手艺和心意都传了下去',
    check: (s) => s.tags.includes('late_mentor') && s.attrs.social >= 50,
    rarity: 'rare',
  },
  {
    id: 'ach_quit_smoking',
    name: '掐灭最后一支烟',
    desc: '抽了半辈子，晚年终于把烟戒了，身体也在还利',
    check: (s) => s.tags.includes('quit_smoking') && s.attrs.health >= 45,
    rarity: 'rare',
  },
  {
    id: 'ach_single_golden',
    name: '一个人的丰盈',
    desc: '无伴侣走到六十岁以后，日子照样过得有滋有味',
    check: (s) =>
      s.age >= 60 &&
      s.attrs.happiness >= 60 &&
      !s.relations.some((r) => (r.kind === 'partner' || r.kind === 'spouse') && r.alive),
    rarity: 'epic',
  },
  {
    id: 'ach_grandparent',
    name: '隔代的疼爱',
    desc: '帮儿女带过孙辈，一家人的亲情又深了一层',
    check: (s) =>
      s.tags.includes('grandparent_duty') &&
      s.relations.some((r) => r.kind === 'child' && r.alive && r.closeness >= 70),
    rarity: 'rare',
  },
  {
    id: 'ach_dream_passed_on',
    name: '热爱有了传人',
    desc: '晚年把一辈子的热爱交到了别人手里',
    check: (s) => s.tags.includes('dream_legacy'),
    rarity: 'epic',
  },
  {
    id: 'ach_memoir',
    name: '一本回忆录',
    desc: '过了六十岁，把自己的故事写成了册子',
    check: (s) => s.tags.includes('memoir') && s.age >= 60,
    rarity: 'rare',
  },
  // ── 链条与隐藏（第 31 轮：成就 31→41，稀有度/隐藏数据先行，呈现轮消费）──
  {
    id: 'ach_mortgage_cleared',
    name: '房贷结清',
    desc: '背上过房贷，又把它一分不差地还清——房子完完全全是自己的了',
    check: (s) => s.tags.includes('mortgage_cleared'),
    rarity: 'rare',
  },
  {
    id: 'ach_grow_old_together',
    name: '白头偕老',
    desc: '六十岁以后，身边还是当年那个人',
    check: (s) =>
      s.tags.includes('married') &&
      s.age >= 60 &&
      s.relations.some((r) => r.kind === 'spouse' && r.alive),
    rarity: 'rare',
  },
  {
    id: 'ach_three_generations',
    name: '三代同堂',
    desc: '儿女成家、孙辈绕膝，一家的故事往下传了',
    check: (s) =>
      s.age >= 50 &&
      s.relations.some(
        (r) =>
          r.kind === 'child' &&
          r.alive &&
          (r.milestones?.includes('ms_grandchild') || s.tags.includes('grandparent_duty')),
      ),
    rarity: 'rare',
  },
  {
    id: 'ach_full_lifespan',
    name: '岁月长河',
    desc: '平平安安活到了 77 岁，把一辈子过满了',
    check: (s) => s.age >= 77,
    rarity: 'common', // 第 58 轮千局校准：60.9%（原 legendary 严重高估稀有度）
  },
  {
    id: 'ach_top_level',
    name: '登峰造极',
    desc: '把一份工作做到了职级的顶点',
    check: (s) => {
      if (s.career.kind !== 'employed') return false
      const job = getJob(s.career.jobId)
      return s.career.level >= (job?.maxLevel ?? 4)
    },
    rarity: 'epic',
    hidden: true,
  },
  {
    id: 'ach_dream_trilogy',
    name: '热爱成诗',
    desc: '青年养起热爱、看着它开花、中年靠它过上日子——一条路走完了三部曲',
    check: (s) => s.tags.includes('dream_kept') && s.tags.includes('dream_bloom') && s.tags.includes('dream_full'),
    rarity: 'epic',
  },
  {
    id: 'ach_phd',
    name: '学海无涯',
    desc: '一路读到博士学位',
    check: (s) => s.education === 'phd',
    rarity: 'epic',
    hidden: true,
  },
  {
    id: 'ach_million_home',
    name: '百万家财',
    desc: '四十岁以后，攒下了第一个一百万',
    // 年龄闸防富裕开局误奖励：bg_wealthy 开局带 20 万，但 40 岁前不判定
    check: (s) => s.age >= 40 && s.money >= 1000000,
    rarity: 'legendary',
    hidden: true,
  },
  {
    id: 'ach_old_friend',
    name: '莫逆之交',
    desc: '五十五岁以后，还有一位无话不谈的老朋友',
    check: (s) =>
      s.age >= 55 && s.relations.some((r) => r.kind === 'friend' && r.alive && r.closeness >= 85),
    rarity: 'rare',
  },
  {
    id: 'ach_clean_living',
    name: '清风朗月',
    desc: '烟酒不沾、身子勤快，六十岁以后体检单干干净净',
    check: (s) => s.age >= 60 && s.attrs.health >= 60 && (s.healthRisk ?? 0) <= 5,
    rarity: 'epic',
  },
  // ── 第 50 轮：成就二期（41→46）——全部读 V3 机制落下的真实状态，
  //    每枚可达路线见 round50.test 正反用例；稀有度按 300 局实测初校（58 轮终校）。
  {
    id: 'ach_final_sendoff',
    name: '送终',
    desc: '送别了至亲的最后一程',
    check: (s) => s.history.some((h) => h.title === '送别'),
    rarity: 'common', // 120 局实测 85.8%（父母 90+ 段几乎必经），初校
  },
  {
    id: 'ach_grandparent_time',
    name: '含饴弄孙',
    desc: '给孙辈办过一个下午的专属陪伴',
    check: (s) =>
      s.relations.some(
        (r) => r.kind === 'grandchild' && Array.isArray(r.milestones) && r.milestones.includes('ms_spoil_afternoon'),
      ),
    rarity: 'epic', // 120 局实测 4.2%（机器人家庭线下界，人类更高），初校
  },
  {
    id: 'ach_chronic_lived',
    name: '带病延年',
    desc: '确诊慢性病十年，日子照样过得有滋有味',
    // 确诊最早 62 岁（onset 窗口下限），72 岁 ≥ 即蕴含共存 ≥10 年；
    // managed 标记 2 年刷新不作硬性要求——「共存」的本意是带着病把日子过下去
    check: (s) => s.seenEvents.includes('hlt_chronic_onset') && s.age >= 72,
    rarity: 'common', // 120 局实测 30.8%，初校
  },
  {
    id: 'ach_match_made',
    name: '相识即缘分',
    desc: '从一次相遇走到结婚——相亲、旧识、同事、兴趣班或交友软件',
    check: (s) =>
      s.tags.includes('married') &&
      (s.tags.includes('went_blind_date') ||
        s.tags.includes('went_old_flame') ||
        s.tags.includes('went_colleague') ||
        s.tags.includes('went_club') ||
        s.tags.includes('went_app')),
    rarity: 'rare', // 120 局实测 23.3%，初校
  },
  {
    id: 'ach_next_door',
    name: '远亲不如对门',
    desc: '和对门互相托付过钥匙',
    check: (s) => s.tags.includes('neighbor_bond'),
    rarity: 'common', // 120 局实测 59.2%，初校
  },
  // ── 第 72 轮：成就三期（46→52）——全部读 V4 新机制落下的真实状态 ──
  {
    id: 'ach_sibling_bond',
    name: '手足情深',
    desc: '年过半百，还有能说体己话的手足在',
    check: (s) =>
      s.age >= 50 && s.relations.some((r) => r.kind === 'sibling' && r.alive && r.closeness >= 60),
    rarity: 'rare', // 手足衰减 −1/年，无维护到 50 岁余 ~33——须 R65 事件线维养，千局终校
  },
  {
    id: 'ach_soul_buddy',
    name: '挚友如兄',
    desc: '四十五岁往后，挚友的交情还热着',
    check: (s) =>
      s.age >= 45 &&
      s.relations.some((r) => r.kind === 'friend' && r.alive && r.bestFriend && r.closeness >= 75),
    rarity: 'epic', // 挚友标记（≥60 盖）探针 3.5% 局，75+ 更窄——千局终校
  },
  {
    id: 'ach_grad_studies',
    name: '学无止境',
    desc: '工作以后，还把书读到了更高处',
    check: (s) => s.education === 'master' || s.education === 'phd',
    rarity: 'rare', // 深造链（在职考研/读博）毕业后达成
  },
  {
    id: 'ach_marriage_mended',
    name: '雨过天晴',
    desc: '婚姻亮过红灯，但你们一起把它修好了',
    check: (s) => s.tags.includes('marriage_mended'),
    rarity: 'rare', // 危机线（≈9% 局）×修复支占比——千局终校
  },
  {
    id: 'ach_pet_forever',
    name: '它们的一生',
    desc: '送别了一只陪了你十二年以上的毛孩子',
    check: (s) =>
      s.relations.some(
        (r) => r.kind === 'pet' && r.deceased && typeof r.deathAge === 'number' && r.deathAge >= 12,
      ),
    rarity: 'rare', // 第 79 轮千局终校 24.1%：对齐 rare 档中位（iron_body 23.9%/pet 24.4% 同带）
  },
  {
    id: 'ach_burnout_resilience',
    name: '倦怠突围',
    desc: '从心里那场大雾里，自己走了出来',
    check: (s) =>
      s.seenEvents.includes('mid_burnout_onset') &&
      !s.tags.includes('burnout') &&
      s.attrs.happiness >= 50,
    rarity: 'rare', // 倦怠授予 16.5% × 恢复口径——千局终校
  },

  // ── V5 机制成就（第 100 轮，52→59）──
  // 防撞盘点：任务书列出的 8 枚中「三代同堂志」与既有 ach_three_generations 同题
  // （均以孙辈在册为条件），故**不重复实现**，本轮新增 7 枚。
  // 区分点留痕：
  //   · 安得广厦 vs ach_mortgage_cleared —— 后者只要「曾背房贷且还清」tag，
  //     卖房也会打上；广厦额外要求**房册在册**（ownsHome），卖房即失格。
  //   · 破而后立 vs ach_marriage_mended —— 后者只要修复线打过 tag（含未离婚的
  //     冷战争修复）；破而后立必须是 **已完成离婚 → 再婚**，故要求
  //     seenEvents 走过 div_sign_papers（协议已签，divorce 效果落地），
  //     且当下 married + 在册配偶并存。marriage_mended 不作为充分条件。
  //     R100 修正：**不可用 divorced 常驻标记** —— div_remarry 复婚时
  //     removeTags:['divorced']，故「divorced 与 married 同时在册」永不可达
  //     （400局抽测 0 次的根因），改用 seenEvents 历史证据。
  {
    id: 'ach_civil_anchor',
    name: '上岸',
    desc: '考公上岸，而且在体制里扎下了根——任职满三年',
    check: (s) =>
      s.tags.includes('civil_servant') &&
      (s.workYears ?? 0) >= 3,
    rarity: 'rare', // R100 400 局初校：考公录取≈9% × 满三年任职——R104 终校
  },
  {
    id: 'ach_home_kept',
    name: '安得广厦',
    desc: '有一栋写着你名字的房子，且还清了贷款',
    check: (s) => s.home !== undefined && s.tags.includes('mortgage_cleared'),
    rarity: 'rare', // 与房贷结清区分：房在册 + 已还清（卖房即失格）
  },
  {
    id: 'ach_monetized_fame',
    name: '流量时代',
    desc: '有了名气，也真的把名气换成了钱',
    check: (s) => s.tags.includes('minor_fame') && s.money >= 500000,
    rarity: 'epic', // 小有名气 + 五十万门槛——R104 终校
  },
  {
    id: 'ach_rebuilt_after_divorce',
    name: '破而后立',
    desc: '离过婚，后来又认真爱了一个人',
    check: (s) =>
      s.seenEvents.includes('div_sign_papers') &&
      s.tags.includes('married') &&
      s.relations.some((r) => r.kind === 'spouse' && r.alive),
    rarity: 'epic', // 离婚线≈4% × 再婚成功率——R104 终校
  },
  {
    id: 'ach_dink_life',
    name: '丁克一生',
    desc: '说好不要孩子，然后真的没有要',
    check: (s) => s.tags.includes('dink') && !s.relations.some((r) => r.kind === 'child'),
    rarity: 'rare', // 丁克约定 + 终局无子女在册
  },
  {
    id: 'ach_returnee_studied',
    name: '负笈远游',
    desc: '看过世界，回来继续念书',
    check: (s) =>
      (s.tags.includes('abroad_year') || s.tags.includes('studied_abroad')) &&
      ['bachelor', 'master', 'phd'].includes(s.education),
    rarity: 'epic', // 留学链 + 深造学历双条件——R104 终校
  },
  {
    id: 'ach_claim_paid',
    name: '有备无患',
    desc: '关键时刻，那份保单真的赔了钱',
    // 理赔落地（events.ts）把 insurance 置 undefined，无常驻字段可读；
    // 故走 seenEvents——hlt_major_surgery 是理赔型大额手术事件（R85 医保链），
    // 与「投保后出险」同一条事件，即为理赔到账的证据。
    check: (s) => s.seenEvents.includes('hlt_major_surgery') && !s.insurance,
    rarity: 'rare', // 投保≈35% × 大额手术≈9%——R104 终校
  },
]

/** 当前状态新达成的成就（未解锁且条件满足） */
export function evaluateAchievements(state: GameState): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.check(state))
}

/** 成就解锁产生的履历条目（key 履历，结局总结可引用） */
export function achievementEntry(state: GameState, a: AchievementDef): HistoryEntry {
  return {
    age: state.age,
    eventId: 'ach',
    title: '成就达成',
    choice: '',
    summary: `达成成就「${a.name}」`,
    key: true,
  }
}

/**
 * 落账解锁（纯函数）：achievements 追加 + 每个成就追加一条 key 履历。
 * 无新成就时原样返回。UI 用 eventId==='ach' 的履历条目展示解锁提示。
 */
export function unlockAchievements(state: GameState): { state: GameState; unlocked: AchievementDef[] } {
  const unlocked = evaluateAchievements(state)
  if (unlocked.length === 0) return { state, unlocked }
  return {
    state: {
      ...state,
      achievements: [...state.achievements, ...unlocked.map((a) => a.id)],
      history: [...state.history, ...unlocked.map((a) => achievementEntry(state, a))],
    },
    unlocked,
  }
}
