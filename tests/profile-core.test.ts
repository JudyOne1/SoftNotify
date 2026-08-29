import { describe, expect, it } from 'vitest'
import { applyItemEnabled, collectEnabledIds, migrateLegacyProfiles } from '../src/shared/profile-core'

const toKey = (prefix: 'r' | 's', id: string): string => `${prefix}:${id}`

describe('migrateLegacyProfiles', () => {
  it('快照中 enabled 的项转为引用 id（保留 r:/s: 前缀）', () => {
    const legacy = [
      {
        id: 'p1',
        name: '工作',
        patch: {
          reminders: [
            { id: 'water', enabled: true },
            { id: 'eyes', enabled: false }
          ],
          schedules: [{ id: 'sleep', enabled: true }]
        }
      }
    ]
    expect(migrateLegacyProfiles(legacy, toKey)).toEqual([
      { id: 'p1', name: '工作', itemIds: ['r:water', 's:sleep'] }
    ])
  })

  it('无 patch / 非数组输入 → 空数组或空引用', () => {
    expect(migrateLegacyProfiles([], toKey)).toEqual([])
    expect(migrateLegacyProfiles(undefined, toKey)).toEqual([])
    expect(migrateLegacyProfiles([{ id: 'p1', name: 'x' }], toKey)).toEqual([{ id: 'p1', name: 'x', itemIds: [] }])
  })

  it('无 id 的非法条目跳过', () => {
    expect(migrateLegacyProfiles([{ name: 'bad' }], toKey)).toEqual([])
  })
})

describe('applyItemEnabled', () => {
  const reminders = [
    { id: 'water', enabled: false },
    { id: 'eyes', enabled: true }
  ]
  const schedules = [{ id: 'sleep', enabled: true }]

  it('引用集合内的启用、集合外的停用', () => {
    const result = applyItemEnabled(reminders, schedules, ['r:water'])
    expect(result.reminders).toEqual([
      { id: 'water', enabled: true },
      { id: 'eyes', enabled: false }
    ])
    expect(result.schedules).toEqual([{ id: 'sleep', enabled: false }])
  })

  it('不改变项的其他字段（引用同一份本体）', () => {
    const withExtra = [{ id: 'water', enabled: false, intervalMinutes: 60 }]
    const result = applyItemEnabled(withExtra, [], ['r:water'])
    expect(result.reminders[0]).toEqual({ id: 'water', enabled: true, intervalMinutes: 60 })
  })
})

describe('collectEnabledIds', () => {
  it('收集当前启用项并加前缀', () => {
    expect(
      collectEnabledIds(
        [
          { id: 'water', enabled: true },
          { id: 'eyes', enabled: false }
        ],
        [{ id: 'sleep', enabled: true }]
      )
    ).toEqual(['r:water', 's:sleep'])
  })
})
