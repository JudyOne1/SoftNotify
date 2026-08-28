import { powerMonitor } from 'electron'

export class Scheduler {
  private timer: NodeJS.Timeout | null = null
  private nextAt = 0
  private intervalMs = 0
  /** 休眠错过提醒的策略：'fire' 唤醒后补发，'skip' 丢弃 */
  missedPolicy: 'fire' | 'skip' = 'fire'

  constructor(private readonly onRemind: () => void) {}

  start(intervalMinutes: number): void {
    this.intervalMs = intervalMinutes * 60_000
    this.scheduleNext(this.intervalMs)
    powerMonitor.on('resume', this.handleResume)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.nextAt = 0
    powerMonitor.removeListener('resume', this.handleResume)
  }

  nextInMinutes(): number {
    if (!this.nextAt) return 0
    return Math.max(0, Math.ceil((this.nextAt - Date.now()) / 60_000))
  }

  private scheduleNext(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.nextAt = Date.now() + delayMs
    this.timer = setTimeout(() => {
      this.timer = null
      this.onRemind()
      this.scheduleNext(this.intervalMs)
    }, delayMs)
  }

  /** 系统唤醒后：按策略补发或丢弃错过的提醒，然后重置周期 */
  private handleResume = (): void => {
    if (!this.intervalMs) return
    if (this.missedPolicy === 'fire' && this.nextAt && Date.now() >= this.nextAt) {
      this.onRemind()
    }
    this.scheduleNext(this.intervalMs)
  }
}
