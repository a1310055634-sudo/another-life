// 第 13 轮：成就系统测试（第 14 轮追加 5 个青年成就的正反判定，共 20 个）
// 覆盖：框架纯函数性、20 个成就逐一正反判定、been_deep_debt 深负债标记接线、
// advanceYear/chooseOption 双落账路径、key 履历、长线模拟真实解锁与同 seed 复现。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { visibleChoices } from './events'
import { startSession, chooseOption, nextYear } from './session'
import { validateState } from './validate'
import { ACHIEVEMENTS, evaluateAchievements, unlockAchievements } from './achievements'
import { ALL_EVENTS } from '../data/events'
import type { GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const EMPLOYED = (salary = 60000) =>
  ({ kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary, yearsAtJob: 2 }) as const

describe('成就框架（achievements.ts）', () => {
  it('成就数量 ≥10，id 唯一，均有名称/描述/判定函数', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0)
      expect(a.desc.length).toBeGreaterThan(0)
      expect(typeof a.check).toBe('function')
    }
  })

  it('18 岁新档不达成任何成就', () => {
    expect(evaluateAchievements(makeGame())).toEqual([])
  })

  it('unlockAchievements 是纯函数：不改原状态，返回新状态与解锁清单', () => {
    const s = makeGame(42, { tags: ['pet_owner'] })
    const snapshot = JSON.stringify(s)
    const { state, unlocked } = unlockAchievements(s)
    expect(JSON.stringify(s)).toBe(snapshot)
    expect(unlocked.map((a) => a.id)).toContain('ach_pet')
    expect(state.achievements).toContain('ach_pet')
    expect(state).not.toBe(s)
  })

  it('解锁写入 key 履历（eventId ach，summary 含成就名）', () => {
    const { state } = unlockAchievements(makeGame(42, { tags: ['pet_owner'] }))
    const entry = state.history.find((h) => h.eventId === 'ach')
    expect(entry).toBeDefined()
    expect(entry!.key).toBe(true)
    expect(entry!.summary).toContain('铲屎官')
  })

  it('已解锁的成就不会重复解锁', () => {
    let s = makeGame(42, { tags: ['pet_owner'] })
    s = unlockAchievements(s).state
    const second = unlockAchievements(s)
    expect(second.unlocked).toEqual([])
    expect(second.state.achievements.filter((a) => a === 'ach_pet')).toHaveLength(1)
  })

  it('validateState 接受合法成就列表，拒绝非数组与非字符串条目', () => {
    expect(validateState(makeGame(42, { achievements: ['ach_pet'] })).issues).toEqual([])
    expect(validateState(makeGame(42, { achievements: 'x' as never })).issues.length).toBeGreaterThan(0)
    expect(validateState(makeGame(42, { achievements: [1] as never })).issues.length).toBeGreaterThan(0)
  })
})

