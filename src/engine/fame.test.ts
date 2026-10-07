// 第 93 轮：自媒体名声线测试（起号→坚持→爆款→变现→网暴）
// 验收口径（PROMPT-V5.md 第 93 轮）：
// - A1 链路正反（起号广谱/更新需 creator_started/爆款需走红窗/变现需 minor_fame/网暴需 hate 窗）
// - A2 走红判定 seed 确定性（viralAt/hateAt 同参同果+概率表冻结）
// - A3 fameCash 落地+网暴停更支移除 minor_fame
// - A4 网暴文案非受害者指责化自查（责备对象=陌生人与生态，非「谁让你发」）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { validateEvents } from './validateEvents'
import { isEventAvailable, applyChoice, drawEvent } from './events'
import { rngFromState } from './rng'
import { ALL_EVENTS } from '../data/events'
import { FAME_EVENTS } from '../data/events/fame'
import { viralAt, hateAt, FAME_VIRAL_RATE, FAME_HATE_RATE } from './fame'
import type { GameEvent, GameState } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}
const byId = (id: string): GameEvent => {
  const e = ALL_EVENTS.find((ev) => ev.id === id)
  if (!e) throw new Error(`事件不存在: ${id}`)
  return e
}
// 找一个 40 岁窗口为真/假的 seed（fn 可传 viralAt 或 hateAt）
function findSeed(age: number, want: boolean, fn: (seed: number, age: number) => boolean = viralAt): number {
  for (let s = 1; s < 2000; s++) {
    if (fn(s, age) === want) return s
  }
  return -1
}

describe('第 93 轮：支流确定性（A2）', () => {
  it('概率表冻结：走红 0.35/网暴 0.25', () => {
    expect(FAME_VIRAL_RATE).toBe(0.35)
    expect(FAME_HATE_RATE).toBe(0.25)
  })
  it('viralAt/hateAt 同参同果；多 seed 有差异；两窗独立（存在 viral≠hate 的 seed）', () => {
    for (const age of [20, 35, 45]) {
      expect(viralAt(20260917, age)).toBe(viralAt(20260917, age))
      expect(hateAt(20260917, age)).toBe(hateAt(20260917, age))
    }
    const viralSet = new Set(Array.from({ length: 30 }, (_, i) => viralAt(7000 + i, 40)))
    expect(viralSet.size).toBe(2) // 既有真也有假
    // 存在走红窗为真且网暴窗为假的 seed（两窗独立）
    let independent = false
    for (let s = 1; s < 500; s++) {
      if (viralAt(s, 40) && !hateAt(s, 40)) { independent = true; break }
    }
    expect(independent).toBe(true)
  })
})

