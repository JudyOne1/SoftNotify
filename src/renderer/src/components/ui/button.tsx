import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** 拟物按钮：常态凸起，按下凹进 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-card text-primary shadow-[var(--neu-raised-sm)] hover:text-[var(--primary)] hover:brightness-110 active:shadow-[var(--neu-inset-sm)] active:text-[var(--primary)]',
        solid:
          'bg-primary text-primary-foreground shadow-[var(--neu-raised-sm)] hover:brightness-110 active:shadow-[var(--neu-inset-sm)]',
        secondary:
          'bg-card text-foreground shadow-[var(--neu-raised-sm)] hover:text-foreground hover:brightness-110 active:shadow-[var(--neu-inset-sm)]',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        link: 'text-primary underline-offset-4 hover:underline shadow-none'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>): React.JSX.Element {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
