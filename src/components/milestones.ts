// 第 97 轮（V5）：重大时刻里程碑检测——六类人生大事的展示层映射。
// 数据源全部为存档展示字段（history 条目 / snapshots 切面），引擎只读零侵入。
// 判定口径（映射表，SPEC §6.63）：
//   结婚   = history eventId 'rel_propose'
//   育儿   = history eventId 'rel_child_question'
//   购房   = history eventId 'mid_house_down_payment'
//   上岸   = history eventId 'civ_exam' | 'edu_admit_master'
//   丧亲   = history title '送别'（父母/伴侣去世线 key 履历）
//   破业   = snapshots 首个现金转负的切面（非 history——现金连续量无单点条目）
import type { GameState } from '../engine/types'

export type MilestoneKind = 'married' | 'child' | 'home' | 'bankrupt' | 'loss' | 'rank'

export interface Milestone {
  kind: MilestoneKind
  /** 大字标题 */
  label: string
  /** 一句话注脚 */
  sentence: string
  /** 事件发生年 */
  age: number
  /** 喜庆类（可配提示音）；丧亲/破业静默 */
  festive: boolean
}

const EVENT_KINDS: Array<{ eventIds: string[]; kind: MilestoneKind; label: string; sentence: string; festive: boolean }> = [
  { eventIds: ['rel_propose'], kind: 'married', label: '我们结婚了', sentence: '那一天，两个人的名字写进了同一本证。', festive: true },
  { eventIds: ['rel_child_question'], kind: 'child', label: '我们当了父母', sentence: '啼哭声落下的那一刻，世界安静了一秒。', festive: true },
  { eventIds: ['mid_house_down_payment'], kind: 'home', label: '有了自己的家', sentence: '钥匙插进锁孔的声音，是这座城市的回音。', festive: true },
  { eventIds: ['civ_exam', 'edu_admit_master'], kind: 'rank', label: '金榜题名', sentence: '放榜那天的名字，被很多人念了一遍。', festive: true },
]

/** 检测「某一年」新出现的重大时刻（同年多类时按固定顺序截前 2 张防疲劳） */
export function milestonesAtAge(state: GameState, age: number): Milestone[] {
  const out: Milestone[] = []
  for (const h of state.history) {
    if (h.age !== age) continue
    const def = EVENT_KINDS.find((k) => k.eventIds.includes(h.eventId))
    if (def && !out.some((m) => m.kind === def.kind)) {
      out.push({ kind: def.kind, label: def.label, sentence: def.sentence, age: h.age, festive: def.festive })
    }
  }
  // 丧亲：送别 key 履历（父母/伴侣去世线）
  if (state.history.some((h) => h.age === age && h.title === '送别')) {
    out.push({ kind: 'loss', label: '送别', sentence: '有些人陪你走了一程，然后用余生被你记得。', age, festive: false })
  }
  // 破业：本年现金转负（去年尚未负债）
  const snaps = state.snapshots
  const last = snaps[snaps.length - 1]
  const prev = snaps[snaps.length - 2]
  if (last && last.age === age && last.money < 0 && (!prev || prev.money >= 0) && !out.some((m) => m.kind === 'bankrupt')) {
    out.push({ kind: 'bankrupt', label: '负债的日子', sentence: '数字第一次变成了负数——日子还得往下过。', age, festive: false })
  }
  return out.slice(0, 2)
}

/** 全史六类首现清单（账本/验收用） */
export function allMilestones(state: GameState): Milestone[] {
  const ages = new Set(state.history.map((h) => h.age))
  const out: Milestone[] = []
  for (const age of [...ages].sort((a, b) => a - b)) {
    out.push(...milestonesAtAge(state, age))
  }
  return out
}
