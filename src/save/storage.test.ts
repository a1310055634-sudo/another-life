// 第 18 轮测试：存档层（序列化 round-trip、RNG 序列复现、损坏存档、版本迁移、存储异常）
// Vitest 环境为 node：Storage 通过内存实现注入，浏览器适配层不做单元测试、由浏览器冒烟覆盖。
import { describe, it, expect } from 'vitest'
import { startSession, chooseOption, nextYear, recoverMissingEvent, type Session } from '../engine/session'
import { SAVE_VERSION } from '../engine/init'
import { ALL_EVENTS } from '../data/events'
import { validateState } from '../engine/validate'
import {
  SAVE_KEY,
  SAVE_FILE_VERSION,
  serializeSession,
  deserializeSave,
  saveSessionTo,
  loadSessionFrom,
  readSaveMetaFrom,
  clearSaveFrom,
  applyMigrations,
  type SaveStorage,
} from './storage'

const OPTS = { seed: 20260928, backgroundId: 'ordinary', traitId: 'studious' } as const

/** 内存存储实现：可用 fail 开关模拟 localStorage 抛错（隐私模式/配额满） */
function memStorage(initial?: Record<string, string>) {
  const m = new Map<string, string>(Object.entries(initial ?? {}))
  const fail = { get: false, set: false }
  const storage: SaveStorage = {
    getItem(key) {
      if (fail.get) throw new Error('storage unavailable')
      return m.has(key) ? (m.get(key) as string) : null
    },
    setItem(key, value) {
      if (fail.set) throw new Error('quota exceeded')
      m.set(key, value)
    },
    removeItem(key) {
      m.delete(key)
    },
  }
  return { storage, m, fail }
}

function playYears(s: Session, years: number): Session {
  let out = s
  for (let i = 0; i < years && out.state.phase === 'playing'; i++) {
    out = out.awaitingAdvance ? nextYear(out, ALL_EVENTS) : chooseOption(out, 0)
  }
  return out
}

function roundTrip(session: Session): ReturnType<typeof deserializeSave> {
  return deserializeSave(JSON.stringify(serializeSession(session, 1727500000000)), ALL_EVENTS)
}

describe('第 18 轮：序列化与恢复（完整保存 Session）', () => {
  it('进行中局 round-trip：state 逐字段一致、会话字段一致、事件重联为池内同一引用', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 6)
    expect(s.state.phase).toBe('playing')
    expect(s.currentEvent).not.toBeNull()

    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state).toEqual(s.state)
    expect(r.session.awaitingAdvance).toBe(s.awaitingAdvance)
    expect(r.session.lastSummary).toBe(s.lastSummary)
    expect(r.session.lastDeltas).toEqual(s.lastDeltas)
    expect(r.data.savedAt).toBe(1727500000000)
    expect(r.data.saveVersion).toBe(SAVE_FILE_VERSION)
    expect(r.unknownEventId).toBeNull()
    // 事件不重抽：按 ID 还原为池内同一个对象
    expect(r.session.currentEvent).toBe(ALL_EVENTS.find((e) => e.id === s.currentEvent!.id))
  })

  it('事件页存档（未选择时）恢复：同一事件、等待选择状态', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.awaitingAdvance).toBe(false)
    expect(r.session.currentEvent?.id).toBe(s.currentEvent!.id)
  })

  it('结算页存档（已选择未进下一年）恢复：同一结算，续推一年与不中断局逐字段一致（不二次结算）', () => {
    const opts = { ...OPTS, seed: 415 }
    const chosen = chooseOption(startSession(opts, ALL_EVENTS), 0)
    expect(chosen.awaitingAdvance).toBe(true)

    const r = roundTrip(chosen)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.awaitingAdvance).toBe(true)
    expect(r.session.lastSummary).toBe(chosen.lastSummary)

    const resumed = nextYear(r.session, ALL_EVENTS)
    const continuous = nextYear(chosen, ALL_EVENTS)
    expect(resumed.state).toEqual(continuous.state)
    expect(resumed.state.age).toBe(continuous.state.age)
  })

  it('RNG 与随机数状态：玩 5 年→存→读→续 5 年，与一口气 10 年的最终状态完全一致', () => {
    const opts = { ...OPTS, seed: 777 }
    const full = playYears(startSession(opts, ALL_EVENTS), 10)
    const half = playYears(startSession(opts, ALL_EVENTS), 5)
    const r = roundTrip(half)
    if (!r.ok) throw new Error(r.reason)
    const resumed = playYears(r.session, 5)
    expect(resumed.state).toEqual(full.state)
  })

  it('未到期延迟效果随存档保留，恢复后到期真实生效（孪生对照精确 +5）', () => {
    const base = startSession(OPTS, ALL_EVENTS)
    const withPending: Session = {
      ...base,
      state: {
        ...base.state,
        pending: [{ id: 'r18_test_recover', dueAge: base.state.age + 1, attr: 'health', delta: 5, summary: '旧伤复查回复' }],
      },
    }
    const r = roundTrip(withPending)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.pending).toEqual(withPending.state.pending)

    const resumed = nextYear(chooseOption(r.session, 0), ALL_EVENTS)
    const twinBase = roundTrip(base)
    if (!twinBase.ok) throw new Error(twinBase.reason)
    const twin = nextYear(chooseOption(twinBase.session, 0), ALL_EVENTS)
    expect(resumed.state.attrs.health - twin.state.attrs.health).toBe(5)
    expect(resumed.state.age).toBe(base.state.age + 1)
  })

  it('终局存档（ended）也能 round-trip，事件为 null', () => {
    let s = startSession({ ...OPTS, seed: 9 }, ALL_EVENTS)
    for (let i = 0; i < 200 && s.state.phase === 'playing'; i++) {
      s = s.awaitingAdvance ? nextYear(s, ALL_EVENTS) : chooseOption(s, 0)
    }
    expect(s.state.phase).toBe('ended')
    expect(s.currentEvent).toBeNull()
    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.phase).toBe('ended')
    expect(r.session.currentEvent).toBeNull()
    expect(r.session.state.endingId).toBeTruthy()
  })
})

