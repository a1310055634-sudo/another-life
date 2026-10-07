// 第 49 轮：结局深化测试（13×3 变体补齐 + 定向分派 + 缺失结局可达性对照）
// 验收口径（PROMPT-V3.md 第 49 轮）：
// - 后记定向分派：classifyLifeForm 四形态；形态不匹配的定向变体被滤出候选池（永不选中）
// - 13 结局 × 3 变体 = 39 段（34 → 39）
// - 可达性：4 个 300 局未现结局（dream_lived/family_hearth/pillar/death_young）的
//   构造路径——outcomes.test 13 路径网已覆盖，本轮做显式对照断言
// - 白名单/黑名单扫描由 round30.test 全变体扫描自动覆盖新段（buildAll 含定向变体）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { judgeEnding } from './outcomes'
import {
  EPILOGUE_ENDING_IDS,
  epilogueVariantCount,
  buildEndingEpilogue,
  classifyLifeForm,
  type LifeForm,
} from './epilogues'
import type { GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function rel(kind: Relation['kind'], name: string): Relation {
  return { id: `${kind}_${name}`, kind, name, closeness: 60, alive: true }
}

/** 临终前构造态（与 outcomes.test nearEnd 同式：76 岁退休安全水位） */
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

describe('第 49 轮：13×3 变体补齐（95 轮 +3 结局 ×2 变体 = 45 段）', () => {
  it('16 结局各 ≥2 变体（39 + 6 = 45 段）', () => {
    expect(EPILOGUE_ENDING_IDS).toHaveLength(16)
    for (const id of EPILOGUE_ENDING_IDS) expect(epilogueVariantCount(id)).toBeGreaterThanOrEqual(2)
  })

  it('classifyLifeForm 四形态：family/career/solo/plain', () => {
    // family：已婚或有孩子
    expect(
      classifyLifeForm({
        name: 't', age: 76, mateName: '林秀', mateIsSpouse: true, kidNames: ['林小满'],
        petNames: [], parentsAlive: false, hasCompany: true, company: '', achNames: [],
        keyMoments: [], peakTitle: null, everEmployed: true, rich: false, solvent: true,
        memoir: false, mentor: false, craftLegacy: false,
      }),
    ).toBe<LifeForm>('family')
    // career：独身但有职业证据（头衔+在职史）
    expect(
      classifyLifeForm({
        name: 't', age: 76, mateName: null, mateIsSpouse: false, kidNames: [],
        petNames: [], parentsAlive: false, hasCompany: false, company: '', achNames: [],
        keyMoments: [], peakTitle: '资深店长', everEmployed: true, rich: false, solvent: true,
        memoir: false, mentor: false, craftLegacy: false,
      }),
    ).toBe<LifeForm>('career')
    // solo：无任何同行者
    expect(
      classifyLifeForm({
        name: 't', age: 76, mateName: null, mateIsSpouse: false, kidNames: [],
        petNames: [], parentsAlive: false, hasCompany: false, company: '', achNames: [],
        keyMoments: [], peakTitle: null, everEmployed: false, rich: false, solvent: true,
        memoir: false, mentor: false, craftLegacy: false,
      }),
    ).toBe<LifeForm>('solo')
    // plain：有恋人陪伴但未婚无孩（兜底）
    expect(
      classifyLifeForm({
        name: 't', age: 76, mateName: '老陶', mateIsSpouse: false, kidNames: [],
        petNames: [], parentsAlive: false, hasCompany: true, company: '', achNames: [],
        keyMoments: [], peakTitle: null, everEmployed: false, rich: false, solvent: true,
        memoir: false, mentor: false, craftLegacy: false,
      }),
    ).toBe<LifeForm>('plain')
  })
})

describe('第 49 轮：定向分派行为', () => {
  const SOLO_MARK = '一个人的债务，是一个人的长夜'
  const FAMILY_MARK = '还没长大'

  it('debt_shadow：solo 人生 12 seed 中可命中独身向定向段；family 人生永不命中（池过滤）', () => {
    const soloBase = nearEnd({ relations: [], attrs: { health: 40, happiness: 30, smarts: 50, social: 50, stress: 40 }, money: -60000 })
    let soloHits = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = makeGame(seed, { ...soloBase, seed })
      const ep = buildEndingEpilogue(s, 'debt_shadow').join('\n')
      if (ep.includes(SOLO_MARK)) soloHits++
    }
    expect(soloHits).toBeGreaterThanOrEqual(1) // solo 形态下定向段可达

    const famBase = nearEnd({
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 40, happiness: 30, smarts: 50, social: 50, stress: 40 },
      money: -60000,
    })
    for (let seed = 1; seed <= 24; seed++) {
      const s = makeGame(seed, { ...famBase, seed })
      const ep = buildEndingEpilogue(s, 'debt_shadow').join('\n')
      expect(ep.includes(SOLO_MARK), `family 态 seed=${seed} 不应命中 solo 定向段`).toBe(false)
    }
  })

  it('death_ill：family 人生可命中家庭向定向段；solo 人生该段永不出（含「还没长大」句仅 family）', () => {
    const famBase = nearEnd({
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 8, happiness: 40, smarts: 50, social: 50, stress: 40 },
      money: 20000,
    })
    let famHits = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = makeGame(seed, { ...famBase, seed })
      const ep = buildEndingEpilogue(s, 'death_ill').join('\n')
      if (ep.includes(FAMILY_MARK)) famHits++
    }
    expect(famHits).toBeGreaterThanOrEqual(1)

    const soloBase = nearEnd({ relations: [], attrs: { health: 8, happiness: 40, smarts: 50, social: 50, stress: 40 }, money: 20000 })
    for (let seed = 1; seed <= 24; seed++) {
      const s = makeGame(seed, { ...soloBase, seed })
      const ep = buildEndingEpilogue(s, 'death_ill').join('\n')
      expect(ep.includes(FAMILY_MARK), `solo 态 seed=${seed} 不应命中 family 定向段`).toBe(false)
    }
  })

  it('确定性：同构态同 seed 选取一致（定向语义下复现性保持）', () => {
    const a = buildEndingEpilogue(makeGame(7, { relations: [] }), 'debt_shadow')
    const b = buildEndingEpilogue(makeGame(7, { relations: [] }), 'debt_shadow')
    expect(a).toEqual(b)
  })
})

