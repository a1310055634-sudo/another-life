// 第 38 轮：氛围音效（呈现层，不进引擎）。
// 两个合成音：选择咔哒（短促高频衰减）与跨年轻翻页（带通噪声扫频），
// 全部 WebAudio 现场合成——无外部音频文件、无 base64 资源，dist 保持自包含。
// 默认静音；偏好存 localStorage（独立键，不碰存档数据），设置入口在首页。
// 环境（SSR/jsdom/旧浏览器）没有 AudioContext 时全部安全 no-op，绝不抛错。
// 第 52 轮：音量三态（关/低/高，旧 'on' 档迁移为 '高'）+ 成就解锁音 + 结局盖章音；
// prefers-reduced-motion 联动落点在首页说明行（hasExplicitPreference 供 UI 判定），
// 用户显式开启后出声不受系统动效偏好影响。往生录翻页音（53 轮）复用 playPageFlip。
const SOUND_KEY = 'another-life:sound'

export type SoundVolume = 'off' | 'low' | 'high'

/** 当前音量档；旧两态档 'on' 迁移为 'high'（保留显式开启的意图），无记录/异常 → 'off' */
export function getVolume(): SoundVolume {
  try {
    const v = localStorage.getItem(SOUND_KEY)
    if (v === 'low' || v === 'high') return v
    if (v === 'on') return 'high'
    return 'off'
  } catch {
    return 'off'
  }
}

export function setVolume(v: SoundVolume): void {
  try {
    localStorage.setItem(SOUND_KEY, v)
  } catch {
    // 存储不可用：本次会话内开关仍可用，偏好不持久化
  }
}

/** 用户是否显式设置过音效偏好（键存在即算）——首页 reduced-motion 说明行的判定依据 */
export function hasExplicitPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== null
  } catch {
    return false
  }
}

/** 既有接口保持兼容：开 = 高档、关 = off（第 38 轮调用方零改动） */
export function soundEnabled(): boolean {
  return getVolume() !== 'off'
}

export function setSoundEnabled(on: boolean): void {
  setVolume(on ? 'high' : 'off')
}

/** 音量档 → 增益乘数（off 在播放入口早退，不进此表） */
const VOLUME_MUL: Record<'low' | 'high', number> = { low: 0.45, high: 1 }
function gainMul(): number {
  const v = getVolume()
  return v === 'off' ? 0 : (VOLUME_MUL[v] ?? 1)
}

let ctx: AudioContext | null = null

/** 懒创建 AudioContext；不可用/被禁时返回 null */
function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
  return ctx
}

/** 时间常量（秒）：短于 --dur-* 视觉档位，听感轻不抢戏 */
const CLICK_SECONDS = 0.05
const FLIP_SECONDS = 0.2
const ACH_SECONDS = 0.09
const STAMP_SECONDS = 0.12
/** 主音量：氛围音基准，峰壳不刺耳 */
const PEAK = 0.12

/** 选择咔哒：2.2kHz 正弦短促衰减，尾音自然收零 */
export function playClick(): void {
  if (!soundEnabled()) return
  const ac = audioCtx()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(2200, t)
  osc.frequency.exponentialRampToValueAtTime(900, t + CLICK_SECONDS)
  gain.gain.setValueAtTime(PEAK * gainMul(), t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + CLICK_SECONDS)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + CLICK_SECONDS)
}

/** 跨年轻翻页：白噪声过带通扫频（400→1400Hz），像一页纸滑过 */
export function playPageFlip(): void {
  if (!soundEnabled()) return
  const ac = audioCtx()
  if (!ac) return
  const t = ac.currentTime
  const mul = gainMul()
  const len = Math.max(1, Math.floor(ac.sampleRate * FLIP_SECONDS))
  const buffer = ac.createBuffer(1, len, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.2
  band.frequency.setValueAtTime(400, t)
  band.frequency.exponentialRampToValueAtTime(1400, t + FLIP_SECONDS)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(PEAK * mul, t + FLIP_SECONDS * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + FLIP_SECONDS)
  src.connect(band).connect(gain).connect(ac.destination)
  src.start(t)
  src.stop(t + FLIP_SECONDS)
}

/** 成就解锁：两音上行琶音（E5→A5），轻快不抢戏。App 层监听成就数增长时调用 */
export function playAchievement(): void {
  if (!soundEnabled()) return
  const ac = audioCtx()
  if (!ac) return
  const t = ac.currentTime
  const mul = gainMul()
  const notes: Array<[number, number, number]> = [
    [659.25, 0, 0.8], // E5，稍弱
    [880, ACH_SECONDS, 1], // A5，稍强
  ]
  for (const [freq, off, strength] of notes) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t + off)
    gain.gain.setValueAtTime(0.0001, t + off)
    gain.gain.exponentialRampToValueAtTime(PEAK * mul * strength, t + off + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + off + ACH_SECONDS)
    osc.connect(gain).connect(ac.destination)
    osc.start(t + off)
    osc.stop(t + off + ACH_SECONDS)
  }
}

/** 结局盖章：低频三角波短促下沉（190→120Hz），印章落纸的钝响。EndingPage 挂载时调用 */
export function playStamp(): void {
  if (!soundEnabled()) return
  const ac = audioCtx()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(190, t)
  osc.frequency.exponentialRampToValueAtTime(120, t + STAMP_SECONDS)
  gain.gain.setValueAtTime(PEAK * 1.4 * gainMul(), t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + STAMP_SECONDS)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + STAMP_SECONDS)
}
