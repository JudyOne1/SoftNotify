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
  /** 夜间文案（22:00-06:00 优先使用）；为空回退 texts */
  nightTexts?: string[]
}

/** 定时日程：按钟点触发（每天/每周几/一次性），与间隔提醒分开管理 */
export interface ScheduleItem {
  id: string
  name: string
  enabled: boolean
  /** 触发时刻 HH:MM */
  time: string
  /** 周几（0-6，周日=0）；空数组 = 每天 */
  weekdays: number[]
  /** 一次性日程的日期 YYYY-MM-DD；为空 = 周期性。触发后自动停用 */
  date?: string
  texts: string[]
  /** 夜间文案（22:00-06:00 优先使用）；为空回退 texts */
  nightTexts?: string[]
  /** 忽略安静时段（如 23:00 睡前提醒落在安静时段内） */
  ignoreQuiet: boolean
}

/** Profile：快照「提醒计划 + 定时日程 + 安静时段 + 弹幕外观」，一键切换场景 */
export interface Profile {
  id: string
  name: string
  patch: ProfilePatch
}

export interface ProfilePatch {
  reminders?: ReminderItem[]
  schedules?: ScheduleItem[]
  quietEnabled?: boolean
  quietStart?: string
  quietEnd?: string
  theme?: Config['theme']
  speed?: Config['speed']
  danmaku?: DanmakuStyle
}

/** 弹幕外观自定义 */
export interface DanmakuStyle {
  /** 不透明度 0.3-1 */
  opacity: number
  /** 字号缩放 0.8-1.6 */
  fontScale: number
  /** 文字描边/阴影 */
  stroke: boolean
}

export interface Config {
  /** 间隔提醒计划 */
  reminders: ReminderItem[]
  /** 定时日程计划 */
  schedules: ScheduleItem[]
  /** 已保存的 Profile */
  profiles: Profile[]
  /** 当前激活的 Profile id */
  activeProfile: string | null
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
  /** 弹幕外观 */
  danmaku: DanmakuStyle
  /** 节日祝福：当天首次提醒自动附加节日问候 */
  festivalEnabled: boolean
  /** 界面主题：跟随系统 / 亮色 / 暗色 */
  themeMode: 'system' | 'light' | 'dark'
  /** 设置窗口尺寸记忆 */
  settingsWindow?: { width: number; height: number }
  /** 提示音来源：合成 / 自定义音频文件 */
  audioMode: 'synth' | 'file'
  /** 自定义音频文件名（存于 userData/audio/ 下），空表示未选择 */
  audioFileName: string
}

export interface ReminderPayload {
  text: string
  sound: boolean
  volume: number
  /** 自定义音频地址（media:// 协议），未配置时为空 */
  audioUrl?: string
}

/** 选择自定义音频的结果 */
export interface AudioChoiceResult {
  canceled: boolean
  /** 选择成功时的文件名（已复制到 userData/audio/） */
  fileName?: string
  /** 失败原因：超过大小限制 / 格式不支持 */
  reason?: 'size' | 'ext'
}

/** 自动更新状态 */
export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'unsupported'
