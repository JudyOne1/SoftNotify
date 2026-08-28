import { useEffect, useState } from 'react'
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

const COLORS = ['#7dd3fc', '#a5f3fc', '#fde68a', '#fca5a5', '#bef264', '#f0abfc']

let nextId = 0

function randomItem(text: string): DanmakuItem {
  return {
    id: nextId++,
    text,
    top: 8 + Math.random() * 70,
    duration: 9 + Math.random() * 5,
    fontSize: 28 + Math.floor(Math.random() * 5) * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]
  }
}

export default function OverlayApp(): React.JSX.Element {
  const [items, setItems] = useState<DanmakuItem[]>([])

  useEffect(() => {
    window.notifyAPI.onReminder((payload) => {
      setItems((prev) => [...prev, randomItem(payload.text)])
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
