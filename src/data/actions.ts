// 第 83 轮（V5）：主动行动表——每年事件之外的一次主动选择（跳过=缺省语义）。
// 行动是「确定性轻效果」：无随机、金额与物价感知一致（数百=日常开销、两千余=中额）；
// 冷却与「每年至多一项」由 engine/actions.ts 统一结算（cooldowns 借用键 action_done）。
// 资格红线：不假设职业/关系/积蓄——全部用 requires 与 cost 显式门控。
import type { AttrKey, CareerKind, RelationKind } from '../engine/types'

export interface ActionEffect {
  attr?: { key: AttrKey; delta: number }
  /** 正数=收入（如接单）；花费统一走 ActionDef.cost，不在此表达 */
  money?: number
  skill?: { id: 'academics' | 'vocational'; delta: number }
  relation?: { kind: RelationKind; deltaCloseness: number }
}

export interface ActionRequires {
  careerKinds?: CareerKind[]
  /** OR 语义：存在任一存活同类关系即可（与事件 relationKinds 同口径） */
  relationKinds?: RelationKind[]
}

export interface ActionDef {
  id: string
  name: string
  desc: string
  minAge: number
  maxAge: number
  /** 花费（元，正数）；0=免费。余额不足（含变为负）不可选——行动不致负债 */
  cost: number
  /** 冷却年数：1=每年可做一次；另有每年至多一项的全局闸（engine/actions.ts） */
  cooldown: number
  requires?: ActionRequires
  /** 体检类：执行时读取 healthRisk 只做分级注记（不改值——「只记账」原则） */
  checkHealthRisk?: boolean
  effects: ActionEffect[]
}

export const ACTION_DEFS: ActionDef[] = [
  {
    id: 'act_gym',
    name: '办健身卡',
    desc: '家附近的健身房又发传单了，这回真去办了张卡',
    minAge: 18, maxAge: 70, cost: 600, cooldown: 1,
    effects: [
      { attr: { key: 'health', delta: 2 } },
      { attr: { key: 'stress', delta: -2 } },
    ],
  },
  {
    id: 'act_checkup',
    name: '年度体检',
    desc: '预约一次像样的体检，把身体里看不见的部分看一遍',
    minAge: 18, maxAge: 70, cost: 500, cooldown: 1,
    checkHealthRisk: true,
    effects: [{ attr: { key: 'happiness', delta: 1 } }],
  },
  {
    id: 'act_study',
    name: '报个进修班',
    desc: '晚上去上上课，把吃饭的本事再磨一磨',
    minAge: 18, maxAge: 50, cost: 2600, cooldown: 3,
    effects: [{ skill: { id: 'academics', delta: 3 } }],
  },
  {
    id: 'act_recharge',
    name: '独处充电',
    desc: '把手机扣下，一个人安安静静待了一天',
    minAge: 18, maxAge: 77, cost: 0, cooldown: 1,
    effects: [
      { attr: { key: 'happiness', delta: 3 } },
      { attr: { key: 'stress', delta: -1 } },
    ],
  },
  {
    id: 'act_side_job',
    name: '周末接单',
    desc: '凭手艺在周末接了点零活，挣的是辛苦钱',
    minAge: 18, maxAge: 60, cost: 0, cooldown: 1,
    requires: { careerKinds: ['employed'] },
    effects: [
      { money: 800 },
      { attr: { key: 'stress', delta: 2 } },
    ],
  },
  {
    id: 'act_parents',
    name: '陪父母吃饭',
    desc: '回家吃了顿饭，陪他们说了说话',
    minAge: 18, maxAge: 70, cost: 300, cooldown: 1,
    requires: { relationKinds: ['parent'] },
    effects: [{ relation: { kind: 'parent', deltaCloseness: 4 } }],
  },
]
