/**
 * 调度纯函数：不依赖 electron，可被 Vitest 直接测试。
 * Scheduler 类只做定时器粘合，触发时刻的计算全部在这里。
 */

export interface ScheduleLike {
  time: string
  weekdays: number[]
  date?: string
}

/** 定时日程的下一个触发时刻（本地时区）；一次性日程返回其绝对时刻（可能已过期） */
export function computeScheduleAt(item: ScheduleLike, now: Date = new Date()): number {
  const [h, m] = item.time.split(':').map(Number)
  if (item.date) {
    return new Date(`${item.date}T${item.time}:00`).getTime()
  }
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    d.setHours(h, m, 0, 0)
    const t = d.getTime()
    if (t > now.getTime() && (item.weekdays.length === 0 || item.weekdays.includes(d.getDay()))) {
      return t
    }
  }
  return 0
}

/** 间隔提醒的下一次触发时刻 */
export function computeIntervalAt(intervalMinutes: number, now: Date = new Date()): number {
  return now.getTime() + Math.round(intervalMinutes * 60_000)
}

/**
 * 间隔抖动：把计划时刻在 ±ratio 范围内随机偏移，避免提醒变得可预测。
 * interval 间隔过短（<10 分钟）不抖动，保证测试与演示的确定性。
 */
export function applyJitter(plannedAt: number, intervalMs: number, ratio: number, random: () => number = Math.random): number {
  if (intervalMs < 10 * 60_000 || ratio <= 0) return plannedAt
  const delta = intervalMs * ratio * (random() * 2 - 1)
  return Math.round(plannedAt + delta)
}

/** 唤醒后判定某项是否已错过：计划时刻早于等于当前时刻 */
export function isDue(plannedAt: number, now: number): boolean {
  return plannedAt <= now
}