describe('第 18 轮：损坏与异常存档（保留原文、不覆盖、不静默）', () => {
  it('非 JSON 文本被拒绝且原文一字不动', () => {
    const { storage, m } = memStorage({ [SAVE_KEY]: '{这不是JSON!!!' })
    const before = m.get(SAVE_KEY)
    const r = loadSessionFrom(storage, ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('JSON')
    expect(m.get(SAVE_KEY)).toBe(before)
  })

  it('缺失信封字段被点名拒绝（awaitingAdvance）', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    delete obj.awaitingAdvance
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('awaitingAdvance')
  })

  it('缺失状态字段被拒绝（money 缺失 → 状态校验不通过）', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    const state = obj.state as Record<string, unknown>
    delete state.money
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('money')
  })

  it('字段范围错误被拒绝（age=8、health=250）', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const mk = (mutate: (o: Record<string, unknown>) => void) => {
      const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
      mutate(obj)
      return deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    }
    const r1 = mk((o) => ((o.state as Record<string, unknown>).age = 8))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toContain('age')
    const r2 = mk((o) => (((o.state as Record<string, unknown>).attrs as Record<string, number>).health = 250))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toContain('attrs.health')
  })

  it('引擎集合字段类型错误被拒绝（pending 非数组、cooldowns 非对象）', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const mk = (mutate: (o: Record<string, unknown>) => void) => {
      const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
      mutate(obj)
      return deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    }
    const r1 = mk((o) => ((o.state as Record<string, unknown>).pending = 'nope'))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toContain('延迟效果')
    const r2 = mk((o) => ((o.state as Record<string, unknown>).cooldowns = []))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toContain('冷却')
  })

  it('state.version 与引擎版本不符被拒绝（防跨版本脏读）', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    ;(obj.state as Record<string, unknown>).version = 99
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('版本')
  })

  it('语义非法存档被拒绝：进行中、未结算、也无事件 ID（恢复后既无事件卡也无推进按钮，软死局）', () => {
    // 偶数步停在事件页（awaitingAdvance=false）：choose→true / nextYear→false 交替
    const s = playYears(startSession(OPTS, ALL_EVENTS), 4)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    expect(obj.awaitingAdvance).toBe(false)
    obj.currentEventId = null
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('语义')
  })

  it('边界保留：结算页存档（等待推进）事件 ID 为 null 仍可恢复，续推一年正常', () => {
    const opts = { ...OPTS, seed: 416 }
    const chosen = chooseOption(startSession(opts, ALL_EVENTS), 0)
    expect(chosen.awaitingAdvance).toBe(true)
    const obj = JSON.parse(JSON.stringify(serializeSession(chosen))) as Record<string, unknown>
    obj.currentEventId = null
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.session.awaitingAdvance).toBe(true)
      expect(r.session.currentEvent).toBeNull()
      const advanced = nextYear(r.session, ALL_EVENTS)
      expect(advanced.state.age).toBe(chosen.state.age + 1)
      expect(validateState(advanced.state).issues).toEqual([])
    }
  })
})

