import { contextBridge, ipcRenderer } from 'electron'
import type { Config, ReminderPayload } from '@shared/types'

const api = {
  getConfig: (): Promise<Config> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
  testReminder: (): Promise<void> => ipcRenderer.invoke('notify:test'),
  onReminder: (callback: (payload: ReminderPayload) => void): void => {
    ipcRenderer.on('notify:reminder', (_event, payload: ReminderPayload) => callback(payload))
  }
}

contextBridge.exposeInMainWorld('notifyAPI', api)

export type NotifyAPI = typeof api
