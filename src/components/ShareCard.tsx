// 第 54 轮：人生报告分享卡——canvas 原生绘制 1080×1440 PNG（呈现层，零新依赖）。
// 数据组装（buildShareCardData）为纯函数可单测；绘制（drawShareCard）全部 canvas 2D
// 原生 API——无外部图片（无 canvas 污染，toDataURL 永不抛污染异常）、无外部字体
// （系统字体栈）。下载走 toDataURL + a[download]（file:// 与 http 均可用）。
import type { GameState } from '../engine/types'
import { judgeEnding } from '../engine/outcomes'
import { buildReportStats, pickKeyQuote } from './LifeReport'
import { ATTR_KEYS, ATTR_LABELS } from '../engine/attrs'
import { buildEndingEpilogue } from '../engine/epilogues'
import { readLegacy } from '../legacy'

export interface ShareCardData {
  name: string
  endingName: string
  grade: string
  /** 终龄 */
  age: number
  /** 峰值资产（元，可为负） */
  peakMoney: number
  /** 峰值资产展示文本（亿/万缩写） */
  peakMoneyText: string
  /** 成就枚数 */
  achievementsCount: number
  /** 金句（关键抉择金句优先，缺省退后记首句，再缺省空串——空串不画引用区） */
  quote: string
  /** 五维终值（0~100，已夹取），供雷达缩略 */
  attrs: Array<{ key: string; label: string; value: number }>
  /** 第 N 次人生（往生录条数+1，至少 1——首次/隐私模式自然为 1） */
  lifeNumber: number
}

