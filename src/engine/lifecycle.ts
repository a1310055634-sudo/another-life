import type { AttrKey, EducationLevel, GameState, HistoryEntry, PendingEffect, Relation, SkillKey } from './types'
import { normalizeAttrs, sanitizeMoney, clampAttr } from './attrs'
import { rngFromState } from './rng'
import { checkLifeEnd, DEFAULT_MAX_AGE } from './outcomes'
import {
  STAGE_INFO,
  clampSkill,
  graduateStudent,
  upgradeEducation,
} from './education'
import { settleCareerYear } from './career'
import { jobStressPerYear } from '../data/careers'
import { financeStressDrift, livingExpense, settleFinanceYear, priceFactor, type FinanceYear } from './finance'
import { settleMortgageYear } from './mortgage'
import { applyRelationEffect, estrangementTag, settleBestFriendMarks, settleEstrangement, settleMarriageStrain, settleRelationDecay } from './relations'
import {
  settleParentDeath,
  settleCompanionDeath,
  settleSiblingDeath,
  settlePetDeath,
  GRIEF_TAG,
  GRIEF_COMPANION_TAG,
  GRIEF_PET_TAG,
  GRIEF_PET_YEARS,
  GRIEF_YEARS,
  GRIEF_HAPPINESS_DRAIN,
  GRIEF_IMMEDIATE_HIT,
  CRITICAL_TAG,
  CRITICAL_YEARS,
} from './parents'
import { applyLifestyleDrift, lowHealthWarnings } from './health'
import { BURNOUT_TAG, BURNOUT_HAPPINESS_DRAIN } from './lifestyle'
import { appreciateHome } from './home'
import { marketAt, MARKET_RETURN } from './fund'
import { citySalaryFactor } from './city'
import { pickYearLifeLine } from '../data/yearlife'
import { accumulateHealthRisk, chronicRiskRate, riskBandWarning, CHRONIC_CONDITION_TAG, CHRONIC_MANAGED_TAG, CHRONIC_MANAGED_YEARS, CHRONIC_ANNUAL_COST } from './lifestyle'
import { unlockAchievements } from './achievements'
import { takeSnapshot } from './snapshot'

// DEFAULT_MAX_AGE 自复验起由 outcomes.ts 唯一定义（对齐 SPEC 的 77 岁），此处随 checkLifeEnd 一并导入

/** 深负债线（第 13 轮）：跌破即打 been_deep_debt 标记——成就「无债一身轻」与结局总结的"曾经跌倒"证据 */
export const DEEP_DEBT_LINE = -50000

/**
 * 压力恢复带（第 82 轮，V4 挂账④清偿）：当年阶段压力项 ≤0（退休/零压岗位）且
 * 年初压力仍在恢复线以上时，年度结算额外回漂 STRESS_RECOVERY_RATE——压力从此
 * 有一条自然下行通道，不再只涨不跌。按年初压力判定（naturalAttrDrift 读结算前值）；
 * 与 ≥80 健康侵蚀、≥70 幸福拖累互不影响（两者同读年初值）。
 */
export const STRESS_RECOVERY_FLOOR = 55
export const STRESS_RECOVERY_RATE = 2

/** 各阶段的年度收支（第 10 轮起开支与现金流由 finance.ts 承担） */
export interface YearFinance {
  income: number
  expense: number
  /** 财务结算明细（租金/救济/利息/年志附注），供 advanceYear 落账 */
  fin: FinanceYear
}

