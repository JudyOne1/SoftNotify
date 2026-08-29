import { powerMonitor } from 'electron'
import type { ReminderItem, ScheduleItem } from '@shared/types'
import { applyJitter, computeIntervalAt, computeScheduleAt } from '@shared/schedule-core'

type Source = 'reminder' | 'schedule'

/**
 * 双源调度：间隔提醒（r:id）按固定周期（可带抖动），定时日程（s:id）按钟点。
 * 单定时器只对准最近的下一次触发；sync 按 key+签名 差量更新，改某项不重置其他项。
 * 时刻计算全部在 shared/schedule-core.ts（纯函数，可单测）。
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null
  /** 每个已启用项的下一次触发时间（epoch ms） */
  private nextAt = new Map<string, number>()
  /** 变更检测签名：间隔值 / time+weekdays+date */
  private sigs = new Map<string, string>()
  private intervalsMs = new Map<string, number>()
  private scheduleItems = new Map<string, ScheduleItem>()
  /** 休眠错过提醒的策略：'fire' 唤醒后补发，'skip' 丢弃 */
  missedPolicy: 'fire' | 'skip' = 'fire'
  /** 间隔抖动比例（0-0.5），0 关闭 */
  jitterRatio = 0

  constructor(private readonly onRemind: (source: Source, itemId: string) => void) {
    powerMonitor.on('resume', this.handleResume)
  }

  sync(reminders: ReminderItem[], schedules: ScheduleItem[]): void {
    const desired = new Map<string, string>()
    for (const r of reminders) {
      if (r.enabled) desired.set(`r:${r.id}`, String(r.intervalMinutes))
    }
    for (const s of schedules) {
      if (s.enabled) desired.set(`s:${s.id}`, `${s.time}|${[...s.weekdays].sort().join(',')}|${s.date ?? ''}`)
    }

    // 移除已删除/停用/签名变化的项
    for (const key of [...this.nextAt.keys()]) {
      if (desired.get(key) !== this.sigs.get(key)) this.nextAt.delete(key)
    }
    this.sigs = new Map(desired)

    const now = Date.now()
    this.scheduleItems.clear()
    for (const s of schedules) {
      if (s.enabled) this.scheduleItems.set(s.id, s)
    }

    for (const [key, sig] of desired) {
      if (this.nextAt.has(key)) continue
      const nowDate = new Date(now)
      if (key.startsWith('r:')) {
        const minutes = Number(sig)
        this.intervalsMs.set(key, minutes * 60_000)
        this.nextAt.set(key, this.jitteredInterval(minutes, nowDate))
      } else {
        const item = this.scheduleItems.get(key.slice(2))
        if (!item) continue
        const at = computeScheduleAt(item, nowDate)
        if (at > now) this.nextAt.set(key, at)
      }
    }
    this.arm()
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.nextAt.clear()
    this.sigs.clear()
    this.intervalsMs.clear()
    this.scheduleItems.clear()
  }

  /** 手动触发后重置间隔项的周期；定时日程按钟点触发，无需重置 */
  resetItem(itemId: string): void {
    const key = `r:${itemId}`
    const ms = this.intervalsMs.get(key)
    if (ms && this.nextAt.has(key)) {
      this.nextAt.set(key, this.jitteredInterval(ms / 60_000, new Date()))
      this.arm()
    }
  }

  /** 距最近一次提醒的分钟数（向上取整），无已启用项时返回 0 */
  nextInMinutes(): number {
    const at = this.earliest()
    if (at === null) return 0
    return Math.max(0, Math.ceil((at - Date.now()) / 60_000))
  }

  /** 最近将触发的项：kind + id，无则 null */
  nextDue(): { source: Source; id: string } | null {
    const at = this.earliest()
    if (at === null) return null
    for (const [key, t] of this.nextAt) {
      if (t === at) {
        const [source, id] = key.startsWith('r:') ? (['reminder', key.slice(2)] as const) : (['schedule', key.slice(2)] as const)
        return { source, id }
      }
    }
    return null
  }

  /** 间隔周期 + 抖动 */
  private jitteredInterval(intervalMinutes: number, now: Date): number {
    return applyJitter(computeIntervalAt(intervalMinutes, now), intervalMinutes * 60_000, this.jitterRatio)
  }

  private earliest(): number | null {
    let min: number | null = null
    for (const at of this.nextAt.values()) {
      if (min === null || at < min) min = at
    }
    return min
  }

  /** 只挂一个定时器，对准最近的下一次触发 */
  private arm(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const at = this.earliest()
    if (at === null) return
    this.timer = setTimeout(() => this.fire(this.nextKey()!), Math.max(0, at - Date.now()))
  }

  private nextKey(): string | null {
    const at = this.earliest()
    if (at === null) return null
    for (const [key, t] of this.nextAt) {
      if (t === at) return key
    }
    return null
  }

  private fire(key: string): void {
    this.timer = null
    const now = Date.now()
    if (key.startsWith('r:')) {
      const ms = this.intervalsMs.get(key)
      if (!ms) return
      this.nextAt.set(key, this.jitteredInterval(ms / 60_000, new Date(now)))
      this.onRemind('reminder', key.slice(2))
    } else {
      const item = this.scheduleItems.get(key.slice(2))
      if (!item) return
      this.onRemind('schedule', item.id)
      if (item.date) {
        // 一次性日程：触发后不再排期，由主进程停用
        this.nextAt.delete(key)
      } else {
        const next = computeScheduleAt(item, new Date(now))
        if (next > now) this.nextAt.set(key, next)
      }
    }
    this.arm()
  }

  /** 系统唤醒后：已到期的项按策略补发或跳过，然后重新排期 */
  private handleResume = (): void => {
    if (!this.nextAt.size) return
    const now = Date.now()
    for (const [key, at] of [...this.nextAt]) {
      if (at > now) continue
      if (this.missedPolicy === 'fire') this.onRemind(key.startsWith('r:') ? 'reminder' : 'schedule', key.slice(2))
      if (key.startsWith('r:')) {
        const ms = this.intervalsMs.get(key)
        if (ms) this.nextAt.set(key, this.jitteredInterval(ms / 60_000, new Date(now)))
      } else {
        const item = this.scheduleItems.get(key.slice(2))
        const next = item && !item.date ? computeScheduleAt(item, new Date(now)) : 0
        if (next > now) this.nextAt.set(key, next)
        else this.nextAt.delete(key)
      }
    }
    this.arm()
  }
}
