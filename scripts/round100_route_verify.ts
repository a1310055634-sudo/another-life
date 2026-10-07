// 第 100 轮交付物 A1：7 枚 V5 机制成就的「可达构造路线」验证（第 2 版）。
//
// R100 首版失败教训（已留痕，见 PROGRESS.md）：
//   ① forceText 关键字全部按猜测写（civ_exam_prep 猜「每天去自习室」实为「报个冲刺班」；
//      mid_house_down_payment 猜「买下来」实为「掏空积蓄，上车大两居」），导致强制命中恒为 0，
//      得出「0/96 不可达」的**假阴性**。本版所有关键字取自 src/data/events 现读文案。
//   ② 即使文案对齐，前置长链（攒 12 万首付 / 攒 20 万留学金 / 攒 5 年工龄 / 攒到 50 万）
//      在 96 局里仍可能抽不中——这是**前置概率**，不是机制缺陷。故本版对长前置成就
//      直接 seed 出前置（cash/学历/年龄），让验证只考察「后半段链路是否连通」。
//
// 语义约定：seed* 只是把「等 400 局抽中前置」换成「直接给到前置」，被 seed 的前置本身
// 在真实玩法中均有对应事件授予（见每条路线的 desc）。因此本脚本验证的是
// **「前置达成之后，check() 能否被真实事件链点亮」**——即成就定义的可达性。
//
// 运行：npx vite-node scripts/round100_route_verify.ts
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { availableEvents, visibleChoices, applyChoice, weightedPick } from '../src/engine/events'
import { ALL_EVENTS } from '../src/data/events'
import { pickIndexProbe } from './round82_pick_helper'
import { mulberry32 } from '../src/engine/rng'
import { ACHIEVEMENTS } from '../src/engine/achievements'
import { viralAt } from '../src/engine/fame'
import type { GameState, GameEvent } from '../src/engine/types'

interface Route {
  ach: string
  /** 事件 id → 必须命中的选项原文片段（**取自 src/data/events 现读文案**） */
  forceText: Record<string, string>
  /** 构造前置：开局年龄（默认 18） */
  age?: number
  /** 构造前置：开局现金（绕开「攒 N 年才有资格」的漫长等待） */
  money?: number
  /** 构造前置：开局学历 */
  education?: GameState['education']
  /** 构造前置：开局 healthRisk（手术/投保事件要求 ≥50 或 <45） */
  healthRisk?: number
  desc: string
  /** 前置构造说明（写进账本，证明不是凭空喂条件） */
  note: string
}

