import { useState } from 'react'
import type { Profile, ReminderItem, ScheduleItem } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ItemRef {
  key: string
  name: string
  enabled: boolean
}

interface Props {
  profiles: Profile[]
  activeProfile: string | null
  reminders: ReminderItem[]
  schedules: ScheduleItem[]
  onApply: (id: string) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onUpdateItems: (id: string, itemIds: string[]) => void
}

/** 引用式模式：每个模式勾选包含哪些提醒项；应用模式 = 切换这些项的启用状态 */
export default function ProfilesSection({
  profiles,
  activeProfile,
  reminders,
  schedules,
  onApply,
  onSave,
  onDelete,
  onUpdateItems
}: Props): React.JSX.Element {
  const [name, setName] = useState('')

  function save(): void {
    const n = name.trim()
    if (!n) return
    onSave(n)
    setName('')
  }

  function toggleItem(profile: Profile, key: string): void {
    const set = new Set(profile.itemIds)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    onUpdateItems(profile.id, [...set])
  }

  const reminderRefs: ItemRef[] = reminders.map((r) => ({ key: `r:${r.id}`, name: r.name, enabled: r.enabled }))
  const scheduleRefs: ItemRef[] = schedules.map((s) => ({ key: `s:${s.id}`, name: s.name, enabled: s.enabled }))

  function ItemCheck({ profile, item }: { profile: Profile; item: ItemRef }): React.JSX.Element {
    const included = profile.itemIds.includes(item.key)
    return (
      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={included}
          onChange={() => toggleItem(profile, item.key)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        <span className={cn(included ? 'text-foreground' : 'text-muted-foreground')}>{item.name}</span>
      </label>
    )
  }

  return (
    <>
      <div className="mt-3 mb-2.5 flex flex-col gap-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={cn(
              'rounded-lg bg-card p-3.5 shadow-[var(--neu-raised)] transition-[filter] hover:brightness-110',
              activeProfile === p.id && 'ring-1 ring-primary/70'
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1 text-sm font-medium">
                {activeProfile === p.id && <span className="mr-1 text-primary">●</span>}
                {p.name}
              </span>
              <Button variant="secondary" size="sm" onClick={() => onApply(p.id)}>
                应用
              </Button>
              <Button variant="destructive" size="icon" title="删除" onClick={() => onDelete(p.id)}>
                ✕
              </Button>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/40 pt-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">间隔提醒</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {reminderRefs.length > 0 ? (
                  reminderRefs.map((r) => <ItemCheck key={r.key} profile={p} item={r} />)
                ) : (
                  <span className="text-xs text-muted-foreground">（无）</span>
                )}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">定时日程</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {scheduleRefs.length > 0 ? (
                  scheduleRefs.map((s) => <ItemCheck key={s.key} profile={p} item={s} />)
                ) : (
                  <span className="text-xs text-muted-foreground">（无）</span>
                )}
              </div>
            </div>
            {activeProfile === p.id && (
              <div className="mt-2 text-[11px] text-muted-foreground">当前激活 · 勾选变化立即生效</div>
            )}
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset-sm)]">
            模式 = 一组启用的提醒项。把常用的组合保存成模式（如「工作」「下班」），在托盘一键切换
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          maxLength={20}
          placeholder="模式名，如：工作"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Button variant="secondary" onClick={save}>
          保存当前为模式
        </Button>
      </div>
    </>
  )
}
