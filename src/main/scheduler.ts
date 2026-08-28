import { powerMonitor } from 'electron'

export class Scheduler {
  private timer: NodeJS.Timeout | null = null
  private nextAt = 0
  private intervalMs = 0

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

  fireNow(): void {
    this.onRemind()
    if (this.intervalMs > 0) this.scheduleNext(this.intervalMs)
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

  /** 系统唤醒后：错过的提醒立即补发，然后重置周期 */
  private handleResume = (): void => {
    if (!this.intervalMs) return
    if (this.nextAt && Date.now() >= this.nextAt) {
      this.onRemind()
    }
    this.scheduleNext(this.intervalMs)
  }
}
