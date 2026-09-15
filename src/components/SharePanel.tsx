import { useCallback, useRef, useState } from 'react'
import {
  captureShareCard,
  ShareResultCard,
} from './ShareResultCard'
import {
  copyText,
  getSharePageUrl,
  lineShareUrl,
  openShareTargetSameTab,
  shareForInstagram,
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
  const xUrl = twitterIntentUrl(shareUrl, answer, firstPerson)
  const lineUrl = lineShareUrl(shareUrl, answer, firstPerson)

  const flash = (msg: string) => {
    setNote(msg)
    window.setTimeout(() => setNote(''), 2800)
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

  const handleLine = () => {
    // LINE はディープリンクを同一タブで開くのがいちばん確実
    openShareTargetSameTab(lineUrl)
  }

  const handleX = () => {
    openShareTargetSameTab(xUrl)
  }

  const handleInstagram = async () => {
    setBusy(true)
    try {
      const blob = await ensureBlob()
      const result = await shareForInstagram({
        blob,
        shareUrl,
        answer,
        firstPerson,
      })
      if (result === 'shared') {
        flash('共有シートを開きました。Instagramを選んでね（リンクもコピー済み）')
      } else if (result === 'prepared') {
        flash('画像を保存＋リンクコピー済み。Instagramに貼ってね')
      }
    } catch {
      flash('準備に失敗しました。リンクコピーを試してね')
    } finally {
      setBusy(false)
    }
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
          <a className="share-alt-btn" href={xUrl} onClick={(e) => {
            e.preventDefault()
            handleX()
          }}>
            X
          </a>
          <a className="share-alt-btn" href={lineUrl} onClick={(e) => {
            e.preventDefault()
            handleLine()
          }}>
            LINE
          </a>
          <button
            type="button"
            className="share-alt-btn"
            onClick={handleInstagram}
            disabled={busy}
          >
            IG
          </button>
          <button type="button" className="share-alt-btn" onClick={handleCopy}>
            コピー
          </button>
        </div>
      </div>

      {note && <p className="share-flash">{note}</p>}
    </div>
  )
}
