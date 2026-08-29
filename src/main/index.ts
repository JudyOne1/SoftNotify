import { app, BrowserWindow, dialog, ipcMain, Notification, screen, shell } from 'electron'
import type { Config, Profile, ProfilePatch, ReminderItem, ScheduleItem } from '@shared/types'
import { pickText } from '@shared/templates'
import { inQuietHours } from '@shared/quiet'
import { PROFILE_FIELDS, getConfig, isFreshConfig, updateConfig, wasConfigCorrupted } from './store'
import { Scheduler } from './scheduler'
import { createOverlays, registerDisplayEvents, sendReminder, setOverlayUiRects, sortedDisplays, startHoverPolling } from './overlay'
import { openSettings, openSettingsTo, usesNativeMaterial } from './settings-window'
import { createTray, refreshTray, type TrayHandlers } from './tray'
import { applyAutostart } from './autostart'
import { handleMediaProtocol, registerAudioIpc, registerMediaScheme } from './audio'
import { initAutoUpdater, registerUpdateIpc } from './updater'
import { isManualMeeting, isMeeting, setManualMeeting, startMeetingPolling } from './meeting'
import { festivalGreeting } from './festivals'
import { addHistory, getHistory } from './history'
import { addCheckin, getStats, startUsageTracking, todayCountFor } from './stats'
import { writeFile } from 'node:fs/promises'

let scheduler: Scheduler
/** 节日祝福只附加在当天第一条弹幕上 */
let festivalShownOn = ''

function todayStr(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

/** 自定义音频的播放地址：file 模式且已选择文件时有效 */
function audioUrl(): string | undefined {
  const cfg = getConfig()
  return cfg.audioMode === 'file' && cfg.audioFileName ? `media://localhost/${cfg.audioFileName}` : undefined
}

interface ItemEntry {
  item: ReminderItem | ScheduleItem
  ignoreQuiet: boolean
}

/** 在两类计划中找提醒项；未指定或已删除时回退到第一个已启用项 */
function findItem(itemId: string | undefined): ItemEntry | null {
  const cfg = getConfig()
  if (itemId) {
    const r = cfg.reminders.find((x) => x.id === itemId)
    if (r) return { item: r, ignoreQuiet: false }
    const s = cfg.schedules.find((x) => x.id === itemId)
    if (s) return { item: s, ignoreQuiet: s.ignoreQuiet }
  }
  const r = cfg.reminders.find((x) => x.enabled)
  if (r) return { item: r, ignoreQuiet: false }
  const s = cfg.schedules.find((x) => x.enabled)
  if (s) return { item: s, ignoreQuiet: s.ignoreQuiet }
  return null
}

/** manual=true 时绕过安静时段（手动"立即提醒"/测试）；会议模式优先级最高，任何提醒都静默 */
function remind(entry: ItemEntry | null, manual = false): void {
  const cfg = getConfig()
  const meeting = isMeeting()
  const inQuiet =
    !manual && (meeting || (!entry?.ignoreQuiet && inQuietHours(cfg.quietEnabled, cfg.quietStart, cfg.quietEnd)))
  if (!inQuiet) {
    let text = pickText(entry?.item ?? null)
    if (cfg.festivalEnabled && festivalShownOn !== todayStr()) {
      const greeting = festivalGreeting()
      if (greeting) {
        text = `${greeting}！${text}`
        festivalShownOn = todayStr()
      }
    }
    const high = entry?.item.priority === 'high'
    const preset = entry?.item.soundPreset ?? cfg.soundPreset
    sendReminder(text, cfg.soundEnabled, cfg.volume, audioUrl(), entry?.item.id, high ? 'high' : undefined, preset)
    addHistory({ text, name: entry?.item.name, at: Date.now() })
    if (high && cfg.highPriorityNotify && Notification.isSupported()) {
      new Notification({
        title: entry?.item.name ? `Notify · ${entry.item.name}` : 'Notify',
        body: text,
        silent: cfg.soundEnabled
      }).show()
    }
  }
  refreshTray(handlers, scheduler)
}

function broadcastConfig(cfg: Config): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('config:changed', cfg)
  }
}

