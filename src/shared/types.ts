export interface ReminderItem {
  /** 稳定标识，调度与差量更新依赖它 */
  id: string
  /** 显示名，如「喝水」「护眼」「拉伸」 */
  name: string
  enabled: boolean
  /** 提醒间隔（分钟），1-240 */
  intervalMinutes: number
  /** 自定义文案，随机抽取；为空时回退内置通用文案 */
  texts: string[]
}

export interface Config {
  /** 提醒计划：多个提醒项，各自间隔与文案 */
  reminders: ReminderItem[]
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
