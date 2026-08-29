import { useState } from 'react'
import type { ReminderItem } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { newId } from './util'

const INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

interface Props {
  reminders: ReminderItem[]
  onChange: (next: ReminderItem[]) => void
  onTest: (id: string) => void
}

export default function RemindersSection({ reminders, onChange, onTest }: Props): React.JSX.Element {
  function update(id: string, p: Partial<ReminderItem>): void {
    onChange(reminders.map((r) => (r.id === id ? { ...r, ...p } : r)))
  }

  function add(presetIndex: number | null): void {
    const preset = presetIndex === null ? null : REMINDER_PRESETS[presetIndex]
    onChange([
      ...reminders,
      {
        id: newId(),
        name: preset?.name ?? '新提醒',
        enabled: true,
        intervalMinutes: preset?.intervalMinutes ?? 30,
        texts: preset ? [...preset.texts] : []
      }
    ])
  }

  return (
    <>
      <div className="mt-3 mb-2.5 flex flex-col gap-3">
        {reminders.map((item) => (
          <ReminderCard
            key={item.id}
            item={item}
            onChange={(p) => update(item.id, p)}
            onDelete={() => onChange(reminders.filter((r) => r.id !== item.id))}
            onTest={onTest}
          />
        ))}
        {reminders.length === 0 && (
          <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset)]">
            还没有间隔提醒，从下面添加一个吧
          </div>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => add(null)}>
          ＋ 空白提醒
        </Button>
        {REMINDER_PRESETS.map((p, i) => (
          <Button key={p.name} variant="secondary" size="sm" onClick={() => add(i)}>
            ＋ {p.name}
          </Button>
        ))}
      </div>
    </>
  )
}

function ReminderCard({
  item,
  onChange,
  onDelete,
  onTest
}: {
  item: ReminderItem
  onChange: (p: Partial<ReminderItem>) => void
  onDelete: () => void
  onTest: (id: string) => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightOpen, setNightOpen] = useState(false)
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))

  /** 失焦/回车提交草稿，避免每次按键被服务端清洗后打断输入 */
  function commit(): void {
    if (name !== item.name || texts !== item.texts.join('\n') || nightTexts !== (item.nightTexts ?? []).join('\n')) {
      onChange({
        name,
        texts: texts.split('\n').map((t) => t.trim()),
        nightTexts: nightTexts.split('\n').map((t) => t.trim())
      })
    }
  }

  return (
    <div className={`rounded-lg bg-card p-3.5 shadow-[var(--neu-raised)] transition-[filter] hover:brightness-110 ${item.enabled ? '' : 'opacity-55'}`}>
      <div className="flex items-center gap-2.5">
        <Switch checked={item.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
        <Input
          value={name}
          maxLength={20}
          placeholder="提醒名称"
          className="flex-1"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <Select
          value={String(item.intervalMinutes)}
          onValueChange={(v) => onChange({ intervalMinutes: Number(v) })}
        >
          <SelectTrigger className="text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m < 60 ? `${m} 分钟` : `${m / 60} 小时`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="destructive" size="icon" title="删除" onClick={onDelete}>
          ✕
        </Button>
      </div>
      <Textarea
        rows={3}
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
