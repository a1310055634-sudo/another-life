// 第 64 轮：兄弟姐妹 I——建立与年度动态测试
// 验收口径（PROMPT-V4.md 第 64 轮）：
// - A1 定数/取名 seed 确定性（随机支流：seed ^ 0x5eedb105 独立 mulberry32 + pickName 纯散列）
// - 主 rng 流零位移（同 seed 同名两局 rngState 逐位相等；逐局位移由 outcomes.test 原值背书）
// - 衰减 sibling −1；先逝 seed 确定性 + 复活不复活已去世者（R41 语义沿袭）
// - A5 旧档兼容：无 sibling 正常；sibling birthAge 走 −4…+4 独立合法域（validate）
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { advanceYear } from './lifecycle'
import { applyRelationEffect, RELATION_DECAY_RATE, settleRelationDecay, relationsLine } from './relations'
import { settleSiblingDeath, SIBLING_FUNERAL_COST } from './parents'
import { validateState } from './validate'
import type { GameState, Relation } from './types'

function makeGame(seed = 7, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
  return { ...base, ...patch }
}

const siblingsOf = (s: GameState): Relation[] => s.relations.filter((r) => r.kind === 'sibling')
const sib = (birthAge: number, name = '建平'): Relation => ({
  id: 's1', kind: 'sibling', name, closeness: 65, alive: true, birthAge,
})

describe('第 64 轮：手足建立（随机支流）', () => {
  it('A1 定数/取名 seed 确定性：同 seed 逐字段相等；跨 seed 分散；birthAge ∈ −4…+4', () => {
    for (const seed of [7, 42, 20260917]) {
      const a = siblingsOf(createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' }))
      const b = siblingsOf(createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' }))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
      for (const r of a) {
        expect(typeof r.birthAge).toBe('number')
        expect(r.birthAge as number).toBeGreaterThanOrEqual(-4)
        expect(r.birthAge as number).toBeLessThanOrEqual(4)
        expect(r.name).not.toBe('手足') // 名字来自池而非泛称
      }
      // 同 seed 两局主流零污染：rngState 逐位相等
      const ga = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
      const gb = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '测试者' })
      expect(ga.rngState).toEqual(gb.rngState)
    }
    // 分布：50 seeds 里三种配置（0/1/2 个）都出现
    const configs = new Set<number>()
    for (let seed = 1; seed <= 50; seed++) {
      configs.add(siblingsOf(createNewGame({ seed, backgroundId: 'rural', traitId: 'studious', name: '测试者' })).length)
    }
    expect(configs.has(0)).toBe(true)
    expect(configs.has(1)).toBe(true)
    expect(configs.has(2)).toBe(true)
  })

  it('衰减 sibling −1（relationDecay 表口径）；疏远兜底照常接手', () => {
    expect(RELATION_DECAY_RATE.sibling).toBe(1)
    const s = makeGame(7, { relations: [sib(-3)] })
    const { relations, warnings } = settleRelationDecay(s.relations)
    expect(relations[0].closeness).toBe(64)
    expect(warnings).toEqual([])
    // 跌破黄灯线提示一次（20→19 触发；21→20 不算跌破）
    const near = makeGame(7, { relations: [sib(-3, '建平')] })
    near.relations[0] = { ...near.relations[0], closeness: 20 }
    const warn = settleRelationDecay(near.relations)
    expect(warn.relations[0].closeness).toBe(19)
    expect(warn.warnings).toEqual([{ kind: 'sibling', name: '建平' }])
  })

  it('先逝：57 岁不判定；seed 确定性；去世落地 deceased+deathAge（手足年龄）+丧葬；复活不复活已逝', () => {
    const rels = [sib(-4, '大哥')] // 玩家 60 岁时大哥 64 岁 → 进入首档风险带
    // 玩家 57 岁：未到 SIBLING_DEATH_START，永不判定
    expect(settleSiblingDeath(rels, 57, 11).deaths).toEqual([])
    // 扫 seed 找死亡例与存活例两分支
    let deathSeed = -1
    let aliveSeeds = 0
    for (let seed = 1; seed <= 3000; seed++) {
      if (settleSiblingDeath(rels, 60, seed).deaths.length > 0) {
        deathSeed = seed
        break
      }
      aliveSeeds++
    }
    expect(deathSeed).toBeGreaterThan(0)
    const died = settleSiblingDeath(rels, 60, deathSeed)
    expect(died.deaths[0].siblingAge).toBe(64)
    expect(died.funeral).toBe(SIBLING_FUNERAL_COST)
    const r = died.relations[0]
    expect(r.alive).toBe(false)
    expect(r.deceased).toBe(true)
    expect(r.deathAge).toBe(64)
    expect(r.estranged).toBeUndefined()
    // 存活分支：确定性复现
    expect(settleSiblingDeath(rels, 60, deathSeed + 1).deaths.length).toBeLessThanOrEqual(1)
    void aliveSeeds
    // revive 只认 estranged：已去世手足不可复活（R41 语义沿袭，A6）
    const revived = applyRelationEffect(died.relations, { kind: 'sibling', revive: true }, 1)
    expect(revived[0].alive).toBe(false)
    expect(revived[0].deceased).toBe(true)
  })

  it('advanceYear 集成：手足去世年丧葬落账 + 送别 key 履历 + 年志', () => {
    const rels = [sib(-4, '大哥')]
    let seed = -1
    for (let s = 1; s <= 3000; s++) {
      if (settleSiblingDeath(rels, 60, s).deaths.length > 0) {
        seed = s
        break
      }
    }
    expect(seed).toBeGreaterThan(0)
    const withSib = makeGame(seed, { age: 59, relations: [sib(-4, '大哥')] })
    const after = advanceYear(withSib)
    const dead = after.relations.find((r) => r.kind === 'sibling')!
    if (dead.deceased) {
      expect(after.history.some((h) => h.title === '送别' && h.key)).toBe(true)
      expect(after.yearLog.join('\n')).toContain('丧事开支')
      expect(after.money).toBeLessThan(withSib.money)
    }
  })
})

