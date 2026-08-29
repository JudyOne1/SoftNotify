/**
 * Streak 连续达标天数（Waterllama 式习惯机制）。
 * 口径：某天「达标」= 当天打卡数 ≥ 每日目标；
 * 今天还没达标不断签（streak 算到昨天为止），今天达标则含今天。
 */

function dateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 连续达标天数；goal ≤ 0 恒为 0 */
export function computeStreak(dailyCounts: Record<string, number>, goal: number, now: Date = new Date()): number {
  if (goal <= 0) return 0
  let streak = 0
  const cursor = new Date(now)
  if ((dailyCounts[dateKey(cursor)] ?? 0) < goal) cursor.setDate(cursor.getDate() - 1)
  while ((dailyCounts[dateKey(cursor)] ?? 0) >= goal) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
    if (streak > 3650) break
  }
  return streak
}

/** 达成即是里程碑的天数档位 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100]

/** 当前 streak 命中的未庆祝里程碑（无则 null） */
export function hitMilestone(streak: number, celebrated: string[], key: string): number | null {
  if (!STREAK_MILESTONES.includes(streak)) return null
  const id = `${key}-${streak}`
  return celebrated.includes(id) ? null : streak
}
