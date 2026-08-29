import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Config, DanmakuStyle, Profile, ProfilePatch, ReminderItem, ScheduleItem } from '@shared/types'

export const MAX_REMINDERS = 20
export const MAX_SCHEDULES = 20
export const MAX_PROFILES = 10

export const DEFAULT_CONFIG: Config = {
  reminders: [{ id: 'water', name: '喝水', enabled: true, intervalMinutes: 60, texts: [] }],
  schedules: [],
  profiles: [],
  activeProfile: null,
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
  danmaku: { opacity: 1, fontScale: 1, stroke: true },
  festivalEnabled: true,
  audioMode: 'synth',
  audioFileName: ''
}

let cache: Config | null = null
/** 是否为全新安装（无历史配置文件），用于首启引导 */
let fresh = false

function configFile(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function isFreshConfig(): boolean {
  return fresh
}

function clampInterval(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 60
  return Math.min(240, Math.max(1, n))
}

/** 校验 HH:MM，非法回退 09:00 */
function normalizeTime(value: unknown): string {
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value
  return '09:00'
}

/** 校验 YYYY-MM-DD，非法返回 undefined */
function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? undefined : value
}

/** 清洗文案池：去空、去重、限长 */
function normalizeTexts(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const t of input.slice(0, max)) {
    if (typeof t === 'string' && t.trim() !== '') {
      const v = t.trim().slice(0, 100)
      if (!out.includes(v)) out.push(v)
    }
  }
  return out
}

/** 生成不重复的短 id */
function uniqueId(seen: Set<string>, raw: unknown): string {
  let id = typeof raw === 'string' && raw ? raw : ''
  while (!id || seen.has(id)) {
    id = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
  seen.add(id)
  return id
}

function normalizeItemCommon(seen: Set<string>, raw: Record<string, unknown>) {
  const id = uniqueId(seen, raw['id'])
  const name = typeof raw['name'] === 'string' ? (raw['name'] as string).trim().slice(0, 20) : ''
  const enabled = raw['enabled'] !== false
  const texts = normalizeTexts(raw['texts'], 20)
  const nightTexts = normalizeTexts(raw['nightTexts'], 10)
  return { id, name: name || '提醒', enabled, texts, nightTexts: nightTexts.length ? nightTexts : undefined }
}

/** 清洗间隔提醒列表 */
export function normalizeReminders(input: unknown): ReminderItem[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: ReminderItem[] = []
  for (const raw of input.slice(0, MAX_REMINDERS)) {
    if (!raw || typeof raw !== 'object') continue
    const base = normalizeItemCommon(seen, raw as Record<string, unknown>)
    items.push({ ...base, intervalMinutes: clampInterval((raw as Record<string, unknown>)['intervalMinutes']) })
  }
  return items
}

/** 清洗定时日程列表 */
export function normalizeSchedules(input: unknown): ScheduleItem[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: ScheduleItem[] = []
  for (const raw of input.slice(0, MAX_SCHEDULES)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const base = normalizeItemCommon(seen, r)
    const weekdays = Array.isArray(r['weekdays'])
      ? [
          ...new Set(
            (r['weekdays'] as unknown[])
              .filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
              .map((d) => d)
          )
        ]
      : []
    const date = normalizeDate(r['date'])
    items.push({
      ...base,
      time: normalizeTime(r['time']),
      weekdays,
      ...(date ? { date } : {}),
      ignoreQuiet: r['ignoreQuiet'] === true
    })
  }
  return items
}

/** 清洗弹幕外观 */
export function normalizeDanmaku(input: unknown): DanmakuStyle {
  const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  return {
    opacity: clamp(d['opacity'], 0.3, 1, 1),
    fontScale: clamp(d['fontScale'], 0.8, 1.6, 1),
    stroke: d['stroke'] !== false
  }
}

/** Profile 覆盖的字段（快照/应用都用这个范围） */
export const PROFILE_FIELDS = [
  'reminders',
  'schedules',
  'quietEnabled',
  'quietStart',
  'quietEnd',
  'theme',
  'speed',
  'danmaku'
] as const

export function normalizeProfiles(input: unknown): Profile[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: Profile[] = []
  for (const raw of input.slice(0, MAX_PROFILES)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id = uniqueId(seen, r['id'])
    const name = typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim().slice(0, 20) : '模式'
    const patchRaw = (r['patch'] && typeof r['patch'] === 'object' ? r['patch'] : {}) as Record<string, unknown>
    const patch: ProfilePatch = {}
    if (patchRaw['reminders'] !== undefined) patch.reminders = normalizeReminders(patchRaw['reminders'])
    if (patchRaw['schedules'] !== undefined) patch.schedules = normalizeSchedules(patchRaw['schedules'])
    if (patchRaw['quietEnabled'] !== undefined) patch.quietEnabled = patchRaw['quietEnabled'] === true
    if (typeof patchRaw['quietStart'] === 'string') patch.quietStart = normalizeTime(patchRaw['quietStart'])
    if (typeof patchRaw['quietEnd'] === 'string') patch.quietEnd = normalizeTime(patchRaw['quietEnd'])
    if (patchRaw['theme'] === 'sky' || patchRaw['theme'] === 'candy' || patchRaw['theme'] === 'mono') patch.theme = patchRaw['theme']
    if (patchRaw['speed'] === 'slow' || patchRaw['speed'] === 'normal' || patchRaw['speed'] === 'fast') patch.speed = patchRaw['speed']
    if (patchRaw['danmaku'] !== undefined) patch.danmaku = normalizeDanmaku(patchRaw['danmaku'])
    items.push({ id, name, patch })
  }
  return items
}

export function getConfig(): Config {
  if (!cache) {
    try {
      const stored = JSON.parse(readFileSync(configFile(), 'utf-8')) as Partial<Config>
      fresh = false
      cache = {
        ...DEFAULT_CONFIG,
        ...stored,
        reminders: normalizeReminders(stored.reminders ?? []),
        schedules: normalizeSchedules(stored.schedules ?? []),
        profiles: normalizeProfiles(stored.profiles ?? []),
        danmaku: normalizeDanmaku(stored.danmaku),
        festivalEnabled: stored.festivalEnabled !== false,
        activeProfile: typeof stored.activeProfile === 'string' ? stored.activeProfile : null
      }
    } catch (error) {
      cache = { ...DEFAULT_CONFIG }
      fresh = (error as NodeJS.ErrnoException).code === 'ENOENT'
    }
  }
  return cache
}

export function updateConfig(patch: Partial<Config>): Config {
  const next = { ...getConfig(), ...patch }
  next.reminders = normalizeReminders(patch.reminders !== undefined ? patch.reminders : getConfig().reminders)
  next.schedules = normalizeSchedules(patch.schedules !== undefined ? patch.schedules : getConfig().schedules)
  next.profiles = normalizeProfiles(patch.profiles !== undefined ? patch.profiles : getConfig().profiles)
  next.activeProfile = next.activeProfile === null ? null : String(next.activeProfile)
  next.volume = Math.min(1, Math.max(0, next.volume))
  next.audioMode = next.audioMode === 'file' ? 'file' : 'synth'
  next.audioFileName = /^[\w.-]+$/.test(next.audioFileName ?? '') ? next.audioFileName : ''
  next.danmaku = normalizeDanmaku(patch.danmaku !== undefined ? patch.danmaku : getConfig().danmaku)
  next.festivalEnabled = next.festivalEnabled !== false
  cache = next

  const file = configFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8')
  return next
}
