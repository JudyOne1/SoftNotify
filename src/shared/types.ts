/** 合成提示音音色（chime.ts 引擎渲染） */
export type SoundPreset = 'classic' | 'windchime' | 'water' | 'knock' | 'musicbox'

export interface ReminderItem {
  /** 稳定标识，调度与差量更新依赖它 */
  id: string
  /** 显示名，如「喝水」「护眼」「拉伸」 */
  name: string
  enabled: boolean
  /** 提醒间隔（秒），5 ~ 7 天 */
  intervalSeconds: number
  /**
   * 起始锚点（epoch ms）：下次提醒 = 锚点后第一个整周期，后续按间隔顺延；
   * 为空表示「从现在起算」。持久化，重启后仍按锚点排程。
   */
  anchorAt?: number
  /** 自定义文案，随机抽取；为空时回退内置通用文案 */
  texts: string[]
  /** 夜间文案（22:00-06:00 优先使用）；为空回退 texts */
  nightTexts?: string[]
  /** 每日打卡目标次数（1-99）；为空不设目标 */
  dailyGoal?: number
  /** 重要提醒：弹幕更大更慢，可联动系统通知 */
  priority?: 'high'
  /** 提示音音色；为空跟随全局 */
  soundPreset?: SoundPreset
  /** 严格模式：弹幕不可忽略，只能完成或贪睡 */
  strict?: boolean
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
  /** 每日打卡目标次数（1-99）；为空不设目标 */
  dailyGoal?: number
  /** 重要提醒：弹幕更大更慢，可联动系统通知 */
  priority?: 'high'
  /** 提示音音色；为空跟随全局 */
  soundPreset?: SoundPreset
  /** 忽略安静时段（如 23:00 睡前提醒落在安静时段内） */
  ignoreQuiet: boolean
}

/**
 * 模式：引用式容器——一组「启用的提醒项」（r:/s: 前缀）。
 * 项本体只有一份，编辑在提醒分区进行，所有模式共享；应用模式只切换 enabled。
 */
export interface Profile {
  id: string
  name: string
  itemIds: string[]
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
  /** 检测到摄像头/麦克风使用时自动免打扰（仅 Windows） */
  meetingDetect: boolean
  /** 前台应用全屏（观影/游戏）时自动免打扰 */
  fullscreenDetect: boolean
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
  /** 重要提醒同时发 Windows 系统通知 */
  highPriorityNotify: boolean
  /** 弹幕悬停交互：鼠标移入弹幕暂停并浮出打卡按钮 */
  hoverInteraction: boolean
  /** 逐级升级：同一提醒连续贪睡后弹幕加码（默认开） */
  escalateEnabled: boolean
  /** 弹幕输出屏幕：全部 / 仅主屏 / 自定义 */
  displayMode: 'all' | 'primary' | 'custom'
  /** 自定义输出屏幕（按屏幕 x 坐标从左到右的序号，从 0 开始） */
  customDisplays: number[]
  /** 弹幕显示区域：全屏 / 上半屏 / 顶部 30% / 自定义 */
  danmakuZone: 'full' | 'top-half' | 'top-30' | 'custom'
  /** 自定义区域起始（垂直百分比 0-80） */
  zoneStart: number
  /** 自定义区域结束（垂直百分比 20-100） */
  zoneEnd: number
  /** 界面主题：跟随系统 / 亮色 / 暗色 */
  themeMode: 'system' | 'light' | 'dark'
  /** 设置窗口尺寸记忆 */
  settingsWindow?: { width: number; height: number }
  /** 提示音来源：合成 / 自定义音频文件 */
  audioMode: 'synth' | 'file'
  /** 自定义音频文件名（存于 userData/audio/ 下），空表示未选择 */
  audioFileName: string
  /** 全局合成音色（audioMode 为 synth 时生效） */
  soundPreset: SoundPreset
}

export interface ReminderPayload {
  text: string
  sound: boolean
  volume: number
  /** 自定义音频地址（media:// 协议），未配置时为空 */
  audioUrl?: string
  /** 来源提醒项 id，用于打卡 */
  itemId?: string
  /** 重要提醒：更大更慢展示 */
  priority?: 'high'
  /** 提示音音色（提醒项单独配置，空则全局） */
  soundPreset?: SoundPreset
  /** 严格模式：不显示「忽略」按钮 */
  strict?: boolean
  /** 逐级升级等级（≥2 时弹幕加码） */
  escalate?: number
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

/** 统计页数据 */
export interface StatsSummary {
  /** 近一年每日打卡次数 */
  checkinsPerDay: Array<{ date: string; count: number }>
  /** 每日活跃分钟数 */
  activeMinutes: Record<string, number>
  /** 今日各提醒项打卡次数 */
  todayByItem: Record<string, number>
  todayTotal: number
  /** 每个提醒项的每日打卡次数（统计页算 streak 用） */
  itemDaily: Record<string, Record<string, number>>
  /** 今日完成的番茄钟数 */
  todayFocus: number
}
