import { useState } from 'react'
import type { ScheduleItem } from '@shared/types'
import { SCHEDULE_PRESETS } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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

interface Props {
  schedules: ScheduleItem[]
  onChange: (next: ScheduleItem[]) => void
  onTest: (id: string) => void
}

export default function SchedulesSection({ schedules, onChange, onTest }: Props): React.JSX.Element {
  function update(id: string, p: Partial<ScheduleItem>): void {
    onChange(schedules.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }

  function add(presetIndex: 'blank' | 'countdown' | number): void {
    let item: ScheduleItem
    if (presetIndex === 'countdown') {
      item = {
        id: newId(),
        name: '倒计时',
        enabled: true,
        time: timeIso(30),
        weekdays: [],
        date: todayIso(30),
        texts: ['时间到啦！'],
        ignoreQuiet: false
      }
    } else if (presetIndex === 'blank') {
      item = { id: newId(), name: '新日程', enabled: true, time: '09:00', weekdays: [], texts: [], ignoreQuiet: false }
    } else {
      const preset = SCHEDULE_PRESETS[presetIndex]
      item = {
        id: newId(),
        name: preset.name,
        enabled: true,
        time: preset.time,
        weekdays: [...preset.weekdays],
        texts: [...preset.texts],
        ignoreQuiet: preset.ignoreQuiet === true
      }
    }
    onChange([...schedules, item])
  }

  return (
    <>
      <div className="mt-3 mb-2.5 flex flex-col gap-3">
        {schedules.map((item) => (
          <ScheduleCard
            key={item.id}
            item={item}
            onChange={(p) => update(item.id, p)}
            onDelete={() => onChange(schedules.filter((s) => s.id !== item.id))}
            onTest={onTest}
          />
        ))}
        {schedules.length === 0 && (
          <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset)]">
            还没有定时日程，从下面添加一个吧
          </div>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => add('countdown')}>
          ＋ 倒计时（30 分钟）
        </Button>
        <Button variant="secondary" size="sm" onClick={() => add('blank')}>
          ＋ 空白日程
        </Button>
        {SCHEDULE_PRESETS.map((p, i) => (
          <Button key={p.name} variant="secondary" size="sm" onClick={() => add(i)}>
            ＋ {p.name}
          </Button>
        ))}
      </div>
    </>
  )
}

function ScheduleCard({
  item,
  onChange,
  onDelete,
  onTest
}: {
  item: ScheduleItem
  onChange: (p: Partial<ScheduleItem>) => void
  onDelete: () => void
  onTest: (id: string) => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightOpen, setNightOpen] = useState(false)
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))

  function commit(): void {
    if (name !== item.name || texts !== item.texts.join('\n') || nightTexts !== (item.nightTexts ?? []).join('\n')) {
      onChange({
        name,
        texts: texts.split('\n').map((t) => t.trim()),
        nightTexts: nightTexts.split('\n').map((t) => t.trim())
      })
    }
  }

  const isOnce = !!item.date
  function toggleOnce(on: boolean): void {
    onChange(on ? { date: item.date ?? todayIso() } : { date: undefined })
  }

  function toggleWeekday(v: number): void {
    const set = new Set(item.weekdays)
    if (set.has(v)) set.delete(v)
    else set.add(v)
    onChange({ weekdays: [...set] })
  }

  return (
    <div className={`rounded-lg bg-card p-3.5 shadow-[var(--neu-raised)] transition-[filter] hover:brightness-110 ${item.enabled ? '' : 'opacity-55'}`}>
      <div className="flex items-center gap-2.5">
        <Switch checked={item.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
        <Input
          value={name}
          maxLength={20}
          placeholder="日程名称"
          className="flex-1"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <input
          type="time"
          className="h-9 rounded-md bg-transparent px-2 text-sm shadow-[var(--neu-inset-sm)]"
          value={item.time}
          onChange={(e) => onChange({ time: e.target.value })}
        />
        <Button variant="destructive" size="icon" title="删除" onClick={onDelete}>
          ✕
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <Label className="text-[13px] text-muted-foreground">
          <Switch checked={isOnce} onCheckedChange={toggleOnce} />
          单次
        </Label>
        {isOnce ? (
          <input
            type="date"
            className="h-9 rounded-md bg-transparent px-2 text-sm shadow-[var(--neu-inset-sm)]"
            value={item.date}
            min={todayIso()}
            onChange={(e) => onChange({ date: e.target.value || todayIso() })}
          />
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                type="button"
                title={item.weekdays.length === 0 ? '当前：每天（点选可指定周几）' : undefined}
                onClick={() => toggleWeekday(w.value)}
                className={cn(
                  'cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all',
                  item.weekdays.includes(w.value)
                    ? 'bg-primary/20 text-primary shadow-[var(--neu-inset-sm)]'
                    : 'bg-card text-muted-foreground shadow-[var(--neu-raised-sm)] hover:text-foreground'
                )}
              >
                {w.label}
              </button>
            ))}
            <span className="ml-1 text-xs text-muted-foreground">
              {item.weekdays.length === 0 ? '每天' : '周几触发'}
            </span>
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center">
        <Label className="text-[13px] text-muted-foreground">
          <Switch checked={item.ignoreQuiet} onCheckedChange={(v) => onChange({ ignoreQuiet: v })} />
          忽略安静时段
        </Label>
      </div>
      <Textarea
        rows={2}
        className="mt-2.5"
        value={texts}
        placeholder="每行一条弹幕文案，留空则使用内置通用文案"
        onChange={(e) => setTexts(e.target.value)}
        onBlur={commit}
      />
      <div className="mt-1.5 flex justify-end gap-1">
        <Button variant="link" size="sm" className="h-auto text-muted-foreground hover:text-foreground" onClick={() => setNightOpen(!nightOpen)}>
          {nightOpen ? '收起夜间文案' : item.nightTexts?.length ? '夜间文案 ●' : '夜间文案'}
        </Button>
        <Button variant="link" size="sm" className="h-auto" onClick={() => onTest(item.id)}>
          试一下
        </Button>
      </div>
      {nightOpen && (
        <Textarea
          rows={2}
          className="mt-1"
          value={nightTexts}
          placeholder="22:00-06:00 触发时优先使用，每行一条，留空沿用上面的文案"
          onChange={(e) => setNightTexts(e.target.value)}
          onBlur={commit}
        />
      )}
    </div>
  )
}
