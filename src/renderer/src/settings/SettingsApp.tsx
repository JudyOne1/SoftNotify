import { useEffect, useState } from 'react'
import type { Config } from '@shared/types'
import './settings.css'

const INTERVAL_OPTIONS = [15, 30, 45, 60, 90, 120]

export default function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.notifyAPI.getConfig().then(setConfig)
  }, [])

  async function patch(p: Partial<Config>): Promise<void> {
    const next = await window.notifyAPI.setConfig(p)
    setConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
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

        <label className="row">
          <span>提醒间隔</span>
          <select
            value={config.intervalMinutes}
            onChange={(e) => void patch({ intervalMinutes: Number(e.target.value) })}
          >
            {INTERVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} 分钟
              </option>
            ))}
          </select>
        </label>

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
          <span>开机自启</span>
          <input
            type="checkbox"
            checked={config.autostart}
            onChange={(e) => void patch({ autostart: e.target.checked })}
          />
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
