import { describe, expect, it } from 'vitest'
import { applyJitter, computeIntervalAt, computeScheduleAt, isDue } from '../src/shared/schedule-core'

/** 固定基准时刻：2026-08-29（周六）12:00:00 本地时间 */
function at(h: number, m = 0, dayOffset = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d
}

const NOW = at(12, 0) // 周六 12:00

describe('computeScheduleAt', () => {
  it('当天时刻未过 → 今天触发', () => {
    const t = computeScheduleAt({ time: '18:00', weekdays: [] }, NOW)
    expect(new Date(t).getHours()).toBe(18)
    expect(new Date(t).getDate()).toBe(NOW.getDate())
  })

  it('当天时刻已过 → 明天触发', () => {
    const t = computeScheduleAt({ time: '09:00', weekdays: [] }, NOW)
    expect(new Date(t).getDate()).toBe(NOW.getDate() + 1)
  })

  it('weekdays 为空 = 每天', () => {
    const t = computeScheduleAt({ time: '23:00', weekdays: [] }, NOW)
    expect(new Date(t).getDate()).toBe(NOW.getDate())
  })

  it('指定周几 → 跳到下一个匹配日（周日=0）', () => {
    // NOW 是周六（6），下一个周日（0）是明天
    const t = computeScheduleAt({ time: '10:00', weekdays: [0] }, NOW)
    expect(new Date(t).getDay()).toBe(0)
    expect(new Date(t).getDate()).toBe(NOW.getDate() + 1)
  })

  it('今天在 weekdays 内但时刻已过 → 下周同一天', () => {
    // 周六（6）09:00 已过 → 下周六 = +7 天
    const t = computeScheduleAt({ time: '09:00', weekdays: [6] }, NOW)
    const expectDate = new Date(NOW)
    expectDate.setDate(expectDate.getDate() + 7)
    expectDate.setHours(9, 0, 0, 0)
    expect(new Date(t).getTime()).toBe(expectDate.getTime())
  })

  it('今天时刻未过且周几匹配 → 今天触发', () => {
    const t = computeScheduleAt({ time: '15:00', weekdays: [6] }, NOW)
    expect(new Date(t).getDate()).toBe(NOW.getDate())
  })

  it('一次性日程 → 返回绝对时刻（已过期也不顺延）', () => {
    const past = new Date(NOW.getTime() - 3600_000)
    const date = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
    const t = computeScheduleAt({ time: '09:00', weekdays: [], date }, NOW)
    expect(t).toBe(new Date(`${date}T09:00:00`).getTime())
    expect(t).toBeLessThan(NOW.getTime())
  })
})

describe('computeIntervalAt', () => {
  it('60 分钟 → now + 1 小时', () => {
    expect(computeIntervalAt(60, NOW)).toBe(NOW.getTime() + 3600_000)
  })
})

describe('applyJitter', () => {
  const intervalMs = 60 * 60_000

  it('ratio=0 → 不抖动', () => {
    expect(applyJitter(NOW.getTime(), intervalMs, 0)).toBe(NOW.getTime())
  })

  it('短间隔（<10 分钟）不抖动', () => {
    expect(applyJitter(NOW.getTime(), 5 * 60_000, 0.15, () => 1)).toBe(NOW.getTime())
  })

  it('随机数=1 → 上偏 ratio 上限', () => {
    const planned = computeIntervalAt(60, NOW)
    expect(applyJitter(planned, intervalMs, 0.15, () => 1)).toBe(Math.round(planned + intervalMs * 0.15))
  })

  it('随机数=0 → 下偏 ratio 下限', () => {
    const planned = computeIntervalAt(60, NOW)
    expect(applyJitter(planned, intervalMs, 0.15, () => 0)).toBe(Math.round(planned - intervalMs * 0.15))
  })

  it('随机 100 次都在 ±ratio 范围内', () => {
    const planned = computeIntervalAt(60, NOW)
    for (let i = 0; i < 100; i++) {
      const t = applyJitter(planned, intervalMs, 0.15)
      expect(Math.abs(t - planned)).toBeLessThanOrEqual(Math.round(intervalMs * 0.15) + 1)
    }
  })
})

describe('isDue', () => {
  it('计划时刻早于现在 → 已到期', () => {
    expect(isDue(NOW.getTime() - 1, NOW.getTime())).toBe(true)
  })
  it('计划时刻晚于现在 → 未到期', () => {
    expect(isDue(NOW.getTime() + 1, NOW.getTime())).toBe(false)
  })
})
