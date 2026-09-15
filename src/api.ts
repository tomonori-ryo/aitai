import type {
  QuestionDetail,
  QuestionSummary,
  ResponseRecord,
  ShareInfo,
} from './types'
import { addQuestionToHistory } from './utils/history'

export async function createQuestion(
  label = '',
  firstPerson = '俺',
): Promise<QuestionDetail> {
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, firstPerson }),
  })
  if (!res.ok) throw new Error('作成に失敗しました')
  const question = (await res.json()) as QuestionDetail
  addQuestionToHistory({
    id: question.id,
    label: question.label,
    createdAt: question.createdAt,
  })
  return question
}

export async function getQuestion(id: string): Promise<QuestionDetail> {
  const res = await fetch(`/api/questions/${id}`)
  if (!res.ok) throw new Error('見つかりませんでした')
  return res.json()
}

export async function getQuestionsBatch(
  ids: string[],
): Promise<QuestionSummary[]> {
  const res = await fetch('/api/questions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('履歴の取得に失敗しました')
  const data = (await res.json()) as { items: QuestionSummary[] }
  return data.items
}

export async function claimResponse(
  questionId: string,
  responseId?: string | null,
): Promise<ResponseRecord> {
  const res = await fetch(`/api/questions/${questionId}/responses/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responseId: responseId || undefined }),
  })
  if (!res.ok) throw new Error('回答枠の取得に失敗しました')
  return res.json()
}

export async function markResponseViewed(
  questionId: string,
  responseId: string,
): Promise<ResponseRecord> {
  const res = await fetch(
    `/api/questions/${questionId}/responses/${responseId}/view`,
    { method: 'POST' },
  )
  if (!res.ok) throw new Error('既読に失敗しました')
  return res.json()
}

export async function submitResponseAnswer(
  questionId: string,
  responseId: string,
  answer: 'yes' | 'no',
  noPressCount = 0,
): Promise<ResponseRecord> {
  const res = await fetch(
    `/api/questions/${questionId}/responses/${responseId}/answer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, noPressCount }),
    },
  )
  if (!res.ok) throw new Error('回答の送信に失敗しました')
  return res.json()
}

export async function getShareInfo(
  questionId: string,
  responseId?: string,
): Promise<ShareInfo> {
  const qs = responseId
    ? `?responseId=${encodeURIComponent(responseId)}`
    : ''
  const res = await fetch(`/api/share/${questionId}${qs}`)
  if (!res.ok) throw new Error('シェア情報が見つかりません')
  return res.json()
}