export function baseYearFinance(state: GameState, rng: { next(): number }): YearFinance {
  let income = 0
  // 正式收入（工资/养老金）有年度波动；零工收入按日结算、总额平稳（也保证结算可精确复现）
  let fluctuates = false
  switch (state.career.kind) {
    case 'employed': {
      income = state.career.salary
      fluctuates = true
      break
    }
    case 'retired': {
      income = state.career.pension
      fluctuates = true
      break
    }
    case 'none': {
      // 过渡模型：没有正式职业时靠零工谋生，收入随教育、能力与职业技能上浮。
      // 第 9 轮职业系统接入后，此分支只覆盖"从未正式就业"的角色。
      const eduBonus =
        state.education === 'phd'
          ? 18000
          : state.education === 'master'
            ? 12000
            : state.education === 'college'
              ? 6000
              : 0
      // 职业技能换钱：每 10 点 +300（学徒工到老师傅的差距），上限 +3000
      const craftBonus = Math.floor((state.skills?.vocational ?? 0) / 10) * 300
      // 城市薪资系数（第 90 轮）：大城市零工也挣得多——与生活成本 ×1.3 对称
      income = Math.round((20000 + eduBonus + craftBonus + Math.floor(state.attrs.smarts / 5) * 500) * citySalaryFactor(state.city))
      break
    }
  }
  // 收入 ±8% 年度波动（来自可复现 RNG）
  if (income > 0 && fluctuates) {
    income = Math.round(income * (1 + (rng.next() * 0.16 - 0.08)))
  }
  // 租金/失业救济不参与波动；开支与学生学制特例、年龄分层、生活方式标记全在 finance.ts
  const fin = settleFinanceYear(state)
  income += fin.rent + fin.benefit
  return { income, expense: livingExpense(state), fin }
}

export interface YearDrift {
  drift: Partial<Record<AttrKey, number>>
  notes: string[]
}

/** 阶段与年龄带来的自然属性变化（不含事件效果） */
export function naturalAttrDrift(state: GameState, _rng: { next(): number }): YearDrift {
  const drift: Partial<Record<AttrKey, number>> = {}
  const notes: string[] = []
  const add = (k: AttrKey, v: number) => {
    drift[k] = (drift[k] ?? 0) + v
  }

  // 压力：阶段基调（在职者按岗位差异：护士三班倒 5、坐办公室 2……）
  const careerStress =
    state.career.kind === 'employed' ? jobStressPerYear(state)
      : state.career.kind === 'student' ? 2
        : state.career.kind === 'unemployed' ? 4
          : state.career.kind === 'retired' ? -4
            : 1
  add('stress', careerStress)
  // 压力恢复带（第 82 轮）：阶段压力项 ≤0 且年初压力 >55 → 额外 −2（退休年的
  // 「缓过来了」）。不设于在职年——在职饱和段由倦怠线（第 68 轮事件授予制）承载。
  if (careerStress <= 0 && state.attrs.stress > STRESS_RECOVERY_FLOOR) {
    add('stress', -STRESS_RECOVERY_RATE)
  }

  // 健康：年龄曲线
  if (state.age < 30) add('health', 1)
  else if (state.age >= 65) add('health', -2)
  else if (state.age >= 50) add('health', -1)

  // 慢性压力侵蚀健康
  if (state.attrs.stress >= 80) {
    add('health', -3)
    notes.push('长期高压开始侵蚀你的身体')
  }

  // 幸福：缓慢向中性回归 + 环境影响
  const gap = 50 - state.attrs.happiness
  if (Math.abs(gap) > 10) add('happiness', Math.sign(gap))
  if (state.attrs.stress >= 70) add('happiness', -2)

  // 财务压力（第 10 轮分档）：轻债提醒、深负债伤身伤心、大额存款体感安心
  const fs = financeStressDrift(state.money)
  if (fs.drift.happiness) add('happiness', fs.drift.happiness)
  if (fs.drift.stress) add('stress', fs.drift.stress)
  notes.push(...fs.notes)

  // 生活方式标记漂移（第 12 轮）：锻炼/熬夜/旧伤/康复/吸烟——健康变化能从过往选择解释
  const ls = applyLifestyleDrift(state.tags)
  for (const [k, v] of Object.entries(ls.drift) as Array<[AttrKey, number]>) {
    add(k, v)
  }

  return { drift, notes }
}

