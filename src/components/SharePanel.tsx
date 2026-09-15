import { useCallback, useRef, useState } from 'react'
import {
  captureShareCard,
  ShareResultCard,
} from './ShareResultCard'
import {
  copyText,
  getSharePageUrl,
  lineShareUrl,
  shareImageAndUrl,
  twitterIntentUrl,
} from '../utils/share'
import './SharePanel.css'

type Props = {
  answer: 'yes' | 'no'
  questionId: string
  responseId?: string
  firstPerson?: string
  compact?: boolean
}

export function SharePanel({
  answer,
  questionId,
  responseId,
  firstPerson = '俺',
  compact = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const shareUrl = getSharePageUrl(questionId, responseId)

  const flash = (msg: string) => {
    setNote(msg)
    window.setTimeout(() => setNote(''), 2200)
  }

  const ensureBlob = useCallback(async () => {
    if (!cardRef.current) throw new Error('card missing')
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    return captureShareCard(cardRef.current)
  }, [])

  const handleNativeShare = async () => {
    setBusy(true)
    try {
      const blob = await ensureBlob()
      const result = await shareImageAndUrl({
        blob,
        shareUrl,
        answer,
        firstPerson,
      })
      if (result === 'downloaded') {
        flash('画像を保存し、リンクをコピーしました')
      } else if (result === 'shared') {
        flash('シェアしました')
      }
    } catch {
      flash('シェアに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    const ok = await copyText(shareUrl)
    flash(ok ? 'リンクをコピーしました' : 'コピーしてください')
  }

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`share-panel ${compact ? 'is-compact' : ''}`}>
      <ShareResultCard
        answer={answer}
        firstPerson={firstPerson}
        captureRef={cardRef}
      />

      <p className="share-panel-title">結果をシェア</p>
      <p className="share-panel-note">
        YES/NO と質問タイトルだけ。名前など個人情報は入りません。
      </p>

      <div className="share-panel-actions">
        <button
          type="button"
          className="share-main-btn"
          onClick={handleNativeShare}
          disabled={busy}
        >
          {busy ? '準備中…' : '結果をシェア'}
        </button>

        <div className="share-alt-row">
          <button
            type="button"
            className="share-alt-btn"
            onClick={() =>
              openExternal(twitterIntentUrl(shareUrl, answer, firstPerson))
            }
          >
            X
          </button>
          <button
            type="button"
            className="share-alt-btn"
            onClick={() => openExternal(lineShareUrl(shareUrl))}
          >
            LINE
          </button>
          <button type="button" className="share-alt-btn" onClick={handleCopy}>
            リンクコピー
          </button>
        </div>
      </div>

      {note && <p className="share-flash">{note}</p>}
    </div>
  )
}
