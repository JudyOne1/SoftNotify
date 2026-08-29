import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import { join } from 'node:path'
import { getConfig } from './store'
import { inQuietHours } from '@shared/quiet'
import { isManualMeeting } from './meeting'
import { isFullscreenApp } from './fullscreen'
import { currentPhase, isPomodoroActive, remainingMs } from './pomodoro'
import { todayCheckinCount } from './stats'
import type { Scheduler } from './scheduler'

export interface TrayHandlers {
  onRemindNow: (itemId: string) => void
  onCheckinNow: (itemId: string) => void
  onApplyProfile: (id: string) => void
  onTogglePause: () => void
  onToggleMeeting: () => void
  onStartFocus: (minutes: number) => void
  onStopPomodoro: () => void
  onTogglePomodoroLoop: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  onOpenStats: () => void
}

let tray: Tray | null = null
let tooltipTimer: NodeJS.Timeout | null = null
let iconNormal: NativeImage | null = null
let iconPaused: NativeImage | null = null

function statusText(scheduler: Scheduler): string {
  const cfg = getConfig()
  if (cfg.paused) return 'Notify：已暂停'
  if (isPomodoroActive()) {
    const phase = currentPhase()
    const min = Math.max(1, Math.ceil(remainingMs() / 60_000))
    return phase === 'focus' ? `Notify：🍅 专注中 · 剩余 ${min} 分钟` : `Notify：☕ 休息中 · 剩余 ${min} 分钟`
  }
  if (isManualMeeting()) return 'Notify：会议模式（手动）'
  if (isFullscreenApp()) return 'Notify：全屏应用中（免打扰）'
  if (inQuietHours(cfg.quietEnabled, cfg.quietStart, cfg.quietEnd)) {
    return `Notify：安静时段（至 ${cfg.quietEnd}）`
  }
  const due = scheduler.nextDue()
  const base = due
    ? (() => {
        const name =
          cfg.reminders.find((r) => r.id === due.id)?.name ?? cfg.schedules.find((s) => s.id === due.id)?.name ?? ''
        return `${name ? `${name} ` : ''}${scheduler.nextInMinutes()} 分钟后提醒`
      })()
    : '无已启用的提醒'
  const checked = todayCheckinCount()
  return checked > 0 ? `Notify：${base} · 今日已打卡 ${checked} 次` : `Notify：${base}`
}

/** 立即提醒子菜单：定时日程在前、间隔提醒在后 */
function remindSubmenu(handlers: TrayHandlers): MenuItemConstructorOptions {
  const cfg = getConfig()
  const entries: MenuItemConstructorOptions[] = [
    ...cfg.schedules.filter((s) => s.enabled).map((s) => ({ label: s.name, click: () => handlers.onRemindNow(s.id) })),
    ...cfg.reminders.filter((r) => r.enabled).map((r) => ({ label: r.name, click: () => handlers.onRemindNow(r.id) }))
  ]
  return {
    label: '立即提醒一次',
    submenu: entries.length ? entries : [{ label: '（无已启用的提醒）', enabled: false }]
  }
}

/** 补打卡子菜单：手动记一笔（漏点弹幕时用） */
function checkinSubmenu(handlers: TrayHandlers): MenuItemConstructorOptions {
  const cfg = getConfig()
  const entries: MenuItemConstructorOptions[] = [
    ...cfg.schedules.filter((s) => s.enabled).map((s) => ({ label: s.name, click: () => handlers.onCheckinNow(s.id) })),
    ...cfg.reminders.filter((r) => r.enabled).map((r) => ({ label: r.name, click: () => handlers.onCheckinNow(r.id) }))
  ]
  return {
    label: '补打卡',
    submenu: entries.length ? entries : [{ label: '（无已启用的提醒）', enabled: false }]
  }
}

function profileSubmenu(handlers: TrayHandlers): MenuItemConstructorOptions {
  const cfg = getConfig()
  if (cfg.profiles.length === 0) {
    return { label: '模式', submenu: [{ label: '（尚未保存模式，可在设置中创建）', enabled: false }] }
  }
  return {
    label: '模式',
    submenu: cfg.profiles.map((p) => ({
      label: p.name,
      type: 'radio' as const,
      checked: cfg.activeProfile === p.id,
      click: () => handlers.onApplyProfile(p.id)
    }))
  }
}

/** 番茄钟子菜单：开始专注 / 停止 / 自动循环 */
function pomodoroSubmenu(handlers: TrayHandlers): MenuItemConstructorOptions {
  const cfg = getConfig()
  const active = isPomodoroActive()
  return {
    label: '🍅 专注',
    submenu: [
      { label: '开始专注 25 分钟', enabled: !active, click: () => handlers.onStartFocus(25) },
      { label: '开始专注 45 分钟', enabled: !active, click: () => handlers.onStartFocus(45) },
      { label: '开始专注 60 分钟', enabled: !active, click: () => handlers.onStartFocus(60) },
      { label: '停止专注', enabled: active, click: handlers.onStopPomodoro },
      { type: 'separator' },
      { label: '自动循环', type: 'checkbox' as const, checked: cfg.pomodoroAutoLoop, click: handlers.onTogglePomodoroLoop }
    ]
  }
}

function buildMenu(handlers: TrayHandlers, scheduler: Scheduler): Menu {
  const cfg = getConfig()
  return Menu.buildFromTemplate([
    { label: statusText(scheduler), enabled: false },
    { type: 'separator' },
    remindSubmenu(handlers),
    checkinSubmenu(handlers),
    profileSubmenu(handlers),
    { label: cfg.paused ? '恢复提醒' : '暂停提醒', click: handlers.onTogglePause },
    {
      label: '会议模式（静默）',
      type: 'checkbox' as const,
      checked: isManualMeeting(),
      click: handlers.onToggleMeeting
    },
    pomodoroSubmenu(handlers),
    { type: 'separator' },
    { label: '打卡统计', click: handlers.onOpenStats },
    { label: '弹幕历史', click: handlers.onOpenHistory },
    { label: '打开设置', click: handlers.onOpenSettings },
    { label: '退出 Notify', click: () => app.quit() }
  ])
}

export function createTray(handlers: TrayHandlers, scheduler: Scheduler): void {
  const resources = join(app.getAppPath(), 'resources')
  iconNormal = nativeImage.createFromPath(join(resources, 'tray.png')).resize({ width: 16, height: 16 })
  iconPaused = nativeImage.createFromPath(join(resources, 'tray-paused.png')).resize({ width: 16, height: 16 })
  tray = new Tray(iconNormal)
  refreshTray(handlers, scheduler)
  tooltipTimer = setInterval(() => refreshTray(handlers, scheduler), 30_000)
}

export function refreshTray(handlers: TrayHandlers, scheduler: Scheduler): void {
  if (!tray) return
  const cfg = getConfig()
  tray.setImage(cfg.paused && iconPaused ? iconPaused : iconNormal!)
  tray.setToolTip(statusText(scheduler))
  tray.setContextMenu(buildMenu(handlers, scheduler))
}

export function destroyTray(): void {
  if (tooltipTimer) clearInterval(tooltipTimer)
  tray?.destroy()
  tray = null
}
