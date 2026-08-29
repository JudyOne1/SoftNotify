import { useEffect, useState } from 'react'
import type { Config } from '@shared/types'
import RemindersSection from './RemindersSection'
import SchedulesSection from './SchedulesSection'
import ProfilesSection from './ProfilesSection'
import './settings.css'

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [saved, setSaved] = useState(false)
  const [audioNote, setAudioNote] = useState('')

  useEffect(() => {
    void window.notifyAPI.getConfig().then(setConfig)
  }, [])

  async function patch(p: Partial<Config>): Promise<void> {
    const next = await window.notifyAPI.setConfig(p)
    setConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
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

  return (
    <div className="settings-app">
      <div className="settings">
        <h1>Notify 设置</h1>

        <h2>间隔提醒</h2>
        <p className="section-hint">每隔一段时间提醒一次</p>
        <RemindersSection
          reminders={config.reminders}
          onChange={(reminders) => void patch({ reminders })}
          onTest={(id) => void window.notifyAPI.testReminder(id)}
        />

        <h2>定时日程</h2>
        <p className="section-hint">每天/每周几的固定钟点触发，也可设单次倒计时</p>
        <SchedulesSection
          schedules={config.schedules}
          onChange={(schedules) => void patch({ schedules })}
          onTest={(id) => void window.notifyAPI.testReminder(id)}
        />

        <h2>模式</h2>
        <ProfilesSection
          profiles={config.profiles}
          activeProfile={config.activeProfile}
          onApply={(id) => void window.notifyAPI.applyProfile(id)}
          onSave={(name) => void window.notifyAPI.saveProfile(name)}
          onDelete={(id) => void deleteProfile(id)}
        />

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

        <label className="row">
          <span>开机自启</span>
          <input
            type="checkbox"
            checked={config.autostart}
            onChange={(e) => void patch({ autostart: e.target.checked })}
          />
        </label>

        <h2>免打扰</h2>

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

        <h2>弹幕</h2>

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

        <div className="row actions">
          <button type="button" onClick={() => void window.notifyAPI.testReminder()}>
            测试提醒一次
          </button>
          {saved && <span className="saved">已保存</span>}
        </div>
      </div>
    </div>
  )
}
