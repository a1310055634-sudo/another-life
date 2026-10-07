// 第 31 轮：成就扩充与遗留清偿。
// 覆盖：成就 31→41（数据完整性、稀有度/隐藏字段、10 枚新成就逐枚正反）、
// 「房贷结清」资格标记的两路落账（提前还清 / 年度自然还清）、
// JobDef 逐级头衔（9 岗 × 满职级，入职/事件晋升/年度晋升三处接线）、
// 首页成就列表动态总数与隐藏成就遮罩（呈现层接线，零 CSS）。
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice } from './events'
import { employPatch, promotePatch, settleCareerYear } from './career'
import { ACHIEVEMENTS, evaluateAchievements } from './achievements'
import { JOB_CATALOG, getJob, jobTitleAt } from '../data/careers'
import { validateState } from './validate'
import HomePage from '../pages/HomePage'
import type { GameState, GameEvent } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

/** 正例：该成就出现在待解锁清单；反例：不在 */
const hits = (s: GameState, id: string) => evaluateAchievements(s).some((a) => a.id === id)

// ── 数据完整性 ────────────────────────────────────────────────

describe('成就数据完整性（第 31 轮扩容后）', () => {
  it('成就共 59 枚（第 50 轮 +5、第 72 轮 +6、第 100 轮 +7），id 唯一，每枚都有合法稀有度', () => {
    expect(ACHIEVEMENTS).toHaveLength(66)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(66)
    const RARITIES = ['common', 'rare', 'epic', 'legendary']
    for (const a of ACHIEVEMENTS) {
      expect(RARITIES).toContain(a.rarity)
      expect(a.name.length).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(0)
    }
  })

  it('隐藏成就恰 3 枚（登峰造极/学海无涯/百万家财），且 18 岁新档一枚都不命中', () => {
    const hidden = ACHIEVEMENTS.filter((a) => a.hidden)
    expect(hidden.map((a) => a.id).sort()).toEqual(['ach_million_home', 'ach_phd', 'ach_top_level'])
    const fresh = makeGame()
    for (const a of hidden) expect(a.check(fresh)).toBe(false)
  })

  it('链条成就四指定主题全部在册（房贷结清/白头偕老/三代同堂/岁月长河）', () => {
    for (const id of ['ach_mortgage_cleared', 'ach_grow_old_together', 'ach_three_generations', 'ach_full_lifespan']) {
      expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true)
    }
  })
})

// ── 10 枚新成就逐枚正反判定 ──────────────────────────────────

