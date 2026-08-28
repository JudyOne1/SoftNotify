import { contextBridge, ipcRenderer } from 'electron'
import type { Config, ReminderPayload } from '@shared/types'

const api = {
  getConfig: (): Promise<Config> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
  testReminder: (itemId?: string): Promise<void> => ipcRenderer.invoke('notify:test', itemId),
  onReminder: (callback: (payload: ReminderPayload) => void): void => {
    ipcRenderer.on('notify:reminder', (_event, payload: ReminderPayload) => callback(payload))
  },
  onConfigChanged: (callback: (config: Config) => void): void => {
    ipcRenderer.on('config:changed', (_event, config: Config) => callback(config))
  }
}

contextBridge.exposeInMainWorld('notifyAPI', api)

export type NotifyAPI = typeof api
