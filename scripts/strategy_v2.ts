// 第 61 轮（V4）策略库 V2：family_line_v2 / study_line / friend_line——
// 旧策略零改动的并列扩展。本轮为 scripts 轮，产品源码（src/）零改动。
//
// 设计依据（R58 千局实证）：
// - F 段 family_line 的 death_ill 37% 偏高：其 relationship 类事件无脑选首项，
//   而照护父母/病榻类事件正是 relationship 类、首项都是「亲自照护」牺牲向——
//   v2 修正：健康虚弱（health<60）时退出「见机会就抓」，交回综合评分；
//   health 类事件选健康增益最大项（而非综合分兜底下的硬扛向）。
// - ach_first_degree / ach_phd 双 0%：机器人从不升学 → study_line 在 45 岁前
//   且 smarts 达标时选升学/深造向。
// - ach_old_friend 0%：friend 衰减 −2/年 全类型最快且无人维护 → friend_line
//   优先带正向 friend 关系效果的选项。
// ach_reunion（需先疏远父母再修复）与亲社会策略方向相反，预期保持 0%，如实记录。
import type { Effect, EventChoice } from '../src/engine/types'

export type V2Strategy = 'family_line_v2' | 'study_line' | 'friend_line'
export const V2_STRATEGIES: V2Strategy[] = ['family_line_v2', 'study_line', 'friend_line', 'civ_line']
export function isV2Strategy(s: string): s is V2Strategy {
  return (V2_STRATEGIES as string[]).includes(s)
}

export interface V2Ctx {
  health: number
  money: number
  age: number
  smarts: number
  category?: string
}

const ATTR_WEIGHT: Record<string, number> = {
  health: 3, happiness: 2, smarts: 0.3, social: 1, stress: -2,
}

/** 综合评分（与 round39_balance_sim 的 choiceScore 同式，生存最优兜底） */
export function choiceScore(c: EventChoice): number {
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

function bestGainIdx(vis: EventChoice[], gain: (e: Effect) => number): number {
  let best = -1
  let bestGain = 0
  vis.forEach((c, i) => {
    const g = c.effects.reduce((s, e) => s + gain(e), 0)
    if (g > bestGain) { bestGain = g; best = i }
  })
  return best
}

/**
 * V2 策略选择。优先级：
 * ① health 类事件：健康增益最大项优先（>0 才接管，否则落综合评分）；
 * ② study_line：education 类事件且 age<45 且 smarts≥55，选升学/悟性增益向；
 * ③ friend_line：relationship 类事件优先带正向 friend 效果的选项（维护向），
 *    无维护项时健康尚可保持接受向（入口类），虚弱交综合评分；
 * ④ family_line_v2 / study_line：relationship 类事件健康尚可（≥60）保持
 *    「接受向=首项」的抓机会语义，虚弱时交综合评分（不再硬扛照护）；
 * ⑤ 综合评分兜底（生存最优同式）。
 */
export function pickV2(vis: EventChoice[], strategy: V2Strategy, ctx: V2Ctx): number {
  const { health, age, smarts, category } = ctx
  if (category === 'health') {
    const h = bestGainIdx(vis, (e) => (e.attr === 'health' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) : 0))
    if (h >= 0) return h
  }
  if (strategy === 'study_line' && category === 'education' && age < 45 && smarts >= 55) {
    // 第 63 轮：备考段无 startEducation，靠 addSkill academics 识别「备考/自学」选项
    const t = bestGainIdx(vis, (e) =>
      (e.attr === 'smarts' && (e.delta ?? 0) > 0 ? (e.delta ?? 0) * 1.5 : 0)
      + (e.startEducation ? 5 : 0)
      + (e.addSkill?.id === 'academics' && (e.addSkill.delta ?? 0) > 0 ? (e.addSkill.delta ?? 0) * 1.5 : 0))
    if (t >= 0) return t
  }
  if (strategy === 'civ_line') {
    // 第 88 轮：考公路线——识别考公链选项（civilExam 考试/备考标记/升学 bachelor 向），
    // 其余健康向，综合评分兜底
    const civ = bestGainIdx(vis, (e) =>
      (e.civilExam ? 10 : 0)
      + (e.startEducation?.stage === 'bachelor' || e.startEducation?.stage === 'master' || e.startEducation?.stage === 'phd' ? 6 : 0)
      + (e.setEducation === 'bachelor' || e.setEducation === 'master' || e.setEducation === 'phd' ? 6 : 0)
      + (e.addSkill?.id === 'academics' && (e.addSkill.delta ?? 0) > 0 ? (e.addSkill.delta ?? 0) : 0))
    if (civ >= 0) return civ
  }
  if (strategy === 'friend_line' && category === 'relationship') {
    const f = bestGainIdx(vis, (e) =>
      e.relation?.kind === 'friend' && (e.relation.deltaCloseness ?? 0) > 0 ? (e.relation.deltaCloseness ?? 0) : 0)
    if (f >= 0) return f
    if (health >= 60) return 0
  } else if (category === 'relationship' && health >= 60) {
    // family_line_v2 / study_line 的抓机会语义（family_line 原样，仅加健康闸）
    return 0
  }
  let best = 0
  let bestScore = -Infinity
  vis.forEach((c, i) => {
    const sc = choiceScore(c)
    if (sc > bestScore) { bestScore = sc; best = i }
  })
  return best
}

