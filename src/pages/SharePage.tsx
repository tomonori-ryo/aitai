import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getShareInfo } from '../api'
import { SharePanel } from '../components/SharePanel'
import type { ShareInfo } from '../types'
import { questionTitle } from '../utils/firstPerson'
import { startCreateInviteFlow } from '../utils/share'
import './SharePage.css'

export function SharePage() {
  const { questionId } = useParams()
  const [searchParams] = useSearchParams()
  const responseId = searchParams.get('r') || undefined
  const navigate = useNavigate()
  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!questionId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await getShareInfo(questionId, responseId)
        if (!cancelled) setInfo(data)
      } catch {
        if (!cancelled) setError('この結果は見つかりませんでした。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [questionId, responseId])

  if (loading) {
    return (
      <main className="page share-landing">
        <p className="status-msg">読み込み中…</p>
      </main>
    )
  }

  if (error || !info) {
    return (
      <main className="page share-landing">
        <p className="status-msg">{error || '見つかりませんでした'}</p>
        <Link className="back-link" to="/">
          トップへ
        </Link>
      </main>
    )
  }

  const yes = info.answer === 'yes'
  const firstPerson = info.firstPerson || '俺'
  const headline =
    info.mode === 'aggregate'
      ? `YES ${info.yesCount} / NO ${info.noCount}`
      : yes
        ? 'YES'
        : 'NO'

  return (
    <main className={`page share-landing ${yes ? '' : 'is-sad'}`}>
      <div className="atmosphere" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
      </div>

      <section className="share-landing-stage">
        <p className="brand">{questionTitle(firstPerson)}</p>
        <p className="share-landing-label">RESULT</p>
        <h1
          className={`share-landing-answer ${yes ? 'is-yes' : 'is-no'} ${
            info.mode === 'aggregate' ? 'is-aggregate' : ''
          }`}
        >
          {info.mode === 'aggregate' ? headline : yes ? 'YES' : 'NO'}
        </h1>
        <p className="share-landing-copy">
          {info.mode === 'aggregate'
            ? `${info.answeredCount}人が回答`
            : yes
              ? '会いたい気持ち、届いた。'
              : '今回は残念…また今度？'}
        </p>

        <SharePanel
          answer={info.answer}
          questionId={info.questionId}
          responseId={info.mode === 'single' ? info.responseId : undefined}
          firstPerson={firstPerson}
          compact
        />

        <aside className="share-landing-viral">
          <p>あなたも気になる人に聞いてみる？</p>
          <button
            type="button"
            className="share-landing-create"
            disabled={creating}
            onClick={() => {
              setCreating(true)
              void startCreateInviteFlow(navigate).catch(() => setCreating(false))
            }}
          >
            {creating ? 'つくってる…' : '質問をつくってみる'}
          </button>
        </aside>
      </section>
    </main>
  )
}
