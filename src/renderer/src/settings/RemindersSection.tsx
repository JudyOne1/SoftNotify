import { useEffect, useState } from 'react'
import type { ReminderItem, SoundPreset } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Wheel } from '@/components/ui/wheel'
import { cn } from '@/lib/utils'
import { newId } from './util'

const SOUND_PRESETS: Array<{ value: SoundPreset; label: string }> = [
  { value: 'classic', label: '经典双音' },
  { value: 'windchime', label: '风铃' },
  { value: 'water', label: '水滴' },
  { value: 'knock', label: '木鱼' },
  { value: 'musicbox', label: '八音盒' }
]

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
        intervalSeconds: preset ? preset.intervalMinutes * 60 : 1800,
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

function formatNext(at: number | null): string {
  if (!at) return '—'
  const d = new Date(at)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return hm
  if (d.toDateString() === tomorrow.toDateString()) return `明天 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

/** 间隔秒数 → 轮盘的天/时/分/秒分解 */
function decompose(seconds: number): { d: number; h: number; m: number; s: number } {
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return { d, h, m, s }
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [nextAt, setNextAt] = useState<number | null>(null)

  const { d, h, m, s } = decompose(item.intervalSeconds)

  function commit(): void {
    if (name !== item.name || texts !== item.texts.join('\n') || nightTexts !== (item.nightTexts ?? []).join('\n')) {
      onChange({
        name,
        texts: texts.split('\n').map((t) => t.trim()),
        nightTexts: nightTexts.split('\n').map((t) => t.trim())
      })
    }
  }

  /** 轮盘变化 → 汇总为秒数（最小 5s） */
  function setIntervalParts(part: Partial<{ d: number; h: number; m: number; s: number }>): void {
    const cur = decompose(item.intervalSeconds)
    const n = { ...cur, ...part }
    const total = Math.max(5, n.d * 86_400 + n.h * 3600 + n.m * 60 + n.s)
    onChange({ intervalSeconds: total })
  }

  /** 下次提醒时间：挂载/参数变化/每分钟刷新 */
  useEffect(() => {
    let alive = true
    const refresh = (): void => {
      void window.notifyAPI.nextFireFor(item.id).then((t) => {
        if (alive) setNextAt(t)
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
        <Select value={item.priority ?? 'normal'} onValueChange={(v) => onChange({ priority: v === 'high' ? 'high' : undefined })}>
          <SelectTrigger className="text-[13px]" title="重要提醒更大更慢，可联动系统通知">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">普通</SelectItem>
            <SelectItem value="high">重要</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 间隔轮盘：天/时/分/秒 + 下次提醒 */}
      <div className="mt-3 flex items-start gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          <Wheel label="天" value={d} min={0} max={7} onChange={(v) => setIntervalParts({ d: v })} />
          <Wheel label="时" value={h} min={0} max={23} onChange={(v) => setIntervalParts({ h: v })} />
          <Wheel label="分" value={m} min={0} max={59} onChange={(v) => setIntervalParts({ m: v })} />
          <Wheel label="秒" value={s} min={0} max={59} step={5} onChange={(v) => setIntervalParts({ s: v })} />
        </div>
        <div className="flex w-[104px] flex-none flex-col gap-1.5 pt-0.5">
          <div className="text-[11px] text-muted-foreground">下次提醒</div>
          <div className="text-sm font-semibold tabular-nums">{formatNext(nextAt)}</div>
          <Input
            type="datetime-local"
            title="设置起始计算时间，此后按间隔顺延"
            className="h-7 px-1.5 text-xs"
            value={item.anchorAt ? toLocalInput(item.anchorAt) : ''}
            onChange={(e) => {
              const t = new Date(e.target.value).getTime()
              onChange({ anchorAt: Number.isFinite(t) && t > 0 ? t : undefined })
            }}
          />
          {item.anchorAt && (
            <button
              type="button"
              className="cursor-pointer text-left text-[11px] text-muted-foreground hover:text-primary"
              onClick={() => onChange({ anchorAt: undefined })}
            >
              ↻ 清除锚点，从现在起算
            </button>
          )}
        </div>
      </div>

      <Textarea
        rows={2}
        className="mt-2.5"
        value={texts}
        placeholder="每行一条弹幕文案，留空则使用内置通用文案"
        onChange={(e) => setTexts(e.target.value)}
        onBlur={commit}
      />

      <div className="mt-1.5 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMoreOpen(!moreOpen)}>
          更多 {moreOpen ? '▴' : '▾'}
        </Button>
        <Button variant="link" size="sm" className="h-auto" onClick={() => onTest(item.id)}>
          试一下
        </Button>
      </div>

      {/* 更多设置：动效展开 */}
      <div className={cn('grid transition-all duration-200', moreOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <div className="mt-1 flex flex-col gap-2.5 border-t border-border/40 pt-2.5">
            <label className="flex items-center justify-between text-xs text-muted-foreground">
              每日目标
              <span className="flex items-center gap-1.5">
                <input
                  key={`${item.id}-${item.dailyGoal ?? ''}`}
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={item.dailyGoal ?? ''}
                  placeholder="不限"
                  className="h-7 w-16 rounded-md bg-transparent px-1.5 text-center text-xs text-foreground shadow-[var(--neu-inset-sm)] outline-none"
                  onBlur={(e) => {
                    const v = Math.round(Number(e.target.value))
                    onChange({ dailyGoal: Number.isFinite(v) && v >= 1 ? v : undefined })
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                次
              </span>
            </label>
            <label className="flex items-center justify-between text-xs text-muted-foreground">
              提示音色
              <Select
                value={item.soundPreset ?? 'global'}
                onValueChange={(v) => onChange({ soundPreset: v === 'global' ? undefined : (v as SoundPreset) })}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">跟随全局</SelectItem>
                  {SOUND_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              夜间文案（22:00-06:00 优先）
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setNightOpen(!nightOpen)}>
                {nightOpen ? '收起' : item.nightTexts?.length ? '已设置 ●' : '设置'}
              </Button>
            </div>
            {nightOpen && (
              <Textarea
                rows={2}
                value={nightTexts}
                placeholder="每行一条，留空沿用上面的文案"
                onChange={(e) => setNightTexts(e.target.value)}
                onBlur={commit}
              />
            )}
            <Button variant="destructive" size="sm" className="justify-center" onClick={onDelete}>
              删除该提醒
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function toLocalInput(ms: number): string {
  const dt = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
