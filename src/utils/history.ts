import type { HistoryItem } from '../types'

const HISTORY_KEY = 'aitai-question-history'
const RESPONSE_KEY_PREFIX = 'aitai-response:'

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is HistoryItem =>
        item &&
        typeof item.id === 'string' &&
        typeof item.createdAt === 'string',
    )
  } catch {
    return []
  }
}

function writeHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 100)))
}

export function getQuestionHistory(): HistoryItem[] {
  return readHistory().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function addQuestionToHistory(item: HistoryItem) {
  const next = readHistory().filter((h) => h.id !== item.id)
  next.unshift({
    id: item.id,
    label: item.label || '',
    createdAt: item.createdAt,
  })
  writeHistory(next)
}

export function updateHistoryLabel(id: string, label: string) {
  const next = readHistory().map((h) =>
    h.id === id ? { ...h, label: label.trim().slice(0, 40) } : h,
  )
  writeHistory(next)
}

export function getStoredResponseId(questionId: string): string | null {
  try {
    return localStorage.getItem(`${RESPONSE_KEY_PREFIX}${questionId}`)
  } catch {
    return null
  }
}

export function setStoredResponseId(questionId: string, responseId: string) {
  try {
    localStorage.setItem(`${RESPONSE_KEY_PREFIX}${questionId}`, responseId)
  } catch {
    // ignore
  }
}
