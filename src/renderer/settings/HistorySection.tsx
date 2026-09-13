import { useEffect, useMemo, useState } from 'react'
import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Entry {
  text: string
  name?: string
  at: number
  result?: 'overlay' | 'system' | 'overlay+system' | 'direct'
}

type Range = 'all' | 'today' | 'week'
type ResultFilter = 'all' | 'overlay' | 'system' | 'direct'

function formatTime(at: number): string {
  const d = new Date(at)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return hm
  return `${d.getMonth() + 1}-${d.getDate()} ${hm}`
}

/** 回顾视图：最近 50 条提醒记录。 */
export default function HistorySection(): React.JSX.Element {
  const [items, setItems] = useState<Entry[] | null>(null)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<Range>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')

  useEffect(() => {
    void window.notifyAPI.getHistory().then(setItems).catch(() => setItems([]))
  }, [])

  const filtered = useMemo(() => {
    if (!items) return null
    const now = Date.now()
    const start = range === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : range === 'week'
        ? now - 7 * 24 * 60 * 60 * 1000
        : 0
    const normalizedQuery = query.trim().toLowerCase()
    return items.filter((item) => {
      if (item.at < start) return false
      if (
        resultFilter !== 'all'
        && item.result !== resultFilter
        && !((resultFilter === 'overlay' || resultFilter === 'system') && item.result === 'overlay+system')
      ) return false
      if (!normalizedQuery) return true
      return `${item.name ?? ''} ${item.text}`.toLowerCase().includes(normalizedQuery)
    })
  }, [items, query, range, resultFilter])

  function resultLabel(result?: Entry['result']): string {
    switch (result) {
      case 'overlay': return '弹幕已显示'
      case 'system': return '系统通知'
      case 'overlay+system': return '弹幕 + 系统通知'
      case 'direct': return '直接提醒'
      default: return '已记录'
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {items === null && (
        <div className="rounded-lg p-4 text-center text-sm text-muted-foreground shadow-[var(--neu-inset-sm)]">加载中…</div>
      )}
      {items !== null && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索提醒内容或名称" aria-label="搜索历史记录" className="h-9 pl-8" />
          </label>
          <Select value={range} onValueChange={(value) => setRange(value as Range)}>
            <SelectTrigger className="h-9 w-28" aria-label="历史时间范围"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="week">最近 7 天</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={(value) => setResultFilter(value as ResultFilter)}>
            <SelectTrigger className="h-9 w-32" aria-label="历史处理结果"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部结果</SelectItem>
              <SelectItem value="overlay">弹幕显示</SelectItem>
              <SelectItem value="system">系统通知</SelectItem>
              <SelectItem value="direct">直接提醒</SelectItem>
            </SelectContent>
          </Select>
          {(query || range !== 'all' || resultFilter !== 'all') && (
            <Button variant="ghost" size="icon" title="清除筛选" aria-label="清除历史筛选" onClick={() => { setQuery(''); setRange('all'); setResultFilter('all') }}>
              <FilterX />
            </Button>
          )}
        </div>
      )}
      {filtered !== null && filtered.length === 0 && (
        <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset-sm)]">
          {items?.length ? '没有符合条件的记录' : '还没有飘过的弹幕'}
        </div>
      )}
      {filtered !== null &&
        filtered.map((it, i) => (
          <div key={`${it.at}-${i}`} className="flex flex-col gap-0.5 rounded-lg bg-card px-3 py-2 shadow-[var(--neu-raised-sm)]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] leading-relaxed">{it.text}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{resultLabel(it.result)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{it.name ? `${it.name} · ` : ''}{formatTime(it.at)}</span>
          </div>
        ))}
    </div>
  )
}
