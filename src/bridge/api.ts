import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { AudioChoiceResult, Config, ReminderPayload, StatsSummary, TrayPanelSnapshot, UpdateStatus } from '@shared/types'

/**
 * 窗口级监听：只收发给本窗口（或全体）的事件。
 * 注意不能用 @tauri-apps/api/event 的 app 级 listen——它连 `emit_to` 发给别的窗口的事件也会收到，
 * 曾导致弹幕双窗重复渲染、多屏定向失效。
 */
function listenEvent<T>(event: string, callback: (payload: T) => void, onReady?: () => void): () => void {
  let unlisten: (() => void) | undefined
  let disposed = false
  getCurrentWindow()
    .listen<T>(event, (e) => callback(e.payload))
    .then((u) => {
      if (disposed) u()
      else {
        unlisten = u
        onReady?.()
      }
    })
  return () => {
    disposed = true
    unlisten?.()
  }
}

export const api = {
  getConfig: (): Promise<Config> => invoke('config_get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => invoke('config_set', { patch }),
  testReminder: (itemId?: string): Promise<{ overlayDelivered: boolean }> => invoke('notify_test', { itemId }),
  nextFireFor: (itemId: string): Promise<number | null> => invoke('remind_next', { itemId }),
  chooseAudio: (): Promise<AudioChoiceResult> => invoke('audio_choose'),
  applyProfile: (id: string): Promise<Config> => invoke('profile_apply', { id }),
  saveProfile: (name: string): Promise<Config> => invoke('profile_save', { name }),
  updateProfileItems: (id: string, itemIds: string[]): Promise<Config> =>
    invoke('profile_update_items', { id, itemIds }),
  getAppVersion: (): Promise<string> => invoke('app_version'),
  openExternal: (url: string): Promise<void> => invoke('open_external', { url }),
  checkUpdate: (): Promise<{ status: UpdateStatus; version?: string }> => invoke('update_check'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) =>
    listenEvent<UpdateStatus>('update:status', callback),
  onUiNavigate: (callback: (section: string) => void): (() => void) =>
    listenEvent<string>('ui:navigate', callback),
  getHistory: (): Promise<Array<{ text: string; name?: string; at: number; result?: 'overlay' | 'system' | 'overlay+system' | 'direct' }>> => invoke('history_get'),
  getUiEnv: (): Promise<{ nativeMaterial: boolean }> => invoke('ui_env'),
  startFocus: (minutes: number): Promise<void> => invoke('pomodoro_start', { minutes }),
  stopPomodoro: (): Promise<void> => invoke('pomodoro_stop'),
  getPomodoroState: (): Promise<{ active: boolean; phase: 'focus' | 'break' | null; remainingMs: number; todayFocus: number }> =>
    invoke('pomodoro_state'),
  getDisplays: (): Promise<Array<{ index: number; primary: boolean; width: number; height: number }>> =>
    invoke('displays_list'),
  setOverlayUiRects: (rects: Array<{ x: number; y: number; w: number; h: number }>): void => {
    void emit('overlay:set-ui-rects', { rects, label: getCurrentWindow().label })
  },
  overlayReady: (): void => {
    void emit('overlay:ready', getCurrentWindow().label)
  },
  checkin: (itemId: string): Promise<void> => invoke('checkin', { itemId }),
  snoozeReminder: (itemId: string): Promise<void> => invoke('snooze', { itemId }),
  getStats: (): Promise<StatsSummary> => invoke('stats_get'),
  getTrayPanelState: (): Promise<TrayPanelSnapshot> => invoke('tray_panel_state'),
  openMain: (section = 'today'): Promise<void> => invoke('open_main_window', { section }),
  onTrayRefresh: (callback: () => void): (() => void) => listenEvent<null>('tray:refresh', callback),
  exportStats: (): Promise<{ canceled: boolean }> => invoke('stats_export'),
  onReminder: (callback: (payload: ReminderPayload) => void, onReady?: () => void): (() => void) =>
    listenEvent<ReminderPayload>(
      'notify:reminder',
      (p) => callback({ ...p, audioUrl: p.audioUrl ? convertFileSrc(p.audioUrl) : undefined }),
      onReady
    ),
  onConfigChanged: (callback: (config: Config) => void): (() => void) =>
    listenEvent<Config>('config:changed', callback)
}

export type NotifyAPI = typeof api
