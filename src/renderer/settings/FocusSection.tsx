import { Coffee, Timer } from 'lucide-react'
import type { Config } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PomodoroState } from './usePomodoroState'

interface Props {
  config: Config
  state: PomodoroState | null
  compact?: boolean
  onPatch: (p: Partial<Config>) => void
  onStart: (minutes: number) => void
  onStop: () => void
}

/** 番茄钟控制：运行状态由应用壳统一轮询，确保离开“今天”后仍可持续展示。 */
export default function FocusSection({ config, state, compact = false, onPatch, onStart, onStop }: Props): React.JSX.Element {
  const active = state?.active ?? false
  const remaining = Math.max(0, Math.ceil((state?.remainingMs ?? 0) / 1000))
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const resting = state?.phase === 'break'

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      <div className={cn('flex flex-col items-center gap-2', compact ? 'py-1' : 'rounded-lg bg-card p-5 shadow-[var(--neu-raised)]')}>
        <div
          className={cn(
            'font-bold tabular-nums',
            compact ? 'text-3xl' : 'text-4xl',
            active ? (state?.phase === 'focus' ? 'text-foreground' : 'text-primary') : 'text-muted-foreground'
          )}
        >
          {active ? `${mm}:${ss}` : '--:--'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {active ? (
            resting ? <Coffee className="size-3.5 text-primary" /> : <Timer className="size-3.5 text-primary" />
          ) : null}
          {active ? (resting ? '休息中' : '专注中，其他提醒已静默') : '选择一个时长开始'}
        </div>
        <div className="flex gap-2 pt-1.5">
          {!active ? (
            <>
              <Button size="sm" onClick={() => onStart(25)}>
                25 分钟
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onStart(45)}>
                45 分钟
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onStart(60)}>
                60 分钟
              </Button>
            </>
          ) : (
            <Button variant="destructive" size="sm" onClick={onStop}>
              停止专注
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
        <span>
          自动循环
          <span className="block text-xs text-muted-foreground">休息结束后自动开始下一轮专注</span>
        </span>
        <Switch checked={config.pomodoroAutoLoop} onCheckedChange={(v) => onPatch({ pomodoroAutoLoop: v })} />
      </div>

      <div className="text-xs text-muted-foreground">今日已完成 {state?.todayFocus ?? 0} 个专注</div>

      {!compact && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          专注期间其他提醒自动静默；专注结束时会弹幕提醒你休息 5 分钟。
        </p>
      )}
    </div>
  )
}
