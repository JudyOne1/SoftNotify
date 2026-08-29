import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/** 拟物开关：凹槽轨道，关闭红色 / 开启绿色，滑块凸起 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 shadow-[var(--neu-inset-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=unchecked]:bg-[var(--sw-track-off)] data-[state=checked]:bg-[var(--sw-track-on)]'
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full shadow-[var(--neu-raised-sm)] transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
          'data-[state=unchecked]:bg-[var(--sw-knob-off)] data-[state=checked]:bg-[var(--sw-knob-on)]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