/** 单测式自检：构造事件卡断言选中项。任何一条失败即 exit 1（不烧千局）。 */
export function selfCheckV2(): void {
  const cases: Array<{ name: string; vis: EventChoice[]; strategy: V2Strategy; ctx: V2Ctx; want: number }> = [
    {
      name: 'health 卡：治疗优先于硬扛',
      strategy: 'family_line_v2',
      ctx: { health: 50, money: 10000, age: 40, smarts: 60, category: 'health' },
      vis: [
        { text: '硬扛过去', effects: [{ attr: 'health', delta: -12 }] },
        { text: '去医院', effects: [{ attr: 'health', delta: 6 }, { money: -8000 }] },
      ],
      want: 1,
    },
    {
      name: 'health 卡全负增益：综合评分选最不伤项',
      strategy: 'family_line_v2',
      ctx: { health: 50, money: 10000, age: 40, smarts: 60, category: 'health' },
      vis: [
        { text: '保守调理', effects: [{ attr: 'health', delta: -5 }] },
        { text: '硬扛', effects: [{ attr: 'health', delta: -20 }] },
      ],
      want: 0,
    },
    {
      name: 'relationship 健康尚可：保持接受向（抓机会）',
      strategy: 'family_line_v2',
      ctx: { health: 70, money: 20000, age: 30, smarts: 60, category: 'relationship' },
      vis: [
        { text: '去相亲', effects: [{ relation: { kind: 'partner', add: true } }] },
        { text: '算了', effects: [] },
      ],
      want: 0,
    },
    {
      name: 'relationship 健康虚弱：交回综合评分（不再硬扛照护）',
      strategy: 'family_line_v2',
      ctx: { health: 40, money: 20000, age: 60, smarts: 60, category: 'relationship' },
      vis: [
        { text: '亲自照护', effects: [{ attr: 'health', delta: -8 }, { relation: { kind: 'parent', deltaCloseness: 3 } }] },
        { text: '请护工', effects: [{ money: -8000 }] },
      ],
      want: 1,
    },
    {
      name: 'education 深造向（study_line，45 岁前且 smarts 达标：宁可辞职也要读）',
      strategy: 'study_line',
      ctx: { health: 70, money: 20000, age: 30, smarts: 60, category: 'education' },
      vis: [
        { text: '继续上班', effects: [{ money: 20000 }] },
        { text: '辞职读博', effects: [{ startEducation: { stage: 'phd' } }, { money: -30000 }] },
      ],
      want: 1,
    },
    {
      name: 'education 超龄闸（study_line，45+ 不接管：综合评分留下上班）',
      strategy: 'study_line',
      ctx: { health: 70, money: 20000, age: 50, smarts: 60, category: 'education' },
      vis: [
        { text: '继续上班', effects: [{ money: 20000 }] },
        { text: '辞职读博', effects: [{ startEducation: { stage: 'phd' } }, { money: -30000 }] },
      ],
      want: 0,
    },
    {
      name: 'education 备考段（study_line：addSkill academics 识别备考向）',
      strategy: 'study_line',
      ctx: { health: 70, money: 20000, age: 30, smarts: 60, category: 'education' },
      vis: [
        { text: '报冲刺班备考', effects: [{ money: -3000 }, { addSkill: { id: 'academics', delta: 3 } }] },
        { text: '今年先不折腾', effects: [{ attr: 'happiness', delta: 1 }] },
      ],
      want: 0,
    },
    {
      name: 'friend 维护向（friend_line）',
      strategy: 'friend_line',
      ctx: { health: 70, money: 20000, age: 40, smarts: 60, category: 'relationship' },
      vis: [
        { text: '陪家人', effects: [{ relation: { kind: 'parent', deltaCloseness: 2 } }] },
        { text: '赴老友之约', effects: [{ relation: { kind: 'friend', deltaCloseness: 5 } }] },
      ],
      want: 1,
    },
    {
      name: 'friend 无维护项且健康虚弱：交综合评分（不硬扛）',
      strategy: 'friend_line',
      ctx: { health: 40, money: 20000, age: 60, smarts: 60, category: 'relationship' },
      vis: [
        { text: '亲自照护', effects: [{ attr: 'health', delta: -8 }, { relation: { kind: 'parent', deltaCloseness: 3 } }] },
        { text: '请护工', effects: [{ money: -8000 }] },
      ],
      want: 1,
    },
  ]
  let pass = 0
  for (const c of cases) {
    const got = pickV2(c.vis, c.strategy, c.ctx)
    if (got === c.want) {
      pass++
    } else {
      console.error(`[策略V2 自检 FAIL] ${c.name}：期望选 ${c.want}，实际选 ${got}`)
      process.exit(1)
    }
  }
  console.log(`[策略V2 自检] ${pass}/${cases.length} PASS`)
}
