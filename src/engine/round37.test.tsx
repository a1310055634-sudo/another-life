// 第 37 轮（结局页「人生报告」改版）。
// 覆盖：buildReportStats 纯函数（五格素材、峰值含终局快照与负值语义、旧档退化、
// 家庭各形态与疏远不计）、pickKeyQuote（★ 转折年里的玩家选择、多条取末则、无则 null）、
// LifeReport 渲染（五格与金句两态）、13 结局 × 报告完整性（印章/五格/图表/后记/无占位符）、
// 特殊状态（空履历无金句、疏远不露、早亡报告完整）、CSS token（印章/数据格/金句/图表/后记）。
// 呈现轮：引擎/事件数据/存档零改动；13 结局构造表沿用 outcomes.test 的可达路径。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import EndingPage from '../pages/EndingPage'
import { buildReportStats, pickKeyQuote, LifeReport } from '../components/LifeReport'
import { createNewGame } from './init'
import { ENDINGS } from './outcomes'
import type { GameState, Relation, YearlySnapshot } from './types'
import type { Session } from './session'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

const rel = (kind: Relation['kind'], name: string, closeness = 70): Relation => ({
  id: `r_${kind}_${name}`,
  kind,
  name,
  closeness,
  alive: true,
})

const snap = (age: number, money: number): YearlySnapshot => ({
  age,
  money,
  attrs: { health: 50, happiness: 50, smarts: 50, social: 50, stress: 20 },
  career: { kind: 'none' },
})

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'frugal', name: '测试者' })
  return { ...base, ...patch }
}

/** 临终前一年的常规状态（同 outcomes.test 口径），报告测试在此基础上补快照/履历 */
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

const sess = (state: GameState): Session => ({
  state,
  currentEvent: null,
  awaitingAdvance: true,
  lastSummary: '',
  lastDeltas: [],
})

