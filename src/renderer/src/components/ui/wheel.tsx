import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface WheelProps {
  /** 当前值（受控：显示位置完全由它决定） */
  value: number
  min: number
  max: number
  /** 步进（默认 1） */
  step?: number
  onChange: (value: number) => void
  label: string
  className?: string
}

const ITEM_H = 28

/**
 * 滚轮选择器：中心高亮 + 滚动吸附。
 * 同步规则（保证数字一一对应）：
 * - 显示位置完全由受控 value 驱动（effect 把 scrollTop 校准到 index×行高）；
 * - 用户滚动只负责「提交」：静止 120ms 后读最终位置回传 onChange；
 * - 程序化滚动产生的事件回读值恒等于 value，天然不会造成回环。
 */
export function Wheel({ value, min, max, step = 1, onChange, label, className }: WheelProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = Math.floor((max - min) / step) + 1
  const index = Math.min(count - 1, Math.max(0, Math.round((value - min) / step)))

  /** 校准滚动位置到受控值 */
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target
  }, [index, min, max, step])

  function onScroll(): void {
    const el = listRef.current
    if (!el) return
    const idx = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
    const v = min + idx * step
    if (v !== value) {
      if (settle.current) clearTimeout(settle.current)
      settle.current = setTimeout(() => onChange(v), 120)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <div className="relative h-28 w-full overflow-hidden rounded-md bg-transparent shadow-[var(--neu-inset-sm)]">
        {/* 中心高亮带 */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-7 -translate-y-1/2 rounded-sm bg-primary/10" />
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="h-full overflow-y-auto py-[42px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'y mandatory' }}
          onScroll={onScroll}
        >
          {Array.from({ length: count }, (_, i) => {
            const v = min + i * step
            return (
              <div
                key={v}
                role="option"
                aria-selected={v === value}
                className={cn(
                  'flex h-7 cursor-default items-center justify-center text-[13px] tabular-nums transition-colors',
                  v === value ? 'font-semibold text-primary' : 'text-muted-foreground'
                )}
                style={{ scrollSnapAlign: 'start' }}
                onClick={() => onChange(v)}
              >
                {v}
              </div>
            )
          })}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
