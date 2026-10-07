import type {
  EventCondition,
  EventChoice,
  GameEvent,
  GameState,
  HistoryEntry,
  PendingEffect,
  Relation,
  RelationEffect,
  RelationKind,
} from './types'
import { applyEffects, sanitizeMoney } from './attrs'
import { clampSkill, enterEducation } from './education'
import { employPatch, endEmploymentPatch, promotePatch, retirePatch, applySalaryMul, RETIRE_PENSION_MUL } from './career'
import { getJob } from '../data/careers'
import { BIG_SPEND_THRESHOLD } from './finance'
import { mortgageBalance, openMortgage } from './mortgage'
import { sellNetProceeds } from './home'
import { marketAt } from './fund'
import { civilExamAdmitted, civilTargetJob } from './civilservice'
import { cityOf } from './city'
import { viralAt, hateAt } from './fame'
import { accidentRiskAt, illnessRiskAt, suddenRiskAt } from './suddendeath'
import { ventureCloseAt, ventureProfitAt } from './venture'
import { PARENT_AGE_OFFSET } from './parents'
import { pickChildByStage, markChildMilestone } from './children'
import { applyRelationEffect, deltaClosenessById } from './relations'
import type { Rng } from './rng'

/**
 * 教育与技能投资不视为大额消费：负债者更不能断掉上进路（第 8 轮"低学历路线
 * 也要能发展"的设计底线——复读/自考/培训班这类选项在负债时必须保持可见）。
 */
function isInvestment(choice: EventChoice): boolean {
  return (
    choice.effects.some((e) => e.startEducation !== undefined || e.addSkill !== undefined) ||
    (choice.delayed ?? []).some((d) => d.education !== undefined || d.addSkills !== undefined)
  )
}

/** 选项是否为大额消费（即时支出 ≥ 阈值；延迟支出不算——分期是负债者的合法出路）。
 *  提前还房贷本金视同即时大额支出（第 23 轮）：负债时先顾眼下，不做提前还款。 */
function isBigSpend(choice: EventChoice): boolean {
  if (isInvestment(choice)) return false
  return choice.effects.some(
    (e) =>
      (typeof e.money === 'number' && e.money <= -BIG_SPEND_THRESHOLD) ||
      (typeof e.payMortgage === 'number' && e.payMortgage >= BIG_SPEND_THRESHOLD),
  )
}

