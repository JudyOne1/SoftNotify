import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface WheelProps {
  /** 当前值 */
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
 * 滚轮选择器：iOS 风格滚动列，滚动吸附 + 中心高亮（拟物凹槽带）。
 * 高度固定 4 行（7rem），上下补位让首尾项也能滚到中心。
 */
export function Wheel({ value, min, max, step = 1, onChange, label, className }: WheelProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  /** 由内部滚动触发的 onChange 刚发出的值，防止外部同步又把滚动条拉回去 */
  const pending = useRef<number | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = Math.floor((max - min) / step) + 1
  const index = Math.round((value - min) / step)

  /** 滚动到指定 index（立即或平滑） */
  function scrollToIndex(idx: number, smooth = false): void {
    listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    if (pending.current === value) {
      pending.current = null
      return
    }
    scrollToIndex(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max, step])

  function settle(): void {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = listRef.current
      if (!el) return
      const idx = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      const v = min + idx * step
      if (v !== value) {
        pending.current = v
        onChange(v)
      }
    }, 120)
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
          onScroll={settle}
        >
          {Array.from({ length: count }, (_, i) => {
            const v = min + i * step
            const selected = v === value
            return (
              <div
                key={v}
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex h-7 cursor-default items-center justify-center text-[13px] tabular-nums transition-colors',
                  selected ? 'font-semibold text-primary' : 'text-muted-foreground'
                )}
                style={{ scrollSnapAlign: 'start' }}
                onClick={() => {
                  pending.current = v
                  onChange(v)
                  scrollToIndex(i, true)
                }}
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
