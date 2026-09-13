import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  start: number
  end: number
  onChange: (start: number, end: number) => void
}

type Handle = 'start' | 'end'

/**
 * 弹幕显示区域可视化选择：缩小版屏幕 + 高亮区域 + 上下拖拽手柄（类似视频裁剪）。
 * 值对齐到 5%，start ∈ [0,80]、end ∈ [20,100]、最小带宽 10%。
 */
export default function ZonePicker({ start, end, onChange }: Props): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<Handle | null>(null)
  const [draggingNow, setDraggingNow] = useState<Handle | null>(null)

  function posPct(clientY: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return start
    const p = ((clientY - rect.top) / rect.height) * 100
    return Math.round(Math.min(100, Math.max(0, p)) / 5) * 5
  }

  function beginDrag(handle: Handle, e: React.PointerEvent<HTMLDivElement>): void {
    dragging.current = handle
    setDraggingNow(handle)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>): void {
    const handle = dragging.current
    if (!handle) return
    const v = posPct(e.clientY)
    if (handle === 'start') onChange(Math.max(0, Math.min(v, end - 10)), end)
    else onChange(start, Math.min(100, Math.max(v, start + 10)))
  }

  function endDrag(): void {
    dragging.current = null
    setDraggingNow(null)
  }

  return (
    <div
      ref={trackRef}
      className="relative mx-auto aspect-video w-full max-w-[320px] select-none overflow-hidden rounded-lg bg-muted shadow-[var(--neu-inset)]"
      role="slider"
      aria-label="弹幕显示区域"
      aria-valuenow={start}
      aria-valuemin={end}
    >
      {/* 屏幕示意：中排吸管的假想内容 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/50">
        屏幕示意
      </div>
      {/* 高亮区域 */}
      <div
        className="pointer-events-none absolute inset-x-0 border-y border-primary/60 bg-primary/15"
        style={{ top: `${start}%`, height: `${end - start}%` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1 text-center text-[10px] text-primary">
          弹幕区域 {start}%-{end}%
        </div>
      </div>
      {/* 上下拖拽手柄 */}
      {(['start', 'end'] as const).map((handle) => (
        <div
          key={handle}
          role="slider"
          aria-label={handle === 'start' ? '区域开始' : '区域结束'}
          aria-valuenow={handle === 'start' ? start : end}
          tabIndex={0}
          onPointerDown={(e) => beginDrag(handle, e)}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            'absolute inset-x-0 flex h-4 cursor-ns-resize items-center justify-center touch-none',
            draggingNow === handle && 'z-10'
          )}
          style={{ top: `calc(${handle === 'start' ? start : end}% - 8px)` }}
        >
          <div className="h-1.5 w-16 rounded-full bg-primary shadow-[var(--neu-raised-sm)]" />
        </div>
      ))}
    </div>
  )
}
