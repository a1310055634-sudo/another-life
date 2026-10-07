// 第 12 轮：健康、压力与生活方式引擎
// 生活方式标记的年度健康/压力漂移 + 低健康分级预警 + 单步伤害上限。
// 全部为纯函数、不消耗 RNG，保证同 seed 复现。
import type { AttrKey } from './types'
import { clampAttr } from './attrs'

export interface YearDrift {
  drift: Partial<Record<AttrKey, number>>
  notes: string[]
}

/**
 * 生活方式标记 → 每年健康/压力漂移。
 * 标记由事件授予/移除：健康变化因此能从过往选择解释（第 12 轮验收）。
 * 量级设计：单项 ±1~2/年——与年龄曲线（50+ -1、65+ -2）、慢性压力侵蚀（stress≥80 -3）
 * 同一量级，不会一年把人从健康推到死亡。
 */
export const LIFESTYLE_HEALTH_DRIFT: Record<string, { drift: Partial<Record<AttrKey, number>> }> = {
  routine_exercise: { drift: { health: 1, stress: -1 } },   // 坚持锻炼
  night_owl: { drift: { health: -1, happiness: -1 } },      // 长期熬夜
  chronic_pain: { drift: { health: -1, stress: 1 } },       // 旧伤/慢性疼痛
  rehab_program: { drift: { health: 2, stress: -1 } },      // 康复训练中
  light_smoker: { drift: { health: -2 } },                  // 烟不离手
  // 长期饮酒（heavy_drinker）与久坐（desk_bound）不入此表（第 24 轮决策）：
  // 直接年度漂移叠加既有事件伤害会把低健康线提前推死；它们的代价走风险值累积，
  // 由分级体检/慢性病事件延迟兑现——晚结账，而不是年年扣血。
}

/** 汇总所有生活方式标记的年度漂移（纯函数） */
export function applyLifestyleDrift(tags: string[]): YearDrift {
  const drift: Partial<Record<AttrKey, number>> = {}
  const add = (k: AttrKey, v: number) => {
    drift[k] = (drift[k] ?? 0) + v
  }
  for (const tag of tags ?? []) {
    const entry = LIFESTYLE_HEALTH_DRIFT[tag]
    if (!entry) continue
    for (const [k, v] of Object.entries(entry.drift) as Array<[AttrKey, number]>) {
      add(k, v)
    }
  }
  return { drift, notes: [] }
}

/**
 * 单次即时效果的健康伤害上限：超过视为"毫无预兆的突然死亡"风险，
 * 校验器对违规事件报 issue（第 12 轮验收：杜绝普通选择一击致死）。
 * 满健康者单年最坏情况：事件 -6 + 熬夜 -1 + 慢性压力 -3 + 老年曲线 -2 = -12，
 * 从 100 起至少还有 8 年反应期；低健康分级预警（下）保证 40 以下年年有提示。
 */
export const HEALTH_SINGLE_HIT_LIMIT = 6

/**
 * 低健康分级预警：按结算后的健康值给出年志提示。
 * 分级保证玩家在健康见底前至少有 3~4 年可操作的策略窗口。
 */
export function lowHealthWarnings(health: number): string[] {
  if (!Number.isFinite(health)) return []
  if (health <= 0) return []
  if (health < 12) return ['你的身体已接近极限，随时可能倒下，必须立刻休息和治疗']
  if (health < 25) return ['身体亮起了红灯，再硬扛下去会出大事']
  if (health < 40) return ['体检指标不太好看，该调整生活节奏了']
  return []
}

/** 结算后健康值的兜底收敛（与 attrs.clampAttr 同口径，供引擎外模块使用） */
export function clampHealth(v: number): number {
  return clampAttr('health', v)
}
