// 第 103 轮（V5）策略库 V3：career_civil / investor / action_balanced——
// 让机器人会考公、会投资、会行动。旧策略（scripts/strategy_v2.ts 与 round39 内联的
// rotate/health_aware/survival_best/balanced/family_line）**零改动**，V3 为并列扩展。
// 本轮为 scripts 轮，产品源码（src/）零改动。
//
// ── 设计依据（R102 关账 + 本轮钩子盘点）────────────────────────────────
// 本轮先扫全池 282 事件统计各 Effect 钩子的分布（.r103/hooks.ts），得到三条硬事实：
//
// ① **`Effect.addTags` 全池零使用**——所有 `addTags` 都写在**选项层**
//    （`EventChoice.addTags`，如 civilservice.ts 的 civil_exam_prep）。
//    故 V2 的 `civ_line` 里 `(e.addTags?.includes('civil_exam_prep') ? 8 : 0)`
//    是在 `c.effects` 里找选项层字段，**该分支恒为 0、是死代码**。
//    → `career_civil` 同时读**选项层 addTags 与 effects 层 addTags**，备考链才真正推得动。
//    → `civ_line` 本轮**刻意不动**：它属新池控制组，改它会移动本轮正要建立的 V5 新基线，
//      属未记录的决策变更。缺陷如实登记于 PROGRESS.md 第 103 轮遗留①，留 R104/用户裁决。
//
// ② **体制内事件可泛化识别**：`civilservice.ts` 的 `civilEmployed` 门控是
//    `requires.tagsAny: ['civil_servant']`，故用「本局 tags 含 civil_servant」即可
//    判定当前处在体制内语境，无需硬编码 civ_* 事件 id。
//
// ③ **投资链钩子稀疏但确定**：`ensureFund`×1（fin_fund_start）/ `redeemFund`×2
//    （fin_fund_take_profit 牛市止盈、fin_fund_cut_loss 熊市割肉）/ `buyHome`×1
//    （mid_house_down_payment）/ `ensureInsurance`×2 / `sellHome`×1（home_sell_forced）。
//    稀疏正是需要专项策略代理的原因——综合评分会把这些「净支出大、单期回报不可见」
//    的选项全部排掉（买房首付 -10 万、投保 -8000 的即期 score 为负）。
//
// ── 三个策略的定位 ────────────────────────────────────────────────────
// career_civil：考公链全推进（备考→笔试→录取）+ 体制内维护（遴选/借调/办公室）
//              + 寒冬豁免（负债年不烧大额）。目标是让上岸率与体制内线可测。
// investor：定投/止盈全接 + 购房积极 + 投保积极 + **不卖房**（资产持有偏好）。
//          目标是让投资参与率与购房率可测。
// action_balanced：**策略自带行动策略**——每年优先在「健身/进修/体检」间轮换，
//          验证主动行动系统的千局影响。它在事件层退化为 balanced 综合评分。
//
// 随机纪律：本文件全部为确定性打分与轮换，**不引入任何 rng 调用**，
// 故不消耗主 rng 流、不影响 18 局零位移。
import type { Effect, EventChoice } from '../src/engine/types'

export type V3Strategy = 'career_civil' | 'investor' | 'action_balanced'
export const V3_STRATEGIES: V3Strategy[] = ['career_civil', 'investor', 'action_balanced']
export function isV3Strategy(s: string): s is V3Strategy {
  return (V3_STRATEGIES as string[]).includes(s)
}

export interface V3Ctx {
  health: number
  money: number
  age: number
  smarts: number
  category?: string
  /** 本局 tags——用于判定 civil_servant 体制内语境（钩子盘点结论②） */
  tags?: string[]
}

/** 综合评分（与 round39_balance_sim / strategy_v2 的 choiceScore 同式，生存最优兜底） */
function choiceScore(c: EventChoice): number {
  const ATTR: Record<string, number> = { health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2 }
  let score = 0
  for (const e of c.effects) {
    if (e.attr && e.delta) score += e.delta * (ATTR[e.attr] ?? 0)
    if (e.money) score += e.money / 30000
  }
  for (const d of c.delayed ?? []) {
    const de = (d as { effect?: { attr?: string; delta?: number; money?: number } }).effect
    if (de?.attr && de.delta) score += de.delta * (ATTR[de.attr] ?? 0) * 0.7
    if (de?.money) score += (de.money / 30000) * 0.7
  }
  return score
}

