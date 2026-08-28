/// <reference types="vite/client" />

import type { NotifyAPI } from '../../preload/index'

declare global {
  interface Window {
    notifyAPI: NotifyAPI
  }
}

export {}
