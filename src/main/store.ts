import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { migrateLegacyProfiles } from '@shared/profile-core'
import { normalizeIntervalSeconds } from '@shared/schedule-core'
import type { Config, DanmakuStyle, Profile, ReminderItem, ScheduleItem, SoundPreset } from '@shared/types'

const SOUND_PRESET_VALUES: SoundPreset[] = ['classic', 'windchime', 'water', 'knock', 'musicbox']

export const MAX_REMINDERS = 20
export const MAX_SCHEDULES = 20
export const MAX_PROFILES = 10

export const DEFAULT_CONFIG: Config = {
  reminders: [{ id: 'water', name: '喝水', enabled: true, intervalSeconds: 3600, texts: [] }],
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
  meetingDetect: false,
  fullscreenDetect: true,
  missedPolicy: 'fire',
  theme: 'sky',
  speed: 'normal',
  danmaku: { opacity: 1, fontScale: 1, stroke: true },
  festivalEnabled: true,
  highPriorityNotify: false,
  hoverInteraction: true,
  escalateEnabled: true,
  displayMode: 'all',
  customDisplays: [],
  danmakuZone: 'full',
  zoneStart: 0,
  zoneEnd: 30,
  themeMode: 'system',
  audioMode: 'synth',
  audioFileName: '',
  soundPreset: 'classic'
}

let cache: Config | null = null
/** 是否为全新安装（无历史配置文件），用于首启引导 */
let fresh = false
/** 配置文件是否损坏过（已自愈），用于提示用户 */
let corrupted = false