/** 事件/选项条件是否满足（条件为空视为满足） */
export function checkCondition(state: GameState, cond?: EventCondition): boolean {
  if (!cond) return true
  const { attrs, money, age, education, career, tags, relations, skills } = state

  if (cond.minAge !== undefined && age < cond.minAge) return false
  if (cond.maxAge !== undefined && age > cond.maxAge) return false

  for (const [k, min] of Object.entries(cond.minAttr ?? {})) {
    if (attrs[k as keyof typeof attrs] < (min as number)) return false
  }
  for (const [k, max] of Object.entries(cond.maxAttr ?? {})) {
    if (attrs[k as keyof typeof attrs] > (max as number)) return false
  }

  if (cond.education && !cond.education.includes(education)) return false
  if (cond.careerKinds && !cond.careerKinds.includes(career.kind)) return false
  if (cond.studentStages && (career.kind !== 'student' || !cond.studentStages.includes(career.stage)))
    return false
  if (cond.jobLevels && (career.kind !== 'employed' || !cond.jobLevels.includes(career.level))) return false
  if (cond.promotionAvailable) {
    if (career.kind !== 'employed') return false
    const job = getJob(career.jobId)
    if (!job || career.level >= (job.maxLevel ?? 4)) return false
  }

  for (const [k, min] of Object.entries(cond.minSkills ?? {})) {
    if ((skills?.[k as keyof typeof skills] ?? 0) < (min as number)) return false
  }
  for (const [k, max] of Object.entries(cond.maxSkills ?? {})) {
    if ((skills?.[k as keyof typeof skills] ?? 0) > (max as number)) return false
  }

  if (cond.tagsAll && !cond.tagsAll.every((t) => tags.includes(t))) return false
  if (cond.tagsAny && !cond.tagsAny.some((t) => tags.includes(t))) return false
  if (cond.tagsNone && cond.tagsNone.some((t) => tags.includes(t))) return false

  if (cond.moneyAtLeast !== undefined && money < cond.moneyAtLeast) return false
  if (cond.moneyBelow !== undefined && money >= cond.moneyBelow) return false

  // 房贷余额门槛（第 23 轮）：月供/对账类事件的资格 = 名下还有没还完的贷款
  if (cond.mortgageBalanceAtLeast !== undefined && mortgageBalance(state.mortgage) < cond.mortgageBalanceAtLeast)
    return false

  // 生活方式风险值门槛（第 24 轮）：分级体检/慢性病事件按累积风险值分档触发（缺省 0）
  if (cond.healthRiskAtLeast !== undefined && (state.healthRisk ?? 0) < cond.healthRiskAtLeast)
    return false
  if (cond.healthRiskBelow !== undefined && (state.healthRisk ?? 0) >= cond.healthRiskBelow)
    return false

  // 无保单门槛（第 85 轮）：投保类事件只在 state.insurance 不在册时可用（防重复投保）
  if (cond.insuranceMissing && state.insurance)
    return false

  // 名下有房门槛（第 86 轮）：持有/变卖类事件只在 state.home 在册时可用
  if (cond.homeOwned && !state.home)
    return false

  // 基金门槛（第 87 轮）：已开户 + 市场态匹配（态由 seed 派生序列确定性重放）
  if (cond.fundOwned && !state.fund)
    return false

  // 学业功底门槛（第 88 轮）：考公类事件按 skills.academics 分档
  if (cond.minAcademics !== undefined && (state.skills?.academics ?? 0) < cond.minAcademics)
    return false

  // 职业技能门槛（第 92 轮）：技术工种事件按 skills.vocational 分档
  if (cond.minVocational !== undefined && (state.skills?.vocational ?? 0) < cond.minVocational)
    return false

  // 城市层级门槛（第 90 轮）：城市类事件按当前层级放行（OR 语义；缺省 hometown）
  if (cond.cityIn && !cond.cityIn.includes(cityOf(state.city)))
    return false

  // 自媒体支流窗口（第 93 轮）：走红向/网暴向由 seed 派生散列确定性重放
  if (cond.fameChance === 'viral' && !viralAt(state.seed, state.age))
    return false
  if (cond.fameChance === 'hate' && !hateAt(state.seed, state.age))
    return false

  // 意外风险年（第 95 轮）：death_young 补现窄门散列门
  if (cond.suddenRisk === true && !suddenRiskAt(state.seed, state.age))
    return false

  // 死亡窄门年（第 112 轮）：lethal 事件专用低频散列门（意外向/急病向各一盐）
  if (cond.accidentRisk === true && !accidentRiskAt(state.seed, state.age))
    return false
  if (cond.illnessRisk === true && !illnessRiskAt(state.seed, state.age))
    return false

  // 创业支流年（第 116 轮）：进账向/关门向各一盐
  if (cond.ventureProfit === true && !ventureProfitAt(state.seed, state.age))
    return false
  if (cond.ventureClose === true && !ventureCloseAt(state.seed, state.age))
    return false

  // 离异身份门槛（第 91 轮）：再婚窗口/单身岁月只对离过婚的人开放
  if (cond.divorced && !state.tags.includes('divorced'))
    return false
  if (cond.fundMarket !== undefined && (!state.fund || marketAt(state.seed, state.age) !== cond.fundMarket))
    return false

  if (cond.relationKinds && !cond.relationKinds.some((k) => relations.some((r) => r.kind === k && r.alive)))
    return false
  // 单身路线门槛：列出的任何一种存活关系都不允许存在
  if (cond.relationKindsNone && cond.relationKindsNone.some((k) => relations.some((r) => r.kind === k && r.alive)))
    return false
  for (const [k, min] of Object.entries(cond.minCloseness ?? {})) {
    const rel = relations.find((r) => r.kind === (k as RelationKind) && r.alive)
    if (!rel || rel.closeness < (min as number)) return false
  }
  for (const [k, max] of Object.entries(cond.maxCloseness ?? {})) {
    const rel = relations.find((r) => r.kind === (k as RelationKind) && r.alive)
    if (!rel || rel.closeness > (max as number)) return false
  }

  // 子女生命阶段资格（第 26 轮）：年龄窗与里程碑资格须落在同一个孩子身上
  if (cond.childStage && !pickChildByStage(relations, age, cond.childStage)) return false

  // 父母身后事资格（第 42 轮）：N 年内送别过父母（去世年由 deathAge − 近似偏移反推）
  if (cond.parentDiedWithin !== undefined) {
    const diedRecently = relations.some((r) => {
      if (r.kind !== 'parent' || !r.deceased || typeof r.deathAge !== 'number') return false
      const yearsAgo = age - (r.deathAge - PARENT_AGE_OFFSET)
      return yearsAgo >= 0 && yearsAgo <= cond.parentDiedWithin!
    })
    if (!diedRecently) return false
  }
  // 双亲皆逝（第 42 轮）：有送别档案且再无在册父母
  if (cond.parentsAllDeceased) {
    const hasDeceased = relations.some((r) => r.kind === 'parent' && r.deceased)
    const hasAlive = relations.some((r) => r.kind === 'parent' && r.alive)
    if (!hasDeceased || hasAlive) return false
  }
  // 手足身后事资格（第 65 轮）：N 年内送别过手足。deathAge 记手足年龄，
  // 玩家当时的年龄 = deathAge + birthAge（birthAge 带正负，缺章按同龄 0 兜底）
  if (cond.siblingDiedWithin !== undefined) {
    const diedRecently = relations.some((r) => {
      if (r.kind !== 'sibling' || !r.deceased || typeof r.deathAge !== 'number') return false
      const offset = typeof r.birthAge === 'number' ? r.birthAge : 0
      const yearsAgo = age - (r.deathAge + offset)
      return yearsAgo >= 0 && yearsAgo <= cond.siblingDiedWithin!
    })
    if (!diedRecently) return false
  }

  return true
}

