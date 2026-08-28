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

/** 从一个提醒项取文案：自定义文案优先，否则用内置通用文案 */
export function pickText(item: { texts: string[] } | null): string {
  if (item && item.texts.length > 0) {
    return item.texts[Math.floor(Math.random() * item.texts.length)]
  }
  return pickTemplate()
}

export function pickTemplate(): string {
  return REMINDER_TEMPLATES[Math.floor(Math.random() * REMINDER_TEMPLATES.length)]
}
