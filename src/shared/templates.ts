export const REMINDER_TEMPLATES = [
  '该喝水啦，起来接杯水吧',
  '喝口水，顺便活动一下肩颈',
  '补充水分的时间到了',
  '休息一下眼睛，喝口水吧',
  '忙了一阵了，喝口水歇一歇',
  '起来走两步，顺便喝杯水',
  '水是身体的燃料，现在加个油',
  '抬头远眺二十秒，再喝一口水'
]

/** 设置界面「添加提醒」的预设模板 */
export const REMINDER_PRESETS: Array<{ name: string; intervalMinutes: number; texts: string[] }> = [
  {
    name: '喝水',
    intervalMinutes: 60,
    texts: REMINDER_TEMPLATES
  },
  {
    name: '护眼',
    intervalMinutes: 30,
    texts: [
      '看看远处，让眼睛歇二十秒',
      '眨眨眼，转转眼球，放松一下',
      '离开屏幕片刻，眺望窗外吧',
      '20-20-20：看 20 英尺外 20 秒'
    ]
  },
  {
    name: '拉伸',
    intervalMinutes: 90,
    texts: [
      '起来伸个懒腰，活动活动筋骨',
      '转转脖子耸耸肩，别让肩膀僵住',
      '站起来走两步，顺便拉伸一下',
      '久坐伤腰，起来扭一扭吧'
    ]
  }
]

/** 设置界面「添加定时日程」的预设模板 */
export const SCHEDULE_PRESETS: Array<{
  name: string
  time: string
  weekdays: number[]
  texts: string[]
  ignoreQuiet?: boolean
}> = [
  {
    name: '该睡觉啦',
    time: '23:00',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    texts: ['夜深了，该睡觉啦', '放下手机和电脑，早点休息吧', '晚安，明天见'],
    ignoreQuiet: true
  },
  {
    name: '午休一下',
    time: '12:30',
    weekdays: [1, 2, 3, 4, 5],
    texts: ['午休时间到，闭眼歇一会儿', '吃个午饭，休息一下吧']
  },
  {
    name: '下班打卡',
    time: '18:00',
    weekdays: [1, 2, 3, 4, 5],
    texts: ['到点了，收拾收拾下班吧', '今天辛苦啦，下班愉快']
  }
]

/** 夜间时段（22:00-06:00）触发时优先使用 nightTexts */
export function isNightTime(now: Date = new Date()): boolean {
  const h = now.getHours()
  return h >= 22 || h < 6
}

/** 从一个提醒项取文案：按时段选自定义文案优先，否则用内置通用文案 */
export function pickText(item: { texts: string[]; nightTexts?: string[] } | null, now: Date = new Date()): string {
  if (item) {
    const pool = isNightTime(now) && item.nightTexts && item.nightTexts.length > 0 ? item.nightTexts : item.texts
    if (pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)]
    }
  }
  return pickTemplate()
}

export function pickTemplate(): string {
  return REMINDER_TEMPLATES[Math.floor(Math.random() * REMINDER_TEMPLATES.length)]
}
