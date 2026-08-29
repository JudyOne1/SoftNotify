import { BrowserWindow } from 'electron'
import { preloadPath, rendererUrl } from './paths'

let win: BrowserWindow | null = null

export function openHistory(): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 380,
    height: 520,
    resizable: false,
    title: '弹幕历史',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  void win.loadURL(rendererUrl('/history'))
  win.on('closed', () => {
    win = null
  })
}
