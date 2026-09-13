/**
 * 模式（Profile）纯逻辑：引用式容器模型。
 * 模式 = 一组「启用的提醒项 id」（r:/s: 前缀），项本体只有一份，编辑互不影响。
 */

export interface ProfileLike {
  id: string
  name: string
  itemIds: string[]
}

/** 旧版快照 Profile → 引用式：取快照里 enabled 的项 id（保留前缀，已删除的项在应用时自然忽略） */
export function migrateLegacyProfiles(
  raw: unknown,
  toKey: (source: 'r' | 's', id: string) => string
): ProfileLike[] {
  if (!Array.isArray(raw)) return []
  const out: ProfileLike[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const p = item as { id?: unknown; name?: unknown; patch?: { reminders?: unknown; schedules?: unknown } }
    const id = typeof p.id === 'string' ? p.id : ''
    if (!id) continue
    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 20) : '模式'
    const itemIds: string[] = []
    const legacy = p.patch ?? {}
    const collect = (list: unknown, prefix: 'r' | 's'): void => {
      if (!Array.isArray(list)) return
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue
        const e = entry as { id?: unknown; enabled?: unknown }
        if (typeof e.id === 'string' && e.id && e.enabled !== false) {
          itemIds.push(toKey(prefix, e.id))
        }
      }
    }
    collect(legacy['reminders'], 'r')
    collect(legacy['schedules'], 's')
    out.push({ id, name, itemIds })
  }
  return out
}

/** 应用模式：按 itemIds 重算两类提醒项的 enabled（不修改项本体其他字段） */
export function applyItemEnabled<R extends { id: string; enabled: boolean }, S extends { id: string; enabled: boolean }>(
  reminders: R[],
  schedules: S[],
  itemIds: string[]
): { reminders: R[]; schedules: S[] } {
  const set = new Set(itemIds)
  return {
    reminders: reminders.map((r) => (r.enabled === set.has(`r:${r.id}`) ? r : { ...r, enabled: set.has(`r:${r.id}`) })),
    schedules: schedules.map((s) => (s.enabled === set.has(`s:${s.id}`) ? s : { ...s, enabled: set.has(`s:${s.id}`) }))
  }
}

/** 当前启用项 → 模式的 itemIds（保存新模式用） */
export function collectEnabledIds(reminders: Array<{ id: string; enabled: boolean }>, schedules: Array<{ id: string; enabled: boolean }>): string[] {
  return [
    ...reminders.filter((r) => r.enabled).map((r) => `r:${r.id}`),
    ...schedules.filter((s) => s.enabled).map((s) => `s:${s.id}`)
  ]
}
