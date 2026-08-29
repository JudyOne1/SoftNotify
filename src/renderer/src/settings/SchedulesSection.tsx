import { useState } from 'react'
import type { ScheduleItem } from '@shared/types'
import { SCHEDULE_PRESETS } from '@shared/templates'
import { newId, timeIso, todayIso } from './util'

const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

interface Props {
  schedules: ScheduleItem[]
  onChange: (next: ScheduleItem[]) => void
  onTest: (id: string) => void
}

export default function SchedulesSection({ schedules, onChange, onTest }: Props): React.JSX.Element {
  function update(id: string, p: Partial<ScheduleItem>): void {
    onChange(schedules.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }

  function add(presetIndex: 'blank' | 'countdown' | number): void {
    let item: ScheduleItem
    if (presetIndex === 'countdown') {
      item = {
        id: newId(),
        name: '倒计时',
        enabled: true,
        time: timeIso(30),
        weekdays: [],
        date: todayIso(30),
        texts: ['时间到啦！'],
        ignoreQuiet: false
      }
    } else if (presetIndex === 'blank') {
      item = { id: newId(), name: '新日程', enabled: true, time: '09:00', weekdays: [], texts: [], ignoreQuiet: false }
    } else {
      const preset = SCHEDULE_PRESETS[presetIndex]
      item = {
        id: newId(),
        name: preset.name,
        enabled: true,
        time: preset.time,
        weekdays: [...preset.weekdays],
        texts: [...preset.texts],
        ignoreQuiet: preset.ignoreQuiet === true
      }
    }
    onChange([...schedules, item])
  }

  return (
    <>
      <div className="plan-list">
        {schedules.map((item) => (
          <ScheduleCard
            key={item.id}
            item={item}
            onChange={(p) => update(item.id, p)}
            onDelete={() => onChange(schedules.filter((s) => s.id !== item.id))}
            onTest={onTest}
          />
        ))}
        {schedules.length === 0 && <div className="plan-empty">还没有定时日程，从下面添加一个吧</div>}
      </div>
      <div className="plan-add">
        <button type="button" onClick={() => add('countdown')}>
          ＋ 倒计时（30 分钟）
        </button>
        <button type="button" onClick={() => add('blank')}>
          ＋ 空白日程
        </button>
        {SCHEDULE_PRESETS.map((p, i) => (
          <button key={p.name} type="button" onClick={() => add(i)}>
            ＋ {p.name}
          </button>
        ))}
      </div>
    </>
  )
}

function ScheduleCard({
  item,
  onChange,
  onDelete,
  onTest
}: {
  item: ScheduleItem
  onChange: (p: Partial<ScheduleItem>) => void
  onDelete: () => void
  onTest: (id: string) => void
}): React.JSX.Element {
  const [name, setName] = useState(item.name)
  const [texts, setTexts] = useState(item.texts.join('\n'))
  const [nightOpen, setNightOpen] = useState(false)
  const [nightTexts, setNightTexts] = useState((item.nightTexts ?? []).join('\n'))

  function commit(): void {
    if (name !== item.name || texts !== item.texts.join('\n') || nightTexts !== (item.nightTexts ?? []).join('\n')) {
      onChange({
        name,
        texts: texts.split('\n').map((t) => t.trim()),
        nightTexts: nightTexts.split('\n').map((t) => t.trim())
      })
    }
  }

  const isOnce = !!item.date
  function toggleOnce(on: boolean): void {
    onChange(on ? { date: item.date ?? todayIso() } : { date: undefined })
  }

  function toggleWeekday(v: number): void {
    const set = new Set(item.weekdays)
    if (set.has(v)) set.delete(v)
    else set.add(v)
    onChange({ weekdays: [...set] })
  }

  return (
    <div className={`plan-card${item.enabled ? '' : ' plan-off'}`}>
      <div className="plan-head">
        <input type="checkbox" title="启用该日程" checked={item.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        <input
          className="plan-name"
          value={name}
          maxLength={20}
          placeholder="日程名称"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <input type="time" value={item.time} onChange={(e) => onChange({ time: e.target.value })} />
        <button type="button" className="plan-del" title="删除" onClick={onDelete}>
          ✕
        </button>
      </div>
      <div className="plan-sub">
        <label className="chip-label">
          <input type="checkbox" checked={isOnce} onChange={(e) => toggleOnce(e.target.checked)} />
          单次
        </label>
        {isOnce ? (
          <input type="date" value={item.date} min={todayIso()} onChange={(e) => onChange({ date: e.target.value || todayIso() })} />
        ) : (
          <span className="chips">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                type="button"
                className={`chip${item.weekdays.includes(w.value) ? ' chip-on' : ''}`}
                title={item.weekdays.length === 0 ? '当前：每天（点选可指定周几）' : undefined}
                onClick={() => toggleWeekday(w.value)}
              >
                {w.label}
              </button>
            ))}
            <span className="chip-hint">{item.weekdays.length === 0 ? '每天' : '周几触发'}</span>
          </span>
        )}
      </div>
      <div className="plan-sub">
        <label className="chip-label">
          <input type="checkbox" checked={item.ignoreQuiet} onChange={(e) => onChange({ ignoreQuiet: e.target.checked })} />
          忽略安静时段
        </label>
      </div>
      <textarea
        className="plan-texts"
        rows={2}
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
