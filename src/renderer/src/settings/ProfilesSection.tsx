import { useState } from 'react'
import type { Profile } from '@shared/types'

interface Props {
  profiles: Profile[]
  activeProfile: string | null
  onApply: (id: string) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
}

export default function ProfilesSection({ profiles, activeProfile, onApply, onSave, onDelete }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  function save(): void {
    const n = name.trim()
    if (!n) return
    onSave(n)
    setName('')
  }

  return (
    <>
      <div className="plan-list">
        {profiles.map((p) => (
          <div key={p.id} className={`profile-row${activeProfile === p.id ? ' profile-active' : ''}`}>
            <span className="profile-name" title={activeProfile === p.id ? '当前激活' : undefined}>
              {activeProfile === p.id ? '● ' : ''}
              {p.name}
            </span>
            <button type="button" className="link" onClick={() => onApply(p.id)}>
              应用
            </button>
            <button type="button" className="plan-del" title="删除" onClick={() => onDelete(p.id)}>
              ✕
            </button>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="plan-empty">把当前的提醒计划、安静时段、弹幕外观保存成一个模式，之后在托盘一键切换</div>
        )}
      </div>
      <div className="plan-add">
        <input
          className="profile-input"
          value={name}
          maxLength={20}
          placeholder="模式名，如：工作"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button type="button" onClick={save}>
          保存当前为模式
        </button>
      </div>
    </>
  )
}