describe('第 18 轮：未知事件 ID 的可恢复处理', () => {
  it('事件 ID 不存在：不重抽、返回 unknownEventId，currentEvent 为 null', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    obj.currentEventId = 'no_such_event_v99'
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.unknownEventId).toBe('no_such_event_v99')
      expect(r.session.currentEvent).toBeNull()
      expect(r.session.awaitingAdvance).toBe(false)
    }
  })

  it('玩家显式跳年后：正常年度结算并抽到池内事件，状态合法（不卡死）', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    obj.currentEventId = 'no_such_event_v99'
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    if (!r.ok) throw new Error(r.reason)
    const recovered = recoverMissingEvent(r.session, ALL_EVENTS)
    expect(recovered.state.age).toBe(s.state.age + 1)
    expect(recovered.awaitingAdvance).toBe(false)
    expect(recovered.currentEvent).not.toBeNull()
    expect(ALL_EVENTS.some((e) => e.id === recovered.currentEvent!.id)).toBe(true)
    expect(validateState(recovered.state).issues).toEqual([])
  })

  it('ended 状态下恢复函数是 no-op（不可在终局后继续推进）', () => {
    let s = startSession({ ...OPTS, seed: 9 }, ALL_EVENTS)
    for (let i = 0; i < 200 && s.state.phase === 'playing'; i++) {
      s = s.awaitingAdvance ? nextYear(s, ALL_EVENTS) : chooseOption(s, 0)
    }
    expect(recoverMissingEvent(s, ALL_EVENTS)).toBe(s)
  })
})

describe('第 18 轮：版本与迁移策略', () => {
  it('更高版本存档被拒绝且不覆盖', () => {
    const { storage, m } = memStorage()
    const s = startSession(OPTS, ALL_EVENTS)
    const raw = JSON.stringify({ ...serializeSession(s), saveVersion: 99 })
    m.set(SAVE_KEY, raw)
    const r = loadSessionFrom(storage, ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('更高版本')
    expect(m.get(SAVE_KEY)).toBe(raw)
  })

  it('applyMigrations：缺迁移环则拒绝，注入迁移链则逐级升级成功', () => {
    const missing = applyMigrations({ saveVersion: 1 }, 1, 3)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.reason).toContain('迁移')

    const chain = [
      {
        from: 1,
        to: 2,
        migrate: (d: Record<string, unknown>) => ({ ...d, saveVersion: 2, newField: 'v2' }),
      },
      {
        from: 2,
        to: 3,
        migrate: (d: Record<string, unknown>) => ({ ...d, saveVersion: 3, newerField: 'v3' }),
      },
    ]
    const ok = applyMigrations({ saveVersion: 1, state: {} }, 1, 3, chain)
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.data.saveVersion).toBe(3)
      expect(ok.data.newField).toBe('v2')
      expect(ok.data.newerField).toBe('v3')
    }
  })
})