const fmt = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)} 万`
  return `${n} 元`
}

/** 从真实终局状态组装分享卡数据（纯函数；金句两级兜底，绝不露占位符） */
export function buildShareCardData(state: GameState): ShareCardData {
  const ending = judgeEnding(state)
  const stats = buildReportStats(state)
  const keyQuote = pickKeyQuote(state)
  // 金句两级兜底：关键抉择「{N 岁 · 履历 · 玩家的选择}」优先，缺省退后记首句
  const quote = keyQuote
    ? `${keyQuote.age} 岁，${keyQuote.title}——${keyQuote.choice}`
    : (buildEndingEpilogue(state, ending.id)[0] ?? '').replace(/^「|」$/g, '')
  return {
    name: state.name,
    endingName: ending.name,
    grade: ending.grade,
    age: state.age,
    peakMoney: stats.peakMoney,
    peakMoneyText: fmt(stats.peakMoney),
    achievementsCount: state.achievements.length,
    quote,
    attrs: ATTR_KEYS.map((k) => ({ key: k, label: ATTR_LABELS[k], value: state.attrs[k] })),
    // 第 78 轮：第 N 次人生——往生录条数 +1（当前局终局时已追加）；空表/隐私模式 → 1
    lifeNumber: Math.max(1, readLegacy().length),
  }
}

/** 暖纸底色与主字色——与 index.css token 同值（呈现层取值，非引擎） */
const BG = '#f6f3ec'
const INK = '#2d2a24'
const MUTED = '#8a857a'
const GOLD = '#b8860b'
const FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'

/** 手动断行（canvas 无自动换行） */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur += ch
    }
    if (lines.length >= 4) return lines // 超长金句截四行
  }
  if (cur) lines.push(cur)
  return lines
}

/** 在指定 canvas 上绘制分享卡（1080×1440；调用方负责 canvas 尺寸） */
export function drawShareCard(canvas: HTMLCanvasElement, d: ShareCardData): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height

  // 底色与外框
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 6
  ctx.strokeRect(28, 28, W - 56, H - 56)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // 顶部小字
  ctx.fillStyle = MUTED
  ctx.font = `28px ${FONT}`
  ctx.fillText('另一种人生 · 人生报告', W / 2, 110)

  // 评级圆章（五色底）
  const gradeColor: Record<string, string> = {
    S: GOLD, A: '#4a9361', B: '#4a7ba6', C: MUTED, D: '#b0574f',
  }
  const cx = W / 2
  const cy = 290
  ctx.beginPath()
  ctx.arc(cx, cy, 108, 0, Math.PI * 2)
  ctx.fillStyle = gradeColor[d.grade] ?? MUTED
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.arc(cx, cy, 88, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 110px ${FONT}`
  ctx.fillText(d.grade, cx, cy + 38)
  ctx.font = `30px ${FONT}`
  ctx.fillText('级', cx + 62, cy + 36)

  // 第 78 轮：右上「终龄章」——与评级章呼应的小圆章
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(W - 170, 210, 74, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.arc(W - 170, 210, 62, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = GOLD
  ctx.font = `bold 34px ${FONT}`
  ctx.fillText('终龄', W - 170, 200)
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText(`${d.age} 岁`, W - 170, 244)

  // 第 78 轮：左上「第 N 次人生」章——往生录联动（首次为 1）
  ctx.beginPath()
  ctx.arc(170, 210, 74, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.arc(170, 210, 62, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = GOLD
  ctx.font = `bold 34px ${FONT}`
  ctx.fillText(`第 ${d.lifeNumber} 次`, 170, 200)
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText('人生', 170, 244)

  // 结局名与玩家（第 78 轮：饰线精修——结局名两侧金线与菱形收束）
  ctx.fillStyle = INK
  ctx.font = `bold 76px ${FONT}`
  ctx.fillText(d.endingName, W / 2, 500)
  const nameW = ctx.measureText(d.endingName).width
  const lineY = 476
  const gap = nameW / 2 + 46
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - gap - 90, lineY)
  ctx.lineTo(W / 2 - gap, lineY)
  ctx.moveTo(W / 2 + gap, lineY)
  ctx.lineTo(W / 2 + gap + 90, lineY)
  ctx.stroke()
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(W / 2 - gap - 12, lineY)
  ctx.lineTo(W / 2 - gap - 4, lineY - 7)
  ctx.lineTo(W / 2 + gap + 4, lineY)
  ctx.lineTo(W / 2 - gap - 4, lineY + 7)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(W / 2 + gap + 12, lineY)
  ctx.lineTo(W / 2 + gap + 4, lineY - 7)
  ctx.lineTo(W / 2 - gap - 4, lineY)
  ctx.lineTo(W / 2 + gap + 4, lineY + 7)
  ctx.closePath()
  ctx.fill()
  ctx.font = `34px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText(`${d.name} · 终年 ${d.age} 岁`, W / 2, 566)

  // 关键数据三格
  ctx.fillStyle = INK
  ctx.font = `bold 52px ${FONT}`
  const colY = 690
  ctx.fillText(`${d.age} 岁`, W * 0.25, colY)
  ctx.fillText(d.peakMoneyText, W * 0.5, colY)
  ctx.fillText(`${d.achievementsCount} 枚`, W * 0.75, colY)
  ctx.fillStyle = MUTED
  ctx.font = `26px ${FONT}`
  ctx.fillText('终龄', W * 0.25, colY + 44)
  ctx.fillText('峰值资产', W * 0.5, colY + 44)
  ctx.fillText('成就', W * 0.75, colY + 44)

  // 金句（引文块；空串不画）
  if (d.quote) {
    ctx.font = `34px ${FONT}`
    const lines = wrapLines(ctx, d.quote, W - 320)
    ctx.fillStyle = INK
    let qy = colY + 160
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      if (i === 0) line = `「${line}`
      if (i === lines.length - 1) line = `${line}」`
      ctx.fillText(line, W / 2, qy)
      qy += 54
    }
  }

  // 雷达缩略（五维终值；第 78 轮放大 R 170→196，关键三属性标签金色高亮）
  const rcx = W / 2
  const rcy = 1105
  const R = 196
  const axes = ATTR_KEYS.map((k, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ATTR_KEYS.length
    const v = Math.max(0, Math.min(100, d.attrs.find((a) => a.key === k)?.value ?? 50))
    return { label: ATTR_LABELS[k], value: v, angle }
  })
  const topKeys = [...d.attrs].sort((a, b) => b.value - a.value).slice(0, 3).map((a) => a.key)
  // 网格环（两圈）与轴线
  ctx.strokeStyle = MUTED
  ctx.lineWidth = 2
  for (const rr of [R * 0.5, R]) {
    ctx.beginPath()
    axes.forEach((a, i) => {
      const x = rcx + Math.cos(a.angle) * rr
      const y = rcy + Math.sin(a.angle) * rr
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
  }
  axes.forEach((a) => {
    ctx.beginPath()
    ctx.moveTo(rcx, rcy)
    ctx.lineTo(rcx + Math.cos(a.angle) * R, rcy + Math.sin(a.angle) * R)
    ctx.stroke()
  })
  // 终值多边形
  ctx.beginPath()
  axes.forEach((a, i) => {
    const x = rcx + Math.cos(a.angle) * (R * a.value) / 100
    const y = rcy + Math.sin(a.angle) * (R * a.value) / 100
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = 'rgba(184, 134, 11, 0.35)'
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 4
  ctx.stroke()
  // 轴标签（第 78 轮：关键三属性金色加粗高亮）
  axes.forEach((a, i) => {
    const lx = rcx + Math.cos(a.angle) * (R + 58)
    const ly = rcy + Math.sin(a.angle) * (R + 46)
    const isTop = topKeys.includes(ATTR_KEYS[i])
    ctx.fillStyle = isTop ? GOLD : INK
    ctx.font = `${isTop ? 'bold ' : ''}34px ${FONT}`
    ctx.fillText(`${a.label} ${a.value}`, lx, ly + 10)
  })

  // 底部落款
  ctx.fillStyle = MUTED
  ctx.font = `26px ${FONT}`
  ctx.fillText('—— 离线可玩 · 每年一次选择 ——', W / 2, H - 52)
}

/** 组装并触发下载（file:// 与 http 均可用）；无 canvas 环境返回 false。
 *  第 78 轮：文件名带「第 N 次」与结局名，非法路径字符清洗（中文保留）。 */
export function downloadShareCard(state: GameState): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1440
    const data = buildShareCardData(state)
    drawShareCard(canvas, data)
    const url = canvas.toDataURL('image/png')
    if (!url.startsWith('data:image/png')) return false
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '')
    const a = document.createElement('a')
    a.href = url
    a.download = `另一种人生-第${data.lifeNumber}次-${safe(data.endingName)}-${data.age}岁-${safe(data.name)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  }
}
