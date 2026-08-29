import { BrowserWindow } from 'electron'
import { preloadPath, rendererUrl } from './paths'

let win: BrowserWindow | null = null

/** 打开设置窗口；route 可指定子页面（如 /welcome） */
export function openSettings(route = '/settings'): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 480,
    height: 800,
    resizable: false,
    title: 'Notify 设置',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  void win.loadURL(rendererUrl(route))
  win.on('closed', () => {
    win = null
  })
}

/** 向设置窗口推送事件（如更新状态）；窗口未开则忽略 */
export function broadcastToSettings(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}
