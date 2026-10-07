// 第 17 轮：结局系统。
// 判定与内容分离：ENDINGS 是按优先级排列的结构化结局表（death 类硬条件最先判），
// judgeEnding 走表取第一个命中项，表尾 gray_dusk 恒真兜底——任何合法状态都有结局。
// buildEndingSummary 只从真实状态取材：履历条目原文、关系名、成就名、属性与财务事实，
// 绝不引用未发生的事件（有测试锁定这一点）。
import type { GameState, HistoryEntry } from './types'
import { getBackground } from '../data/backgrounds'
import { getTrait } from '../data/traits'
import { ACHIEVEMENTS } from './achievements'

export type EndingGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface EndingDef {
  id: string
  name: string
  desc: string
  grade: EndingGrade
  /** 命中该结局用到的维度（"综合多维度判定"的可读证据，UI 展示用） */
  dims: string[]
  /** 全部满足才命中；按数组顺序第一个命中的生效 */
  when: (s: GameState) => boolean
}

const hasAnyTag = (s: GameState, tags: string[]) => tags.some((t) => s.tags.includes(t))
const spouseAlive = (s: GameState) =>
  s.relations.some((r) => r.kind === 'spouse' && r.alive)
const partnerAlive = (s: GameState) =>
  s.relations.some((r) => (r.kind === 'partner' || r.kind === 'spouse') && r.alive)

/**
 * 结局表（优先级从高到低，特殊在前、宽泛在后）：
 * 1. 死亡方式是硬条件，最先判定；
 * 2. 评价类结局按「特殊经历 > 复合成就 > 宽泛兜底」排序，
 *    防止 quiet_life 这类宽泛条件吞掉传承/家庭/单身等特殊结局。
 */
export const ENDINGS: EndingDef[] = [
  // ── 死亡方式（硬条件）──
  // 两条件均接受 lethal_struck 标记（第 112 轮）：lethal 窄门选项结算后健康归零，
  // 但死亡年的自然漂移（<30 岁 +1/年）会把最终快照里的 health 抬回正数——
  // 判死只认健康值会漏判（实证：3 局 lethal 死亡被误分类为 debt_shadow）。
  {
    id: 'death_young',
    name: '英年早逝',
    desc: '故事停在了最好的年纪，令人叹息。',
    grade: 'D',
    dims: ['健康'],
    when: (s) => (s.attrs.health <= 0 || s.tags.includes('lethal_struck')) && s.age < 40,
  },
  {
    id: 'death_ill',
    name: '积劳成疾',
    desc: '身体是最后一根稻草，它终究没能扛住。',
    grade: 'D',
    dims: ['健康'],
    when: (s) => s.attrs.health <= 0 || s.tags.includes('lethal_struck'),
  },
  // ── 特殊经历（S 级：必须同时拿出热爱/传承与心情证据）──
  {
    id: 'dream_lived',
    name: '热爱成真',
    desc: '你没有把热爱留到「以后再说」，而是真的靠它活了一辈子。',
    grade: 'S',
    dims: ['热爱', '幸福', '财务'],
    when: (s) => s.tags.includes('dream_full') && s.attrs.happiness >= 65 && s.money >= 0,
  },
  {
    id: 'legacy_flame',
    name: '薪火不熄',
    desc: '手艺、故事或热爱有了传人，你的影响比寿命更长。',
    grade: 'S',
    dims: ['传承', '幸福', '社交'],
    when: (s) =>
      hasAnyTag(s, ['late_mentor', 'dream_legacy', 'memoir']) &&
      s.attrs.happiness >= 50 &&
      s.attrs.social >= 45,
  },
  // ── 复合成就（A 级：两条以上维度同时过硬）──
  {
    id: 'family_hearth',
    name: '家和事兴',
    desc: '一盏为家人留的灯，亮了一辈子。',
    grade: 'A',
    dims: ['家庭', '幸福', '财务'],
    when: (s) =>
      s.tags.includes('married') &&
      s.tags.includes('has_child') &&
      spouseAlive(s) &&
      s.attrs.happiness >= 55 &&
      s.money >= 0,
  },
  {
    id: 'solitude_rich',
    name: '一个人的丰盈',
    desc: '没有伴侣的人生剧本，被你过成了另一种圆满。',
    grade: 'A',
    dims: ['单身路线', '幸福', '健康'],
    when: (s) =>
      s.age >= 55 &&
      !partnerAlive(s) &&
      s.attrs.happiness >= 60 &&
      s.attrs.health >= 50,
  },
  {
    id: 'hermit',
    name: '隐士',
    desc: '热闹是他们的，你只想要山间的风和自己的钟摆。',
    grade: 'A',
    dims: ['幸福', '健康', '财务'],
    when: (s) =>
      s.age >= 60 &&
      s.tags.includes('childfree_will') &&
      s.money >= 100000 &&
      s.attrs.happiness >= 45,
  },
  {
    id: 'comeback',
    name: '东山再起',
    desc: '跌到过谷底的人，才知道站起来的每一步有多值钱。',
    grade: 'A',
    dims: ['财务', '心态'],
    when: (s) =>
      s.tags.includes('been_deep_debt') && s.money >= 0 && s.attrs.happiness >= 45,
  },
  {
    id: 'wealth_free',
    name: '财务自由',
    desc: '钱不再替你做决定——前提是你依然健康，也依然快乐。',
    grade: 'A',
    dims: ['财富', '幸福', '健康'],
    when: (s) =>
      s.money >= 1_000_000 && s.attrs.happiness >= 50 && s.attrs.health >= 40,
  },
  {
    id: 'pillar',
    name: '一家人的顶梁柱',
    desc: '上有老下有小的担子，你一句怨言都没有地挑到了最后。',
    grade: 'A',
    dims: ['家庭责任', '财务', '幸福'],
    when: (s) =>
      s.tags.includes('cared_for_parents') &&
      s.tags.includes('has_child') &&
      s.money >= 0 &&
      s.attrs.happiness >= 40,
  },
  // ── 普通与坎坷（B/C/D 级：宽泛条件排在最后）──
  {
    id: 'renowned',
    name: '声名远播',
    desc: '无数人隔着屏幕认识你——这一辈子，活得比大多数人热闹。',
    grade: 'A',
    dims: ['社交', '幸福', '财务'],
    when: (s) => s.tags.includes('minor_fame') && s.achievements.length >= 4 && s.money >= 0,
  },
  {
    id: 'philanthropist',
    name: '慈善之家',
    desc: '你挣来的东西，最后都流回了人海。',
    grade: 'A',
    dims: ['财务', '幸福'],
    when: (s) => s.tags.includes('donor') && s.money >= 50000 && s.attrs.happiness >= 45,
  },
  {
    id: 'labor_worn',
    name: '劳碌半生',
    desc: '一辈子都在为生计奔波，委屈了自己太多回。',
    grade: 'C',
    dims: ['财务', '幸福'],
    when: (s) => s.money >= 0 && s.money < 50_000 && s.attrs.happiness < 45,
  },
  {
    id: 'debt_shadow',
    name: '债影随行',
    desc: '账没还完，故事先翻了页。',
    grade: 'D',
    dims: ['财务'],
    when: (s) => s.money < 0,
  },
  {
    id: 'quiet_life',
    name: '平凡之路',
    desc: '没有惊天动地，但每一天都真实地活过了。',
    grade: 'B',
    dims: ['幸福', '健康'],
    when: (s) => s.attrs.happiness >= 35 && s.attrs.health >= 25,
  },
  {
    id: 'gray_dusk',
    name: '暮色沉沉',
    desc: '这一生攒下了些东西，却弄丢了过好它的心情。',
    grade: 'C',
    dims: ['幸福', '财务'],
    when: () => true,
  },
]

