import { useState } from 'react'
import type { ReminderItem } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import { newId } from './util'

const INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

interface Props {
  reminders: ReminderItem[]
  onChange: (next: ReminderItem[]) => void
  onTest: (id: string) => void
}

export default function RemindersSection({ reminders, onChange, onTest }: Props): React.JSX.Element {
  function update(id: string, p: Partial<ReminderItem>): void {
    onChange(reminders.map((r) => (r.id === id ? { ...r, ...p } : r)))
  }

  function add(presetIndex: number | null): void {
    const preset = presetIndex === null ? null : REMINDER_PRESETS[presetIndex]
    onChange([
      ...reminders,
      {
        id: newId(),
        name: preset?.name ?? '新提醒',
        enabled: true,
        intervalMinutes: preset?.intervalMinutes ?? 30,
        texts: preset ? [...preset.texts] : []
      }
    ])
  }

  return (
    <>
      <div className="plan-list">
        {reminders.map((item) => (
          <ReminderCard
            key={item.id}
            item={item}
            onChange={(p) => update(item.id, p)}
            onDelete={() => onChange(reminders.filter((r) => r.id !== item.id))}
            onTest={onTest}
          />
        ))}
        {reminders.length === 0 && <div className="plan-empty">还没有间隔提醒，从下面添加一个吧</div>}
      </div>
      <div className="plan-add">
        <button type="button" onClick={() => add(null)}>
          ＋ 空白提醒
        </button>
        {REMINDER_PRESETS.map((p, i) => (
          <button key={p.name} type="button" onClick={() => add(i)}>
            ＋ {p.name}
          </button>
        ))}
      </div>
    </>
  )
}

function ReminderCard({
  item,
  onChange,
  onDelete,
  onTest
}: {
  item: ReminderItem
  onChange: (p: Partial<ReminderItem>) => void
  onDelete: () => void
  onTest: (id: string) => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightOpen, setNightOpen] = useState(false)
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))

  /** 失焦/回车提交草稿，避免每次按键被服务端清洗后打断输入 */
  function commit(): void {
    if (name !== item.name || texts !== item.texts.join('\n') || nightTexts !== (item.nightTexts ?? []).join('\n')) {
      onChange({
        name,
        texts: texts.split('\n').map((t) => t.trim()),
        nightTexts: nightTexts.split('\n').map((t) => t.trim())
      })
    }
  }

  return (
    <div className={`plan-card${item.enabled ? '' : ' plan-off'}`}>
      <div className="plan-head">
        <input type="checkbox" title="启用该提醒" checked={item.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        <input
          className="plan-name"
          value={name}
          maxLength={20}
          placeholder="提醒名称"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <select
          value={item.intervalMinutes}
          title="提醒间隔"
          onChange={(e) => onChange({ intervalMinutes: Number(e.target.value) })}
        >
          {INTERVAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} 分钟` : `${m / 60} 小时`}
            </option>
          ))}
        </select>
        <button type="button" className="plan-del" title="删除" onClick={onDelete}>
          ✕
        </button>
      </div>
      <textarea
        className="plan-texts"
        rows={3}
        value={texts}
        placeholder="每行一条弹幕文案，留空则使用内置通用文案"
        onChange={(e) => setTexts(e.target.value)}
        onBlur={commit}
      />
      <div className="plan-foot">
        <button type="button" className="link" onClick={() => setNightOpen(!nightOpen)}>
          {nightOpen ? '收起夜间文案' : item.nightTexts?.length ? '夜间文案 ●' : '夜间文案'}
        </button>
        <button type="button" className="link" onClick={() => onTest(item.id)}>
          试一下
        </button>
      </div>
      {nightOpen && (
        <textarea
          className="plan-texts"
          rows={2}
          value={nightTexts}
          placeholder="22:00-06:00 触发时优先使用，每行一条，留空沿用上面的文案"
          onChange={(e) => setNightTexts(e.target.value)}
          onBlur={commit}
        />
      )}
    </div>
  )
}
