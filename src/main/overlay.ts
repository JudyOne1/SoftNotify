import { BrowserWindow, screen, type Display } from 'electron'
import type { ReminderPayload } from '@shared/types'
import { preloadPath, rendererUrl } from './paths'

const windows = new Map<number, BrowserWindow>()
let primaryId: number | null = null

function createOverlayFor(display: Display): void {
  const { x, y, width, height } = display.bounds
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true)
  win.once('ready-to-show', () => win.show())
  void win.loadURL(rendererUrl('/overlay'))
  windows.set(display.id, win)
}

export function createOverlays(): void {
  destroyOverlays()
  primaryId = screen.getPrimaryDisplay().id
  for (const display of screen.getAllDisplays()) {
    createOverlayFor(display)
  }
}

export function destroyOverlays(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  windows.clear()
}

/** 显示器变化（增删、分辨率/缩放变化）时重建窗口 */
export function registerDisplayEvents(): void {
  const refresh = (): void => createOverlays()
  screen.on('display-added', refresh)
  screen.on('display-removed', refresh)
  screen.on('display-metrics-changed', refresh)
}

/** 向所有屏幕广播弹幕；提示音只由主屏窗口播放，避免重复发声 */
export function sendReminder(text: string, soundEnabled: boolean, volume: number, audioUrl?: string): void {
  for (const [id, win] of windows) {
    if (win.isDestroyed()) continue
    const payload: ReminderPayload = {
      text,
      sound: soundEnabled && id === primaryId,
      volume,
      audioUrl
    }
    win.webContents.send('notify:reminder', payload)
  }
}
