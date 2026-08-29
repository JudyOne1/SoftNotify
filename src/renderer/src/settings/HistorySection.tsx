import { useEffect, useState } from 'react'

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

/** 历史分区：最近 50 条弹幕（嵌入设置窗口侧栏） */
export default function HistorySection(): React.JSX.Element {
  const [items, setItems] = useState<Entry[] | null>(null)

  useEffect(() => {
    void window.notifyAPI.getHistory().then(setItems)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      {items === null && (
        <div className="rounded-lg p-4 text-center text-sm text-muted-foreground shadow-[var(--neu-inset-sm)]">加载中…</div>
      )}
      {items !== null && items.length === 0 && (
        <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset-sm)]">
          还没有飘过的弹幕
        </div>
      )}
      {items !== null &&
        items.map((it, i) => (
          <div key={`${it.at}-${i}`} className="flex flex-col gap-0.5 rounded-lg bg-card px-3 py-2 shadow-[var(--neu-raised-sm)]">
            <span className="text-[13px] leading-relaxed">{it.text}</span>
            <span className="text-[11px] text-muted-foreground">
              {it.name ? `${it.name} · ` : ''}
              {formatTime(it.at)}
            </span>
          </div>
        ))}
    </div>
  )
}
