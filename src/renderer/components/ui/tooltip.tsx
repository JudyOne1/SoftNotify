import type { ReactElement } from 'react'

interface TooltipProps {
  label: string
  children: ReactElement
}

/** 轻量级、无需额外 Provider 的 Tooltip；键盘聚焦时同样可见。 */
export function Tooltip({ label, children }: TooltipProps): ReactElement {
  return (
    <span className="ui-tooltip group relative inline-flex" data-tooltip={label}>
      {children}
      <span role="tooltip" className="ui-tooltip-content pointer-events-none absolute right-0 bottom-full z-50 mb-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground opacity-0 shadow-[var(--neu-raised-sm)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </span>
  )
}
