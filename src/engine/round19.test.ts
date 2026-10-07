// 第 19 轮：事件重复、选择门槛和交互打磨
// 三组规则在本文件锁定：
// A. 普通事件须 ≥2 个可结算选项才入卡（isEventAvailable），强制剧情单选走
//    singleChoiceOk 白名单（全池清点 + 逐项理由）；
// B. 重复事件清点的决定：点名的一次性事件 once、健身房传单改为"办卡→续卡"阶段剧；
// C. 门槛的玩家语言说明（conditionFailReason/choiceGateReason）与可见性判定镜像一致。
import type { GameState } from './types'
import { ALL_EVENTS } from '../data/events'
import { createNewGame } from './init'
import {
  applyChoice,
  checkCondition,
  choiceGateReason,
  conditionFailReason,
  isEventAvailable,
  visibleChoices,
} from './events'
import { chooseOption, nextYear, startSession } from './session'
import { getJob } from '../data/careers'

function makeGame(seed = 42, patch: Partial<GameState> = {}): GameState {
  const base = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'laid_back', name: '测试者' })
  return { ...base, ...patch }
}

const OK_ATTRS = { health: 60, happiness: 60, smarts: 60, social: 60, stress: 30 }

function byId(id: string) {
  const ev = ALL_EVENTS.find((e) => e.id === id)
  if (!ev) throw new Error(`事件不存在：${id}`)
  return ev
}

// ── A. ≥2 有效选项规则 ───────────────────────────────────────

describe('第 19 轮：普通事件须 ≥2 个有效选项才入卡', () => {
  it('只剩一个可见选项的普通事件不可用（穷本科生只剩"放弃留学"）', () => {
    const s = makeGame(3, { age: 24, education: 'bachelor', career: { kind: 'none' }, money: 5000 })
    const ev = byId('youth_study_abroad')
    expect(visibleChoices(s, ev)).toHaveLength(1)
    expect(isEventAvailable(s, ev)).toBe(false)
  })

  it('两个及以上可见选项时照常可用', () => {
    const s = makeGame(3, { age: 24, education: 'bachelor', career: { kind: 'none' }, money: 100000 })
    expect(visibleChoices(s, byId('youth_study_abroad')).length).toBeGreaterThanOrEqual(2)
    expect(isEventAvailable(s, byId('youth_study_abroad'))).toBe(true)
  })

  it('强制剧情例外：最后通牒在待业+负债下只剩一个选项，仍可触发', () => {
    const ev = byId('hlt_body_intensive')
    const s = makeGame(9, {
      age: 40,
      attrs: { health: 15, happiness: 40, smarts: 50, social: 50, stress: 30 },
      money: -30000,
      career: { kind: 'none' },
    })
    // 住院（大额）被负债门槛隐藏、长病假（在职专属）被职业门槛隐藏
    expect(visibleChoices(s, ev)).toHaveLength(1)
    expect(isEventAvailable(s, ev)).toBe(true)
  })

  it('单选例外白名单全池清点：恰为 hlt_body_intensive（强制剧情逐项审阅）', () => {
    const marked = ALL_EVENTS.filter((e) => e.singleChoiceOk === true).map((e) => e.id)
    // 理由：健康 ≤20 是低健康预警年志指向的强制干预剧情，待业+负债的
    // 最脆弱玩家恰恰最需要这个免费"换一种活法"出口（见 health.ts 数据侧注释）
    expect(marked).toEqual(['hlt_body_intensive'])
  })

  it('真实抽取行为级验收：3 开局 × 2 seed 全生涯，每张事件卡 ≥2 有效选项（例外除外）且都能走到终局', () => {
    const starts: Array<[string, string]> = [
      ['rural', 'ambitious'],
      ['ordinary', 'bookworm'],
      ['wealthy', 'frugal'],
    ]
    for (const [bg, trait] of starts) {
      for (const seed of [20260928, 777]) {
        let session = startSession({ seed, backgroundId: bg, traitId: trait, name: '模拟者' }, ALL_EVENTS)
        let guard = 0
        // 每年最多消耗两步（一次选择 + 一次跨年），60 年上限留足余量
        while (session.state.phase === 'playing' && guard < 140) {
          guard++
          const ev = session.currentEvent
          // 只在"待选择"阶段校验事件卡（结算阶段 currentEvent 仍挂着但已选定，
          // 状态已按所选选项变化，不构成新的事件卡）
          if (ev && !session.awaitingAdvance) {
            const vis = visibleChoices(session.state, ev)
            const ok = vis.length >= 2 || (vis.length >= 1 && ev.singleChoiceOk === true)
            expect(
              ok,
              `${seed}/${bg}/${trait} ${session.state.age} 岁抽到「${ev.title}」只有 ${vis.length} 个有效选项`,
            ).toBe(true)
          }
          if (session.awaitingAdvance) {
            session = nextYear(session, ALL_EVENTS)
          } else if (session.currentEvent) {
            const vis = visibleChoices(session.state, session.currentEvent)
            if (vis.length === 0) {
              session = nextYear(session, ALL_EVENTS)
            } else {
              const pick = vis[guard % vis.length]
              session = chooseOption(session, session.currentEvent.choices.indexOf(pick))
            }
          } else {
            session = nextYear(session, ALL_EVENTS)
          }
        }
        expect(session.state.phase, `${seed}/${bg}/${trait} 应能走完一生`).toBe('ended')
      }
    }
  })
})

