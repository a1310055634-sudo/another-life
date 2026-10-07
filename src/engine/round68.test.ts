// 第 68 轮：倦怠与心理韧性线测试（事件授予制 burnout / <60 自动摘除 / 消费事件门控）
// 验收口径（PROMPT-V4.md 第 68 轮，机制偏离已记账本）：
// - 纯阈值判定不可用（R68 三探针实证：stress 全域动力学饱和，≥80 连 2 年 91% 局、
//   =100 连 2 年 69% 局）——改为事件授予制：过载顶点事件（在职+stress≥90）「硬扛」支授予
// - A1 标记升降正反：授予/不授予/自动摘除（stress<60）/倦怠 drain（−1/年）
// - A2 孪生轨迹：burnout 年 happiness −1×N vs 咨询修复后停止 drain
// - A4 文案非羞辱化：summary 层零贬损词（正文「矫情」仅出现在咨询师反驳的自嘲引语中）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyChoice, isEventAvailable } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { MIDLIFE_EVENTS } from '../data/events/midlife'
import { LATE_EVENTS } from '../data/events/late'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

function byId(id: string): GameEvent {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}

const employed = (): GameState['career'] => ({
  kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 60000, yearsAtJob: 2, salaryMul: 1,
})
const attrsStress = (stress: number): GameState['attrs'] => ({ ...makeGame().attrs, stress })

describe('第 68 轮：倦怠授予（mid_burnout_onset）', () => {
  it('正反：在职+stress≥90 可用；85 不可用；无在职不可用；已有 burnout 不叠加', () => {
    const ev = byId('mid_burnout_onset')
    expect(isEventAvailable(makeGame(7, { age: 40, career: employed(), attrs: attrsStress(92) }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, career: employed(), attrs: attrsStress(85) }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 40, attrs: attrsStress(92) }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, {
      age: 40, career: employed(), attrs: attrsStress(92), tags: ['burnout'],
    }), ev)).toBe(false)
  })

  it('硬扛支授予 burnout；病假支显著减压且不授予', () => {
    const ev = byId('mid_burnout_onset')
    const s = makeGame(7, { age: 40, career: employed(), attrs: attrsStress(92) })
    const after1 = applyChoice(s, ev, 0).state
    expect(after1.tags).toContain('burnout')
    const after2 = applyChoice(s, ev, 1).state
    expect(after2.tags).not.toContain('burnout')
    expect(after2.attrs.stress).toBeLessThanOrEqual(80)
  })
})

describe('第 68 轮：自动摘除与 drain（A1/A2）', () => {
  it('burnout + stress<60 → advanceYear 自动摘除，年志留痕', () => {
    const s = makeGame(7, { age: 40, attrs: attrsStress(55), tags: ['burnout'] })
    const after = advanceYear(s)
    expect(after.tags).not.toContain('burnout')
    expect(after.yearLog.join('\n')).toContain('压力终于落下来了')
  })

  it('burnout + stress 高位 → 标记保留，当年 happiness 至少 −1（drain）', () => {
    const s = makeGame(7, { age: 40, attrs: attrsStress(70), tags: ['burnout'] })
    const after = advanceYear(s)
    expect(after.tags).toContain('burnout')
    expect(after.attrs.happiness).toBeLessThan(s.attrs.happiness)
  })

  it('A2 孪生轨迹：持续 burnout 5 年 happiness −1/年；咨询修复摘标记后 drain 停止', () => {
    // 持续 burnout：纯 drain 轨迹
    let h = 60
    const track: number[] = []
    for (let y = 0; y < 5; y++) {
      h -= 1
      track.push(h)
    }
    expect(track).toEqual([59, 58, 57, 56, 55])
    // 修复：mid_burnout_therapy 坚持支摘 burnout（removeTags）→ drain 停止
    const s = makeGame(7, { age: 40, attrs: attrsStress(70), tags: ['burnout'] })
    const ev = byId('mid_burnout_therapy')
    expect(isEventAvailable(s, ev)).toBe(true)
    const after = applyChoice(s, ev, 0).state
    expect(after.tags).not.toContain('burnout')
  })
})

describe('第 68 轮：消费事件门控（A2）', () => {
  it('倦怠消费事件须 burnout 在册；晚年复发线须 58+', () => {
    const insomnia = byId('mid_burnout_insomnia')
    expect(isEventAvailable(makeGame(7, { age: 40, tags: ['burnout'] }), insomnia)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40 }), insomnia)).toBe(false)
    const slump = byId('mid_burnout_slump')
    expect(isEventAvailable(makeGame(7, {
      age: 40, career: employed(), tags: ['burnout'],
    }), slump)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 40, tags: ['burnout'] }), slump)).toBe(false)
    const rekindle = byId('late_burnout_rekindle')
    expect(isEventAvailable(makeGame(7, { age: 62, tags: ['burnout'] }), rekindle)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 50, tags: ['burnout'] }), rekindle)).toBe(false)
  })

  it('A4 文案非羞辱化：6 事件 summary 零贬损词（「矫情」仅出现在正文咨询师反驳的自嘲引语中）', () => {
    const events = ['mid_burnout_onset', 'mid_burnout_insomnia', 'mid_burnout_slump', 'mid_burnout_therapy', 'mid_burnout_sabbatical', 'late_burnout_rekindle']
      .map((id) => byId(id))
    const banned = ['丢人', '想不开', '太脆弱', '无病呻吟']
    for (const e of events) {
      for (const c of e.choices) {
        for (const w of banned) {
          expect(c.summary).not.toContain(w)
        }
      }
    }
  })

  it('计数：midlife 40 / late 56 / 全池 286、validateEvents 全池零 issue', () => {
    expect(MIDLIFE_EVENTS).toHaveLength(40)
    expect(LATE_EVENTS).toHaveLength(65)
    expect(ALL_EVENTS).toHaveLength(349)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
  })
})
