import * as React from 'react'
import { cn } from '@/lib/utils'

/** 拟物输入框：凹槽 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-sm text-foreground shadow-[var(--neu-inset-sm)] transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
