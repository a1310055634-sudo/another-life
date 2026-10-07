// 第 97 轮（V5）：重大时刻全屏演出——渐显大字卡（1.6s）。
// 纯展示组件：数据来自 milestonesAtAge（存档展示字段，引擎只读）。
// reduced-motion：不渲染大字卡（信息已在年志/履历，压平即不额外呈现）。
// 同年合并 ≤2：milestonesAtAge 已截取。
import { useEffect, useState } from 'react'
import type { Milestone } from './milestones'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function MilestoneOverlay({ milestones }: { milestones: Milestone[] }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (milestones.length === 0 || prefersReducedMotion()) return
    const t = window.setTimeout(() => setShown(true), 50)
    return () => window.clearTimeout(t)
  }, [milestones])

  if (milestones.length === 0 || prefersReducedMotion()) return null

  return (
    <div className="moment-overlay" aria-hidden="true">
      {milestones.map((m) => (
        <div key={m.kind} className={`moment-card${shown ? ' moment-card-shown' : ''}`}>
          <span className="moment-age">{m.age} 岁</span>
          <span className="moment-label">{m.label}</span>
          <span className="moment-sentence">{m.sentence}</span>
        </div>
      ))}
    </div>
  )
}
