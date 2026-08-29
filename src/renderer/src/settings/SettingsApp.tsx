import { useEffect, useState } from 'react'
import type { Config, UpdateStatus } from '@shared/types'
import RemindersSection from './RemindersSection'
import SchedulesSection from './SchedulesSection'
import ProfilesSection from './ProfilesSection'
import './settings.css'

const REPO_URL = 'https://github.com/JudyOne1/SoftNotify'

const SECTIONS = [
  { key: 'reminders', icon: '⏰', label: '间隔提醒' },
  { key: 'schedules', icon: '📅', label: '定时日程' },
  { key: 'profiles', icon: '🎛️', label: '模式' },
  { key: 'sound', icon: '🔔', label: '声音' },
  { key: 'quiet', icon: '🌙', label: '免打扰' },
  { key: 'danmaku', icon: '💬', label: '弹幕' },
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

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [toast, setToast] = useState('')
  const [audioNote, setAudioNote] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [active, setActive] = useState<SectionKey>('reminders')

  useEffect(() => {
    void window.notifyAPI.getConfig().then(setConfig)
    void window.notifyAPI.getAppVersion().then(setAppVersion)
    window.notifyAPI.onUpdateStatus(setUpdateStatus)
    void window.notifyAPI.getUiEnv().then((env) => {
      if (env.nativeMaterial) document.body.classList.add('native-material')
    })
  }, [])

  /** 主题应用：跟随系统（matchMedia）或手动指定 */
  const themeMode = config?.themeMode ?? 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const apply = (): void => {
      document.documentElement.dataset.theme =
        themeMode === 'system' ? (mql.matches ? 'light' : 'dark') : themeMode
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
    return (
      <div className="settings-app">
        <div className="settings">加载中…</div>
      </div>
    )
  }

  const d = config.danmaku

  return (
    <div className="settings-app">
      <div className="app-shell">
        <nav className="sidebar">
          <div className="sidebar-brand">Notify</div>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`nav-item${active === s.key ? ' active' : ''}`}
              onClick={() => setActive(s.key)}
            >
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </button>
          ))}
          <div className="sidebar-footer">v{appVersion}</div>
        </nav>

        <main className="content">
          <div className="content-inner">
            {active === 'reminders' && (
              <>
                <h1>间隔提醒</h1>
                <p className="section-hint">每隔一段时间提醒一次</p>
                <RemindersSection
                  reminders={config.reminders}
                  onChange={(reminders) => void patch({ reminders })}
                  onTest={(id) => void window.notifyAPI.testReminder(id)}
                />
              </>
            )}

            {active === 'schedules' && (
              <>
                <h1>定时日程</h1>
                <p className="section-hint">每天/每周几的固定钟点触发，也可设单次倒计时</p>
                <SchedulesSection
                  schedules={config.schedules}
                  onChange={(schedules) => void patch({ schedules })}
                  onTest={(id) => void window.notifyAPI.testReminder(id)}
                />
              </>
            )}

            {active === 'profiles' && (
              <>
                <h1>模式</h1>
                <p className="section-hint">把当前配置存成模式，之后在托盘一键切换</p>
                <ProfilesSection
                  profiles={config.profiles}
                  activeProfile={config.activeProfile}
                  onApply={(id) => void window.notifyAPI.applyProfile(id)}
                  onSave={(name) => void window.notifyAPI.saveProfile(name)}
                  onDelete={(id) => void deleteProfile(id)}
                />
              </>
            )}

            {active === 'sound' && (
              <>
                <h1>声音</h1>
                <label className="row">
                  <span>声音提醒</span>
                  <input
                    type="checkbox"
                    checked={config.soundEnabled}
                    onChange={(e) => void patch({ soundEnabled: e.target.checked })}
                  />
                </label>
                <label className="row">
                  <span>音量</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={!config.soundEnabled}
                    value={config.volume}
                    onChange={(e) => void patch({ volume: Number(e.target.value) })}
                  />
                </label>
                <label className="row">
                  <span>提示音来源</span>
                  <select
                    value={config.audioMode}
                    onChange={(e) => void patch({ audioMode: e.target.value as Config['audioMode'] })}
                  >
                    <option value="synth">合成提示音</option>
                    <option value="file">自定义音频</option>
                  </select>
                </label>
                {config.audioMode === 'file' && (
                  <div className="row audio-file">
                    <span className="audio-name" title={config.audioFileName}>
                      {config.audioFileName || '未选择文件'}
                    </span>
                    <span className="audio-btns">
                      <button type="button" onClick={() => void chooseAudioFile()}>
                        {config.audioFileName ? '更换' : '选择文件'}
                      </button>
                      {config.audioFileName && (
                        <button
                          type="button"
                          onClick={() => void new Audio(`media://localhost/${config.audioFileName}`).play()}
                        >
                          试听
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {audioNote && <div className="audio-note">{audioNote}</div>}
              </>
            )}

            {active === 'quiet' && (
              <>
                <h1>免打扰</h1>
                <label className="row">
                  <span>安静时段</span>
                  <input
                    type="checkbox"
                    checked={config.quietEnabled}
                    onChange={(e) => void patch({ quietEnabled: e.target.checked })}
                  />
                </label>
                <label className="row">
                  <span>时段范围</span>
                  <span className="time-range">
                    <input
                      type="time"
                      disabled={!config.quietEnabled}
                      value={config.quietStart}
                      onChange={(e) => void patch({ quietStart: e.target.value })}
                    />
                    <span>至</span>
                    <input
                      type="time"
                      disabled={!config.quietEnabled}
                      value={config.quietEnd}
                      onChange={(e) => void patch({ quietEnd: e.target.value })}
                    />
                  </span>
                </label>
                <label className="row">
                  <span>休眠错过的提醒</span>
                  <select
                    value={config.missedPolicy}
                    onChange={(e) => void patch({ missedPolicy: e.target.value as Config['missedPolicy'] })}
                  >
                    <option value="fire">唤醒后补发</option>
                    <option value="skip">直接丢弃</option>
                  </select>
                </label>
              </>
            )}

            {active === 'danmaku' && (
              <>
                <h1>弹幕</h1>
                <label className="row">
                  <span>颜色主题</span>
                  <select value={config.theme} onChange={(e) => void patch({ theme: e.target.value as Config['theme'] })}>
                    <option value="sky">天空（多彩）</option>
                    <option value="candy">糖果（粉紫）</option>
                    <option value="mono">素雅（灰白）</option>
                  </select>
                </label>
                <label className="row">
                  <span>飘过速度</span>
                  <select value={config.speed} onChange={(e) => void patch({ speed: e.target.value as Config['speed'] })}>
                    <option value="slow">慢速</option>
                    <option value="normal">正常</option>
                    <option value="fast">快速</option>
                  </select>
                </label>
                <label className="row">
                  <span>不透明度</span>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={d.opacity}
                    onChange={(e) => void patch({ danmaku: { ...d, opacity: Number(e.target.value) } })}
                  />
                </label>
                <label className="row">
                  <span>字号缩放</span>
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.05}
                    value={d.fontScale}
                    onChange={(e) => void patch({ danmaku: { ...d, fontScale: Number(e.target.value) } })}
                  />
                </label>
                <label className="row">
                  <span>文字描边</span>
                  <input
                    type="checkbox"
                    checked={d.stroke}
                    onChange={(e) => void patch({ danmaku: { ...d, stroke: e.target.checked } })}
                  />
                </label>
                <label className="row">
                  <span>节日祝福</span>
                  <input
                    type="checkbox"
                    title="当天首次提醒自动附加节日问候（含农历节日）"
                    checked={config.festivalEnabled}
                    onChange={(e) => void patch({ festivalEnabled: e.target.checked })}
                  />
                </label>
              </>
            )}

            {active === 'about' && (
              <>
                <h1>关于</h1>
                <label className="row">
                  <span>开机自启</span>
                  <input
                    type="checkbox"
                    checked={config.autostart}
                    onChange={(e) => void patch({ autostart: e.target.checked })}
                  />
                </label>
                <label className="row">
                  <span>外观</span>
                  <select
                    value={config.themeMode}
                    onChange={(e) => void patch({ themeMode: e.target.value as Config['themeMode'] })}
                  >
                    <option value="system">跟随系统</option>
                    <option value="light">亮色</option>
                    <option value="dark">暗色</option>
                  </select>
                </label>
                <div className="row actions">
                  <button type="button" onClick={() => void window.notifyAPI.testReminder()}>
                    测试提醒一次
                  </button>
                </div>
                <div className="settings-footer">
                  <span className="footer-ver">v{appVersion}</span>
                  <button type="button" className="link" onClick={() => void window.notifyAPI.checkUpdate()}>
                    检查更新
                  </button>
                  {updateStatus !== 'idle' && <span className="footer-status">{UPDATE_TEXT[updateStatus]}</span>}
                  <span className="footer-spacer" />
                  <button
                    type="button"
                    className="link"
                    onClick={() => void window.notifyAPI.openExternal(`${REPO_URL}/releases/latest`)}
                  >
                    下载页
                  </button>
                  <button type="button" className="link star" onClick={() => void window.notifyAPI.openExternal(REPO_URL)}>
                    ⭐ 给个 Star
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
