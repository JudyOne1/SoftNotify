import { useState } from 'react'
import type { Profile } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  profiles: Profile[]
  activeProfile: string | null
  onApply: (id: string) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
}

export default function ProfilesSection({ profiles, activeProfile, onApply, onSave, onDelete }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  function save(): void {
    const n = name.trim()
    if (!n) return
    onSave(n)
    setName('')
  }

  return (
    <>
      <div className="mt-3 mb-2.5 flex flex-col gap-2.5">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-2.5 rounded-lg bg-card px-3.5 py-2 shadow-[var(--neu-raised)] transition-[filter] hover:brightness-110',
              activeProfile === p.id && 'ring-1 ring-primary/60'
            )}
          >
            <span className="min-w-0 flex-1 text-sm">
              {activeProfile === p.id && <span className="mr-1 text-primary">●</span>}
              {p.name}
            </span>
            <Button variant="secondary" size="sm" onClick={() => onApply(p.id)}>
              应用
            </Button>
            <Button variant="destructive" size="icon" title="删除" onClick={() => onDelete(p.id)}>
              ✕
            </Button>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset)]">
            把当前的提醒计划、安静时段、弹幕外观保存成一个模式，之后在托盘一键切换
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          maxLength={20}
          placeholder="模式名，如：工作"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Button variant="secondary" onClick={save}>
          保存当前为模式
        </Button>
      </div>
    </>
  )
}
