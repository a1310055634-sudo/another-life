// 第 33 轮（动效 I）：结算面板金钱变化数字滚动（count-up）。
// 不引库：rAF + setState 实现滚动。初始渲染直出终值——静态渲染、无 JS、
// reduced-motion 与动画结束帧都必须与结算值完全一致（不遮挡数据）。
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** 滚动时长（ms）。与 index.css 的 --dur-slow 对齐（round33 测试做同源断言）。 */
export const COUNT_UP_MS = 320

/** easeOutCubic：与 --ease-out 观感近似的 JS 侧缓动（0→1 单调）。 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** t 时刻应显示的值：金额恒为整数，中间帧四舍五入；
    t>=1 时精确返回 to——"动画结束值与最终结算值完全一致"的机制保证。 */
export function countFrame(from: number, to: number, t: number): number {
  if (t >= 1) return to
  if (t <= 0) return from
  return Math.round(from + (to - from) * easeOutCubic(t))
}

/** 系统"减少动态效果"开启（或环境无法探测）时不做动画，直接显示终值。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

// 浏览器用 useLayoutEffect（paint 前落起点，避免终值→0 的一帧闪烁）；
// node/SSR 环境退回 useEffect（useLayoutEffect 在服务器不执行且会告警）。
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const rafRef = useRef<number | null>(null)

  useIsoLayoutEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setShown(value)
      return
    }
    setShown(0) // delta 是变化量：从 0 滚到终值
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / COUNT_UP_MS
      setShown(countFrame(0, value, t))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value])

  return <span>{format(shown)}</span>
}
