import './NoPleadPanel.css'
import type { NoPleadContent } from '../utils/noPlead'

type Props = {
  content: NoPleadContent
  countdownLeft: number | null
  busy?: boolean
  onPersistNo: () => void
  onSoft: () => void
}

export function NoPleadPanel({
  content,
  countdownLeft,
  busy = false,
  onPersistNo,
  onSoft,
}: Props) {
  const counting =
    content.countdownSec != null &&
    countdownLeft != null &&
    countdownLeft > 0
  const noDisabled = busy || counting

  return (
    <div
      className={`no-plead ${content.dogeza ? 'is-dogeza' : ''} ${
        counting ? 'is-counting' : ''
      }`}
      role="dialog"
      aria-live="polite"
      aria-label="NOの確認"
    >
      <p key={content.line} className="no-plead-line">
        {content.line}
      </p>

      {counting && (
        <p className="no-plead-count" aria-live="assertive">
          {countdownLeft}
        </p>
      )}

      {content.dogeza && (
        <p className="no-plead-dogeza" aria-hidden="true">
          🙇 お願いします… お願いします…
        </p>
      )}

      <div className="no-plead-actions">
        <button
          type="button"
          className="no-plead-soft"
          onClick={onSoft}
          disabled={busy}
        >
          {content.softLabel}
        </button>
        <button
          type="button"
          className="no-plead-no"
          onClick={onPersistNo}
          disabled={noDisabled}
          style={
            content.shrinkNo
              ? { transform: `scale(${Math.max(0.7, 1 - (content.stage - 3) * 0.08)})` }
              : undefined
          }
        >
          {counting ? `あと${countdownLeft}秒…` : content.noLabel}
        </button>
      </div>
    </div>
  )
}
