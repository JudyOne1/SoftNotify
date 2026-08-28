import { Menu, Tray, app, nativeImage, type NativeImage } from 'electron'
import { join } from 'node:path'
import { getConfig } from './store'
import { inQuietHours } from '@shared/quiet'
import type { Scheduler } from './scheduler'

export interface TrayHandlers {
  onRemindNow: () => void
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
  return `Notify：${scheduler.nextInMinutes()} 分钟后提醒`
}

function buildMenu(handlers: TrayHandlers, scheduler: Scheduler): Menu {
  const cfg = getConfig()
  const status = statusText(scheduler)
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
