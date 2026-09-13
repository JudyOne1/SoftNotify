/** 判断当前是否处于安静时段（支持跨午夜区间，如 22:00-08:00） */
export function inQuietHours(enabled: boolean, start: string, end: string, now: Date = new Date()): boolean {
  if (!enabled) return false
  const toMin = (s: string): number => {
    const [h, m] = s.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const s = toMin(start)
  const e = toMin(end)
  if (s === e) return false
  const cur = now.getHours() * 60 + now.getMinutes()
  if (s < e) return cur >= s && cur < e
  return cur >= s || cur < e
}
