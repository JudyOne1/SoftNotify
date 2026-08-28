import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Config, ReminderItem } from '@shared/types'

export const MAX_REMINDERS = 20

export const DEFAULT_CONFIG: Config = {
  reminders: [{ id: 'water', name: '喝水', enabled: true, intervalMinutes: 60, texts: [] }],
  soundEnabled: true,
  volume: 0.7,
  autostart: true,
  paused: false,
  quietEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  missedPolicy: 'fire',
  theme: 'sky',
  speed: 'normal',
  audioMode: 'synth',
  audioFileName: ''
}

let cache: Config | null = null

function configFile(): string {
  return join(app.getPath('userData'), 'config.json')
}

function clampInterval(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 60
  return Math.min(240, Math.max(1, n))
}

/** 清洗提醒项：补 id、去重 id、夹紧间隔、过滤空文案，上限 MAX_REMINDERS 条 */
export function normalizeReminders(input: unknown): ReminderItem[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: ReminderItem[] = []
  for (const raw of input.slice(0, MAX_REMINDERS)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Partial<ReminderItem>
    let id = typeof r.id === 'string' && r.id ? r.id : ''
    while (!id || seen.has(id)) {
      id = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }
    seen.add(id)
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 20) : ''
    const texts = Array.isArray(r.texts)
      ? r.texts
          .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
          .map((t) => t.trim().slice(0, 100))
      : []
    items.push({
      id,
      name: name || '提醒',
      enabled: r.enabled !== false,
      intervalMinutes: clampInterval(r.intervalMinutes),
      texts
    })
  }
  return items
}

/** 旧版配置（单一 intervalMinutes）迁移为一条默认「喝水」提醒 */
function migrateLegacy(stored: Record<string, unknown>): Partial<Config> {
  if (stored['reminders'] === undefined) {
    stored['reminders'] = [
      { id: 'water', name: '喝水', enabled: true, intervalMinutes: clampInterval(stored['intervalMinutes'] ?? 60), texts: [] }
    ]
  }
  return stored as Partial<Config>
}

export function getConfig(): Config {
  if (!cache) {
    try {
      const stored = migrateLegacy(JSON.parse(readFileSync(configFile(), 'utf-8')))
      cache = { ...DEFAULT_CONFIG, ...stored, reminders: normalizeReminders(stored.reminders ?? []) }
    } catch {
      cache = { ...DEFAULT_CONFIG, reminders: normalizeReminders(DEFAULT_CONFIG.reminders) }
    }
  }
  return cache
}

export function updateConfig(patch: Partial<Config>): Config {
  const next = { ...getConfig(), ...patch }
  next.reminders = normalizeReminders(patch.reminders !== undefined ? patch.reminders : getConfig().reminders)
  next.volume = Math.min(1, Math.max(0, next.volume))
  next.audioMode = next.audioMode === 'file' ? 'file' : 'synth'
  next.audioFileName = /^[\w.-]+$/.test(next.audioFileName ?? '') ? next.audioFileName : ''
  cache = next

  const file = configFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8')
  return next
}
