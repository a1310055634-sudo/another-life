import type { AttrKey } from '../engine/types'
import { ATTR_LABELS } from '../engine/attrs'

/** 数字带符号（+12 / -9,000） */
export function fmtSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString('zh-CN')}` : n.toLocaleString('zh-CN')
}

/** 金额展示：¥12,000 / -¥9,000 */
export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}¥${Math.abs(n).toLocaleString('zh-CN')}`
}

const BAR_COLORS: Record<AttrKey, string> = {
  health: 'var(--c-health)',
  happiness: 'var(--c-happiness)',
  smarts: 'var(--c-smarts)',
  social: 'var(--c-social)',
  stress: 'var(--c-stress)',
}

export function AttrBar({ k, value }: { k: AttrKey; value: number }) {
  return (
    <div className="attr" title={`${ATTR_LABELS[k]} ${value}/100`}>
      <span className="attr-label">{ATTR_LABELS[k]}</span>
      <div className="attr-track">
        <div className="attr-fill" style={{ width: `${value}%`, background: BAR_COLORS[k] }} />
      </div>
      <span className="attr-value">{value}</span>
    </div>
  )
}

export { ATTR_LABELS }