/** 某事件在当前状态下可见的选项 */
export function visibleChoices(state: GameState, event: GameEvent): EventChoice[] {
  return event.choices.filter(
    (c) => checkCondition(state, c.requires) && !(state.money < 0 && isBigSpend(c)),
  )
}


/** 事件当前是否可触发（年龄、条件、once、冷却、至少两个可见选项） */
export function isEventAvailable(state: GameState, event: GameEvent): boolean {
  if (event.choices.length < 2) return false
  if (state.age < event.minAge || state.age > event.maxAge) return false
  if (event.once && state.seenEvents.includes(event.id)) return false
  const cdUntil = state.cooldowns[event.id]
  if (cdUntil !== undefined && state.age < cdUntil) return false
  if (!checkCondition(state, event.requires)) return false
  const visible = visibleChoices(state, event).length
  if (visible >= 2) return true
  // 普通事件须在状态过滤后仍有 ≥2 个可结算选项才入卡（第 19 轮）：
  // 只剩一个"选项"的事件卡是假选择，不如不出现——由其他可用事件或保底维持推进。
  // 强制剧情单选例外走 singleChoiceOk 白名单（数据侧逐项附理由，测试锁定清单）。
  return visible >= 1 && event.singleChoiceOk === true
}

/** 筛选当前可触发的事件池 */
export function availableEvents(state: GameState, pool: GameEvent[]): GameEvent[] {
  return pool.filter((e) => isEventAvailable(state, e))
}

/** 在候选池内按权重抽取一个事件（高优先级层优先） */
export function weightedPick(candidates: GameEvent[], rng: Rng, traitWeight?: (e: GameEvent) => number): GameEvent {
  if (candidates.length === 1) return candidates[0]
  const maxPriority = Math.max(...candidates.map((e) => e.priority ?? 0))
  const top = candidates.filter((e) => (e.priority ?? 0) === maxPriority)
  const weights = top.map((e) => Math.max(1, (e.weight ?? 10) * (traitWeight?.(e) ?? 1)))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < top.length; i++) {
    roll -= weights[i]
    if (roll < 0) return top[i]
  }
  return top[top.length - 1]
}

/** 保底事件：池空时让人生继续（文本带点随机味，但确定性） */
export function fallbackEvent(): GameEvent {
  const quiet: EventChoice = {
    text: '安静地过',
    summary: '这一年波澜不惊',
    effects: [{ attr: 'happiness', delta: 1 }],
  }
  const walk: EventChoice = {
    text: '出门走走，透透气',
    summary: '散心让心情好了一点',
    effects: [
      { attr: 'happiness', delta: 2 },
      { attr: 'health', delta: 1 },
    ],
  }
  const reflect: EventChoice = {
    text: '想想接下来该怎么走',
    effects: [{ attr: 'smarts', delta: 1 }, { attr: 'stress', delta: 1 }],
  }
  return {
    id: 'fallback_quiet_year',
    category: 'life',
    title: '平凡的一年',
    text: '{name}这一年没什么特别的事，日子像水一样流过去。',
    minAge: 18,
    maxAge: 99,
    weight: 1,
    choices: [quiet, walk, reflect],
  }
}

/**
 * 从池中为当前状态抽取一个事件。
 * 池不足时返回保底事件，游戏永远能继续。
 * traitWeight 可选：按事件类别等维度放大权重（第 7 轮特质系统接入）。
 */
export function drawEvent(
  state: GameState,
  pool: GameEvent[],
  rng: Rng,
  traitWeight?: (e: GameEvent) => number,
): GameEvent {
  const candidates = availableEvents(state, pool)
  if (candidates.length === 0) return fallbackEvent()
  return weightedPick(candidates, rng, traitWeight)
}

/** 应用关系效果（纯函数）。salt 用年龄等确定值，保证同 seed 可复现；
 *  playerAge 供孩子/孙辈出生时盖章 birthAge（第 26/44 轮）；
 *  seed 供名字缺省时取名池确定具名（第 44 轮） */
export function applyRelationEffects(
  relations: Relation[],
  effect: RelationEffect,
  salt = 0,
  playerAge?: number,
  seed = 0,
): Relation[] {
  return applyRelationEffect(relations, effect, salt, playerAge, seed)
}

export interface AppliedChoice {
  state: GameState
  summary: string
}

/**
 * 应用玩家在事件中的选择（纯函数）：
 * 即时效果、延迟效果、标记、学历/技能/学籍变化、冷却、履历记录一步完成。
 */