function bestBy(vis: EventChoice[], gain: (c: EventChoice) => number): number {
  let best = -1
  let bestGain = 0
  vis.forEach((c, i) => {
    const g = gain(c)
    if (g > bestGain) { bestGain = g; best = i }
  })
  return best
}

/**
 * 候选视图：把 vis 的下标与选项一起打包，使「过滤候选后算出的最优」能**映射回原 vis 下标**。
 * 第 103 轮自检即抓到此坑——寒冬豁免剔除大额项后若直接在过滤数组上取下标，
 * 返回的是过滤后位置而非 vis 位置，调用方按 vis 取选项即错配。
 */
interface CandView {
  /** 与原 vis 平行的下标表，值为原 vis 下标 */
  idx: number[]
  /** 与 idx 一一对应的选项 */
  vis: EventChoice[]
}

function buildCand(vis: EventChoice[], money: number): CandView {
  // 寒冬豁免：负债年（money<0）剔除大额支出项；全部被剔除时退回原候选（不制造无按钮局面）
  if (money >= 0) return { idx: vis.map((_, i) => i), vis }
  const keptIdx: number[] = []
  const keptVis: EventChoice[] = []
  const banned = bigSpendIdx(vis)
  vis.forEach((c, i) => {
    if (!banned.has(i)) { keptIdx.push(i); keptVis.push(c) }
  })
  if (keptIdx.length === 0) return { idx: vis.map((_, i) => i), vis }
  return { idx: keptIdx, vis: keptVis }
}

/** 在候选视图上取最优并映射回原 vis 下标；无正增益项时返回 -1 */
function bestIn(cv: CandView, gain: (c: EventChoice) => number): number {
  const k = bestBy(cv.vis, gain)
  return k >= 0 ? cv.idx[k] : -1
}

/** 效果层正向 attr 增益（health 专用） */
function healthGain(e: Effect): number {
  return e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0
}

/**
 * 寒冬豁免：负债年（money<0）不烧大额。
 * 口径与引擎 isBigSpend 同源（单期 money ≤ −3000 视为大额）。
 * 返回被豁免的选项下标集合；调用方在候选阶段剔除。
 */
function bigSpendIdx(vis: EventChoice[]): Set<number> {
  const out = new Set<number>()
  vis.forEach((c, i) => {
    if ((c.effects ?? []).some((e) => (e.money ?? 0) <= -3000)) out.add(i)
  })
  return out
}

