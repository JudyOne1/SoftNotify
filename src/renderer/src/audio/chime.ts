import type { SoundPreset } from '@shared/types'

export const SOUND_PRESETS: Array<{ value: SoundPreset; label: string }> = [
  { value: 'classic', label: '经典双音' },
  { value: 'windchime', label: '风铃' },
  { value: 'water', label: '水滴' },
  { value: 'knock', label: '木鱼' },
  { value: 'musicbox', label: '八音盒' }
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

/** 短促轻柔、不刺耳的合成提示音，全部离线零依赖 */
export function playPreset(preset: SoundPreset, volume: number): void {
  if (volume <= 0) return
  const ac = audioCtx()
  if (!ac) return

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
  }
}

/** 兼容旧调用：经典双音 */
export function playChime(volume: number): void {
  playPreset('classic', volume)
}