describe('第 18 轮：存储读写与异常', () => {
  it('自动存档单槽覆盖：后写覆盖先写，meta 读到最新', () => {
    const { storage, m } = memStorage()
    expect(readSaveMetaFrom(storage).kind).toBe('none')

    const s1 = startSession(OPTS, ALL_EVENTS)
    expect(saveSessionTo(s1, storage, 1727500000000).ok).toBe(true)
    const s2 = playYears(s1, 4)
    saveSessionTo(s2, storage, 1727500099999)
    const meta = readSaveMetaFrom(storage)
    expect(meta.kind).toBe('ok')
    if (meta.kind === 'ok') {
      expect(meta.meta.name).toBe(s2.state.name)
      expect(meta.meta.age).toBe(s2.state.age)
      expect(meta.meta.savedAt).toBe(1727500099999)
      // 第 19 轮：meta 携带已解锁成就列表（首页成就入口读取），缺失时为空数组
      expect(meta.meta.achievements).toEqual(s2.state.achievements)
    }
    expect(m.has(SAVE_KEY)).toBe(true)
  })

  it('存档缺成就字段时 meta.achievements 兜底为空数组（旧版本档兼容）', () => {
    const { storage } = memStorage()
    const s = startSession(OPTS, ALL_EVENTS)
    saveSessionTo(s, storage, 1727500000000)
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!)
    delete raw.state.achievements
    storage.setItem(SAVE_KEY, JSON.stringify(raw))
    const meta = readSaveMetaFrom(storage)
    expect(meta.kind).toBe('ok')
    if (meta.kind === 'ok') expect(meta.meta.achievements).toEqual([])
  })

  it('写入抛错返回失败原因（不静默丢进度）', () => {
    const { storage, fail } = memStorage()
    fail.set = true
    const r = saveSessionTo(startSession(OPTS, ALL_EVENTS), storage)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('quota')
  })

  it('读取抛错：load 返回失败原因、meta 标记存储不可用', () => {
    const { storage, fail } = memStorage()
    fail.get = true
    const r = loadSessionFrom(storage, ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('存储不可用')
    expect(readSaveMetaFrom(storage).kind).toBe('unavailable')
  })

  it('损坏档 meta：kind=corrupt 并保留原因；clearSaveFrom 可清除', () => {
    const { storage } = memStorage({ [SAVE_KEY]: 'broken...' })
    const meta = readSaveMetaFrom(storage)
    expect(meta.kind).toBe('corrupt')
    if (meta.kind === 'corrupt') expect(meta.reason).toContain('JSON')
    clearSaveFrom(storage)
    expect(readSaveMetaFrom(storage).kind).toBe('none')
  })
})

describe('第 21 轮：年度快照的存档兼容（v1→v2 迁移）', () => {
  /** 手造一份 v1 旧档：无 snapshots 字段、信封与状态版本均为 1 */
  function v1Save(session: Session): string {
    const obj = JSON.parse(JSON.stringify(serializeSession(session))) as Record<string, unknown>
    obj.saveVersion = 1
    const state = obj.state as Record<string, unknown>
    state.version = 1
    delete state.snapshots
    return JSON.stringify(obj)
  }

  it('v1 旧档迁移成功：补空快照数组（不伪造历史），状态升级后正常读入', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 5)
    const r = deserializeSave(v1Save(s), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.version).toBe(SAVE_VERSION)
    expect(r.session.state.snapshots).toEqual([])
    expect(validateState(r.session.state).issues).toEqual([])
    // 存档年之前的年数不该被补出来：空数组就是空数组
    expect(r.session.state.snapshots.length).toBe(0)
    expect(r.session.state.age).toBeGreaterThan(18)
  })

  it('迁移后的旧档继续游玩：从当前年的下一年度结算开始积累快照', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 5)
    const r = deserializeSave(v1Save(s), ALL_EVENTS)
    if (!r.ok) throw new Error(r.reason)
    const advanced = nextYear(chooseOption(r.session, 0), ALL_EVENTS)
    expect(advanced.state.snapshots).toHaveLength(1)
    expect(advanced.state.snapshots[0].age).toBe(r.session.state.age + 1)
    expect(advanced.state.snapshots[0].money).toBe(advanced.state.money)
    expect(validateState(advanced.state).issues).toEqual([])
  })

  it('v2 档缺 snapshots 被拒绝（存档的年度快照损坏）', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    delete (obj.state as Record<string, unknown>).snapshots
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('快照')
  })

  it('v2 档 snapshots 非数组被拒绝', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    ;(obj.state as Record<string, unknown>).snapshots = 'nope'
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('快照')
  })

  it('含快照的 v2 局 round-trip：快照逐条还原', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 6)
    expect(s.state.snapshots.length).toBeGreaterThanOrEqual(2)
    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.snapshots).toEqual(s.state.snapshots)
  })
})

