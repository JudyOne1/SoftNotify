import { useState } from 'react'
import type { Config, ScheduleItem } from '@shared/types'
import { REMINDER_PRESETS } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { newId } from './util'

/** 首次安装的预设套餐：挑一个直接开跑 */
const BUNDLES: Array<{
  id: string
  title: string
  desc: string
  build: () => Pick<Config, 'reminders' | 'schedules'>
}> = [
  {
    id: 'coder',
    title: '久坐党',
    desc: '喝水 60 分 · 护眼 30 分 · 拉伸 90 分 · 下班提醒 18:00',
    build: () => ({
      reminders: REMINDER_PRESETS.map((p) => ({
        id: newId(),
        name: p.name,
        enabled: true,
        intervalMinutes: p.intervalMinutes,
        texts: [...p.texts]
      })),
      schedules: [
        {
          id: newId(),
          name: '下班打卡',
          enabled: true,
          time: '18:00',
          weekdays: [1, 2, 3, 4, 5],
          texts: ['到点了，收拾收拾下班吧', '今天辛苦啦，下班愉快'],
          ignoreQuiet: false
        }
      ]
    })
  },
  {
    id: 'student',
    title: '学生党',
    desc: '护眼 45 分 · 该睡觉 23:00（忽略安静时段）',
    build: () => ({
      reminders: [REMINDER_PRESETS[1]].map((p) => ({
        id: newId(),
        name: p.name,
        enabled: true,
        intervalMinutes: 45,
        texts: [...p.texts]
      })),
      schedules: [
        {
          id: newId(),
          name: '该睡觉啦',
          enabled: true,
          time: '23:00',
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          texts: ['夜深了，该睡觉啦', '放下手机和电脑，早点休息吧', '晚安，明天见'],
          ignoreQuiet: true
        }
      ]
    })
  },
  {
    id: 'minimal',
    title: '极简',
    desc: '只保留每小时喝一次水',
    build: () => ({
      reminders: [{ id: newId(), name: '喝水', enabled: true, intervalMinutes: 60, texts: [] }],
      schedules: [] as ScheduleItem[]
    })
  }
]

export default function WelcomeApp(): React.JSX.Element {
  const [picked, setPicked] = useState('coder')

  async function start(): Promise<void> {
    const bundle = BUNDLES.find((b) => b.id === picked) ?? BUNDLES[0]
    await window.notifyAPI.setConfig(bundle.build())
    window.location.hash = '#/settings'
    window.location.reload()
  }

  function skip(): void {
    window.location.hash = '#/settings'
    window.location.reload()
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-auto bg-background text-foreground">
      <div className="w-full max-w-[440px] px-8 py-10">
        <h1 className="mb-3 text-xl font-bold">欢迎使用 Notify 👋</h1>
        <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
          到点后一段轻音效 + 弹幕从屏幕飘过，提醒你喝水、护眼、活动一下——不打断你的焦点。
          先挑一个预设开始，之后随时可以改。
        </p>
        <div className="mb-3 flex flex-col gap-2.5">
          {BUNDLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setPicked(b.id)}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-lg bg-card p-3.5 text-left shadow-[var(--neu-raised)] transition-all',
                picked === b.id ? 'ring-1 ring-primary' : 'hover:brightness-110'
              )}
            >
              <span className="text-sm font-semibold">{b.title}</span>
              <span className="text-xs text-muted-foreground">{b.desc}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={() => void start()}>开始使用</Button>
          <Button variant="ghost" onClick={skip}>
            跳过，自己配置
          </Button>
        </div>
      </div>
    </div>
  )
}
