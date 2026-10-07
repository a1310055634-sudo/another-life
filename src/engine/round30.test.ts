// 第 30 轮：结局后记测试。
// 覆盖：13 结局各有 2～3 个变体且全部可构建；「」引号素材 ⊆ 真实履历标题 ∪ 成就名 ∪ 出身/特质名
//（全变体 × 多状态锁定，不引用未发生的事）；空履历/无关系/疏远/特殊姓名对照不露 undefined、
// 原始 tag、占位符、编造的同行者；家庭线念真名；seed 确定性选取且各变体位可达；真实对局端到端走通。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { availableEvents, visibleChoices, applyChoice } from './events'
import { validateState } from './validate'
import { ALL_EVENTS } from '../data/events'
import { ACHIEVEMENTS } from './achievements'
import { ENDINGS, judgeEnding } from './outcomes'
import {
  buildEndingEpilogue,
  buildAllEndingEpilogues,
  epilogueVariantCount,
} from './epilogues'
import { getBackground } from '../data/backgrounds'
import { getTrait } from '../data/traits'
import type { GameState, HistoryEntry, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '测试者' })
  return { ...base, ...patch }
}

const rel = (kind: Relation['kind'], name: string, closeness = 70): Relation => ({
  id: `r_${kind}_${name}`,
  kind,
  name,
  closeness,
  alive: true,
})

const hist = (age: number, title: string, summary: string): HistoryEntry => ({
  age,
  eventId: 'settle',
  title,
  choice: '',
  summary,
  key: true,
})

/** 13 结局的代表性临终状态（与 outcomes.test 的可达路径同源，先自检判定命中防漂移） */
const ENDING_BASES: Record<string, { patch: Partial<GameState>; age?: number }> = {
  death_young: { patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 30 },
  death_ill: { patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 60 },
  dream_lived: {
    patch: {
      tags: ['ever_employed', 'retired', 'dream_full'],
      attrs: { health: 60, happiness: 68, smarts: 50, social: 50, stress: 20 },
      money: 20000,
    },
  },
  legacy_flame: {
    patch: {
      tags: ['ever_employed', 'retired', 'memoir', 'late_mentor'],
      attrs: { health: 60, happiness: 62, smarts: 50, social: 55, stress: 20 },
    },
  },
  family_hearth: {
    patch: {
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
      money: 50000,
    },
  },
  solitude_rich: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
    },
  },
  comeback: { patch: { tags: ['ever_employed', 'retired', 'been_deep_debt'], money: 40000 } },
  wealth_free: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 55, happiness: 55, smarts: 50, social: 50, stress: 20 },
      money: 1_200_000,
    },
  },
  pillar: {
    patch: {
      tags: ['ever_employed', 'retired', 'cared_for_parents', 'has_child'],
      attrs: { health: 60, happiness: 45, smarts: 50, social: 50, stress: 30 },
      money: 20000,
    },
  },
  labor_worn: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 55, happiness: 40, smarts: 50, social: 50, stress: 35 },
      money: 30000,
    },
  },
  debt_shadow: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 35 },
      money: -30000,
    },
  },
  quiet_life: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 25 },
      money: 60000,
    },
  },
  renowned: {
    patch: {
      tags: ['minor_fame', 'ever_employed', 'retired'],
      achievements: ['a1', 'a2', 'a3', 'a4'],
      attrs: { health: 60, happiness: 55, smarts: 60, social: 70, stress: 20 },
      money: 80000,
    },
  },
  philanthropist: {
    patch: {
      tags: ['donor', 'ever_employed', 'retired'],
      attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
      money: 80000,
    },
  },
  hermit: {
    patch: {
      tags: ['childfree_will', 'ever_employed', 'retired'],
      relations: [],
      attrs: { health: 45, happiness: 50, smarts: 50, social: 30, stress: 15 },
      money: 150000,
    },
  },
  gray_dusk: {
    patch: {
      tags: ['ever_employed', 'retired'],
      attrs: { health: 40, happiness: 25, smarts: 50, social: 50, stress: 40 },
      money: 200000,
    },
  },
}

/** 临终前一年的常规状态：76 岁、已退休、有社保记录（与 outcomes.test 同源，判定自检防漂移） */
function nearEnd(seed: number, patch: Partial<GameState> = {}): GameState {
  return makeGame(seed, {
    age: 76,
    career: { kind: 'retired', pension: 20000 },
    tags: ['ever_employed', 'retired'],
    attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
    money: 30000,
    ...patch,
  })
}

