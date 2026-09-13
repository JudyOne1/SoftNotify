import { useCallback, useEffect, useState } from 'react'

export interface PomodoroState {
  active: boolean
  phase: 'focus' | 'break' | null
  remainingMs: number
  todayFocus: number
}

export function usePomodoroState(): {
  state: PomodoroState | null
  refresh: () => void
  start: (minutes: number) => Promise<void>
  stop: () => Promise<void>
} {
  const [state, setState] = useState<PomodoroState | null>(null)

  const refresh = useCallback((): void => {
    void window.notifyAPI.getPomodoroState().then(setState)
  }, [])

  useEffect(() => {
    let alive = true
    const load = (): void => {
      void window.notifyAPI.getPomodoroState().then((next) => {
        if (alive) setState(next)
      })
    }
    load()
    const timer = setInterval(load, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const start = useCallback(async (minutes: number): Promise<void> => {
    await window.notifyAPI.startFocus(minutes)
    refresh()
  }, [refresh])

  const stop = useCallback(async (): Promise<void> => {
    await window.notifyAPI.stopPomodoro()
    refresh()
  }, [refresh])

  return { state, refresh, start, stop }
}
