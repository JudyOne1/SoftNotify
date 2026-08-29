import { BrowserWindow, screen, type Display } from 'electron'
import type { Config, ReminderPayload } from '@shared/types'
import { getConfig } from './store'
import { preloadPath, rendererUrl } from './paths'

const windows = new Map<number, BrowserWindow>()
let primaryId: number | null = null

export interface UiRect {
  x: number
  y: number
  w: number
  h: number
}

/** 每个弹幕窗口的可交互区域（窗口内容坐标），由渲染层上报 */
const uiRects = new Map<number, UiRect[]>()
/** 各窗口当前是否处于穿透状态 */
const ignoreState = new Map<number, boolean>()
let hoverTimer: NodeJS.Timeout | null = null

function createOverlayFor(display: Display): void {
  const { x, y, width, height } = display.workArea
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
  ignoreState.set(win.id, true)
  win.once('ready-to-show', () => win.show())
  void win.loadURL(rendererUrl('/overlay'))
  windows.set(display.id, win)
}

function setWinIgnore(win: BrowserWindow, ignore: boolean): void {
  const id = win.id
  if (ignoreState.get(id) === ignore) return
  ignoreState.set(id, ignore)
  win.setIgnoreMouseEvents(ignore)
}

/**
 * 悬停检测：轮询光标位置，命中弹幕交互区则关闭该窗口穿透（接收点击），否则保持穿透。
 * 不用 setIgnoreMouseEvents(forward:true)——该选项在本机触发渲染进程崩溃。
 */
export function startHoverPolling(): void {
  if (hoverTimer) return
  hoverTimer = setInterval(() => {
    try {
      const cursor = screen.getCursorScreenPoint()
      for (const win of windows.values()) {
        if (win.isDestroyed()) continue
        const rects = uiRects.get(win.id) ?? []
        let hover = false
        if (rects.length > 0) {
          const b = win.getBounds()
          if (cursor.x >= b.x && cursor.x <= b.x + b.width && cursor.y >= b.y && cursor.y <= b.y + b.height) {
            const lx = cursor.x - b.x
            const ly = cursor.y - b.y
            hover = rects.some((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h)
          }
        }
        setWinIgnore(win, !hover)
      }
    } catch {
      // 光标查询异常时保持现状
    }
  }, 80)
}

export function stopHoverPolling(): void {
  if (hoverTimer) clearInterval(hoverTimer)
  hoverTimer = null
}

export function setOverlayUiRects(win: BrowserWindow, rects: UiRect[]): void {
  uiRects.set(win.id, rects)
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
  uiRects.clear()
  ignoreState.clear()
}

/** 显示器变化（增删、分辨率/缩放变化）时重建窗口 */
export function registerDisplayEvents(): void {
  const refresh = (): void => createOverlays()
  screen.on('display-added', refresh)
  screen.on('display-removed', refresh)
  screen.on('display-metrics-changed', refresh)
}

/** 显示器按屏幕 x 坐标从左到右排序的序号 → Display */
export function sortedDisplays(): Display[] {
  return [...screen.getAllDisplays()].sort((a, b) => a.workArea.x - b.workArea.x)
}

/** 按配置解析本次弹幕应投递的显示器集合 */
function targetIds(cfg: Config): Set<number> | null {
  if (cfg.displayMode === 'primary') return new Set([screen.getPrimaryDisplay().id])
  if (cfg.displayMode === 'custom') {
    const sorted = sortedDisplays()
    const ids = new Set<number>()
    for (const idx of cfg.customDisplays) {
      const d = sorted[idx]
      if (d) ids.add(d.id)
    }
    // 配置的序号全部失配（显示器变动）→ 回退全部
    return ids.size > 0 ? ids : null
  }
  return null
}

/** 向屏幕广播弹幕；提示音只由主屏窗口播放，避免重复发声。投递范围按 displayMode 过滤 */
export function sendReminder(
  text: string,
  soundEnabled: boolean,
  volume: number,
  audioUrl?: string,
  itemId?: string,
  priority?: 'high',
  soundPreset?: Config['soundPreset']
): void {
  const cfgTargets = targetIds(getConfig())
  for (const [id, win] of windows) {
    if (win.isDestroyed()) continue
    if (cfgTargets && !cfgTargets.has(id)) continue
    const payload: ReminderPayload = {
      text,
      sound: soundEnabled && id === primaryId,
      volume,
      audioUrl,
      itemId,
      priority,
      soundPreset
    }
    win.webContents.send('notify:reminder', payload)
  }
}
