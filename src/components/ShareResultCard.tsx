import { toPng } from 'html-to-image'
import { useEffect, useRef, useState, type RefObject } from 'react'
import QRCode from 'qrcode'
import {
  DEFAULT_FIRST_PERSON,
  questionTitle,
} from '../utils/firstPerson'
import { getCreateUrl } from '../utils/share'
import './ShareResultCard.css'

type Props = {
  answer: 'yes' | 'no'
  firstPerson?: string
  /** キャプチャ用に常にマウント（画面外） */
  captureRef?: RefObject<HTMLDivElement | null>
}

export function ShareResultCard({
  answer,
  firstPerson = DEFAULT_FIRST_PERSON,
  captureRef,
}: Props) {
  const localRef = useRef<HTMLDivElement>(null)
  const ref = captureRef ?? localRef
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(getCreateUrl(), {
      width: 160,
      margin: 1,
      color: { dark: '#1f1216', light: '#00000000' },
    }).then((url) => {
      if (!cancelled) setQrUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const yes = answer === 'yes'

  return (
    <div className="share-card-offscreen" aria-hidden="true">
      <div
        ref={ref}
        className={`share-card ${yes ? 'is-yes' : 'is-no'}`}
        data-share-card
      >
        <p className="share-card-brand">{questionTitle(firstPerson)}</p>
        <p className="share-card-label">RESULT</p>
        <p className={`share-card-answer ${yes ? 'is-yes' : 'is-no'}`}>
          {yes ? 'YES' : 'NO'}
        </p>
        <p className="share-card-tagline">
          {yes ? '会いたい気持ち、届いた。' : '今回は残念…また今度？'}
        </p>
        <div className="share-card-viral">
          <div className="share-card-viral-text">
            <span>あなたも気になる人に</span>
            <strong>聞いてみる？</strong>
          </div>
          {qrUrl ? (
            <img className="share-card-qr" src={qrUrl} alt="" width={72} height={72} />
          ) : (
            <div className="share-card-qr placeholder" />
          )}
        </div>
      </div>
    </div>
  )
}

export async function captureShareCard(
  node: HTMLElement,
): Promise<Blob> {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffe3ea',
  })
  const res = await fetch(dataUrl)
  return res.blob()
}