describe('链条成就：房贷结清 / 白头偕老 / 三代同堂 / 岁月长河', () => {
  it('房贷结清：有 mortgage_cleared 标记才命中', () => {
    expect(hits(makeGame(), 'ach_mortgage_cleared')).toBe(false)
    expect(hits(makeGame(42, { tags: ['mortgage_cleared'] }), 'ach_mortgage_cleared')).toBe(true)
  })

  it('白头偕老：已婚 + 60 岁 + 配偶在世；未结婚/配偶已故/59 岁都不算', () => {
    const spouse = { id: 'r_sp', kind: 'spouse' as const, name: '周宁', closeness: 70, alive: true }
    const positive = makeGame(42, { age: 62, tags: ['married'], relations: [spouse] })
    expect(hits(positive, 'ach_grow_old_together')).toBe(true)
    // 未婚同居（partner 不算配偶）
    const partner = { id: 'r_pa', kind: 'partner' as const, name: '周宁', closeness: 70, alive: true }
    expect(hits(makeGame(42, { age: 62, tags: ['married'], relations: [partner] }), 'ach_grow_old_together')).toBe(false)
    // 配偶已故
    expect(
      hits(makeGame(42, { age: 62, tags: ['married'], relations: [{ ...spouse, alive: false }] }), 'ach_grow_old_together'),
    ).toBe(false)
    // 59 岁差一年
    expect(hits(makeGame(42, { age: 59, tags: ['married'], relations: [spouse] }), 'ach_grow_old_together')).toBe(false)
  })

  it('三代同堂：50 岁 + 有存活孩子 + 孙辈证据（孩子带 ms_grandchild 或 grandparent_duty 标记）；无孙辈证据不算', () => {
    const child = { id: 'r_c1', kind: 'child' as const, name: '周小雪', closeness: 70, alive: true }
    const grandchildMilestone = { ...child, milestones: ['ms_wedding', 'ms_grandchild'] }
    expect(hits(makeGame(42, { age: 55, relations: [grandchildMilestone] }), 'ach_three_generations')).toBe(true)
    // V1 晚年带孙路径（grandparent_duty 标记）同样算数
    expect(
      hits(makeGame(42, { age: 55, tags: ['grandparent_duty'], relations: [child] }), 'ach_three_generations'),
    ).toBe(true)
    // 孩子在但没到孙辈（只有成家里程碑）
    expect(
      hits(makeGame(42, { age: 55, relations: [{ ...child, milestones: ['ms_wedding'] }] }), 'ach_three_generations'),
    ).toBe(false)
    // 无孩线完全不触发
    expect(hits(makeGame(42, { age: 55, tags: ['grandparent_duty'], relations: [] }), 'ach_three_generations')).toBe(false)
    // 孩子已故不算
    expect(
      hits(makeGame(42, { age: 55, relations: [{ ...grandchildMilestone, alive: false }] }), 'ach_three_generations'),
    ).toBe(false)
  })

  it('岁月长河：活满 77 岁才命中（76 岁差一年）', () => {
    expect(hits(makeGame(42, { age: 76 }), 'ach_full_lifespan')).toBe(false)
    expect(hits(makeGame(42, { age: 77 }), 'ach_full_lifespan')).toBe(true)
  })
})

describe('隐藏成就：登峰造极 / 学海无涯 / 百万家财', () => {
  it('登峰造极：在职且职级到达该岗位 maxLevel；未到顶/离职退休都不算', () => {
    const clerk = (level: number) =>
      makeGame(42, {
        career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政主管', level, salary: 60000, yearsAtJob: 1 },
      })
    expect(hits(clerk(2), 'ach_top_level')).toBe(false) // office_clerk maxLevel 3
    expect(hits(clerk(3), 'ach_top_level')).toBe(true)
    // 退休后职级清零，不再回头补发
    expect(
      hits(makeGame(42, { career: { kind: 'retired', pension: 30000 } }), 'ach_top_level'),
    ).toBe(false)
  })

  it('学海无涯：博士学位；硕士不算', () => {
    expect(hits(makeGame(42, { education: 'master' }), 'ach_phd')).toBe(false)
    expect(hits(makeGame(42, { education: 'phd' }), 'ach_phd')).toBe(true)
  })

  it('百万家财：40 岁后存款满百万；差一块钱与年轻巨款（富裕开局）都不算', () => {
    expect(hits(makeGame(42, { age: 42, money: 999999 }), 'ach_million_home')).toBe(false)
    expect(hits(makeGame(42, { age: 42, money: 1000000 }), 'ach_million_home')).toBe(true)
    // 年龄闸：22 岁的富裕开局（bg_wealthy 起始 20 万，即便手改到百万）不奖励
    expect(hits(makeGame(42, { age: 22, money: 1000000 }), 'ach_million_home')).toBe(false)
  })
})

