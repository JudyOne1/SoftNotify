import { describe, expect, it } from 'vitest'
import { computeStreak, hitMilestone } from '../src/shared/streak-core'

function dateOffsets(offsets: number[], now = new Date()): Record<string, number> {
  const out: Record<string, number> = {}
  for (const off of offsets) {
    const d = new Date(now)
    d.setDate(d.getDate() - off)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out[key] = 8 // 都按 8 次计（≥ 常用目标）
  }
  return out
}

describe('computeStreak', () => {
  it('今天已达标 → 含今天连续计数', () => {
    const daily = dateOffsets([0, 1, 2]) // 今昨前都达标
    expect(computeStreak(daily, 5)).toBe(3)
  })

  it('今天未达标 → 从昨天起算（不断签）', () => {
    const daily = dateOffsets([1, 2, 3]) // 昨天到大前天达标
    expect(computeStreak(daily, 5)).toBe(3)
  })

  it('昨天断签 → 归零', () => {
    const daily = dateOffsets([2, 3]) // 前天/大前天达标，昨天断
    expect(computeStreak(daily, 5)).toBe(0)
  })

  it('今天达标昨天断 → 只算今天 1 天', () => {
    const daily = dateOffsets([0])
    expect(computeStreak(daily, 5)).toBe(1)
  })

  it('goal ≤ 0 → 恒为 0', () => {
    expect(computeStreak(dateOffsets([0, 1]), 0)).toBe(0)
  })
})

describe('hitMilestone', () => {
  it('命中未庆祝里程碑 → 返回档位', () => {
    expect(hitMilestone(7, [], 'water')).toBe(7)
  })
  it('已庆祝过 → null', () => {
    expect(hitMilestone(7, ['water-7'], 'water')).toBeNull()
  })
  it('非里程碑天数 → null', () => {
    expect(hitMilestone(5, [], 'water')).toBeNull()
  })
})
