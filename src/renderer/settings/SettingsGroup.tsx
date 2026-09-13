import type { JSX, ReactNode } from 'react'
import { cn } from '@/lib/utils'

function SectionTitle({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SettingsGroup({
  title,
  hint,
  children,
  className
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={cn('mb-4 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]', className)}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="divide-y divide-border px-4">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  hint,
  children,
  className
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={cn('flex min-h-14 items-center justify-between gap-5 py-3 text-sm', className)}>
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex flex-none items-center">{children}</div>
    </div>
  )
}

export { SectionTitle, SettingsGroup, SettingsRow }
