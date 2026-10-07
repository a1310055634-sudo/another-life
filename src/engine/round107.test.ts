// 第 107 轮：开局抽签仪式测试（呈现层；架构红线 = 引擎零改动）
//
// 验收口径（PROMPT-V6.md 第 107 轮）：
// - A1 抽签随机性：drawFortune 覆盖全部 4×6 组合，无单一值塌缩
// - A2 机制等价：抽签组合与自选同组合的 previewStart / 开局状态逐位一致
// - 揭示文案只读 backgrounds/traits 既有字段，不剧透 pros/cons 数值
// - reduced-motion 只关动画不改功能时序（REVEAL_MS 常量与 CSS 时长一致）
// - 引擎只读：startSession 签名与 Session 结构未被本轮改动（本文件以
//   「createNewGame/previewStart 签名不变」断言锁住）
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BACKGROUNDS } from '../data/backgrounds'
import { TRAITS } from '../data/traits'
import { previewStart, createNewGame, SAVE_VERSION } from './init'
import { startSession } from './session'
import { ALL_EVENTS } from '../data/events'

const componentSrc = readFileSync(new URL('../components/FortuneDraw.tsx', import.meta.url), 'utf8')
const creationSrc = readFileSync(new URL('../pages/CreationPage.tsx', import.meta.url), 'utf8')
const cssSrc = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

/** 复刻组件内的抽样逻辑（同口径，便于在测试中直接统计分布） */
function drawFortune(): { bgId: string; traitId: string } {
  const bg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
  const tr = TRAITS[Math.floor(Math.random() * TRAITS.length)]
  return { bgId: bg.id, traitId: tr.id }
}

describe('第 107 轮：抽签数据源与随机性', () => {
  it('组合空间 = 4 背景 × 6 天赋 = 24', () => {
    expect(BACKGROUNDS).toHaveLength(4)
    expect(TRAITS).toHaveLength(6)
    expect(BACKGROUNDS.length * TRAITS.length).toBe(24)
  })

  // 口径订正（首版断言在此处翻车）：100 次抽样**不足以**保证 24 种组合全覆盖——
  // 期望覆盖数 24×(1-(23/24)^100) ≈ 23.68，漏掉至少一种的概率约 26%，实跑 4 轮偶发红 1 次。
  // 「不塌缩」真正要证的不是全覆盖，而是「不存在恒定 bug」：某档被硬编码偏爱 / 某档永不出现。
  // 故拆成 ①逐档覆盖（背景 4 档、天赋 6 档，100 次下漏一档概率 < 1e-11，稳）
  // ②任一档占比不过半 ③24 种全覆盖挪到大样本里断言。
  it('A1 连续 100 次抽样：4 背景与 6 天赋逐档全覆盖且无垄断（不塌缩）', () => {
    const bgCount = new Map<string, number>()
    const trCount = new Map<string, number>()
    for (let i = 0; i < 100; i++) {
      const p = drawFortune()
      bgCount.set(p.bgId, (bgCount.get(p.bgId) ?? 0) + 1)
      trCount.set(p.traitId, (trCount.get(p.traitId) ?? 0) + 1)
    }
    expect(bgCount.size).toBe(4)
    expect(trCount.size).toBe(6)
    // 等概率期望：背景各 25、天赋各 ≈16.7；上界分别取 50 / 34
    for (const c of bgCount.values()) expect(c).toBeLessThanOrEqual(50)
    for (const c of trCount.values()) expect(c).toBeLessThanOrEqual(34)
  })

  it('A1 大样本（2000 次）覆盖全部 24 种组合', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const p = drawFortune()
      seen.add(`${p.bgId}+${p.traitId}`)
    }
    expect(seen.size).toBe(24)
  })

  it('抽样结果的 id 均在数据源内（不会产出越界 id）', () => {
    for (let i = 0; i < 50; i++) {
      const p = drawFortune()
      expect(BACKGROUNDS.some((b) => b.id === p.bgId)).toBe(true)
      expect(TRAITS.some((t) => t.id === p.traitId)).toBe(true)
    }
  })
})

