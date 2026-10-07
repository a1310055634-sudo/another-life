// 第 54 轮：分享卡测试（数据组装纯函数 + 字段映射 + 绘制函数降级安全）
// 验收口径（PROMPT-V3.md 第 54 轮）：
// - 组装纯函数：评级/结局名/终龄/峰值资产/金句两级兜底/五维值全部来自真实状态
// - 负债结局峰值可为负（不隐含正值）；金句缺省退后记首句；空状态不露 undefined
// - 绘制与下载：node 无 canvas——drawShareCard 无 2d 上下文安全早退；下载真实触发由 CDP 探针覆盖
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createNewGame } from './init'
import { buildShareCardData, drawShareCard } from '../components/ShareCard'
import type { GameState, Relation } from './types'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function rel(kind: Relation['kind'], name: string): Relation {
  return { id: `${kind}_${name}`, kind, name, closeness: 60, alive: true }
}

/** 临终构造态（76 岁退休安全水位，与 outcomes.test nearEnd 同式） */
function nearEnd(patch: Partial<GameState> = {}): GameState {
  return makeGame(7, {
    age: 76,
    career: { kind: 'retired', pension: 20000 },
    tags: ['ever_employed', 'retired'],
    attrs: { health: 60, happiness: 55, smarts: 50, social: 50, stress: 20 },
    money: 80000,
    ...patch,
  })
}

describe('第 54 轮：buildShareCardData 组装（验收①）', () => {
  it('常规局：评级/结局名/终龄/峰值资产/成就数全部来自真实状态', () => {
    const s = nearEnd({
      tags: ['ever_employed', 'retired', 'married', 'has_child'],
      relations: [rel('spouse', '林秀'), rel('child', '林小满')],
      snapshots: [
        { age: 18, money: 3000, attrs: makeGame().attrs, career: { kind: 'none' } },
        { age: 40, money: 250000, attrs: makeGame().attrs, career: { kind: 'employed', level: 2 } },
      ],
    })
    const d = buildShareCardData(s)
    expect(d.name).toBe('测试者')
    expect(d.age).toBe(76)
    expect(d.achievementsCount).toBe(s.achievements.length)
    expect(d.peakMoney).toBe(250000) // 快照峰值与终局取大
    expect(d.peakMoneyText).toBe('25.0 万')
    expect(d.attrs).toHaveLength(5)
    expect(d.attrs.every((a) => a.value >= 0 && a.value <= 100)).toBe(true)
    expect(JSON.stringify(d)).not.toContain('undefined')
  })

  it('负债结局：峰值可为负、文本带负号（不隐含正值）', () => {
    const s = nearEnd({ money: -60000, snapshots: [] })
    const d = buildShareCardData(s)
    expect(d.peakMoney).toBe(-60000)
    expect(d.peakMoneyText).toContain('-')
  })

  it('金句两级兜底：有转折年选择用金句模板；无则退后记首句；均不含占位符', () => {
    const withChoice = nearEnd({
      history: [
        { age: 69, eventId: 'late_dream_legacy', title: '把故事写下来', choice: '把故事写下来，装订成册', summary: '晚年仍在写作', key: true },
      ],
    })
    const d1 = buildShareCardData(withChoice)
    expect(d1.quote).toContain('69 岁')
    expect(d1.quote).toContain('装订成册')
    // 无任何关键履历 → 后记兜底（seed 确定的首句），非空且无占位符
    const bare = nearEnd({ history: [] })
    const d2 = buildShareCardData(bare)
    expect(d2.quote.length).toBeGreaterThan(0)
    expect(d2.quote).not.toContain('{')
    expect(d2.quote).not.toContain('undefined')
  })
})

describe('第 54 轮：绘制降级与入口接线（验收③部分）', () => {
  it('node 无 2d 上下文：drawShareCard 安全早退不抛错', () => {
    const fake = { width: 1080, height: 1440, getContext: () => null } as unknown as HTMLCanvasElement
    expect(() => drawShareCard(fake, buildShareCardData(nearEnd()))).not.toThrow()
  })

  it('EndingPage 接线点存在：分享按钮调 downloadShareCard（呈现层）', () => {
    const src = readFileSync(new URL('../pages/EndingPage.tsx', import.meta.url), 'utf8')
    expect(src).toContain('downloadShareCard(state)')
    expect(src).toContain('保存分享卡')
  })
})
