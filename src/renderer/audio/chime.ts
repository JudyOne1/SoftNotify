import type { SoundPreset } from '@shared/types'

export const SOUND_PRESETS: Array<{ value: SoundPreset; label: string }> = [
  { value: 'classic', label: '经典双音' },
  { value: 'windchime', label: '风铃' },
  { value: 'water', label: '水滴' },
  { value: 'knock', label: '木鱼' },
  { value: 'musicbox', label: '八音盒' },
  { value: 'marimba', label: '马林巴' },
  { value: 'kalimba', label: '拇指琴' },
  { value: 'dingdong', label: '叮咚' },
  { value: 'bell', label: '银铃' },
  { value: 'crystal', label: '水晶' },
  { value: 'birds', label: '鸟鸣' },
  { value: 'bubble', label: '气泡' },
  { value: 'zen', label: '禅钟' },
  { value: 'harp', label: '竖琴' },
  { value: 'sparkle', label: '星芒' },
  { value: 'flute', label: '短笛' }
]

export function isValidPreset(v: unknown): v is SoundPreset {
  return typeof v === 'string' && SOUND_PRESETS.some((p) => p.value === v)
}

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 首次用户手势时调用，提前解锁 AudioContext（overlay 窗口平时没有焦点） */
export function unlockAudio(): void {
  audioCtx()
}

function tone(
  ac: AudioContext,
  volume: number,
  opts: { type: OscillatorType; from: number; to?: number; start: number; dur: number; attack?: number; peak?: number }
): void {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = opts.type
  const peak = (opts.peak ?? 0.35) * volume
  const t0 = ac.currentTime + opts.start
  osc.frequency.setValueAtTime(opts.from, t0)
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur)
  }
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + (opts.attack ?? 0.02))
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.05)
}

/**
 * 短促轻柔、不刺耳的合成提示音，全部离线零依赖。
 * 全部音色为原创音高序列与包络设计，不复制任何知名铃声旋律。
 */