/** 统一收尾：按暂停状态对账调度器、广播、刷托盘 */
function applyConfig(next: Config): void {
  if (next.paused) {
    scheduler.stop()
  } else {
    scheduler.sync(next.reminders, next.schedules)
  }
  broadcastConfig(next)
  refreshTray(handlers, scheduler)
}

/** 一次性日程过期后自动停用（含应用关闭期间错过的） */
function expireOnceSchedules(): Config {
  const cfg = getConfig()
  const now = Date.now()
  const expired = (s: ScheduleItem): boolean =>
    s.enabled && !!s.date && new Date(`${s.date}T${s.time}:00`).getTime() <= now
  if (!cfg.schedules.some(expired)) return cfg
  return updateConfig({ schedules: cfg.schedules.map((s) => (expired(s) ? { ...s, enabled: false } : s)) })
}

/** 保存当前设置为新的 Profile（快照覆盖字段全集，保证应用结果可预期） */
function saveProfile(name: string): Config {
  const cfg = getConfig()
  const patch: ProfilePatch = {}
  const source = cfg as unknown as Record<string, unknown>
  const target = patch as Record<string, unknown>
  for (const field of PROFILE_FIELDS) {
    target[field] = source[field]
  }
  const profile: Profile = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 20) || '新模式',
    patch
  }
  const next = updateConfig({ profiles: [...cfg.profiles, profile], activeProfile: profile.id })
  applyConfig(next)
  return next
}

function applyProfile(id: string): Config {
  const cfg = getConfig()
  const profile = cfg.profiles.find((p) => p.id === id)
  if (!profile) return cfg
  const next = updateConfig({ ...profile.patch, activeProfile: profile.id })
  applyConfig(next)
  return next
}

const handlers: TrayHandlers = {
  onRemindNow: (itemId: string) => {
    const entry = findItem(itemId)
    remind(entry, true)
    const cfg = getConfig()
    if (!cfg.paused && entry && 'intervalMinutes' in entry.item && entry.item.enabled) {
      scheduler.resetItem(entry.item.id)
    }
  },
  /** 托盘补打卡：记一笔并用弹幕确认（带今日进度） */
  onCheckinNow: (itemId: string) => {
    const entry = findItem(itemId)
    if (!entry) return
    addCheckin(entry.item.id)
    const goal = entry.item.dailyGoal
    const done = todayCountFor(entry.item.id)
    const progress = goal ? `（今日 ${done}/${goal}）` : `（今日 ${done} 次）`
    sendReminder(`已补打卡：${entry.item.name}${progress}`, false, 0, undefined)
    addHistory({ text: `补打卡 ${entry.item.name}${progress}`, name: entry.item.name, at: Date.now() })
    refreshTray(handlers, scheduler)
  },
  onApplyProfile: (id: string) => {
    applyProfile(id)
  },
  onTogglePause: () => {
    const next = updateConfig({ paused: !getConfig().paused })
    applyConfig(next)
  },
  /** 托盘会议模式开关（仅手动；自动检测独立运行） */
  onToggleMeeting: () => {
    setManualMeeting(!isManualMeeting())
    refreshTray(handlers, scheduler)
  },
  onOpenSettings: () => openSettings(),
  onOpenHistory: () => openSettingsTo('history'),
  onOpenStats: () => openSettingsTo('stats')
}

