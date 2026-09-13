import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface EditorSheetProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}

function EditorSheet({ open, title, description, onClose, children }: EditorSheetProps): React.JSX.Element | null {
  const titleId = React.useId()
  const panelRef = React.useRef<HTMLElement>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (event.target instanceof Element && !panelRef.current?.contains(event.target)) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-hidden="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[440px] max-w-full flex-col border-l border-border bg-background shadow-[-16px_0_40px_rgba(0,0,0,0.28)] outline-none max-sm:w-full max-sm:border-l-0"
      >
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          <Tooltip label="关闭编辑面板">
            <Button variant="ghost" size="icon" title="关闭" aria-label="关闭编辑面板" onClick={onClose}>
              <X />
            </Button>
          </Tooltip>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1">
          {children}
        </div>
        <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-2.5">
          <span className="text-xs text-muted-foreground">修改会自动保存</span>
          <Button variant="solid" size="sm" onClick={onClose}>完成</Button>
        </footer>
      </section>
    </div>,
    document.body
  )
}

function EditorSection({
  title,
  hint,
  tone = 'default',
  children,
  className
}: {
  title: string
  hint?: string
  tone?: 'default' | 'danger'
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('border-t border-border py-5 first:border-t-0', className)}>
      <div className="mb-4">
        <h3 className={cn('text-[13px] font-semibold', tone === 'danger' && 'text-destructive')}>{title}</h3>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function EditorRow({
  label,
  hint,
  children,
  className
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex min-h-10 items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export { EditorRow, EditorSection, EditorSheet }
