import { powerMonitor } from 'electron'

export class Scheduler {
  private timer: NodeJS.Timeout | null = null
  /** 每个已启用提醒项的下一次触发时间（epoch ms） */
  private nextAt = new Map<string, number>()
  /** 每个提醒项的间隔（ms），含已停用项，便于停用后再启用时判断 */
  private intervals = new Map<string, number>()
  /** 休眠错过提醒的策略：'fire' 唤醒后补发，'skip' 丢弃 */
  missedPolicy: 'fire' | 'skip' = 'fire'

  constructor(private readonly onRemind: (itemId: string) => void) {
    powerMonitor.on('resume', this.handleResume)
  }

  /**
   * 配置变更：按 id + 间隔 差量更新。
   * 间隔未变的项保留原计时；新增、间隔变化、停用后再启用的项重新计时。
   */
  sync(reminders: Array<{ id: string; enabled: boolean; intervalMinutes: number }>): void {
    const enabled = new Map(
      reminders.filter((r) => r.enabled).map((r) => [r.id, r.intervalMinutes * 60_000])
    )
    for (const id of [...this.nextAt.keys()]) {
      if (enabled.get(id) !== this.intervals.get(id)) this.nextAt.delete(id)
    }
    const now = Date.now()
    for (const [id, ms] of enabled) {
      this.intervals.set(id, ms)
      if (!this.nextAt.has(id)) this.nextAt.set(id, now + ms)
    }
    this.arm()
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.nextAt.clear()
    this.intervals.clear()
  }

  /** 手动触发后重置某项的周期；仅对已在计时的项生效 */
  resetItem(itemId: string): void {
    const ms = this.intervals.get(itemId)
    if (ms && this.nextAt.has(itemId)) {
      this.nextAt.set(itemId, Date.now() + ms)
      this.arm()
    }
  }

  /** 距最近一次提醒的分钟数（向上取整），无已启用项时返回 0 */
  nextInMinutes(): number {
    const at = this.earliest()
    if (!at) return 0
    return Math.max(0, Math.ceil((at - Date.now()) / 60_000))
  }

  /** 最近将触发的提醒项 id，无则 null */
  nextItemId(): string | null {
    for (const [id, at] of this.nextAt) {
      if (at === this.earliest()) return id
    }
    return null
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
    this.timer = setTimeout(() => this.fire(this.nextItemId()!), Math.max(0, at - Date.now()))
  }

  private fire(itemId: string): void {
    this.timer = null
    const ms = this.intervals.get(itemId)
    if (!ms) return
    this.nextAt.set(itemId, Date.now() + ms)
    this.onRemind(itemId)
    this.arm()
  }

  /** 系统唤醒后：已到期的项按策略补发或跳过，然后从现在重新计时 */
  private handleResume = (): void => {
    if (!this.nextAt.size) return
    const now = Date.now()
    for (const [id, at] of [...this.nextAt]) {
      if (at <= now) {
        if (this.missedPolicy === 'fire') this.onRemind(id)
        this.nextAt.set(id, now + (this.intervals.get(id) ?? 0))
      }
    }
    this.arm()
  }
}