// 自定义媒体协议必须在 app ready 前注册
registerMediaScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openSettings())

  void app.whenReady().then(() => {
    const fresh = isFreshConfig()
    applyAutostart(getConfig().autostart)
    const cfg = expireOnceSchedules()

    scheduler = new Scheduler((source, itemId) => {
      remind(findItem(itemId), false)
      if (source === 'schedule') {
        // 一次性日程触发后自动停用
        const s = getConfig().schedules.find((x) => x.id === itemId)
        if (s?.date && s.enabled) {
          const next = updateConfig({
            schedules: getConfig().schedules.map((x) => (x.id === itemId ? { ...x, enabled: false } : x))
          })
          broadcastConfig(next)
          refreshTray(handlers, scheduler)
        }
      }
    })
    if (!cfg.paused) scheduler.sync(cfg.reminders, cfg.schedules)

    createOverlays()
    registerDisplayEvents()
    startHoverPolling()
    createTray(handlers, scheduler)
    handleMediaProtocol()
    registerAudioIpc()
    startUsageTracking()
    // 会议模式自动检测：状态变化只影响提醒静默与托盘展示
    startMeetingPolling(() => refreshTray(handlers, scheduler))

    if (process.argv.includes('--remind-now')) {
      setTimeout(() => remind(findItem(undefined), true), 1500)
    }
    if (wasConfigCorrupted()) {
      setTimeout(() => sendReminder('配置文件损坏，已自动重置（旧文件保留为 .bak）', false, 0, undefined), 2500)
    }
    if (process.argv.includes('--open-settings')) {
      setTimeout(openSettings, 500)
    }

    ipcMain.handle('config:get', () => getConfig())
    ipcMain.handle('config:set', (_event, patch: Partial<Config>) => {
      const next = updateConfig(patch)
      if (patch.autostart !== undefined) applyAutostart(next.autostart)
      scheduler.missedPolicy = next.missedPolicy
      if (patch.reminders !== undefined || patch.schedules !== undefined || patch.paused !== undefined) {
        applyConfig(next)
      } else {
        broadcastConfig(next)
        refreshTray(handlers, scheduler)
      }
      return next
    })
    ipcMain.handle('notify:test', (_event, itemId?: string) => {
      remind(findItem(itemId), true)
    })
    ipcMain.handle('profile:apply', (_event, id: string) => applyProfile(String(id)))
    ipcMain.handle('profile:save', (_event, name: string) => saveProfile(String(name)))
    ipcMain.handle('app:version', () => app.getVersion())
    ipcMain.handle('history:get', () => getHistory())
    ipcMain.handle('ui:env', () => ({ nativeMaterial: usesNativeMaterial() }))
    ipcMain.handle('displays:list', () => {
      const primary = screen.getPrimaryDisplay().id
      return sortedDisplays().map((d, index) => ({
        index,
        primary: d.id === primary,
        width: d.size.width,
        height: d.size.height
      }))
    })
    ipcMain.on('overlay:set-ui-rects', (event, rects: Array<{ x: number; y: number; w: number; h: number }>) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && Array.isArray(rects)) setOverlayUiRects(win, rects)
    })
    ipcMain.handle('checkin', (_event, itemId: string) => {
      addCheckin(String(itemId))
      refreshTray(handlers, scheduler)
    })
    ipcMain.handle('stats:get', () => getStats())
    ipcMain.handle('stats:export', async () => {
      const result = await dialog.showSaveDialog({
        title: '导出统计数据',
        defaultPath: `notify-stats-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, JSON.stringify(getStats(), null, 2), 'utf-8')
      return { canceled: false }
    })
    ipcMain.handle('open:external', (_event, url: string) => {
      // 只允许打开 GitHub 相关链接，防任意跳转
      if (/^https:\/\/(www\.)?github\.com\/JudyOne1\/SoftNotify/.test(url)) void shell.openExternal(url)
    })
    registerUpdateIpc()
    initAutoUpdater()

    // 首次安装：打开引导页
    if (fresh && !process.argv.includes('--no-welcome')) {
      setTimeout(() => openSettings('/welcome'), 800)
    }
  })
}

app.on('window-all-closed', () => {
  // 托盘常驻应用：关掉设置窗口不退出
})
