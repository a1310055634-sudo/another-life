// 第 63 轮：教育纵深测试（在职深造链：备考→录取→兑现）
// 验收口径（PROMPT-V4.md 第 63 轮）：
// - 链路正反：备考须在职+达标学历；录取须备考标记+本科；兑现须硕士/博士毕业标记+在职
// - 收入机制锁定：computeSalary 学历溢价存在性（每超岗位门槛一级 +5%，careers.ts）
//   与兑现事件 salaryMul 1.06 的一次性调薪落账——引擎不做第二套收入公式
import { describe, it, expect } from 'vitest'
import { createNewGame } from './init'
import { applyChoice, isEventAvailable, visibleChoices } from './events'
import { validateEvents } from './validateEvents'
import { ALL_EVENTS } from '../data/events'
import { getJob, computeSalary } from '../data/careers'
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

const CLERK = getJob('office_clerk')!
const CLERK_MAX = CLERK.maxLevel ?? 3

const employedAt = (level = 1, salary = 60000): GameState['career'] => ({
  kind: 'employed', jobId: 'office_clerk', jobTitle: CLERK.titles?.[0] ?? CLERK.title,
  level, salary, yearsAtJob: 2, salaryMul: 1,
})

describe('第 63 轮：在职深造链', () => {
  it('edu_exam_prep 正反：在职达标学历可用；学生/退休/已备考不可用', () => {
    const ev = byId('edu_exam_prep')
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: employedAt() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'college', career: employedAt() }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'highschool', career: employedAt() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: { kind: 'student', stage: 'master', yearsLeft: 1 } }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: { kind: 'retired', pension: 20000 } }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: employedAt(), tags: ['exam_prep'] }), ev)).toBe(false)
  })

  it('edu_admit_master 正反：备考+本科可用；无备考/硕士学历不可用；录取落学生身份并清备考标记', () => {
    const ev = byId('edu_admit_master')
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: employedAt(), tags: ['exam_prep'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'bachelor', career: employedAt() }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 30, education: 'master', career: employedAt(), tags: ['exam_prep'] }), ev)).toBe(false)
    const s = makeGame(7, { age: 30, education: 'bachelor', career: employedAt(), tags: ['exam_prep'] })
    const after = applyChoice(s, ev, 0).state
    expect(after.career).toMatchObject({ kind: 'student', stage: 'master' })
    expect(after.tags).not.toContain('exam_prep')
    expect(after.tags).toContain('grad_school')
  })

  it('edu_degree_payoff 正反：毕业标记+在职可用；无业/无标记不可用；职级满时晋升项隐藏仍保 ≥2 选项', () => {
    const ev = byId('edu_degree_payoff')
    expect(isEventAvailable(makeGame(7, { age: 35, education: 'master', career: employedAt(), tags: ['graduated_master'] }), ev)).toBe(true)
    expect(isEventAvailable(makeGame(7, { age: 35, education: 'master', career: { kind: 'none' }, tags: ['graduated_master'] }), ev)).toBe(false)
    expect(isEventAvailable(makeGame(7, { age: 35, education: 'master', career: employedAt() }), ev)).toBe(false)
    const top = makeGame(7, { age: 35, education: 'master', career: employedAt(CLERK_MAX), tags: ['graduated_master'] })
    const vis = visibleChoices(top, ev)
    expect(vis.length).toBe(2)
    expect(vis.some((c) => c.text.includes('晋升答辩'))).toBe(false)
  })

  it('收入机制锁定：computeSalary 学历溢价存在（master > bachelor 同岗同参）；兑现 salaryMul 1.06 按公式重推', () => {
    const salB = computeSalary('bachelor', 35, CLERK, 1, 2, 1)
    const salM = computeSalary('master', 35, CLERK, 1, 2, 1)
    expect(salM).toBeGreaterThan(salB) // office_clerk minEducation=college：master 高一级溢价
    const s = makeGame(7, {
      age: 35, education: 'master', workYears: 2,
      career: employedAt(1, computeSalary('master', 35, CLERK, 1, 2, 1)),
      tags: ['graduated_master'],
    })
    const ev = byId('edu_degree_payoff')
    expect(isEventAvailable(s, ev)).toBe(true)
    const after = applyChoice(s, ev, 0).state // 选项 0=拿新学历谈加薪
    expect(after.career.kind === 'employed' && after.career.salaryMul).toBeCloseTo(1.06)
    expect(after.career.kind === 'employed' && after.career.salary).toBe(computeSalary('master', 35, CLERK, 1, 2, 1.06))
  })

  it('validateEvents 全池零 issue；全池 204、education.ts 文件计数 6→9（edu_ 前缀）', () => {
    expect(validateEvents(ALL_EVENTS)).toEqual([])
    expect(ALL_EVENTS).toHaveLength(349)
    expect(ALL_EVENTS.filter((e) => e.id.startsWith('edu_'))).toHaveLength(9)
  })
})
