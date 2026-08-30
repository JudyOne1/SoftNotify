import { useEffect, useState } from 'react'
import type { Config } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface PomodoroState {
  active: boolean
  phase: 'focus' | 'break' | null
  remainingMs: number
  todayFocus: number
}

interface Props {
  config: Config
  onPatch: (p: Partial<Config>) => void
}

/** 专注分区：番茄钟状态实时倒计时 + 开始/停止 + 自动循环 + 今日统计 */
export default function FocusSection({ config, onPatch }: Props): React.JSX.Element {
  const [state, setState] = useState<PomodoroState | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = (): void => {
      void window.notifyAPI.getPomodoroState().then((s) => {
        if (alive) setState(s)
      })
    }
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const active = state?.active ?? false
  const remaining = Math.max(0, Math.ceil((state?.remainingMs ?? 0) / 1000))
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-5 shadow-[var(--neu-raised)]">
        <div
          className={cn(
            'text-4xl font-bold tabular-nums',
            active ? (state?.phase === 'focus' ? 'text-foreground' : 'text-primary') : 'text-muted-foreground'
          )}
        >
          {active ? `${mm}:${ss}` : '--:--'}
        </div>
        <div className="text-xs text-muted-foreground">
          {active ? (state?.phase === 'focus' ? '🍅 专注中 · 其他提醒已静默' : '☕ 休息中') : '未开始'}
        </div>
        <div className="flex gap-2 pt-1.5">
          {!active ? (
            <>
              <Button size="sm" onClick={() => void window.notifyAPI.startFocus(25)}>
                25 分钟
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void window.notifyAPI.startFocus(45)}>
                45 分钟
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void window.notifyAPI.startFocus(60)}>
                60 分钟
              </Button>
            </>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => void window.notifyAPI.stopPomodoro()}>
              停止专注
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border/50 pb-3 text-sm">
        <span>
          自动循环
          <span className="block text-xs text-muted-foreground">休息结束后自动开始下一轮专注</span>
        </span>
        <Switch checked={config.pomodoroAutoLoop} onCheckedChange={(v) => onPatch({ pomodoroAutoLoop: v })} />
      </div>

      <div className="text-xs text-muted-foreground">🍅 今日已完成 {state?.todayFocus ?? 0} 个番茄</div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        专注期间其他提醒自动静默；专注结束时会弹幕提醒你休息 5 分钟。也可以在托盘菜单快速开始。
      </p>
    </div>
  )
}
