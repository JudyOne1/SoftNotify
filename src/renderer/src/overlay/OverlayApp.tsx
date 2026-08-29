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

let nextId = 0

function randomItem(text: string, itemId: string | undefined, config: Config | null): DanmakuItem {
  const colors = THEMES[config?.theme ?? 'sky']
  const [min, max] = SPEEDS[config?.speed ?? 'normal']
  // 时长按文案长度自适应：长文慢飘，读得完
  const base = min + Math.random() * (max - min)
  const factor = 0.8 + text.length / 40
  const duration = Math.min(max * 1.6, Math.max(min * 0.8, base * factor))
  return {
    id: nextId++,
    text,
    top: 8 + Math.random() * 70,
    duration,
    fontSize: 28 + Math.floor(Math.random() * 5) * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    itemId
  }
}

export default function OverlayApp(): React.JSX.Element {
  const [items, setItems] = useState<DanmakuItem[]>([])
  const configRef = useRef<Config | null>(null)
  const [style, setStyle] = useState({ opacity: 1, fontScale: 1, stroke: true })
  /** 记录上次穿透状态，避免每个 mousemove 都发 IPC */
  const lastIgnore = useRef(true)

  useEffect(() => {
    void window.notifyAPI.getConfig().then((c) => {
      configRef.current = c
      if (c.danmaku) setStyle(c.danmaku)
    })
    window.notifyAPI.onConfigChanged((c) => {
      configRef.current = c
      if (c.danmaku) setStyle(c.danmaku)
    })
    window.notifyAPI.onReminder((payload) => {
      setItems((prev) => [...prev, randomItem(payload.text, payload.itemId, configRef.current)])
      if (payload.sound) playReminderSound(payload.volume, payload.audioUrl)
    })
  }, [])

  /** 悬停检测：鼠标在弹幕/按钮上时关闭穿透以接收点击，离开后恢复穿透 */
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const overUi = !!(el && el.closest('[data-dm-ui]'))
      if (overUi === lastIgnore.current) {
        lastIgnore.current = !overUi
        window.notifyAPI.setOverlayIgnore(!overUi)
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  const remove = (id: number): void => setItems((prev) => prev.filter((item) => item.id !== id))

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
          {item.itemId && (
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
