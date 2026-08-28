import { useEffect, useRef, useState } from 'react'
import type { Config } from '@shared/types'
import { playChime } from '../audio/chime'
import './overlay.css'

interface DanmakuItem {
  id: number
  text: string
  top: number
  duration: number
  fontSize: number
  color: string
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

function randomItem(text: string, config: Config | null): DanmakuItem {
  const colors = THEMES[config?.theme ?? 'sky']
  const [min, max] = SPEEDS[config?.speed ?? 'normal']
  return {
    id: nextId++,
    text,
    top: 8 + Math.random() * 70,
    duration: min + Math.random() * (max - min),
    fontSize: 28 + Math.floor(Math.random() * 5) * 4,
    color: colors[Math.floor(Math.random() * colors.length)]
  }
}

export default function OverlayApp(): React.JSX.Element {
  const [items, setItems] = useState<DanmakuItem[]>([])
  const configRef = useRef<Config | null>(null)

  useEffect(() => {
    void window.notifyAPI.getConfig().then((c) => {
      configRef.current = c
    })
    window.notifyAPI.onConfigChanged((c) => {
      configRef.current = c
    })
    window.notifyAPI.onReminder((payload) => {
      setItems((prev) => [...prev, randomItem(payload.text, configRef.current)])
      if (payload.sound) playChime(payload.volume)
    })
  }, [])

  const remove = (id: number): void => setItems((prev) => prev.filter((item) => item.id !== id))

  return (
    <div className="overlay-root">
      {items.map((item) => (
        <span
          key={item.id}
          className="danmaku"
          style={{
            top: `${item.top}%`,
            fontSize: `${item.fontSize}px`,
            color: item.color,
            animationDuration: `${item.duration}s`
          }}
          onAnimationEnd={() => remove(item.id)}
        >
          {item.text}
        </span>
      ))}
    </div>
  )
}