/** 应用到期的延迟效果，返回剩余挂起项 */
function settlePending(
  state: GameState,
  age: number,
  attrs: Record<AttrKey, number>,
  tags: string[],
  skills: Record<SkillKey, number>,
  moneyDelta: { v: number },
  education: { v: EducationLevel | null },
  relations: { v: Relation[] },
  notes: string[],
): PendingEffect[] {
  const remain: PendingEffect[] = []
  for (const p of state.pending) {
    if (p.dueAge <= age) {
      // 延迟文案与即时文案同一占位符规则（第 10 轮修复：{name} 未替换）
      if (p.summary) notes.push(p.summary.replace(/\{name\}/g, state.name))
      if (p.attr && typeof p.delta === 'number') attrs[p.attr] = clampAttr(p.attr, attrs[p.attr] + p.delta)
      if (typeof p.money === 'number') moneyDelta.v += p.money
      if (p.addTags) tags.push(...p.addTags)
      if (p.education) education.v = upgradeEducation(education.v ?? state.education, p.education)
      if (p.addSkills) {
        for (const g of p.addSkills) skills[g.id] = clampSkill(skills[g.id] + g.delta)
      }
      // 延迟关系效果（第 11 轮）：确定关系/关系回温/孩子出生等；
      // 孩子出生时传玩家年龄盖章 birthAge（第 26 轮子女生命阶段）
      if (p.relation) relations.v = applyRelationEffect(relations.v, p.relation, age, age, state.seed)
      // 周期性效果（第 12 轮）：还剩 repeat 次则隔年再结算一次（健身习惯/康复费等长期积累）
      if (typeof p.repeat === 'number' && p.repeat > 0) {
        remain.push({ ...p, id: `${p.id}~`, dueAge: age + 1, repeat: p.repeat - 1 })
      }
    } else {
      remain.push(p)
    }
  }
  return remain
}

/**
 * 学生进度：每年技能成长 + 学制推进；毕业时结算学历/高考。
 * 返回更新后的 career、skills、附加履历与提示；roll 仅在高考毕业年被消耗。
 */
function progressStudent(
  state: GameState,
  roll: number,
  skills: Record<SkillKey, number>,
): {
  career: GameState['career']
  patch: ReturnType<typeof graduateStudent> | null
} {
  if (state.career.kind !== 'student') return { career: state.career, patch: null }
  const stage = state.career.stage
  const yearsLeft = state.career.yearsLeft - 1
  for (const [k, d] of Object.entries(STAGE_INFO[stage].perYear) as Array<[SkillKey, number]>) {
    skills[k] = clampSkill(skills[k] + d)
  }
  if (yearsLeft > 0) {
    return { career: { kind: 'student', stage, yearsLeft }, patch: null }
  }
  return { career: { kind: 'none' }, patch: graduateStudent(state, roll, skills) }
}

/**
 * 推进一年：结算延迟效果、学生进度、收支、自然属性变化与结束检查。
 * 纯函数；phase !== 'playing' 时原样返回（防重复推进守卫）。
 */
