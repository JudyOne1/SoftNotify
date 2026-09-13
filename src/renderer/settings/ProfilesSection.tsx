import { useEffect, useRef, useState } from 'react'
import { Check, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Profile, ReminderItem, ScheduleItem } from '@shared/types'
import { EditorSection, EditorSheet } from '@/components/editor-sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [awaitingCreate, setAwaitingCreate] = useState(false)
  const knownIds = useRef(new Set(profiles.map((profile) => profile.id)))
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null
  const reminderRefs: ItemRef[] = reminders.map((item) => ({ key: `r:${item.id}`, name: item.name, enabled: item.enabled }))
  const scheduleRefs: ItemRef[] = schedules.map((item) => ({ key: `s:${item.id}`, name: item.name, enabled: item.enabled }))
  const validKeys = new Set([...reminderRefs, ...scheduleRefs].map((item) => item.key))

  function save(): void {
    const nextName = name.trim()
    if (!nextName) return
    setAwaitingCreate(true)
    onSave(nextName)
    setName('')
  }

  useEffect(() => {
    if (awaitingCreate) {
      const added = profiles.find((profile) => !knownIds.current.has(profile.id))
      if (added) {
        setSelectedId(added.id)
        setAwaitingCreate(false)
      }
    }
    knownIds.current = new Set(profiles.map((profile) => profile.id))
  }, [awaitingCreate, profiles])

  useEffect(() => {
    if (selectedId && !profiles.some((profile) => profile.id === selectedId)) setSelectedId(null)
  }, [profiles, selectedId])

  return (
    <>
      <div className="mb-3 flex gap-2">
        <Input
          value={name}
          maxLength={20}
          placeholder="模式名，如：工作"
          aria-label="新模式名称"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
        />
        <Button variant="solid" size="sm" disabled={!name.trim() || awaitingCreate} onClick={save}>
          <Plus />创建模式
        </Button>
      </div>

      {profiles.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          {profiles.map((profile, index) => {
            const itemCount = profile.itemIds.filter((id) => validKeys.has(id)).length
            const active = activeProfile === profile.id
            return (
              <article
                key={profile.id}
                className={cn(
                  'flex min-h-[66px] items-center gap-3 px-3.5 py-2.5 transition-colors',
                  index > 0 && 'border-t border-border',
                  selectedId === profile.id && 'bg-accent/55'
                )}
              >
                <span className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md',
                  active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {active ? <Check className="size-4" /> : <Layers3 className="size-4" />}
                </span>
                <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setSelectedId(profile.id)}>
                  <span className="block truncate text-sm font-medium">{profile.name}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {active ? '当前使用' : '未启用'} · 包含 {itemCount} 项提醒
                  </span>
                </button>
                <Button
                  variant={active ? 'ghost' : 'secondary'}
                  size="sm"
                  disabled={active}
                  onClick={() => onApply(profile.id)}
                >
                  {active ? '当前' : '应用'}
                </Button>
                <Button variant="ghost" size="icon" title="编辑模式" aria-label={`编辑${profile.name}`} onClick={() => setSelectedId(profile.id)}>
                  <Pencil />
                </Button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm font-medium">还没有模式</p>
          <p className="mt-1 text-xs text-muted-foreground">为常用的提醒组合创建一个模式</p>
        </div>
      )}

      {selected && (
        <ProfileEditor
          key={selected.id}
          profile={selected}
          active={activeProfile === selected.id}
          reminders={reminderRefs}
          schedules={scheduleRefs}
          onUpdateItems={(itemIds) => onUpdateItems(selected.id, itemIds)}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            setSelectedId(null)
            onDelete(selected.id)
          }}
        />
      )}
    </>
  )
}

function ProfileEditor({ profile, active, reminders, schedules, onUpdateItems, onClose, onDelete }: {
  profile: Profile
  active: boolean
  reminders: ItemRef[]
  schedules: ItemRef[]
  onUpdateItems: (itemIds: string[]) => void
  onClose: () => void
  onDelete: () => void
}): React.JSX.Element {
  const [deleteArmed, setDeleteArmed] = useState(false)

  function toggleItem(key: string): void {
    const selected = new Set(profile.itemIds)
    if (selected.has(key)) selected.delete(key)
    else selected.add(key)
    onUpdateItems([...selected])
  }

  return (
    <EditorSheet
      open
      title={profile.name}
      description={active ? '当前使用的模式' : `包含 ${profile.itemIds.length} 项提醒`}
      onClose={onClose}
    >
      {active && (
        <div className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
          当前模式正在使用，成员变化会立即更新提醒的启用状态。
        </div>
      )}

      <EditorSection title="间隔提醒" hint="应用模式时，只启用这里勾选的间隔提醒">
        <ItemList items={reminders} selectedIds={profile.itemIds} onToggle={toggleItem} empty="还没有可选的间隔提醒" />
      </EditorSection>

      <EditorSection title="定时日程" hint="应用模式时，只启用这里勾选的定时日程">
        <ItemList items={schedules} selectedIds={profile.itemIds} onToggle={toggleItem} empty="还没有可选的定时日程" />
      </EditorSection>

      <EditorSection title="危险操作" tone="danger">
        {deleteArmed ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-destructive/8 px-3 py-2.5">
            <span className="mr-auto text-xs text-destructive">确定删除“{profile.name}”？</span>
            <Button variant="ghost" size="sm" onClick={() => setDeleteArmed(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>确认删除</Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" className="self-start" onClick={() => setDeleteArmed(true)}>
            <Trash2 />删除模式
          </Button>
        )}
      </EditorSection>
    </EditorSheet>
  )
}

function ItemList({ items, selectedIds, onToggle, empty }: {
  items: ItemRef[]
  selectedIds: string[]
  onToggle: (key: string) => void
  empty: string
}): React.JSX.Element {
  if (items.length === 0) return <p className="py-2 text-xs text-muted-foreground">{empty}</p>

  return (
    <div className="border-y border-border">
      {items.map((item, index) => {
        const included = selectedIds.includes(item.key)
        return (
          <label key={item.key} className={cn('flex min-h-11 cursor-pointer items-center gap-3 py-2', index > 0 && 'border-t border-border')}>
            <Checkbox checked={included} onCheckedChange={() => onToggle(item.key)} />
            <span className={cn('min-w-0 flex-1 truncate text-sm', !included && 'text-muted-foreground')}>{item.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{item.enabled ? '当前开启' : '当前关闭'}</span>
          </label>
        )
      })}
    </div>
  )
}