/** 按优先级判定结局（表尾恒真兜底，必返回一个结局） */
export function judgeEnding(state: GameState): EndingDef {
  for (const e of ENDINGS) {
    if (e.when(state)) return e
  }
  return ENDINGS[ENDINGS.length - 1]
}

/** 兼容旧调用形态：从结局 ID 取定义（找不到返回 null） */
export function endingById(id: string): EndingDef | null {
  return ENDINGS.find((e) => e.id === id) ?? null
}

/**
 * 终局年龄唯一来源（复验修正，对齐 SPEC §1 的 18～77 岁）：
 * lifecycle.advanceYear 的默认上限与 checkLifeEnd 都从这里取值，
 * 文档、引擎、UI 不允许各用各的年龄。
 */
export const DEFAULT_MAX_AGE = 77

/**
 * 自然结束判定：返回结束方式 ID（'natural_end' / 'death_ill' / 'death_young'），
 * 写入 state.endingId 供存档与履历使用；具体结局由 EndingPage 用 judgeEnding 现算。
 */
export function checkLifeEnd(state: GameState, maxAge: number = DEFAULT_MAX_AGE): string | null {
  // 致命一击（第 112 轮）：lethal 窄门选项授予的 lethal_struck 标记在册即判死，
  // 仍按年龄分流 death_young/death_ill——判定序与其余结局完全不动。只查健康
  // 归零会被年轻年的自然健康漂移（<30 岁 +1/年）从 0 复苏，标记是唯一的
  // 「漂移无法撤销」死亡通道；标记只由 lethal 效果授予（校验器限 once+散列门控）。
  if (state.attrs.health <= 0 || state.tags.includes('lethal_struck')) {
    return state.age < 40 ? 'death_young' : 'death_ill'
  }
  if (state.age >= maxAge) {
    return 'natural_end'
  }
  return null
}

