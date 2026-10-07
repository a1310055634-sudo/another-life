// 第 56 轮：首局开场引导（呈现层，不进引擎）。
// 三步浮层：五维属性 → 做选择 → 跨年；一次性（完成或跳过即写独立键
// another-life:tutorial = done），之后不再出现；纯覆盖层（fixed + aria-modal），
// 不阻塞引擎任何逻辑——引导期间游戏状态照常，关闭后即正常游玩。
// 环境无 localStorage（SSR/测试注入前）时视为已完成——绝不阻塞渲染。
import { useEffect, useRef, useState } from 'react'

const TUTORIAL_KEY = 'another-life:tutorial'

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'done'
  } catch {
    return true
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'done')
  } catch {
    // 存储不可用：本次会话内引导仍可走完，记忆不持久化
  }
}

interface TutorialStep {
  title: string
  body: string
}

/** 引导文案（三步） */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '先认识五个数字',
    body: '健康与幸福是底色，能力帮你打开门，人际决定路上有谁，压力太大会压垮前两样。它们每年都会变，没有标准答案——别让任何一项长期见底。',
  },
  {
    title: '每年，做一个选择',
    body: '生活里会不断出现事件卡——每个选项都即时结算，代价与收获写在卡上。看清楚再选：钱能再挣，身体和人心伤了恢复得慢。',
  },
  {
    title: '选完，就翻过一年',
    body: '「进入下一年」会结算收支、推进年龄，并在履历里留下一笔。一局约 15～25 分钟，走到终点时，你会得到一份属于自己的人生报告。',
  },
]

/** 首局开场引导浮层（GamePage 顶部挂载；done 时不渲染） */
export function Tutorial(): React.JSX.Element | null {
  const [step, setStep] = useState(0)
  const [closed, setClosed] = useState(tutorialDone)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const finishRef = useRef<() => void>(() => {})

  // 第 74 轮：锁滚动 / 焦点陷阱 / Esc 跳过——浮层存活期间一个 effect 全包，
  // 卸载（完成/跳过）时恢复 body 滚动并把焦点归还给打开引导的触发元素。
  // hooks 顺序纪律：effect 必须在提前 return 之前，闭场守卫放进 effect 体内。
  useEffect(() => {
    if (closed) return
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    overlayRef.current?.querySelector<HTMLElement>('.tutorial-actions button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finishRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = [
        ...(overlayRef.current?.querySelectorAll<HTMLElement>('.tutorial-actions button') ?? []),
      ]
      if (focusables.length === 0) return
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      const active = document.activeElement
      if (!overlayRef.current?.contains(active)) {
        e.preventDefault()
        firstEl.focus()
      } else if (e.shiftKey && active === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      returnFocusRef.current?.focus()
    }
  }, [closed])

  if (closed) return null
  const s = TUTORIAL_STEPS[step]
  const finish = () => {
    markTutorialDone()
    setClosed(true)
  }
  finishRef.current = finish


  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label="新玩家引导" ref={overlayRef}>
      <div className="tutorial-card card">
        <p className="tutorial-step" aria-live="polite">
          第 {step + 1} 步 · 共 {TUTORIAL_STEPS.length} 步
        </p>
        <h3 className="tutorial-title">{s.title}</h3>
        <p className="tutorial-body">{s.body}</p>
        <div className="tutorial-actions">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setStep(step - 1)}
            >
              上一步
            </button>
          )}
          {step < TUTORIAL_STEPS.length - 1 ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={finish}>
                跳过引导
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setStep(step + 1)}
              >
                下一步
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={finish}>
              开始我的人生
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