describe('晚年成就：热爱成诗 / 莫逆之交 / 清风朗月', () => {
  it('热爱成诗：kept + bloom + full 三标记齐才命中，缺一不可', () => {
    const two = makeGame(42, { tags: ['dream_kept', 'dream_bloom'] })
    expect(hits(two, 'ach_dream_trilogy')).toBe(false)
    expect(hits({ ...two, tags: [...two.tags, 'dream_full'] }, 'ach_dream_trilogy')).toBe(true)
  })

  it('莫逆之交：55 岁 + 存活朋友亲密 85；差一分/已故/差一岁都不算', () => {
    const friend = (closeness: number, alive = true) => ({
      id: 'r_f1', kind: 'friend' as const, name: '老陈', closeness, alive,
    })
    expect(hits(makeGame(42, { age: 56, relations: [friend(85)] }), 'ach_old_friend')).toBe(true)
    expect(hits(makeGame(42, { age: 56, relations: [friend(84)] }), 'ach_old_friend')).toBe(false)
    expect(hits(makeGame(42, { age: 56, relations: [friend(85, false)] }), 'ach_old_friend')).toBe(false)
    expect(hits(makeGame(42, { age: 54, relations: [friend(85)] }), 'ach_old_friend')).toBe(false)
  })

  it('清风朗月：60 岁 + 健康 60 + 风险值 ≤5；健康不够或风险超标不算，旧档缺省风险视为 0', () => {
    const ok = { age: 62, attrs: { health: 62, happiness: 50, smarts: 50, social: 50, stress: 20 } }
    expect(hits(makeGame(42, { ...ok }), 'ach_clean_living')).toBe(true) // healthRisk 缺省 = 0
    expect(hits(makeGame(42, { ...ok, healthRisk: 0 }), 'ach_clean_living')).toBe(true)
    const lowHealth = { ...ok, attrs: { ...ok.attrs, health: 55 } }
    expect(hits(makeGame(42, lowHealth), 'ach_clean_living')).toBe(false)
    expect(hits(makeGame(42, { ...ok, healthRisk: 20 }), 'ach_clean_living')).toBe(false)
  })
})

// ── 房贷结清标记：两路落账 ────────────────────────────────────

describe('mortgage_cleared 标记（成就链资格）', () => {
  const payoffEvent: GameEvent = {
    id: 'test_mortgage_prepay',
    category: 'money',
    title: '提前还贷',
    text: '',
    minAge: 18,
    maxAge: 77,
    choices: [{ text: '还清这笔钱', effects: [{ payMortgage: 40000 }] }],
  }
  const withLoan = (balance: number, yearsLeft = 10) =>
    makeGame(42, {
      age: 35,
      money: 80000,
      mortgage: { principal: 300000, balance, annualPayment: 23900, yearsLeft },
    })

  it('提前还清（划扣 ≥ 余额）：销账 + 落标记', () => {
    const s = applyChoice(withLoan(30000), payoffEvent, 0)
    expect(s.state.mortgage).toBeUndefined()
    expect(s.state.tags).toContain('mortgage_cleared')
    expect(validateState(s.state).issues).toEqual([])
  })

  it('提前还一半：余额下降、不销账、不落标记', () => {
    const partial = applyChoice(
      withLoan(30000),
      { ...payoffEvent, choices: [{ text: '还一笔', effects: [{ payMortgage: 20000 }] }] },
      0,
    )
    expect(partial.state.mortgage?.balance).toBe(10000)
    expect(partial.state.tags).not.toContain('mortgage_cleared')
  })

  it('年度自然还清（yearsLeft=1 自动结清）：同样落标记且销账', () => {
    const next = advanceYear(withLoan(48000, 1))
    expect(next.mortgage).toBeUndefined()
    expect(next.tags).toContain('mortgage_cleared')
    expect(next.history.some((h) => h.title === '还清房贷')).toBe(true)
    expect(validateState(next).issues).toEqual([])
  })

  it('有贷未还清的年份不落标记', () => {
    const next = advanceYear(withLoan(280000, 19))
    expect(next.mortgage).toBeDefined()
    expect(next.tags).not.toContain('mortgage_cleared')
  })
})

// ── 逐级头衔（清偿 V1 遗留）──────────────────────────────────

