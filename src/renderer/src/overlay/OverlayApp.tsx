import { useEffect, useRef, useState } from 'react'
import type { Config } from '@shared/types'
import { playReminderSound } from '../audio/player'
import './overlay.css'

interface DanmakuItem {
  id: number
  text: string
  top: number
  duration: number
  fontSize: number
  color: string
  itemId?: string
  lane: number
}

const THEMES: Record<Config['theme'], string[]> = {
  sky: ['#7dd3fc', '#a5f3fc', '#fde68a', '#fca5a5', '#bef264', '#f0abfc'],
  candy: ['#f9a8d4', '#f0abfc', '#c4b5fd', '#fda4af', '#fcd34d'],
  mono: ['#f9fafb', '#e5e7eb', '#d1d5db']
}

const SPEEDS: Record<Config['speed'], [min: number, max: number]> = {
  slow: [14, 20],
  normal: [9, 14],
  fast: [5, 9]
}

/** 屏幕纵向车道数：多条弹幕同时出现时避免重叠；窄区域自动减车道 */
const MAX_LANES = 6

let nextId = 0

/** 由配置解析弹幕显示区域（垂直百分比）与车道数 */
function resolveZone(config: Config | null): { start: number; end: number; laneCount: number } {
  const zone = config?.danmakuZone ?? 'full'
  let start = 0
  let end = 100
  if (zone === 'top-half') end = 50
  else if (zone === 'top-30') end = 30
  else if (zone === 'custom') {
    start = config?.zoneStart ?? 0
    end = config?.zoneEnd ?? 30
  }
  const band = end - start
  const laneCount = band < 25 ? 3 : band < 45 ? 4 : MAX_LANES
  return { start, end, laneCount }
}

function randomItem(
  text: string,
  itemId: string | undefined,
  priority: 'high' | undefined,
  config: Config | null,
  lane: number
): DanmakuItem {
  const colors = THEMES[config?.theme ?? 'sky']
  const [min, max] = SPEEDS[config?.speed ?? 'normal']
  // 时长按文案长度自适应：长文慢飘，读得完；重要提醒再放慢 1.5 倍
  const base = min + Math.random() * (max - min)
  const factor = (0.8 + text.length / 40) * (priority === 'high' ? 1.5 : 1)
  const duration = Math.min(max * 1.8, Math.max(min * 0.8, base * factor))
  // 在显示区域内按车道分布，车道内随机小偏移
  const { start, end, laneCount } = resolveZone(config)
  const laneHeight = (end - start) / laneCount
  const top = start + lane * laneHeight + laneHeight * (0.2 + Math.random() * 0.6)
  return {
    id: nextId++,
    text,
    top,
    duration,
    fontSize: Math.round((28 + Math.floor(Math.random() * 5) * 4) * (priority === 'high' ? 1.35 : 1)),
    color: colors[Math.floor(Math.random() * colors.length)],
    itemId,
    lane
  }
}

export default function OverlayApp(): React.JSX.Element {
  const [items, setItems] = useState<DanmakuItem[]>([])
  const configRef = useRef<Config | null>(null)
  const [style, setStyle] = useState({ opacity: 1, fontScale: 1, stroke: true })
  const [hoverEnabled, setHoverEnabled] = useState(true)
  /** 各弹幕交互区元素引用，用于向主进程上报可点击区域 */
  const wrapperRefs = useRef(new Map<number, HTMLElement>())
  /** 各车道当前占用数（固定 MAX_LANES 长度，实际使用前 zone.laneCount 个） */
  const lanes = useRef<number[]>(new Array(MAX_LANES).fill(0))

  useEffect(() => {
    void window.notifyAPI.getConfig().then((c) => {
      configRef.current = c
      if (c.danmaku) setStyle(c.danmaku)
      setHoverEnabled(c.hoverInteraction !== false)
    })
    const offConfig = window.notifyAPI.onConfigChanged((c) => {
      configRef.current = c
      if (c.danmaku) setStyle(c.danmaku)
      setHoverEnabled(c.hoverInteraction !== false)
    })
    const offReminder = window.notifyAPI.onReminder((payload) => {
      // 选最空的车道；全满则随机（车道数随显示区域收窄而减少）
      const laneCount = resolveZone(configRef.current).laneCount
      let lane = 0
      let min = Number.MAX_SAFE_INTEGER
      for (let i = 0; i < laneCount; i++) {
        if (lanes.current[i] < min) {
          min = lanes.current[i]
          lane = i
        }
      }
      if (lanes.current[lane] > 2) lane = Math.floor(Math.random() * laneCount)
      lanes.current[lane]++
      setItems((prev) => [...prev, randomItem(payload.text, payload.itemId, payload.priority, configRef.current, lane)])
      if (payload.sound) playReminderSound(payload.volume, payload.audioUrl, payload.soundPreset)
    })
    // 必须退订：HMR/重挂载时监听叠加会导致一次提醒出多条弹幕
    return () => {
      offReminder()
      offConfig()
    }
  }, [])

  /**
   * 持续上报交互区实时位置：弹幕靠 CSS 动画移动，静态矩形会立刻失效。
   * 每 120ms 读取一次实际位置，有变化才发 IPC。
   */
  useEffect(() => {
    if (!hoverEnabled) {
      window.notifyAPI.setOverlayUiRects([])
      return
    }
    let last = ''
    const timer = setInterval(() => {
      if (wrapperRefs.current.size === 0) {
        if (last !== '[]') {
          last = '[]'
          window.notifyAPI.setOverlayUiRects([])
        }
        return
      }
      const rects = Array.from(wrapperRefs.current.values()).map((el) => {
        const r = el.getBoundingClientRect()
        // 打卡胶囊覆盖在文字上，范围略放宽便于命中
        return { x: Math.round(r.left) - 6, y: Math.round(r.top) - 6, w: Math.round(r.width) + 12, h: Math.round(r.height + 12) }
      })
      const key = JSON.stringify(rects)
      if (key !== last) {
        last = key
        window.notifyAPI.setOverlayUiRects(rects)
      }
    }, 120)
    return () => clearInterval(timer)
  }, [hoverEnabled])

  const remove = (id: number): void => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) lanes.current[item.lane] = Math.max(0, lanes.current[item.lane] - 1)
      return prev.filter((i) => i.id !== id)
    })
  }

  const done = (item: DanmakuItem): void => {
    if (item.itemId) void window.notifyAPI.checkin(item.itemId)
    remove(item.id)
  }

  return (
    <div className="overlay-root">
      {items.map((item) => (
        <div
          key={item.id}
          data-dm-ui
          className="danmaku-wrap"
          ref={(el) => {
            if (el) wrapperRefs.current.set(item.id, el)
            else wrapperRefs.current.delete(item.id)
          }}
          style={{ top: `${item.top}%`, animationDuration: `${item.duration}s` }}
          onAnimationEnd={() => remove(item.id)}
        >
          <span
            className={`danmaku${style.stroke ? '' : ' danmaku-nostroke'}`}
            style={{
              fontSize: `${item.fontSize * style.fontScale}px`,
              color: item.color,
              opacity: style.opacity
            }}
          >
            {item.text}
          </span>
          {item.itemId && hoverEnabled && (
            <span className="dm-actions">
              <button type="button" className="dm-btn dm-done" onClick={() => done(item)}>
                ✓ 完成了
              </button>
              <button type="button" className="dm-btn" onClick={() => remove(item.id)}>
                忽略
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