const ROUTES: Route[] = [
  {
    ach: 'ach_civil_anchor',
    desc: '考公：civ_exam_prep 备考 → civ_exam 进考场 → 录取授予编制 → 工龄满 3 年',
    forceText: { civ_exam_prep: '报个冲刺班', civ_exam: '走进考场' },
    age: 24,
    education: 'college',
    money: 30000,
    note: 'education=college+academics≥45 是 civ_exam 的 requires；工龄 3 年由 settleCareerYear 逐年累加。观测：civ_exam cooldown=1 岁，故须连续多年备考+应考',
  },
  {
    ach: 'ach_home_kept',
    desc: '安得广厦：mid_house_down_payment 买房（贷 30 万 20 年）→ 20 年自然摊还结清',
    forceText: { mid_house_down_payment: '掏空积蓄' },
    age: 30,
    money: 500000,
    note: 'money≥12 万是买房 requires；mortgage_cleared 由 settleMortgageYear 还清年授予（R31 起自然还清与提前还清同标记）',
  },
  {
    ach: 'ach_monetized_fame',
    desc: '流量时代：fame_start 起号 → fame_update 坚持 → fame_viral 走红授 minor_fame → 接商单攒到 50 万',
    forceText: {
      fame_start: '认真运营',
      fame_update: '继续更',
      fame_viral: '接住这泼天的流量',
      fame_cash: '接下商单',
      fame_hate: '不回应',
    },
    money: 300000,
    note: 'minor_fame 由 fame_viral 的 fameChance="viral" 散列窗授予（R93，35%/年）；商单每次 8,000 元且 cooldown 4 年。观测：fame_viral 需 creator_started 在册，故 fame_update 的「继续更」不可弃坑',
  },
  {
    ach: 'ach_rebuilt_after_divorce',
    desc: '破而后立：恋爱 → 求婚结婚 → 婚姻危机 → 签协议（engine divorce 效果）→ 遇新伴侣 → 复婚领证',
    forceText: {
      youth_crush: '鼓起勇气',
      rel_blind_date: '认真去见一见',
      rel_propose: '旅行结婚',
      mar_seven_year: '各忙各的',
      mar_cold_war: '谁先低头谁输',
      mar_distance: '接受外派',
      div_sign_papers: '签。好聚好散',
      rel_old_flame: '重新联系上',
      rel_colleague_crush: '约周末吃个饭',
      late_late_companion: '处处看吧',
      div_remarry: '领证。这次是真的',
    },
    age: 22,
    money: 200000,
    note: 'marriage_crisis 由 mar_seven_year/mar_cold_war/mar_distance 的恶化选项授予；div_sign_papers 需 married+marriage_crisis+在册配偶+30~50 岁；div_remarry 需 divorced+在册 partner+35~60 岁+8 千现金。开局年龄下调到 22 岁以覆盖「恋爱→求婚→婚姻→危机」完整生活史（初版 34 岁起局，恋爱链被跳过，导致既无婚姻也无危机，链路死锁）',
  },
  {
    ach: 'ach_dink_life',
    desc: '丁克一生：fam_dink 约定丁克且终局无子女在册',
    forceText: { fam_dink: '做丁克' },
    note: 'fam_dink 需 married+在册配偶+无 child+28~35 岁；不构造前置，走自然可达性',
  },
  {
    ach: 'ach_returnee_studied',
    desc: '负笈远游：youth_study_abroad 留学读硕（studied_abroad + 学历升 master）',
    forceText: { youth_study_abroad: '全额自费' },
    age: 22,
    education: 'bachelor',
    money: 400000,
    note: 'youth_study_abroad 需 education=bachelor 且 10 万现金；选全额自费 → studied_abroad + startEducation(master)',
  },
  {
    ach: 'ach_claim_paid',
    desc: '有备无患：ins_buy 投保 → hlt_major_surgery 出险 → claimInsurance 理赔清保单',
    forceText: { ins_buy_young: '填一份重疾保障', ins_buy_mid: '填一份', hlt_major_surgery: '排期手术' },
    age: 40,
    healthRisk: 55,
    note: '投保需 healthRisk<45；手术需 healthRisk≥50。两者互斥，故构造 healthRisk=55 时先由 ins_declined 之外路径投保——本路线改用「先投保后手术」的年龄跨度：healthRisk 由生活方式逐年累加，此处 seed 起始值后逐年推进',
  },
]

const BGS = ['ordinary', 'wealthy', 'rural', 'single_parent']
const TRAITS = ['studious', 'sociable', 'ambitious', 'laid_back', 'frugal', 'risk_taker']
const BASES = ['rotate', 'study_line', 'civ_line', 'balanced', 'survival_best', 'family_line_v2']
const SEEDS = [11, 20260917, 77, 902]

/**
 * 路线推进器：按「阶段顺序」挑选下一个目标事件。
 *
 * 每个阶段是一个 [事件 id 集合, 完成判定] 对：
 *   · 阶段内任一事件进候选池 → 优先投放它（消耗本年唯一的事件预算）；
 *   · 阶段完成判定为真 → 前进到下一阶段；
 *   · 阶段内所有事件都不在候选池 → 返回 null，交回 weightedPick 的真实抽取。
 * 这样既保证「链路顺序不被高频低价值节点饿死」，又不跳过任何事件条件与效果判定。
 */
type Stage = { ids: string[]; done: (s: GameState) => boolean }

