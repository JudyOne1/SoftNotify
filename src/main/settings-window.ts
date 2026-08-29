import { BrowserWindow } from 'electron'
import { release } from 'node:os'
import { getConfig, updateConfig } from './store'
import { preloadPath, rendererUrl } from './paths'

let win: BrowserWindow | null = null
let saveTimer: NodeJS.Timeout | null = null

const isMac = process.platform === 'darwin'
/** Win11 = build 22000+，支持 Mica 材质 */
const isWin11 = process.platform === 'win32' && Number(release().split('.')[2]) >= 22000

/** 是否使用系统原生材质（Win11 Mica / macOS vibrancy），渲染层据此把背景转半透明 */
export function usesNativeMaterial(): boolean {
  return isMac || isWin11
}

/** 打开设置窗口；route 可指定子页面（如 /welcome） */
export function openSettings(route = '/settings'): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }
  const bounds = getConfig().settingsWindow
  win = new BrowserWindow({
    width: bounds?.width ?? 680,
    height: bounds?.height ?? 700,
    minWidth: 580,
    minHeight: 560,
    resizable: true,
    title: 'Notify 设置',
    backgroundColor: '#0f1115',
    ...(isWin11 ? { backgroundMaterial: 'mica' as const } : {}),
    ...(isMac ? { vibrancy: 'sidebar' as const } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  void win.loadURL(rendererUrl(route))

  // 记忆窗口尺寸（防抖，仅尺寸不记位置，规避多显示器坐标问题）
  win.on('resize', () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return
      const [width, height] = win.getSize()
      updateConfig({ settingsWindow: { width, height } })
    }, 600)
  })
  win.on('closed', () => {
    win = null
  })
}

/** 打开设置窗口并切到指定分区（统计/历史等），供托盘快捷入口使用 */
export function openSettingsTo(section: string): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    win.webContents.send('ui:navigate', section)
    return
  }
  openSettings('/settings')
  win?.webContents.once('did-finish-load', () => {
    win?.webContents.send('ui:navigate', section)
  })
}

/** 向设置窗口推送事件（如更新状态）；窗口未开则忽略 */
export function broadcastToSettings(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}
