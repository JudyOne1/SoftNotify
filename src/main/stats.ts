import { app } from 'electron'
import { powerMonitor } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Checkin {
  date: string // YYYY-MM-DD
  itemId: string
  at: number
}

interface StatsFile {
  checkins: Checkin[]
  /** 每日活跃分钟数（getSystemIdleTime 轮询累计） */
  activeMinutes: Record<string, number>
}

const MAX_CHECKINS = 5000
let cache: StatsFile | null = null
let usageTimer: NodeJS.Timeout | null = null

function file(): string {
  return join(app.getPath('userData'), 'stats.json')
}

function load(): StatsFile {
  if (!cache) {
    try {
      const raw = JSON.parse(readFileSync(file(), 'utf-8')) as Partial<StatsFile>
      cache = {
        checkins: Array.isArray(raw.checkins) ? raw.checkins.slice(-MAX_CHECKINS) : [],
        activeMinutes: raw.activeMinutes && typeof raw.activeMinutes === 'object' ? raw.activeMinutes : {}
      }
    } catch {
      cache = { checkins: [], activeMinutes: {} }
    }
  }
  return cache
}

function save(): void {
  const f = file()
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(load()), 'utf-8')
}

export function todayStr(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

export function addCheckin(itemId: string, at = Date.now()): void {
  const data = load()
  data.checkins.push({ date: todayStr(new Date(at)), itemId, at })
  if (data.checkins.length > MAX_CHECKINS) data.checkins.splice(0, data.checkins.length - MAX_CHECKINS)
  save()
}

export function todayCheckinCount(): number {
  const today = todayStr()
  return load().checkins.filter((c) => c.date === today).length
}

/** 某项今日打卡次数 */
export function todayCountFor(itemId: string): number {
  const today = todayStr()
  return load().checkins.filter((c) => c.date === today && c.itemId === itemId).length
}

/** 统计页数据：近 N 天的打卡/活跃时长聚合 */
export function getStats(days = 365): {
  checkinsPerDay: Array<{ date: string; count: number }>
  activeMinutes: Record<string, number>
  todayByItem: Record<string, number>
  todayTotal: number
} {
  const data = load()
  const counts = new Map<string, number>()
  for (const c of data.checkins) counts.set(c.date, (counts.get(c.date) ?? 0) + 1)

  const checkinsPerDay: Array<{ date: string; count: number }> = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = todayStr(d)
    checkinsPerDay.push({ date: key, count: counts.get(key) ?? 0 })
  }

  const t = todayStr()
  const todayByItem: Record<string, number> = {}
  let todayTotal = 0
  for (const c of data.checkins) {
    if (c.date !== t) continue
    todayByItem[c.itemId] = (todayByItem[c.itemId] ?? 0) + 1
    todayTotal++
  }

  return { checkinsPerDay, activeMinutes: { ...data.activeMinutes }, todayByItem, todayTotal }
}

/** 活跃时长采集：每分钟检查一次，1 分钟内有过输入则计 1 分钟 */
export function startUsageTracking(): void {
  if (usageTimer) return
  usageTimer = setInterval(() => {
    try {
      const idle = powerMonitor.getSystemIdleTime()
      if (idle < 60) {
        const data = load()
        const key = todayStr()
        data.activeMinutes[key] = (data.activeMinutes[key] ?? 0) + 1
        // 只在数据变化时落盘，且每天最多 1440 条，直接写无压力
        save()
      }
    } catch {
      // getSystemIdleTime 个别平台异常时静默跳过
    }
  }, 60_000)
}

export function stopUsageTracking(): void {
  if (usageTimer) clearInterval(usageTimer)
  usageTimer = null
}
