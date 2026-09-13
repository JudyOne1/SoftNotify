import { useEffect, useRef, useState } from 'react'
import { Clock3, Flag, Pencil, Play, Target, Trash2 } from 'lucide-react'
import type { ReminderItem, SoundPreset } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import { CreateMenu, type CreateMenuOption } from '@/components/create-menu'
import { EditorRow, EditorSection, EditorSheet } from '@/components/editor-sheet'
import { GoalInput } from '@/components/goal-input'
import { DateTimeField } from '@/components/time-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Wheel } from '@/components/ui/wheel'
import { cn } from '@/lib/utils'
import { SOUND_PRESETS } from '../audio/chime'
import { newId } from './util'

const INTERVAL_PRESETS: Array<{ value: number; label: string }> = [
  { value: 300, label: '5 分钟' },
  { value: 900, label: '15 分钟' },
  { value: 1800, label: '30 分钟' },
  { value: 2700, label: '45 分钟' },
  { value: 3600, label: '1 小时' },
  { value: 5400, label: '1.5 小时' },
  { value: 7200, label: '2 小时' },
  { value: 10800, label: '3 小时' },
  { value: 14400, label: '4 小时' },
  { value: 21600, label: '6 小时' },
  { value: 43200, label: '12 小时' },
  { value: 86400, label: '24 小时' }
]

const CREATE_OPTIONS: Array<CreateMenuOption<'blank' | number>> = [
  { value: 'blank', label: '空白提醒', hint: '从默认的 30 分钟间隔开始配置' },
  ...REMINDER_PRESETS.map((preset, index) => ({
    value: index,
    label: preset.name,
    hint: `每 ${preset.intervalMinutes} 分钟，包含预设文案`
  }))
]

interface Props {
  reminders: ReminderItem[]
  onChange: (next: ReminderItem[]) => void
  onTest: (id: string) => void
}

