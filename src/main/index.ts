import { app, ipcMain } from 'electron'
import type { Config } from '@shared/types'
import { pickTemplate } from '@shared/templates'
import { getConfig, updateConfig } from './store'
import { Scheduler } from './scheduler'
import { createOverlays, registerDisplayEvents, sendReminder } from './overlay'
import { openSettings } from './settings-window'
import { createTray, refreshTray, type TrayHandlers } from './tray'
import { applyAutostart } from './autostart'

let scheduler: Scheduler

function remind(): void {
  const cfg = getConfig()
  sendReminder(pickTemplate(), cfg.soundEnabled, cfg.volume)
  refreshTray(handlers, scheduler)
}

const handlers: TrayHandlers = {
  onRemindNow: () => scheduler.fireNow(),
  onTogglePause: () => {
    const next = updateConfig({ paused: !getConfig().paused })
    scheduler.stop()
    if (!next.paused) scheduler.start(next.intervalMinutes)
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

    scheduler = new Scheduler(remind)
    if (!cfg.paused) scheduler.start(cfg.intervalMinutes)

    createOverlays()
    registerDisplayEvents()
    createTray(handlers, scheduler)

    if (process.argv.includes('--remind-now')) {
      setTimeout(remind, 1500)
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
      refreshTray(handlers, scheduler)
      return next
    })
    ipcMain.handle('notify:test', () => remind())
  })
}

app.on('window-all-closed', () => {
  // 托盘常驻应用：关掉设置窗口不退出
})
