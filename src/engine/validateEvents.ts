// 事件数据校验器：在加载事件池时检测坏数据，避免坏事件流入游戏
// 检查：重复 ID、无效字段、无选项、互相矛盾的条件、明显不可达事件
import type { EventChoice, EventCondition, GameEvent, RelationKind, SkillKey } from './types'
import { ATTR_KEYS } from './attrs'
import { SKILL_KEYS, STAGE_INFO, STAGE_PREREQUISITE, EDU_RANK } from './education'
import { JOB_CATALOG } from '../data/careers'
import { RELATION_KINDS } from './relations'
import { HEALTH_SINGLE_HIT_LIMIT } from './health'

export interface EventValidationIssue {
  eventId: string
  field: string
  problem: string
}

export const GAME_MIN_AGE = 18
export const GAME_MAX_AGE = 120

/** 校验条件自身及其与事件年龄窗口的关系，把问题写入 issues */
function checkCondition(
  issues: EventValidationIssue[],
  eventId: string,
  where: string,
  cond: EventCondition | undefined,
  event: GameEvent,
): void {
  if (!cond) return
  const label = `${where}.requires`

  if (cond.minAge !== undefined && cond.maxAge !== undefined && cond.minAge > cond.maxAge)
    issues.push({ eventId, field: `${label}.minAge`, problem: `minAge ${cond.minAge} > maxAge ${cond.maxAge}，条件自相矛盾` })
  if (cond.minAge !== undefined && cond.minAge > event.maxAge)
    issues.push({ eventId, field: `${label}.minAge`, problem: `条件 minAge ${cond.minAge} 超出事件年龄上限 ${event.maxAge}，永不可满足` })
  if (cond.maxAge !== undefined && cond.maxAge < event.minAge)
    issues.push({ eventId, field: `${label}.maxAge`, problem: `条件 maxAge ${cond.maxAge} 低于事件年龄下限 ${event.minAge}，永不可满足` })

  for (const k of ATTR_KEYS) {
    const min = cond.minAttr?.[k]
    const max = cond.maxAttr?.[k]
    if (min !== undefined && max !== undefined && min > max)
      issues.push({ eventId, field: `${label}.minAttr.${k}`, problem: `minAttr ${min} > maxAttr ${max}，条件自相矛盾` })
    if (min !== undefined && (!Number.isFinite(min) || min < 0 || min > 100))
      issues.push({ eventId, field: `${label}.minAttr.${k}`, problem: `阈值 ${min} 超出 0～100` })
    if (max !== undefined && (!Number.isFinite(max) || max < 0 || max > 100))
      issues.push({ eventId, field: `${label}.maxAttr.${k}`, problem: `阈值 ${max} 超出 0～100` })
  }

  for (const k of SKILL_KEYS as SkillKey[]) {
    const min = cond.minSkills?.[k]
    const max = cond.maxSkills?.[k]
    if (min !== undefined && max !== undefined && min > max)
      issues.push({ eventId, field: `${label}.minSkills.${k}`, problem: `minSkills ${min} > maxSkills ${max}，条件自相矛盾` })
    if (min !== undefined && (!Number.isFinite(min) || min < 0 || min > 100))
      issues.push({ eventId, field: `${label}.minSkills.${k}`, problem: `阈值 ${min} 超出 0～100` })
    if (max !== undefined && (!Number.isFinite(max) || max < 0 || max > 100))
      issues.push({ eventId, field: `${label}.maxSkills.${k}`, problem: `阈值 ${max} 超出 0～100` })
  }

  if (cond.moneyAtLeast !== undefined && cond.moneyBelow !== undefined && cond.moneyAtLeast >= cond.moneyBelow)
    issues.push({ eventId, field: `${label}.moneyAtLeast`, problem: `moneyAtLeast ${cond.moneyAtLeast} ≥ moneyBelow ${cond.moneyBelow}，区间为空` })

  // 关系条件（第 11 轮）：未知关系种类、亲密度阈值越界、同种关系 min>max 自相矛盾
  for (const [k, min] of Object.entries(cond.minCloseness ?? {})) {
    if (!RELATION_KINDS.includes(k as RelationKind))
      issues.push({ eventId, field: `${label}.minCloseness.${k}`, problem: `未知关系种类 ${k}` })
    if (!Number.isFinite(min) || (min as number) < 0 || (min as number) > 100)
      issues.push({ eventId, field: `${label}.minCloseness.${k}`, problem: `阈值 ${String(min)} 超出 0～100` })
    const max = cond.maxCloseness?.[k as RelationKind]
    if (min !== undefined && max !== undefined && (min as number) > max)
      issues.push({ eventId, field: `${label}.minCloseness.${k}`, problem: `minCloseness ${String(min)} > maxCloseness ${String(max)}，条件自相矛盾` })
  }
  for (const [k, max] of Object.entries(cond.maxCloseness ?? {})) {
    if (!RELATION_KINDS.includes(k as RelationKind))
      issues.push({ eventId, field: `${label}.maxCloseness.${k}`, problem: `未知关系种类 ${k}` })
    if (!Number.isFinite(max) || (max as number) < 0 || (max as number) > 100)
      issues.push({ eventId, field: `${label}.maxCloseness.${k}`, problem: `阈值 ${String(max)} 超出 0～100` })
  }
  for (const k of [...(cond.relationKinds ?? []), ...(cond.relationKindsNone ?? [])]) {
    if (!RELATION_KINDS.includes(k))
      issues.push({ eventId, field: `${label}.relationKinds`, problem: `未知关系种类 ${String(k)}` })
  }
  if (cond.relationKinds !== undefined && cond.relationKindsNone !== undefined) {
    const overlap = cond.relationKinds.filter((k) => cond.relationKindsNone!.includes(k))
    if (overlap.length > 0)
      issues.push({ eventId, field: `${label}.relationKinds`, problem: `relationKinds 与 relationKindsNone 同时要求并禁止 ${overlap.join('/')}，条件必然为假` })
  }

  // 职级从 1 开始：0、负数或非整数都是坏数据
  if (cond.jobLevels !== undefined) {
    for (const lv of cond.jobLevels) {
      if (!Number.isInteger(lv) || lv < 1)
        issues.push({ eventId, field: `${label}.jobLevels`, problem: `职级 ${String(lv)} 非法（须为 ≥1 的整数）` })
    }
    if (cond.careerKinds !== undefined && !cond.careerKinds.includes('employed'))
      issues.push({ eventId, field: `${label}.jobLevels`, problem: 'jobLevels 只在在职时满足，但 careerKinds 不含 employed，条件必然为假' })
  }

  // 第 26 轮子女阶段条件：年龄窗非空、里程碑字段为非空字符串
  if (cond.childStage !== undefined) {
    const cs = cond.childStage
    const csLabel = `${label}.childStage`
    if (!Number.isFinite(cs.atLeast) || cs.atLeast < 0)
      issues.push({ eventId, field: `${csLabel}.atLeast`, problem: `孩子年龄下限 ${String(cs.atLeast)} 非法（须为 ≥0 的数值）` })
    if (cs.below !== undefined && (!Number.isFinite(cs.below) || cs.below <= cs.atLeast))
      issues.push({ eventId, field: `${csLabel}.below`, problem: `孩子年龄上限 ${String(cs.below)} 未超出下限 ${String(cs.atLeast)}，年龄窗为空` })
    for (const key of ['milestonePending', 'milestoneDone'] as const) {
      const v = cs[key]
      if (v !== undefined && (typeof v !== 'string' || v.length === 0))
        issues.push({ eventId, field: `${csLabel}.${key}`, problem: `${key} 须为非空字符串` })
    }
  }
}