describe('JobDef 逐级头衔', () => {
  it('11 个岗位每个都有满职级头衔表：长度 = maxLevel、无空串、入职头衔 = 岗位名（88 轮体制内 2 岗）', () => {
    expect(JOB_CATALOG).toHaveLength(11)
    for (const job of JOB_CATALOG) {
      const maxLevel = job.maxLevel ?? 4
      expect(job.titles, job.id).toHaveLength(maxLevel)
      expect(job.titles![0], job.id).toBe(job.title)
      for (const t of job.titles!) expect(t.trim().length).toBeGreaterThan(0)
    }
  })

  it('jobTitleAt：按职级取头衔，越界/缺表回退岗位名', () => {
    const dev = getJob('junior_dev')!
    expect(jobTitleAt(dev, 1)).toBe('初级程序员')
    expect(jobTitleAt(dev, 4)).toBe('技术组长')
    expect(jobTitleAt(dev, 99)).toBe('初级程序员') // 越界回退
    expect(jobTitleAt({ ...dev, titles: undefined }, 3)).toBe('初级程序员') // 缺表回退
  })

  it('入职：头衔 = 该岗位 1 级头衔', () => {
    const grad = makeGame(42, { age: 22, education: 'bachelor', skills: { academics: 60, vocational: 20 } })
    const patch = employPatch(grad, 'junior_dev')
    expect(patch.ok).toBe(true)
    expect(patch.career).toMatchObject({ kind: 'employed', jobId: 'junior_dev', jobTitle: '初级程序员', level: 1 })
  })

  it('事件晋升：职级 +1 且头衔跟着换（程序员 → 资深程序员）', () => {
    const base = makeGame(42, {
      age: 26,
      career: { kind: 'employed', jobId: 'junior_dev', jobTitle: '初级程序员', level: 1, salary: 96000, yearsAtJob: 0 },
    })
    const up1 = promotePatch(base)
    expect(up1.ok).toBe(true)
    expect(up1.career).toMatchObject({ level: 2, jobTitle: '程序员' })
    const up2 = promotePatch({ ...base, career: up1.career })
    expect(up2.career).toMatchObject({ level: 3, jobTitle: '资深程序员' })
  })

  it('年度考核晋升：头衔更新进 career 与履历（「晋升为「程序员」（职级 2）」）', () => {
    const dev = makeGame(42, {
      age: 26,
      education: 'bachelor',
      career: { kind: 'employed', jobId: 'junior_dev', jobTitle: '初级程序员', level: 1, salary: 96000, yearsAtJob: 2 },
      skills: { academics: 63, vocational: 15 },
    })
    const out = settleCareerYear(dev, dev.skills)
    expect(out.career).toMatchObject({ kind: 'employed', level: 2, jobTitle: '程序员' })
    expect(out.history?.summary).toBe('晋升为「程序员」（职级 2）')
    // 全链走一遍：advanceYear 后顶栏数据源（career.jobTitle）已是新头衔
    const next = advanceYear(dev)
    expect(next.career).toMatchObject({ level: 2, jobTitle: '程序员' })
    expect(next.history.some((h) => h.title === '升职' && h.summary.includes('程序员'))).toBe(true)
  })
})

// ── 首页成就列表（呈现层接线：动态总数 + 隐藏遮罩）────────────

describe('HomePage 成就列表', () => {
  const render = (achievements: string[]) =>
    renderToStaticMarkup(
      <HomePage
        saveMeta={{ name: '测试者', age: 40, savedAt: 0, phase: 'playing', achievements }}
        saveState="ok"
        saveReason=""
        importError={null}
        pendingImport={null}
        onContinue={() => {}}
        onStart={() => {}}
        onImportFile={() => {}}
        onConfirmImport={() => {}}
        onCancelImport={() => {}}
        onExportRaw={() => {}}
      />,
    )

  it('总数显示走动态长度（2 / 41），不因扩容硬编码', () => {
    const html = render(['ach_pet', 'ach_first_job'])
    expect(html).toContain(`已解锁 2 / ${ACHIEVEMENTS.length}`)
    expect(html).toContain('铲屎官')
  })

  it('隐藏成就未解锁时遮罩（不出真名与条件），解锁后正常显示', () => {
    const masked = render(['ach_pet'])
    expect(masked).not.toContain('登峰造极')
    expect(masked).not.toContain('百万家财')
    expect(masked).toContain('？？？')
    expect(masked).toContain('隐藏成就')
    const revealed = render(['ach_pet', 'ach_phd'])
    expect(revealed).toContain('学海无涯')
    // 遮罩只挡未解锁的：解锁 phd 后 top_level / million_home 仍遮罩
    expect(revealed).not.toContain('登峰造极')
  })
})