export function applyChoice(state: GameState, event: GameEvent, choiceIndex: number): AppliedChoice {
  const visible = visibleChoices(state, event)
  // choiceIndex 是「原始 choices 数组」索引（UI 按完整数组渲染按钮并回传原始下标）。
  // 必须校验该选项当前可见：索引越界或指向被隐藏选项时，兜底结算第一个可见选项，
  // 绝不结算玩家看不到的选项（第 11 轮修复：此前误用可见列表索引定位，隐藏选项存在时会结算错位）。
  const raw = event.choices[choiceIndex]
  const choice = raw !== undefined && visible.includes(raw) ? raw : visible[0] ?? event.choices[0]

  const effects: Array<{ attr?: keyof GameState['attrs']; delta?: number; money?: number }> = []
  let attrs = { ...state.attrs }
  let money = state.money
  let tags = [...state.tags]
  let relations = [...state.relations]
  let education = state.education
  let skills = { ...(state.skills ?? { academics: 0, vocational: 0 }) }
  let career = state.career
  let mortgage = state.mortgage
  let insurance = state.insurance
  let home = state.home
  let fund = state.fund
  let city = state.city
  const pending: PendingEffect[] = [...state.pending]

  for (const e of choice.effects) {
    if (e.relation) {
      // milestoneTarget（第 26 轮）：亲密度效果作用于条件解析出的那个孩子，
      // 多孩家庭里里程碑办在谁身上就落在谁身上；无达标孩子时安全 no-op
      if (
        e.relation.milestoneTarget &&
        event.requires?.childStage &&
        typeof e.relation.deltaCloseness === 'number'
      ) {
        const target = pickChildByStage(relations, state.age, event.requires.childStage)
        if (target) relations = deltaClosenessById(relations, target.id, e.relation.deltaCloseness)
      } else {
        relations = applyRelationEffects(relations, e.relation, state.age, state.age, state.seed)
      }
    } else if (e.addSkill) {
      skills = {
        ...skills,
        [e.addSkill.id]: clampSkill(skills[e.addSkill.id] + e.addSkill.delta),
      }
    } else if (e.attr && typeof e.delta === 'number') {
      effects.push({ attr: e.attr, delta: e.delta })
    } else if (typeof e.money === 'number') {
      effects.push({ money: e.money })
    }
  }
  if (effects.length > 0) {
    const applied = applyEffects(attrs, money, effects)
    attrs = applied.attrs
    money = applied.money
  }
  if (choice.addTags) tags.push(...choice.addTags)
  if (choice.removeTags) tags = tags.filter((t) => !choice.removeTags!.includes(t))

  // 学历（精确设置）与学籍（入学/退学）
  for (const e of choice.effects) {
    if (e.setEducation) education = e.setEducation
    if (e.startEducation) {
      const entered = enterEducation({ ...state, career, education }, e.startEducation.stage, e.startEducation.years)
      if (entered.ok) {
        career = entered.state.career
        // 只追加入学新标记；不能整体回填 entered.state.tags（会把 removeTags 刚移除的旧标记带回来）
        if (!tags.includes('in_school')) tags.push('in_school')
      }
    }
    if (e.quitEducation && career.kind === 'student') {
      career = { kind: 'none' }
      if (!tags.includes('quit_school')) tags.push('quit_school')
    }
  }

  // 职业效果（第 9 轮）：求职/转行、被裁、辞职、事件晋升、调薪。
  // 所有效果自带在职/门槛守卫，条件不满足时安全 no-op。
  const applyCareerTags = (patch: ReturnType<typeof employPatch>) => {
    if (!patch.ok) return
    // 去重合并：二次被裁等场景下 ex_ 标记不能重复入列
    tags = [...new Set(tags.filter((t) => !patch.removeTags.includes(t)).concat(patch.addTags))]
    career = patch.career
  }
  for (const e of choice.effects) {
    if (e.startJob) {
      applyCareerTags(employPatch({ ...state, career, education, skills }, e.startJob.jobId))
    } else if (e.loseJob || e.quitJob) {
      if (career.kind === 'employed') {
        applyCareerTags(endEmploymentPatch({ ...state, career }, e.loseJob ? 'laid_off' : 'resigned'))
      }
    } else if (e.promote) {
      applyCareerTags(promotePatch({ ...state, career }))
    } else if (e.retire) {
      applyCareerTags(retirePatch({ ...state, career }, e.retire.mul ?? RETIRE_PENSION_MUL))
    } else if (typeof e.salaryMul === 'number' && career.kind === 'employed') {
      // 第 22 轮公式化调薪：倍率写入存量字段，年薪按公式重推
      career = applySalaryMul({ ...state, career, education, skills }, e.salaryMul)
    }
  }

  // 房贷效果（第 23 轮）：贷款购房建立真实余额；提前还款按余额封顶划扣，清零即销账。
  // 参数非法或名下无贷时安全 no-op（绝不凭空扣钱、绝不凭空建贷）。
  for (const e of choice.effects) {
    if (e.takeMortgage) {
      const opened = openMortgage(e.takeMortgage.principal, e.takeMortgage.years)
      if (opened) mortgage = opened
    } else if (typeof e.payMortgage === 'number' && mortgage) {
      const pay = Math.min(e.payMortgage, mortgage.balance)
      if (pay > 0) {
        money = sanitizeMoney(money - pay)
        if (pay >= mortgage.balance) {
          mortgage = undefined
          // 第 31 轮：提前还清与年度自然还清同标记（成就链「房贷结清」资格）
          if (!tags.includes('mortgage_cleared')) tags.push('mortgage_cleared')
      } else {
        mortgage = { ...mortgage, balance: mortgage.balance - pay }
      }
    }
  }

  // 保险效果（第 85 轮）：投保建立保单（已有保单时安全 no-op——投保事件以
  // insuranceMissing 条件防重，此处兜底绝不重复建单、绝不凭空给钱）；
  // 理赔=重疾确诊给付，保单在册时一次性划入 benefit 并终结保单。
  for (const e of choice.effects) {
    if (e.ensureInsurance) {
      if (!insurance) {
        insurance = { ...e.ensureInsurance, purchasedAtAge: state.age }
      }
    } else if (e.claimInsurance && insurance) {
      money = sanitizeMoney(money + insurance.benefit)
      insurance = undefined
    }
  }

  // 房产效果（第 86 轮）：buyHome 盖章建册（basis=value=总价；无房时生效，已有房
  // 安全 no-op——购房事件一次性语义防重）；sellHome 挂牌变现：净额=现值−房贷余额
  // （可为负），卖房即清贷、房册注销；无房时安全 no-op。
  for (const e of choice.effects) {
    if (e.buyHome) {
      if (!home) home = { basis: e.buyHome.total, value: e.buyHome.total, purchasedAtAge: state.age }
    } else if (e.sellHome && home) {
      money = sanitizeMoney(money + sellNetProceeds(home, mortgage))
      home = undefined
      mortgage = undefined
    }
  }

  // 基金效果（第 87 轮）：开户建立定投持仓（units 从 0 起；已有户安全 no-op——
  // 事件 once 语义防重，此处兜底）；赎回全额市值入袋并销户；未开户赎回安全
  // no-op（绝不凭空给钱）。
  for (const e of choice.effects) {
    if (e.ensureFund) {
      if (!fund) fund = { annualContribution: e.ensureFund.annualContribution, units: 0 }
    } else if (e.redeemFund && fund) {
      money = sanitizeMoney(money + fund.units)
      fund = undefined
    }
  }

  // 迁居效果（第 90 轮）：变更所在城市层级；同层级 setCity 安全 no-op。
  for (const e of choice.effects) {
    if (e.setCity && cityOf(city) !== e.setCity) {
      city = e.setCity
    }
  }

  // 离婚效果（第 91 轮，R67 最小语义恢复）：在册配偶移出（child 全保留）、
  // 现金 50% 分割（负资产同担=减半）、清 married/marriage_crisis、授予 divorced。
  // 无在册配偶时安全 no-op（事件条件已挡，此处兜底）。
  for (const e of choice.effects) {
    if (e.divorce) {
      const spouseIdx = relations.findIndex((r) => r.kind === 'spouse' && r.alive)
      if (spouseIdx >= 0) {
        relations = relations.filter((_, i) => i !== spouseIdx)
        money = sanitizeMoney(money - Math.floor(money / 2)) // 分割一半（负资产同担）
        tags = tags.filter((t) => t !== 'married' && t !== 'marriage_crisis')
        if (!tags.includes('divorced')) tags.push('divorced')
      }
    }
  }

  // 考公笔试面试（第 88 轮）：录取判定=独立支流散列+academics 双条件
  // （civilservice.ts civilExamAdmitted）。录取→按学历分流入职（bachelor+ 公务员/
  // college 事业编，学历功底门槛由 employPatch 校验）+授予 civil_servant 标记；
  // 落榜→移除备考标记（可再战，事件 cooldown 2）。未备考（无标记）时安全 no-op。
  for (const e of choice.effects) {
    if (e.civilExam) {
      if (tags.includes('civil_exam_prep')) {
        const admitted = civilExamAdmitted(state.seed, state.age, skills.academics ?? 0)
        if (admitted) {
          const target = civilTargetJob(education)
          applyCareerTags(employPatch({ ...state, career, education, skills }, target))
          if (career.kind === 'employed' && (career.jobId === 'civil_servant' || career.jobId === 'public_institution') && !tags.includes('civil_servant')) {
            tags.push('civil_servant')
          }
        } else {
          tags = tags.filter((t) => t !== 'civil_exam_prep')
        }
      }
    }
  }

  // 事件直接致死（第 112 轮）：lethal 选项结算后健康归零 + 授予 lethal_struck
  // 标记。必须带标记：仅归零健康会被下一次年结的自然健康漂移（<30 岁 +1/年）
  // 从 0 复苏（yk_sudden 延迟 −100 在 18–29 岁落地同样被救活——death_young 千局
  // 0 现身的结构性根因）；checkLifeEnd 见标记即按年龄判死。数据侧准入由校验器
  // 把守（once + 支流散列门控 + 全池 ≤2 枚），此处不再重复运行时守卫。
  for (const e of choice.effects) {
    if (e.lethal) {
      attrs = { ...attrs, health: 0 }
      if (!tags.includes('lethal_struck')) tags.push('lethal_struck')
    }
  }
  }

  // 子女里程碑（第 26 轮）：给条件 childStage 解析出的同一个孩子记标记——
  // "每个生命周期事件对每个孩子至多一次"。目标解析与条件判定走同一个
  // pickChildByStage（确定性：第一条达标孩子）；条件缺失或无达标孩子时安全跳过。
  for (const e of choice.effects) {
    if (e.childMilestone !== undefined && event.requires?.childStage) {
      const target = pickChildByStage(relations, state.age, event.requires.childStage)
      if (target) relations = markChildMilestone(relations, target.id, e.childMilestone)
    }
  }

  // 延迟效果入队：作者声明 years（几年后），引擎换算为绝对 dueAge
  for (const d of choice.delayed ?? []) {
    const years = Number.isFinite(d.years) ? Math.max(1, Math.round(d.years)) : 1
    pending.push({
      ...d,
      id: `${event.id}_${state.age}_${pending.length}`,
      dueAge: state.age + years,
    })
  }

  const summary = (choice.summary ?? `选择了「${choice.text}」`).replace(/\{name\}/g, state.name)

  const nextState: GameState = {
    ...state,
    attrs,
    money,
    education,
    skills,
    career,
    mortgage,
    insurance,
    home,
    fund,
    city,
    tags: [...new Set(tags)],
    relations,
    pending,
    seenEvents: state.seenEvents.includes(event.id) ? state.seenEvents : [...state.seenEvents, event.id],
    cooldowns: { ...state.cooldowns, [event.id]: state.age + (event.cooldown ?? 0) },
    history: [
      ...state.history,
      {
        age: state.age,
        eventId: event.id,
        title: event.title,
        choice: choice.text,
        summary,
      } satisfies HistoryEntry,
    ],
  }
  return { state: nextState, summary }
}

