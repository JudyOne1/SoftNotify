import { useEffect, useMemo, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  AlarmClock,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  History,
  Layers3,
  Play,
  Settings2,
  Timer
} from 'lucide-react'
import type { Config, StatsSummary, TrayPanelSnapshot } from '@shared/types'
import { computeScheduleAt } from '@shared/schedule-core'
import { inQuietHours } from '@shared/quiet'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import FocusSection from './FocusSection'
import HistorySection from './HistorySection'
import StatsSection from './StatsSection'
import { SectionTitle } from './SettingsGroup'
import type { PomodoroState } from './usePomodoroState'

export type TodayView = 'overview' | 'stats' | 'history'

interface NextItem {
  id: string
  name: string
  at: number
  kind: 'interval' | 'schedule'
}

interface Props {
  config: Config
  state: PomodoroState | null
  status: TrayPanelSnapshot['status'] | null
  theme: 'light' | 'dark'
  view: TodayView
  testingReminder: boolean
  onViewChange: (view: TodayView) => void
  onPatch: (patch: Partial<Config>) => void
  onStartFocus: (minutes: number) => void
  onStopFocus: () => void
  onManageReminders: () => void
  onApplyProfile: (id: string) => void
  onTestReminder: () => void
}

const VIEW_TABS: Array<{ key: TodayView; label: string; icon: typeof BarChart3 }> = [
  { key: 'overview', label: '概览', icon: CalendarClock },
  { key: 'stats', label: '统计', icon: BarChart3 },
  { key: 'history', label: '历史', icon: History }
]

