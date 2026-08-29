import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import { join } from 'node:path'
import { getConfig } from './store'
import { inQuietHours } from '@shared/quiet'
import type { Scheduler } from './scheduler'

export interface TrayHandlers {
  onRemindNow: (itemId: string) => void
  onApplyProfile: (id: string) => void
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
  const due = scheduler.nextDue()
  if (!due) return 'Notify：无已启用的提醒'
  const name =
    cfg.reminders.find((r) => r.id === due.id)?.name ?? cfg.schedules.find((s) => s.id === due.id)?.name ?? ''
  return `Notify：${name ? `${name} ` : ''}${scheduler.nextInMinutes()} 分钟后提醒`
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

function buildMenu(handlers: TrayHandlers, scheduler: Scheduler): Menu {
  const cfg = getConfig()
  return Menu.buildFromTemplate([
    { label: statusText(scheduler), enabled: false },
    { type: 'separator' },
    remindSubmenu(handlers),
    profileSubmenu(handlers),
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