// ── 门槛的玩家语言说明（第 19 轮）────────────────────────────
// 被门槛挡住的选项不再静默消失，而是在事件卡上以禁用态呈现一行中文原因，
// 让玩家明白"这条路为什么暂时走不通、怎样才能走通"。
// 本模块只读状态、产出文案，不改任何规则——可见性判定仍以 checkCondition /
// visibleChoices 为唯一权威（有测试锁定两者一致）。

const GATE_ATTR_LABELS: Record<string, string> = {
  health: '健康',
  happiness: '幸福',
  smarts: '能力',
  social: '人际',
  stress: '压力',
}

const GATE_SKILL_LABELS: Record<string, string> = {
  academics: '学业',
  vocational: '技能',
}

const GATE_EDU_LABELS: Record<string, string> = {
  junior: '初中',
  highschool: '高中',
  college: '大专',
  bachelor: '本科',
  master: '硕士',
  phd: '博士',
}

const GATE_CAREER_LABELS: Record<string, string> = {
  employed: '在职',
  unemployed: '待业',
  student: '在校就读',
  retired: '已退休',
  none: '无固定职业',
}

const GATE_RELATION_LABELS: Record<string, string> = {
  parent: '家人',
  friend: '朋友',
  partner: '恋人',
  spouse: '配偶',
  child: '孩子',
  pet: '宠物',
  grandchild: '孙辈',
  colleague: '同事',
  neighbor: '邻居',
}

