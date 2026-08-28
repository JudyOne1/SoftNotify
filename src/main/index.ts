import { app, BrowserWindow, ipcMain } from 'electron'
import type { Config, ReminderItem } from '@shared/types'
import { pickText } from '@shared/templates'
import { inQuietHours } from '@shared/quiet'
import { getConfig, updateConfig } from './store'
import { Scheduler } from './scheduler'
import { createOverlays, registerDisplayEvents, sendReminder } from './overlay'
import { openSettings } from './settings-window'
import { createTray, refreshTray, type TrayHandlers } from './tray'
import { applyAutostart } from './autostart'

let scheduler: Scheduler

function findItem(itemId: string | undefined): ReminderItem | null {
  const cfg = getConfig()
  if (itemId) {
    const item = cfg.reminders.find((r) => r.id === itemId)
    if (item) return item
  }
  // 未指定或已删除：回退到第一个已启用项
  return cfg.reminders.find((r) => r.enabled) ?? null
}

/** manual=true 时绕过安静时段（手动"立即提醒"/测试） */
function remind(item: ReminderItem | null, manual = false): void {
  const cfg = getConfig()
  const inQuiet = !manual && inQuietHours(cfg.quietEnabled, cfg.quietStart, cfg.quietEnd)
  if (!inQuiet) {
    sendReminder(pickText(item), cfg.soundEnabled, cfg.volume)
  }
  refreshTray(handlers, scheduler)
}

function broadcastConfig(cfg: Config): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('config:changed', cfg)
  }
}

const handlers: TrayHandlers = {
  onRemindNow: (itemId: string) => {
    const item = findItem(itemId)
    remind(item, true)
    const cfg = getConfig()
    if (!cfg.paused && item?.enabled) {
      scheduler.resetItem(item.id)
    }
  },
  onTogglePause: () => {
    const next = updateConfig({ paused: !getConfig().paused })
    scheduler.stop()
    if (!next.paused) scheduler.sync(next.reminders)
    broadcastConfig(next)
    refreshTray(handlers, scheduler)
  },
  onOpenSettings: () => openSettings()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openSettings())

  void app.whenReady().then(() => {
    const cfg = getConfig()
    applyAutostart(cfg.autostart)

    scheduler = new Scheduler((itemId) => remind(findItem(itemId)))
    if (!cfg.paused) scheduler.sync(cfg.reminders)

    createOverlays()
    registerDisplayEvents()
    createTray(handlers, scheduler)

    if (process.argv.includes('--remind-now')) {
      setTimeout(() => remind(findItem(undefined), true), 1500)
    }
    if (process.argv.includes('--open-settings')) {
      setTimeout(openSettings, 500)
    }

    ipcMain.handle('config:get', () => getConfig())
    ipcMain.handle('config:set', (_event, patch: Partial<Config>) => {
      const next = updateConfig(patch)
      if (patch.reminders !== undefined || patch.paused !== undefined) {
        if (next.paused) {
          scheduler.stop()
        } else {
          scheduler.sync(next.reminders)
        }
      }
      if (patch.autostart !== undefined) applyAutostart(next.autostart)
      scheduler.missedPolicy = next.missedPolicy
      broadcastConfig(next)
      refreshTray(handlers, scheduler)
      return next
    })
    ipcMain.handle('notify:test', (_event, itemId?: string) => {
      remind(findItem(itemId), true)
    })
  })
}

app.on('window-all-closed', () => {
  // 托盘常驻应用：关掉设置窗口不退出
})