export function advanceYear(state: GameState, options: { maxAge?: number } = {}): GameState {
  if (state.phase !== 'playing') return state
  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE
  const rng = rngFromState(state.rngState)

  const notes: string[] = []
  const yearLog: string[] = []
  const age = state.age + 1
  const attrs = { ...state.attrs }
  const tags = [...state.tags]
  const skills: Record<SkillKey, number> = {
    academics: clampSkill(state.skills?.academics ?? 0),
    vocational: clampSkill(state.skills?.vocational ?? 0),
  }
  const moneyDelta = { v: 0 }
  const pendingEdu: { v: EducationLevel | null } = { v: null }
  const relationsBox: { v: Relation[] } = { v: [...state.relations] }

  // 0.5) 关系亲密度年度自然衰减（第 25 轮）：朋友/恋人 -2、配偶/父母/孩子 -1、宠物 0；
  //      estranged 与已移除的关系不衰减（不重复伤害）。在延迟效果落地之前结算——
  //      当年新增/复活的关系来年起算（与第 12 轮"当年授予的标记次年起计漂移"同时序）。
  //      纯确定性、不消耗 RNG；跌破黄灯线（20）当年年志提示一次。
  const decay = settleRelationDecay(relationsBox.v)
  relationsBox.v = decay.relations
  for (const w of decay.warnings) {
    notes.push(`你和${w.name}之间的话越来越少了`)
  }
  // 挚友标记年度升降（第 66 轮）：用衰减后的亲密度判定——≥60 盖挚友、<40 摘除；
  // 挚友衰减 −1/普通 −2（双档在 settleRelationDecay 内实现），阈值口径见 relations.ts。
  const marks = settleBestFriendMarks(relationsBox.v)
  relationsBox.v = marks.relations
  for (const p of marks.promoted) {
    notes.push(`${p}处成了无话不谈的挚友`)
  }
  // 婚姻危机 strain（第 67 轮）：marriage_crisis 标记在场 → 存活配偶额外 −2（合计 −3/年）；
  // 修复类事件摘除标记即停止（events/marriage.ts）。
  const strain = settleMarriageStrain(relationsBox.v, tags)
  relationsBox.v = strain.relations
  if (strain.strained) {
    notes.push('这段日子，家里安静得可怕')
  }

  // 1) 到期延迟效果（含延迟学历/技能/关系）
  const pending = settlePending(state, age, attrs, tags, skills, moneyDelta, pendingEdu, relationsBox, notes)

  // 2) 学生进度：技能成长、学制推进、毕业/高考结算
  //    RNG 只在高考放榜这一刻消耗一次，其余路径的随机数序列不变
  const willSitGaokao =
    state.career.kind === 'student' &&
    state.career.stage === 'highschool' &&
    state.career.yearsLeft - 1 <= 0
  const roll = willSitGaokao ? rng.next() : 0
  const grad = progressStudent(state, roll, skills)
  let education = state.education
  const extraHistory: HistoryEntry[] = []
  if (grad.patch) {
    education = upgradeEducation(state.education, grad.patch.education)
    const stage = state.career.kind === 'student' ? state.career.stage : null
    if (stage) tags.push(STAGE_INFO[stage].graduateTag, ...grad.patch.admitTags)
    extraHistory.push({ ...grad.patch.historyEntry, key: true })
    notes.push(...grad.patch.notes)
  }
  if (pendingEdu.v) education = upgradeEducation(education, pendingEdu.v)

  // 2.5) 在职年度结算（第 9 轮）：工龄、年薪自然上调、满年限的考核晋升；
  //      待业者累计失业周数。纯确定性结算，不消耗 RNG。
  const careerOut = settleCareerYear({ ...state, career: grad.career, skills }, skills)
  if (careerOut.history) extraHistory.push({ ...careerOut.history, key: true })
  notes.push(...careerOut.notes)
  // 到龄自动退休（第 16 轮）：岗位标记转行业经历、授予 retired（与事件退休同语义）
  if (careerOut.addTags) tags.push(...careerOut.addTags)
  for (const t of careerOut.removeTags ?? []) {
    const i = tags.indexOf(t)
    if (i >= 0) tags.splice(i, 1)
  }

  // 3) 年度收支（用学生进度与职业结算后的身份结算：毕业当年就开始打工挣钱，晋升当年涨薪）。
  //    第 45 轮：relations 传结算中的关系表（延迟落地后的 relationsBox.v）——
  //    孩子落地当年即计口粮（settlePending 在 1 步已落地，落地于年初、按全年计），
  //    修正 V2 以来「出生当年不计、次年起算」的时序偏差。年内疏远（4.5 步）晚于
  //    财务结算，当年照付、次年起停付——与既有口径一致，不在此步处理。
  const finState = { ...state, career: careerOut.career, age, relations: relationsBox.v }
  const { income, expense, fin } = baseYearFinance(finState, rng)
  moneyDelta.v += income - expense
  if (income > 0) yearLog.push(`收入 ${income.toLocaleString('zh-CN')} 元`)
  yearLog.push(`支出 ${expense.toLocaleString('zh-CN')} 元`)

  // 3.5) 利息与财务附注（第 10 轮）：利息按年初余额（state.money）计，与当年收支无关
  moneyDelta.v += fin.savingsInterest - fin.debtInterest
  notes.push(...fin.notes)

  // 3.6) 房贷年度扣款（第 23 轮）：等额本息年供自动划扣，固定可预期；
  //      还清年按余额结清尾款，落一条关键履历（结局总结与后续成就的素材）。
  const mortgageOut = settleMortgageYear(state.mortgage)
  if (mortgageOut.payment > 0) {
    moneyDelta.v -= mortgageOut.payment
    yearLog.push(`房贷扣款 ${mortgageOut.payment.toLocaleString('zh-CN')} 元`)
    if (mortgageOut.cleared) {
      notes.push('最后一笔房贷划走了，房子彻底是自己的了')
      // 第 31 轮：还清留痕（成就链「房贷结清」的资格标记），自然还清与提前还清同标记
      if (!tags.includes('mortgage_cleared')) tags.push('mortgage_cleared')
      extraHistory.push({
        age,
        eventId: 'settle',
        title: '还清房贷',
        choice: '',
        summary: '还清了全部房贷',
        key: true,
      })
    }
  }

  // 3.65) 房产现值复利（第 86 轮）：持有住房按 HOME_APPRECIATION 年复利增值
  //       （纯确定性，不消耗 rng；只动 home.value 不动现金——资产曲线/报告的
  //       现金口径不变，无房旧局此步 no-op，18 局零位移的结构性保证）。
  const home = appreciateHome(state.home, state.city)

  // 3.7) 基金定投与市值结算（第 87 轮）：开启定投的局，年结先划扣当年定投
  //      （结算中现金不足则断供——份额照吃收益，年志提示），再按独立支流
  //      牛熊序列结算市值（marketAt 确定性重放，不消耗主 rng）。未开户旧局
  //      此步 no-op，18 局零位移的结构性保证。
  let fund = state.fund
  if (fund) {
    const market = marketAt(state.seed, age)
    const r = MARKET_RETURN[market]
    const cashNow = state.money + moneyDelta.v
    if (cashNow >= fund.annualContribution) {
      moneyDelta.v -= fund.annualContribution
      fund = { ...fund, units: Math.round((fund.units + fund.annualContribution) * (1 + r)) }
    } else {
      fund = { ...fund, units: Math.round(fund.units * (1 + r)) }
      notes.push('手头太紧，今年的定投断供了')
    }
  }

  if (moneyDelta.v + state.money < 0 && state.money >= 0) notes.push('你开始负债了')

  // 4) 自然属性变化（含分档财务压力；传入本轮收支后的财务状况）
  const { drift, notes: driftNotes } = naturalAttrDrift(
    { ...state, career: careerOut.career, age, money: state.money + moneyDelta.v },
    rng,
  )
  notes.push(...driftNotes)
  for (const k of Object.keys(drift) as AttrKey[]) {
    attrs[k] = clampAttr(k, attrs[k] + (drift[k] ?? 0))
  }

  // 4.35) 慢性病长期线（第 43 轮）：管理标记到期清理先于风险累积——到期年即按
  //       失控增速记账；年度复查用药开支随物价系数（61+ → 1,380）。
  //       cooldowns 副本在此创建（慢病/病危/哀伤三套借用键共用，见 4.55）。
  const cooldowns: Record<string, number> = { ...state.cooldowns }
  const managedIdx = tags.indexOf(CHRONIC_MANAGED_TAG)
  if (managedIdx >= 0) {
    if (cooldowns[CHRONIC_MANAGED_TAG] === undefined) {
      cooldowns[CHRONIC_MANAGED_TAG] = age + CHRONIC_MANAGED_YEARS
    } else if (age >= cooldowns[CHRONIC_MANAGED_TAG]) {
      tags.splice(managedIdx, 1)
      delete cooldowns[CHRONIC_MANAGED_TAG]
      notes.push('好一阵没去复查了，药也吃得有一搭没一搭')
    }
  }
  if (tags.includes(CHRONIC_CONDITION_TAG)) {
    const cost = Math.round(CHRONIC_ANNUAL_COST * priceFactor(age))
    moneyDelta.v -= cost
    yearLog.push(`慢病复查与用药 ${cost.toLocaleString('zh-CN')} 元`)
  }

  // 4.4) 生活方式风险累积（第 24 轮）：按「标记 × 年龄」记账，只累积不直接改属性——
  //      兑现走分级体检与慢性病事件（资格读累积值）。用结算中的 tags：当年染上当年记账，
  //      当年戒断当年停涨；历史累积保留（戒烟不清零）。慢病在身按管理状态追加增速（第 43 轮）。
  const prevRisk = state.healthRisk ?? 0
  const healthRisk = accumulateHealthRisk(tags, age, prevRisk, chronicRiskRate(tags))
  const riskNote = riskBandWarning(prevRisk, healthRisk)
  if (riskNote) notes.push(riskNote)

  // 4.5) 关系年度结算（第 11 轮）：亲密度跌到 0 的关系自动疏远（破裂兜底）。
  //      纯确定性结算，不消耗 RNG；疏远写入标记，供"重新建立"类事件读取。
  const estr = settleEstrangement(relationsBox.v)
  relationsBox.v = estr.relations
  for (const b of estr.broke) {
    notes.push(`你和${b.name}断了来往`)
    tags.push(estrangementTag(b.kind))
    extraHistory.push({
      age,
      eventId: 'settle',
      title: '疏远',
      choice: '',
      summary: `与${b.name}的关系破裂了`,
      key: true,
    })
  }

  // 4.6) 低健康分级预警（第 12 轮）：按结算后的健康值提醒——杜绝"毫无预兆的突然死亡"
  notes.push(...lowHealthWarnings(attrs.health))

  // 4.55) 父母去世与哀伤期（第 41 轮）：在疏远兜底之后判定——被疏远（断绝来往）的
  //       父母不在判定范围；判定用结算中的 tags（当年授予的照护当年计风险，与第 24 轮
  //       生活方式「当年染上当年记账」同时序）。独立随机流不消耗主 rngState（事件抽取
  //       序列零位移）；去世后 alive=false + deceased，在册资格自动失效，revive 不复活。
  //       cooldowns 副本已在 4.35 创建（第 43 轮上移）。
  // 哀伤期到期移除与年度情绪代价（第 44 轮泛化：父母 grief_parent / 搭伴伴侣
  // grief_companion 同款逻辑——到期年移除不再扣，期间每年 happiness −1）
  for (const gTag of [GRIEF_TAG, GRIEF_COMPANION_TAG, GRIEF_PET_TAG]) {
    const gIdx = tags.indexOf(gTag)
    if (gIdx >= 0 && age >= (cooldowns[gTag] ?? Infinity)) {
      tags.splice(gIdx, 1)
      delete cooldowns[gTag]
      notes.push('时间抚平了一部分哀伤')
    }
    if (tags.includes(gTag)) {
      attrs.happiness = clampAttr('happiness', attrs.happiness - GRIEF_HAPPINESS_DRAIN)
    }
  }
  // 倦怠标记（第 68 轮）：事件授予制（过载顶点事件「硬扛」支授予）——stress 全域
  // 动力学饱和（R68 三探针实证：≥80 连 2 年 91% 局、=100 连 2 年 69% 局），纯阈值
  // 判定会把倦怠变成全民状态，故改由事件抉择授予；stress <60 自动摘除（身体放过
  // 自己）；倦怠期间每年 happiness −1（grief 同款静默扣）。
  const burnIdx = tags.indexOf(BURNOUT_TAG)
  if (burnIdx >= 0) {
    if (attrs.stress < 60) {
      tags.splice(burnIdx, 1)
      notes.push('压力终于落下来了，你慢慢缓了过来')
    } else {
      attrs.happiness = clampAttr('happiness', attrs.happiness - BURNOUT_HAPPINESS_DRAIN)
    }
  }
  // 病危标记到期清理（第 42 轮）：事件卡没有写 cooldowns 的通道，结算时补到期戳
  // （首次发现补 age+CRITICAL_YEARS），到期移除——病危不会无限悬置，陪伴事件
  // （removeTags）仍是主出口。清理先于去世判定：到期年不再吃病危提速。
  const critIdx = tags.indexOf(CRITICAL_TAG)
  if (critIdx >= 0) {
    if (cooldowns[CRITICAL_TAG] === undefined) {
      cooldowns[CRITICAL_TAG] = age + CRITICAL_YEARS
    } else if (age >= cooldowns[CRITICAL_TAG]) {
      tags.splice(critIdx, 1)
      delete cooldowns[CRITICAL_TAG]
    }
  }
  // 去世判定与身后事：丧葬开支进年志流水，遗产按被照护/亲密判定；
  // 送别当年落 key 履历（结局总结与第 50 轮「送终」成就的素材）。
  const pd = settleParentDeath(relationsBox.v, tags, age, state.seed)
  if (pd.deaths.length > 0) {
    relationsBox.v = pd.relations
    moneyDelta.v -= pd.funeral
    let inherit = 0
    for (const d of pd.deaths) {
      inherit += d.inheritance
      notes.push(`${d.name}走了。你送了最后一程`)
      extraHistory.push({
        age,
        eventId: 'settle',
        title: '送别',
        choice: '',
        summary: `${d.name}去世了`,
        key: true,
      })
    }
    if (pd.funeral > 0) yearLog.push(`丧事开支 ${pd.funeral.toLocaleString('zh-CN')} 元`)
    if (inherit > 0) {
      moneyDelta.v += inherit
      yearLog.push(`遗物与积蓄 ${inherit.toLocaleString('zh-CN')} 元`)
    }
    // 即时情绪冲击 + 进入/刷新哀伤期（再失亲刷新到期年，哀伤更久）
    attrs.happiness = clampAttr('happiness', attrs.happiness - GRIEF_IMMEDIATE_HIT)
    if (!tags.includes(GRIEF_TAG)) tags.push(GRIEF_TAG)
    cooldowns[GRIEF_TAG] = age + GRIEF_YEARS
  }
  // 搭伴伴侣去世（第 44 轮）：late_companionship 标记在场的真实 partner 关系，
  // 固定年率独立 roll（独立随机流不消耗主 rngState）；身后事=丧葬+哀伤期，
  // 不设遗产（搭伴财产各自归置）。
  const cd = settleCompanionDeath(relationsBox.v, tags, age, state.seed)
  if (cd.died) {
    relationsBox.v = cd.relations
    moneyDelta.v -= cd.funeral
    yearLog.push(`丧事开支 ${cd.funeral.toLocaleString('zh-CN')} 元`)
    notes.push(`${cd.died.name}走了。屋里又剩你一个人的脚步声`)
    extraHistory.push({
      age,
      eventId: 'settle',
      title: '送别',
      choice: '',
      summary: `${cd.died.name}去世了`,
      key: true,
    })
    attrs.happiness = clampAttr('happiness', attrs.happiness - GRIEF_IMMEDIATE_HIT)
    if (!tags.includes(GRIEF_COMPANION_TAG)) tags.push(GRIEF_COMPANION_TAG)
    cooldowns[GRIEF_COMPANION_TAG] = age + GRIEF_YEARS
  }


  // 手足晚年先逝（第 64 轮）：真实年龄查表独立 roll（独立随机流零位移）；
  // 身后事=丧葬+送别 key 履历；本轮不设遗产与哀伤期（SPEC §6.35）。
  const sd = settleSiblingDeath(relationsBox.v, age, state.seed)
  if (sd.deaths.length > 0) {
    relationsBox.v = sd.relations
    moneyDelta.v -= sd.funeral
    for (const d of sd.deaths) {
      notes.push(`${d.name}走了。你送了最后一程`)
      extraHistory.push({
        age,
        eventId: 'settle',
        title: '送别',
        choice: '',
        summary: `${d.name}去世了`,
        key: true,
      })
    }
    if (sd.funeral > 0) yearLog.push(`丧事开支 ${sd.funeral.toLocaleString('zh-CN')} 元`)
    attrs.happiness = clampAttr('happiness', attrs.happiness - GRIEF_IMMEDIATE_HIT)
  }
  // 宠物到龄离世（第 69 轮）：确定性到龄（散列定寿 12–16 年，随机支流零位移）；
  // 身后事 = 善后 500 + grief_pet 哀伤 2 年（泛化循环到期消退）；送别 key 履历。
  const ptd = settlePetDeath(relationsBox.v, age, state.seed)
  if (ptd.deaths.length > 0) {
    relationsBox.v = ptd.relations
    moneyDelta.v -= ptd.aftercare
    for (const d of ptd.deaths) {
      notes.push(`${d.name}走了。饭盆还摆在墙角`)
      extraHistory.push({
        age,
        eventId: 'settle',
        title: '送别',
        choice: '',
        summary: `${d.name}去世了`,
        key: true,
      })
    }
    if (ptd.aftercare > 0) yearLog.push(`善后开支 ${ptd.aftercare.toLocaleString('zh-CN')} 元`)
    attrs.happiness = clampAttr('happiness', attrs.happiness - GRIEF_IMMEDIATE_HIT)
    if (!tags.includes(GRIEF_PET_TAG)) tags.push(GRIEF_PET_TAG)
    cooldowns[GRIEF_PET_TAG] = age + GRIEF_PET_YEARS
  }

  const money = sanitizeMoney(state.money + moneyDelta.v)

  // 深负债标记（第 13 轮）：只记录"曾经跌倒"，不参与任何漂移；爬回正资产时成就结算
  if (money <= DEEP_DEBT_LINE && !tags.includes('been_deep_debt')) tags.push('been_deep_debt')

  const settled: GameState = {
    ...state,
    rngState: rng.state(),
    age,
    attrs: normalizeAttrs(attrs),
    money,
    education,
    skills,
    career: careerOut.career,
    // 累计工龄/缴费年限（第 22 轮）：在职年 +1，其余身份不变；旧档缺省 0
    workYears: careerOut.workYears,
    // 房贷余额（第 23 轮）：年度摊还后的新余额；还清即移除字段（缺省 = 无贷款）
    mortgage: mortgageOut.mortgage ?? undefined,
    // 房产现值（第 86 轮）：年结复利后的新现值；无房缺省 undefined
    home,
    // 基金市值（第 87 轮）：定投划扣+牛熊结算后的新市值；未开户缺省 undefined
    fund,
    // 生活方式风险值（第 24 轮）：本年度累积后的新值；旧档缺省 0
    healthRisk,
    // 事件冷却与哀伤期到期年龄（第 41 轮借用键 GRIEF_TAG → 到期年龄）：
    // 哀伤期消退/刷新会写删条目，落账用本年度副本
    cooldowns,
    relations: relationsBox.v,
    tags: [...new Set(tags)],
    pending,
    history: extraHistory.length > 0 ? [...state.history, ...extraHistory] : state.history,
    yearLog: notes.length > 0 ? [...yearLog, ...notes] : yearLog,
  }
  // 年度快照（第 21 轮）：年度结算定型后取切面追加——成就判定与结束检查都不改
  // 快照五元组（age/money/attrs/career），终局年（下一步 phase='ended'）也保有本年快照。
  // `?? []` 仅为旧档未经迁移直接进引擎的容错，正常路径由存档迁移保证字段存在。
  const nextState: GameState = {
    ...settled,
    snapshots: [...(state.snapshots ?? []), takeSnapshot(settled)],
  }
  // 4.7 成就判定（第 13 轮）：按结算后的状态解锁，写入 achievements 与 key 履历；
  //     年志补一行提示，让"进入下一年"后立刻可见。
  const achOut = unlockAchievements(nextState)
  if (achOut.unlocked.length > 0) {
    achOut.state.yearLog = [
      ...achOut.state.yearLog,
      ...achOut.unlocked.map((a) => `🏅 达成成就「${a.name}」`),
    ]
  }

  // 5) 结束检查
  const endingId = checkLifeEnd(achOut.state, maxAge)
  if (endingId) {
    achOut.state.phase = 'ended'
    achOut.state.endingId = endingId
  }

  // 年志生活流（第 71 轮）：结局年（endingId 触发）与 >75 岁不加；抽取走
  // FNV 散列支流（seed⊕年龄⊕人生序号，见 data/yearlife.ts），绝不消耗主
  // rng 流——固定 seed 局事件抽取序列零位移，机制值零变化（era 指纹背书）。
  if (!endingId) {
    const line = pickYearLifeLine(achOut.state.seed, age)
    if (line) {
      achOut.state.yearLog = [...achOut.state.yearLog, line]
    }
  }

  return achOut.state
}

/** 是否允许推进（UI 守卫） */
export function canAdvance(state: GameState): boolean {
  return state.phase === 'playing'
}
