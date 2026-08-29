import { execFile } from 'node:child_process'
import { getConfig } from './store'

/**
 * 会议状态：手动开关（托盘）+ 摄像头/麦克风占用自动检测（仅 Windows）。
 * 检测原理：轮询 CapabilityAccessManager ConsentStore 注册表，任一应用
 * LastUsedTimeStart > LastUsedTimeStop 即占用中（无需管理员，见 phase6-research.md）。
 * 检测失败（键不存在/新系统迁移存储）静默视为不在会议。
 */

let manual = false
let auto = false
let timer: NodeJS.Timeout | null = null
let probing = false

export function isMeeting(): boolean {
  return manual || auto
}

export function isManualMeeting(): boolean {
  return manual
}

export function setManualMeeting(on: boolean): void {
  manual = on
}

const REG_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\\NonPackaged',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\\NonPackaged',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged'
]

/** 解析 reg query /s 输出：任一子键 Start > Stop 即占用中 */
export function parseInUse(output: string): boolean {
  let inUse = false
  let start = -1n
  let stop = -1n
  let hasStart = false
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('HKEY_')) {
      if (hasStart && start > stop) inUse = true
      start = -1n
      stop = -1n
      hasStart = false
      continue
    }
    const m = line.match(/LastUsedTimeStart\s+REG_QWORD\s+(0x[0-9a-f]+)/i)
    if (m) {
      start = BigInt(m[1])
      hasStart = true
      continue
    }
    const s = line.match(/LastUsedTimeStop\s+REG_QWORD\s+(0x[0-9a-f]+)/i)
    if (s) stop = BigInt(s[1])
  }
  if (hasStart && start > stop) inUse = true
  return inUse
}

function probeInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    let remaining = REG_KEYS.length
    let found = false
    for (const key of REG_KEYS) {
      execFile('reg', ['query', key, '/s'], { timeout: 4000 }, (err, stdout) => {
        if (!err && !found && parseInUse(stdout ?? '')) found = true
        if (--remaining <= 0) resolve(found)
      })
    }
  })
}

/** 开始轮询（仅 Windows 有意义；回调在自动状态变化时触发一次） */
export function startMeetingPolling(onChange: (inMeeting: boolean) => void): void {
  if (timer) return
  if (process.platform !== 'win32') return
  const tick = async (): Promise<void> => {
    if (probing) return
    if (!getConfig().meetingDetect) {
      if (auto) {
        auto = false
        onChange(false)
      }
      return
    }
    probing = true
    const inUse = await probeInUse()
    probing = false
    if (inUse !== auto) {
      auto = inUse
      onChange(inUse)
    }
  }
  void tick()
  timer = setInterval(() => void tick(), 15_000)
}

export function stopMeetingPolling(): void {
  if (timer) clearInterval(timer)
  timer = null
}