function baseStateFor(id: string, seed = 7): GameState {
  const { patch, age } = ENDING_BASES[id]
  return advanceYear(nearEnd(seed, age !== undefined ? { ...patch, age } : patch))
}

const RAW_TOKENS = [
  'undefined',
  'NaN',
  '{',
  '}',
  'dream_full',
  'ever_employed',
  'estranged_parent',
  'estranged_friend',
  'late_mentor',
  'dream_legacy',
  'memoir',
  'has_child',
  'married',
  'been_deep_debt',
  'cared_for_parents',
  'homeowner',
  'retired',
]

const expectClean = (lines: string[], ctx: string) => {
  for (const line of lines) {
    expect(line.trim().length, `${ctx} 段落不应为空白`).toBeGreaterThan(0)
    for (const tok of RAW_TOKENS) {
      expect(line.includes(tok), `${ctx} 泄露内部字段：「${tok}」→ ${line}`).toBe(false)
    }
  }
}

describe('第 30 轮：结局后记 · 结构与变体覆盖', () => {
  it('16 结局各有 2～3 个变体，每个变体可构建、段落 1～3 段且全部干净（95 轮 +3）', () => {
    expect(Object.keys(ENDING_BASES).length).toBe(ENDINGS.length)
    for (const ending of ENDINGS) {
      const base = baseStateFor(ending.id)
      expect(judgeEnding(base).id, `${ending.id} 基准态应命中自身`).toBe(ending.id)
      const variants = buildAllEndingEpilogues(base, ending.id)
      expect(
        variants.length,
        `${ending.id} 应有 2～3 个变体`,
      ).toBe(epilogueVariantCount(ending.id))
      expect(variants.length).toBeGreaterThanOrEqual(2)
      expect(variants.length).toBeLessThanOrEqual(3)
      variants.forEach((lines, vi) => {
        expect(lines.length, `${ending.id}#${vi} 段落数`).toBeGreaterThanOrEqual(1)
        expect(lines.length, `${ending.id}#${vi} 段落数`).toBeLessThanOrEqual(3)
        expectClean(lines, `${ending.id}#${vi}`)
      })
    }
  })

  it('每个结局至少一个变体念出姓名，姓名原样不被转义', () => {
    const specialName = '奥娜丽莎·德·热那亚'
    for (const ending of ENDINGS) {
      const base = { ...baseStateFor(ending.id), name: specialName }
      const variants = buildAllEndingEpilogues(base, ending.id)
      const named = variants.filter((lines) => lines.some((l) => l.includes(specialName)))
      expect(named.length, `${ending.id} 应至少一个变体念出姓名`).toBeGreaterThanOrEqual(1)
    }
  })
})

// ── 素材真实性 ──