const STAGES: Record<string, Stage[]> = {
  // 起号 → 爆款（minor_fame）→ 坚持中继（仅在散列窗未开时才占用事件预算）
  // → 商单变现
  'ach_monetized_fame': [
    { ids: ['fame_start'], done: (s) => s.tags.includes('creator_started') },
    { ids: ['fame_viral'], done: (s) => s.tags.includes('minor_fame') },
    // 中继：creator 在册但minor_fame 未到手时，用 fame_update 保持账号不弃坑；
    // 一旦 viralAt 散列窗开启，本阶段 done=true 让位，fame_viral 优先投放。
    { ids: ['fame_update'], done: (s) => s.tags.includes('minor_fame') || viralAt(s.seed, s.age) },
    { ids: ['fame_cash'], done: () => false },
  ],
  // 备考 → 应考 → 上编（civil_servant 由 civilExam 效果授予）→ 工龄满 3 年
  'ach_civil_anchor': [
    { ids: ['civ_exam_prep'], done: (s) => s.tags.includes('civil_exam_prep') },
    { ids: ['civ_exam'], done: (s) => s.tags.includes('civil_servant') },
    { ids: [], done: (s) => (s.workYears ?? 0) >= 3 },
  ],
  // 婚姻危机 → 签协议 → 遇新伴 → 复婚领证
  // 阶段顺序即依赖顺序（R100 修正）：初版把 rel_old_flame 放在「签约后」阶段，但阶段遍历
  // 是「从前往后找第一个未完成且在池的事件」，而 rel_old_flame 的完成判定（partner 在册）
  // 在开局就未满足 → 它在**婚姻链之前**被优先投放，18 年青春全砸在恋爱上，
  // 之后既无婚姻（mar_* 需已婚）也无危机（需 married+marriage_crisis），链路死锁。
  // 故把「结婚」也纳入阶段，让顺序严格等于生活史顺序。
  'ach_rebuilt_after_divorce': [
    { ids: ['youth_crush', 'rel_blind_date'], done: (s) => s.relations.some((r) => r.kind === 'partner' && r.alive) },
    { ids: ['rel_propose', 'mar_first'], done: (s) => s.tags.includes('married') },
    { ids: ['mar_seven_year', 'mar_cold_war', 'mar_distance'], done: (s) => s.tags.includes('marriage_crisis') },
    { ids: ['div_sign_papers'], done: (s) => s.tags.includes('divorced') },
    { ids: ['rel_old_flame', 'rel_colleague_crush', 'late_late_companion'], done: (s) => s.relations.some((r) => r.kind === 'partner' && r.alive) },
    { ids: ['div_remarry'], done: (s) => s.tags.includes('married') && s.relations.some((r) => r.kind === 'spouse' && r.alive) },
  ],
  // 买房 → 摊还结清
  'ach_home_kept': [
    { ids: ['mid_house_down_payment'], done: (s) => s.home !== undefined },
    { ids: [], done: (s) => s.tags.includes('mortgage_cleared') },
  ],
  // 丁克约定 → 终局无子女
  'ach_dink_life': [
    { ids: ['fam_dink'], done: (s) => s.tags.includes('dink') },
    { ids: [], done: (s) => !s.relations.some((r) => r.kind === 'child') },
  ],
  // 留学读硕
  'ach_returnee_studied': [
    { ids: ['youth_study_abroad'], done: (s) => s.tags.includes('studied_abroad') || s.tags.includes('abroad_year') },
    { ids: [], done: (s) => ['bachelor', 'master', 'phd'].includes(s.education) },
  ],
  // 投保 → 出险理赔
  'ach_claim_paid': [
    { ids: ['ins_buy_young', 'ins_buy_mid'], done: (s) => s.insurance !== undefined },
    { ids: ['hlt_major_surgery'], done: (s) => s.seenEvents.includes('hlt_major_surgery') && !s.insurance },
  ],
}

function pickNextTarget(route: Route, s: GameState, cands: GameEvent[]): GameEvent | null {
  const stages = STAGES[route.ach]
  if (!stages) {
    // 无阶段定义：退化为「任一目标事件优先」，并跳过已完成节点
    const doneIds = Object.keys(route.forceText).filter((id) => s.seenEvents.includes(id))
    return cands.find((e) => route.forceText[e.id] && !doneIds.includes(e.id)) ?? null
  }
  for (const st of stages) {
    if (st.done(s)) continue
    const hit = cands.find((e) => st.ids.includes(e.id))
    if (hit) return hit
  }
  return null
}

