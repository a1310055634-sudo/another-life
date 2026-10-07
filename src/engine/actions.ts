// 第 83 轮（V5）：主动行动引擎——每年事件之外至多一项、可跳过。
// 跳过=缺省语义：不调 performAction 即零写入，引擎行为与未引入本系统逐位一致
// （outcomes.test 18 局零位移的硬保证）。全部效果确定性落地，不消耗主 rng；
// 「本年已行动」与各行动冷却借用 cooldowns（键 action_done 与行动 id，值=解除
// 年龄，与事件 cooldown 同语义：age < 值 不可用）。
import type { GameState } from './types'
import { clampAttr, sanitizeMoney } from './attrs'
import { clampSkill } from './education'
import { applyRelationEffect } from './relations'
import { ACTION_DEFS, type ActionDef } from '../data/actions'

/** 每年至多一项的全局闸借用键：值=可再次行动的年龄（行动年 +1） */
export const ACTION_DONE_KEY = 'action_done'

export function isActionAvailable(state: GameState, a: ActionDef): boolean {
  if (state.phase !== 'playing') return false
  if (state.age < a.minAge || state.age > a.maxAge) return false
  // 行动不致负债：收费行动余额不足不可选；免费行动负债年仍可用（低落时刻更需要）
  if (a.cost > 0 && state.money - a.cost < 0) return false
  if (a.requires?.careerKinds && !a.requires.careerKinds.includes(state.career.kind)) return false
  if (a.requires?.relationKinds) {
    const has = a.requires.relationKinds.some((k) =>
      state.relations.some((r) => r.kind === k && r.alive),
    )
    if (!has) return false
  }
  const busy = state.cooldowns[ACTION_DONE_KEY]
  if (busy !== undefined && state.age < busy) return false
  const cd = state.cooldowns[a.id]
  if (cd !== undefined && state.age < cd) return false
  return true
}

export function availableActions(state: GameState): ActionDef[] {
  return ACTION_DEFS.filter((a) => isActionAvailable(state, a))
}

export interface ActionResult {
  ok: boolean
  reason?: 'unknown-action' | 'unavailable'
  state: GameState
  /** 履历/年志摘要（ok 时给出；体检含 healthRisk 分级注记） */
  summary?: string
}

export function performAction(state: GameState, actionId: string): ActionResult {
  const def = ACTION_DEFS.find((a) => a.id === actionId)
  if (!def) return { ok: false, reason: 'unknown-action', state }
  if (!isActionAvailable(state, def)) return { ok: false, reason: 'unavailable', state }

  const attrs = { ...state.attrs }
  const skills = { ...state.skills }
  let money = state.money
  let relations = state.relations
  for (const e of def.effects) {
    if (e.attr) attrs[e.attr.key] = clampAttr(e.attr.key, attrs[e.attr.key] + e.attr.delta)
    if (e.skill) skills[e.skill.id] = clampSkill(skills[e.skill.id] + e.skill.delta)
    if (e.money) money += e.money
    if (e.relation) {
      relations = applyRelationEffect(
        relations,
        { kind: e.relation.kind, deltaCloseness: e.relation.deltaCloseness },
        state.age,
        state.age,
        state.seed,
      )
    }
  }
  money = sanitizeMoney(money - def.cost)

  // 体检分级注记：读 lifestyle 累积风险值（阈值与 riskBand 同口径 25/50），只提示不改值
  let summary = def.desc
  if (def.checkHealthRisk) {
    const risk = state.healthRisk ?? 0
    summary = risk >= 50
      ? '体检报告上有几项红字，医生建议复查'
      : risk >= 25
        ? '体检查出些小毛病，医生嘱咐调整作息'
        : '体检各项指标都正常，这一年过得挺扎实'
  }

  const next: GameState = {
    ...state,
    attrs,
    skills,
    money,
    relations,
    cooldowns: {
      ...state.cooldowns,
      [def.id]: state.age + def.cooldown,
      [ACTION_DONE_KEY]: state.age + 1,
    },
    history: [
      ...state.history,
      { age: state.age, eventId: 'action', title: `◆ ${def.name}`, choice: '', summary },
    ],
  }
  return { ok: true, state: next, summary }
}
