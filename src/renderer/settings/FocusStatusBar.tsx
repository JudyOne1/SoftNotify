import { Coffee, Square, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PomodoroState } from './usePomodoroState'

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function FocusStatusBar({
  state,
  onStop
}: {
  state: PomodoroState
  onStop: () => void
}): React.JSX.Element {
  const resting = state.phase === 'break'
  const Icon = resting ? Coffee : Timer

  return (
    <div className="flex h-11 flex-none items-center gap-2 border-b border-border bg-primary/5 px-5 text-[13px]">
      <Icon className="size-4 text-primary" />
      <span className="font-medium">{resting ? '休息中' : '专注中'}</span>
      <span className="tabular-nums text-muted-foreground">{formatRemaining(state.remainingMs)}</span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {resting ? '休息结束后会提醒你' : '其他提醒暂时静默'}
      </span>
      <Button className="ml-auto" variant="ghost" size="sm" onClick={onStop}>
        <Square />
        停止
      </Button>
    </div>
  )
}