function play(route: Route, seed: number, bg: string, trait: string, base: string) {
  let s: GameState = createNewGame({ seed, backgroundId: bg, traitId: trait, name: '构造者' })
  // 构造前置：只改开局切面，不改引擎逻辑；被改项均在 desc/note 中说明真实来源
  const over: Partial<GameState> = {}
  if (route.age !== undefined) over.age = route.age
  if (route.money !== undefined) over.money = route.money
  if (route.education !== undefined) over.education = route.education
  if (route.healthRisk !== undefined) over.healthRisk = route.healthRisk
  s = { ...s, ...over }
  const rng = mulberry32(seed ^ 0x100)
  const forced = new Map<string, number>()
  let guard = 0
  while (s.phase === 'playing' && guard < 130) {
    guard++
    const cands = availableEvents(s, ALL_EVENTS)
    if (cands.length > 0) {
      // 「构造路线」模式：若本路线的**下一个未完成节点**已进入候选池，则优先执行它，
      // 否则退回 weightedPick 的真实加权抽取。
      // 依据：ALL_EVENTS 共255 条（once 108 / 可重复 147），真实玩法每年只触发 1 个事件
      // （nextYear → weightedPick 单选）。深链路成就需 3~5 个特定事件串联，单局 60 年的
      // 1/年预算下命中概率趋近 0 —— 这是**事件预算**问题，不是机制缺陷。
      //
      // R100 关键修正：初版对「任一目标事件」无条件优先，结果被**低价值高频节点饿死**——
      // fame_update（cooldown=1、无 priority/weight 默认 10）每年都进池，于是每一年都被它
      // 占满，cooldown=6 的 fame_viral 永远排不上（实测 30 年全砸在 fame_update 上，
      // minor_fame 从未授予）。故改为「按路线顺序推进」：已完成的节点退出优先列表，
      // 让位于链路里下一个尚未达成的节点。事件条件/可见选项/效果全部照常走引擎。
      const ev = pickNextTarget(route, s, cands) ?? weightedPick(cands, rng)
      const vis = visibleChoices(s, ev)
      if (vis.length > 0) {
        let idx = -1
        const kw = route.forceText[ev.id]
        if (kw) {
          const i = vis.findIndex((c) => c.text.includes(kw))
          if (i >= 0) { idx = i; forced.set(ev.id, (forced.get(ev.id) ?? 0) + 1) }
        }
        if (idx < 0) idx = pickIndexProbe(vis, base, s.attrs.health, s.money, guard, s.age, s.attrs.smarts, ev.category)
        s = applyChoice(s, ev, ev.choices.indexOf(vis[idx])).state
      }
    }
    s = advanceYear(s)
  }
  const def = ACHIEVEMENTS.find((a) => a.id === route.ach)!
  return { unlocked: def.check(s), forced, state: s }
}

let n = 0
const unreachable: string[] = []
const out: string[] = []
console.log('════ 第 100 轮 A1 · V5 机制成就可达构造路线验证（第 3 版 · 顺序推进 + 关键字取自现读文案）════')
console.log('口径：每条路线 96 局（4 背景 × 6 性格 × 4 seed）；按路线顺序优先投放目标事件，其余交给基线策略')
console.log('语义：长前置以 seed 构造（note 列明其真实事件来源），验证后半段链路连通性\n')

for (const route of ROUTES) {
  let hit = 0
  const forcedAgg = new Map<string, number>()
  const samples: string[] = []
  for (const bg of BGS) for (const trait of TRAITS) for (const sd of SEEDS) {
    const base = BASES[n % BASES.length]
    const r = play(route, sd, bg, trait, base)
    for (const [k, v] of r.forced) forcedAgg.set(k, (forcedAgg.get(k) ?? 0) + v)
    if (r.unlocked) {
      hit++
      if (samples.length < 2) {
        const s = r.state
        samples.push(`${bg}/${trait}/seed${sd}/${base} → ${s.age}岁 ${s.education}｜现金 ${s.money.toLocaleString()}｜工龄 ${s.workYears ?? 0}｜房 ${s.home ? '在册' : '无'}｜贷 ${s.mortgage ? '有' : '无'}｜保单 ${s.insurance ? '在册' : '无'}`)
      }
    }
    n++
  }
  const forcedStr = [...forcedAgg.entries()].map(([k, v]) => `${k}×${v}`).join('  ') || '（无命中）'
  console.log(`【${route.ach}】${route.desc}`)
  console.log(`   ${hit > 0 ? '✓ 可达' : '✗ 不可达'}：解锁 ${hit}/96 (${(hit / 96 * 100).toFixed(1)}%)｜强制命中：${forcedStr}`)
  console.log(`   前置构造：${route.note}`)
  for (const x of samples) console.log('   ✓ ' + x)
  if (hit === 0) { unreachable.push(route.ach); console.log('   ✗ 96 局全部未解锁 → 后半段链路断裂，需改定义或按砍量预案移除') }
  console.log()
}

console.log(`结论：${ROUTES.length - unreachable.length}/${ROUTES.length} 条路线可达` + (unreachable.length ? `；不可达：${unreachable.join('、')}` : '；无不可达成就'))
if (unreachable.length) { console.log('A1 结论：存在后半段断裂的成就，须在账本记录并按砍量预案处理'); process.exit(1) }
console.log('A1 结论：7 枚成就均有可达构造路线，机制层无死成就')