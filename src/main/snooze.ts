/**
 * 贪睡：弹幕上点「+5 分钟」后延迟重发。
 * 运行态不持久化——应用重启贪睡即失效（短时行为，符合直觉）。
 * 连续贪睡计数（当日、内存）驱动「逐级升级」弹幕加码，打卡后清零。
 */

const SNOOZE_MS = 5 * 60_000

let fire: ((itemId: string, escalateLevel: number) => void) | null = null
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const snoozeCounts = new Map<string, number>()

export function registerSnoozeFire(handler: (itemId: string, escalateLevel: number) => void): void {
  fire = handler
}

/** 同一项重复贪睡：重置计时器即可（只保留一个在途贪睡） */
export function snoozeItem(itemId: string): void {
  const existing = timers.get(itemId)
  if (existing) clearTimeout(existing)
  const count = (snoozeCounts.get(itemId) ?? 0) + 1
  snoozeCounts.set(itemId, count)
  timers.set(
    itemId,
    setTimeout(() => {
      timers.delete(itemId)
      fire?.(itemId, count)
    }, SNOOZE_MS)
  )
}

/** 该项当前贪睡次数（≥2 时逐级升级） */
export function snoozeLevel(itemId: string): number {
  return snoozeCounts.get(itemId) ?? 0
}

/** 打卡完成 → 清零升级计数 */
export function resetSnooze(itemId: string): void {
  snoozeCounts.delete(itemId)
  const timer = timers.get(itemId)
  if (timer) {
    clearTimeout(timer)
    timers.delete(itemId)
  }
}
