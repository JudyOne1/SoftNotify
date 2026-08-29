import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { sendReminder } from './overlay'
import { broadcastToSettings } from './settings-window'

let initialized = false
let timer: NodeJS.Timeout | null = null
let status: UpdateStatus = 'idle'

function setStatus(next: UpdateStatus): void {
  status = next
  broadcastToSettings('update:status', next)
}

/** 打包环境下启用自动更新；macOS 无签名时 electron-updater 会报错，静默降级为手动下载 */
export function initAutoUpdater(): void {
  if (!app.isPackaged || initialized) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => setStatus('checking'))
  autoUpdater.on('update-available', () => setStatus('downloading'))
  autoUpdater.on('update-not-available', () => setStatus('up-to-date'))
  autoUpdater.on('update-downloaded', () => {
    setStatus('downloaded')
    // 用弹幕提示「重启即更新」，不打扰
    sendReminder('新版本已就绪，退出 Notify 后将自动更新', false, 0, undefined)
  })
  autoUpdater.on('error', () => {
    // 首次报错通常意味着平台不支持（如 macOS 未签名），降级并不再轮询
    setStatus(status === 'checking' || status === 'downloading' ? 'error' : status)
  })

  void autoUpdater.checkForUpdatesAndNotify().catch(() => setStatus('error'))
  timer = setInterval(() => void autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 4 * 60 * 60 * 1000)
}

export function stopAutoUpdater(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** 手动检查；返回当前状态与远端版本 */
export async function checkForUpdateNow(): Promise<{ status: UpdateStatus; version?: string }> {
  if (!app.isPackaged) return { status: 'unsupported' }
  try {
    setStatus('checking')
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version
    setStatus(version && version !== app.getVersion() ? 'downloading' : 'up-to-date')
    return { status, version }
  } catch {
    setStatus('error')
    return { status: 'error' }
  }
}

export function registerUpdateIpc(): void {
  ipcMain.handle('update:check', () => checkForUpdateNow())
  ipcMain.handle('update:status', () => status)
}