/** 选项门槛涉及的标记 → 玩家语言（禁止把 tag ID 暴露给前端） */
const GATE_TAG_LABELS: Record<string, string> = {
  risk_taker: '敢闯敢赌的性格',
  grinder: '常年拼出来的资历',
  admitted_bachelor: '本科录取资格',
  admitted_college: '大专录取资格',
  ex_nurse: '护理行业的从业经历',
  ex_teacher: '教师行业的从业经历',
}

function gateTagLabel(t: string): string {
  return GATE_TAG_LABELS[t] ?? '相应的经历或性格'
}

function gateMoney(n: number): string {
  if (n >= 10000) {
    const wan = n / 10000
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`
  }
  return `${n.toLocaleString('en-US')} 元`
}

/**
 * 返回条件不满足时的第一条玩家语言原因；满足或无条件时返回 null。
 * 与 checkCondition 逐条镜像（同一检查顺序），有测试锁定两者在全池上判定一致。
 */
export function conditionFailReason(state: GameState, cond?: EventCondition): string | null {
  if (!cond) return null
  const { attrs, money, age, education, career, tags, relations, skills } = state

  if (cond.minAge !== undefined && age < cond.minAge) return `要到 ${cond.minAge} 岁才会有这样的机会`
  if (cond.maxAge !== undefined && age > cond.maxAge) return `超过 ${cond.maxAge} 岁后这条就不合适了`

  for (const [k, min] of Object.entries(cond.minAttr ?? {})) {
    if (attrs[k as keyof typeof attrs] < (min as number))
      return `需要${GATE_ATTR_LABELS[k] ?? k} ≥ ${min}（当前 ${attrs[k as keyof typeof attrs]}）`
  }
  for (const [k, max] of Object.entries(cond.maxAttr ?? {})) {
    if (attrs[k as keyof typeof attrs] > (max as number))
      return `这条适合${GATE_ATTR_LABELS[k] ?? k} ≤ ${max} 的时候（当前 ${attrs[k as keyof typeof attrs]}）`
  }

  if (cond.education && !cond.education.includes(education))
    return `需要学历：${cond.education.map((e) => GATE_EDU_LABELS[e] ?? e).join('/')}`
  if (cond.careerKinds && !cond.careerKinds.includes(career.kind))
    return `需要${cond.careerKinds.map((k) => GATE_CAREER_LABELS[k] ?? k).join('/')}`
  if (cond.studentStages && (career.kind !== 'student' || !cond.studentStages.includes(career.stage)))
    return '需要还在学校读书'
  if (cond.jobLevels && (career.kind !== 'employed' || !cond.jobLevels.includes(career.level)))
    return `需要职级为 ${cond.jobLevels.join(' 或 ')}`
  if (cond.promotionAvailable) {
    if (career.kind !== 'employed') return '需要有工作才谈得上晋升'
    const job = getJob(career.jobId)
    if (!job || career.level >= (job.maxLevel ?? 4)) return '这个岗位的职级已经到头，晋升不再是当下的选项'
  }

  for (const [k, min] of Object.entries(cond.minSkills ?? {})) {
    if ((skills?.[k as keyof typeof skills] ?? 0) < (min as number))
      return `需要${GATE_SKILL_LABELS[k] ?? k} ≥ ${min}（当前 ${skills?.[k as keyof typeof skills] ?? 0}）`
  }
  for (const [k, max] of Object.entries(cond.maxSkills ?? {})) {
    if ((skills?.[k as keyof typeof skills] ?? 0) > (max as number))
      return `这条适合${GATE_SKILL_LABELS[k] ?? k} ≤ ${max} 的起点（当前 ${skills?.[k as keyof typeof skills] ?? 0}）`
  }

  if (cond.tagsAll && !cond.tagsAll.every((t) => tags.includes(t)))
    return `需要${cond.tagsAll.map(gateTagLabel).join('与')}`
  if (cond.tagsAny && !cond.tagsAny.some((t) => tags.includes(t)))
    return `需要${cond.tagsAny.map(gateTagLabel).join('或')}`
  if (cond.tagsNone && cond.tagsNone.some((t) => tags.includes(t))) return '与你现在的情况不符'

  if (cond.moneyAtLeast !== undefined && money < cond.moneyAtLeast)
    return `需要至少${gateMoney(cond.moneyAtLeast)}存款（现在 ${gateMoney(Math.max(money, 0))}${money < 0 ? '，还在负债' : ''}）`
  if (cond.moneyBelow !== undefined && money >= cond.moneyBelow) return '这条救急路留给手头更紧的时候'

  // 与 checkCondition 逐条镜像（同一检查顺序）
  if (cond.mortgageBalanceAtLeast !== undefined && mortgageBalance(state.mortgage) < cond.mortgageBalanceAtLeast)
    return state.mortgage ? '房贷已经还得差不多，这条帮不上忙' : '名下没有正在偿还的房贷'
  if (cond.healthRiskAtLeast !== undefined && (state.healthRisk ?? 0) < cond.healthRiskAtLeast)
    return '生活方式攒下的健康风险还没到这份上，还轮不到它'
  if (cond.healthRiskBelow !== undefined && (state.healthRisk ?? 0) >= cond.healthRiskBelow)
    return '身体的情况已经越过了这一档，该看更重的了'
  if (cond.insuranceMissing && state.insurance)
    return '已经有一份保单在身了，不必重复投保'
  if (cond.homeOwned && !state.home)
    return '名下还没有房产，谈不上持有与变卖'
  if (cond.fundOwned && !state.fund)
    return '还没有开基金账户，谈不上止盈割肉'
  if (cond.fundMarket === 'bull' && (!state.fund || marketAt(state.seed, state.age) !== 'bull'))
    return '行情不在牛头上，落袋为安轮不到现在'
  if (cond.fundMarket === 'bear' && (!state.fund || marketAt(state.seed, state.age) !== 'bear'))
    return '行情还没跌到位，割肉离场不着急'
  if (cond.minAcademics !== undefined && (state.skills?.academics ?? 0) < cond.minAcademics)
    return '功底还差一截，先把自己练出来'
  if (cond.minVocational !== undefined && (state.skills?.vocational ?? 0) < cond.minVocational)
    return '手上的活还没到那个火候'
  if (cond.cityIn && !cond.cityIn.includes(cityOf(state.city)))
    return '人不在那座城市，这条路暂时与你无关'
  if (cond.fameChance === 'viral' && !viralAt(state.seed, state.age))
    return '内容还没到爆的那一下，再坚持坚持'
  if (cond.fameChance === 'hate' && !hateAt(state.seed, state.age))
    return '眼下没有风浪，不至于此'
  if (cond.suddenRisk === true && !suddenRiskAt(state.seed, state.age))
    return '还没到命运的岔路口'
  if (cond.accidentRisk === true && !accidentRiskAt(state.seed, state.age))
    return '眼下不是那个关口'
  if (cond.illnessRisk === true && !illnessRiskAt(state.seed, state.age))
    return '身体还没亮那盏红灯'
  if (cond.ventureProfit === true && !ventureProfitAt(state.seed, state.age))
    return '生意还没开张到回款那一步'
  if (cond.ventureClose === true && !ventureCloseAt(state.seed, state.age))
    return '账还转得动，还没到要做决定的那天'
  if (cond.divorced && !state.tags.includes('divorced'))
    return '你没有离过婚，谈不上单身的第二春'

  if (cond.relationKinds && !cond.relationKinds.some((k) => relations.some((r) => r.kind === k && r.alive)))
    return `需要${cond.relationKinds.map((k) => GATE_RELATION_LABELS[k] ?? k).join('或')}还在身边`
  if (cond.relationKindsNone && cond.relationKindsNone.some((k) => relations.some((r) => r.kind === k && r.alive)))
    return `这条路线只属于没有${cond.relationKindsNone.map((k) => GATE_RELATION_LABELS[k] ?? k).join('/')}的人`
  for (const [k, min] of Object.entries(cond.minCloseness ?? {})) {
    const rel = relations.find((r) => r.kind === (k as RelationKind) && r.alive)
    if (!rel || rel.closeness < (min as number))
      return `需要和${GATE_RELATION_LABELS[k] ?? k}够亲近（亲密 ≥ ${min}）`
  }
  for (const [k, max] of Object.entries(cond.maxCloseness ?? {})) {
    const rel = relations.find((r) => r.kind === (k as RelationKind) && r.alive)
    if (!rel || rel.closeness > (max as number))
      return `这段关系还没有走到那一步（亲密 ≤ ${max} 时才会出现）`
  }

  // 与 checkCondition 逐条镜像（同一检查顺序）：区分"孩子还没到年纪"与"这事已办过"
  if (cond.childStage && !pickChildByStage(relations, age, cond.childStage)) {
    const cs = cond.childStage
    const ageMatchOnly =
      cs.milestonePending !== undefined &&
      pickChildByStage(relations, age, { ...cs, milestonePending: undefined }) !== null
    return ageMatchOnly ? '这件事已经给孩子办过了' : '家里没有正处在这个年纪的孩子'
  }

  // 与 checkCondition 逐条镜像（同一检查顺序）：身后事类资格
  if (cond.parentDiedWithin !== undefined) {
    const diedRecently = relations.some((r) => {
      if (r.kind !== 'parent' || !r.deceased || typeof r.deathAge !== 'number') return false
      const yearsAgo = age - (r.deathAge - PARENT_AGE_OFFSET)
      return yearsAgo >= 0 && yearsAgo <= cond.parentDiedWithin!
    })
    if (!diedRecently) return '这条属于刚刚送别过父母的日子'
  }
  if (cond.parentsAllDeceased) {
    const hasDeceased = relations.some((r) => r.kind === 'parent' && r.deceased)
    const hasAlive = relations.some((r) => r.kind === 'parent' && r.alive)
    if (!hasDeceased || hasAlive) return '这条属于双亲都已谢世的人'
  }
  if (cond.siblingDiedWithin !== undefined) {
    const diedRecently = relations.some((r) => {
      if (r.kind !== 'sibling' || !r.deceased || typeof r.deathAge !== 'number') return false
      const offset = typeof r.birthAge === 'number' ? r.birthAge : 0
      const yearsAgo = age - (r.deathAge + offset)
      return yearsAgo >= 0 && yearsAgo <= cond.siblingDiedWithin!
    })
    if (!diedRecently) return '这条属于刚刚送别过手足的日子'
  }

  return null
}

/**
 * 某选项当前为何不可选（玩家语言，一行）；可选时返回 null。
 * 覆盖两类不可选：条件不满足（requires）与负债大额消费门槛。
 */
export function choiceGateReason(state: GameState, choice: EventChoice): string | null {
  if (checkCondition(state, choice.requires) && !(state.money < 0 && isBigSpend(choice))) return null
  if (state.money < 0 && isBigSpend(choice)) return '眼下还在负债，先别背上大额开销'
  return conditionFailReason(state, choice.requires) ?? '暂不符合可选条件'
}
