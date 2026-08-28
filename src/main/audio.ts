import { BrowserWindow, app, dialog, ipcMain, protocol } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import type { AudioChoiceResult } from '@shared/types'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac'])

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac'
}

function audioDir(): string {
  return join(app.getPath('userData'), 'audio')
}

/** 必须在 app ready 之前调用：注册自定义媒体协议为标准安全协议 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
    }
  ])
}

/** app ready 后调用：media://localhost/<文件名> 只映射 userData/audio 目录，供渲染进程播放 */
export function handleMediaProtocol(): void {
  const dir = audioDir()
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url)
      const name = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      if (url.host !== 'localhost' || !/^[\w.-]+$/.test(name)) {
        return new Response('bad request', { status: 400 })
      }
      const file = resolve(dir, name)
      if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
        return new Response('not found', { status: 404 })
      }
      const mime = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
      return new Response(readFileSync(file), { headers: { 'content-type': mime } })
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}

/** 弹选择框，把选中的音频复制到 userData/audio/（覆盖旧的 custom.*），返回结果 */
export async function chooseAudio(): Promise<AudioChoiceResult> {
  const parent = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/settings'))
  const options = {
    title: '选择提示音',
    filters: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }],
    properties: ['openFile'] as Array<'openFile'>
  }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const src = result.canceled ? undefined : result.filePaths[0]
  if (!src) return { canceled: true }

  const ext = extname(src).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) return { canceled: false, reason: 'ext' }
  if (statSync(src).size > MAX_BYTES) return { canceled: false, reason: 'size' }

  const dir = audioDir()
  mkdirSync(dir, { recursive: true })
  for (const old of readdirSync(dir)) {
    if (/^custom\./.test(old)) unlinkSync(join(dir, old))
  }
  const fileName = `custom${ext}`
  copyFileSync(src, join(dir, fileName))
  return { canceled: false, fileName }
}

export function registerAudioIpc(): void {
  ipcMain.handle('audio:choose', () => chooseAudio())
}
