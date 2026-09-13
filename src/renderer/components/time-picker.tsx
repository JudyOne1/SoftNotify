import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import type { WheelPickerOption } from '@ncdai/react-wheel-picker'
import { Wheel } from '@/components/ui/wheel'
import { cn } from '@/lib/utils'

const pad = (n: number): string => String(n).padStart(2, '0')

function parseTime(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map((s) => Number(s))
  return {
    h: Number.isFinite(h) && h >= 0 && h < 24 ? h : 9,
    m: Number.isFinite(m) && m >= 0 && m < 60 ? m : 0
  }
}

const panelClass = 'z-50 rounded-lg bg-popover p-3 shadow-[var(--neu-raised)] ring-1 ring-[var(--border)]'

/** 拟物凹槽触发器：显示当前值，点开轮盘弹层 */
function Trigger({
  text,
  disabled,
  className
}: {
  text: string
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <Popover.Trigger asChild>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs tabular-nums text-foreground shadow-[var(--neu-inset-sm)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <span aria-hidden className="text-muted-foreground">🕘</span>
        {text}
      </button>
    </Popover.Trigger>
  )
}

/** 时刻选择（HH:MM）：时 + 分双轮盘，滚动即保存 */
export function TimeField({
  value,
  onChange,
  disabled,
  className
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  const { h, m } = parseTime(value)
  return (
    <Popover.Root>
      <Trigger text={`${pad(h)}:${pad(m)}`} disabled={disabled} className={className} />
      <Popover.Portal>
        <Popover.Content sideOffset={6} className={panelClass}>
          <div className="grid w-36 grid-cols-2 gap-2">
            <Wheel label="时" value={h} min={0} max={23} onChange={(v) => onChange(`${pad(v)}:${pad(m)}`)} />
            <Wheel label="分" value={m} min={0} max={59} onChange={(v) => onChange(`${pad(h)}:${pad(v)}`)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** 相对今天的天数 → 显示标签 */
function dayLabel(offset: number): string {
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 天轮盘：今天起 14 天，选项标签随日历计算 */
function DayWheel({ value, onChange }: { value: number; onChange: (offset: number) => void }): React.JSX.Element {
  const options = useMemo<WheelPickerOption<number>[]>(
    () => Array.from({ length: 14 }, (_, i) => ({ value: i, label: dayLabel(i) })),
    []
  )
  return (
    <div className="flex flex-col items-center gap-0.5">
      <WheelPickerWrapper className="h-[85px] w-full items-center rounded-md shadow-[var(--neu-inset-sm)]">
        <WheelPicker
          options={options}
          value={value}
          onValueChange={(v) => onChange(Number(v))}
          optionItemHeight={32}
          visibleCount={8}
          classNames={{
            optionItem: 'text-[13px] tabular-nums text-muted-foreground',
            highlightItem: 'text-sm tabular-nums font-semibold text-primary',
            highlightWrapper:
              'before:content-[""] before:absolute before:inset-x-1 before:inset-y-0 before:rounded-md before:bg-primary/10'
          }}
        />
      </WheelPickerWrapper>
      <span className="text-[11px] text-muted-foreground">天</span>
    </div>
  )
}

/** 起始时间选择（epoch ms）：天[今天起 14 天] + 时 + 分三轮盘 */
export function DateTimeField({
  value,
  onChange,
  className
}: {
  value: number | undefined
  onChange: (ms: number) => void
  className?: string
}): React.JSX.Element {
  // 未设置时以「现在」作为轮盘初始值
  const now = value ? new Date(value) : new Date()
  const today = new Date()
  const dayOffset = Math.min(
    13,
    Math.max(
      0,
      Math.round(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
          86_400_000
      )
    )
  )
  const [open, setOpen] = useState(false)

  function commit(offset: number, h: number, m: number): void {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(h, m, 0, 0)
    onChange(d.getTime())
  }

  const display = value
    ? `${dayLabel(dayOffset)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    : '未设置（从现在起）'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Trigger text={display} className={className} />
      <Popover.Portal>
        <Popover.Content sideOffset={6} className={panelClass}>
          <div className="grid w-56 grid-cols-3 gap-2">
            <DayWheel value={dayOffset} onChange={(offset) => commit(offset, now.getHours(), now.getMinutes())} />
            <Wheel label="时" value={now.getHours()} min={0} max={23} onChange={(v) => commit(dayOffset, v, now.getMinutes())} />
            <Wheel label="分" value={now.getMinutes()} min={0} max={59} onChange={(v) => commit(dayOffset, now.getHours(), v)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
