import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/** 拟物开关：凹槽轨道 + 凸起滑块 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 shadow-[var(--neu-inset-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=unchecked]:bg-transparent data-[state=checked]:bg-primary/25'
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-card shadow-[var(--neu-raised-sm)] ring-1 ring-[var(--border)] transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-primary" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