function formatClock(at: number): string {
  const date = new Date(at)
  const now = new Date()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (date.toDateString() === now.toDateString()) return `今天 ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return `明天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

function formatDistance(at: number, now: number): string {
  const milliseconds = Math.max(0, at - now)
  const minutes = Math.ceil(milliseconds / 60_000)
  if (minutes < 1) return '即将触发'
  if (minutes < 60) return `${minutes} 分钟后`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours} 小时 ${rest} 分钟后` : `${hours} 小时后`
  const days = Math.floor(hours / 24)
  return `${days} 天后`
}

function formatResumeAt(at: number): string {
  const date = new Date(at)
  return `预计 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 恢复`
}

function TodayTabs({ value, onChange }: { value: TodayView; onChange: (value: TodayView) => void }): React.JSX.Element {
  const activeIndex = VIEW_TABS.findIndex((tab) => tab.key === value)

  function moveFocus(index: number): void {
    const next = VIEW_TABS[(index + VIEW_TABS.length) % VIEW_TABS.length]
    onChange(next.key)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-today-tab="${next.key}"]`)?.focus())
  }

  return (
    <div className="mb-5 inline-flex h-9 items-center rounded-md bg-muted p-1" aria-label="今天视图" role="tablist">
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            role="tab"
            aria-selected={value === tab.key}
            tabIndex={value === tab.key ? 0 : -1}
            data-today-tab={tab.key}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                moveFocus(activeIndex + 1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                moveFocus(activeIndex - 1)
              } else if (event.key === 'Home') {
                event.preventDefault()
                moveFocus(0)
              } else if (event.key === 'End') {
                event.preventDefault()
                moveFocus(VIEW_TABS.length - 1)
              }
            }}
            className={cn(
              'flex h-7 cursor-pointer items-center gap-1.5 rounded px-3 text-xs transition-colors',
              value === tab.key
                ? 'bg-card font-medium text-foreground shadow-[var(--neu-raised-sm)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function TodaySection({
  config,
  state,
  status: statusSnapshot,
  theme,
  view,
  testingReminder,
  onViewChange,
  onPatch,
  onStartFocus,
  onStopFocus,
  onManageReminders,
  onApplyProfile,
  onTestReminder
}: Props): React.JSX.Element {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [nextItem, setNextItem] = useState<NextItem | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (view !== 'overview') return
    let alive = true

    const refresh = async (): Promise<void> => {
      const intervalItems = await Promise.all(
        config.reminders
          .filter((item) => item.enabled)
          .map(async (item): Promise<NextItem | null> => {
            const at = await window.notifyAPI.nextFireFor(item.id)
            return at ? { id: item.id, name: item.name, at, kind: 'interval' } : null
          })
      )
      const scheduleItems = config.schedules
        .filter((item) => item.enabled)
        .map((item): NextItem | null => {
          const at = computeScheduleAt(item)
          return at > Date.now() ? { id: item.id, name: item.name, at, kind: 'schedule' } : null
        })
      const closest = [...intervalItems, ...scheduleItems]
        .filter((item): item is NextItem => item !== null)
        .sort((a, b) => a.at - b.at)[0] ?? null
      const summary = await window.notifyAPI.getStats()
      if (alive) {
        setNextItem(closest)
        setStats(summary)
        setNow(Date.now())
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), 30_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [config.reminders, config.schedules, view])

  const quietNow = inQuietHours(config.quietEnabled, config.quietStart, config.quietEnd)
  const fallbackStatus = state?.active
    ? state.phase === 'break'
      ? { kind: 'break' as const, label: '休息中', detail: '休息结束后会提醒你', tone: 'text-primary', resumeAt: null }
      : { kind: 'focus' as const, label: '专注中', detail: '其他提醒暂时静默', tone: 'text-primary', resumeAt: null }
    : config.paused
      ? { kind: 'paused' as const, label: '已暂停', detail: '所有自动提醒暂时停止', tone: 'text-[var(--destructive)]', resumeAt: null }
      : quietNow
        ? { kind: 'quiet' as const, label: '安静时段', detail: `${config.quietStart} - ${config.quietEnd} 自动静默`, tone: 'text-primary', resumeAt: null }
        : { kind: 'running' as const, label: '正常运行', detail: '提醒会按计划出现', tone: 'text-[var(--success,#34d399)]', resumeAt: null }
  const status = statusSnapshot
    ? {
        ...statusSnapshot,
        tone: statusSnapshot.kind === 'paused'
          ? 'text-[var(--destructive)]'
          : statusSnapshot.kind === 'running' || statusSnapshot.kind === 'empty'
            ? 'text-[var(--success,#34d399)]'
            : 'text-primary'
      }
    : fallbackStatus
  const pauseActive = config.paused || Boolean(config.pausedUntil && config.pausedUntil > Date.now())

  const goalItems = useMemo(
    () => [...config.reminders, ...config.schedules].filter((item) => item.enabled && item.dailyGoal),
    [config.reminders, config.schedules]
  )
  const activeProfile = config.profiles.find((profile) => profile.id === config.activeProfile)

  if (view === 'stats') {
    return (
      <>
        <SectionTitle title="统计" hint="回顾打卡、专注与本机活跃情况" />
        <TodayTabs value={view} onChange={onViewChange} />
        <StatsSection theme={theme} />
      </>
    )
  }

  if (view === 'history') {
    return (
      <>
        <SectionTitle title="历史" hint="最近 50 条提醒记录，仅保存在本机" />
        <TodayTabs value={view} onChange={onViewChange} />
        <HistorySection />
      </>
    )
  }

  return (
    <>
      <SectionTitle title="今天" hint="查看当前状态，处理今天最常用的事情" />
      <TodayTabs value={view} onChange={onViewChange} />

      <section className="mb-4 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            {pauseActive ? <CirclePause className="size-5" /> : <BellRing className="size-5" />}
          </span>
          <div className="min-w-0">
            <div className={cn('text-sm font-semibold', status.tone)}>{status.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {status.detail}
              {status.resumeAt ? ` · ${formatResumeAt(status.resumeAt)}` : ''}
            </div>
          </div>
          <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger asChild>
              <Button className="ml-auto" variant={pauseActive ? 'default' : 'secondary'} size="sm">
                {pauseActive ? <Play /> : <CirclePause />}
                {pauseActive ? '恢复提醒' : '暂停提醒'}
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content align="end" side="bottom" sideOffset={8} className="z-50 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--neu-raised)]">
                {pauseActive ? (
                  <PopoverPrimitive.Close asChild>
                    <button type="button" className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent" onClick={() => onPatch({ paused: false, pausedUntil: null })}>
                      立即恢复提醒
                    </button>
                  </PopoverPrimitive.Close>
                ) : (
                  <>
                    {[30, 60, 120].map((minutes) => (
                      <PopoverPrimitive.Close key={minutes} asChild>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] hover:bg-accent"
                          onClick={() => onPatch({ paused: false, pausedUntil: Date.now() + minutes * 60_000 })}
                        >
                          暂停 {minutes >= 60 ? `${minutes / 60} 小时` : `${minutes} 分钟`}
                        </button>
                      </PopoverPrimitive.Close>
                    ))}
                    <PopoverPrimitive.Close asChild>
                      <button type="button" className="flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onPatch({ paused: true, pausedUntil: null })}>
                        暂停直到手动恢复
                      </button>
                    </PopoverPrimitive.Close>
                  </>
                )}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card px-4 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlarmClock className="size-3.5" />
              下一个提醒
            </div>
            {nextItem ? (
              <>
                <div className="truncate text-[15px] font-medium">{nextItem.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-primary">{formatDistance(nextItem.at, now)}</span>
                  <span>{formatClock(nextItem.at)}</span>
                  <span>{nextItem.kind === 'interval' ? '间隔提醒' : '定时日程'}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">暂无启用的提醒</div>
            )}
          </div>

          <div className="bg-card px-4 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              今日进度
            </div>
            <div className="text-[15px] font-medium">{stats?.todayTotal ?? 0} 次打卡</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {goalItems.length > 0 ? `${goalItems.length} 项设有每日目标` : '尚未设置每日目标'}
              {(state?.todayFocus ?? 0) > 0 ? ` · ${state?.todayFocus} 个专注` : ''}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold">专注</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">专注期间自动静默其他提醒</p>
            </div>
            <Timer className="size-4 text-muted-foreground" />
          </div>
          <div className="p-4">
            <FocusSection
              compact
              config={config}
              state={state}
              onPatch={onPatch}
              onStart={onStartFocus}
              onStop={onStopFocus}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold">当前模式</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">快速切换一组提醒</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Layers3 className="size-4 text-primary" />
              <span className="truncate">{activeProfile?.name ?? '自定义组合'}</span>
            </div>
            <Select
              value={activeProfile?.id ?? 'custom'}
              onValueChange={(value) => {
                if (value !== 'custom') onApplyProfile(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!activeProfile && <SelectItem value="custom">自定义组合</SelectItem>}
                {config.profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      </div>

      {goalItems.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--neu-raised-sm)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold">今日目标</h2>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onViewChange('stats')}
            >
              查看统计 <ChevronRight className="size-3.5" />
            </button>
          </div>
          <div className="divide-y divide-border px-4">
            {goalItems.slice(0, 5).map((item) => {
              const done = stats?.todayByItem[item.id] ?? 0
              const goal = item.dailyGoal ?? 1
              const progress = Math.min(100, Math.round((done / goal) * 100))
              return (
                <div key={item.id} className="py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-4 text-[13px]">
                    <span className="truncate">{item.name}</span>
                    <span className="flex-none tabular-nums text-muted-foreground">{done}/{goal}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={onManageReminders}>
          <Settings2 />
          管理提醒
        </Button>
        <Button variant="secondary" disabled={testingReminder} onClick={onTestReminder}>
          <BellRing />
          {testingReminder ? '发送中…' : '测试一次'}
        </Button>
        <Button variant="ghost" onClick={() => onViewChange('history')}>
          <History />
          最近记录
        </Button>
      </section>
    </>
  )
}
