import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Flag, Pencil, Play, Repeat2, Target, Trash2 } from 'lucide-react'
import type { ScheduleItem, SoundPreset } from '@shared/types'
import { SCHEDULE_PRESETS } from '@shared/templates'
import { CreateMenu, type CreateMenuOption } from '@/components/create-menu'
import { EditorRow, EditorSection, EditorSheet } from '@/components/editor-sheet'
import { GoalInput } from '@/components/goal-input'
import { TimeField } from '@/components/time-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SOUND_PRESETS } from '../audio/chime'
import { newId, timeIso, todayIso } from './util'

const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

const CREATE_OPTIONS: Array<CreateMenuOption<'countdown' | 'blank' | number>> = [
  { value: 'countdown', label: '30 分钟倒计时', hint: '创建今天触发的一次性日程' },
  { value: 'blank', label: '空白日程', hint: '从每天 09:00 开始配置' },
  ...SCHEDULE_PRESETS.map((preset, index) => ({
    value: index,
    label: preset.name,
    hint: `${preset.time} · ${describeRepeat(preset.weekdays)}`
  }))
]

interface Props {
  schedules: ScheduleItem[]
  onChange: (next: ScheduleItem[]) => void
  onTest: (id: string) => void
}

export default function SchedulesSection({ schedules, onChange, onTest }: Props): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = schedules.find((item) => item.id === selectedId) ?? null

  function update(id: string, patch: Partial<ScheduleItem>): void {
    onChange(schedules.map((schedule) => (schedule.id === id ? { ...schedule, ...patch } : schedule)))
  }

  function add(presetIndex: 'blank' | 'countdown' | number): void {
    const id = newId()
    let item: ScheduleItem
    if (presetIndex === 'countdown') {
      item = {
        id,
        name: '倒计时',
        enabled: true,
        time: timeIso(30),
        weekdays: [],
        date: todayIso(30),
        texts: ['时间到啦！'],
        ignoreQuiet: false
      }
    } else if (presetIndex === 'blank') {
      item = { id, name: '新日程', enabled: true, time: '09:00', weekdays: [], texts: [], ignoreQuiet: false }
    } else {
      const preset = SCHEDULE_PRESETS[presetIndex]
      item = {
        id,
        name: preset.name,
        enabled: true,
        time: preset.time,
        weekdays: [...preset.weekdays],
        texts: [...preset.texts],
        ignoreQuiet: preset.ignoreQuiet === true
      }
    }
    onChange([...schedules, item])
    setSelectedId(id)
  }

  useEffect(() => {
    if (selectedId && !schedules.some((item) => item.id === selectedId)) setSelectedId(null)
  }, [schedules, selectedId])

  return (
    <>
      <div className="mb-3 flex justify-end">
        <CreateMenu label="添加日程" options={CREATE_OPTIONS} onSelect={add} />
      </div>

      {schedules.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          {schedules.map((item, index) => (
            <ScheduleRow
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
          <p className="text-sm font-medium">还没有定时日程</p>
          <p className="mt-1 text-xs text-muted-foreground">添加倒计时、空白日程或使用预设</p>
        </div>
      )}

      {selected && (
        <ScheduleEditor
          key={selected.id}
          item={selected}
          onChange={(patch) => update(selected.id, patch)}
          onClose={() => setSelectedId(null)}
          onDelete={() => onChange(schedules.filter((schedule) => schedule.id !== selected.id))}
        />
      )}
    </>
  )
}

function ScheduleRow({ item, selected, divided, onChange, onEdit, onTest }: {
  item: ScheduleItem
  selected: boolean
  divided: boolean
  onChange: (patch: Partial<ScheduleItem>) => void
  onEdit: () => void
  onTest: () => void
}): React.JSX.Element {
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
          <span className="truncate text-sm font-medium">{item.name || '未命名日程'}</span>
          {item.priority === 'high' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] text-amber-500">
              <Flag className="size-3" />重要
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums"><CalendarDays className="size-3" />{item.date ? `${item.date} ${item.time}` : item.time}</span>
          <span className="inline-flex items-center gap-1"><Repeat2 className="size-3" />{item.date ? '单次' : describeRepeat(item.weekdays)}</span>
          {item.dailyGoal && <span className="inline-flex items-center gap-1"><Target className="size-3" />{item.dailyGoal}/天</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon" title="发送测试提醒" aria-label={`测试${item.name}`} onClick={onTest}>
          <Play />
        </Button>
        <Button variant="ghost" size="icon" title="编辑日程" aria-label={`编辑${item.name}`} onClick={onEdit}>
          <Pencil />
        </Button>
      </div>
    </article>
  )
}

function ScheduleEditor({ item, onChange, onClose, onDelete }: {
  item: ScheduleItem
  onChange: (patch: Partial<ScheduleItem>) => void
  onClose: () => void
  onDelete: () => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))
  const [deleteArmed, setDeleteArmed] = useState(false)
  const lastCommitted = useRef({ name: item.name, texts: item.texts.join('\n'), nightTexts: (item.nightTexts ?? []).join('\n') })
  const isOnce = !!item.date

  function commitDrafts(): void {
    const previous = lastCommitted.current
    if (name === previous.name && texts === previous.texts && nightTexts === previous.nightTexts) return
    lastCommitted.current = { name, texts, nightTexts }
    onChange({
      name: name.trim() || '未命名日程',
      texts: splitLines(texts),
      nightTexts: splitLines(nightTexts)
    })
  }

  function close(): void {
    commitDrafts()
    onClose()
  }

  function toggleWeekday(value: number): void {
    const selected = new Set(item.weekdays)
    if (selected.has(value)) selected.delete(value)
    else selected.add(value)
    onChange({ weekdays: [...selected] })
  }

  return (
    <EditorSheet open title={name || '未命名日程'} description="定时日程" onClose={close}>
      <EditorSection title="基础">
        <Field label="名称">
          <Input
            value={name}
            maxLength={20}
            placeholder="日程名称"
            onChange={(event) => setName(event.target.value)}
            onBlur={commitDrafts}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </Field>
        <EditorRow label="启用日程">
          <Switch checked={item.enabled} onCheckedChange={(value) => onChange({ enabled: value })} />
        </EditorRow>
        <EditorRow label="触发时间">
          <TimeField value={item.time} onChange={(value) => onChange({ time: value })} />
        </EditorRow>
        <EditorRow label="单次日程" hint="触发后自动停用；关闭则按星期重复">
          <Switch checked={isOnce} onCheckedChange={(value) => onChange(value ? { date: item.date ?? todayIso() } : { date: undefined })} />
        </EditorRow>
        {isOnce ? (
          <EditorRow label="触发日期">
            <input
              type="date"
              className="h-9 rounded-md bg-transparent px-2 text-sm shadow-[var(--neu-inset-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={item.date}
              min={todayIso()}
              onChange={(event) => onChange({ date: event.target.value || todayIso() })}
            />
          </EditorRow>
        ) : (
          <Field label="重复日期" hint={describeRepeat(item.weekdays)}>
            <div className="flex flex-wrap items-center gap-1.5">
              {WEEKDAYS.map((weekday) => {
                const selected = item.weekdays.includes(weekday.value)
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    aria-label={`星期${weekday.label}`}
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(weekday.value)}
                    className={cn(
                      'flex size-9 cursor-pointer items-center justify-center rounded-md text-xs transition-colors',
                      selected ? 'bg-primary/15 font-medium text-primary' : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {weekday.label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
      </EditorSection>

      <EditorSection title="内容" hint="每行一条，触发时随机选取；留空则使用内置文案">
        <Field label="普通文案">
          <Textarea rows={4} value={texts} placeholder="例如：该准备出发了" onChange={(event) => setTexts(event.target.value)} onBlur={commitDrafts} />
        </Field>
        <Field label="夜间文案" hint="22:00 至 06:00 优先使用，留空则沿用普通文案">
          <Textarea rows={3} value={nightTexts} placeholder="例如：今天辛苦了，早点休息" onChange={(event) => setNightTexts(event.target.value)} onBlur={commitDrafts} />
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
        <EditorRow label="忽略安静时段" hint="适合睡觉、服药等必须触发的日程">
          <Switch checked={item.ignoreQuiet} onCheckedChange={(value) => onChange({ ignoreQuiet: value })} />
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
            <Trash2 />删除日程
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

function describeRepeat(weekdays: number[]): string {
  if (weekdays.length === 0 || weekdays.length === 7) return '每天'
  const workdays = [1, 2, 3, 4, 5]
  if (workdays.every((day) => weekdays.includes(day)) && weekdays.length === workdays.length) return '工作日'
  const ordered = WEEKDAYS.filter((weekday) => weekdays.includes(weekday.value)).map((weekday) => weekday.label)
  return `周${ordered.join('、')}`
}
