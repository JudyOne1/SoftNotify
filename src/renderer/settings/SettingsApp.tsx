import { useEffect, useRef, useState } from 'react'
import {
  AlarmClock,
  BellRing,
  Check,
  Download,
  GitFork,
  House,
  Play,
  RefreshCw,
  Settings2,
  type LucideIcon
} from 'lucide-react'
import type { Config, TrayPanelSnapshot, UpdateStatus } from '@shared/types'
import RemindersSection from './RemindersSection'
import SchedulesSection from './SchedulesSection'
import ProfilesSection from './ProfilesSection'
import FocusStatusBar from './FocusStatusBar'
import TodaySection, { type TodayView } from './TodaySection'
import { usePomodoroState } from './usePomodoroState'
import ZonePicker from './ZonePicker'
import { TimeField } from '@/components/time-picker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { playPreset, SOUND_PRESETS } from '../audio/chime'
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsGroup'

const REPO_URL = 'https://github.com/JudyOne1/SoftNotify'

type MainSection = 'today' | 'reminders' | 'settings'
type ReminderSection = 'reminders' | 'schedules' | 'profiles'
type SettingsSection = 'sound' | 'quiet' | 'danmaku' | 'app'

interface SectionDefinition {
  key: MainSection
  icon: LucideIcon
  label: string
}

const MAIN_NAV: SectionDefinition[] = [
  { key: 'today', icon: House, label: '今天' },
  { key: 'reminders', icon: BellRing, label: '提醒' },
  { key: 'settings', icon: Settings2, label: '设置' }
]

const REMINDER_TABS: Array<{ key: ReminderSection; label: string }> = [
  { key: 'reminders', label: '间隔提醒' },
  { key: 'schedules', label: '定时日程' },
  { key: 'profiles', label: '模式' }
]

const SETTINGS_TABS: Array<{ key: SettingsSection; label: string }> = [
  { key: 'sound', label: '通知与声音' },
  { key: 'quiet', label: '免打扰' },
  { key: 'danmaku', label: '弹幕与显示' },
  { key: 'app', label: '应用与数据' }
]