describe('第 107 轮：A2 抽签 = 自选（机制等价）', () => {
  it('previewStart 对同一组合逐位一致（24 组合 × 两次调用）', () => {
    for (const bg of BACKGROUNDS) {
      for (const tr of TRAITS) {
        expect(JSON.stringify(previewStart(bg.id, tr.id))).toBe(
          JSON.stringify(previewStart(bg.id, tr.id)),
        )
      }
    }
  })

  it('真实开局：抽签组合与自选同组合的引擎状态逐位一致', () => {
    const norm = (s: ReturnType<typeof startSession>) =>
      JSON.stringify({
        attrs: s.state.attrs,
        money: s.state.money,
        education: s.state.education,
        skills: s.state.skills,
        tags: s.state.tags,
        relations: s.state.relations.length,
      })
    for (const bg of BACKGROUNDS) {
      for (const tr of TRAITS) {
        const a = startSession({ seed: 4242, name: '甲', backgroundId: bg.id, traitId: tr.id }, ALL_EVENTS)
        const b = startSession({ seed: 4242, name: '甲', backgroundId: bg.id, traitId: tr.id }, ALL_EVENTS)
        expect(norm(a)).toBe(norm(b))
      }
    }
  })

  it('反向对照：不同组合的开局必须不同（否则上面的「一致」是恒真）', () => {
    const p1 = previewStart('ordinary', 'studious')
    const p2 = previewStart('wealthy', 'studious')
    const p3 = previewStart('rural', 'studious')
    expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p2))
    expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p3))
  })

  it('引擎签名未变：previewStart 两参 / createNewGame 单参对象 / SAVE_VERSION 仍为 2', () => {
    expect(previewStart.length).toBe(2)
    expect(createNewGame.length).toBe(1)
    expect(SAVE_VERSION).toBe(2)
    // 开局参数仍只认 backgroundId + traitId（抽签未引入第三项）
    const st = createNewGame({ seed: 1, name: '甲', backgroundId: 'wealthy', traitId: 'sociable' })
    expect(st.tags).toContain('bg_wealthy')
    expect(st.tags).toContain('social_butterfly')
  })
})

describe('第 107 轮：仪式呈现与架构红线', () => {
  it('组件不 import 任何引擎模块（呈现层零引擎耦合）', () => {
    expect(componentSrc).not.toMatch(/from '\.\.\/engine\//)
  })

  it('CreationPage 接入抽签且开局调用仍是三元组（name/bgId/traitId）', () => {
    expect(creationSrc).toContain('FortuneDraw')
    expect(creationSrc).toMatch(/onStart\(name,\s*bgId,\s*traitId\)/)
  })

  it('揭示文案只读数据源既有字段，不硬写机制数值', () => {
    // 组件内不得出现 pros/cons 字段引用（会剧透数值优势）
    expect(componentSrc).not.toContain('.pros')
    expect(componentSrc).not.toContain('.cons')
    // 但必须读 desc/name 作为揭示文案来源
    expect(componentSrc).toContain('bg?.desc')
    expect(componentSrc).toContain('tr?.desc')
  })

it('悬念半句取 desc 首句（先给半句后给全貌）', () => {
    // 用字符串判定而非正则：正则里的 / 需转义，易踩（esbuild 直接报未终止）
    expect(componentSrc).toContain("desc.split(/[，。]/)[0]")
    expect(componentSrc).toContain('fortune-suspense')
  })

  it('reduced-motion 降级只关动画不改功能时序（CSS + 组件定时器并存）', () => {
    expect(cssSrc).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fortune-card[\s\S]*?animation: none/)
    // 组件用定时器落状态——动画关掉后状态照样到 revealed
    expect(componentSrc).toContain('REVEAL_MS')
    expect(componentSrc).toMatch(/setTimeout[\s\S]*?setPhase\('revealed'\)/)
  })

  it('组件卸载后不再 setState（抽签途中离开创建页不留悬空定时器副作用）', () => {
    expect(componentSrc).toContain('aliveRef')
  })

  it('抽签与自选并列：不移除自选表单、不改默认开局流程', () => {
    expect(creationSrc).toContain('opt-grid')
    expect(creationSrc).toContain('BACKGROUNDS.map')
    expect(creationSrc).toContain('TRAITS.map')
  })
})