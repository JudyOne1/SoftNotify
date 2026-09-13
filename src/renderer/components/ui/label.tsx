import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>): React.JSX.Element {
  return (
    <LabelPrimitive.Root
      className={cn('flex cursor-pointer select-none items-center gap-2 text-sm text-foreground', className)}
      {...props}
    />
  )
}

export { Label }