// ── B. 重复事件清点 ──────────────────────────────────────────

describe('第 19 轮：一次性事件决定（人物/时间线唯一的故事）', () => {
  const ONCE_DECISIONS: Array<[string, string]> = [
    ['youth_old_friend_wedding', '高中同桌只有一场婚礼'],
    ['fin_side_hustle', '同一个群里晒同一种流水的场景不重播'],
    ['fin_relative_borrow', '同一位堂哥借同一笔三万'],
    ['youth_first_salary_splurge', '"第一笔"奖金只有一次'],
    ['youth_first_project', '"第一次"牵头只有一次'],
    ['mid_promotion_race', '同一个坑位同一位老搭档'],
    ['youth_gym_card', '同一家新开健身房的同一张传单'],
  ]
  for (const [id, why] of ONCE_DECISIONS) {
    it(`${id} 为一次性事件（${why}）`, () => {
      expect(byId(id).once).toBe(true)
    })
  }

  it('行为级：请柬参加过一次后不再触发', () => {
    const ev = byId('youth_old_friend_wedding')
    const s = makeGame(7, { age: 25 })
    expect(isEventAvailable(s, ev)).toBe(true)
    const applied = applyChoice(s, ev, 0).state
    expect(isEventAvailable(applied, ev)).toBe(false)
  })

  it('楼道里的猫：已收养者（pet_owner）不再触发；未收养者遇"另一只"仍可复现', () => {
    const ev = byId('youth_pet_stray')
    expect(isEventAvailable(makeGame(7, { age: 20, tags: ['pet_owner'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 20 }), ev)).toBe(true)
  })
})

describe('第 19 轮：阶段性复现——健身房续卡链', () => {
  const renew = byId('youth_gym_renew')

  it('续卡事件只对办过卡的人触发（读 gym_committed/gym_wasted 标记）', () => {
    expect(isEventAvailable(makeGame(7, { age: 22 }), renew)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 22, tags: ['gym_declined'] }), renew)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 22, tags: ['gym_committed'] }), renew)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 22, tags: ['gym_wasted'] }), renew)).toBe(true)
  })

  it('坚持者看到"续上/转免费"两条路；吃灰者看到"再给一次机会/转免费"（各 ≥2）', () => {
    const committed = visibleChoices(makeGame(7, { age: 22, money: 50000, tags: ['gym_committed'] }), renew)
    expect(committed).toHaveLength(2)
    expect(committed.some((c) => c.text.startsWith('续上'))).toBe(true)
    const wasted = visibleChoices(makeGame(7, { age: 22, money: 50000, tags: ['gym_wasted'] }), renew)
    expect(wasted).toHaveLength(2)
    expect(wasted.some((c) => c.text.includes('再给自己一次机会'))).toBe(true)
  })

  it('行为级连续剧情：吃灰年卡 → 再给一次机会 → 标记转为坚持、续费落账', () => {
    let s = makeGame(7, { age: 20, money: 10000 })
    s = applyChoice(s, byId('youth_gym_card'), 1).state // 办年卡，去了三次
    expect(s.tags).toContain('gym_wasted')
    expect(isEventAvailable(s, renew)).toBe(true)
    s = applyChoice(s, renew, 1).state // 再给自己一次机会（原始索引 1）
    expect(s.money).toBe(10000 - 3000 - 2200) // 办卡 -3000、续卡 -2200
    expect(s.tags).toContain('gym_committed')
    expect(s.tags).not.toContain('gym_wasted')
    // 冷却期过后，坚持分支可用（剧情已推进到"练出来了"）
    const later = { ...s, age: 25 }
    expect(visibleChoices(later, renew).some((c) => c.text.startsWith('续上'))).toBe(true)
  })

  it('转免费路线后标记清除，续卡链终止', () => {
    let s = makeGame(7, { age: 22, money: 50000, tags: ['gym_committed'] })
    s = applyChoice(s, renew, 2).state // 不续了，公园夜跑（原始索引 2）
    expect(s.tags).toContain('gym_declined')
    expect(s.tags).not.toContain('gym_committed')
    expect(isEventAvailable({ ...s, age: 30 }, renew)).toBe(false)
  })
})

