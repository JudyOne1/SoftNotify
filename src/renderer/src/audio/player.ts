import { playChime } from './chime'

/** 播放提醒音：配置了自定义音频则播放之，失败或未配置时回退合成提示音 */
export function playReminderSound(volume: number, audioUrl?: string): void {
  if (volume <= 0) return
  if (!audioUrl) {
    playChime(volume)
    return
  }
  const audio = new Audio(audioUrl)
  audio.volume = Math.min(1, Math.max(0, volume))
  audio.play().catch(() => playChime(volume))
}
