import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import { join } from 'node:path'
import { getConfig } from './store'
import { inQuietHours } from '@shared/quiet'
import type { Scheduler } from './scheduler'

export interface TrayHandlers {
  onRemindNow: (itemId: string) => void
  onTogglePause: () => void
  onOpenSettings: () => void
}

let tray: Tray | null = null
let tooltipTimer: NodeJS.Timeout | null = null
let iconNormal: NativeImage | null = null
let iconPaused: NativeImage | null = null

function statusText(scheduler: Scheduler): string {
  const cfg = getConfig()
  if (cfg.paused) return 'Notify：已暂停'
  if (inQuietHours(cfg.quietEnabled, cfg.quietStart, cfg.quietEnd)) {
    return `Notify：安静时段（至 ${cfg.quietEnd}）`
  }
  const next = cfg.reminders.find((r) => r.id === scheduler.nextItemId())
  const label = next ? `${next.name} ` : ''
  const minutes = scheduler.nextInMinutes()
  if (!minutes && !next) return 'Notify：无已启用的提醒'
  return `Notify：${label}${minutes} 分钟后提醒`
}

function buildMenu(handlers: TrayHandlers, scheduler: Scheduler): Menu {
  const cfg = getConfig()
  const status = statusText(scheduler)
  const enabled = cfg.reminders.filter((r) => r.enabled)
  const remindMenu: MenuItemConstructorOptions = {
    label: '立即提醒一次',
    submenu: enabled.length
      ? enabled.map((r) => ({ label: r.name, click: () => handlers.onRemindNow(r.id) }))
      : [{ label: '（无已启用的提醒）', enabled: false }]
  }
  return Menu.buildFromTemplate([
    { label: status, enabled: false },
    { type: 'separator' },
    remindMenu,
    { label: cfg.paused ? '恢复提醒' : '暂停提醒', click: handlers.onTogglePause },
    { type: 'separator' },
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
