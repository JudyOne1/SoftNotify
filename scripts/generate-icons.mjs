/**
 * 生成应用图标（纯 Node 实现 PNG 编码，无第三方依赖）：
 * - build/icon.png      512x512，electron-builder 打包用
 * - resources/tray.png  64x64，托盘图标（运行时缩放为 16x16）
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// 水滴形状：下方圆形 + 上方尖角

function inCircle(u, v, cx, cy, r) {
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

function inTriangle(u, v, [ax, ay], [bx, by], [cx, cy]) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
  const d1 = sign(u, v, ax, ay, bx, by)
  const d2 = sign(u, v, bx, by, cx, cy)
  const d3 = sign(u, v, cx, cy, ax, ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function sample(u, v, base) {
  const inDrop = inCircle(u, v, 0.5, 0.62, 0.3) || inTriangle(u, v, [0.5, 0.08], [0.26, 0.55], [0.74, 0.55])
  if (!inDrop) return [0, 0, 0, 0]
  if (inCircle(u, v, 0.41, 0.56, 0.06)) return [255, 255, 255, 220] // 高光
  return [...base, 255]
}

function generate(size, base) {
  const rgba = Buffer.alloc(size * size * 4)
  const offsets = [0.25, 0.75]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2 超采样，让边缘平滑
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (const oy of offsets) {
        for (const ox of offsets) {
          const [sr, sg, sb, sa] = sample((x + ox) / size, (y + oy) / size, base)
          r += sr
          g += sg
          b += sb
          a += sa
        }
      }
      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / 4)
      rgba[i + 1] = Math.round(g / 4)
      rgba[i + 2] = Math.round(b / 4)
      rgba[i + 3] = Math.round(a / 4)
    }
  }
  return encodePNG(size, size, rgba)
}

const BLUE = [56, 189, 248] // #38bdf8
const GRAY = [156, 163, 175] // #9ca3af，暂停状态

const targets = [
  [join(root, 'build', 'icon.png'), 512, BLUE],
  [join(root, 'resources', 'tray.png'), 64, BLUE],
  [join(root, 'resources', 'tray-paused.png'), 64, GRAY]
]

for (const [file, size, base] of targets) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, generate(size, base))
  console.log(`generated ${file} (${size}x${size})`)
}
