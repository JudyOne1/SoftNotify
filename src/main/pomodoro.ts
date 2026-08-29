/**
 * 番茄钟专注会话：idle → focus(N 分钟) → break(5 分钟) → idle。
 * 专注期静默其他提醒（isPomodoroSuppressing）；结束/休息通知由主进程直接广播（豁免静默）。
 * 运行态不持久化：应用重启即取消会话（重新开始即可）。
 */

type Phase = 'focus' | 'break'

let phase: Phase | null = null
let endsAt = 0
let focusMinutes = 25
let autoLoop = false
let timer: NodeJS.Timeout | null = null

export interface PomodoroCallbacks {
  onFocusEnd: (focusMinutes: number) => void
  onBreakEnd: () => void
}

let callbacks: PomodoroCallbacks | null = null

export function isPomodoroActive(): boolean {
  return phase !== null
}

/** 专注期静默其他提醒（休息期不静默） */
export function isPomodoroSuppressing(): boolean {
  return phase === 'focus'
}

export function remainingMs(): number {
  return phase ? Math.max(0, endsAt - Date.now()) : 0
}

export function currentPhase(): Phase | null {
  return phase
}

export function updatePomodoroConfig(opts: { autoLoop: boolean }): void {
  autoLoop = opts.autoLoop
}

export function startFocus(minutes: number): void {
  if (timer) clearTimeout(timer)
  phase = 'focus'
  focusMinutes = minutes
  endsAt = Date.now() + minutes * 60_000
  timer = setTimeout(onPhaseEnd, minutes * 60_000)
}

export function stopPomodoro(): void {
  if (timer) clearTimeout(timer)
  timer = null
  phase = null
  endsAt = 0
}

function onPhaseEnd(): void {
  timer = null
  if (phase === 'focus') {
    callbacks?.onFocusEnd(focusMinutes)
    phase = 'break'
    endsAt = Date.now() + 5 * 60_000
    timer = setTimeout(onPhaseEnd, 5 * 60_000)
  } else if (phase === 'break') {
    callbacks?.onBreakEnd()
    phase = null
    endsAt = 0
    if (autoLoop) startFocus(focusMinutes)
  }
}

export function initPomodoro(callbacks_: PomodoroCallbacks): void {
  callbacks = callbacks_
}
