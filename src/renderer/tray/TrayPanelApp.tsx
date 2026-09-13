import { useCallback, useEffect, useMemo, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  AlarmClock,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  Clock3,
  Layers3,
  Play,
  Settings2,
  Square,
  Timer
} from 'lucide-react'
import type { Config, TrayPanelSnapshot } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const STATUS_TONES: Record<TrayPanelSnapshot['status']['kind'], string> = {
  running: 'bg-emerald-400',
  paused: 'bg-rose-400',
  focus: 'bg-primary',
  break: 'bg-primary',
  meeting: 'bg-amber-400',
  fullscreen: 'bg-amber-400',
  quiet: 'bg-primary',
  empty: 'bg-muted-foreground'
}

export default function TrayPanelApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [snapshot, setSnapshot] = useState<TrayPanelSnapshot | null>(null)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [toast, setToast] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    const next = await window.notifyAPI.getTrayPanelState()
    setSnapshot(next)
  }, [])

  useEffect(() => {
    let alive = true
    void Promise.all([window.notifyAPI.getConfig(), window.notifyAPI.getTrayPanelState(), window.notifyAPI.getUiEnv()])
      .then(([nextConfig, nextSnapshot, env]) => {
        if (!alive) return
        setConfig(nextConfig)
        setSnapshot(nextSnapshot)
        if (env.nativeMaterial) document.body.classList.add('native-material')
      })

    const offConfig = window.notifyAPI.onConfigChanged((next) => {
      setConfig(next)
      void refresh()
    })
    const offRefresh = window.notifyAPI.onTrayRefresh(() => void refresh())
    const timer = setInterval(() => void refresh(), 1000)
    return () => {
      alive = false
      offConfig()
      offRefresh()
      clearInterval(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (!config) return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = (): void => {
      document.documentElement.dataset.theme = config.themeMode === 'system'
        ? media.matches ? 'light' : 'dark'
        : config.themeMode
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [config])

  const enabledItems = useMemo(() => config
    ? [...config.reminders, ...config.schedules].filter((item) => item.enabled)
    : [], [config])

  function showToast(message: string): void {
    setToast(message)
    setTimeout(() => setToast(''), 1600)
  }

  async function updatePause(patch: Partial<Config>, message: string): Promise<void> {
    if (!config) return
    const next = await window.notifyAPI.setConfig(patch)
    setConfig(next)
    await refresh()
    showToast(message)
  }

  async function checkin(itemId: string, name: string): Promise<void> {
    await window.notifyAPI.checkin(itemId)
    setCheckinOpen(false)
    await refresh()
    showToast(`已补打卡：${name}`)
  }

  async function startFocus(minutes: number): Promise<void> {
    await window.notifyAPI.startFocus(minutes)
    setFocusOpen(false)
    await refresh()
    showToast(`已开始 ${minutes} 分钟专注`)
  }

  async function stopFocus(): Promise<void> {
    await window.notifyAPI.stopPomodoro()
    await refresh()
    showToast('专注已停止')
  }

  async function applyProfile(id: string): Promise<void> {
    const next = await window.notifyAPI.applyProfile(id)
    setConfig(next)
    await refresh()
    showToast('模式已切换')
  }

  if (!config || !snapshot) {
    return <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">正在载入…</div>
  }

  const activeProfile = config.profiles.find((profile) => profile.id === config.activeProfile)
  const focusActive = snapshot.pomodoro.active
  const pauseActive = config.paused || Boolean(config.pausedUntil && config.pausedUntil > Date.now())
  const progress = snapshot.today.goalItems > 0
    ? Math.round(snapshot.today.goalsCompleted / snapshot.today.goalItems * 100)
    : Math.min(100, snapshot.today.checkins * 10)

  return (
    <div className="relative flex h-screen select-none flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/12 text-primary">
          <BellRing className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">SoftNotify</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', STATUS_TONES[snapshot.status.kind])} />
            <span className="truncate">{snapshot.status.label}</span>
          </div>
        </div>
        <Tooltip label="打开设置">
          <Button variant="ghost" size="icon" title="打开设置" aria-label="打开设置" onClick={() => void window.notifyAPI.openMain('settings')}>
            <Settings2 />
          </Button>
        </Tooltip>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              snapshot.status.kind === 'paused' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}>
              {snapshot.status.kind === 'paused' ? <CirclePause className="size-5" /> : <BellRing className="size-5" />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{snapshot.status.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {snapshot.status.detail}{snapshot.status.resumeAt ? ` · ${formatPauseTime(snapshot.status.resumeAt)}` : ''}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 border-b border-border">
          <div className="min-w-0 border-r border-border px-4 py-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlarmClock className="size-3.5" />下一个提醒
            </div>
            {snapshot.next ? (
              <>
                <div className="truncate text-sm font-medium">{snapshot.next.name}</div>
                <div className="mt-1 text-xs font-medium text-primary">{formatDistance(snapshot.next.at)}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">暂无提醒</div>
            )}
          </div>
          <div className="min-w-0 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5" />今日进度
            </div>
            <div className="text-sm font-medium">{snapshot.today.checkins} 次打卡</div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {snapshot.today.goalItems > 0
                ? `${snapshot.today.goalsCompleted}/${snapshot.today.goalItems} 项目标完成`
                : snapshot.today.focusSessions > 0 ? `${snapshot.today.focusSessions} 个专注` : '继续保持'}
            </div>
          </div>
        </section>

        {focusActive && (
          <section className="flex items-center gap-3 border-b border-border bg-primary/8 px-4 py-3">
            <Timer className="size-4 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{snapshot.pomodoro.phase === 'break' ? '休息中' : '专注中'}</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-primary">
                {formatTimer(snapshot.pomodoro.remainingMs)}
              </div>
            </div>
            <Tooltip label="停止专注">
              <Button variant="ghost" size="icon" title="停止专注" aria-label="停止专注" onClick={() => void stopFocus()}>
                <Square className="size-3.5" />
              </Button>
            </Tooltip>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3.5">
          <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger asChild>
              <Button variant="secondary" size="sm">
                {pauseActive ? <Play /> : <CirclePause />}
                {pauseActive ? '恢复' : '暂停'}
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content align="start" side="top" sideOffset={8} className="z-50 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--neu-raised)]">
                {pauseActive ? (
                  <PopoverPrimitive.Close asChild>
                    <button type="button" className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent" onClick={() => void updatePause({ paused: false, pausedUntil: null }, '提醒已恢复')}>
                      立即恢复提醒
                    </button>
                  </PopoverPrimitive.Close>
                ) : (
                  <>
                    {[30, 60].map((minutes) => (
                      <PopoverPrimitive.Close key={minutes} asChild>
                        <button type="button" className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent" onClick={() => void updatePause({ paused: false, pausedUntil: Date.now() + minutes * 60_000 }, `已暂停 ${minutes} 分钟`)}>
                          暂停 {minutes} 分钟
                        </button>
                      </PopoverPrimitive.Close>
                    ))}
                    <PopoverPrimitive.Close asChild>
                      <button type="button" className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => void updatePause({ paused: true, pausedUntil: null }, '提醒已暂停')}>
                        暂停直到手动恢复
                      </button>
                    </PopoverPrimitive.Close>
                  </>
                )}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          <PopoverPrimitive.Root open={checkinOpen} onOpenChange={setCheckinOpen}>
            <PopoverPrimitive.Trigger asChild>
              <Button variant="secondary" size="sm" disabled={enabledItems.length === 0}>
                <Check />补打卡
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="center"
                side="top"
                sideOffset={8}
                className="z-50 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-[var(--neu-raised)]"
              >
                {enabledItems.map((item) => (
                  <PopoverPrimitive.Close key={item.id} asChild>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent"
                      onClick={() => void checkin(item.id, item.name)}
                    >
                      <CheckCircle2 className="size-4 text-muted-foreground" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </PopoverPrimitive.Close>
                ))}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          {focusActive ? (
            <Button variant="secondary" size="sm" onClick={() => void stopFocus()}>
              <Square />停止专注
            </Button>
          ) : (
            <PopoverPrimitive.Root open={focusOpen} onOpenChange={setFocusOpen}>
              <PopoverPrimitive.Trigger asChild>
                <Button variant="secondary" size="sm"><Timer />专注</Button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  align="end"
                  side="top"
                  sideOffset={8}
                  className="z-50 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--neu-raised)]"
                >
                  {[25, 45, 60].map((minutes) => (
                    <PopoverPrimitive.Close key={minutes} asChild>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent"
                        onClick={() => void startFocus(minutes)}
                      >
                        专注 {minutes} 分钟
                        <Clock3 className="size-3.5 text-muted-foreground" />
                      </button>
                    </PopoverPrimitive.Close>
                  ))}
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          )}
        </section>

        <section className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2.5">
          <Layers3 className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">当前模式</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{activeProfile?.name ?? '未使用模式'}</div>
          </div>
          {config.profiles.length > 0 && (
            <Select value={config.activeProfile ?? undefined} onValueChange={(value) => void applyProfile(value)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="选择模式" /></SelectTrigger>
              <SelectContent>
                {config.profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </section>
      </main>

      <footer className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="px-1 text-[11px] text-muted-foreground">今日 {snapshot.today.focusSessions} 个专注</span>
        <Button variant="ghost" size="sm" onClick={() => void window.notifyAPI.openMain('today')}>
          打开 SoftNotify<ChevronRight />
        </Button>
      </footer>

      {toast && (
        <div role="status" aria-live="polite" className="toast-enter pointer-events-none absolute right-3 bottom-12 left-3 rounded-md border border-border bg-popover px-3 py-2 text-center text-xs shadow-[var(--neu-raised)]">
          {toast}
        </div>
      )}
    </div>
  )
}

function formatDistance(at: number): string {
  const minutes = Math.ceil(Math.max(0, at - Date.now()) / 60_000)
  if (minutes < 1) return '即将触发'
  if (minutes < 60) return `${minutes} 分钟后`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分后` : `${hours} 小时后`
}

function formatTimer(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatPauseTime(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 恢复`
}