describe('第 49 轮：4 个模拟未现结局的构造可达对照', () => {
  // 300 局自然模拟只出现 9-10 种结局；以下 4 种的构造路径在此显式断言
  //（完整 13 路径网在 outcomes.test「13 种结局各自的可达路径」节，此处为验收对照）
  function runToEnd(s: GameState): GameState {
    let cur = s
    let guard = 0
    while (cur.phase === 'playing' && guard < 10) {
      guard++
      cur = advanceYear(cur)
    }
    return cur
  }

  it('death_young：38 岁健康耗尽 → 英年早逝', () => {
    const s = makeGame(7, {
      age: 38,
      attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 20 },
    })
    const end = runToEnd(s)
    expect(judgeEnding(end).id).toBe('death_young')
  })

  it('dream_lived：dream_full + 高幸福 + 不负债 → 热爱成真', () => {
    const s = nearEnd({
      tags: ['ever_employed', 'retired', 'dream_full'],
      attrs: { health: 60, happiness: 70, smarts: 50, social: 50, stress: 20 },
      money: 50000,
    })
    const end = runToEnd(s)
    expect(judgeEnding(end).id).toBe('dream_lived')
  })

  it('family_hearth：已婚有娃 + 高幸福 + 不负债 → 家和事兴', () => {
    const s = nearEnd({
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
      money: 80000,
    })
    const end = runToEnd(s)
    expect(judgeEnding(end).id).toBe('family_hearth')
  })

  it('pillar：照护父母 + 有娃 + 不负债 → 一家人的顶梁柱', () => {
    const s = nearEnd({
      tags: ['ever_employed', 'retired', 'cared_for_parents', 'has_child'],
      relations: [rel('child', '林小满')],
      attrs: { health: 55, happiness: 45, smarts: 50, social: 50, stress: 30 },
      money: 40000,
    })
    const end = runToEnd(s)
    expect(judgeEnding(end).id).toBe('pillar')
  })
})