describe('第 93 轮：链路正反（A1）', () => {
  it('新事件计数=7、全池校验器零 issue、全池 290', () => {
    expect(FAME_EVENTS).toHaveLength(7)
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
  })
  it('fame_start：广谱可用（在职/学生/待业）；once 后不可复用', () => {
    const ev = byId('fame_start')
    expect(isEventAvailable(makeGame(7, { age: 30, career: { kind: 'employed', jobId: 'office_clerk', jobTitle: 'x', level: 1, salary: 44000, yearsAtJob: 1, salaryMul: 1 } }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 20, career: { kind: 'student', stage: 'college', yearsLeft: 2 } }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['creator_started'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['minor_fame'] }), ev)).toBe(false) // 已走红不再起号
  })
  it('fame_update/fame_viral/fame_cash/fame_hate：标记与支流窗口门', () => {
    const upd = byId('fame_update')
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['creator_started'] }), upd)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['minor_fame'] }), upd)).toBe(false) // 已走红不再走坚持线
    const viral = byId('fame_viral')
    const viralSeed = findSeed(40, true)
    const noViralSeed = findSeed(40, false)
    expect(viralSeed).toBeGreaterThan(0)
    expect(noViralSeed).toBeGreaterThan(0)
    expect(isEventAvailable(makeGame(viralSeed, { age: 40, tags: ['creator_started'] }), viral)).toBe(true)
    expect(isEventAvailable(makeGame(noViralSeed, { age: 40, tags: ['creator_started'] }), viral)).toBe(false) // 走红窗未开
    expect(isEventAvailable(makeGame(viralSeed, { age: 40, tags: ['minor_fame'] }), viral)).toBe(false) // 已走红
    const cash = byId('fame_cash')
    expect(isEventAvailable(makeGame(7, { age: 30, tags: ['minor_fame'] }), cash)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30 }), cash)).toBe(false)
    const hate = byId('fame_hate')
    const hateSeed = findSeed(45, true, hateAt) // hate 窗走独立散列 hateAt
    const hateOff = Array.from({ length: 500 }, (_, i) => i + 1).find((s) => !hateAt(s, 45))!
    expect(hateSeed).toBeGreaterThan(0)
    expect(isEventAvailable(makeGame(hateSeed, { age: 45, tags: ['minor_fame'] }), hate)).toBe(true)
    expect(isEventAvailable(makeGame(hateOff, { age: 45, tags: ['minor_fame'] }), hate)).toBe(false)
  })
  it('落地：爆款授 minor_fame 清 creator_started；停更支移除；变现签字费入袋', () => {
    const viralSeed = findSeed(40, true)
    const s = makeGame(viralSeed, { age: 40, tags: ['creator_started'] })
    const r = applyChoice(s, byId('fame_viral'), 0)
    expect(r.state.tags).toContain('minor_fame')
    expect(r.state.tags).not.toContain('creator_started')
    const s2 = makeGame(viralSeed, { age: 40, tags: ['creator_started'] })
    const r2 = applyChoice(s2, byId('fame_viral'), 1)
    expect(r2.state.tags).not.toContain('minor_fame')
    expect(r2.state.tags).not.toContain('creator_started')
    const rich = makeGame(7, { age: 30, tags: ['minor_fame'], money: 5000 })
    const r3 = applyChoice(rich, byId('fame_cash'), 0)
    expect(r3.state.money).toBe(13000)
  })
})

describe('第 93 轮：网暴文案非受害者指责化自查（A4）', () => {
  it('文案无「谁让你发/活该/炒作吧」类指责话术；压力源=陌生人与生态', () => {
    const hate = byId('fame_hate') as unknown as { text: string; choices: Array<{ text: string; summary: string }> }
    const all = [hate.text, ...hate.choices.map((c) => c.text + c.summary)].join('\n')
    for (const bad of ['谁让你', '活该', '炒作吧', '博眼球', '自己发的怪谁']) {
      expect(all.includes(bad)).toBe(false)
    }
    expect(hate.text).toContain('没有人在意真相') // 指责对象=生态而非受害者
  })
})

describe('第 93 轮：加权抽取（×50，priority=0 层）', () => {
  it('抽到的新事件必然资格可用（错误状态从不入候选）', () => {
    const flat = ALL_EVENTS.filter((e) => (e.priority ?? 0) === 0)
    const weighted: GameEvent[] = [...flat]
    for (let k = 0; k < 50; k++) weighted.push(...FAME_EVENTS)
    let drawnNew = 0
    for (let i = 0; i < 200; i++) {
      const seed = 9500 + i
      const age = 18 + (i % 30)
      const tags =
        i % 4 === 0
          ? ['minor_fame']
          : i % 4 === 1
            ? ['creator_started']
            : []
      const s = makeGame(seed, { age, tags })
      const rng = rngFromState(s.rngState)
      const ev = drawEvent(s, weighted, rng)
      if (FAME_EVENTS.some((n) => n.id === ev.id)) {
        drawnNew++
        expect(isEventAvailable(s, ev)).toBe(true)
      }
    }
    expect(drawnNew).toBeGreaterThan(0)
  })
})
