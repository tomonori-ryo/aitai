export type Answer = 'yes' | 'no'

export type ResponseRecord = {
  id: string
  status: 'pending' | 'answered'
  answer: Answer | null
  createdAt?: string
  viewedAt: string | null
  answeredAt: string | null
  noPressCount: number
  responseMs: number | null
}

export type QuestionSummary = {
  id: string
  label: string
  firstPerson: string
  createdAt: string
  updatedAt: string
  yesCount: number
  noCount: number
  answeredCount: number
  pendingCount: number
  responseCount: number
  status: 'pending' | 'answered'
}

export type QuestionResponseRow = {
  id: string
  index: number
  label: string
  status: 'pending' | 'answered'
  answer: Answer | null
  viewedAt: string | null
  answeredAt: string | null
  noPressCount: number
  responseMs: number | null
}

export type QuestionDetail = QuestionSummary & {
  responses: QuestionResponseRow[]
}

export type ShareInfo =
  | {
      questionId: string
      responseId: string
      mode: 'single'
      answer: Answer
      firstPerson: string
    }
  | {
      questionId: string
      mode: 'aggregate'
      yesCount: number
      noCount: number
      answeredCount: number
      answer: Answer
      firstPerson: string
    }

export type HistoryItem = {
  id: string
  label: string
  createdAt: string
}

export function formatSpeedLabel(responseMs: number | null): string {
  if (responseMs == null) return 'タイム不明'
  const sec = responseMs / 1000
  if (sec < 5) return '即答！'
  if (sec < 15) return '秒殺レベル'
  if (sec < 60) return `${Math.round(sec)}秒で決断`
  if (sec < 60 * 5) return `${Math.round(sec / 60)}分悩んだ`
  if (sec < 60 * 60) return `${Math.round(sec / 60)}分じっくり`
  if (sec < 60 * 60 * 24) return `${Math.round(sec / 3600)}時間考えた`
  const days = Math.round(sec / 86400)
  if (days <= 1) return '1日悩んだ'
  return `${days}日悩んだ`
}

export function questionStatusLabel(q: QuestionSummary): string {
  if (q.answeredCount > 0) return '回答あり'
  if (q.pendingCount > 0) return '未回答（開封あり）'
  return '未回答'
}
