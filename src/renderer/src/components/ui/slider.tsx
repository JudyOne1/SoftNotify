import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

/** 拟物滑块：凹槽轨道 + 凸起手柄 */
function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-transparent shadow-[var(--neu-inset-sm)]">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full bg-card shadow-[var(--neu-raised-sm)] ring-[var(--ring)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 active:scale-95 disabled:pointer-events-none" />
    </SliderPrimitive.Root>
  )
}

export { Slider }