// ══════════════════════════════════════════════════════════════════════
// career_civil：考公链全推进 + 体制内维护 + 寒冬豁免
// ══════════════════════════════════════════════════════════════════════
function pickCareerCivil(vis: EventChoice[], ctx: V3Ctx): number {
  const { health, money, tags = [] } = ctx
  const inCivil = tags.includes('civil_servant')
  // 寒冬豁免：负债年剔除大额支出项，缩小候选后再打分（其余策略不享此项）
  const cv = buildCand(vis, money)

  // ① 考公录取向：唯一入口 civ_exam（civilExam 效果），权重最高
  const exam = bestIn(cv, (c) => (c.effects.some((e) => e.civilExam) ? 14 : 0))
  if (exam >= 0) return exam

  // ② 备考标记向：**读选项层 addTags**（钩子盘点结论①：全池 addTags 都在选项层）
  //    这是 civ_line 缺失的一环——备考链（CIVILSERVICE 首个事件 civ_exam_prep）由此推得动
  const prep = bestIn(cv, (c) =>
    (c.addTags?.includes('civil_exam_prep') ? 12 : 0)
    + (c.effects.some((e) => e.addTags?.includes('civil_exam_prep')) ? 12 : 0)
    // 学业功底是考公的门槛，备考期一并加权
    + (c.effects.reduce((s, e) => s + (e.addSkill?.id === 'academics' ? (e.addSkill.delta ?? 0) * 2 : 0), 0)))
  if (prep >= 0) return prep

  // ③ 体制内维护：仅在本局已是 civil_servant 时接管
  //    打分口径 promote>能力(academics)>关系(social)>压力项>快乐项
  if (inCivil) {
    const gov = bestIn(cv, (c) =>
      c.effects.reduce((s, e) => s
        + (e.promote ? 10 : 0)
        + (e.addSkill?.id === 'academics' ? (e.addSkill.delta ?? 0) * 3 : 0)
        + (e.attr === 'social' ? (e.delta ?? 0) : 0)
        + (e.attr === 'stress' ? (e.delta ?? 0) * -1 : 0)
        + (e.attr === 'happiness' ? (e.delta ?? 0) : 0), 0))
    if (gov >= 0) return gov
  }

  // ④ 升学向：考公学历门槛（本科起步），本科/硕士/博士入学都算铺路
  const edu = bestIn(cv, (c) =>
    c.effects.reduce((s, e) => s
      + (e.startEducation && ['bachelor', 'master', 'phd'].includes(e.startEducation.stage) ? 6 : 0)
      + (e.setEducation && ['bachelor', 'master', 'phd'].includes(e.setEducation) ? 6 : 0), 0))
  if (edu >= 0) return edu

  // ⑤ 健康向（沿用 V2 口径：健康类事件取最大正向增益）
  if (ctx.category === 'health') {
    const h = bestIn(cv, (c) => c.effects.reduce((s, e) => s + healthGain(e), 0))
    if (h >= 0) return h
  }
  return scoreFallback(vis)
}

// ══════════════════════════════════════════════════════════════════════
// investor：定投/止盈全接 + 购房积极 + 投保积极 + 不卖房
// ══════════════════════════════════════════════════════════════════════
function pickInvestor(vis: EventChoice[], ctx: V3Ctx): number {
  const { health, money } = ctx
  const cv = buildCand(vis, money)

  // ① 定投开户：按年定额加权（6000 → 0.6 分，12000 → 1.2 分，故「狠一点」胜出）
  const fund = bestIn(cv, (c) =>
    c.effects.reduce((s, e) => s + (e.ensureFund ? e.ensureFund.annualContribution / 10000 : 0), 0))
  if (fund >= 0) return fund

  // ② 止盈/赎回：牛市止盈与熊市割肉**全接**（任务书「定投/止盈全接」）
  const redeem = bestIn(cv, (c) => c.effects.reduce((s, e) => s + (e.redeemFund ? 10 : 0), 0))
  if (redeem >= 0) return redeem

  // ③ 卖房意愿为负：资产持有偏好。forced 卖房事件里「不卖」向由综合评分接手
  //    （-10 < 0，bestIn 恒不接管，此处显式表达意图并留档）
  bestIn(cv, (c) => c.effects.reduce((s, e) => s + (e.sellHome ? -10 : 0), 0))

  // ④ 购房积极：按总价加权（大两居 > 小户型），月供成本不在本层比较
  const house = bestIn(cv, (c) =>
    c.effects.reduce((s, e) => s + (e.buyHome ? e.buyHome.total / 100000 : 0), 0))
  if (house >= 0) return house

  // ⑤ 投保积极：给正基数 + 按年缴档位加权（纯档位折算会得到负分而永不接管）
  const ins = bestIn(cv, (c) =>
    c.effects.reduce((s, e) => s + (e.ensureInsurance ? 2 + e.ensureInsurance.annualPremium / 10000 : 0), 0))
  if (ins >= 0) return ins

  // ⑥ 理赔：保单在册时该选项才可见，接了不亏
  const claim = bestIn(cv, (c) => c.effects.reduce((s, e) => s + (e.claimInsurance ? 8 : 0), 0))
  if (claim >= 0) return claim

  // ⑦ 提前还贷：现金充裕时优先降负债
  if (money > 100000) {
    const pay = bestIn(cv, (c) => c.effects.reduce((s, e) => s + (e.payMortgage ? 2 : 0), 0))
    if (pay >= 0) return pay
  }

  if (ctx.category === 'health') {
    const h = bestIn(cv, (c) => c.effects.reduce((s, e) => s + healthGain(e), 0))
    if (h >= 0) return h
  }
  return scoreFallback(vis)
}