const NO_PLACEHOLDER = /undefined|NaN|\[object|占位/

// ── buildReportStats：五格素材 ───────────────────────────────

describe('buildReportStats：五格素材只读真实状态', () => {
  it('终龄/工龄/成就数直读状态；峰值 = 快照最高点与终局资产的较大者', () => {
    const s = nearEnd({
      workYears: 35,
      achievements: ['ach_a', 'ach_b', 'ach_c'],
      snapshots: [snap(18, 3000), snap(40, 80000), snap(75, 30000)],
    })
    const st = buildReportStats(s)
    expect(st.age).toBe(76)
    expect(st.peakMoney).toBe(80000)
    expect(st.workYears).toBe(35)
    expect(st.achCount).toBe(3)
  })

  it('终局年快照参与峰值：终局资产高于历史峰值时取终局值', () => {
    const s = nearEnd({ money: 120000, snapshots: [snap(18, 3000), snap(40, 80000), snap(76, 120000)] })
    expect(buildReportStats(s).peakMoney).toBe(120000)
  })

  it('全负资产线：峰值取最接近 0 的那个（仍是真实最高点），不是 0 也不是伪造值', () => {
    const s = nearEnd({ money: -80000, snapshots: [snap(18, -5000), snap(40, -1000), snap(76, -80000)] })
    expect(buildReportStats(s).peakMoney).toBe(-1000)
  })

  it('旧档退化：无快照峰值退化为终局资产，workYears 缺省视为 0', () => {
    const s = nearEnd({ snapshots: [] })
    delete (s as Partial<GameState>).workYears
    const st = buildReportStats(s)
    expect(st.peakMoney).toBe(30000)
    expect(st.workYears).toBe(0)
  })

  it('家庭各形态：伴侣·N孩 / 恋人 / 仅孩 / 仅宠 / 独身；疏远（alive=false）不计入', () => {
    expect(buildReportStats(nearEnd({ relations: [rel('spouse', '林秀'), rel('child', '林小满'), rel('child', '林小川'), rel('pet', '阿黄')] })).familyText).toBe('伴侣 · 2 孩')
    expect(buildReportStats(nearEnd({ relations: [rel('partner', '周宁')] })).familyText).toBe('恋人')
    expect(buildReportStats(nearEnd({ relations: [rel('child', '林小满'), rel('child', '林小川')] })).familyText).toBe('2 孩')
    expect(buildReportStats(nearEnd({ relations: [rel('pet', '阿黄'), rel('pet', '花花')] })).familyText).toBe('2 宠相伴')
    expect(buildReportStats(nearEnd({ relations: [] })).familyText).toBe('独身')
    const estranged = nearEnd({
      relations: [{ ...rel('spouse', '林秀'), alive: false, estranged: true }],
    })
    expect(buildReportStats(estranged).familyText).toBe('独身')
  })
})

// ── pickKeyQuote：金句素材 ───────────────────────────────────

describe('pickKeyQuote：取「关键年份」里玩家真实做出的选择', () => {
  const hist = (age: number, title: string, choice: string, key?: boolean) => ({
    age,
    eventId: key ? 'settle' : 'ev',
    title,
    choice,
    summary: '',
    key,
  })

  it('只在出现 ★ 条目的转折年里找选项：跳过普通年份、★ 条目自身不成金句、多条取最后一则', () => {
    const s = nearEnd({
      history: [
        hist(19, '普通事件', '选择了冒险'),
        hist(18, '高考放榜', '', true),
        hist(18, '填志愿', '报了外地的大学'),
        hist(42, '疏远', '', true),
        hist(42, '同学会', '去参加了聚会'),
        hist(50, '普通事件', '又做了个选择'),
      ],
    })
    expect(pickKeyQuote(s)).toEqual({ age: 42, title: '同学会', choice: '去参加了聚会' })
  })

  it('转折年里只有结算条目（无玩家选项）→ null；无任何 ★ 条目 → null；空履历 → null', () => {
    expect(
      pickKeyQuote(nearEnd({ history: [hist(18, '高考放榜', '', true), hist(19, '普通事件', '选择了冒险')] })),
    ).toBeNull()
    expect(pickKeyQuote(nearEnd({ history: [hist(19, '普通事件', '选择了冒险')] }))).toBeNull()
    expect(pickKeyQuote(nearEnd({ history: [] }))).toBeNull()
  })
})

// ── LifeReport 渲染 ─────────────────────────────────────────

describe('LifeReport：渲染', () => {
  it('五格齐备且值与素材一致；金句卡含选项原文与出处', () => {
    const s = nearEnd({
      workYears: 30,
      achievements: ['ach_a', 'ach_b'],
      snapshots: [snap(18, 1000), snap(50, 60000)],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      history: [
        { age: 42, eventId: 'ev', title: '父亲住院', choice: '把积蓄寄回家', summary: '', key: true },
      ],
    })
    const html = renderToStaticMarkup(<LifeReport state={s} />)
    expect((html.match(/class="report-stat"/g) ?? []).length).toBe(5)
    for (const label of ['终龄', '峰值资产', '家庭', '工龄', '成就']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('<b>76 岁</b>')
    expect(html).toContain('<b>¥60,000</b>')
    expect(html).toContain('<b>伴侣 · 1 孩</b>')
    expect(html).toContain('<b>30 年</b>')
    expect(html).toContain('<b>2 枚</b>')
    expect(html).toContain('report-quote')
    expect(html).toContain('把积蓄寄回家')
    expect(html).toContain('—— 42 岁 · 父亲住院')
  })

  it('无合格金句履历：金句卡整体隐藏，数据格不受影响', () => {
    const s = nearEnd({ history: [] })
    const html = renderToStaticMarkup(<LifeReport state={s} />)
    expect(html).not.toContain('report-quote')
    expect(html).not.toContain('关键抉择')
    expect((html.match(/class="report-stat"/g) ?? []).length).toBe(5)
  })
})

// ── 13 结局 × 报告完整性 ────────────────────────────────────

describe('人生报告：13 结局各自生成完整报告', () => {
  // 构造表沿用 outcomes.test 的可达路径（逐项已验证命中对应结局）
  const cases: Array<{ id: string; patch: Partial<GameState>; age?: number }> = [
    { id: 'death_young', patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 30 },
    { id: 'death_ill', patch: { attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 } }, age: 60 },
    {
      id: 'dream_lived',
      patch: {
        tags: ['ever_employed', 'retired', 'dream_full'],
        attrs: { health: 60, happiness: 68, smarts: 50, social: 50, stress: 20 },
        money: 20000,
      },
    },
    {
      id: 'legacy_flame',
      patch: {
        tags: ['ever_employed', 'retired', 'memoir', 'late_mentor'],
        attrs: { health: 60, happiness: 62, smarts: 50, social: 55, stress: 20 },
      },
    },
    {
      id: 'family_hearth',
      patch: {
        tags: ['ever_employed', 'retired', 'married', 'has_child'],
        relations: [rel('spouse', '林秀'), rel('child', '林小满')],
        attrs: { health: 60, happiness: 60, smarts: 50, social: 50, stress: 20 },
        money: 50000,
      },
    },
    {
      id: 'solitude_rich',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 60, happiness: 65, smarts: 50, social: 50, stress: 20 },
      },
    },
    {
      id: 'comeback',
      patch: {
        tags: ['ever_employed', 'retired', 'been_deep_debt'],
        money: 40000,
      },
    },
    {
      id: 'wealth_free',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 55, smarts: 50, social: 50, stress: 20 },
        money: 1_200_000,
      },
    },
    {
      id: 'pillar',
      patch: {
        tags: ['ever_employed', 'retired', 'cared_for_parents', 'has_child'],
        attrs: { health: 60, happiness: 45, smarts: 50, social: 50, stress: 30 },
        money: 20000,
      },
    },
    {
      id: 'labor_worn',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 40, smarts: 50, social: 50, stress: 35 },
        money: 30000,
      },
    },
    {
      id: 'debt_shadow',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 35 },
        money: -30000,
      },
    },
    {
      id: 'quiet_life',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 55, happiness: 50, smarts: 50, social: 50, stress: 25 },
        money: 60000,
      },
    },
    {
      id: 'gray_dusk',
      patch: {
        tags: ['ever_employed', 'retired'],
        attrs: { health: 40, happiness: 25, smarts: 50, social: 50, stress: 40 },
        money: 200000,
      },
    },
    {
      id: 'renowned',
      patch: {
        tags: ['minor_fame', 'ever_employed', 'retired'],
        achievements: ['a1', 'a2', 'a3', 'a4'],
        attrs: { health: 60, happiness: 55, smarts: 60, social: 70, stress: 20 },
        money: 80000,
      },
    },
    {
      id: 'philanthropist',
      patch: {
        tags: ['donor', 'ever_employed', 'retired'],
        attrs: { health: 60, happiness: 50, smarts: 50, social: 50, stress: 20 },
        money: 80000,
      },
    },
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

  it('构造表覆盖全部 16 个结局（95 轮 +3）', () => {
    expect(cases).toHaveLength(16)
    expect(new Set(cases.map((c) => c.id)).size).toBe(ENDINGS.length)
  })

  for (const c of cases) {
    it(`结局 ${c.id}：印章、五格数据、图表区、后记、雷达齐备且无占位符`, () => {
      const state = nearEnd({ ...c.patch, ...(c.age !== undefined ? { age: c.age } : {}) })
      expect(ENDINGS.find((e) => e.id === c.id)!.when(state)).toBe(true)
      const html = renderToStaticMarkup(<EndingPage session={sess(state)} onRestart={() => {}} />)
      const def = ENDINGS.find((e) => e.id === c.id)!
      // 报告头：印章评级与结局名
      expect(html).toContain(`grade-${def.grade}`)
      expect(html).toContain(def.name)
      expect(html).toContain('人生报告')
      // 数据区：五格 + 后记收束 + 雷达
      expect((html.match(/class="report-stat"/g) ?? []).length).toBe(5)
      expect(html).toContain('report-epilogue')
      expect(html).toContain('life-radar')
      // 特殊状态防线：不露 undefined / NaN / 占位符
      expect(NO_PLACEHOLDER.test(html)).toBe(false)
    })
  }

  it('早亡线（30 岁）：报告完整，终龄格如实显示 30 岁', () => {
    const state = nearEnd({
      age: 30,
      attrs: { health: 0, happiness: 50, smarts: 50, social: 50, stress: 0 },
    })
    const html = renderToStaticMarkup(<EndingPage session={sess(state)} onRestart={() => {}} />)
    expect(html).toContain('<b>30 岁</b>')
    expect(html).toContain('英年早逝')
    expect(NO_PLACEHOLDER.test(html)).toBe(false)
  })

  it('空履历（无名履历）：无金句卡、时间轴空态，数据五格与报告其余部分照常', () => {
    const state = nearEnd({ history: [] })
    const html = renderToStaticMarkup(<EndingPage session={sess(state)} onRestart={() => {}} />)
    expect(html).not.toContain('关键抉择')
    expect(html).toContain('平淡的一生，没有留下刻痕。')
    expect((html.match(/class="report-stat"/g) ?? []).length).toBe(5)
    expect(html).toContain('report-epilogue')
  })
})

