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
  /** 安静时段开关 */
  quietEnabled: boolean
  /** 安静时段开始 HH:MM */
  quietStart: string
  /** 安静时段结束 HH:MM */
  quietEnd: string
  /** 休眠错过提醒的策略：补发 / 丢弃 */
  missedPolicy: 'fire' | 'skip'
  /** 弹幕颜色主题 */
  theme: 'sky' | 'candy' | 'mono'
  /** 弹幕速度档位 */
  speed: 'slow' | 'normal' | 'fast'
}

export interface ReminderPayload {
  text: string
  sound: boolean
  volume: number
}