function Tabs<T extends string>({
  items,
  value,
  onChange,
  label
}: {
  items: Array<{ key: T; label: string }>
  value: T
  onChange: (key: T) => void
  label: string
}): React.JSX.Element {
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === value))

  function moveFocus(index: number): void {
    const next = items[(index + items.length) % items.length]
    onChange(next.key)
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-tab-group="${label}"][data-tab-key="${next.key}"]`)?.focus()
    })
  }

  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-border pb-2" aria-label={label} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          role="tab"
          aria-selected={value === item.key}
          tabIndex={value === item.key ? 0 : -1}
          data-tab-group={label}
          data-tab-key={item.key}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault()
              moveFocus(activeIndex + 1)
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault()
              moveFocus(activeIndex - 1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              moveFocus(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              moveFocus(items.length - 1)
            }
          }}
          className={cn(
            'h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors',
            value === item.key
              ? 'bg-primary/12 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

const UPDATE_TEXT: Record<UpdateStatus, string> = {
  idle: '',
  checking: '检查中…',
  downloading: '发现新版本，下载中…',
  downloaded: '已下载，退出后自动安装',
  'up-to-date': '已是最新版本',
  error: '自动更新不可用，请到 GitHub 下载',
  unsupported: '当前环境不支持自动更新'
}

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [toast, setToast] = useState('')
  const [testingReminder, setTestingReminder] = useState(false)
  const [audioNote, setAudioNote] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [active, setActive] = useState<MainSection>('today')
  const [todayView, setTodayView] = useState<TodayView>('overview')
  const [reminderSection, setReminderSection] = useState<ReminderSection>('reminders')
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('sound')
  const [displays, setDisplays] = useState<Array<{ index: number; primary: boolean; width: number; height: number }> | null>(null)
  const [statusSnapshot, setStatusSnapshot] = useState<TrayPanelSnapshot | null>(null)
  /** 生效主题（themeMode=system 时随系统切换），传给需要配色适配的分区 */
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark')
  const pomodoro = usePomodoroState()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const navigateTo = (section: string): void => {
      if (section === 'stats' || section === 'history') {
        setActive('today')
        setTodayView(section)
        return
      }
      if (section === 'focus' || section === 'today') {
        setActive('today')
        setTodayView('overview')
        return
      }
      if (section === 'reminders' || section === 'schedules' || section === 'profiles') {
        setActive('reminders')
        setReminderSection(section)
        return
      }
      if (section === 'sound' || section === 'quiet' || section === 'danmaku') {
        setActive('settings')
        setSettingsSection(section)
        return
      }
      if (section === 'about' || section === 'app' || section === 'settings') {
        setActive('settings')
        setSettingsSection(section === 'settings' ? 'sound' : 'app')
      }
    }

    void window.notifyAPI.getConfig().then(setConfig).catch(() => undefined)
    void window.notifyAPI.getAppVersion().then(setAppVersion).catch(() => undefined)
    void window.notifyAPI.getDisplays().then(setDisplays).catch(() => undefined)
    const refreshStatus = (): void => {
      void window.notifyAPI.getTrayPanelState().then(setStatusSnapshot).catch(() => undefined)
    }
    refreshStatus()
    const statusTimer = window.setInterval(refreshStatus, 3000)
    const offUpdate = window.notifyAPI.onUpdateStatus(setUpdateStatus)
    const offNavigate = window.notifyAPI.onUiNavigate(navigateTo)
    const offConfig = window.notifyAPI.onConfigChanged((next) => {
      setConfig(next)
      refreshStatus()
    })
    const query = window.location.hash.split('?')[1]
    const initialSection = query ? new URLSearchParams(query).get('section') : null
    if (initialSection) navigateTo(initialSection)
    void window.notifyAPI.getUiEnv().then((env) => {
      if (env.nativeMaterial) document.body.classList.add('native-material')
    }).catch(() => undefined)
    return () => {
      offUpdate()
      offNavigate()
      offConfig()
      clearInterval(statusTimer)
    }
  }, [])

  /** 主题应用：跟随系统（matchMedia）或手动指定 */
  const themeMode = config?.themeMode ?? 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const apply = (): void => {
      const theme = themeMode === 'system' ? (mql.matches ? 'light' : 'dark') : themeMode
      document.documentElement.dataset.theme = theme
      setEffectiveTheme(theme)
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [themeMode])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }, [active, todayView, reminderSection, settingsSection])

  async function patch(p: Partial<Config>): Promise<void> {
    const next = await window.notifyAPI.setConfig(p)
    setConfig(next)
    setToast('已保存')
    setTimeout(() => setToast(''), 1200)
  }

  async function testReminder(itemId?: string): Promise<void> {
    if (testingReminder) return
    setTestingReminder(true)
    setToast('正在发送测试提醒…')
    try {
      const result = await window.notifyAPI.testReminder(itemId)
      setToast(result.overlayDelivered ? '测试提醒已发送' : '弹幕窗口被系统拦截，已改用系统通知')
    } catch {
      setToast('测试提醒发送失败')
    } finally {
      setTestingReminder(false)
    }
    setTimeout(() => setToast(''), 2600)
  }

  function previewPresetSound(): void {
    playPreset(config?.soundPreset ?? 'classic', config?.volume ?? 0.5)
    const label = SOUND_PRESETS.find((preset) => preset.value === config?.soundPreset)?.label ?? '提示音'
    setToast(`正在试听：${label}`)
    setTimeout(() => setToast(''), 1600)
  }

  async function previewAudioFile(): Promise<void> {
    if (!config?.audioFileName) return
    setToast('正在试听自定义提示音')
    try {
      await new Audio(`media://localhost/${config.audioFileName}`).play()
    } catch {
      setToast('提示音试听失败')
    }
    setTimeout(() => setToast(''), 1800)
  }

  async function chooseAudioFile(): Promise<void> {
    const res = await window.notifyAPI.chooseAudio()
    if (!res.canceled && res.fileName) {
      setAudioNote('')
      await patch({ audioMode: 'file', audioFileName: res.fileName })
    } else if (res.reason === 'size') {
      setAudioNote('文件超过 10MB，请换一个小一点的')
    } else if (res.reason === 'ext') {
      setAudioNote('仅支持 mp3 / wav / ogg / m4a / flac')
    }
    setTimeout(() => setAudioNote(''), 2500)
  }

  async function deleteProfile(id: string): Promise<void> {
    await patch({ profiles: (config?.profiles ?? []).filter((p) => p.id !== id) })
  }

  if (!config) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">加载中…</div>
  }

  const d = config.danmaku
  const sidebarStatus = statusSnapshot?.status
  const sidebarPaused = sidebarStatus?.kind === 'paused'

  return (
    <div className="flex h-full w-full min-w-0 bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-popover focus:px-3 focus:py-2 focus:text-sm focus:shadow-[var(--neu-raised)]"
      >
        跳到主要内容
      </a>
      <nav className="flex w-40 flex-none flex-col overflow-y-auto border-r border-border bg-card/40 px-2.5 py-3">
        <div className="flex items-center gap-2 px-2.5 pb-5 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <AlarmClock className="size-4" />
          </span>
          SoftNotify
        </div>
        <div className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                aria-current={active === item.key ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent',
                  active === item.key
                    ? 'bg-primary/10 font-medium text-primary before:bg-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="mt-auto border-t border-border px-2.5 pt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', sidebarPaused ? 'bg-[var(--destructive)]' : sidebarStatus?.kind === 'running' ? 'bg-[var(--success,#34d399)]' : 'bg-primary')} />
            {sidebarStatus?.label ?? (config.paused ? '提醒已暂停' : '提醒运行中')}
          </div>
          <div className="mt-1 tabular-nums opacity-70">SoftNotify v{appVersion}</div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {pomodoro.state?.active && <FocusStatusBar state={pomodoro.state} onStop={() => void pomodoro.stop()} />}
        <main ref={mainRef} id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
          <div data-testid="settings-content" className="w-full px-6 pt-6 pb-10 lg:px-8">
            <div key={`${active}-${todayView}-${reminderSection}-${settingsSection}`} className="settings-section-enter">
          {active === 'today' && (
            <TodaySection
              config={config}
              state={pomodoro.state}
              status={statusSnapshot?.status ?? null}
              theme={effectiveTheme}
              view={todayView}
              testingReminder={testingReminder}
              onViewChange={setTodayView}
              onPatch={(next) => void patch(next)}
              onStartFocus={(minutes) => void pomodoro.start(minutes)}
              onStopFocus={() => void pomodoro.stop()}
              onManageReminders={() => {
                setActive('reminders')
                setReminderSection('reminders')
              }}
              onApplyProfile={(id) => void window.notifyAPI.applyProfile(id).then(setConfig)}
              onTestReminder={() => void testReminder()}
            />
          )}

          {active === 'reminders' && (
            <>
              <SectionTitle title="提醒" hint="管理周期提醒、固定日程和常用提醒组合" />
              <Tabs items={REMINDER_TABS} value={reminderSection} onChange={setReminderSection} label="提醒类型" />
            </>
          )}

          {active === 'reminders' && reminderSection === 'reminders' && (
            <>
              <RemindersSection
                reminders={config.reminders}
                onChange={(reminders) => void patch({ reminders })}
                onTest={(id) => void testReminder(id)}
              />
            </>
          )}

          {active === 'reminders' && reminderSection === 'schedules' && (
            <>
              <SchedulesSection
                schedules={config.schedules}
                onChange={(schedules) => void patch({ schedules })}
                onTest={(id) => void testReminder(id)}
              />
            </>
          )}

          {active === 'reminders' && reminderSection === 'profiles' && (
            <>
                <ProfilesSection
                  profiles={config.profiles}
                  activeProfile={config.activeProfile}
                  reminders={config.reminders}
                  schedules={config.schedules}
                  onApply={(id) => void window.notifyAPI.applyProfile(id).then(setConfig)}
                  onSave={(name) => void window.notifyAPI.saveProfile(name).then(setConfig)}
                  onDelete={(id) => void deleteProfile(id)}
                  onUpdateItems={(id, itemIds) => void window.notifyAPI.updateProfileItems(id, itemIds).then(setConfig)}
                />
            </>
          )}

          {active === 'settings' && (
            <>
              <SectionTitle title="设置" hint="调整通知方式、免打扰、弹幕显示和应用偏好" />
              <Tabs items={SETTINGS_TABS} value={settingsSection} onChange={setSettingsSection} label="设置分区" />
            </>
          )}

          {active === 'settings' && settingsSection === 'sound' && (
            <>
              <SettingsGroup title="提醒声音" hint="关闭后所有提醒保持静音，弹幕仍会正常显示">
                <SettingsRow label="声音提醒">
                  <Switch
                    checked={config.soundEnabled}
                    onCheckedChange={(v) => void patch({ soundEnabled: v })}
                  />
                </SettingsRow>
                <SettingsRow label="音量">
                  <div className="w-48">
                    <Slider
                      value={[config.volume]}
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={!config.soundEnabled}
                      onValueChange={([v]) => void patch({ volume: v })}
                    />
                  </div>
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup title="音源" hint="选择内置合成音色，或使用本机音频文件">
                <SettingsRow label="提示音来源">
                  <Select
                    value={config.audioMode}
                    onValueChange={(v) => void patch({ audioMode: v as Config['audioMode'] })}
                  >
                    <SelectTrigger className="min-w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="synth">合成提示音</SelectItem>
                      <SelectItem value="file">自定义音频</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow label="提示音色" hint={config.audioMode === 'file' ? '自定义音频启用时不生效' : undefined}>
                  <span className="flex items-center gap-2">
                    <Select
                      value={config.soundPreset}
                      disabled={config.audioMode === 'file'}
                      onValueChange={(v) => void patch({ soundPreset: v as Config['soundPreset'] })}
                    >
                      <SelectTrigger className="min-w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOUND_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={config.audioMode === 'file'}
                      onClick={previewPresetSound}
                    >
                      <Play />
                      试听
                    </Button>
                  </span>
                </SettingsRow>
                {config.audioMode === 'file' && (
                  <SettingsRow label="音频文件" hint={audioNote || config.audioFileName || '尚未选择文件'}>
                    <span className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void chooseAudioFile()}>
                        {config.audioFileName ? '更换' : '选择文件'}
                      </Button>
                      {config.audioFileName && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void previewAudioFile()}
                        >
                          <Play />
                          试听
                        </Button>
                      )}
                    </span>
                  </SettingsRow>
                )}
              </SettingsGroup>
              <SettingsGroup title="通知行为">
                <SettingsRow label="重要提醒系统通知" hint="标为重要的提醒同时发送 Windows 通知">
                  <Switch
                    checked={config.highPriorityNotify}
                    onCheckedChange={(v) => void patch({ highPriorityNotify: v })}
                  />
                </SettingsRow>
                <SettingsRow label="提醒测试" hint="立即触发一次提醒，检查弹幕与声音">
                  <Button variant="secondary" size="sm" disabled={testingReminder} onClick={() => void testReminder()}>
                    <BellRing />
                    {testingReminder ? '发送中…' : '测试提醒'}
                  </Button>
                </SettingsRow>
              </SettingsGroup>
            </>
          )}

          {active === 'settings' && settingsSection === 'quiet' && (
            <>
              <SettingsGroup title="安静时段">
                <SettingsRow label="启用安静时段">
                  <Switch
                    checked={config.quietEnabled}
                    onCheckedChange={(v) => void patch({ quietEnabled: v })}
                  />
                </SettingsRow>
                <SettingsRow label="时段范围">
                  <span className="flex items-center gap-2 text-sm">
                    <TimeField
                      disabled={!config.quietEnabled}
                      value={config.quietStart}
                      onChange={(v) => void patch({ quietStart: v })}
                    />
                    <span className="text-muted-foreground">至</span>
                    <TimeField
                      disabled={!config.quietEnabled}
                      value={config.quietEnd}
                      onChange={(v) => void patch({ quietEnd: v })}
                    />
                  </span>
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup title="自动静默" hint="检测到这些使用场景时暂时不打扰你">
                <SettingsRow label="会议进行中" hint="摄像头或麦克风被占用时自动静默，仅 Windows">
                  <Switch checked={config.meetingDetect} onCheckedChange={(v) => void patch({ meetingDetect: v })} />
                </SettingsRow>
                <SettingsRow label="全屏应用" hint="观看视频、演示或游戏时自动静默">
                  <Switch checked={config.fullscreenDetect} onCheckedChange={(v) => void patch({ fullscreenDetect: v })} />
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup title="唤醒策略">
                <SettingsRow label="休眠错过的提醒">
                  <Select
                    value={config.missedPolicy}
                    onValueChange={(v) => void patch({ missedPolicy: v as Config['missedPolicy'] })}
                  >
                    <SelectTrigger className="min-w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fire">唤醒后补发</SelectItem>
                      <SelectItem value="skip">直接丢弃</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </SettingsGroup>
            </>
          )}

          {active === 'settings' && settingsSection === 'danmaku' && (
            <>
              <SettingsGroup title="外观">
                <SettingsRow label="颜色主题">
                  <Select value={config.theme} onValueChange={(v) => void patch({ theme: v as Config['theme'] })}>
                    <SelectTrigger className="min-w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sky">天空（多彩）</SelectItem>
                      <SelectItem value="candy">糖果（粉紫）</SelectItem>
                      <SelectItem value="mono">素雅（灰白）</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow label="飘过速度" hint={`${config.speedSeconds.toFixed(1)} 秒穿过屏幕`}>
                  <span className="flex items-center gap-1.5">
                    {[
                      { label: '慢速', sec: 17 },
                      { label: '正常', sec: 11 },
                      { label: '快速', sec: 7 }
                    ].map((p) => (
                      <button
                        key={p.sec}
                        type="button"
                        onClick={() => void patch({ speedSeconds: p.sec })}
                        className={cn(
                          'cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors',
                          config.speedSeconds === p.sec
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </span>
                </SettingsRow>
                <SettingsRow label="速度精调">
                  <div className="flex w-56 items-center gap-3">
                    <div className="flex-1">
                      <Slider
                      value={[config.speedSeconds]}
                      min={3}
                      max={30}
                      step={0.5}
                        onValueChange={([v]) => void patch({ speedSeconds: v })}
                      />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                      {config.speedSeconds.toFixed(1)}s
                    </span>
                  </div>
                </SettingsRow>
                <SettingsRow label="不透明度">
                  <div className="w-48">
                    <Slider
                      value={[d.opacity]}
                      min={0.3}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => void patch({ danmaku: { ...d, opacity: v } })}
                    />
                  </div>
                </SettingsRow>
                <SettingsRow label="字号缩放">
                  <div className="w-48">
                    <Slider
                      value={[d.fontScale]}
                      min={0.8}
                      max={1.6}
                      step={0.05}
                      onValueChange={([v]) => void patch({ danmaku: { ...d, fontScale: v } })}
                    />
                  </div>
                </SettingsRow>
                <SettingsRow label="文字描边">
                  <Switch checked={d.stroke} onCheckedChange={(v) => void patch({ danmaku: { ...d, stroke: v } })} />
                </SettingsRow>
                <SettingsRow label="半透明胶囊" hint="开启后使用统一胶囊样式；关闭后恢复裸文字">
                  <Switch checked={d.capsule} onCheckedChange={(v) => void patch({ danmaku: { ...d, capsule: v } })} />
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup title="区域与屏幕" hint="控制弹幕出现在哪些屏幕和垂直区域">
                <SettingsRow label="输出屏幕">
                  <Select
                    value={config.displayMode}
                    onValueChange={(v) => void patch({ displayMode: v as Config['displayMode'] })}
                  >
                    <SelectTrigger className="min-w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部屏幕</SelectItem>
                      <SelectItem value="primary">仅主屏</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                {config.displayMode === 'custom' && (
                  <div className="flex flex-wrap gap-2 py-3">
                    {(displays ?? []).map((d) => {
                      const on = config.customDisplays.includes(d.index)
                      return (
                        <button
                          key={d.index}
                          type="button"
                          onClick={() =>
                            void patch({
                              customDisplays: on
                                ? config.customDisplays.filter((i) => i !== d.index)
                                : [...config.customDisplays, d.index]
                            })
                          }
                          className={cn(
                            'cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors',
                            on
                              ? 'bg-primary/15 text-primary'
                              : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                          aria-pressed={on}
                        >
                          显示器 {d.index + 1}
                          {d.primary ? ' · 主屏' : ''} {d.width}×{d.height}
                        </button>
                      )
                    })}
                    {displays && displays.length === 0 && (
                      <span className="text-xs text-muted-foreground">未检测到显示器</span>
                    )}
                    {displays && displays.length > 0 && (
                      <span className="w-full text-[11px] text-muted-foreground">
                        勾选多块屏幕时，每块屏幕各飘一条弹幕（序号按屏幕从左到右）
                      </span>
                    )}
                  </div>
                )}
                <SettingsRow label="显示区域">
                  <Select
                    value={config.danmakuZone}
                    onValueChange={(v) => void patch({ danmakuZone: v as Config['danmakuZone'] })}
                  >
                    <SelectTrigger className="min-w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">全屏</SelectItem>
                      <SelectItem value="top-half">上半屏</SelectItem>
                      <SelectItem value="top-30">顶部 30%</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                {config.danmakuZone === 'custom' && (
                  <div className="py-4">
                    <ZonePicker
                      start={config.zoneStart}
                      end={config.zoneEnd}
                      onChange={(s, e) => void patch({ zoneStart: s, zoneEnd: e })}
                    />
                  </div>
                )}
              </SettingsGroup>

              <SettingsGroup title="交互与提醒">
                <SettingsRow label="悬停操作" hint="鼠标移入时暂停飘动并显示打卡操作">
                <Switch
                  checked={config.hoverInteraction}
                  onCheckedChange={(v) => void patch({ hoverInteraction: v })}
                />
                </SettingsRow>
                <SettingsRow label="逐级升级" hint="同一提醒连续贪睡后自动加强显示">
                <Switch
                  checked={config.escalateEnabled}
                  onCheckedChange={(v) => void patch({ escalateEnabled: v })}
                />
                </SettingsRow>
                <SettingsRow label="节日祝福" hint="当天首次提醒时附加节日问候">
                <Switch
                  checked={config.festivalEnabled}
                  onCheckedChange={(v) => void patch({ festivalEnabled: v })}
                />
                </SettingsRow>
              </SettingsGroup>
            </>
          )}

          {active === 'settings' && settingsSection === 'app' && (
            <>
              <SettingsGroup title="应用">
                <SettingsRow label="开机自启">
                  <Switch checked={config.autostart} onCheckedChange={(v) => void patch({ autostart: v })} />
                </SettingsRow>
                <SettingsRow label="外观">
                  <Select
                    value={config.themeMode}
                    onValueChange={(v) => void patch({ themeMode: v as Config['themeMode'] })}
                  >
                    <SelectTrigger className="min-w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">跟随系统</SelectItem>
                      <SelectItem value="light">亮色</SelectItem>
                      <SelectItem value="dark">暗色</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup title="本机数据" hint="统计与提醒历史仅保存在当前设备">
                <SettingsRow label="使用数据" hint="查看统计、导出 JSON 或浏览最近提醒">
                  <span className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActive('today')
                        setTodayView('stats')
                      }}
                    >
                      查看统计
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActive('today')
                        setTodayView('history')
                      }}
                    >
                      查看历史
                    </Button>
                  </span>
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup title="关于">
                <SettingsRow label={`SoftNotify ${appVersion ? `v${appVersion}` : ''}`} hint={UPDATE_TEXT[updateStatus] || '开源桌面提醒软件'}>
                  <span className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => void window.notifyAPI.checkUpdate()}>
                      <RefreshCw />
                      检查更新
                    </Button>
                    <Tooltip label="打开下载页">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="打开下载页"
                        aria-label="打开下载页"
                        onClick={() => void window.notifyAPI.openExternal(`${REPO_URL}/releases/latest`)}
                      >
                        <Download />
                      </Button>
                    </Tooltip>
                    <Tooltip label="打开 GitHub 仓库">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="打开 GitHub 仓库"
                        aria-label="打开 GitHub 仓库"
                        onClick={() => void window.notifyAPI.openExternal(REPO_URL)}
                      >
                        <GitFork />
                      </Button>
                    </Tooltip>
                  </span>
                </SettingsRow>
              </SettingsGroup>
            </>
          )}
            </div>
          </div>
        </main>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="toast-enter fixed top-3.5 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-[13px] shadow-[var(--neu-raised)]">
          <Check className="size-4 text-[var(--success,#34d399)]" />
          {toast}
        </div>
      )}
    </div>
  )
}