function configFile(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function isFreshConfig(): boolean {
  return fresh
}

export function wasConfigCorrupted(): boolean {
  return corrupted
}

/** 校验 HH:MM，非法回退 09:00 */
function normalizeTime(value: unknown): string {
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value
  return '09:00'
}

/** 弹幕区域边界清洗：start 0-80、end 20-100，且 start ≤ end-10 */
function clampZone(value: unknown, fallback: number): number {
  const n = Math.round(Number(value))
  const v = Number.isFinite(n) ? n : fallback
  if (fallback === 0) return Math.min(80, Math.max(0, v))
  return Math.min(100, Math.max(20, v))
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
  const goalRaw = Number(raw['dailyGoal'])
  const dailyGoal = Number.isFinite(goalRaw) && goalRaw >= 1 ? Math.min(99, Math.round(goalRaw)) : undefined
  const priority = raw['priority'] === 'high' ? 'high' as const : undefined
  const preset = raw['soundPreset']
  const soundPreset = SOUND_PRESET_VALUES.includes(preset as SoundPreset) ? (preset as SoundPreset) : undefined
  const anchorRaw = Number(raw['anchorAt'])
  const anchorAt = Number.isFinite(anchorRaw) && anchorRaw > 0 ? anchorRaw : undefined
  const strict = raw['strict'] === true
  return {
    id,
    name: name || '提醒',
    enabled,
    texts,
    nightTexts: nightTexts.length ? nightTexts : undefined,
    ...(dailyGoal ? { dailyGoal } : {}),
    ...(priority ? { priority } : {}),
    ...(soundPreset ? { soundPreset } : {}),
    ...(anchorAt ? { anchorAt } : {}),
    ...(strict ? { strict } : {})
  }
}

/** 清洗间隔提醒列表 */
export function normalizeReminders(input: unknown): ReminderItem[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: ReminderItem[] = []
  for (const raw of input.slice(0, MAX_REMINDERS)) {
    if (!raw || typeof raw !== 'object') continue
    const base = normalizeItemCommon(seen, raw as Record<string, unknown>)
    items.push({
      ...base,
      intervalSeconds:
        normalizeIntervalSeconds((raw as Record<string, unknown>)['intervalSeconds'], (raw as Record<string, unknown>)['intervalMinutes']) || 3600
    })
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

/** 清洗模式：v2 引用式 itemIds；旧版快照（含 patch）自动迁移为引用集合 */
export function normalizeProfiles(input: unknown): Profile[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const items: Profile[] = []
  for (const raw of input.slice(0, MAX_PROFILES)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id = uniqueId(seen, r['id'])
    const name = typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim().slice(0, 20) : '模式'
    let itemIds: string[]
    if (r['patch'] !== undefined) {
      itemIds = migrateLegacyProfiles([r], (prefix, itemId) => `${prefix}:${itemId}`)[0]?.itemIds ?? []
    } else if (Array.isArray(r['itemIds'])) {
      itemIds = r['itemIds']
        .filter((v): v is string => typeof v === 'string' && /^(r|s):/.test(v))
        .slice(0, 40)
    } else {
      itemIds = []
    }
    items.push({ id, name, itemIds })
  }
  return items
}

/** 窗口尺寸清洗 */
function normalizeBounds(input: unknown): { width: number; height: number } | undefined {
  if (!input || typeof input !== 'object') return undefined
  const w = Math.round(Number((input as { width?: unknown }).width))
  const h = Math.round(Number((input as { height?: unknown }).height))
  if (!Number.isFinite(w) || !Number.isFinite(h)) return undefined
  return { width: Math.min(1200, Math.max(560, w)), height: Math.min(1000, Math.max(560, h)) }
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
        meetingDetect: stored.meetingDetect === true,
        fullscreenDetect: stored.fullscreenDetect !== false,
        highPriorityNotify: stored.highPriorityNotify === true,
        hoverInteraction: stored.hoverInteraction !== false,
        escalateEnabled: stored.escalateEnabled !== false,
        displayMode: ['all', 'primary', 'custom'].includes(stored.displayMode as string)
          ? (stored.displayMode as Config['displayMode'])
          : 'all',
        customDisplays: Array.isArray(stored.customDisplays)
          ? [...new Set(stored.customDisplays.filter((d): d is number => Number.isInteger(d) && d >= 0))].slice(0, 8)
          : [],
        danmakuZone: ['full', 'top-half', 'top-30', 'custom'].includes(stored.danmakuZone as string)
          ? (stored.danmakuZone as Config['danmakuZone'])
          : 'full',
        zoneStart: clampZone(stored.zoneStart, 0),
        zoneEnd: clampZone(stored.zoneEnd, 30),
        soundPreset: SOUND_PRESET_VALUES.includes(stored.soundPreset as SoundPreset)
          ? (stored.soundPreset as SoundPreset)
          : 'classic',
        themeMode: stored.themeMode === 'light' || stored.themeMode === 'dark' ? stored.themeMode : 'system',
        settingsWindow: normalizeBounds(stored.settingsWindow),
        activeProfile: typeof stored.activeProfile === 'string' ? stored.activeProfile : null
      }
    } catch (error) {
      // 坏文件改名保留现场（可人工恢复），再以默认值启动
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        try {
          renameSync(configFile(), `${configFile()}.bak-${Date.now()}`)
          corrupted = true
        } catch {
          corrupted = code !== 'ENOENT'
        }
      }
      cache = { ...DEFAULT_CONFIG }
      fresh = code === 'ENOENT'
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
  next.soundPreset = SOUND_PRESET_VALUES.includes(next.soundPreset as SoundPreset)
    ? (next.soundPreset as SoundPreset)
    : 'classic'
  next.danmaku = normalizeDanmaku(patch.danmaku !== undefined ? patch.danmaku : getConfig().danmaku)
  next.festivalEnabled = next.festivalEnabled !== false
  next.meetingDetect = next.meetingDetect === true
  next.fullscreenDetect = next.fullscreenDetect !== false
  next.highPriorityNotify = next.highPriorityNotify === true
  next.hoverInteraction = next.hoverInteraction !== false
  next.escalateEnabled = next.escalateEnabled !== false
  next.displayMode = ['all', 'primary', 'custom'].includes(next.displayMode as string)
    ? next.displayMode
    : 'all'
  next.customDisplays = Array.isArray(next.customDisplays)
    ? [...new Set(next.customDisplays.filter((d) => Number.isInteger(d) && d >= 0))].slice(0, 8)
    : []
  next.danmakuZone = ['full', 'top-half', 'top-30', 'custom'].includes(next.danmakuZone as string)
    ? next.danmakuZone
    : 'full'
  next.zoneStart = clampZone(next.zoneStart, 0)
  next.zoneEnd = clampZone(next.zoneEnd, 30)
  next.themeMode = next.themeMode === 'light' || next.themeMode === 'dark' ? next.themeMode : 'system'
  if (patch.settingsWindow !== undefined) {
    next.settingsWindow = normalizeBounds(patch.settingsWindow)
  }
  cache = next

  const file = configFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8')
  return next
}
