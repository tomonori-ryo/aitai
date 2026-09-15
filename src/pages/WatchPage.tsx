import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createQuestion, getQuestion } from '../api'
import { Celebration } from '../components/Celebration'
import { SharePanel } from '../components/SharePanel'
import type { QuestionDetail } from '../types'
import { formatSpeedLabel, questionStatusLabel } from '../types'
import { updateHistoryLabel } from '../utils/history'
import { questionTitle } from '../utils/firstPerson'
import { copyText, getQuestionUrl } from '../utils/share'
import { playSad, playSuccess, vibrate } from '../utils/sound'
import './WatchPage.css'

export function WatchPage() {
  const { id } = useParams()
  const [question, setQuestion] = useState<QuestionDetail | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [askBusy, setAskBusy] = useState(false)
  const [newLink, setNewLink] = useState('')
  const [celebrated, setCelebrated] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'suspense' | 'ready'>('idle')

  const questionUrl = useMemo(() => {
    if (!id) return ''
    return getQuestionUrl(id)
  }, [id])

  const load = async () => {
    if (!id) return
    try {
      const data = await getQuestion(id)
      setQuestion(data)
      setLabelDraft(data.label || '')
      setError('')
    } catch {
      setError('このリンクは見つかりませんでした。')
    }
  }

  useEffect(() => {
    setCelebrated(false)
    setPhase('idle')
    setNewLink('')
    setError('')
  }, [id])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [id])

  useEffect(() => {
    if (!question) return
    if (question.answeredCount === 0) {
      setPhase('idle')
      return
    }
    if (celebrated) {
      setPhase('ready')
      return
    }

    setPhase('suspense')
    vibrate([20, 60, 20])
    const timer = window.setTimeout(() => {
      setCelebrated(true)
      setPhase('ready')
      if (question.yesCount >= question.noCount) {
        playSuccess()
        vibrate([40, 50, 40])
      } else {
        playSad()
        vibrate([80, 40, 80])
      }
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [question?.id, question?.answeredCount, celebrated])

  const saveLabel = () => {
    if (!id) return
    updateHistoryLabel(id, labelDraft)
    setQuestion((q) => (q ? { ...q, label: labelDraft.trim().slice(0, 40) } : q))
  }

  const handleCopyLink = async () => {
    const ok = await copyText(questionUrl)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const handleAskAgain = async () => {
    if (!question || askBusy) return
    setAskBusy(true)
    try {
      const base = question.label?.trim() || '再質問'
      const label = base.includes('再') ? base : `${base}（もう一度）`
      const created = await createQuestion(label, question.firstPerson || '俺')
      const link = getQuestionUrl(created.id)
      setNewLink(link)
      await copyText(link)
    } catch {
      setError('新しい質問の作成に失敗しました')
    } finally {
      setAskBusy(false)
    }
  }

  if (error && !question) {
    return (
      <main className="page watch">
        <p className="status-msg">{error}</p>
        <Link className="back-link" to="/history">
          送信履歴へ
        </Link>
      </main>
    )
  }

  const showResults = phase === 'ready' && (question?.answeredCount ?? 0) > 0
  const inSuspense = phase === 'suspense'
  const majority: 'yes' | 'no' | null = question
    ? question.answeredCount === 0
      ? null
      : question.yesCount >= question.noCount
        ? 'yes'
        : 'no'
    : null

  return (
    <main className="page watch">
      <Celebration mode={showResults && majority === 'yes' ? 'yes' : null} />
      <div className="atmosphere" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
      </div>

      <section className="watch-stage">
        <p className="brand">
          {questionTitle(question?.firstPerson || '俺')}
        </p>
        <h1 className="watch-title">
          {showResults ? '回答が集まっています' : 'リンクを送って待とう'}
        </h1>
        <p className="watch-copy">
          同じリンクを複数人に送れます。回答は上書きされず、それぞれ別々に集計されます。
        </p>

        <div className="label-edit">
          <label htmlFor="q-label">相手向けラベル（任意）</label>
          <div className="url-row">
            <input
              id="q-label"
              value={labelDraft}
              placeholder="例: Aさん宛"
              maxLength={40}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
            />
            <button type="button" onClick={saveLabel}>
              保存
            </button>
          </div>
        </div>

        {question && (
          <div className="status-chip status-answered">
            <span className="status-dot" />
            {questionStatusLabel(question)}
            {question.answeredCount > 0
              ? ` · ${question.answeredCount}件`
              : ''}
          </div>
        )}

        <div className="answer-panel" aria-live="polite">
          {inSuspense ? (
            <div className="suspense">
              <div className="suspense-dots">
                <span />
                <span />
                <span />
              </div>
              <p>集計してる…</p>
            </div>
          ) : showResults && question ? (
            <div className="aggregate">
              <div className="aggregate-summary">
                <div className="agg-pill is-yes">
                  <span>YES</span>
                  <strong>{question.yesCount}</strong>
                </div>
                <div className="agg-pill is-no">
                  <span>NO</span>
                  <strong>{question.noCount}</strong>
                </div>
              </div>
              <p className="agg-total">回答者 {question.answeredCount} 人</p>

              <ul className="response-list">
                {question.responses
                  .filter((r) => r.status === 'answered')
                  .map((r) => (
                    <li key={r.id}>
                      <div className="response-row">
                        <span className="response-who">{r.label}</span>
                        <strong
                          className={
                            r.answer === 'yes' ? 'ans-yes' : 'ans-no'
                          }
                        >
                          {r.answer === 'yes' ? 'YES' : 'NO'}
                        </strong>
                      </div>
                      <div className="response-meta">
                        {r.answeredAt && (
                          <time dateTime={r.answeredAt}>
                            {new Date(r.answeredAt).toLocaleString('ja-JP')}
                          </time>
                        )}
                        <span>{formatSpeedLabel(r.responseMs)}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="waiting">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <p>まだ回答なし…リンクを送ってみよう</p>
            </div>
          )}
        </div>

        {showResults && majority && id && (
          <SharePanel
            answer={majority}
            questionId={id}
            firstPerson={question?.firstPerson || '俺'}
          />
        )}

        <div className="share-block">
          <label htmlFor="question-url">相手に送るリンク（人数制限なし）</label>
          <div className="url-row">
            <input id="question-url" readOnly value={questionUrl} />
            <button type="button" onClick={handleCopyLink}>
              {copied ? 'コピー済み' : 'コピー'}
            </button>
          </div>
        </div>

        <div className="ask-again">
          <button
            type="button"
            className="ask-again-btn"
            onClick={handleAskAgain}
            disabled={askBusy}
          >
            {askBusy ? '作成中…' : 'もう一度聞いてみる'}
          </button>
          <p className="ask-again-note">
            新しい質問リンクが作られます（今の集計はそのまま残ります）
          </p>
          {newLink && (
            <div className="new-link-box">
              <p>新しいリンクをコピーしました</p>
              <div className="url-row">
                <input readOnly value={newLink} />
                <button
                  type="button"
                  onClick={() => void copyText(newLink)}
                >
                  再コピー
                </button>
              </div>
              <Link to={`/watch/${newLink.split('/').pop()}`}>
                新しい確認ページを開く
              </Link>
            </div>
          )}
        </div>

        <div className="watch-nav">
          <Link to="/history">送信履歴</Link>
          <Link to="/">新しくつくる</Link>
        </div>
      </section>
    </main>
  )
}
