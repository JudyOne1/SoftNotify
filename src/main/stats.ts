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
  /** 已庆祝的里程碑（如 water-7），防重复 */
  celebrated: string[]
  /** 番茄钟完成次数（按日） */
  focusSessions: Record<string, number>
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
        activeMinutes: raw.activeMinutes && typeof raw.activeMinutes === 'object' ? raw.activeMinutes : {},
        celebrated: Array.isArray(raw.celebrated) ? raw.celebrated : [],
        focusSessions: raw.focusSessions && typeof raw.focusSessions === 'object' ? raw.focusSessions : {}
      }
    } catch {
      cache = { checkins: [], activeMinutes: {}, celebrated: [], focusSessions: {} }
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

/** 统计页数据：近 N 天的打卡/活跃时长聚合 + 今日分项 */
export function getStats(days = 365): {
  checkinsPerDay: Array<{ date: string; count: number }>
  activeMinutes: Record<string, number>
  todayByItem: Record<string, number>
  todayTotal: number
  /** 每个提醒项的每日打卡次数（统计页算 streak 用） */
  itemDaily: Record<string, Record<string, number>>
  todayFocus: number
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

  const itemDaily: Record<string, Record<string, number>> = {}
  for (const c of data.checkins) {
    const per = (itemDaily[c.itemId] ??= {})
    per[c.date] = (per[c.date] ?? 0) + 1
  }

  return {
    checkinsPerDay,
    activeMinutes: { ...data.activeMinutes },
    todayByItem,
    todayTotal,
    itemDaily,
    todayFocus: data.focusSessions[t] ?? 0
  }
}

/** 某提醒项的每日打卡次数（里程碑/streak 计算用） */
export function itemDailyCounts(itemId: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of load().checkins) {
    if (c.itemId !== itemId) continue
    out[c.date] = (out[c.date] ?? 0) + 1
  }
  return out
}

/** 已庆祝里程碑 */
export function isCelebrated(key: string): boolean {
  return load().celebrated.includes(key)
}

export function markCelebrated(key: string): void {
  const data = load()
  if (!data.celebrated.includes(key)) data.celebrated.push(key)
  save()
}

/** 番茄钟完成计数 */
export function addFocusSession(): void {
  const data = load()
  const key = todayStr()
  data.focusSessions[key] = (data.focusSessions[key] ?? 0) + 1
  save()
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
