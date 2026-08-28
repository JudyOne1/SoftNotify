import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Config } from '@shared/types'

export const DEFAULT_CONFIG: Config = {
  intervalMinutes: 60,
  soundEnabled: true,
  volume: 0.7,
  autostart: true,
  paused: false,
  quietEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  missedPolicy: 'fire',
  theme: 'sky',
  speed: 'normal'
}

let cache: Config | null = null

function configFile(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function getConfig(): Config {
  if (!cache) {
    try {
      const stored = JSON.parse(readFileSync(configFile(), 'utf-8')) as Partial<Config>
      cache = { ...DEFAULT_CONFIG, ...stored }
    } catch {
      cache = { ...DEFAULT_CONFIG }
    }
  }
  return cache
}

export function updateConfig(patch: Partial<Config>): Config {
  const next = { ...getConfig(), ...patch }
  next.intervalMinutes = Math.min(240, Math.max(1, Math.round(next.intervalMinutes)))
  next.volume = Math.min(1, Math.max(0, next.volume))
  cache = next

  const file = configFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8')
  return next
}
