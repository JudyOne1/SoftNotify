import { Lunar, Solar } from 'lunar-typescript'

/** 节日名 → 祝福语（用 includes 匹配，兼容库返回名的细微差异） */
const GREETINGS: Array<[match: string, greeting: string]> = [
  ['元旦', '元旦快乐'],
  ['除夕', '除夕快乐，阖家团圆'],
  ['春节', '新春快乐，万事如意'],
  ['元宵节', '元宵快乐'],
  ['情人节', '情人节快乐'],
  ['妇女节', '女神节快乐'],
  ['劳动节', '劳动节快乐'],
  ['青年节', '青年节快乐'],
  ['儿童节', '儿童节快乐'],
  ['端午节', '端午安康'],
  ['七夕', '七夕快乐'],
  ['中秋节', '中秋快乐'],
  ['国庆节', '国庆快乐'],
  ['重阳节', '重阳安康'],
  ['平安夜', '平安夜快乐'],
  ['圣诞节', '圣诞快乐']
]

/** 今天是什么节日，返回祝福语；不是节日返回 null */
export function festivalGreeting(now: Date = new Date()): string | null {
  try {
    const names = [...Solar.fromDate(now).getFestivals(), ...Lunar.fromDate(now).getFestivals()]
    for (const name of names) {
      const hit = GREETINGS.find(([match]) => name.includes(match))
      if (hit) return hit[1]
    }
  } catch {
    // 农历库解析异常时静默跳过，不影响提醒本身
  }
  return null
}
