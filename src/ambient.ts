// 第 76 轮：音景 II——人生阶段环境音（呈现层，不进引擎）。
// 三段极简环境底噪全部 WebAudio 程序化合成（噪声缓冲 + 滤波 + 缓慢 LFO）：
//   青年 = 低频城市噪（brown noise 低通）+ 偶发高频粒子（LFO 门控正弦）
//   中年 = 中频暖噪（pink 倾向带通）+ 缓慢增益起伏 LFO
//   晚年 = 极低频正弦起伏 + 稀疏高频簇（清晨鸟鸣意象）
// 默认关（独立键 another-life:ambient）；开启后音量跟随既有三态（another-life:sound
// 的 gainMul）；阶段切换 2 秒交叉淡入淡出。AudioContext 懒创建——默认关时零构造
//（M11a「全程零构造」断言不破）。环境无声卡/AudioContext 缺失时全部安全 no-op。
import { getVolume } from './sound'

const AMBIENT_KEY = 'another-life:ambient'

export type AmbientStage = 'youth' | 'mid' | 'late'

export function getAmbientEnabled(): boolean {
  try {
    return localStorage.getItem(AMBIENT_KEY) === 'on'
  } catch {
    return false
  }
}

export function setAmbientEnabled(on: boolean): void {
  try {
    localStorage.setItem(AMBIENT_KEY, on ? 'on' : 'off')
  } catch {
    // 存储不可用：本次会话内开关仍可用，偏好不持久化
  }
}

// ── 合成引擎（懒启动；off 时完全静默且不持有节点）──
interface StageChain {
  out: GainNode
  stop: () => void
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let current: StageChain | null = null
let currentStage: AmbientStage | null = null

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
  return ctx
}

/** 噪声缓冲（2 秒循环；brown/pink 倾向由滤波器塑形） */
function noiseBuffer(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 2
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buf
}

/** 搭一段环境链（噪声源 + 滤波 + 缓慢 LFO 增益起伏；配方按阶段） */
function buildStage(c: AudioContext, stage: AmbientStage): StageChain {
  const out = c.createGain()
  out.gain.value = 0
  out.connect(master!)

  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  src.loop = true

  const filter = c.createBiquadFilter()
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.15
  lfo.connect(lfoGain)
  lfoGain.connect(out.gain)
  lfo.start()

  // 慢 LFO 在 0.05–0.2Hz 之间按阶段错开，避免段间听感雷同
  if (stage === 'youth') {
    filter.type = 'lowpass'
    filter.frequency.value = 220
    lfo.frequency.value = 0.06
  } else if (stage === 'mid') {
    filter.type = 'bandpass'
    filter.frequency.value = 520
    filter.Q.value = 0.8
    lfo.frequency.value = 0.11
  } else {
    filter.type = 'lowpass'
    filter.frequency.value = 140
    lfo.frequency.value = 0.05
  }

  src.connect(filter)
  filter.connect(out)
  src.start()

  // 稀疏点缀：青年=偶发高频短音（远处车流/霓虹意象）；晚年=稀疏正弦簇（晨鸟意象）
  let blipTimer = 0
  let blipGain: GainNode | null = null
  if (stage === 'youth' || stage === 'late') {
    blipGain = c.createGain()
    blipGain.gain.value = stage === 'youth' ? 0.04 : 0.03
    blipGain.connect(out)
  }
  const blip = () => {
    if (blipGain && ctx) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = stage === 'youth' ? 1400 + Math.random() * 900 : 2400 + Math.random() * 1200
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
      o.connect(g)
      g.connect(blipGain)
      o.start()
      o.stop(ctx.currentTime + 0.7)
    }
    blipTimer = window.setTimeout(blip, (stage === 'youth' ? 5 : 9) * 1000 + Math.random() * 6000)
  }
  blipTimer = window.setTimeout(blip, 2000 + Math.random() * 3000)

  return {
    out,
    stop: () => {
      window.clearTimeout(blipTimer)
      try {
        src.stop()
        lfo.stop()
      } catch {
        // 已停止：忽略
      }
    },
  }
}

/** 阶段切换（2 秒交叉淡入淡出；未开启时仅记录阶段，启动时生效） */
export function setAmbientStage(stage: AmbientStage): void {
  currentStage = stage
  if (!getAmbientEnabled()) return
  const c = audioCtx()
  if (!c || !master) return
  const next = buildStage(c, stage)
  const t = c.currentTime
  next.out.gain.setValueAtTime(0.0001, t)
  next.out.gain.linearRampToValueAtTime(0.5 * (getVolume() === 'low' ? 0.45 : 1), t + 2)
  if (current) {
    const old = current
    old.out.gain.setValueAtTime(old.out.gain.value, t)
    old.out.gain.linearRampToValueAtTime(0.0001, t + 2)
    window.setTimeout(() => old.stop(), 2200)
  }
  current = next
}

/** 开启环境音（用户手势路径：toggle 点击即手势，ctx.resume 合法） */
export function startAmbient(): void {
  const c = audioCtx()
  if (!c) return
  setAmbientStage(currentStage ?? 'youth')
}

/** 关闭环境音（2 秒淡出后全停，节点释放） */
export function stopAmbient(): void {
  if (!ctx || !master || !current) return
  const old = current
  const t = ctx.currentTime
  old.out.gain.setValueAtTime(old.out.gain.value, t)
  old.out.gain.linearRampToValueAtTime(0.0001, t + 2)
  window.setTimeout(() => {
    old.stop()
    master!.gain.value = 0
  }, 2200)
  current = null
}

/** 音效三态变化时由设置入口调用——环境音增益跟随（off 时静音但引擎保持） */
export function refreshAmbientVolume(): void {
  if (!ctx || !master || !current) return
  const v = getVolume()
  master.gain.value = v === 'off' ? 0 : v === 'low' ? 0.45 : 1
}
