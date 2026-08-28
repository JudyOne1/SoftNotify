import { app, BrowserWindow, ipcMain } from 'electron'
import type { Config } from '@shared/types'
import { pickTemplate } from '@shared/templates'
import { inQuietHours } from '@shared/quiet'
import { getConfig, updateConfig } from './store'
import { Scheduler } from './scheduler'
import { createOverlays, registerDisplayEvents, sendReminder } from './overlay'
import { openSettings } from './settings-window'
import { createTray, refreshTray, type TrayHandlers } from './tray'
import { applyAutostart } from './autostart'

let scheduler: Scheduler

/** manual=true 时绕过安静时段（手动"立即提醒"/测试） */
function remind(manual = false): void {
  const cfg = getConfig()
  const inQuiet = !manual && inQuietHours(cfg.quietEnabled, cfg.quietStart, cfg.quietEnd)
  if (!inQuiet) {
    sendReminder(pickTemplate(), cfg.soundEnabled, cfg.volume)
  }
  refreshTray(handlers, scheduler)
}

function broadcastConfig(cfg: Config): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('config:changed', cfg)
  }
}

const handlers: TrayHandlers = {
  onRemindNow: () => {
    remind(true)
    const cfg = getConfig()
    if (!cfg.paused) {
      scheduler.stop()
      scheduler.start(cfg.intervalMinutes)
    }
  },
  onTogglePause: () => {
    const next = updateConfig({ paused: !getConfig().paused })
    scheduler.stop()
    if (!next.paused) scheduler.start(next.intervalMinutes)
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

    scheduler = new Scheduler(() => remind())
    scheduler.missedPolicy = cfg.missedPolicy
    if (!cfg.paused) scheduler.start(cfg.intervalMinutes)

    createOverlays()
    registerDisplayEvents()
    createTray(handlers, scheduler)

    if (process.argv.includes('--remind-now')) {
      setTimeout(() => remind(true), 1500)
    }
    if (process.argv.includes('--open-settings')) {
      setTimeout(openSettings, 500)
    }

    ipcMain.handle('config:get', () => getConfig())
    ipcMain.handle('config:set', (_event, patch: Partial<Config>) => {
      const next = updateConfig(patch)
      if (patch.intervalMinutes !== undefined || patch.paused !== undefined) {
        scheduler.stop()
        if (!next.paused) scheduler.start(next.intervalMinutes)
      }
      if (patch.autostart !== undefined) applyAutostart(next.autostart)
      scheduler.missedPolicy = next.missedPolicy
      broadcastConfig(next)
      refreshTray(handlers, scheduler)
      return next
    })
    ipcMain.handle('notify:test', () => remind(true))
  })
}

app.on('window-all-closed', () => {
  // 托盘常驻应用：关掉设置窗口不退出
})
