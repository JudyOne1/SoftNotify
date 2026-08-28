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

export function pickTemplate(): string {
  return REMINDER_TEMPLATES[Math.floor(Math.random() * REMINDER_TEMPLATES.length)]
}
