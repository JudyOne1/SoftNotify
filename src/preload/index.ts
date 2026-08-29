import { contextBridge, ipcRenderer } from 'electron'
import type { AudioChoiceResult, Config, ReminderPayload, StatsSummary, UpdateStatus } from '@shared/types'

const api = {
  getConfig: (): Promise<Config> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
  testReminder: (itemId?: string): Promise<void> => ipcRenderer.invoke('notify:test', itemId),
  chooseAudio: (): Promise<AudioChoiceResult> => ipcRenderer.invoke('audio:choose'),
  applyProfile: (id: string): Promise<Config> => ipcRenderer.invoke('profile:apply', id),
  saveProfile: (name: string): Promise<Config> => ipcRenderer.invoke('profile:save', name),
  updateProfileItems: (id: string, itemIds: string[]): Promise<Config> =>
    ipcRenderer.invoke('profile:update-items', id, itemIds),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open:external', url),
  checkUpdate: (): Promise<{ status: UpdateStatus; version?: string }> => ipcRenderer.invoke('update:check'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },
  onUiNavigate: (callback: (section: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, section: string): void => callback(section)
    ipcRenderer.on('ui:navigate', handler)
    return () => ipcRenderer.removeListener('ui:navigate', handler)
  },
  getHistory: (): Promise<Array<{ text: string; name?: string; at: number }>> => ipcRenderer.invoke('history:get'),
  getUiEnv: (): Promise<{ nativeMaterial: boolean }> => ipcRenderer.invoke('ui:env'),
  getDisplays: (): Promise<Array<{ index: number; primary: boolean; width: number; height: number }>> =>
    ipcRenderer.invoke('displays:list'),
  setOverlayUiRects: (rects: Array<{ x: number; y: number; w: number; h: number }>): void =>
    ipcRenderer.send('overlay:set-ui-rects', rects),
  checkin: (itemId: string): Promise<void> => ipcRenderer.invoke('checkin', itemId),
  getStats: (): Promise<StatsSummary> => ipcRenderer.invoke('stats:get'),
  exportStats: (): Promise<{ canceled: boolean }> => ipcRenderer.invoke('stats:export'),
  onReminder: (callback: (payload: ReminderPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ReminderPayload): void => callback(payload)
    ipcRenderer.on('notify:reminder', handler)
    return () => ipcRenderer.removeListener('notify:reminder', handler)
  },
  onConfigChanged: (callback: (config: Config) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: Config): void => callback(config)
    ipcRenderer.on('config:changed', handler)
    return () => ipcRenderer.removeListener('config:changed', handler)
  }
}

contextBridge.exposeInMainWorld('notifyAPI', api)

export type NotifyAPI = typeof api
