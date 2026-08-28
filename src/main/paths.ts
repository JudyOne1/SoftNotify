import { join } from 'node:path'

/** 渲染层入口：开发模式走 dev server，生产模式走打包产物 */
export function rendererUrl(hash: string): string {
  if (process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/index.html#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

export function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}