// ══════════════════════════════════════════════════════════════════════
// action_balanced：事件层退化为综合评分（行动策略由 pickActionForTurn 承担）
// ══════════════════════════════════════════════════════════════════════
function pickActionBalanced(vis: EventChoice[]): number {
  return scoreFallback(vis)
}

/** 综合评分兜底（生存最优同式） */
function scoreFallback(vis: EventChoice[]): number {
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

// ── 行动轮策略（action_balanced 专用）────────────────────────────────
// 轮换优先级：act_gym（健身）→ act_study（进修）→ act_checkup（体检）→ act_recharge（独处）
// 不可用时顺延到下一项；全不可用返回 null（本年不行动）。**确定性轮换，零 rng。**
const ACTION_ROTATION = ['act_gym', 'act_study', 'act_checkup', 'act_recharge'] as const

/**
 * @param turn 局内轮次计数（用于轮换相位）
 * @returns 选中的行动 id；无可用项返回 null
 */
export function pickActionForTurn(
  availIds: string[], turn: number, strategy: string,
): string | null {
  if (strategy !== 'action_balanced') {
    // 非 V3 行动策略：沿用 R83 的取模口径（旧池行为逐位不变）
    if (availIds.length === 0) return null
    return availIds[turn % availIds.length]
  }
  const avail = new Set(availIds)
  const start = turn % ACTION_ROTATION.length
  for (let k = 0; k < ACTION_ROTATION.length; k++) {
    const id = ACTION_ROTATION[(start + k) % ACTION_ROTATION.length]
    if (avail.has(id)) return id
  }
  return null
}

export function pickV3(vis: EventChoice[], strategy: V3Strategy, ctx: V3Ctx): number {
  if (strategy === 'career_civil') return pickCareerCivil(vis, ctx)
  if (strategy === 'investor') return pickInvestor(vis, ctx)
  return pickActionBalanced(vis)
}

// ══════════════════════════════════════════════════════════════════════
// 构造卡自检（A1）：任一条失败即 exit 1，不烧千局
// ══════════════════════════════════════════════════════════════════════
export function selfCheckV3(): void {
  const cases: Array<{
    name: string; vis: EventChoice[]; strategy: V3Strategy; ctx: V3Ctx; want: number
  }> = [
    // ── career_civil ──
    {
      name: 'career_civil：考公录取向压过弃考',
      strategy: 'career_civil',
      ctx: { health: 70, money: 20000, age: 28, smarts: 60, category: 'career' },
      vis: [
        { text: '弃考', effects: [{ attr: 'stress', delta: 1 }] },
        { text: '走进考场', effects: [{ money: -200 }, { civilExam: true }] },
      ],
      want: 1,
    },
    {
      name: 'career_civil：备考标记在**选项层**也能被读到（civ_line 的死分支修复点）',
      strategy: 'career_civil',
      ctx: { health: 70, money: 20000, age: 26, smarts: 60, category: 'career' },
      vis: [
        { text: '今年先不折腾', effects: [{ attr: 'happiness', delta: 2 }] },
        { text: '报冲刺班', effects: [{ money: -3000 }, { addSkill: { id: 'academics', delta: 2 } }], addTags: ['civil_exam_prep'] },
      ],
      want: 1,
    },
    {
      name: 'career_civil：体制内语境下选晋升（civ_ceiling 遴选）',
      strategy: 'career_civil',
      ctx: { health: 70, money: 30000, age: 40, smarts: 60, category: 'career', tags: ['civil_servant'] },
      vis: [
        { text: '知足留守', effects: [{ attr: 'happiness', delta: 1 }] },
        { text: '报名冲刺', effects: [{ attr: 'stress', delta: 3 }, { promote: true }] },
      ],
      want: 1,
    },
    {
      name: 'career_civil：体制内语境下选「埋头写材料」（能力 > 人情）',
      strategy: 'career_civil',
      ctx: { health: 70, money: 30000, age: 35, smarts: 60, category: 'career', tags: ['civil_servant'] },
      vis: [
        { text: '走动走动', effects: [{ attr: 'social', delta: 3 }, { attr: 'stress', delta: 2 }] },
        { text: '埋头写材料', effects: [{ addSkill: { id: 'academics', delta: 1 } }] },
      ],
      want: 1,
    },
    {
      name: 'career_civil：无 civil_servant 标记时不接管体制内语境（交综合评分）',
      strategy: 'career_civil',
      ctx: { health: 70, money: 30000, age: 35, smarts: 60, category: 'career', tags: [] },
      vis: [
        { text: '走动走动', effects: [{ attr: 'social', delta: 3 }, { attr: 'stress', delta: 2 }] },
        { text: '埋头写材料', effects: [{ addSkill: { id: 'academics', delta: 1 } }] },
      ],
      // 综合评分：走动 = social 3×1 + stress 2×(−2) = −1；埋头 = academics 非 attr 记 0 分
      // → 0 > −1，落「埋头」。与「体制内语境」分支的 want=1 同解，但**走的路径不同**：
      // 此处证明 tags 门控真的把决定权交还了综合评分（若误接管则 academics×3 会改变结论）。
      want: 1,
    },
    {
      name: 'career_civil：寒冬豁免——负债年剔除大额备考班',
      strategy: 'career_civil',
      ctx: { health: 70, money: -8000, age: 26, smarts: 60, category: 'career' },
      vis: [
        { text: '报冲刺班（三千）', effects: [{ money: -3000 }, { addSkill: { id: 'academics', delta: 2 } }], addTags: ['civil_exam_prep'] },
        { text: '自己啃真题', effects: [{ addSkill: { id: 'academics', delta: 1 } }], addTags: ['civil_exam_prep'] },
      ],
      want: 1,
    },
    {
      name: 'career_civil：健康类事件取最大正向增益',
      strategy: 'career_civil',
      ctx: { health: 45, money: 20000, age: 60, smarts: 60, category: 'health' },
      vis: [
        { text: '硬扛', effects: [{ attr: 'health', delta: -12 }] },
        { text: '住院治', effects: [{ attr: 'health', delta: 8 }, { money: -2000 }] },
      ],
      want: 1,
    },
    // ── investor ──
    {
      name: 'investor：定投选高额档（12000 > 6000）',
      strategy: 'investor',
      ctx: { health: 70, money: 50000, age: 30, smarts: 60, category: 'money' },
      vis: [
        { text: '一年 6000', effects: [{ ensureFund: { annualContribution: 6000 } }] },
        { text: '一年 12000', effects: [{ ensureFund: { annualContribution: 12000 } }] },
        { text: '不碰', effects: [{ attr: 'smarts', delta: 1 }] },
      ],
      want: 1,
    },
    {
      name: 'investor：牛市止盈全接（不与「长期持有」同分）',
      strategy: 'investor',
      ctx: { health: 70, money: 50000, age: 40, smarts: 60, category: 'money' },
      vis: [
        { text: '全部赎回', effects: [{ redeemFund: true }] },
        { text: '拿住不动', effects: [{ attr: 'stress', delta: 1 }] },
      ],
      want: 0,
    },
    {
      name: 'investor：熊市割肉也接（止盈/割肉共用 redeemFund）',
      strategy: 'investor',
      ctx: { health: 70, money: 50000, age: 40, smarts: 60, category: 'money' },
      vis: [
        { text: '清仓离场', effects: [{ redeemFund: true }, { attr: 'stress', delta: -2 }] },
        { text: '继续定投', effects: [{ attr: 'smarts', delta: 1 }] },
      ],
      want: 0,
    },
    {
      name: 'investor：购房积极（选总价更高的大两居）',
      strategy: 'investor',
      ctx: { health: 70, money: 200000, age: 35, smarts: 60, category: 'money' },
      vis: [
        { text: '再等等', effects: [{ attr: 'stress', delta: -1 }] },
        { text: '买小户型', effects: [{ money: -70000 }, { buyHome: { total: 250000 } }] },
        { text: '掏空上车大两居', effects: [{ money: -100000 }, { buyHome: { total: 400000 } }] },
      ],
      want: 2,
    },
    {
      name: 'investor：卖房事件不选卖（不卖向交综合评分）',
      strategy: 'investor',
      ctx: { health: 70, money: 30000, age: 60, smarts: 60, category: 'money' },
      vis: [
        { text: '挂牌卖掉', effects: [{ sellHome: true }, { attr: 'stress', delta: 3 }] },
        { text: '扛着月供不卖', effects: [{ attr: 'stress', delta: 2 }] },
      ],
      want: 1,
    },
    {
      name: 'investor：投保积极',
      strategy: 'investor',
      ctx: { health: 70, money: 40000, age: 32, smarts: 60, category: 'money' },
      vis: [
        { text: '不投保', effects: [{ attr: 'smarts', delta: 1 }] },
        { text: '投保', effects: [{ money: -8000 }, { ensureInsurance: { annualPremium: 8000, benefit: 500000 } }] },
      ],
      want: 1,
    },
    // ── action_balanced ──
    {
      name: 'action_balanced：事件层 = 综合评分（stress 惩罚压过即期现金）',
      strategy: 'action_balanced',
      ctx: { health: 70, money: -5000, age: 40, smarts: 60, category: 'money' },
      vis: [
        { text: '接私活', effects: [{ money: 30000 }, { attr: 'stress', delta: 3 }] },
        { text: '省着花', effects: [{ money: 200 }] },
      ],
      // 接私活 = 30000/30000(=1) + stress 3×(−2) = −5；省着花 = 200/30000 = 0.007
      // → 选省着花。此用例锁定一条事实：action_balanced 的事件层**不是**见钱就抢，
      // 它的行动特性只体现在行动轮（pickActionForTurn），不外溢到事件选择。
      want: 1,
    },
  ]

  // 行动轮自检（不进主 cases 表，单独断言返回 id）
  const actionCases: Array<{ name: string; avail: string[]; turn: number; want: string | null }> = [
    { name: '轮换相位 0：健身', avail: ['act_gym', 'act_study', 'act_recharge'], turn: 0, want: 'act_gym' },
    { name: '轮换相位 1：进修', avail: ['act_gym', 'act_study', 'act_recharge'], turn: 1, want: 'act_study' },
    { name: '轮换相位 2：体检不可用则顺延到独处', avail: ['act_recharge', 'act_parents'], turn: 2, want: 'act_recharge' },
    { name: '健身已冷却：顺延到进修', avail: ['act_study', 'act_recharge'], turn: 0, want: 'act_study' },
    { name: '全不可用：返回 null（本年不行动）', avail: [], turn: 3, want: null },
    { name: '非 V3 策略：沿用 R83 取模口径（旧池行为逐位不变）', avail: ['act_parents', 'act_recharge'], turn: 3, want: 'act_recharge' },
  ]

  let pass = 0
  for (const c of cases) {
    const got = pickV3(c.vis, c.strategy, c.ctx)
    if (got === c.want) {
      pass++
    } else {
      console.error(`[策略V3 自检 FAIL] ${c.name}：期望选 ${c.want}，实际选 ${got}`)
      process.exit(1)
    }
  }
  for (const c of actionCases) {
    const strat = c.name.startsWith('非 V3') ? 'rotate' : 'action_balanced'
    const got = pickActionForTurn(c.avail, c.turn, strat)
    if (got === c.want) {
      pass++
    } else {
      console.error(`[策略V3 行动自检 FAIL] ${c.name}：期望 ${c.want}，实际 ${got}`)
      process.exit(1)
    }
  }
  console.log(`[策略V3 自检] ${pass}/${cases.length + actionCases.length} PASS`)
}