// ── CSS：报告样式 token 体系 ─────────────────────────────────

describe('CSS：人生报告样式（token 体系）', () => {
  it('评级印章：圆形、内圈虚线、微倾，五级底色规则保留', () => {
    const seal = css.match(/\.ending-grade\s*\{[^}]*\}/)
    expect(seal).toBeTruthy()
    expect(seal![0]).toContain('width: var(--sp-64)')
    expect(seal![0]).toContain('height: var(--sp-64)')
    expect(seal![0]).toContain('border-radius: var(--radius-pill)')
    expect(seal![0]).toContain('transform: rotate(-4deg)')
    const ring = css.match(/\.ending-grade::after\s*\{[^}]*\}/)
    expect(ring).toBeTruthy()
    expect(ring![0]).toContain('inset: var(--sp-4)')
    expect(ring![0]).toContain('dashed var(--surface-raised)')
    // 第 53 轮格式适配：五色规则通用化为双选择器（往生录小章复用同色），语义不变
    expect(css).toContain('.ending-grade.grade-S,\n.legacy-grade.grade-S { background: var(--gold); }')
  })

  it('关键数据格：自适应网格与下陷面卡片全 token', () => {
    const grid = css.match(/\.report-stats\s*\{[^}]*\}/)
    expect(grid).toBeTruthy()
    expect(grid![0]).toContain('repeat(auto-fit, minmax(96px, 1fr))')
    expect(grid![0]).toContain('gap: var(--sp-8)')
    const cell = css.match(/\.report-stat\s*\{[^}]*\}/)
    expect(cell).toBeTruthy()
    expect(cell![0]).toContain('background: var(--surface-sunken)')
    expect(cell![0]).toContain('border: 1px solid var(--line)')
  })

  it('金句块：主题色左边线、引号由伪元素补齐、出处小字', () => {
    const quote = css.match(/\.report-quote\s*\{[^}]*\}/)
    expect(quote).toBeTruthy()
    expect(quote![0]).toContain('border-left: 3px solid var(--accent)')
    expect(quote![0]).toContain('background: var(--accent-soft)')
    expect(css).toMatch(/\.report-quote p::before\s*\{[^}]*content: '「'/)
    expect(css).toMatch(/\.report-quote p::after\s*\{[^}]*content: '」'/)
    const cite = css.match(/\.report-quote cite\s*\{[^}]*\}/)
    expect(cite).toBeTruthy()
    expect(cite![0]).toContain('var(--fs-sm)')
    expect(cite![0]).toContain('var(--muted)')
  })

  it('图表并排：flex-wrap 自动换行（窄屏堆叠不新增 @media），卡片弹性基准 280px', () => {
    const charts = css.match(/\.report-charts\s*\{[^}]*\}/)
    expect(charts).toBeTruthy()
    expect(charts![0]).toContain('display: flex')
    expect(charts![0]).toContain('flex-wrap: wrap')
    const child = css.match(/\.report-charts > \.card\s*\{[^}]*\}/)
    expect(child).toBeTruthy()
    expect(child![0]).toContain('flex: 1 1 280px')
  })

  it('后记收束：金边与金底 token', () => {
    const ep = css.match(/\.report-epilogue\s*\{[^}]*\}/)
    expect(ep).toBeTruthy()
    expect(ep![0]).toContain('border-left: 3px solid var(--gold)')
    expect(ep![0]).toContain('background: var(--gold-wash)')
  })
})
