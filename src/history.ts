export type HistoryEntry = {
  tag: string
  name: string
  at: number
}

const STORAGE_KEY = 'inventree-scan-history'
const MAX_ENTRIES = 6

export function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).tag === 'string' &&
        typeof (entry as HistoryEntry).name === 'string'
    )
  } catch {
    return []
  }
}

export function pushHistory(tag: string, name: string): HistoryEntry[] {
  const trimmedTag = tag.trim()
  if (!trimmedTag) {
    return readHistory()
  }

  const entry: HistoryEntry = { tag: trimmedTag, name: name.trim() || trimmedTag, at: Date.now() }
  const next = [entry, ...readHistory().filter((existing) => existing.tag !== trimmedTag)].slice(
    0,
    MAX_ENTRIES
  )

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }

  return next
}

export function clearHistory(): HistoryEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
  return []
}
