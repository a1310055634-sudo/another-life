// 第 107 轮：开局抽签仪式（呈现层，不进引擎）。
//
// 架构红线（任务书 §设计决策 2）：抽签**只是 UI 层选组合**。本组件的唯一输出是
// 一次 `onPick(backgroundId, traitId)` 回调；CreationPage 收到后回填到既有的
// bgId / traitId 两个 state——开局仍走既有 `onStart(name, bgId, traitId)` →
// `startSession` 流程，**引擎签名一字不改**，故 18 局零位移天然成立。
//
// 随机来源刻意**不用主 rng，也不用 seed**（§8 随机支流纪律）：抽签发生在开局之前、
// 且「抽签 vs 自选」对玩家完全等价，因此用时间熵（Math.random）即可——它只决定
// 展示哪一组，不参与任何引擎推演，故不进确定性基线的对照口径。
//
// 揭示文案**只读** backgrounds.ts / traits.ts 的现有字段（数据源单一），
// 不在此处另写机制描述。pros/cons 与数值**全程不出现**（只给 desc 的第一个分句作
// 半句悬念，揭示后才给全貌），避免抽签变成「数值最优解提示」。
import { useEffect, useRef, useState } from 'react'
import { BACKGROUNDS } from '../data/backgrounds'
import { TRAITS } from '../data/traits'

export interface FortunePair {
  bgId: string
  traitId: string
}

interface Props {
  /** 抽中后由 CreationPage 回填到自选表单（机制等价的关键） */
  onPick: (bgId: string, traitId: string) => void
  /** 当前表单已选中的组合（提示行显示「表单此刻是什么」） */
  current: FortunePair
}

/** 悬念半句：取 desc 的第一个分句——只给气质不给数值 */
function suspenseOf(desc: string | undefined): string {
  if (!desc) return ''
  return desc.split(/[，。]/)[0]
}

/**
 * 抽一签：背景与天赋各自独立等概率（4 × 6 = 24 种组合等概率）。
 * 不做去重偏置、不做权重——仪式要的是「命运」，不是「平衡」。
 */
export function drawFortune(): FortunePair {
  const bg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
  const tr = TRAITS[Math.floor(Math.random() * TRAITS.length)]
  return { bgId: bg.id, traitId: tr.id }
}

/** 翻转动画时长（ms）——与 CSS 的 flip 时长保持一致，改一处须改两处 */
export const REVEAL_MS = 620

type Phase = 'idle' | 'drawing' | 'revealed'

export function FortuneDraw({ onPick, current }: Props): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle')
  const [pair, setPair] = useState<FortunePair | null>(null)

  // 键盘可达：揭示完成后焦点落到「这就是我的起点」，纯键盘也能走完整条路径
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (phase === 'revealed') confirmRef.current?.focus()
  }, [phase])

  // 组件卸载后不得再 setState（抽签途中离开创建页的情形）
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  const handleDraw = () => {
    const p = drawFortune()
    setPair(p)
    setPhase('drawing')
    // reduced-motion 下动画被关，但定时器照走、状态照样落到 revealed——
    // **动效降级不得改变功能时序**（与项目既有 reduced-motion 约定一致）
    window.setTimeout(() => {
      if (aliveRef.current) setPhase('revealed')
    }, REVEAL_MS)
  }

  const bg = pair ? BACKGROUNDS.find((b) => b.id === pair.bgId) ?? null : null
  const tr = pair ? TRAITS.find((t) => t.id === pair.traitId) ?? null : null
  const revealed = phase === 'revealed'

  const reset = () => {
    setPhase('idle')
    setPair(null)
  }

  return (
    <section className="fortune" aria-label="开局抽签">
      <h2 className="section-title">或者，让命运替你选</h2>
      <p className="fortune-note">
        抽签与自选同等有效——抽中的组合会填进上面的表单，开局待遇完全一样，你也可以随时改回来。
      </p>

      <div className="fortune-stage">
        {pair === null ? (
          <button type="button" className="btn btn-ghost fortune-draw-btn" onClick={handleDraw}>
            抽一签
          </button>
        ) : (
          <div
            className={revealed ? 'fortune-card fortune-card-shown' : 'fortune-card'}
            aria-live="polite"
          >
            <div className="fortune-line fortune-bg">
              <span className="fortune-kicker">你出生在</span>
              {revealed ? (
                <>
                  <span className="fortune-name">{bg?.name}</span>
                  <span className="fortune-desc">{bg?.desc}</span>
                </>
              ) : (
                <span className="fortune-suspense">{suspenseOf(bg?.desc)}……</span>
              )}
            </div>
            <div className="fortune-line fortune-trait">
              <span className="fortune-kicker">你天生</span>
              {revealed ? (
                <>
                  <span className="fortune-name">{tr?.name}</span>
                  <span className="fortune-desc">{tr?.desc}</span>
                </>
              ) : (
                <span className="fortune-suspense">{suspenseOf(tr?.desc)}……</span>
              )}
            </div>
          </div>
        )}
      </div>

      {pair !== null && (
        <div className="fortune-actions">
          {revealed && (
            <button
              ref={confirmRef}
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onPick(pair.bgId, pair.traitId)
                reset()
              }}
            >
              这就是我的起点
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleDraw}>
            {revealed ? '再抽一次' : '重新抽'}
          </button>
          <span className="fortune-hint">
            表单此刻：{BACKGROUNDS.find((b) => b.id === current.bgId)?.name} ·{' '}
            {TRAITS.find((t) => t.id === current.traitId)?.name}
          </span>
        </div>
      )}
    </section>
  )
}