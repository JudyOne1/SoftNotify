import { useEffect, useState } from 'react'
import type { Config, ReminderItem } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import './settings.css'

const INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

interface ReminderDraft {
  id: string
  name: string
  interval: number
  texts: string
}

let localId = 0
function newId(): string {
  return `local-${Date.now().toString(36)}-${localId++}`
}

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [saved, setSaved] = useState(false)
  const [audioNote, setAudioNote] = useState('')
  /** 名称/文案的本地草稿：失焦或回车才写回配置，避免每次按键被服务端清洗后打断输入 */
  const [drafts, setDrafts] = useState<Record<string, ReminderDraft>>({})

  useEffect(() => {
    void window.notifyAPI.getConfig().then(setConfig)
  }, [])

  async function patch(p: Partial<Config>): Promise<void> {
    const next = await window.notifyAPI.setConfig(p)
    setConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  function draftOf(item: ReminderItem): ReminderDraft {
    return drafts[item.id] ?? { id: item.id, name: item.name, interval: item.intervalMinutes, texts: item.texts.join('\n') }
  }

  function setDraft(item: ReminderItem, draft: Partial<ReminderDraft>): void {
    setDrafts((prev) => {
      const base = prev[item.id] ?? {
        id: item.id,
        name: item.name,
        interval: item.intervalMinutes,
        texts: item.texts.join('\n')
      }
      return { ...prev, [item.id]: { ...base, ...draft } }
    })
  }

  async function commitDraft(item: ReminderItem): Promise<void> {
    const draft = drafts[item.id]
    if (!draft) return
    const name = draft.name
    const texts = draft.texts
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    // 提交后以服务端清洗结果为准，清掉本地草稿
    await patch({
      reminders: (config?.reminders ?? []).map((r) =>
        r.id === item.id ? { ...r, name, texts: texts.split('\n').map((t) => t.trim()) } : r
      )
    })
  }

  async function updateItem(id: string, p: Partial<ReminderItem>): Promise<void> {
    await patch({ reminders: (config?.reminders ?? []).map((r) => (r.id === id ? { ...r, ...p } : r)) })
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

  async function addItem(presetIndex: number | null): Promise<void> {    const preset = presetIndex === null ? null : REMINDER_PRESETS[presetIndex]
    const item: ReminderItem = {
      id: newId(),
      name: preset?.name ?? '新提醒',
      enabled: true,
      intervalMinutes: preset?.intervalMinutes ?? 30,
      texts: preset ? [...preset.texts] : []
    }
    await patch({ reminders: [...(config?.reminders ?? []), item] })
  }

  async function removeItem(id: string): Promise<void> {
    await patch({ reminders: (config?.reminders ?? []).filter((r) => r.id !== id) })
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

        <h2>提醒计划</h2>
        <div className="plan-list">
          {config.reminders.map((item) => {
            const draft = draftOf(item)
            return (
              <div key={item.id} className={`plan-card${item.enabled ? '' : ' plan-off'}`}>
                <div className="plan-head">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    title="启用该提醒"
                    onChange={(e) => void updateItem(item.id, { enabled: e.target.checked })}
                  />
                  <input
                    className="plan-name"
                    value={draft.name}
                    maxLength={20}
                    placeholder="提醒名称"
                    onChange={(e) => setDraft(item, { name: e.target.value })}
                    onBlur={() => void commitDraft(item)}
                    onKeyDown={(e) => e.key === 'Enter' && void commitDraft(item)}
                  />
                  <select
                    value={item.intervalMinutes}
                    title="提醒间隔"
                    onChange={(e) => void updateItem(item.id, { intervalMinutes: Number(e.target.value) })}
                  >
                    {INTERVAL_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} 分钟` : `${m / 60} 小时`}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="plan-del" title="删除" onClick={() => void removeItem(item.id)}>
                    ✕
                  </button>
                </div>
                <textarea
                  className="plan-texts"
                  rows={3}
                  value={draft.texts}
                  placeholder="每行一条弹幕文案，留空则使用内置通用文案"
                  onChange={(e) => setDraft(item, { texts: e.target.value })}
                  onBlur={() => void commitDraft(item)}
                />
                <div className="plan-foot">
                  <button type="button" className="link" onClick={() => void window.notifyAPI.testReminder(item.id)}>
                    试一下
                  </button>
                </div>
              </div>
            )
          })}
          {config.reminders.length === 0 && <div className="plan-empty">还没有提醒项，从下面添加一个吧</div>}
        </div>
        <div className="plan-add">
          <button type="button" onClick={() => void addItem(null)}>
            ＋ 空白提醒
          </button>
          {REMINDER_PRESETS.map((p, i) => (
            <button key={p.name} type="button" onClick={() => void addItem(i)}>
              ＋ {p.name}
            </button>
          ))}
        </div>

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
