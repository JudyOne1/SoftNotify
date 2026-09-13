import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { JSX } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreateMenuOption<T extends string | number> {
  value: T
  label: string
  hint?: string
}

function CreateMenu<T extends string | number>({
  label,
  options,
  onSelect
}: {
  label: string
  options: Array<CreateMenuOption<T>>
  onSelect: (value: T) => void
}): JSX.Element {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="solid" size="sm">
          <Plus />
          {label}
          <ChevronDown className="opacity-70" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--neu-raised)]"
        >
          {options.map((option) => (
            <PopoverPrimitive.Close key={option.value} asChild>
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                onClick={() => onSelect(option.value)}
              >
                <span className="text-[13px] font-medium">{option.label}</span>
                {option.hint && <span className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{option.hint}</span>}
              </button>
            </PopoverPrimitive.Close>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { CreateMenu }
export type { CreateMenuOption }