// ── seenEvents 语义定夺（第 18 轮移交观察）───────────────────

describe('第 19 轮：seenEvents 语义 = 经历过（非抽到过）', () => {
  it('只有 applyChoice（经历）才写入 seenEvents；once 判定读的是它', () => {
    const ev = byId('youth_old_friend_wedding')
    const s = makeGame(11, { age: 25 })
    // 事件被抽中/出现在候选里都不改变 seenEvents
    expect(s.seenEvents).not.toContain(ev.id)
    expect(isEventAvailable(s, ev)).toBe(true)
    const applied = applyChoice(s, ev, 0).state
    expect(applied.seenEvents).toContain(ev.id)
    expect(isEventAvailable(applied, ev)).toBe(false)
  })
  // 定夺：跨版本"跳过这一年"恢复路径中玩家从未见过事件内容，once 事件此后
  // 再次抽中不构成剧情矛盾——保持"经历过"语义，不改为"抽到过"。
})

// ── C. 门槛的玩家语言说明 ────────────────────────────────────

describe('第 19 轮：门槛说明（choiceGateReason）', () => {
  it('金钱门槛：留学全额自费要 10 万存款', () => {
    const s = makeGame(3, { age: 24, education: 'bachelor', career: { kind: 'none' }, money: 5000 })
    expect(choiceGateReason(s, byId('youth_study_abroad').choices[0])).toBe(
      '需要至少10万存款（现在 5,000 元）',
    )
  })

  it('负债大额消费：办年卡被挡并解释原因', () => {
    const s = makeGame(3, { age: 20, money: -25700, attrs: { ...OK_ATTRS } })
    expect(choiceGateReason(s, byId('youth_gym_card').choices[0])).toBe('眼下还在负债，先别背上大额开销')
  })

  it('属性门槛带当前值', () => {
    const s = makeGame(3, { age: 25, attrs: { health: 60, happiness: 60, smarts: 60, social: 40, stress: 60 } })
    expect(choiceGateReason(s, byId('youth_resign_impulse').choices[2])).toBe('需要人际 ≥ 55（当前 40）')
  })

  it('技能门槛带当前值', () => {
    const s = makeGame(3, {
      age: 22,
      education: 'college',
      skills: { academics: 40, vocational: 10 },
    })
    expect(choiceGateReason(s, byId('youth_college_jobfair').choices[2])).toBe('需要技能 ≥ 25（当前 10）')
  })

  it('学历门槛', () => {
    const s = makeGame(3, {
      age: 35,
      education: 'highschool',
      career: { kind: 'employed', jobId: 'office_clerk', jobTitle: '行政文员', level: 1, salary: 44000, yearsAtJob: 2 },
      skills: { academics: 70, vocational: 70 },
    })
    expect(choiceGateReason(s, byId('mid_industry_shift').choices[0])).toBe('需要学历：本科/硕士/博士')
  })

  it('职业状态门槛（病假选项在职专属）', () => {
    const s = makeGame(3, { age: 40, career: { kind: 'none' } })
    expect(choiceGateReason(s, byId('hlt_body_intensive').choices[1])).toBe('需要在职')
  })

  it('晋升到头的岗位看到解释而非静默无效', () => {
    const s = makeGame(3, {
      age: 40,
      career: { kind: 'employed', jobId: 'stall_vendor', jobTitle: '市集摊主', level: 3, salary: 40000, yearsAtJob: 4 },
      skills: { academics: 60, vocational: 60 },
    })
    expect(getJob('stall_vendor')?.maxLevel).toBe(3)
    expect(choiceGateReason(s, byId('car_promotion_push').choices[0])) // 管理线晋升选项
      .toBe('这个岗位的职级已经到头，晋升不再是当下的选项')
  })

  it('标记门槛翻译成玩家语言，不暴露 tag ID', () => {
    const s = makeGame(3, { age: 20, tags: [] })
    expect(choiceGateReason(s, byId('youth_night_stall').choices[3])).toBe('需要敢闯敢赌的性格')
  })

  it('关系门槛与亲密度门槛', () => {
    const s = makeGame(3, { age: 28, relations: [] })
    expect(choiceGateReason(s, byId('rel_quarrel_coldwar').choices[2])).toBe('需要朋友还在身边')
  })

  it('镜像一致性：全池每个选项在多组典型状态下，"有原因"与"不可见"判定完全一致', () => {
    const clerk = getJob('office_clerk')!
    const states: GameState[] = [
      makeGame(1), // 18 岁穷开局
      makeGame(2, {
        age: 35,
        money: -50000,
        career: { kind: 'employed', jobId: 'office_clerk', jobTitle: clerk.title, level: 1, salary: 44000, yearsAtJob: 3 },
        skills: { academics: 20, vocational: 10 },
        attrs: { health: 45, happiness: 35, smarts: 50, social: 40, stress: 70 },
      }),
      makeGame(3, {
        age: 34,
        money: 500000,
        education: 'bachelor',
        tags: ['married', 'has_child'],
        relations: [
          { id: 'r1', kind: 'spouse', name: '爱人', closeness: 75, alive: true },
          { id: 'r2', kind: 'child', name: '宝宝', closeness: 65, alive: true },
          { id: 'r3', kind: 'parent', name: '母亲', closeness: 60, alive: true },
        ],
      }),
      makeGame(4, {
        age: 20,
        education: 'highschool',
        career: { kind: 'student', stage: 'college', yearsLeft: 2 },
        skills: { academics: 45, vocational: 20 },
      }),
      makeGame(5, {
        age: 70,
        career: { kind: 'retired', pension: 24000 },
        tags: ['retired', 'chronic_pain', 'homeowner'],
        attrs: { health: 40, happiness: 55, smarts: 50, social: 45, stress: 15 },
      }),
      makeGame(6, {
        age: 45,
        career: { kind: 'employed', jobId: 'stall_vendor', jobTitle: '市集摊主', level: 3, salary: 36000, yearsAtJob: 8 },
        skills: { academics: 10, vocational: 15 },
        tags: ['job_stall_vendor', 'ever_employed'],
      }),
      makeGame(7, {
        age: 30,
        career: { kind: 'unemployed', weeks: 60 },
        tags: ['ex_nurse', 'estranged_friend', 'job_hunting'],
        skills: { academics: 30, vocational: 50 },
      }),
      makeGame(8, {
        age: 52,
        money: 30000,
        career: { kind: 'none' },
        education: 'college',
        attrs: { health: 55, happiness: 50, smarts: 55, social: 55, stress: 40 },
      }),
    ]
    let checked = 0
    for (const ev of ALL_EVENTS) {
      for (const c of ev.choices) {
        for (const s of states) {
          const usable = visibleChoices(s, ev).includes(c)
          expect(
            choiceGateReason(s, c) === null,
            `${ev.id}「${c.text}」在状态 ${s.seed}/${s.age} 岁的说明与可见性不一致`,
          ).toBe(usable)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it('conditionFailReason 与 checkCondition 逐条镜像（同一批状态 × 全池事件条件）', () => {
    const states: GameState[] = [
      makeGame(1),
      makeGame(3, { age: 34, money: 500000, tags: ['married', 'has_child'], education: 'bachelor' }),
      makeGame(5, { age: 70, tags: ['retired', 'chronic_pain', 'light_smoker', 'memoir'] }),
      makeGame(7, { age: 30, career: { kind: 'unemployed', weeks: 10 }, tags: ['ex_nurse', 'gaokao_failed'] }),
    ]
    for (const ev of ALL_EVENTS) {
      for (const s of states) {
        expect(
          conditionFailReason(s, ev.requires) === null,
          `${ev.id} 条件说明与判定不一致（${s.age} 岁）`,
        ).toBe(checkCondition(s, ev.requires))
      }
    }
  })
})
