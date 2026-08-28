import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { getConfig } from './store'
import type { Scheduler } from './scheduler'

export interface TrayHandlers {
  onRemindNow: () => void
  onTogglePause: () => void
  onOpenSettings: () => void
}

let tray: Tray | null = null
let tooltipTimer: NodeJS.Timeout | null = null

function buildMenu(handlers: TrayHandlers, scheduler: Scheduler): Menu {
  const cfg = getConfig()
  const status = cfg.paused ? 'Notify：已暂停' : `Notify：${scheduler.nextInMinutes()} 分钟后提醒`
  return Menu.buildFromTemplate([
    { label: status, enabled: false },
    { type: 'separator' },
    { label: '立即提醒一次', click: handlers.onRemindNow },
    { label: cfg.paused ? '恢复提醒' : '暂停提醒', click: handlers.onTogglePause },
    { type: 'separator' },
    { label: '打开设置', click: handlers.onOpenSettings },
    { label: '退出 Notify', click: () => app.quit() }
  ])
}

export function createTray(handlers: TrayHandlers, scheduler: Scheduler): void {
  const iconPath = join(app.getAppPath(), 'resources', 'tray.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  refreshTray(handlers, scheduler)
  tooltipTimer = setInterval(() => refreshTray(handlers, scheduler), 30_000)
}

export function refreshTray(handlers: TrayHandlers, scheduler: Scheduler): void {
  if (!tray) return
  const cfg = getConfig()
  tray.setToolTip(cfg.paused ? 'Notify：已暂停' : `Notify：${scheduler.nextInMinutes()} 分钟后提醒`)
  tray.setContextMenu(buildMenu(handlers, scheduler))
}

export function destroyTray(): void {
  if (tooltipTimer) clearInterval(tooltipTimer)
  tray?.destroy()
  tray = null
}
