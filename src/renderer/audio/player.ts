import type { SoundPreset } from '@shared/types'
import { playPreset } from './chime'

/** 播放提醒音：配置了自定义音频则播放之，失败或未配置时播放所选音色 */
export function playReminderSound(volume: number, audioUrl?: string, preset?: SoundPreset): void {
  if (volume <= 0) return
  if (!audioUrl) {
    playPreset(preset ?? 'classic', volume)
    return
  }
  const audio = new Audio(audioUrl)
  audio.volume = Math.min(1, Math.max(0, volume))
  audio.play().catch(() => playPreset(preset ?? 'classic', volume))
}
