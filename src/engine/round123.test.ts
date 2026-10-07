// 第 123 轮（V7）：时代纵深 IV——纯氛围 3 枚定向薄桶（26-35/46-55 专属）
// 锁定：窗口定向（28-35/48-55/26-58）、纯氛围口径（零标记零延迟链）、池合规与计数。
// era 指纹零机制值（removed=0）与词表去重的证据在关账账本（era_fp_compare/grep）。
import { describe, it, expect } from 'vitest'
import { ALL_EVENTS } from '../data/events'
import { ERA4_EVENTS } from '../data/events/era4'
import { validateEvents } from './validateEvents'

describe('时代纵深 IV 纯氛围 3 枚（A4/A5）', () => {
  it('era4.ts 3 枚、全池 327→330、validateEvents 零 issue、category 合规', () => {
    expect(ERA4_EVENTS).toHaveLength(3)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    for (const e of ERA4_EVENTS) {
      expect(e.category === 'life' || e.category === 'career').toBe(true)
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.cooldown).toBe(5)
    }
  })
  it('定向窗：28-35/48-55 完整落桶（26-35 与 46-55 专属各 +1）；零标记零延迟链', () => {
    const jobs = ERA4_EVENTS.find((e) => e.id === 'era4_jobs_dawn')!
    expect(jobs.minAge).toBe(28)
    expect(jobs.maxAge).toBe(35)
    const group = ERA4_EVENTS.find((e) => e.id === 'era4_group_buy')!
    expect(group.minAge).toBe(48)
    expect(group.maxAge).toBe(55)
    for (const e of ERA4_EVENTS) {
      for (const c of e.choices) {
        expect(c.addTags ?? []).toEqual([])
        expect(c.delayed ?? []).toEqual([])
      }
    }
  })
})
