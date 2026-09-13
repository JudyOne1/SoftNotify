import * as React from 'react'
import { cn } from '@/lib/utils'

/** 拟物多行输入：凹槽 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        'flex min-h-16 w-full rounded-md bg-transparent px-3 py-2 text-sm text-foreground shadow-[var(--neu-inset-sm)] transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
