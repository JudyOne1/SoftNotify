import { useEffect, useRef, useState } from 'react'
import {
  Accessibility,
  CalendarClock,
  Clock3,
  Droplets,
  Eye,
  Timer,
  type LucideIcon
} from 'lucide-react'
import type { Config, DanmakuStyle } from '@shared/types'
import { playReminderSound } from '../audio/player'
import { unlockAudio } from '../audio/chime'
import './overlay.css'

interface DanmakuItem {
  id: number
  text: string
  top: number
  duration: number
  fontSize: number
  color: string
  itemId?: string
  priority?: 'high'
  strict?: boolean
  escalate?: number
  lane: number
  accent: string
  time: string
  name?: string
  completing?: boolean
}

const THEMES: Record<Config['theme'], string[]> = {
  sky: ['#7dd3fc', '#a5f3fc', '#fde68a', '#fca5a5', '#bef264', '#f0abfc'],
  candy: ['#f9a8d4', '#f0abfc', '#c4b5fd', '#fda4af', '#fcd34d'],
  mono: ['#f9fafb', '#e5e7eb', '#d1d5db']
}

const THEME_ACCENTS: Record<Config['theme'], string> = {
  sky: '#79a7ff',
  candy: '#e4a0ff',
  mono: '#cbd5e1'
}

const DEFAULT_STYLE: DanmakuStyle = { opacity: 1, fontScale: 1, stroke: true, capsule: true }

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

function iconFor(name: string | undefined, text: string): LucideIcon {
  const value = `${name ?? ''}${text}`
  if (/水|喝|补水|hydr/i.test(value)) return Droplets
  if (/眼|屏幕|休息|护眼/i.test(value)) return Eye
  if (/伸展|拉伸|站立|活动|肩颈/i.test(value)) return Accessibility
  if (/专注|番茄|工作/i.test(value)) return Timer
  if (/日程|会议|安排|计划/i.test(value)) return CalendarClock
  return Clock3
}

function formatTime(): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function randomItem(
  text: string,
  itemId: string | undefined,
  priority: 'high' | undefined,
  config: Config | null,
  lane: number,
  strict?: boolean,
  escalate?: number,
  name?: string
): DanmakuItem {
  const colors = THEMES[config?.theme ?? 'sky']
  // speedSeconds 为遍历基准秒，实际区间在其 ±25% 内浮动
  const sec = config?.speedSeconds ?? 11
  const min = sec * 0.78
  const max = sec * 1.25
  // 时长按文案长度自适应：长文慢飘，读得完；重要/升级再放慢
  const base = min + Math.random() * (max - min)
  const factor = (0.8 + text.length / 40) * (priority === 'high' ? 1.5 : 1) * (escalate && escalate >= 2 ? 1.3 : 1)
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
    fontSize: Math.round(
      (28 + Math.floor(Math.random() * 5) * 4) * (priority === 'high' ? 1.35 : 1) * (escalate && escalate >= 2 ? 1.2 : 1)
    ),
    color: colors[Math.floor(Math.random() * colors.length)],
    itemId,
    priority,
    strict,
    escalate,
    lane,
    accent: THEME_ACCENTS[config?.theme ?? 'sky'],
    time: formatTime(),
    name
  }
}

export default function OverlayApp(): React.JSX.Element {
  const [items, setItems] = useState<DanmakuItem[]>([])
  const configRef = useRef<Config | null>(null)
  const [style, setStyle] = useState<DanmakuStyle>(DEFAULT_STYLE)
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
      setItems((prev) => [
        ...prev,
        randomItem(
          payload.text,
          payload.itemId,
          payload.priority,
          configRef.current,
          lane,
          payload.strict,
          payload.escalate,
          payload.name
        )
      ])
      if (payload.sound) playReminderSound(payload.volume, payload.audioUrl, payload.soundPreset)
    }, () => window.notifyAPI.overlayReady())
    // 浏览器自动播放策略下 AudioContext 可能处于 suspended；用户任意点击/按键即解锁
    const unlock = (): void => unlockAudio()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    // 必须退订：HMR/重挂载时监听叠加会导致一次提醒出多条弹幕
    return () => {
      offReminder()
      offConfig()
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
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
    if (!item.itemId || item.completing) return
    setItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, completing: true } : current)))
    void window.notifyAPI.checkin(item.itemId)
    window.setTimeout(() => remove(item.id), 220)
  }

  return (
    <div className="overlay-root">
      {items.map((item) => (
        <div
          key={item.id}
          data-dm-ui
          className={`danmaku-wrap${item.completing ? ' is-completing' : ''}`}
          ref={(el) => {
            if (el) wrapperRefs.current.set(item.id, el)
            else wrapperRefs.current.delete(item.id)
          }}
          style={{ top: `${item.top}%`, animationDuration: `${item.duration}s` }}
          onAnimationEnd={() => remove(item.id)}
        >
          {style.capsule !== false ? (
            (() => {
              const Icon = iconFor(item.name, item.text)
              return (
                <span
                  className={`danmaku danmaku-capsule${item.itemId && hoverEnabled ? ' danmaku-clickable' : ''}${
                    item.priority === 'high' ? ' danmaku-important' : ''
                  }${
                    item.escalate && item.escalate >= 2 ? ' danmaku-escalated' : ''
                  }`}
                  style={{
                    fontSize: `${(item.priority === 'high' ? 18 : 15) * style.fontScale}px`,
                    opacity: style.opacity,
                    '--dm-accent': item.accent
                  } as React.CSSProperties}
                  role={item.itemId && hoverEnabled ? 'button' : undefined}
                  tabIndex={item.itemId && hoverEnabled ? 0 : undefined}
                  onClick={() => done(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      done(item)
                    }
                  }}
                  title={item.itemId && hoverEnabled ? '点击完成提醒' : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span className="danmaku-copy">{item.text}</span>
                  <time dateTime={item.time}>{item.time}</time>
                </span>
              )
            })()
          ) : (
            <span
              className={`danmaku${item.itemId && hoverEnabled ? ' danmaku-clickable' : ''}${style.stroke ? '' : ' danmaku-nostroke'}`}
              style={{
                fontSize: `${item.fontSize * style.fontScale}px`,
                color: item.color,
                opacity: style.opacity
              }}
              role={item.itemId && hoverEnabled ? 'button' : undefined}
              tabIndex={item.itemId && hoverEnabled ? 0 : undefined}
              onClick={() => done(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  done(item)
                }
              }}
              title={item.itemId && hoverEnabled ? '点击完成提醒' : undefined}
            >
              {item.text}
            </span>
          )}
          {item.itemId && hoverEnabled && (
            <span className="dm-actions">
              <button type="button" className="dm-btn dm-done" onClick={(event) => { event.stopPropagation(); done(item) }}>
                ✓ 完成了
              </button>
              <button
                type="button"
                className="dm-btn"
                title="5 分钟后再提醒一次"
                onClick={(event) => {
                  event.stopPropagation()
                  if (item.itemId) void window.notifyAPI.snoozeReminder(item.itemId)
                  remove(item.id)
                }}
              >
                +5 分钟
              </button>
              {!item.strict && (
                <button type="button" className="dm-btn" onClick={(event) => { event.stopPropagation(); remove(item.id) }}>
                  忽略
                </button>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