/** 校验单个选项的效果、延迟效果与条件 */
function checkChoice(
  issues: EventValidationIssue[],
  event: GameEvent,
  choice: EventChoice,
  index: number,
): void {
  const label = `choices[${index}]`
  if (typeof choice.text !== 'string' || choice.text.trim().length === 0)
    issues.push({ eventId: event.id, field: `${label}.text`, problem: '选项文本为空' })

  if (!Array.isArray(choice.effects))
    issues.push({ eventId: event.id, field: `${label}.effects`, problem: 'effects 不是数组' })
  else
    choice.effects.forEach((e, i) => {
      if (e.attr !== undefined && !ATTR_KEYS.includes(e.attr))
        issues.push({ eventId: event.id, field: `${label}.effects[${i}].attr`, problem: `未知属性 ${String(e.attr)}` })
      if (e.attr !== undefined && !Number.isFinite(e.delta))
        issues.push({ eventId: event.id, field: `${label}.effects[${i}].delta`, problem: `delta ${String(e.delta)} 不是有限数值` })
      // 第 12 轮：单步即时健康伤害不得超过上限，杜绝普通选择引发毫无预兆的突然死亡
      if (e.attr === 'health' && typeof e.delta === 'number' && e.delta <= -HEALTH_SINGLE_HIT_LIMIT - 1)
        issues.push({ eventId: event.id, field: `${label}.effects[${i}].delta`, problem: `单步即时健康伤害 ${e.delta} 超过 -${HEALTH_SINGLE_HIT_LIMIT}，可能造成毫无预兆的突然死亡（大伤害应拆成延迟效果并给预警）` })
      if (e.money !== undefined && !Number.isFinite(e.money))
        issues.push({ eventId: event.id, field: `${label}.effects[${i}].money`, problem: `money ${String(e.money)} 不是有限数值` })
      if (e.addSkill !== undefined) {
        if (!SKILL_KEYS.includes(e.addSkill.id))
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].addSkill.id`, problem: `未知技能 ${String(e.addSkill.id)}` })
        if (!Number.isFinite(e.addSkill.delta))
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].addSkill.delta`, problem: `技能增量 ${String(e.addSkill.delta)} 不是有限数值` })
      }
      if (e.startEducation !== undefined) {
        const stage = e.startEducation.stage
        if (!(stage in STAGE_INFO)) {
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].startEducation.stage`, problem: `未知学段 ${String(stage)}` })
        } else {
          const need = STAGE_PREREQUISITE[stage]
          const declared = event.requires?.education
          if (declared && declared.length > 0 && declared.every((d) => EDU_RANK[d] < EDU_RANK[need]))
            issues.push({ eventId: event.id, field: `${label}.effects[${i}].startEducation`, problem: `学段 ${stage} 需要${need}及以上学历，但事件条件只允许 ${declared.join('/')}，入学必然失败` })
        }
      }
      // 第 9 轮职业效果：岗位引用必须存在；与事件条件矛盾时效果必然无效
      if (e.startJob !== undefined) {
        const jobId = e.startJob.jobId
        if (typeof jobId !== 'string' || !JOB_CATALOG.some((j) => j.id === jobId))
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].startJob.jobId`, problem: `岗位 ${String(jobId)} 不在职业表中，入职必然失败` })
        const kinds = event.requires?.careerKinds
        if (kinds !== undefined && !kinds.some((k) => k !== 'student'))
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].startJob`, problem: '在读不能签劳动合同，但事件条件只允许学生/退休身份，入职必然失败' })
      }
      if (e.loseJob || e.quitJob || e.promote || e.salaryMul !== undefined || e.retire !== undefined) {
        const kinds = event.requires?.careerKinds
        if (kinds !== undefined && !kinds.includes('employed'))
          issues.push({ eventId: event.id, field: `${label}.effects[${i}]`, problem: `离职/晋升/调薪/退休效果只在在职时生效，但事件条件只允许 ${kinds.join('/')}，效果必然无效` })
      }
      // 第 11 轮关系效果：坏数据与"条件不保证关系存在"的必然无效效果
      if (e.relation !== undefined) {
        const rel = e.relation
        const relLabel = `${label}.effects[${i}].relation`
        if (!RELATION_KINDS.includes(rel.kind))
          issues.push({ eventId: event.id, field: `${relLabel}.kind`, problem: `未知关系种类 ${String(rel.kind)}` })
        if (rel.deltaCloseness !== undefined && !Number.isFinite(rel.deltaCloseness))
          issues.push({ eventId: event.id, field: `${relLabel}.deltaCloseness`, problem: `亲密度增量 ${String(rel.deltaCloseness)} 不是有限数值` })
        if (rel.closeness !== undefined && (!Number.isFinite(rel.closeness) || rel.closeness < 0 || rel.closeness > 100))
          issues.push({ eventId: event.id, field: `${relLabel}.closeness`, problem: `初始亲密度 ${String(rel.closeness)} 超出 0～100` })
        if (rel.convertFrom !== undefined && rel.convertFrom === rel.kind)
          issues.push({ eventId: event.id, field: `${relLabel}.convertFrom`, problem: `convertFrom 与目标种类相同（${String(rel.kind)}），转变无意义` })
        // 事件/选项条件是否保证存在某种存活关系（relationKinds 或 minCloseness 提及）
        const guarantees = (kind: RelationKind): boolean =>
          [event.requires, choice.requires].some(
            (c) => c?.relationKinds?.includes(kind) || (c?.minCloseness !== undefined && kind in c.minCloseness),
          )
        // addAnother（第 28 轮二胎语义）无视已有同类关系追加，不受"条件保证存在"限制
        if (rel.add && !rel.addAnother && guarantees(rel.kind))
          issues.push({ eventId: event.id, field: `${relLabel}.add`, problem: `add 只在不存在存活${rel.kind}关系时生效，但条件已保证其存在，新增必然无效` })
        if (rel.remove || rel.convertFrom !== undefined) {
          // remove 作用于目标种类；convertFrom 作用于来源种类（如结婚需保证有存活恋人）
          const need = rel.remove ? rel.kind : rel.convertFrom!
          if (!guarantees(need))
            issues.push({ eventId: event.id, field: relLabel, problem: `${rel.remove ? 'remove' : 'convertFrom'} 需要存活的${need}关系，但事件与选项条件都未保证其存在，效果必然无效` })
        }
        // 第 26 轮 milestoneTarget：定向到 childStage 解析出的孩子，前提必须齐备
        // 第 44 轮：childStage.kind='grandchild' 时解析孙辈，milestoneTarget 对 grandchild 同款有效
        if (rel.milestoneTarget) {
          if (rel.kind !== 'child' && rel.kind !== 'grandchild')
            issues.push({ eventId: event.id, field: relLabel, problem: `milestoneTarget 只对 child/grandchild 关系有意义（当前 ${String(rel.kind)}）` })
          if (rel.deltaCloseness === undefined)
            issues.push({ eventId: event.id, field: relLabel, problem: 'milestoneTarget 目前只支持 deltaCloseness，其余语义未定义' })
          const cs = event.requires?.childStage ?? choice.requires?.childStage
          if (!cs)
            issues.push({ eventId: event.id, field: relLabel, problem: 'milestoneTarget 需要事件或选项条件 childStage 来解析目标孩子，否则效果必然无效' })
        }
      }
      // 第 26 轮子女里程碑：须与条件的 milestonePending 一致，否则"每孩至多一次"失守
      if (e.childMilestone !== undefined) {
        const cs = event.requires?.childStage ?? choice.requires?.childStage
        if (!cs)
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].childMilestone`, problem: 'childMilestone 效果需要事件或选项条件 childStage 来解析目标孩子，否则标记必然丢失、事件会反复触发' })
        else if (cs.milestonePending !== e.childMilestone)
          issues.push({ eventId: event.id, field: `${label}.effects[${i}].childMilestone`, problem: `childMilestone ${e.childMilestone} 与条件的 milestonePending ${String(cs.milestonePending)} 不一致，会破坏"每孩至多一次"的资格判定` })
      }
    })

    // 事件晋升选项必须用 promotionAvailable 隐藏满级场景，否则 promote 静默无效、代价照扣
    if (choice.effects.some((e) => e.promote) && choice.requires?.promotionAvailable !== true)
      issues.push({ eventId: event.id, field: `${label}.requires.promotionAvailable`, problem: 'promote 效果只对未满职级的在职者生效，选项须带 requires.promotionAvailable，否则满级岗位会看到必然无效的晋升选项' })

  for (const [j, d] of (choice.delayed ?? []).entries()) {
    if (!Number.isFinite(d.years) || d.years < 1)
      issues.push({ eventId: event.id, field: `${label}.delayed[${j}].years`, problem: `延迟年数 ${String(d.years)} 非法（须 ≥1）` })
    if (d.repeat !== undefined && (!Number.isInteger(d.repeat) || d.repeat < 1))
      issues.push({ eventId: event.id, field: `${label}.delayed[${j}].repeat`, problem: `周期次数 ${String(d.repeat)} 非法（须为 ≥1 的整数）` })
    if (d.relation !== undefined && !RELATION_KINDS.includes(d.relation.kind))
      issues.push({ eventId: event.id, field: `${label}.delayed[${j}].relation.kind`, problem: `未知关系种类 ${String(d.relation.kind)}` })
  }

  checkCondition(issues, event.id, label, choice.requires, event)

  // 第 112 轮：lethal（事件直接致死）准入守卫——校验器是唯一数据闸，运行时不再重复检查。
  // 三条纪律：①事件必须 once（致命窄门不允许复现）；②事件/选项条件必须带支流散列门
  // （suddenRisk/accidentRisk/illnessRisk/fameChance——生死判定不得走事件权重这条常规通道）；
  // ③全池 lethal 事件 ≤2 枚（在 validateEvents 主循环收口）。
  if (choice.effects.some((e) => e.lethal)) {
    if (event.once !== true)
      issues.push({ eventId: event.id, field: `${label}.effects[].lethal`, problem: 'lethal（直接致死）只允许出现在 once 事件上，可复现事件不得携带致死选项' })
    const gated = [event.requires, choice.requires].some(
      (c) => c?.suddenRisk === true || c?.accidentRisk === true || c?.illnessRisk === true || c?.fameChance !== undefined,
    )
    if (!gated)
      issues.push({ eventId: event.id, field: `${label}.effects[].lethal`, problem: 'lethal（直接致死）要求事件带支流散列门控（suddenRisk/accidentRisk/illnessRisk/fameChance），不得靠常规权重抽取触发' })
  }
}