describe('第 30 轮：结局后记 · 素材只来自真实状态', () => {
  const RICH_STATE: Partial<GameState> = {
    name: '李慕白',
    age: 76,
    career: { kind: 'retired', pension: 48000 },
    tags: [
      'ever_employed',
      'retired',
      'married',
      'has_child',
      'homeowner',
      'dream_full',
      'memoir',
      'late_mentor',
      'dream_legacy',
      'been_deep_debt',
      'cared_for_parents',
    ],
    relations: [rel('spouse', '周宁'), rel('child', '周小雨'), rel('parent', '父亲', 55), rel('pet', '煤球')],
    history: [
      hist(22, '考上了大学', '寒窗换来了录取通知书'),
      hist(30, '升任项目主管', '第一次带团队'),
      hist(45, '转行做了培训师', '把手艺变成课程'),
      hist(58, '还清房贷', '压了二十年的石头落了地'),
    ],
    achievements: ['ach_100k', 'ach_comeback', 'ach_senior_level'],
    attrs: { health: 62, happiness: 60, smarts: 55, social: 58, stress: 25 },
    money: 320000,
  }

  const POOR_STATE: Partial<GameState> = {
    age: 76,
    tags: ['ever_employed', 'retired'],
    attrs: { health: 55, happiness: 45, smarts: 50, social: 45, stress: 30 },
    money: 15000,
  }

  /** 「」引号内容必须 ⊆ 履历标题 ∪ 成就名 ∪ 出身名 ∪ 特质名 */
  function expectQuotesReal(state: GameState, ctx: string) {
    const allowed = new Set<string>([
      ...state.history.map((h) => h.title),
      ...state.achievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? ''),
      getBackground(state.backgroundId).name,
      getTrait(state.traitId).name,
    ])
    const variants = buildAllEndingEpilogues(state, ctx)
    for (const [vi, lines] of variants.entries()) {
      for (const line of lines) {
        for (const m of line.matchAll(/「([^」]+)」/g)) {
          expect(
            allowed.has(m[1]),
            `${ctx}#${vi} 引用了不存在的内容：「${m[1]}」`,
          ).toBe(true)
        }
      }
    }
  }

  it('富履历状态 × 13 结局 × 全变体：引号素材全部真实、无内部字段', () => {
    const rich = makeGame(7, RICH_STATE)
    for (const ending of ENDINGS) {
      const variants = buildAllEndingEpilogues(rich, ending.id)
      variants.forEach((lines, vi) => expectClean(lines, `rich/${ending.id}#${vi}`))
      expectQuotesReal(rich, ending.id)
    }
  })

  it('白板状态 × 13 结局 × 全变体：不编造引号、不编造同行者', () => {
    const poor = makeGame(7, { ...POOR_STATE, relations: [], history: [], achievements: [] })
    for (const ending of ENDINGS) {
      const variants = buildAllEndingEpilogues(poor, ending.id)
      variants.forEach((lines, vi) => {
        expectClean(lines, `poor/${ending.id}#${vi}`)
        for (const line of lines) {
          // 不得把不存在的伴侣当作在世陪伴者提及；「没有伴侣」式否定句放行
          const mentionsCompanion =
            line.includes('恋人') || (line.includes('伴侣') && !line.includes('没有伴侣'))
          expect(
            mentionsCompanion,
            `${ending.id}#${vi} 白板状态不应出现在世陪伴句 → ${line}`,
          ).toBe(false)
          expect(line.includes('孩子们'), `${ending.id}#${vi} 白板状态不应出现孩子句 → ${line}`).toBe(false)
        }
      })
      expectQuotesReal(poor, ending.id)
    }
  })

  it('家庭线念真名：家和事兴全变体含配偶名，其余结局至少一个变体提到家人', () => {
    const rich = makeGame(7, RICH_STATE)
    for (const ending of ENDINGS) {
      if (ending.id === 'solitude_rich') continue // 该结局定义上无在世伴侣，跳过配偶断言
      const variants = buildAllEndingEpilogues(rich, ending.id)
      if (ending.id === 'family_hearth') {
        variants.forEach((lines, vi) =>
          expect(lines.some((l) => l.includes('周宁')), `family_hearth#${vi} 应念出配偶真名`).toBe(true),
        )
      } else if (ending.id === 'hermit') {
        // 第 95 轮：hermit 后记语义即「把热闹还回去」——不提家人是叙事正确，豁免改验独处意象
        variants.forEach((lines, vi) =>
          expect(
            lines.some((l) => l.includes('自己') || l.includes('钟摆') || l.includes('留白')),
            `hermit#${vi} 应有独处意象`,
          ).toBe(true),
        )
      } else {
        const anyNamed = variants.some((lines) => lines.some((l) => l.includes('周宁') || l.includes('周小雨')))
        expect(anyNamed, `${ending.id} 应至少一个变体提到真实家人`).toBe(true)
      }
      if (ending.id !== 'hermit') {
        const anyone = variants.some((lines) => lines.some((l) => l.includes('周宁') || l.includes('周小雨')))
        expect(anyone, `${ending.id} 富家庭状态下应有人名落地`).toBe(true)
      }
    }
  })

  it('单身丰盈念孩子不念配偶：无偶有孩的富足独身线素材正确', () => {
    const soloRich = makeGame(7, {
      ...POOR_STATE,
      tags: ['ever_employed', 'retired'],
      relations: [rel('child', '周小雨')],
      attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
    })
    const variants = buildAllEndingEpilogues(soloRich, 'solitude_rich')
    const named = variants.some((lines) => lines.some((l) => l.includes('周小雨')))
    expect(named, '无偶有孩的独身线应至少一个变体提到孩子').toBe(true)
    for (const lines of variants) {
      for (const line of lines) {
        const mentionsCompanion =
          line.includes('恋人') || (line.includes('伴侣') && !line.includes('没有伴侣'))
        expect(mentionsCompanion, `不应出现在世伴侣句 → ${line}`).toBe(false)
      }
    }
  })

  it('疏远标记只作背景：后记全变体不露原始 tag', () => {
    const estranged = makeGame(7, {
      ...POOR_STATE,
      tags: ['ever_employed', 'retired', 'estranged_parent', 'estranged_friend'],
      relations: [],
      history: [],
      achievements: [],
    })
    for (const ending of ENDINGS) {
      const variants = buildAllEndingEpilogues(estranged, ending.id)
      variants.forEach((lines, vi) => expectClean(lines, `estranged/${ending.id}#${vi}`))
    }
  })
})

