import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface HistoryEntry {
  text: string
  /** 来源提醒项名称 */
  name?: string
  at: number
}

const MAX = 50
let cache: HistoryEntry[] | null = null

function file(): string {
  return join(app.getPath('userData'), 'history.json')
}

function load(): HistoryEntry[] {
  if (!cache) {
    try {
      const raw = JSON.parse(readFileSync(file(), 'utf-8')) as unknown
      cache = Array.isArray(raw) ? (raw as HistoryEntry[]).slice(-MAX) : []
    } catch {
      cache = []
    }
  }
  return cache
}

/** 最近的弹幕，新的在前 */
export function getHistory(): HistoryEntry[] {
  return [...load()].reverse()
}

export function addHistory(entry: HistoryEntry): void {
  const list = load()
  list.push(entry)
  if (list.length > MAX) list.splice(0, list.length - MAX)
  const f = file()
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(list), 'utf-8')
}
