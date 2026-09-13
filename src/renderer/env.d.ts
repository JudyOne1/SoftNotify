/// <reference types="vite/client" />

import type { NotifyAPI } from '../bridge/api'

declare global {
  interface Window {
    notifyAPI: NotifyAPI
  }
}

export {}
