import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getQuestionsBatch } from '../api'
import type { QuestionSummary } from '../types'
import { questionStatusLabel } from '../types'
import { getQuestionHistory } from '../utils/history'
import './HistoryPage.css'

type Row = QuestionSummary & { localLabel: string }

export function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const history = getQuestionHistory()
      if (history.length === 0) {
        if (!cancelled) {
          setRows([])
          setLoading(false)
        }
        return
      }

      try {
        const summaries = await getQuestionsBatch(history.map((h) => h.id))
        const byId = new Map(summaries.map((s) => [s.id, s]))
        const next: Row[] = history
          .map((h) => {
            const s = byId.get(h.id)
            if (!s) return null
            return {
              ...s,
              localLabel: h.label || s.label || '',
            }
          })
          .filter((r): r is Row => r != null)

        if (!cancelled) setRows(next)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page history">
      <div className="atmosphere" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
      </div>

      <section className="history-stage">
        <p className="brand">俺に会いたい？</p>
        <h1 className="history-title">送信履歴</h1>
        <p className="history-copy">
          この端末で作った質問の一覧です。サーバーには作成者情報は保存していません。
        </p>

        <Link className="btn-primary history-create" to="/?create=1">
          新しくつくる
        </Link>

        {loading ? (
          <p className="history-empty">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="history-empty">まだ質問がありません</p>
        ) : (
          <ul className="history-list">
            {rows.map((row) => (
              <li key={row.id}>
                <Link to={`/watch/${row.id}`} className="history-card">
                  <div className="history-card-top">
                    <strong>{row.localLabel || '（ラベルなし）'}</strong>
                    <span className={`badge badge-${row.status}`}>
                      {questionStatusLabel(row)}
                    </span>
                  </div>
                  <div className="history-card-meta">
                    <span>
                      回答 {row.answeredCount}件
                      {row.answeredCount > 0
                        ? `（YES ${row.yesCount} / NO ${row.noCount}）`
                        : ''}
                    </span>
                    <time dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString('ja-JP')}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link className="home-link" to="/">
          トップへ
        </Link>
      </section>
    </main>
  )
}