/** 结局总结：全部素材来自真实状态 */
export interface EndingSummary {
  /** 按段落组织的总结文字（可包含空行分隔的组） */
  lines: string[]
  /** 被引用的关键履历条目（真实发生的人生转折） */
  highlights: HistoryEntry[]
}

/** 从履历里找晋升相关的关键条目（升职/转行的记录原文） */
function careerPeakLine(s: GameState): string | null {
  const promoted = s.history.filter(
    (h) => h.key && (h.summary.includes('升') || h.summary.includes('转行')),
  )
  if (promoted.length === 0) return null
  const last = promoted[promoted.length - 1]
  return `${last.age} 岁那年的「${last.title}」，把你送到了更高的位置`
}

/**
 * 组装结局总结。取材规则（测试锁定）：
 * - 人生转折：逐字引用 state.history 的条目；
 * - 人物：只取 state.relations 里的真实名字；
 * - 成就：只取 state.achievements 里的真实 ID 对应的名字；
 * - 其余句子只陈述属性/财务/职业/标记这类状态事实。
 */
export function buildEndingSummary(state: GameState): EndingSummary {
  const bg = getBackground(state.backgroundId)
  const trait = getTrait(state.traitId)
  const lines: string[] = []
  const highlights: HistoryEntry[] = []

  // 1) 起点：出身与性情（状态事实）
  lines.push(
    `${state.name}，${bg.name}出身，性子偏「${trait.name}」，${state.age} 岁走完了这一生。`,
  )

  // 2) 事业与晚年经济来源（职业状态 + 晋升履历原文）
  if (state.career.kind === 'retired') {
    lines.push(
      state.tags.includes('ever_employed')
        ? `你退休了，晚年靠每年 ${state.career.pension.toLocaleString('zh-CN')} 元退休金把日子过得有着落。`
        : `没有正式单位的人生，晚年靠零工和积蓄把日子过得平稳。`,
    )
  } else if (state.career.kind === 'employed') {
    lines.push(`直到最后一年，你还坚守在${state.career.jobTitle}的岗位上。`)
  } else if (state.career.kind === 'unemployed') {
    lines.push('人生的最后几年在待业与寻找中度过。')
  } else {
    lines.push('你一辈子没进过格子间，靠零工和手艺养活了自己。')
  }
  const peak = careerPeakLine(state)
  if (peak) lines.push(`${peak}。`)

  // 3) 感情线（只念真实的关系名）
  const spouse = state.relations.find((r) => r.kind === 'spouse' && r.alive)
  const partner = state.relations.find((r) => r.kind === 'partner' && r.alive)
  const kids = state.relations.filter((r) => r.kind === 'child' && r.alive)
  const pets = state.relations.filter((r) => r.kind === 'pet' && r.alive)
  const parents = state.relations.filter((r) => r.kind === 'parent' && r.alive)
  const company: string[] = []
  if (spouse) company.push(`伴侣${spouse.name}`)
  else if (partner) company.push(`恋人${partner.name}`)
  if (kids.length > 0) company.push(`孩子${kids.map((k) => k.name).join('、')}`)
  if (parents.length > 0) company.push('还在世的父母')
  if (pets.length > 0) company.push(`宠物${pets.map((p) => p.name).join('、')}`)
  if (company.length > 0) {
    lines.push(`走到终点时，身边有${company.join('、')}。`)
  } else {
    lines.push('走到终点时，身边没有太多牵挂，你把日子过成了自己的形状。')
  }
  if (state.tags.includes('estranged_parent') || state.tags.includes('estranged_friend')) {
    lines.push('也有一段断了来往的旧情谊，成了没能补上的遗憾。')
  }

  // 4) 财务底色（状态事实 + 引擎落账的标记）
  if (state.money >= 500_000) lines.push('你攒下了可观的家底，也攒下了说不出口的克制。')
  if (state.tags.includes('been_deep_debt') && state.money >= 0) {
    lines.push('你曾在深债里挣扎过，后来一步一步爬了回来。')
  }

  // 5) 人生转折（逐字引用 key 履历，取最后 4 条关键记录；成就另起一句，不作转折）
  const turningPoints = state.history.filter((h) => h.key && h.eventId !== 'ach').slice(-4)
  highlights.push(...turningPoints)
  if (highlights.length > 0) {
    lines.push(
      `回望来路：${highlights.map((h) => `${h.age} 岁「${h.title}」`).join('，')}。`,
    )
  }

  // 6) 成就（只念真实解锁的）
  const achNames = state.achievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n))
  if (achNames.length > 0) {
    lines.push(
      `一生解锁了 ${achNames.length} 个成就${achNames.length > 3 ? `，包括「${achNames.slice(0, 3).join('」「')}」等` : `：「${achNames.join('」「')}」`}。`,
    )
  }

  return { lines, highlights }
}
