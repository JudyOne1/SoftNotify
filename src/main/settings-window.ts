import { BrowserWindow } from 'electron'
import { preloadPath, rendererUrl } from './paths'

let win: BrowserWindow | null = null

export function openSettings(): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 480,
    height: 600,
    resizable: false,
    title: 'Notify 设置',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  void win.loadURL(rendererUrl('/settings'))
  win.on('closed', () => {
    win = null
  })
}
