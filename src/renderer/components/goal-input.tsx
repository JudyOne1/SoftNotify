import { Minus, Plus } from 'lucide-react'

/** 每日目标步进器：− 数值 +；1 再减回到「不限」（替代原生 number 输入，暗黑下无白色箭头） */
export function GoalInput({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        title="减少（1 再减则取消目标）"
        className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-card text-muted-foreground shadow-[var(--neu-raised-sm)] transition-[filter] hover:brightness-110 active:shadow-[var(--neu-inset-sm)]"
        onClick={() => onChange(value === undefined || value <= 1 ? undefined : value - 1)}
      >
        <Minus className="size-3" />
      </button>
      <span className="w-9 rounded-md py-1 text-center text-xs tabular-nums text-foreground shadow-[var(--neu-inset-sm)]">
        {value ?? '不限'}
      </span>
      <button
        type="button"
        title="增加"
        className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-card text-muted-foreground shadow-[var(--neu-raised-sm)] transition-[filter] hover:brightness-110 active:shadow-[var(--neu-inset-sm)]"
        onClick={() => onChange(value === undefined ? 1 : Math.min(99, value + 1))}
      >
        <Plus className="size-3" />
      </button>
    </span>
  )
}
