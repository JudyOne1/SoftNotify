import { useEffect, useState } from 'react'
import './settings.css'

interface Entry {
  text: string
  name?: string
  at: number
}

function formatTime(at: number): string {
  const d = new Date(at)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return hm
  return `${d.getMonth() + 1}-${d.getDate()} ${hm}`
}

export default function HistoryApp(): React.JSX.Element {
  const [items, setItems] = useState<Entry[] | null>(null)

  useEffect(() => {
    void window.notifyAPI.getHistory().then(setItems)
  }, [])

  return (
    <div className="settings-app">
      <div className="settings">
        <h1>弹幕历史</h1>
        <p className="section-hint">最近 50 条，仅保存在本机</p>
        <div className="history-list">
          {items === null && <div className="plan-empty">加载中…</div>}
          {items !== null && items.length === 0 && <div className="plan-empty">还没有飘过的弹幕</div>}
          {items !== null &&
            items.map((it, i) => (
              <div key={`${it.at}-${i}`} className="history-item">
                <span className="history-text">{it.text}</span>
                <span className="history-meta">
                  {it.name ? `${it.name} · ` : ''}
                  {formatTime(it.at)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