export function playPreset(preset: SoundPreset, volume: number, retried = false): void {
  if (volume <= 0) return
  const ac = audioCtx()
  if (!ac) return
  // 上下文尚未解锁时稍后重试一次（无手势的 overlay 窗口可能处于 suspended）
  if (ac.state === 'suspended' && !retried) {
    setTimeout(() => playPreset(preset, volume, true), 150)
    return
  }

  switch (preset) {
    case 'classic': {
      // A5 → D6 双音
      tone(ac, volume, { type: 'sine', from: 880, start: 0, dur: 0.9 })
      tone(ac, volume, { type: 'sine', from: 1174.66, start: 0.28, dur: 0.9 })
      break
    }
    case 'windchime': {
      // 五声上行琶音
      const notes = [1046.5, 1174.7, 1396.9, 1568.0, 2093.0]
      notes.forEach((f, i) => {
        tone(ac, volume, { type: 'sine', from: f, start: i * 0.09, dur: 1.1, attack: 0.008, peak: 0.22 })
      })
      break
    }
    case 'water': {
      // 两声水滴：频率快速下滑
      tone(ac, volume, { type: 'sine', from: 1300, to: 420, start: 0, dur: 0.16, attack: 0.005, peak: 0.4 })
      tone(ac, volume, { type: 'sine', from: 1100, to: 380, start: 0.22, dur: 0.16, attack: 0.005, peak: 0.32 })
      break
    }
    case 'knock': {
      // 木鱼：短促低频敲击
      tone(ac, volume, { type: 'triangle', from: 190, to: 140, start: 0, dur: 0.11, attack: 0.003, peak: 0.55 })
      tone(ac, volume, { type: 'triangle', from: 190, to: 140, start: 0.18, dur: 0.11, attack: 0.003, peak: 0.4 })
      break
    }
    case 'musicbox': {
      // 八音盒：E6 → G6 双音慢衰减，加一个高八度泛音
      tone(ac, volume, { type: 'triangle', from: 1318.5, start: 0, dur: 1.4, attack: 0.004, peak: 0.26 })
      tone(ac, volume, { type: 'sine', from: 2637, start: 0, dur: 0.7, attack: 0.004, peak: 0.08 })
      tone(ac, volume, { type: 'triangle', from: 1568, start: 0.3, dur: 1.5, attack: 0.004, peak: 0.22 })
      break
    }
    case 'marimba': {
      // 马林巴：温暖木键敲击，G4→C5→E5→G5 上行，短衰减
      const notes = [392, 523.25, 659.25, 783.99]
      notes.forEach((f, i) => {
        tone(ac, volume, { type: 'triangle', from: f, start: i * 0.1, dur: 0.45, attack: 0.004, peak: 0.34 })
        tone(ac, volume, { type: 'sine', from: f * 3.9, start: i * 0.1, dur: 0.12, attack: 0.003, peak: 0.05 })
      })
      break
    }
    case 'kalimba': {
      // 拇指琴：清亮金属拨片，C6→A5→E5 下行，余音较长
      const notes = [1046.5, 880, 659.25]
      notes.forEach((f, i) => {
        tone(ac, volume, { type: 'sine', from: f, start: i * 0.14, dur: 1.1, attack: 0.003, peak: 0.28 })
        tone(ac, volume, { type: 'sine', from: f * 3.01, start: i * 0.14, dur: 0.4, attack: 0.003, peak: 0.06 })
      })
      break
    }
    case 'dingdong': {
      // 叮咚：门铃式双音，E5 落下接 C5 延长
      tone(ac, volume, { type: 'sine', from: 659.25, start: 0, dur: 0.55, attack: 0.006, peak: 0.34 })
      tone(ac, volume, { type: 'sine', from: 1318.5, start: 0, dur: 0.3, attack: 0.006, peak: 0.08 })
      tone(ac, volume, { type: 'sine', from: 523.25, start: 0.4, dur: 0.95, attack: 0.006, peak: 0.32 })
      tone(ac, volume, { type: 'sine', from: 1046.5, start: 0.4, dur: 0.5, attack: 0.006, peak: 0.07 })
      break
    }
    case 'bell': {
      // 银铃：小铃铛两击，非整数泛音营造金属感
      const strike = (start: number, f: number, peak: number): void => {
        tone(ac, volume, { type: 'sine', from: f, start, dur: 1.2, attack: 0.002, peak })
        tone(ac, volume, { type: 'sine', from: f * 2.76, start, dur: 0.7, attack: 0.002, peak: peak * 0.28 })
        tone(ac, volume, { type: 'sine', from: f * 5.4, start, dur: 0.3, attack: 0.002, peak: peak * 0.1 })
      }
      strike(0, 1318.5, 0.3)
      strike(0.35, 1568, 0.22)
      break
    }
    case 'crystal': {
      // 水晶：极高音玻璃质感双响
      tone(ac, volume, { type: 'sine', from: 2093, start: 0, dur: 0.7, attack: 0.002, peak: 0.22 })
      tone(ac, volume, { type: 'sine', from: 4186, start: 0, dur: 0.35, attack: 0.002, peak: 0.07 })
      tone(ac, volume, { type: 'sine', from: 2637, start: 0.24, dur: 0.9, attack: 0.002, peak: 0.18 })
      break
    }
    case 'birds': {
      // 鸟鸣：两组上滑啁啾
      tone(ac, volume, { type: 'sine', from: 2400, to: 3600, start: 0, dur: 0.14, attack: 0.006, peak: 0.2 })
      tone(ac, volume, { type: 'sine', from: 2800, to: 3900, start: 0.22, dur: 0.12, attack: 0.006, peak: 0.18 })
      tone(ac, volume, { type: 'sine', from: 3300, to: 2600, start: 0.38, dur: 0.13, attack: 0.006, peak: 0.15 })
      break
    }
    case 'bubble': {
      // 气泡：三颗短促上浮泡
      tone(ac, volume, { type: 'sine', from: 350, to: 720, start: 0, dur: 0.09, attack: 0.004, peak: 0.34 })
      tone(ac, volume, { type: 'sine', from: 460, to: 940, start: 0.13, dur: 0.09, attack: 0.004, peak: 0.3 })
      tone(ac, volume, { type: 'sine', from: 580, to: 1180, start: 0.26, dur: 0.1, attack: 0.004, peak: 0.26 })
      break
    }
    case 'zen': {
      // 禅钟：低频颂钵，微失谐泛音产生缓慢颤动，长衰减
      tone(ac, volume, { type: 'sine', from: 196, start: 0, dur: 2.8, attack: 0.04, peak: 0.3 })
      tone(ac, volume, { type: 'sine', from: 392.8, start: 0, dur: 2.4, attack: 0.05, peak: 0.12 })
      tone(ac, volume, { type: 'sine', from: 197.4, start: 0, dur: 2.8, attack: 0.06, peak: 0.1 })
      tone(ac, volume, { type: 'sine', from: 588, start: 0, dur: 1.4, attack: 0.05, peak: 0.05 })
      break
    }
    case 'harp': {
      // 竖琴：C 大调琶音轻拨，三角波短余韵
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => {
        tone(ac, volume, { type: 'triangle', from: f, start: i * 0.08, dur: 0.85, attack: 0.005, peak: 0.26 })
      })
      break
    }
    case 'sparkle': {
      // 星芒：上行滑音微光 + 高八度回响
      tone(ac, volume, { type: 'sine', from: 1568, to: 3136, start: 0, dur: 0.4, attack: 0.01, peak: 0.2 })
      tone(ac, volume, { type: 'sine', from: 2093, to: 4186, start: 0.26, dur: 0.32, attack: 0.01, peak: 0.13 })
      break
    }
    case 'flute': {
      // 短笛：柔和气声双音，慢起音
      tone(ac, volume, { type: 'sine', from: 987.77, start: 0, dur: 0.45, attack: 0.06, peak: 0.26 })
      tone(ac, volume, { type: 'sine', from: 1174.66, start: 0.38, dur: 0.55, attack: 0.06, peak: 0.24 })
      break
    }
  }
}

/** 兼容旧调用：经典双音 */
export function playChime(volume: number): void {
  playPreset('classic', volume)
}
