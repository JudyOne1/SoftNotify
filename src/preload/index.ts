import { contextBridge, ipcRenderer } from 'electron'
import type { AudioChoiceResult, Config, ReminderPayload, StatsSummary, UpdateStatus } from '@shared/types'

const api = {
  getConfig: (): Promise<Config> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
  testReminder: (itemId?: string): Promise<void> => ipcRenderer.invoke('notify:test', itemId),
  chooseAudio: (): Promise<AudioChoiceResult> => ipcRenderer.invoke('audio:choose'),
  applyProfile: (id: string): Promise<Config> => ipcRenderer.invoke('profile:apply', id),
  saveProfile: (name: string): Promise<Config> => ipcRenderer.invoke('profile:save', name),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open:external', url),
  checkUpdate: (): Promise<{ status: UpdateStatus; version?: string }> => ipcRenderer.invoke('update:check'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): void => {
    ipcRenderer.on('update:status', (_event, status: UpdateStatus) => callback(status))
  },
  getHistory: (): Promise<Array<{ text: string; name?: string; at: number }>> => ipcRenderer.invoke('history:get'),
  getUiEnv: (): Promise<{ nativeMaterial: boolean }> => ipcRenderer.invoke('ui:env'),
  setOverlayIgnore: (ignore: boolean): void => ipcRenderer.send('overlay:set-ignore', ignore),
  checkin: (itemId: string): Promise<void> => ipcRenderer.invoke('checkin', itemId),
  getStats: (): Promise<StatsSummary> => ipcRenderer.invoke('stats:get'),
  exportStats: (): Promise<{ canceled: boolean }> => ipcRenderer.invoke('stats:export'),
  onReminder: (callback: (payload: ReminderPayload) => void): void => {
    ipcRenderer.on('notify:reminder', (_event, payload: ReminderPayload) => callback(payload))
  },
  onConfigChanged: (callback: (config: Config) => void): void => {
    ipcRenderer.on('config:changed', (_event, config: Config) => callback(config))
  }
}

contextBridge.exposeInMainWorld('notifyAPI', api)

export type NotifyAPI = typeof api