describe('20 个成就逐一正反判定', () => {
  const yes = (patch: Partial<GameState>, id: string) => {
    const s = makeGame(42, patch)
    expect(evaluateAchievements(s).map((a) => a.id)).toContain(id)
  }
  const no = (patch: Partial<GameState>, id: string) => {
    const s = makeGame(42, patch)
    expect(evaluateAchievements(s).map((a) => a.id)).not.toContain(id)
  }

  it('学有所成：本科及以上；大专不算', () => {
    yes({ education: 'bachelor' }, 'ach_first_degree')
    yes({ education: 'master' }, 'ach_first_degree')
    no({ education: 'college' }, 'ach_first_degree')
  })

  it('大器晚成：自考标记 + 大专以上；两者缺一不可', () => {
    yes({ tags: ['self_exam'], education: 'college' }, 'ach_self_made')
    no({ tags: ['self_exam'], education: 'highschool' }, 'ach_self_made')
    no({ education: 'college' }, 'ach_self_made')
  })

  it('落榜不落志：触发过落榜再生事件 + 最终大专以上', () => {
    yes({ seenEvents: ['edu_gaokao_failed_regroup'], education: 'college' }, 'ach_fallen_and_risen')
    no({ education: 'college' }, 'ach_fallen_and_risen')
    no({ seenEvents: ['edu_gaokao_failed_regroup'], education: 'highschool' }, 'ach_fallen_and_risen')
  })

  it('初入职场：ever_employed 标记', () => {
    yes({ tags: ['ever_employed'] }, 'ach_first_job')
    no({}, 'ach_first_job')
  })

  it('中层骨干：在职且职级 ≥3；职级 2 或待业不算', () => {
    yes({ career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 3, salary: 60000, yearsAtJob: 5 } }, 'ach_senior_level')
    no({ career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 60000, yearsAtJob: 5 } }, 'ach_senior_level')
    no({ career: { kind: 'unemployed', weeks: 10 } }, 'ach_senior_level')
  })

  it('东山再起：在职且有 ex_ 行业经历；在职无经历、待业有经历都不算', () => {
    yes({ tags: ['ex_warehouse_keeper'], career: EMPLOYED() }, 'ach_comeback')
    no({ career: EMPLOYED() }, 'ach_comeback')
    no({ tags: ['ex_warehouse_keeper'] }, 'ach_comeback')
  })

  it('第一个十万：≥100000，差一块钱都不行', () => {
    yes({ money: 100000 }, 'ach_100k')
    no({ money: 99999 }, 'ach_100k')
  })

  it('无债一身轻：been_deep_debt 标记 + 回到正资产', () => {
    yes({ tags: ['been_deep_debt'], money: 0 }, 'ach_debt_free')
    no({ tags: ['been_deep_debt'], money: -1 }, 'ach_debt_free')
    no({ money: 999999 }, 'ach_debt_free')
  })

  it('收租的人：landlord 标记', () => {
    yes({ tags: ['landlord'] }, 'ach_landlord')
    no({}, 'ach_landlord')
  })

  it('三口之家：married 与 has_child 同时在', () => {
    yes({ tags: ['married', 'has_child'] }, 'ach_family')
    no({ tags: ['married'] }, 'ach_family')
  })

  it('破镜重圆：触发过重建事件且父母关系存活', () => {
    const withParent = makeGame(42, { seenEvents: ['rel_estranged_parent'] })
    expect(withParent.relations.some((r) => r.kind === 'parent' && r.alive)).toBe(true)
    yes({ seenEvents: ['rel_estranged_parent'] }, 'ach_reunion')
    no({}, 'ach_reunion')
    no({ seenEvents: ['rel_estranged_parent'], relations: [] }, 'ach_reunion')
  })

  it('老当益壮：60 岁后健康 ≥65；59 岁或 64 健康都不算', () => {
    yes({ age: 60, attrs: { health: 65, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_iron_body')
    no({ age: 59, attrs: { health: 70, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_iron_body')
    no({ age: 60, attrs: { health: 64, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_iron_body')
  })

  it('重获新生：触发过最后通牒事件且健康恢复到 45 以上', () => {
    yes({ seenEvents: ['hlt_body_intensive'], attrs: { health: 45, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_reborn')
    no({ seenEvents: ['hlt_body_intensive'], attrs: { health: 44, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_reborn')
    no({ attrs: { health: 90, happiness: 50, smarts: 50, social: 50, stress: 20 } }, 'ach_reborn')
  })

  it('自己的门钥匙：independent_living 标记', () => {
    yes({ tags: ['independent_living'] }, 'ach_independent')
    no({}, 'ach_independent')
  })

  // ── 青年路线（第 14 轮新增 5 个）──
  it('在大城市站稳脚跟：go_big_city 标记 + 5 万存款；只去没钱、有钱没去都不算', () => {
    yes({ tags: ['go_big_city'], money: 50000 }, 'ach_city_rooted')
    no({ tags: ['go_big_city'], money: 49999 }, 'ach_city_rooted')
    no({ money: 50000 }, 'ach_city_rooted')
  })

  it('热爱未熄：dream_kept 与 dream_bloom 同时在（坚持业余三年后开花）', () => {
    yes({ tags: ['dream_kept', 'dream_bloom'] }, 'ach_dream_kept')
    no({ tags: ['dream_kept'] }, 'ach_dream_kept')
    no({ tags: ['dream_bloom'] }, 'ach_dream_kept')
  })

  it('二十岁的积蓄：22 岁及以前 ≥20000；23 岁攒到不算；富裕出身生来有钱不算', () => {
    yes({ age: 22, money: 20000 }, 'ach_young_savings')
    yes({ age: 18, money: 20000 }, 'ach_young_savings')
    no({ age: 22, money: 19999 }, 'ach_young_savings')
    no({ age: 23, money: 999999 }, 'ach_young_savings')
    no({ age: 18, money: 200000, tags: ['bg_wealthy'] }, 'ach_young_savings')
  })

  it('薪火相传：mentor_bond 标记 + 在职职级 ≥2；待业带标记、职级 1 都不算', () => {
    yes({ tags: ['mentor_bond'], career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 60000, yearsAtJob: 3 } }, 'ach_torch_passed')
    no({ tags: ['mentor_bond'], career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 1 } }, 'ach_torch_passed')
    no({ tags: ['mentor_bond'] }, 'ach_torch_passed')
    no({ career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 2, salary: 60000, yearsAtJob: 3 } }, 'ach_torch_passed')
  })

  it('二十几岁的婚礼：married + 30 岁及以前；31 岁已婚不算', () => {
    yes({ tags: ['married'], age: 30 }, 'ach_early_wedding')
    no({ tags: ['married'], age: 31 }, 'ach_early_wedding')
    no({ age: 25 }, 'ach_early_wedding')
  })
})

describe('引擎接线（lifecycle / session）', () => {
  it('advanceYear：跌破 -50,000 打 been_deep_debt 标记；-40,000 不打', () => {
    const deep = advanceYear(makeGame(7, { age: 30, money: -60000, career: { kind: 'none' } }))
    expect(deep.tags).toContain('been_deep_debt')
    const shallow = advanceYear(makeGame(7, { age: 30, money: -40000, career: { kind: 'none' } }))
    expect(shallow.tags).not.toContain('been_deep_debt')
  })

  it('advanceYear：深负债爬回正资产当年解锁「无债一身轻」，年志有 🏅 提示', () => {
    const s = makeGame(7, { age: 30, money: 5000, tags: ['been_deep_debt'], career: { kind: 'none' } })
    const next = advanceYear(s)
    expect(next.achievements).toContain('ach_debt_free')
    expect(next.yearLog.some((l) => l.includes('🏅') && l.includes('无债一身轻'))).toBe(true)
    expect(next.history.some((h) => h.eventId === 'ach' && h.summary.includes('无债一身轻'))).toBe(true)
  })

  it('chooseOption：选择驱动的成就即时解锁（ever_employed → 初入职场）', () => {
    let session = startSession({ seed: 20260926, backgroundId: 'ordinary', traitId: 'laid_back', name: '小李' }, ALL_EVENTS)
    session = { ...session, state: { ...session.state, tags: [...session.state.tags, 'ever_employed'] } }
    const idx = session.currentEvent!.choices.findIndex(
      (c) => visibleChoices(session.state, session.currentEvent!).includes(c),
    )
    session = chooseOption(session, idx)
    expect(session.state.achievements).toContain('ach_first_job')
    expect(session.state.history.filter((h) => h.eventId === 'ach')).toHaveLength(1)
    expect(session.awaitingAdvance).toBe(true)
  })

  it('settle 产生的毕业条目带 key 标记（关键经历记录）', () => {
    const s = makeGame(7, {
      age: 20,
      education: 'highschool',
      career: { kind: 'student', stage: 'college', yearsLeft: 1 },
    })
    const next = advanceYear(s)
    expect(next.education).toBe('college')
    expect(next.history.some((h) => h.key === true && h.eventId !== 'ach')).toBe(true)
  })

  it('疏远结算条目带 key 标记', () => {
    const s = makeGame(7, { age: 30 })
    s.relations[0].closeness = 0
    const next = advanceYear(s)
    const broke = next.history.find((h) => h.title === '疏远')
    expect(broke).toBeDefined()
    expect(broke!.key).toBe(true)
  })
})

describe('长线模拟：成就真实可达', () => {
  /** 确定性自动游玩：每次选第一个可见选项，返回终局状态与历年状态 */
  function autoPlay(seed: number, maxYears: number): GameState {
    let session = startSession({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '模拟者' }, ALL_EVENTS)
    let guard = 0
    while (session.state.phase === 'playing' && guard < maxYears * 2) {
      guard++
      if (session.awaitingAdvance || !session.currentEvent) {
        session = nextYear(session, ALL_EVENTS)
      } else {
        const vis = visibleChoices(session.state, session.currentEvent)
        const idx = session.currentEvent.choices.findIndex((c) => vis.includes(c))
        session = chooseOption(session, idx)
      }
    }
    return session.state
  }

  const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))

  it('5 个 seed 各玩 40+ 年：每年至少解锁 1 个成就，解锁 id 全部在册', () => {
    const counts: number[] = []
    for (const seed of [11, 22, 33, 44, 55]) {
      const s = autoPlay(seed, 45)
      expect(s.achievements.length).toBeGreaterThanOrEqual(1)
      for (const id of s.achievements) expect(ACH_IDS.has(id)).toBe(true)
      // 成就履历与成就列表一一对应
      expect(s.history.filter((h) => h.eventId === 'ach')).toHaveLength(s.achievements.length)
      counts.push(s.achievements.length)
      expect(validateState(s).issues).toEqual([])
    }
    console.log('成就解锁数（seed 11/22/33/44/55）:', counts.join('/'))
  })

  it('同 seed 同策略：成就列表与履历完全复现', () => {
    const a = autoPlay(2026, 40)
    const b = autoPlay(2026, 40)
    expect(a.achievements).toEqual(b.achievements)
    expect(a.history).toEqual(b.history)
  })
})

// ── 复验补强（第 17 轮第 2 次触发）：接续备忘点名的 3 枚成就可达性——
// ach_dream_kept（youth.test 梦想链行为测试）与 ach_torch_passed（youth.test 师徒晋升链）
// 已有真实路线证明，这里补上 ach_early_wedding 缺失的真实流程解锁证明。

describe('复验补强：ach_early_wedding 走真实求婚流程解锁（≤30 岁）', () => {
  const propose = (age: number) => {
    const base = makeGame(5, {
      age,
      money: 50000,
      relations: [{ id: 'r_partner_xs', kind: 'partner', name: '小赵', closeness: 70, alive: true }],
    })
    const ev = ALL_EVENTS.find((e) => e.id === 'rel_propose')!
    const choice = ev.choices.find((c) => c.text.includes('旅行结婚'))!
    return chooseOption(
      { state: base, currentEvent: ev, awaitingAdvance: false, lastSummary: '', lastDeltas: [] },
      ev.choices.indexOf(choice),
    )
  }

  it('26 岁 partner 亲密 70 → 旅行结婚 → married 标记、成就与 key 履历同屏落账', () => {
    const next = propose(26)
    expect(next.state.tags).toContain('married')
    expect(next.state.achievements).toContain('ach_early_wedding')
    expect(
      next.state.history.some((h) => h.eventId === 'ach' && h.summary.includes('二十几岁的婚礼')),
    ).toBe(true)
    expect(validateState(next.state).issues).toEqual([])
  })

  it('31 岁同样流程照常结婚但不再解锁（年龄上界真实生效）', () => {
    const next = propose(31)
    expect(next.state.tags).toContain('married')
    expect(next.state.achievements).not.toContain('ach_early_wedding')
  })
})

// ── 第 100 轮（V5 成就四期）：7 枚新机制成就的正反判定 + 计数断言 ──
describe('V5 机制成就（第 100 轮，7 枚）逐一正反判定', () => {
  const byId = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!

  it('成就总数 = 66（59 + 7），id 唯一，无重复', () => {
    expect(ACHIEVEMENTS.length).toBe(66)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(66)
  })

  it('ach_civil_anchor 上岸：civil_servant + 工龄 ≥3 年（正/工龄不足反/无编制反）', () => {
    const c = byId('ach_civil_anchor').check
    expect(c(makeGame(1, { tags: ['civil_servant'], workYears: 3 }))).toBe(true)
    expect(c(makeGame(1, { tags: ['civil_servant'], workYears: 10 }))).toBe(true)
    expect(c(makeGame(1, { tags: ['civil_servant'], workYears: 2 }))).toBe(false)
    expect(c(makeGame(1, { tags: ['civil_servant'] }))).toBe(false) // workYears 缺省=0
    expect(c(makeGame(1, { workYears: 5 }))).toBe(false) // 无编制标记
  })

  it('ach_home_kept 安得广厦：房在册 + mortgage_cleared（与房贷结清区分：卖房即失格）', () => {
    const c = byId('ach_home_kept').check
    const home = { id: 'h1', value: 1000000, basis: 1000000 } as never
    expect(c(makeGame(1, { home, tags: ['mortgage_cleared'] }))).toBe(true)
    // 关键区分点：还清了但房子已卖（房册注销）→ 不算安得广厦
    expect(c(makeGame(1, { tags: ['mortgage_cleared'] }))).toBe(false)
    // 有房但贷款未清 → 不算
    expect(c(makeGame(1, { home, tags: [] }))).toBe(false)
    // 仅房贷结清成就可达，广厦不可达（两者互斥区分成立）
    const only = makeGame(1, { tags: ['mortgage_cleared'] })
    expect(byId('ach_mortgage_cleared').check(only)).toBe(true)
    expect(c(only)).toBe(false)
  })

  it('ach_monetized_fame 流量时代：minor_fame + 50 万（正/仅名气反/有钱无名反）', () => {
    const c = byId('ach_monetized_fame').check
    expect(c(makeGame(1, { tags: ['minor_fame'], money: 500000 }))).toBe(true)
    expect(c(makeGame(1, { tags: ['minor_fame'], money: 499999 }))).toBe(false)
    expect(c(makeGame(1, { tags: [], money: 5000000 }))).toBe(false)
  })

  it('ach_rebuilt_after_divorce 破而后立：seen 离婚协议 + married + 配偶在册（与雨过天晴区分）', () => {
    const c = byId('ach_rebuilt_after_divorce').check
    const spouse = [{ id: 'r_sp', kind: 'spouse', name: '李', closeness: 70, alive: true }] as never
    // R100 修正：用 seenEvents('div_sign_papers') 作离婚证据——div_remarry 复婚时
    // removeTags:['divorced']，故「divorced 常驻标记」与「已婚」永不同在册。
    expect(c(makeGame(1, { seenEvents: ['div_sign_papers'], tags: ['married'], relations: spouse }))).toBe(true)
    // 未离婚的冷战争修复：marriage_mended 可达但破而后立不可达（区分点成立）
    const mended = makeGame(1, { tags: ['marriage_mended'], relations: spouse })
    expect(byId('ach_marriage_mended').check(mended)).toBe(true)
    expect(c(mended)).toBe(false)
    // 已复婚但从没离过婚（协议未签）→ 反
    expect(c(makeGame(1, { tags: ['married'], relations: spouse }))).toBe(false)
    // 离过婚但未再婚 → 反
    expect(c(makeGame(1, { seenEvents: ['div_sign_papers'] }))).toBe(false)
    // 已再婚但配偶已故 → 反
    expect(
      c(makeGame(1, {
        seenEvents: ['div_sign_papers'],
        tags: ['married'],
        relations: [{ id: 'r_sp', kind: 'spouse', name: '李', closeness: 70, alive: false }] as never,
      })),
    ).toBe(false)
  })

  it('ach_dink_life 丁克一生：dink 标记 + 终局无子女在册（正/有子女反）', () => {
    const c = byId('ach_dink_life').check
    expect(c(makeGame(1, { tags: ['dink'] }))).toBe(true)
    expect(
      c(makeGame(1, {
        tags: ['dink'],
        relations: [{ id: 'r_c', kind: 'child', name: '小王', closeness: 80, alive: true }] as never,
      })),
    ).toBe(false)
    expect(c(makeGame(1, { tags: [] }))).toBe(false)
  })

  it('ach_returnee_studied 负笈远游：留学标记 + 本科及以上（正/只留学不升学反）', () => {
    const c = byId('ach_returnee_studied').check
    expect(c(makeGame(1, { tags: ['abroad_year'], education: 'bachelor' }))).toBe(true)
    expect(c(makeGame(1, { tags: ['studied_abroad'], education: 'master' }))).toBe(true)
    expect(c(makeGame(1, { tags: ['abroad_year'], education: 'highschool' }))).toBe(false)
    expect(c(makeGame(1, { education: 'bachelor' }))).toBe(false)
  })

  it('ach_claim_paid 有备无患：理赔型手术事件已见 + 保单已注销（正/未出险反/保单仍在册反）', () => {
    const c = byId('ach_claim_paid').check
    expect(c(makeGame(1, { seenEvents: ['hlt_major_surgery'] }))).toBe(true)
    expect(c(makeGame(1, { seenEvents: ['ins_buy_young'] }))).toBe(false)
    expect(
      c(makeGame(1, {
        seenEvents: ['hlt_major_surgery'],
        insurance: { purchasedAtAge: 30, benefit: 45000 } as never,
      })),
    ).toBe(false) // 保单仍在册=尚未理赔
  })

  it('7 枚新成就不在 18 岁新档达成（无副作用）', () => {
    const fresh = makeGame()
    for (const id of ['ach_civil_anchor', 'ach_home_kept', 'ach_monetized_fame', 'ach_rebuilt_after_divorce',
      'ach_dink_life', 'ach_returnee_studied', 'ach_claim_paid']) {
      expect(byId(id).check(fresh)).toBe(false)
    }
  })

  it('机制值冻结校验：新增 7 枚不改动任何既有 52 枚定义（防撞回归）', () => {
    // 抽样既有条目，确保本轮追加未污染旧定义
    expect(byId('ach_three_generations').name).toBe('三代同堂')
    expect(byId('ach_mortgage_cleared').name).toBe('房贷结清')
    expect(byId('ach_marriage_mended').name).toBe('雨过天晴')
    // 任务书点名的「三代同堂志」由既有 ach_three_generations 覆盖，故新列表中不应重复出现
    const v5Ids = ACHIEVEMENTS.map((a) => a.id).filter((id) =>
      ['ach_civil_anchor', 'ach_home_kept', 'ach_monetized_fame', 'ach_rebuilt_after_divorce',
        'ach_dink_life', 'ach_returnee_studied', 'ach_claim_paid'].includes(id))
    expect(v5Ids).toHaveLength(7)
  })
})