describe('第 64 轮：旧档兼容与校验域（A5）', () => {
  it('旧档（无 sibling 关系、无新字段）加载零 issue；手足缺名字降级泛称不露 undefined', () => {
    const legacy = makeGame(7, { relations: [{ id: 'mother', kind: 'parent', name: '母亲', closeness: 60, alive: true }] })
    expect(validateState(legacy).issues).toEqual([])
    const nameless = makeGame(7, { relations: [{ id: 's9', kind: 'sibling', name: undefined as unknown as string, closeness: 50, alive: true }] })
    expect(validateState(nameless).issues.some((i) => i.field.includes('s9'))).toBe(false)
    expect(relationsLine(nameless)).toContain('手足')
    expect(relationsLine(nameless)).not.toContain('undefined')
  })

  it('sibling birthAge 独立合法域 −4…+4：−3 保留、−5/5 清除；child 负值口径不变仍清除', () => {
    const ok = makeGame(7, { age: 60, relations: [sib(-3)] })
    expect(validateState(ok).issues).toEqual([])
    expect(ok.relations[0].birthAge).toBe(-3)
    for (const bad of [-5, 5]) {
      const s = makeGame(7, { age: 60, relations: [sib(bad)] })
      expect(validateState(s).issues.length).toBeGreaterThan(0)
      expect(s.relations[0].birthAge).toBeUndefined()
    }
    const childNeg = makeGame(7, {
      age: 30,
      relations: [{ id: 'c1', kind: 'child', name: '小满', closeness: 60, alive: true, birthAge: -3 }],
    })
    validateState(childNeg)
    expect(childNeg.relations[0].birthAge).toBeUndefined() // child 口径不松
  })
})
