import { describe, expect, it } from 'vitest'
import {
  applyJitter,
  computeAnchoredNext,
  computeIntervalAt,
  computeScheduleAt,
  isDue,
  normalizeIntervalSeconds
} from '../src/shared/schedule-core'

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

describe('computeAnchoredNext', () => {
  const HOUR = 3600_000
  const anchor = at(9, 0).getTime() // 09:00

  it('锚点在未来 → 直接返回锚点', () => {
    const future = NOW.getTime() + HOUR
    expect(computeAnchoredNext(future, HOUR, NOW.getTime())).toBe(future)
  })

  it('锚点在过去 → 返回严格晚于当前时刻的下一个整周期', () => {
    // 锚点 09:00、间隔 1h、现在 12:00 → 13:00
    expect(computeAnchoredNext(anchor, HOUR, NOW.getTime())).toBe(at(13, 0).getTime())
  })

  it('当前恰在整周期上 → 顺延下一个周期（严格晚于）', () => {
    const t = computeAnchoredNext(anchor, HOUR, at(12, 0).getTime())
    expect(t).toBe(at(13, 0).getTime())
  })

  it('半周期处 → 对齐到下一个整周期', () => {
    expect(computeAnchoredNext(anchor, HOUR, at(12, 30).getTime())).toBe(at(13, 0).getTime())
  })

  it('无效输入 → 0', () => {
    expect(computeAnchoredNext(Number.NaN, HOUR, NOW.getTime())).toBe(0)
    expect(computeAnchoredNext(anchor, 0, NOW.getTime())).toBe(0)
  })
})

describe('normalizeIntervalSeconds', () => {
  it('秒值有效 → 夹紧到 [5s, 7天]', () => {
    expect(normalizeIntervalSeconds(30, undefined)).toBe(30)
    expect(normalizeIntervalSeconds(2, undefined)).toBe(5)
    expect(normalizeIntervalSeconds(999999999, undefined)).toBe(7 * 86_400)
  })

  it('秒值缺失 → 旧版分钟 ×60（0.5 分钟向上取 1 分钟）', () => {
    expect(normalizeIntervalSeconds(undefined, 60)).toBe(3600)
    expect(normalizeIntervalSeconds(undefined, 240)).toBe(14_400)
  })

  it('两者都无效 → 0（由调用方决定默认值）', () => {
    expect(normalizeIntervalSeconds(undefined, undefined)).toBe(0)
  })
})
