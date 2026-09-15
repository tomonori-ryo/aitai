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
    text: `${text}\n${shareUrl}`,
    hashtags: '会いたい',
  })
  // x.com の方がモバイルアプリ連携が安定しやすい
  return `https://x.com/intent/post?${params.toString()}`
}

/** LINEアプリにテキスト＋URLを渡す（モバイルで確実） */
export function lineShareUrl(
  shareUrl: string,
  answer: 'yes' | 'no' = 'yes',
  firstPerson = DEFAULT_FIRST_PERSON,
): string {
  const title = questionTitle(firstPerson)
  const text =
    answer === 'yes'
      ? `「${title}」の答えは YES だった\n${shareUrl}`
      : `「${title}」の答えは NO だった…\n${shareUrl}`
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`
}

/**
 * 外部シェアを開く。モバイルの popup ブロックを避けるため同一タブ遷移を使う。
 */
export function openShareTarget(url: string): void {
  window.location.assign(url)
}

/** @deprecated openShareTarget と同じ（互換用） */
export function openShareTargetSameTab(url: string): void {
  openShareTarget(url)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) return true
    } catch {
      // fall through
    }
    window.prompt('リンクをコピーしてください', text)
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
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
    answer === 'yes'
      ? `「${title}」→ YES\n${shareUrl}`
      : `「${title}」→ NO\n${shareUrl}`

  // ファイル付き共有（Instagram / LINE 等のアプリシート向け）
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  // URL のみの共有シート
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: shareUrl })
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

/** Instagram は Web Intent が無いので、画像保存＋リンクコピー＋可能なら共有シート */
export async function shareForInstagram(options: {
  blob: Blob
  shareUrl: string
  answer: 'yes' | 'no'
  firstPerson?: string
}): Promise<'shared' | 'prepared' | 'cancelled'> {
  const { blob, shareUrl, answer } = options
  const firstPerson = sanitizeFirstPerson(options.firstPerson)
  const title = questionTitle(firstPerson)
  const file = new File([blob], 'aitai-result.png', { type: 'image/png' })
  const text =
    answer === 'yes'
      ? `「${title}」→ YES`
      : `「${title}」→ NO`

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      await copyText(shareUrl)
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  downloadBlob(blob, 'aitai-result.png')
  await copyText(shareUrl)
  return 'prepared'
}
