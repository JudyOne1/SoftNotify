import { useEffect, useMemo, useState } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import type { Config, StatsSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Metric = 'checkins' | 'usage'

function useScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const apply = (): void => setScheme(mql.matches ? 'light' : 'dark')
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])
  return scheme
}

/** 统计分区：活跃图 + 今日进度 + 导出（嵌入设置窗口侧栏） */
export default function StatsSection(): React.JSX.Element {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [metric, setMetric] = useState<Metric>('checkins')
  const [exported, setExported] = useState(false)
  const scheme = useScheme()

  useEffect(() => {
    void window.notifyAPI.getStats().then(setStats)
    void window.notifyAPI.getConfig().then(setConfig)
  }, [])

  const calendar = useMemo(() => {
    if (!stats) return []
    const today = new Date()
    const byDate = new Map(stats.checkinsPerDay.map((d) => [d.date, d.count]))
    const out: Array<{ date: string; count: number; level: number }> = []
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (metric === 'checkins') {
        const count = byDate.get(key) ?? 0
        out.push({ date: key, count, level: count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4 })
      } else {
        const minutes = stats.activeMinutes[key] ?? 0
        out.push({ date: key, count: minutes, level: minutes === 0 ? 0 : minutes < 120 ? 1 : minutes < 240 ? 2 : minutes < 360 ? 3 : 4 })
      }
    }
    return out
  }, [stats, metric])

  const goalItems = (config?.reminders ?? []).filter((r) => r.enabled && r.dailyGoal)
  const otherItems = (config?.reminders ?? []).filter((r) => r.enabled && !r.dailyGoal)

  async function exportStats(): Promise<void> {
    const res = await window.notifyAPI.exportStats()
    if (!res.canceled) setExported(true)
    setTimeout(() => setExported(false), 1800)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checkins">打卡次数</SelectItem>
            <SelectItem value="usage">活跃时长</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" onClick={() => void exportStats()}>
          导出 JSON
        </Button>
        {exported && <span className="text-xs text-[var(--ok,#34d399)]">已导出</span>}
      </div>

      <div className="overflow-x-auto rounded-lg bg-card p-4 shadow-[var(--neu-raised)]">
        {stats ? (
          <ActivityCalendar
            data={calendar}
            theme={{
              light: ['#e3e6ec', '#c6e9fb', '#7dd3fc', '#38bdf8', '#0284c7'],
              dark: ['#1e2430', '#164e63', '#0e7490', '#22d3ee', '#67e8f9']
            }}
            colorScheme={scheme}
            fontSize={11}
            labels={{ legend: { less: '少', more: '多' } }}
          />
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">加载中…</div>
        )}
      </div>

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">今日进度</h2>
      <div className="flex flex-col gap-2.5">
        {goalItems.map((r) => {
          const done = stats?.todayByItem[r.id] ?? 0
          const pct = Math.min(100, Math.round((done / (r.dailyGoal ?? 1)) * 100))
          return (
            <div key={r.id} className="rounded-lg bg-card p-3 shadow-[var(--neu-raised-sm)]">
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span>{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {done}/{r.dailyGoal}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full shadow-[var(--neu-inset-sm)]">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {otherItems.length > 0 && (
          <div className="rounded-lg bg-card p-3 text-[13px] text-muted-foreground shadow-[var(--neu-raised-sm)]">
            其他：{otherItems.map((r) => `${r.name} ${stats?.todayByItem[r.id] ?? 0} 次`).join(' · ')}
          </div>
        )}
        {stats?.todayTotal === 0 && (
          <div className="rounded-lg p-4 text-center text-[13px] text-muted-foreground shadow-[var(--neu-inset-sm)]">
            今天还没有打卡，悬停弹幕点「✓ 完成了」试试
          </div>
        )}
      </div>
    </div>
  )
}
