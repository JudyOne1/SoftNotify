import { BrowserWindow } from 'electron'
import { preloadPath, rendererUrl } from './paths'

let win: BrowserWindow | null = null

export function openStats(): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 560,
    height: 480,
    resizable: false,
    title: '打卡统计',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  void win.loadURL(rendererUrl('/stats'))
  win.on('closed', () => {
    win = null
  })
}
