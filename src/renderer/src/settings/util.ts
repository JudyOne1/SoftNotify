let counter = 0

/** 渲染层临时 id（保存时由主进程 normalize 兜底去重） */
export function newId(): string {
  return `local-${Date.now().toString(36)}-${counter++}`
}

export function todayIso(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function timeIso(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
