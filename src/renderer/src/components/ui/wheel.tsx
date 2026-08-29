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
 * 同步规则（保证数字一一对应、不被打断）：
 * - 显示位置由受控 value 驱动，但**用户操作期间（400ms）绝不回写滚动位置**——
 *   这是修复「划不回 0/1/2」的关键：旧实现每次提交后强制校准，手指还没离开就被拽走。
 * - 用户滚动静止 120ms 后提交最终值，并显式平滑滚到中心（保证吸附手感，
 *   不依赖浏览器 scroll-snap 在鼠标滚轮下的不确定表现）。
 * - 程序化滚动的事件回读值恒等于当前 value，天然不会造成回环。
 */
export function Wheel({ value, min, max, step = 1, onChange, label, className }: WheelProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const userActive = useRef(false)
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = Math.floor((max - min) / step) + 1
  const index = Math.min(count - 1, Math.max(0, Math.round((value - min) / step)))

  /** 校准滚动位置到受控值（仅外部来源的变化：预设下拉、模式应用等） */
  useEffect(() => {
    if (userActive.current) return
    const el = listRef.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target
  }, [index, min, max, step])

  function markUser(): void {
    userActive.current = true
    if (userTimer.current) clearTimeout(userTimer.current)
    userTimer.current = setTimeout(() => {
      userActive.current = false
    }, 400)
  }

  function onScroll(): void {
    const el = listRef.current
    if (!el) return
    const idx = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
    const v = min + idx * step
    if (v === value) return // 程序化校准产生的事件：值一致，忽略
    markUser()
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const finalIdx = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      onChange(min + finalIdx * step)
      // 显式吸附到中心，保证手感
      el.scrollTo({ top: finalIdx * ITEM_H, behavior: 'smooth' })
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
          className="h-full touch-none overflow-y-auto overscroll-contain py-[42px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'y mandatory' }}
          onWheel={markUser}
          onPointerDown={markUser}
          onTouchStart={markUser}
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
                onClick={() => {
                  markUser()
                  onChange(v)
                  listRef.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
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