export default function RemindersSection({ reminders, onChange, onTest }: Props): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = reminders.find((item) => item.id === selectedId) ?? null

  function update(id: string, patch: Partial<ReminderItem>): void {
    onChange(reminders.map((reminder) => (reminder.id === id ? { ...reminder, ...patch } : reminder)))
  }

  function add(presetIndex: number | null): void {
    const preset = presetIndex === null ? null : REMINDER_PRESETS[presetIndex]
    const id = newId()
    onChange([
      ...reminders,
      {
        id,
        name: preset?.name ?? '新提醒',
        enabled: true,
        intervalSeconds: preset ? preset.intervalMinutes * 60 : 1800,
        texts: preset ? [...preset.texts] : []
      }
    ])
    setSelectedId(id)
  }

  useEffect(() => {
    if (selectedId && !reminders.some((item) => item.id === selectedId)) setSelectedId(null)
  }, [reminders, selectedId])

  return (
    <>
      <div className="mb-3 flex justify-end">
        <CreateMenu
          label="添加提醒"
          options={CREATE_OPTIONS}
          onSelect={(value) => add(value === 'blank' ? null : value)}
        />
      </div>

      {reminders.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          {reminders.map((item, index) => (
            <ReminderRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              divided={index > 0}
              onChange={(patch) => update(item.id, patch)}
              onEdit={() => setSelectedId(item.id)}
              onTest={() => onTest(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm font-medium">还没有间隔提醒</p>
          <p className="mt-1 text-xs text-muted-foreground">从右上角添加一个空白提醒或使用预设</p>
        </div>
      )}

      {selected && (
        <ReminderEditor
          key={selected.id}
          item={selected}
          onChange={(patch) => update(selected.id, patch)}
          onClose={() => setSelectedId(null)}
          onDelete={() => onChange(reminders.filter((reminder) => reminder.id !== selected.id))}
        />
      )}
    </>
  )
}

function ReminderRow({ item, selected, divided, onChange, onEdit, onTest }: {
  item: ReminderItem
  selected: boolean
  divided: boolean
  onChange: (patch: Partial<ReminderItem>) => void
  onEdit: () => void
  onTest: () => void
}): React.JSX.Element {
  const [nextAt, setNextAt] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = (): void => {
      void window.notifyAPI.nextFireFor(item.id).then((time) => {
        if (alive) setNextAt(time)
      }).catch(() => {
        if (alive) setNextAt(null)
      })
    }
    refresh()
    const timer = setInterval(refresh, 60_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [item.id, item.intervalSeconds, item.anchorAt, item.enabled])

  return (
    <article className={cn(
      'flex min-h-[70px] items-center gap-3 px-3.5 py-2.5 transition-colors',
      divided && 'border-t border-border',
      selected && 'bg-accent/55',
      !item.enabled && 'opacity-60'
    )}>
      <Switch
        checked={item.enabled}
        aria-label={item.enabled ? `停用${item.name}` : `启用${item.name}`}
        onCheckedChange={(value) => onChange({ enabled: value })}
      />
      <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={onEdit}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name || '未命名提醒'}</span>
          {item.priority === 'high' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] text-amber-500">
              <Flag className="size-3" />重要
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />每 {describeSeconds(item.intervalSeconds)}</span>
          <span className="tabular-nums">{item.enabled ? `下次 ${formatNext(nextAt)}` : '已暂停'}</span>
          {item.dailyGoal && <span className="inline-flex items-center gap-1"><Target className="size-3" />{item.dailyGoal}/天</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon" title="发送测试提醒" aria-label={`测试${item.name}`} onClick={onTest}>
          <Play />
        </Button>
        <Button variant="ghost" size="icon" title="编辑提醒" aria-label={`编辑${item.name}`} onClick={onEdit}>
          <Pencil />
        </Button>
      </div>
    </article>
  )
}

function ReminderEditor({ item, onChange, onClose, onDelete }: {
  item: ReminderItem
  onChange: (patch: Partial<ReminderItem>) => void
  onClose: () => void
  onDelete: () => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))
  const [deleteArmed, setDeleteArmed] = useState(false)
  const lastCommitted = useRef({ name: item.name, texts: item.texts.join('\n'), nightTexts: (item.nightTexts ?? []).join('\n') })
  const { d, h, m, s } = decompose(item.intervalSeconds)
  const presetMatch = INTERVAL_PRESETS.find((preset) => preset.value === item.intervalSeconds)
  const selectValue = presetMatch ? String(presetMatch.value) : 'custom'

  function commitDrafts(): void {
    const previous = lastCommitted.current
    if (name === previous.name && texts === previous.texts && nightTexts === previous.nightTexts) return
    lastCommitted.current = { name, texts, nightTexts }
    onChange({
      name: name.trim() || '未命名提醒',
      texts: splitLines(texts),
      nightTexts: splitLines(nightTexts)
    })
  }

  function close(): void {
    commitDrafts()
    onClose()
  }

  function setIntervalParts(part: Partial<{ d: number; h: number; m: number; s: number }>): void {
    const next = { ...decompose(item.intervalSeconds), ...part }
    onChange({ intervalSeconds: Math.max(5, next.d * 86_400 + next.h * 3600 + next.m * 60 + next.s) })
  }

  return (
    <EditorSheet open title={name || '未命名提醒'} description="间隔提醒" onClose={close}>
      <EditorSection title="基础">
        <Field label="名称">
          <Input
            value={name}
            maxLength={20}
            placeholder="提醒名称"
            onChange={(event) => setName(event.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </Field>
        <EditorRow label="启用提醒">
          <Switch checked={item.enabled} onCheckedChange={(value) => onChange({ enabled: value })} />
        </EditorRow>
        <EditorRow label="提醒间隔">
          <Select value={selectValue} onValueChange={(value) => {
            if (value !== 'custom') onChange({ intervalSeconds: Number(value) })
          }}>
            <SelectTrigger className="min-w-40 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {presetMatch && <SelectItem value={String(presetMatch.value)}>{presetMatch.label}</SelectItem>}
              <SelectItem value="custom">自定义（{describeSeconds(item.intervalSeconds)}）</SelectItem>
              {INTERVAL_PRESETS.filter((preset) => preset.value !== item.intervalSeconds).map((preset) => (
                <SelectItem key={preset.value} value={String(preset.value)}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditorRow>
        <Field label="时间精调" hint="用于预设之外的精确间隔">
          <div className="grid grid-cols-4 gap-1.5">
            <Wheel label="天" value={d} min={0} max={7} onChange={(value) => setIntervalParts({ d: value })} />
            <Wheel label="时" value={h} min={0} max={23} onChange={(value) => setIntervalParts({ h: value })} />
            <Wheel label="分" value={m} min={0} max={59} onChange={(value) => setIntervalParts({ m: value })} />
            <Wheel label="秒" value={s} min={0} max={59} step={5} onChange={(value) => setIntervalParts({ s: value })} />
          </div>
        </Field>
        <Field label="起始时间" hint="留空时从当前时间起算；设置后会按整周期顺延">
          <div className="flex flex-col gap-2">
            <DateTimeField value={item.anchorAt} onChange={(milliseconds) => onChange({ anchorAt: milliseconds })} />
            {item.anchorAt && (
              <Button variant="link" size="sm" className="h-auto self-start p-0" onClick={() => onChange({ anchorAt: undefined })}>
                恢复从当前时间起算
              </Button>
            )}
          </div>
        </Field>
      </EditorSection>

      <EditorSection title="内容" hint="每行一条，触发时随机选取；留空则使用内置文案">
        <Field label="普通文案">
          <Textarea rows={4} value={texts} placeholder="例如：起来活动一下吧" onChange={(event) => setTexts(event.target.value)} onBlur={commitDrafts} />
        </Field>
        <Field label="夜间文案" hint="22:00 至 06:00 优先使用，留空则沿用普通文案">
          <Textarea rows={3} value={nightTexts} placeholder="例如：时间不早了，注意休息" onChange={(event) => setNightTexts(event.target.value)} onBlur={commitDrafts} />
        </Field>
      </EditorSection>

      <EditorSection title="目标与提醒方式">
        <EditorRow label="每日目标" hint="留空表示不设打卡目标">
          <GoalInput value={item.dailyGoal} onChange={(value) => onChange({ dailyGoal: value })} />
        </EditorRow>
        <EditorRow label="重要程度" hint="重要提醒显示更醒目，可联动系统通知">
          <Select value={item.priority ?? 'normal'} onValueChange={(value) => onChange({ priority: value === 'high' ? 'high' : undefined })}>
            <SelectTrigger className="min-w-28 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">普通</SelectItem>
              <SelectItem value="high">重要</SelectItem>
            </SelectContent>
          </Select>
        </EditorRow>
        <EditorRow label="提示音色">
          <Select value={item.soundPreset ?? 'global'} onValueChange={(value) => onChange({ soundPreset: value === 'global' ? undefined : (value as SoundPreset) })}>
            <SelectTrigger className="min-w-32 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">跟随全局</SelectItem>
              {SOUND_PRESETS.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </EditorRow>
      </EditorSection>

      <EditorSection title="高级">
        <EditorRow label="严格模式" hint="弹幕不可忽略，只能完成或贪睡">
          <Switch checked={item.strict ?? false} onCheckedChange={(value) => onChange({ strict: value || undefined })} />
        </EditorRow>
      </EditorSection>

      <EditorSection title="危险操作" tone="danger">
        {deleteArmed ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-destructive/8 px-3 py-2.5">
            <span className="mr-auto text-xs text-destructive">确定删除“{item.name}”？</span>
            <Button variant="ghost" size="sm" onClick={() => setDeleteArmed(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>确认删除</Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" className="self-start" onClick={() => setDeleteArmed(true)}>
            <Trash2 />删除提醒
          </Button>
        )}
      </EditorSection>
    </EditorSheet>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm">{label}</span>
      {hint && <span className="-mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
      {children}
    </label>
  )
}

function splitLines(value: string): string[] {
  return value.split('\n').map((text) => text.trim())
}

function formatNext(at: number | null): string {
  if (!at) return '待计算'
  const date = new Date(at)
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return `今天 ${hm}`
  if (date.toDateString() === tomorrow.toDateString()) return `明天 ${hm}`
  return `${date.getMonth() + 1}/${date.getDate()} ${hm}`
}

function decompose(seconds: number): { d: number; h: number; m: number; s: number } {
  return {
    d: Math.floor(seconds / 86_400),
    h: Math.floor((seconds % 86_400) / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60
  }
}

function describeSeconds(seconds: number): string {
  const { d, h, m, s } = decompose(seconds)
  const parts: string[] = []
  if (d) parts.push(`${d} 天`)
  if (h) parts.push(`${h} 小时`)
  if (m) parts.push(`${m} 分钟`)
  if (s) parts.push(`${s} 秒`)
  return parts.join(' ') || `${seconds} 秒`
}
