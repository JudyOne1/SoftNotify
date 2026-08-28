export interface Config {
  /** 提醒间隔（分钟） */
  intervalMinutes: number
  /** 是否播放提示音 */
  soundEnabled: boolean
  /** 提示音音量 0-1 */
  volume: number
  /** 开机自启 */
  autostart: boolean
  /** 暂停提醒 */
  paused: boolean
}

export interface ReminderPayload {
  text: string
  sound: boolean
  volume: number
}