describe('第 23 轮：房贷字段的存档兼容（版本仍为 2，可选字段缺省 = 无贷款）', () => {
  it('含房贷的 v2 局 round-trip：房贷结构逐字段还原', () => {
    const bought = playYears(startSession(OPTS, ALL_EVENTS), 2)
    if (bought.state.phase !== 'playing') throw new Error('夹具应处于进行中')
    bought.state.mortgage = { principal: 300000, balance: 290800, annualPayment: 23900, yearsLeft: 19 }
    const r = roundTrip(bought)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.mortgage).toEqual({
      principal: 300000,
      balance: 290800,
      annualPayment: 23900,
      yearsLeft: 19,
    })
    expect(validateState(r.session.state).issues).toEqual([])
  })

  it('旧 v2 档无 mortgage 字段：正常读入为无贷款，恢复后可继续跨年', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 4)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    delete (obj.state as Record<string, unknown>).mortgage
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.mortgage).toBeUndefined()
    const advanced = nextYear(r.session, ALL_EVENTS)
    expect(advanced.state.mortgage).toBeUndefined()
    expect(advanced.state.yearLog.some((l) => l.includes('房贷扣款'))).toBe(false)
  })

  it('损坏的 mortgage 结构被拒绝（状态校验未通过，原档保留）', () => {
    const s = startSession(OPTS, ALL_EVENTS)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    ;(obj.state as Record<string, unknown>).mortgage = { principal: 300000, balance: -5 }
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('房贷')
  })
})

describe('第 24 轮：生活方式风险值的存档兼容（版本仍为 2，可选字段缺省 = 0）', () => {
  it('含 healthRisk 的 v2 局 round-trip：风险值逐值还原', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 2)
    if (s.state.phase !== 'playing') throw new Error('夹具应处于进行中')
    s.state.healthRisk = 37.5
    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.healthRisk).toBe(37.5)
    expect(validateState(r.session.state).issues).toEqual([])
  })

  it('旧 v2 档无 healthRisk 字段：读入为 0 缺省，恢复后跨年按标记正常累积', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    delete (obj.state as Record<string, unknown>).healthRisk
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error(r.reason)
    expect(r.session.state.healthRisk).toBeUndefined()
    const legacy = { ...r.session.state, tags: [...r.session.state.tags, 'light_smoker'] }
    const advanced = nextYear({ ...r.session, state: legacy, awaitingAdvance: true }, ALL_EVENTS)
    expect(advanced.state.healthRisk).toBeGreaterThan(0)
  })
})

describe('第 26 轮：子女生命阶段字段的存档兼容（版本仍为 2，Relation 可选字段）', () => {
  it('含出生年龄与里程碑的孩子 round-trip：逐字段还原', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 2)
    if (s.state.phase !== 'playing') throw new Error('夹具应处于进行中')
    s.state.relations = [
      ...s.state.relations,
      { id: 'c_round26', kind: 'child', name: '宝宝', closeness: 65, alive: true, birthAge: 18, milestones: ['ms_junior', 'ms_senior'] },
    ]
    const r = roundTrip(s)
    if (!r.ok) throw new Error(r.reason)
    const c = r.session.state.relations.find((x) => x.id === 'c_round26')
    expect(c).toMatchObject({ birthAge: 18, milestones: ['ms_junior', 'ms_senior'] })
    expect(validateState(r.session.state).issues).toEqual([])
  })

  it('旧档孩子（无 birthAge/milestones）：正常读入，跨年不炸、无里程碑副作用', () => {
    const s = playYears(startSession(OPTS, ALL_EVENTS), 3)
    const obj = JSON.parse(JSON.stringify(serializeSession(s))) as Record<string, unknown>
    const legacyRel = { id: 'c_old', kind: 'child', name: '宝宝', closeness: 60, alive: true }
    ;(obj.state as { relations: unknown[] }).relations = [
      ...(obj.state as { relations: unknown[] }).relations,
      legacyRel,
    ]
    const r = deserializeSave(JSON.stringify(obj), ALL_EVENTS)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error(r.reason)
    const c = r.session.state.relations.find((x) => x.id === 'c_old')
    expect(c?.birthAge).toBeUndefined()
    expect(c?.milestones).toBeUndefined()
    const advanced = nextYear({ ...r.session, awaitingAdvance: true }, ALL_EVENTS)
    expect(advanced.state.relations.find((x) => x.id === 'c_old')).toBeDefined()
    expect(validateState(advanced.state).issues).toEqual([])
  })
})