// ── 确定性与变体可达 ──

describe('第 30 轮：结局后记 · 确定性与变体可达', () => {
  it('同一状态反复调用结果完全一致（存档复现）', () => {
    const base = baseStateFor('family_hearth')
    const a = buildEndingEpilogue(base, 'family_hearth')
    const b = buildEndingEpilogue(base, 'family_hearth')
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('seed 决定变体位（第 49 轮定向分派语义）：选取恒属全变体集、同 seed 复现、12 seed 保持多样性', () => {
    // 语义变更注明：第 49 轮起选取改为「形态过滤候选池 + seed 取模」——
    // 与本局人生形态不匹配的定向变体会被滤出池（不再「均匀覆盖全部 len 位」，
    // 这是定向分派的预期行为）；有效性（picked ∈ 全集）与多样性（≥2）仍锁定。
    for (const ending of ENDINGS) {
      const hit = new Set<string>()
      for (let seed = 1; seed <= 12; seed++) {
        const state = baseStateFor(ending.id, seed)
        const all = buildAllEndingEpilogues(state, ending.id)
        const picked = buildEndingEpilogue(state, ending.id)
        expect(
          all.some((v) => JSON.stringify(v) === JSON.stringify(picked)),
          `${ending.id} seed=${seed} 选取应命中某个变体`,
        ).toBe(true)
        hit.add(JSON.stringify(picked))
      }
      expect(hit.size, `${ending.id} 12 seed 应命中 ≥2 个不同变体`).toBeGreaterThanOrEqual(2)
    }
  })

  it('未知结局 ID 走通用兜底：不崩溃、念姓名、干净', () => {
    const base = baseStateFor('quiet_life')
    const lines = buildEndingEpilogue(base, 'no_such_ending')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.some((l) => l.includes(base.name))).toBe(true)
    expectClean(lines, 'generic-fallback')
  })
})

// ── 端到端：真实对局 ──

describe('第 30 轮：结局后记 · 真实对局端到端', () => {
  const SEED = 20260916

  function playToEnd(patch: Partial<GameState>): GameState {
    let s = makeGame(SEED, { age: 51, ...patch })
    let guard = 0
    while (s.phase === 'playing' && guard < 40) {
      guard++
      const cands = availableEvents(s, ALL_EVENTS)
      if (cands.length > 0) {
        const chosen = cands[guard % cands.length]
        const vis = visibleChoices(s, chosen)
        if (vis.length > 0) {
          s = applyChoice(s, chosen, chosen.choices.indexOf(vis[0])).state
        }
      }
      s = advanceYear(s)
    }
    return s
  }

  it('家庭线完整人生：后记非空、干净、引号真实，与结局判定一致', () => {
    const s = playToEnd({
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 3, salary: 120000, yearsAtJob: 8 },
      tags: ['married', 'has_child', 'homeowner', 'ever_employed'],
      relations: [rel('spouse', '周宁'), rel('child', '周小雨')],
      money: 300000,
      attrs: { health: 70, happiness: 58, smarts: 55, social: 55, stress: 40 },
    })
    expect(s.phase).toBe('ended')
    expect(validateState(s).issues).toEqual([])
    const ending = judgeEnding(s)
    const epilogue = buildEndingEpilogue(s, ending.id)
    expect(epilogue.length).toBeGreaterThan(0)
    expectClean(epilogue, `端到端/${ending.id}`)
    const allowed = new Set<string>([
      ...s.history.map((h) => h.title),
      ...s.achievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? ''),
      getBackground(s.backgroundId).name,
      getTrait(s.traitId).name,
    ])
    for (const line of epilogue) {
      for (const m of line.matchAll(/「([^」]+)」/g)) {
        expect(allowed.has(m[1]), `端到端引用了不存在的内容：「${m[1]}」`).toBe(true)
      }
    }
  })

  it('单身清贫线完整人生：后记干净、无编造家人', () => {
    const s = playToEnd({
      career: { kind: 'none' },
      tags: ['chronic_pain', 'ever_employed'],
      relations: [rel('parent', '母亲', 55)],
      money: 8000,
      attrs: { health: 66, happiness: 46, smarts: 50, social: 50, stress: 50 },
    })
    expect(s.phase).toBe('ended')
    const ending = judgeEnding(s)
    const epilogue = buildEndingEpilogue(s, ending.id)
    expectClean(epilogue, `端到端/${ending.id}`)
    for (const line of epilogue) {
      expect(line.includes('伴侣'), '单身线不应出现伴侣句').toBe(false)
    }
  })
})