/** 校验整个事件池，返回问题清单（空数组 = 通过） */
export function validateEvents(pool: GameEvent[]): EventValidationIssue[] {
  const issues: EventValidationIssue[] = []
  const seenIds = new Set<string>()
  // 第 112 轮：全池 lethal 事件清单——超过 2 枚即对第 3 枚起逐个登记问题
  const lethalEventIds: string[] = []

  if (!Array.isArray(pool)) {
    return [{ eventId: '<pool>', field: 'root', problem: '事件池不是数组' }]
  }

  for (const e of pool) {
    const id = typeof e?.id === 'string' ? e.id : '<missing-id>'

    if (typeof e?.id !== 'string' || e.id.trim().length === 0) {
      issues.push({ eventId: id, field: 'id', problem: '事件 ID 缺失或为空' })
    } else if (seenIds.has(e.id)) {
      issues.push({ eventId: e.id, field: 'id', problem: '事件 ID 重复' })
    }
    if (typeof e?.id === 'string' && e.id.trim().length > 0) seenIds.add(e.id)

    if (typeof e?.title !== 'string' || e.title.trim().length === 0)
      issues.push({ eventId: id, field: 'title', problem: '标题为空' })
    if (typeof e?.text !== 'string' || e.text.trim().length === 0)
      issues.push({ eventId: id, field: 'text', problem: '正文为空' })

    if (!Number.isInteger(e?.minAge) || !Number.isInteger(e?.maxAge))
      issues.push({ eventId: id, field: 'minAge/maxAge', problem: `年龄区间 (${e?.minAge}, ${e?.maxAge}) 必须是整数` })
    else {
      if (e.minAge > e.maxAge)
        issues.push({ eventId: id, field: 'minAge', problem: `minAge ${e.minAge} > maxAge ${e.maxAge}` })
      if (e.maxAge < GAME_MIN_AGE || e.minAge > GAME_MAX_AGE)
        issues.push({ eventId: id, field: 'minAge/maxAge', problem: `年龄区间 (${e.minAge}, ${e.maxAge}) 完全在游戏年龄之外，事件不可达` })
    }

    if (e?.weight !== undefined && (!Number.isFinite(e.weight) || e.weight <= 0))
      issues.push({ eventId: id, field: 'weight', problem: `权重 ${String(e.weight)} 非法（须 >0）` })
    if (e?.cooldown !== undefined && (!Number.isFinite(e.cooldown) || e.cooldown < 0))
      issues.push({ eventId: id, field: 'cooldown', problem: `冷却 ${String(e.cooldown)} 非法（须 ≥0）` })

    if (!Array.isArray(e?.choices) || e.choices.length < 2) {
      issues.push({ eventId: id, field: 'choices', problem: `选项数量 ${Array.isArray(e?.choices) ? e.choices.length : 0} 少于 2` })
    } else {
      if (e.choices.length > 4)
        issues.push({ eventId: id, field: 'choices', problem: `选项数量 ${e.choices.length} 超过 4` })
      e.choices.forEach((c, i) => checkChoice(issues, e, c, i))
      // 每个选项都有条件且条件互相冲突时，玩家将没有任何可选按钮
      const conditional = e.choices.filter((c) => c.requires !== undefined)
      if (conditional.length === e.choices.length) {
        // 全部选项带条件：至少提醒测试覆盖（不判死，运行时还有保底兜底）
        issues.push({ eventId: id, field: 'choices', problem: '全部选项都带 requires，存在玩家无按钮可点的风险，须人工确认条件可满足' })
      }
    }

    checkCondition(issues, id, 'event', e?.requires, e)

    if (e?.choices?.some((c) => c.effects.some((ef) => ef.lethal))) {
      lethalEventIds.push(e.id)
      if (lethalEventIds.length > 2)
        issues.push({ eventId: e.id, field: 'choices[].lethal', problem: `全池 lethal（直接致死）事件已达上限 2 枚（${lethalEventIds.join('、')}），第 3 枚起拒绝——死亡窄门不得泛滥` })
    }
  }

  return issues
}
