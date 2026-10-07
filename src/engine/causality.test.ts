// 第 13 轮：长期后果因果链测试
// 两层验证：
// 1) 数据级审计——13+ 条跨年因果链的"上游打标 / 下游读取"在事件数据中真实存在，
//    覆盖教育/职业/财务/关系/健康五域（spec：不得全部只是延迟加减属性）。
// 2) 行为级 A/B——固定 seed 下，改变早期选择后，几年内出现可观察的不同机会或事件。
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, availableEvents, visibleChoices } from './events'
import { startSession, chooseOption, nextYear } from './session'
import { ALL_EVENTS } from '../data/events'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function findEvent(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

function choiceIndex(state: GameState, event: GameEvent, text: string): number {
  const vis = visibleChoices(state, event)
  const i = event.choices.findIndex((c) => c.text === text && vis.includes(c))
  if (i === -1) throw new Error(`选项不可见: ${text}（可见 ${vis.length} 个）`)
  return i
}

function choose(state: GameState, eventId: string, text: string): GameState {
  const ev = findEvent(eventId)
  return applyChoice(state, ev, choiceIndex(state, ev, text)).state
}

const isAvailable = (state: GameState, id: string) => availableEvents(state, ALL_EVENTS).some((e) => e.id === id)

const EMPLOYED = (jobId = 'office_clerk', jobTitle = '行政文员', salary = 60000) =>
  ({ kind: 'employed', jobId, jobTitle, level: 1, salary, yearsAtJob: 2 }) as const

// ───────────────────────── 数据级审计 ─────────────────────────
//
// 每条链：上游事件（或引擎机制）通过某标记 / 机制，改变下游事件的可触发条件。
// upstream: 事件 id 或 'engine:*'；via: 传递载体；downstream: 读取载体的事件；
// at: 载体写在事件级还是选项级 requires 上。

interface ChainLink {
  name: string
  domain: '教育' | '职业' | '财务' | '关系' | '健康'
  upstream: string
  via: string
  downstream: string
  at?: 'event' | 'choice'
}

const CHAINS: ChainLink[] = [
  // 教育
  { name: '高考录取→报到', domain: '教育', upstream: 'engine:graduateStudent', via: 'admitted_bachelor/admitted_college', downstream: 'edu_admission_notice' },
  { name: '高考落榜→落榜再生', domain: '教育', upstream: 'engine:graduateStudent', via: 'gaokao_failed', downstream: 'edu_gaokao_failed_regroup' },
  { name: '毕业→校招', domain: '教育', upstream: 'engine:graduateStudent', via: 'graduated_college/graduated_bachelor', downstream: 'car_campus_recruit' },
  // 职业
  { name: '入职程序员→35岁危机', domain: '职业', upstream: 'engine:employPatch', via: 'job_junior_dev', downstream: 'car_dev_midlife' },
  { name: '入职护士→夜班事件', domain: '职业', upstream: 'engine:employPatch', via: 'job_nurse', downstream: 'car_nurse_shifts' },
  { name: '考下职称→职称证到手', domain: '职业', upstream: 'car_nurse_shifts', via: 'nurse_certified', downstream: 'car_nurse_certificate' },
  { name: '离职→老东家返聘', domain: '职业', upstream: 'engine:endEmploymentPatch', via: 'ex_nurse/ex_teacher/ex_junior_dev…', downstream: 'car_old_boss_call' },
  { name: '抢位成功→拼命三郎的账单', domain: '职业', upstream: 'mid_promotion_race', via: 'workaholic_streak', downstream: 'car_workaholic_bill' },
  { name: '接受家里安排→家里的公司', domain: '职业', upstream: 'youth_family_bankroll', via: 'family_backed', downstream: 'car_family_business' },
  // 财务
  { name: '深陷骗局→再遇话术', domain: '财务', upstream: 'fin_invest_pitch', via: 'scam_victim', downstream: 'fin_scam_aftermath' },
  { name: '以贷养贷→债务的尽头', domain: '财务', upstream: 'fin_debt_calls', via: 'debt_spiral', downstream: 'fin_debt_bottom' },
  { name: '储蓄习惯→存下来的底气', domain: '财务', upstream: 'youth_first_salary_splurge/fin_shopfront/fin_invest_pitch', via: 'saver/prudent_saver/prudent_investor', downstream: 'fin_compound_habit' },
  { name: '盘下铺面→每年租金进账', domain: '财务', upstream: 'fin_shopfront', via: 'landlord', downstream: 'engine:livingExpense(年租+18,000)' },
  // 关系
  { name: '借钱给老友→老友的船开了', domain: '关系', upstream: 'youth_friend_loan', via: 'lent_money', downstream: 'rel_old_friend_success' },
  { name: '亲密度归零疏远→过年没回的家', domain: '关系', upstream: 'engine:settleEstrangement', via: 'estranged_parent', downstream: 'rel_estranged_parent' },
  { name: '中年全力治父母→晚年你陪他们变老', domain: '关系', upstream: 'mid_parent_health', via: 'cared_for_parents', downstream: 'rel_parents_tender_years' },
  // 健康
  { name: '染上熬夜→黑眼圈在提醒你', domain: '健康', upstream: 'hlt_late_night_spiral', via: 'night_owl', downstream: 'hlt_night_owl_change' },
  { name: '坚持锻炼→跑步膝风险', domain: '健康', upstream: 'engine:事件授予', via: 'routine_exercise', downstream: 'hlt_gym_injury' },
  { name: '过劳硬扛→旧伤常驻漂移', domain: '健康', upstream: 'hlt_overwork_warning', via: 'chronic_pain(延迟授予)', downstream: 'engine:applyLifestyleDrift(健康-1/压力+1每年)' },
]

/** 事件级 requires 的 tags 条件里是否引用了载体（链式路径按 / 拆开做前缀匹配） */
function readsTag(ev: GameEvent, via: string, at?: 'event' | 'choice'): boolean {
  const parts = via.split('/')
  const read = (cond: { tagsAll?: string[]; tagsAny?: string[] } | undefined) =>
    !!cond && [...(cond.tagsAll ?? []), ...(cond.tagsAny ?? [])].some((t) => parts.some((p) => t === p || t.startsWith(p.slice(0, 8))))
  if (at === 'choice') return ev.choices.some((c) => read(c.requires))
  return read(ev.requires) || ev.choices.some((c) => read(c.requires))
}

/** 上游事件的选项/延迟效果里是否真的产出载体标记 */
function producesTag(ev: GameEvent, via: string): boolean {
  const parts = via.split('/')
  const hit = (tags?: string[]) => !!tags && tags.some((t) => parts.some((p) => t === p || p.startsWith(t)))
  return ev.choices.some(
    (c) => hit(c.addTags) || (c.delayed ?? []).some((d) => hit(d.addTags)),
  )
}

describe('数据级：跨年因果链的上下游真实接线', () => {
  it('至少 12 条链，覆盖教育/职业/财务/关系/健康全部五域', () => {
    expect(CHAINS.length).toBeGreaterThanOrEqual(12)
    const domains = new Set(CHAINS.map((c) => c.domain))
    expect([...domains].sort()).toEqual(['关系', '健康', '教育', '财务', '职业'].sort())
  })

  it('每条链的下游事件存在，且条件真实读取载体', () => {
    for (const c of CHAINS) {
      if (c.downstream.startsWith('engine:')) continue
      const ev = ALL_EVENTS.find((e) => e.id === c.downstream)
      expect(ev, `下游事件缺失: ${c.downstream}`).toBeDefined()
      expect(readsTag(ev!, c.via, c.at), `链「${c.name}」: ${c.downstream} 未读取载体 ${c.via}`).toBe(true)
    }
  })

  it('事件型上游确实产出载体标记', () => {
    for (const c of CHAINS) {
      if (c.upstream.startsWith('engine:') || c.upstream.includes('/')) continue
      const ev = ALL_EVENTS.find((e) => e.id === c.upstream)
      expect(ev, `上游事件缺失: ${c.upstream}`).toBeDefined()
      expect(producesTag(ev!, c.via), `链「${c.name}」: ${c.upstream} 未产出载体 ${c.via}`).toBe(true)
    }
  })
})

// ───────────────────────── 行为级 A/B 对比 ─────────────────────────

describe('行为级：改变早期选择，几年内出现可观察的不同机会', () => {
  it('高考链：18 岁选复读 vs 直接打工，19-25 岁的机会集完全分叉', () => {
    const seed = 20260926
    const s0 = makeGame(seed)
    const repeat = choose(s0, 'youth_gap_decision', '复读一年，再冲一次高考')
    const work = choose(s0, 'youth_gap_decision', '直接打工，帮家里减轻负担')

    expect(repeat.tags).toContain('gaokao_retry')
    expect(repeat.career.kind).toBe('student')
    expect(work.tags).toContain('work_early')

    // 复读线推进到放榜后：出现录取/落榜分流，录取者可见「录取通知书」
    const repeat19 = advanceYear(repeat)
    const repeat20 = advanceYear(repeat19)
    const admitted = repeat20.tags.some((t) => t.startsWith('admitted_'))
    expect(admitted || repeat20.tags.includes('gaokao_failed')).toBe(true)
    if (admitted) {
      expect(isAvailable(repeat20, 'edu_admission_notice')).toBe(true)
      expect(isAvailable(work, 'edu_admission_notice')).toBe(false)
    }
    // 打工线永远看不到录取通知书与落榜再生
    const work22 = advanceYear(advanceYear(work))
    expect(isAvailable(work22, 'edu_admission_notice')).toBe(false)

    // 两条线的可见机会集不同（同一 seed，不同选择）
    const repeatEvents = new Set(availableEvents(repeat20, ALL_EVENTS).map((e) => e.id))
    const workEvents = new Set(availableEvents(work22, ALL_EVENTS).map((e) => e.id))
    expect(repeatEvents).not.toEqual(workEvents)
  })

  it('自考链：25 岁报名自考，2 年后学历到手，办公岗位招聘从不可见变为可见', () => {
    const s = makeGame(7, { age: 25, education: 'highschool', career: { kind: 'none' } })
    expect(isAvailable(s, 'car_office_recruit')).toBe(false)
    const enrolled = choose(s, 'edu_adult_selfexam', '报自考大专，把学历补上')
    expect(enrolled.tags).toContain('self_exam')
    const y1 = advanceYear(enrolled)
    const y2 = advanceYear(y1)
    expect(y2.education).toBe('college')
    expect(isAvailable(y2, 'car_office_recruit')).toBe(true)
  })

  it('返聘链：离开行业的 ex_ 经历解锁「老东家的返聘电话」，从未就业者看不到', () => {
    const withEx = makeGame(7, {
      age: 30,
      tags: ['ex_warehouse_keeper', 'ever_employed', 'laid_off'],
      career: { kind: 'none' },
      skills: { academics: 20, vocational: 25 },
    })
    expect(isAvailable(withEx, 'car_old_boss_call')).toBe(true)
    const never = makeGame(7, { age: 30, career: { kind: 'none' }, skills: { academics: 20, vocational: 25 } })
    expect(isAvailable(never, 'car_old_boss_call')).toBe(false)
  })

  it('骗局链：受骗标记解锁「又有人来带赚钱了」，点破后获得 scam_skeptic', () => {
    const victim = makeGame(7, { age: 30, tags: ['scam_victim'], money: 30000 })
    expect(isAvailable(victim, 'fin_scam_aftermath')).toBe(true)
    const clean = makeGame(7, { age: 30, money: 30000 })
    expect(isAvailable(clean, 'fin_scam_aftermath')).toBe(false)

    const after = choose(victim, 'fin_scam_aftermath', '一句话点破，顺手举报')
    expect(after.tags).toContain('scam_skeptic')
    expect(after.attrs.smarts).toBe(makeGame(7, { age: 30, tags: ['scam_victim'], money: 30000 }).attrs.smarts + 2)
  })

  it('债务链：以贷养贷标记 + 深负债解锁「债务的尽头」，整理后债务可控、三年还清', () => {
    const s = makeGame(7, { age: 30, money: -60000, tags: ['debt_spiral'], career: EMPLOYED() })
    expect(isAvailable(s, 'fin_debt_bottom')).toBe(true)
    const cleaned = choose(s, 'fin_debt_bottom', '找正规机构做债务整理，分期三年还本金')
    // 利息罚金一笔勾销：+30,000，且 spiral 终止
    expect(cleaned.money).toBe(s.money + 30000)
    expect(cleaned.tags).not.toContain('debt_spiral')
    expect(cleaned.pending).toHaveLength(3)

    // 三年三期准时划扣，一笔不少
    const summaries: string[] = []
    let cur = cleaned
    for (let i = 0; i < 3; i++) {
      cur = advanceYear(cur)
      summaries.push(...cur.yearLog)
    }
    expect(cur.pending).toHaveLength(0)
    expect(summaries).toContain('第一笔整理还款按时划出')
    expect(summaries).toContain('最后一笔整理还款结清，测试者撕掉了欠款清单')
  })

  it('储蓄链：saver 标记解锁「存下来的底气」，同一存款额无标记者看不到', () => {
    const saver = makeGame(7, { age: 30, money: 40000, tags: ['saver'] })
    expect(isAvailable(saver, 'fin_compound_habit')).toBe(true)
    const spender = makeGame(7, { age: 30, money: 40000 })
    expect(isAvailable(spender, 'fin_compound_habit')).toBe(false)

    const invested = choose(saver, 'fin_compound_habit', '分成三份：应急、稳健、进取')
    expect(invested.money).toBe(20000)
    const y2 = advanceYear(advanceYear(invested))
    // 单年增量对照：两年后的钱比"刚投完"多出 26,000（收益）加减生活收支与利息，
    // 这里只锁延迟效果准时到账：yearLog 含收益文案
    expect(y2.yearLog.some((l) => l.includes('三份钱的答卷'))).toBe(true)
  })

  it('拼命三郎链：抢来的位置带出健康账单，再拼一年 → 次年健康 -3 精确落账', () => {
    const base = makeGame(7, {
      age: 30,
      tags: ['workaholic_streak'],
      career: EMPLOYED('office_clerk', '行政文员', 60000),
    })
    expect(isAvailable(base, 'car_workaholic_bill')).toBe(true)

    const pushed = choose(base, 'car_workaholic_bill', '再拼一年，先把位子坐稳')
    expect(pushed.attrs.stress).toBe(base.attrs.stress + 6)
    const before = pushed.attrs.health
    const next = advanceYear(pushed)
    // 次年健康差 = 延迟 -3（无生活方式标记、31 岁无年龄漂移、压力<80 无侵蚀）
    expect(next.attrs.health).toBe(before - 3)
    expect(next.yearLog.some((l) => l.includes('体检单上的箭头'))).toBe(true)

    // 对照：选"学着带人"则无次年账单，stress 还降 3
    const shared = choose(base, 'car_workaholic_bill', '学着带人，把活分出去')
    expect(shared.attrs.stress).toBe(base.attrs.stress - 3)
    expect(shared.pending).toHaveLength(0)
  })

  it('职称链：考下职称解锁「职称证到了」，竞聘组长职级 +1；满级时竞聘隐藏', () => {
    const nurse = makeGame(7, {
      age: 30,
      tags: ['nurse_certified', 'job_nurse'],
      career: EMPLOYED('nurse', '护士', 50000),
    })
    expect(isAvailable(nurse, 'car_nurse_certificate')).toBe(true)
    const promoted = choose(nurse, 'car_nurse_certificate', '竞聘护理组长')
    if (promoted.career.kind !== 'employed') throw new Error('竞聘后未在职')
    expect(promoted.career.level).toBe(2)
    expect(promoted.career.salary).toBeGreaterThan(50000)

    // 满级：竞聘选项隐藏，但事件仍有其他出路（不软锁）
    const maxed = makeGame(7, {
      age: 30,
      tags: ['nurse_certified', 'job_nurse'],
      career: { kind: 'employed', jobId: 'nurse', jobTitle: '护士', level: 5, salary: 60000, yearsAtJob: 9 },
    })
    const ev = findEvent('car_nurse_certificate')
    const texts = visibleChoices(maxed, ev).map((c) => c.text)
    expect(texts).not.toContain('竞聘护理组长')
    expect(texts.length).toBeGreaterThanOrEqual(2)
  })

  it('家族企业链：family_backed 解锁「家里的公司」，学历分流选项，铺子路线即时入职', () => {
    const hs = makeGame(7, {
      age: 25,
      tags: ['family_backed'],
      career: { kind: 'none' },
      skills: { academics: 20, vocational: 25 },
    })
    expect(isAvailable(hs, 'car_family_business')).toBe(true)
    const ev = findEvent('car_family_business')
    const hsTexts = visibleChoices(hs, ev).map((c) => c.text)
    expect(hsTexts).not.toContain('进公司，从坐办公室做起')
    expect(hsTexts).toContain('去家里的铺子帮忙，先干起来')

    const joined = choose(hs, 'car_family_business', '去家里的铺子帮忙，先干起来')
    expect(joined.career.kind).toBe('employed')
    expect(joined.tags).toContain('job_stall_vendor')

    const college = makeGame(7, { age: 25, education: 'college', tags: ['family_backed'], career: { kind: 'none' } })
    expect(visibleChoices(college, ev).map((c) => c.text)).toContain('进公司，从坐办公室做起')
    const noBack = makeGame(7, { age: 25, career: { kind: 'none' } })
    expect(isAvailable(noBack, 'car_family_business')).toBe(false)
  })

  it('老友报恩链：借过钱解锁「老友的船开了」，入伙 2 万两年后分红 3.6 万', () => {
    const lender = makeGame(7, { age: 30, money: 30000, tags: ['lent_money'] })
    expect(isAvailable(lender, 'rel_old_friend_success')).toBe(true)
    const stranger = makeGame(7, { age: 30, money: 30000 })
    expect(isAvailable(stranger, 'rel_old_friend_success')).toBe(false)

    const joined = choose(lender, 'rel_old_friend_success', '入伙，投两万进去')
    expect(joined.money).toBe(10000)
    expect(joined.tags).toContain('business_partner')
    const y2 = advanceYear(advanceYear(joined))
    expect(y2.yearLog.some((l) => l.includes('分红准时到了账'))).toBe(true)

    // 钱不够 2 万：入伙选项隐藏，仍有免费与人情出路
    const poor = makeGame(7, { age: 30, money: 15000, tags: ['lent_money'] })
    const texts = visibleChoices(poor, findEvent('rel_old_friend_success')).map((c) => c.text)
    expect(texts).not.toContain('入伙，投两万进去')
    expect(texts.length).toBeGreaterThanOrEqual(2)
  })

  it('反哺链：中年全力治过父母（cared_for_parents）解锁晚年「你陪他们变老」', () => {
    const aged = makeGame(7, { age: 60, tags: ['cared_for_parents'] })
    expect(isAvailable(aged, 'rel_parents_tender_years')).toBe(true)
    const young = makeGame(7, { age: 50, tags: ['cared_for_parents'] })
    expect(isAvailable(young, 'rel_parents_tender_years')).toBe(false)
    const ungrateful = makeGame(7, { age: 60 })
    expect(isAvailable(ungrateful, 'rel_parents_tender_years')).toBe(false)

    const moved = choose(aged, 'rel_parents_tender_years', '接他们过来一起住')
    const baseRel = makeGame(7, { age: 60, tags: ['cared_for_parents'] }).relations[0]
    expect(moved.relations[0].closeness).toBe(Math.min(100, baseRel.closeness + 8))
    expect(moved.attrs.happiness).toBe(aged.attrs.happiness + 3)
  })

  it('破镜重圆链：疏远→重建事件→chooseOption 落账成就「破镜重圆」', () => {
    let session = startSession({ seed: 20260926, backgroundId: 'ordinary', traitId: 'laid_back', name: '小赵' }, ALL_EVENTS)
    const patched: GameState = {
      ...session.state,
      tags: [...session.state.tags, 'estranged_parent'],
      relations: session.state.relations.map((r) => (r.kind === 'parent' ? { ...r, alive: false, estranged: true } : r)),
    }
    session = { ...session, state: patched, currentEvent: findEvent('rel_estranged_parent'), awaitingAdvance: false }
    const idx = choiceIndex(session.state, findEvent('rel_estranged_parent'), '先拨一个电话')
    session = chooseOption(session, idx)
    expect(session.state.achievements).toContain('ach_reunion')
    expect(session.state.relations.find((r) => r.kind === 'parent')!.alive).toBe(true)
    expect(session.state.history[session.state.history.length - 1].eventId).toBe('ach')
  })

  it('同 seed 双策略 30 年：履历、标记、成就全面分化且可复现', () => {
    function autoPlay(seed: number, pick: 'first' | 'last', years: number): GameState {
      let session = startSession({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '双线' }, ALL_EVENTS)
      let guard = 0
      while (session.state.phase === 'playing' && guard < years * 2) {
        guard++
        if (session.awaitingAdvance || !session.currentEvent) {
          session = nextYear(session, ALL_EVENTS)
        } else {
          const vis = visibleChoices(session.state, session.currentEvent)
          const c = pick === 'first' ? vis[0] : vis[vis.length - 1]
          session = chooseOption(session, session.currentEvent.choices.indexOf(c))
        }
      }
      return session.state
    }
    const a = autoPlay(9527, 'first', 30)
    const b = autoPlay(9527, 'last', 30)
    // 分化：履历选择串必然不同；标记或成就至少一维不同
    expect(a.history.map((h) => h.choice).join('|')).not.toBe(b.history.map((h) => h.choice).join('|'))
    const diverged =
      JSON.stringify(a.tags) !== JSON.stringify(b.tags) ||
      JSON.stringify(a.achievements) !== JSON.stringify(b.achievements) ||
      a.money !== b.money ||
      a.education !== b.education
    expect(diverged).toBe(true)
    // 复现：同策略重跑完全一致
    expect(autoPlay(9527, 'first', 30).history).toEqual(a.history)
    expect(autoPlay(9527, 'last', 30).achievements).toEqual(b.achievements)
  })
})
