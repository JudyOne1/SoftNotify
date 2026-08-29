import { useEffect, useState } from 'react'
import type { Config, SoundPreset, UpdateStatus } from '@shared/types'
import RemindersSection from './RemindersSection'
import SchedulesSection from './SchedulesSection'
import ProfilesSection from './ProfilesSection'
import StatsSection from './StatsSection'
import HistorySection from './HistorySection'
import ZonePicker from './ZonePicker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { playPreset } from '../audio/chime'

const SOUND_PRESETS: Array<{ value: SoundPreset; label: string }> = [
  { value: 'classic', label: '经典双音' },
  { value: 'windchime', label: '风铃' },
  { value: 'water', label: '水滴' },
  { value: 'knock', label: '木鱼' },
  { value: 'musicbox', label: '八音盒' }
]

const REPO_URL = 'https://github.com/JudyOne1/SoftNotify'

const SECTIONS = [
  { key: 'reminders', icon: '⏰', label: '间隔提醒' },
  { key: 'schedules', icon: '📅', label: '定时日程' },
  { key: 'profiles', icon: '🎛️', label: '模式' },
  { key: 'sound', icon: '🔔', label: '声音' },
  { key: 'quiet', icon: '🌙', label: '免打扰' },
  { key: 'danmaku', icon: '💬', label: '弹幕' },
  { key: 'stats', icon: '📊', label: '统计' },
  { key: 'history', icon: '🕘', label: '历史' },
  { key: 'about', icon: '⭐', label: '关于' }
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

const UPDATE_TEXT: Record<UpdateStatus, string> = {
  idle: '',
  checking: '检查中…',
  downloading: '发现新版本，下载中…',
  downloaded: '已下载，退出后自动安装',
  'up-to-date': '已是最新版本',
  error: '自动更新不可用，请到 GitHub 下载',
  unsupported: '当前环境不支持自动更新'
}

/** 设置行：左标签右控件 */
function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3 text-sm last:border-0">
      <span>{label}</span>
      {children}
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="mb-4">
      <h1 className="text-lg font-bold">{title}</h1>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [toast, setToast] = useState('')
  const [audioNote, setAudioNote] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [active, setActive] = useState<SectionKey>('reminders')
  const [displays, setDisplays] = useState<Array<{ index: number; primary: boolean; width: number; height: number }> | null>(null)
  /** 生效主题（themeMode=system 时随系统切换），传给需要配色适配的分区 */
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    void window.notifyAPI.getConfig().then(setConfig)
    void window.notifyAPI.getAppVersion().then(setAppVersion)
    void window.notifyAPI.getDisplays().then(setDisplays)
    const offUpdate = window.notifyAPI.onUpdateStatus(setUpdateStatus)
    const offNavigate = window.notifyAPI.onUiNavigate((section) => {
      if (SECTIONS.some((s) => s.key === section)) setActive(section as SectionKey)
    })
    void window.notifyAPI.getUiEnv().then((env) => {
      if (env.nativeMaterial) document.body.classList.add('native-material')
    })
    return () => {
      offUpdate()
      offNavigate()
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

  async function patch(p: Partial<Config>): Promise<void> {
    const next = await window.notifyAPI.setConfig(p)
    setConfig(next)
    setToast('已保存')
    setTimeout(() => setToast(''), 1200)
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

  return (
    <div className="flex h-screen bg-background text-foreground">
      <nav className="flex w-36 flex-none flex-col gap-0.5 border-r border-border/60 bg-background p-2.5 pt-3.5">
        <div className="px-2.5 pb-3 text-sm font-bold">Notify</div>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
              active === s.key
                ? 'font-semibold text-primary shadow-[var(--neu-inset-sm)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </button>
        ))}
        <div className="mt-auto px-2.5 pt-2 text-[11px] text-muted-foreground">v{appVersion}</div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[560px] px-7 pt-6 pb-10">
          {active === 'reminders' && (
            <>
              <SectionTitle title="间隔提醒" hint="每隔一段时间提醒一次" />
              <RemindersSection
                reminders={config.reminders}
                onChange={(reminders) => void patch({ reminders })}
                onTest={(id) => void window.notifyAPI.testReminder(id)}
              />
            </>
          )}

          {active === 'schedules' && (
            <>
              <SectionTitle title="定时日程" hint="每天/每周几的固定钟点触发，也可设单次倒计时" />
              <SchedulesSection
                schedules={config.schedules}
                onChange={(schedules) => void patch({ schedules })}
                onTest={(id) => void window.notifyAPI.testReminder(id)}
              />
            </>
          )}

          {active === 'profiles' && (
            <>
              <SectionTitle title="模式" hint="把当前配置存成模式，之后在托盘一键切换" />
                <ProfilesSection
                  profiles={config.profiles}
                  activeProfile={config.activeProfile}
                  reminders={config.reminders}
                  schedules={config.schedules}
                  onApply={(id) => void window.notifyAPI.applyProfile(id)}
                  onSave={(name) => void window.notifyAPI.saveProfile(name)}
                  onDelete={(id) => void deleteProfile(id)}
                  onUpdateItems={(id, itemIds) => void window.notifyAPI.updateProfileItems(id, itemIds)}
                />
            </>
          )}

          {active === 'sound' && (
            <>
              <SectionTitle title="声音" />
              <Row label="声音提醒">
                <Switch
                  checked={config.soundEnabled}
                  onCheckedChange={(v) => void patch({ soundEnabled: v })}
                />
              </Row>
              <Row label="音量">
                <div className="w-44">
                  <Slider
                    value={[config.volume]}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={!config.soundEnabled}
                    onValueChange={([v]) => void patch({ volume: v })}
                  />
                </div>
              </Row>
              <Row label="提示音来源">
                <Select
                  value={config.audioMode}
                  onValueChange={(v) => void patch({ audioMode: v as Config['audioMode'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="synth">合成提示音</SelectItem>
                    <SelectItem value="file">自定义音频</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="提示音色">
                <span className="flex items-center gap-2">
                  <Select
                    value={config.soundPreset}
                    disabled={config.audioMode === 'file'}
                    onValueChange={(v) => void patch({ soundPreset: v as Config['soundPreset'] })}
                  >
                    <SelectTrigger>
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
                    onClick={() => playPreset(config.soundPreset, config.volume)}
                  >
                    试听
                  </Button>
                </span>
              </Row>
              {config.audioMode === 'file' && (
                <div className="pb-2 text-xs text-muted-foreground">当前使用自定义音频文件，音色选择不生效</div>
              )}
              {config.audioMode === 'file' && (
                <div className="flex items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={config.audioFileName}>
                    {config.audioFileName || '未选择文件'}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => void chooseAudioFile()}>
                    {config.audioFileName ? '更换' : '选择文件'}
                  </Button>
                  {config.audioFileName && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void new Audio(`media://localhost/${config.audioFileName}`).play()}
                    >
                      试听
                    </Button>
                  )}
                </div>
              )}
              {audioNote && <div className="pt-2 text-[13px] text-destructive">{audioNote}</div>}
            </>
          )}

          {active === 'quiet' && (
            <>
              <SectionTitle title="免打扰" />
              <Row label="安静时段">
                <Switch
                  checked={config.quietEnabled}
                  onCheckedChange={(v) => void patch({ quietEnabled: v })}
                />
              </Row>
              <Row label="时段范围">
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    className="rounded-md bg-transparent px-2 py-1 shadow-[var(--neu-inset-sm)] disabled:opacity-50"
                    disabled={!config.quietEnabled}
                    value={config.quietStart}
                    onChange={(e) => void patch({ quietStart: e.target.value })}
                  />
                  <span className="text-muted-foreground">至</span>
                  <input
                    type="time"
                    className="rounded-md bg-transparent px-2 py-1 shadow-[var(--neu-inset-sm)] disabled:opacity-50"
                    disabled={!config.quietEnabled}
                    value={config.quietEnd}
                    onChange={(e) => void patch({ quietEnd: e.target.value })}
                  />
                </span>
              </Row>
              <Row label="摄像头/麦克风占用时自动免打扰">
                <Switch
                  title="检测到摄像头或麦克风使用（如开会）时自动静默提醒，仅 Windows"
                  checked={config.meetingDetect}
                  onCheckedChange={(v) => void patch({ meetingDetect: v })}
                />
              </Row>
              <Row label="全屏应用时自动免打扰">
                <Switch
                  title="前台应用铺满屏幕（观影/游戏）时自动静默提醒"
                  checked={config.fullscreenDetect}
                  onCheckedChange={(v) => void patch({ fullscreenDetect: v })}
                />
              </Row>
              <Row label="休眠错过的提醒">
                <Select
                  value={config.missedPolicy}
                  onValueChange={(v) => void patch({ missedPolicy: v as Config['missedPolicy'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fire">唤醒后补发</SelectItem>
                    <SelectItem value="skip">直接丢弃</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </>
          )}

            {active === 'danmaku' && (
              <>
                <SectionTitle title="弹幕" />
                <Row label="颜色主题">
                  <Select value={config.theme} onValueChange={(v) => void patch({ theme: v as Config['theme'] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sky">天空（多彩）</SelectItem>
                      <SelectItem value="candy">糖果（粉紫）</SelectItem>
                      <SelectItem value="mono">素雅（灰白）</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="飘过速度">
                  <Select value={config.speed} onValueChange={(v) => void patch({ speed: v as Config['speed'] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">慢速</SelectItem>
                      <SelectItem value="normal">正常</SelectItem>
                      <SelectItem value="fast">快速</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="输出屏幕">
                  <Select
                    value={config.displayMode}
                    onValueChange={(v) => void patch({ displayMode: v as Config['displayMode'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部屏幕</SelectItem>
                      <SelectItem value="primary">仅主屏</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                {config.displayMode === 'custom' && (
                  <div className="flex flex-wrap gap-2 border-b border-border/50 pb-3">
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
                            'cursor-pointer rounded-md px-3 py-1.5 text-xs transition-all',
                            on
                              ? 'bg-primary/20 text-primary shadow-[var(--neu-inset-sm)]'
                              : 'bg-card text-muted-foreground shadow-[var(--neu-raised-sm)] hover:text-foreground'
                          )}
                        >
                          显示器 {d.index + 1}
                          {d.primary ? ' · 主屏' : ''} {d.width}×{d.height}
                        </button>
                      )
                    })}
                    {displays && displays.length === 0 && (
                      <span className="text-xs text-muted-foreground">未检测到显示器</span>
                    )}
                  </div>
                )}
                <Row label="显示区域">
                  <Select
                    value={config.danmakuZone}
                    onValueChange={(v) => void patch({ danmakuZone: v as Config['danmakuZone'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">全屏</SelectItem>
                      <SelectItem value="top-half">上半屏</SelectItem>
                      <SelectItem value="top-30">顶部 30%</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                {config.danmakuZone === 'custom' && (
                  <div className="border-b border-border/50 pb-4 pt-1">
                    <ZonePicker
                      start={config.zoneStart}
                      end={config.zoneEnd}
                      onChange={(s, e) => void patch({ zoneStart: s, zoneEnd: e })}
                    />
                  </div>
                )}
                <Row label="不透明度">
                  <div className="w-44">
                    <Slider
                      value={[d.opacity]}
                      min={0.3}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => void patch({ danmaku: { ...d, opacity: v } })}
                    />
                  </div>
                </Row>
              <Row label="字号缩放">
                <div className="w-44">
                  <Slider
                    value={[d.fontScale]}
                    min={0.8}
                    max={1.6}
                    step={0.05}
                    onValueChange={([v]) => void patch({ danmaku: { ...d, fontScale: v } })}
                  />
                </div>
              </Row>
              <Row label="文字描边">
                <Switch checked={d.stroke} onCheckedChange={(v) => void patch({ danmaku: { ...d, stroke: v } })} />
              </Row>
              <Row label="悬停打卡">
                <Switch
                  title="鼠标移入弹幕时暂停飘动并浮出打卡按钮"
                  checked={config.hoverInteraction}
                  onCheckedChange={(v) => void patch({ hoverInteraction: v })}
                />
              </Row>
              <Row label="节日祝福">
                <Switch
                  checked={config.festivalEnabled}
                  onCheckedChange={(v) => void patch({ festivalEnabled: v })}
                />
              </Row>
              <Row label="重要提醒进系统通知">
                <Switch
                  title="标为「重要」的提醒同时发 Windows 系统通知"
                  checked={config.highPriorityNotify}
                  onCheckedChange={(v) => void patch({ highPriorityNotify: v })}
                />
              </Row>
            </>
          )}

          {active === 'stats' && (
            <>
              <SectionTitle title="统计" hint="打卡与活跃时长，仅保存在本机" />
              <StatsSection theme={effectiveTheme} />
            </>
          )}

          {active === 'history' && (
            <>
              <SectionTitle title="历史" hint="最近 50 条弹幕，仅保存在本机" />
              <HistorySection />
            </>
          )}

          {active === 'about' && (
            <>
              <SectionTitle title="关于" />
              <Row label="开机自启">
                <Switch checked={config.autostart} onCheckedChange={(v) => void patch({ autostart: v })} />
              </Row>
              <Row label="外观">
                <Select
                  value={config.themeMode}
                  onValueChange={(v) => void patch({ themeMode: v as Config['themeMode'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">跟随系统</SelectItem>
                    <SelectItem value="light">亮色</SelectItem>
                    <SelectItem value="dark">暗色</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="flex gap-3 pt-5">
                <Button onClick={() => void window.notifyAPI.testReminder()}>测试提醒一次</Button>
              </div>
              <div className="flex items-center gap-2.5 pt-5 text-xs text-muted-foreground">
                <span className="tabular-nums">v{appVersion}</span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void window.notifyAPI.checkUpdate()}>
                  检查更新
                </Button>
                {updateStatus !== 'idle' && <span>{UPDATE_TEXT[updateStatus]}</span>}
                <span className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void window.notifyAPI.openExternal(`${REPO_URL}/releases/latest`)}
                >
                  下载页
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void window.notifyAPI.openExternal(REPO_URL)}>
                  ⭐ 给个 Star
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed top-3.5 right-4 z-50 rounded-full bg-card px-4 py-1.5 text-[13px] text-[var(--ok,#34d399)] shadow-[var(--neu-raised)] ring-1 ring-border">
          {toast}
        </div>
      )}
    </div>
  )
}
