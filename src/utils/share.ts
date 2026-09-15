import { createQuestion } from '../api'
import {
  DEFAULT_FIRST_PERSON,
  questionTitle,
  sanitizeFirstPerson,
} from './firstPerson'

/** 既存の質問作成フロー（新規ID発行 → 確認ページへ） */
export async function startCreateInviteFlow(
  navigate: (path: string) => void,
  label = '',
  firstPerson = DEFAULT_FIRST_PERSON,
): Promise<void> {
  const question = await createQuestion(label, firstPerson)
  navigate(`/watch/${question.id}`)
}

export function getSharePageUrl(questionId: string, responseId?: string): string {
  if (responseId) {
    return `${window.location.origin}/s/${questionId}?r=${encodeURIComponent(responseId)}`
  }
  return `${window.location.origin}/s/${questionId}`
}

export function getCreateUrl(): string {
  return `${window.location.origin}/?create=1`
}

export function getQuestionUrl(questionId: string): string {
  return `${window.location.origin}/q/${questionId}`
}

export function twitterIntentUrl(
  shareUrl: string,
  answer: 'yes' | 'no',
  firstPerson = DEFAULT_FIRST_PERSON,
): string {
  const title = questionTitle(firstPerson)
  const text =
    answer === 'yes'
      ? `「${title}」の答えは YES だった`
      : `「${title}」の答えは NO だった…`
  const params = new URLSearchParams({
    text,
    url: shareUrl,
    hashtags: '会いたい',
  })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function lineShareUrl(shareUrl: string): string {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt('リンクをコピーしてください', text)
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function shareImageAndUrl(options: {
  blob: Blob
  shareUrl: string
  answer: 'yes' | 'no'
  firstPerson?: string
}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { blob, shareUrl, answer } = options
  const firstPerson = sanitizeFirstPerson(options.firstPerson)
  const title = questionTitle(firstPerson)
  const file = new File([blob], 'aitai-result.png', { type: 'image/png' })
  const text =
    answer === 'yes' ? `「${title}」→ YES` : `「${title}」→ NO`

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
        url: shareUrl,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: shareUrl })
      downloadBlob(blob, 'aitai-result.png')
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  downloadBlob(blob, 'aitai-result.png')
  await copyText(shareUrl)
  return 'downloaded'
}
