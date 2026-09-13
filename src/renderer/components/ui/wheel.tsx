import { useMemo } from 'react'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import type { WheelPickerOption } from '@ncdai/react-wheel-picker'
import { cn } from '@/lib/utils'

interface WheelProps {
  /** 当前值（受控） */
  value: number
  min: number
  max: number
  /** 步进（默认 1） */
  step?: number
  onChange: (value: number) => void
  label: string
  className?: string
}

/**
 * 滚轮选择器：基于 @ncdai/react-wheel-picker（iOS 风格，惯性滚动 + 吸附，
 * 原生支持鼠标滚轮/拖拽/触摸），套用拟物皮肤（凹槽容器 + 中心高亮带）。
 */
export function Wheel({ value, min, max, step = 1, onChange, label, className }: WheelProps): React.JSX.Element {
  const count = Math.floor((max - min) / step) + 1

  const options = useMemo<WheelPickerOption<number>[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const v = min + i * step
        return { value: v, label: String(v) }
      }),
    [min, max, step, count]
  )

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      {/* 拟物凹槽窗口：高度为轮盘的 1/3，居中裁切（透过窗口看轮盘正中的选中值） */}
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
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
