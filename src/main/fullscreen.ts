import { screen } from 'electron'
import { getConfig } from './store'

/**
 * 全屏免打扰：前台窗口矩形铺满任一显示器（≥98%）即视为全屏（观影/游戏）。
 * 检测用 get-windows（sindresorhus 官方，动态导入 ESM）。
 * 注意 DPI：get-windows 返回物理像素，Electron display.bounds 是 DIP，
 * 需按 1x 与 scaleFactor 两档比例匹配，否则缩放屏上最大化窗口会误判。
 */

let fullscreen = false
let timer: NodeJS.Timeout | null = null
let probing = false

export function isFullscreenApp(): boolean {
  return fullscreen
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 窗口是否铺满该显示器（允许 1x 与显示器缩放系数两种像素口径，容差 2%） */
function coversDisplay(b: Rect, d: { bounds: Rect; scaleFactor: number }): boolean {
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  const inX = cx >= d.bounds.x && cx <= d.bounds.x + d.bounds.width
  const inY = cy >= d.bounds.y && cy <= d.bounds.y + d.bounds.height
  if (!inX || !inY) return false
  return [1, d.scaleFactor].some((s) => {
    const wOk = Math.abs(b.width - d.bounds.width * s) <= d.bounds.width * s * 0.02
    const hOk = Math.abs(b.height - d.bounds.height * s) <= d.bounds.height * s * 0.02
    return wOk && hOk
  })
}

export function startFullscreenPolling(onChange: (fullscreen: boolean) => void): void {
  if (timer) return
  const tick = async (): Promise<void> => {
    if (probing) return
    if (!getConfig().fullscreenDetect) {
      if (fullscreen) {
        fullscreen = false
        onChange(false)
      }
      return
    }
    probing = true
    try {
      const { activeWindow } = await import('get-windows')
      const aw = await activeWindow()
      let fs = false
      if (aw) {
        const b = aw.bounds as Rect
        fs = screen.getAllDisplays().some((d) => coversDisplay(b, d))
      }
      if (fs !== fullscreen) {
        fullscreen = fs
        onChange(fs)
      }
    } catch {
      // 检测失败静默视为非全屏
    } finally {
      probing = false
    }
  }
  void tick()
  timer = setInterval(() => void tick(), 3000)
}

export function stopFullscreenPolling(): void {
  if (timer) clearInterval(timer)
  timer = null
}
