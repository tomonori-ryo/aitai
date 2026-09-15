import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  claimResponse,
  getQuestion,
  markResponseViewed,
  submitResponseAnswer,
} from '../api'
import { Celebration } from '../components/Celebration'
import { NoPleadPanel } from '../components/NoPleadPanel'
import { RunawayButton } from '../components/RunawayButton'
import { SharePanel } from '../components/SharePanel'
import { ViralCta } from '../components/ViralCta'
import type { ResponseRecord } from '../types'
import {
  DEFAULT_FIRST_PERSON,
  questionTitle,
} from '../utils/firstPerson'
import {
  getStoredResponseId,
  setStoredResponseId,
} from '../utils/history'
import {
  FINAL_NO_STAGE,
  buildNoPlead,
  pickAcceptLine,
  yesVisualScale,
  type NoPleadContent,
} from '../utils/noPlead'
import { playChime, playSad, playSuccess, vibrate } from '../utils/sound'
import { buildYesTease, type YesTease } from '../utils/yesTease'
import './QuestionPage.css'

type Props = {
  demo?: boolean
}

const PROMPTS = [
  '正直に答えてください。',
  'え、待って…？',
  'お願い、考え直して…',
  'ほんとにNOでいいの…？',
  'YESの方が…ちょうどよくない？',
  'お願いします…お願いします…',
  '最後の確認だよ…',
]

export function QuestionPage({ demo = false }: Props) {
  const { id: questionId } = useParams()
  const [response, setResponse] = useState<ResponseRecord | null>(null)
  const [firstPerson, setFirstPerson] = useState(DEFAULT_FIRST_PERSON)
  const [loading, setLoading] = useState(!demo)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [finalAnswer, setFinalAnswer] = useState<'yes' | 'no'>('yes')
  const [submitting, setSubmitting] = useState(false)
  const [fleeCount, setFleeCount] = useState(0)
  const [catchable, setCatchable] = useState(false)
  const [noStage, setNoStage] = useState(0)
  const [pleadOpen, setPleadOpen] = useState(false)
  const [plead, setPlead] = useState<NoPleadContent | null>(null)
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null)
  const [acceptLine, setAcceptLine] = useState('')
  const [tease, setTease] = useState<YesTease | null>(null)
  const [fakeNoMsg, setFakeNoMsg] = useState('')

  const shownAtRef = useRef<number | null>(null)
  const touchedNoRef = useRef(false)
  const countdownTimerRef = useRef<number | null>(null)

  const yesScale = useMemo(() => {
    if (noStage >= 4) return yesVisualScale(noStage)
    return Math.min(2.6, 1 + fleeCount * 0.28)
  }, [fleeCount, noStage])

  const prompt =
    PROMPTS[Math.min(Math.max(noStage, fleeCount > 0 ? 1 : 0), PROMPTS.length - 1)] ??
    PROMPTS[0]
  const title = questionTitle(firstPerson)

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current != null) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setCountdownLeft(null)
  }, [])

  useEffect(() => {
    return () => clearCountdown()
  }, [clearCountdown])

  useEffect(() => {
    if (demo) {
      shownAtRef.current = performance.now()
      setLoading(false)
      return
    }
    if (!questionId) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const [question, claimed] = await Promise.all([
          getQuestion(questionId),
          claimResponse(questionId, getStoredResponseId(questionId)),
        ])
        if (cancelled) return
        setFirstPerson(question.firstPerson || DEFAULT_FIRST_PERSON)
        setStoredResponseId(questionId, claimed.id)
        setResponse(claimed)

        if (claimed.status === 'answered') {
          setDone(true)
          setFinalAnswer(claimed.answer === 'no' ? 'no' : 'yes')
          if (claimed.answer === 'yes') {
            setTease(
              buildYesTease({
                elapsedMs: claimed.responseMs ?? 5000,
                touchedNo: false,
              }),
            )
          }
        } else {
          const viewed = await markResponseViewed(questionId, claimed.id)
          if (!cancelled) {
            setResponse(viewed)
            shownAtRef.current = performance.now()
          }
        }
      } catch {
        if (!cancelled) setError('このリンクは見つかりませんでした。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [demo, questionId])

  const applyYesTease = useCallback((elapsedMs: number) => {
    setTease(
      buildYesTease({
        elapsedMs,
        touchedNo: touchedNoRef.current || fleeCount > 0 || noStage > 0,
      }),
    )
    setFakeNoMsg('')
  }, [fleeCount, noStage])

  const sendAnswer = useCallback(
    async (answer: 'yes' | 'no', presses = Math.max(fleeCount, noStage)) => {
      if (submitting) return

      const elapsed =
        shownAtRef.current != null
          ? performance.now() - shownAtRef.current
          : 5000

      clearCountdown()
      setPleadOpen(false)

      if (demo) {
        setFinalAnswer(answer)
        setDone(true)
        if (answer === 'yes') {
          applyYesTease(elapsed)
          playSuccess()
          vibrate([30, 40, 30])
        } else {
          playSad()
          vibrate([80, 40, 80])
        }
        return
      }
      if (!questionId || !response) return
      setSubmitting(true)
      try {
        const data = await submitResponseAnswer(
          questionId,
          response.id,
          answer,
          presses,
        )
        setResponse(data)
        setFinalAnswer(answer)
        setDone(true)
        if (answer === 'yes') {
          applyYesTease(elapsed)
          playSuccess()
          vibrate([30, 40, 30])
        } else {
          playSad()
          vibrate([80, 40, 80])
        }
      } catch {
        setError('送信に失敗しました。もう一度押してみてね。')
      } finally {
        setSubmitting(false)
      }
    },
    [
      demo,
      questionId,
      fleeCount,
      noStage,
      response,
      submitting,
      applyYesTease,
      clearCountdown,
    ],
  )

  const startCountdown = useCallback((seconds: number) => {
    clearCountdown()
    setCountdownLeft(seconds)
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownLeft((prev) => {
        if (prev == null) return null
        if (prev <= 1) {
          if (countdownTimerRef.current != null) {
            window.clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearCountdown])

  const openStage = useCallback(
    (stage: number) => {
      const content = buildNoPlead(stage)
      if (!content) return
      setNoStage(stage)
      setPlead(content)
      setPleadOpen(true)
      vibrate(22)
      if (content.countdownSec) {
        startCountdown(content.countdownSec)
      } else {
        clearCountdown()
      }
    },
    [clearCountdown, startCountdown],
  )

  const confirmNoFinally = useCallback(() => {
    const line = pickAcceptLine()
    setAcceptLine(line)
    setPleadOpen(false)
    clearCountdown()
    vibrate([40, 30, 40])
    window.setTimeout(() => {
      void sendAnswer('no', Math.max(noStage, FINAL_NO_STAGE))
    }, 700)
  }, [clearCountdown, noStage, sendAnswer])

  const advanceNo = useCallback(() => {
    if (submitting || acceptLine) return
    touchedNoRef.current = true

    const next = noStage + 1
    if (next >= FINAL_NO_STAGE) {
      setNoStage(FINAL_NO_STAGE)
      confirmNoFinally()
      return
    }
    openStage(next)
  }, [acceptLine, confirmNoFinally, noStage, openStage, submitting])

  const handleFleeAttempt = useCallback(() => {
    touchedNoRef.current = true
    setFleeCount((n) => {
      vibrate(25)
      return n + 1
    })
  }, [])

  const handleFleeContact = useCallback(() => {
    touchedNoRef.current = true
  }, [])

  /** 約1%の稀キャッチ → 懇願演出へ接続（3回で止めない） */
  const handleFleeCaught = useCallback(() => {
    touchedNoRef.current = true
    setCatchable(true)
    if (noStage <= 0) {
      openStage(1)
      return
    }
    advanceNo()
  }, [advanceNo, noStage, openStage])

  const handleYes = () => {
    if (submitting || acceptLine) return
    playChime()
    clearCountdown()
    setPleadOpen(false)
    void sendAnswer('yes')
  }

  const handleSoft = () => {
    if (!plead || submitting) return
    if (plead.softAction === 'yes') {
      handleYes()
      return
    }
    // pause: パネルを閉じて未回答のまま戻す（段階は維持）
    clearCountdown()
    setPleadOpen(false)
  }

  if (loading) {
    return (
      <main className="page question">
        <p className="status-msg">読み込み中…</p>
      </main>
    )
  }

  if (error && !response && !demo) {
    return (
      <main className="page question">
        <p className="status-msg">{error}</p>
        <Link className="back-link" to="/">
          トップへ
        </Link>
      </main>
    )
  }

  if (done) {
    const yes = finalAnswer === 'yes'

    return (
      <main className={`page question ${yes ? '' : 'is-sad'}`}>
        <Celebration mode={yes ? 'yes' : null} />
        <div className="atmosphere" aria-hidden="true">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
        </div>
        <section className="question-stage result-stage">
          <p className="brand">{title}</p>
          <p className="thanks-label">回答ありがとうございました</p>
          <h1
            className={`result-title ${yes ? '' : 'is-no'} ${
              yes && tease ? 'is-tease' : ''
            }`}
          >
            {yes ? tease?.headline || 'YES！' : 'NO…'}
          </h1>
          <p className="result-copy">
            {demo
              ? 'デモなので送信はしていません。本番はリンク作成からどうぞ。'
              : yes
                ? '気持ち、ちゃんと届いたよ。相手にも通知されます。'
                : 'わかった…気持ちは届いたよ。'}
          </p>

          {yes && tease?.showFakeNo && (
            <div className="fake-no">
              {fakeNoMsg ? (
                <p className="fake-no-reply">{fakeNoMsg}</p>
              ) : (
                <button
                  type="button"
                  className="fake-no-btn"
                  onClick={() => setFakeNoMsg(tease.fakeNoReply)}
                >
                  やっぱりNOにする？
                </button>
              )}
            </div>
          )}

          <p className="result-policy">※ 同じ端末では二重回答できません</p>

          {!demo && questionId && response && (
            <SharePanel
              answer={finalAnswer}
              questionId={questionId}
              responseId={response.id}
              firstPerson={firstPerson}
              compact
            />
          )}

          {demo ? (
            <Link className="btn-primary inline" to="/">
              本物のリンクをつくる
            </Link>
          ) : (
            <ViralCta delayMs={1800} />
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="page question">
      <div className="atmosphere" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="heart heart-1">♡</span>
        <span className="heart heart-2">♡</span>
      </div>

      <section className="question-stage">
        <p className="brand pulse">{title}</p>
        <p className={`prompt ${fleeCount > 0 || noStage > 0 ? 'is-pressing' : ''}`}>
          {prompt}
        </p>

        {acceptLine ? (
          <p className="no-accept">{acceptLine}</p>
        ) : (
          <>
            <div className={`answer-area ${pleadOpen ? 'is-pleading' : ''}`}>
              <div className="yes-slot">
                <button
                  type="button"
                  className="yes-btn"
                  style={{ transform: `scale(${yesScale})` }}
                  onClick={handleYes}
                  disabled={submitting}
                >
                  {submitting ? '送信中…' : 'はい'}
                </button>
              </div>

              {!pleadOpen && (
                <RunawayButton
                  label="いいえ"
                  onAttempt={handleFleeAttempt}
                  onContact={handleFleeContact}
                  catchable={catchable}
                  onCaught={handleFleeCaught}
                  luckyRate={0.01}
                />
              )}

              {pleadOpen && plead && (
                <NoPleadPanel
                  content={plead}
                  countdownLeft={countdownLeft}
                  busy={submitting}
                  onPersistNo={advanceNo}
                  onSoft={handleSoft}
                />
              )}
            </div>

            {fleeCount > 0 && !pleadOpen && !catchable && (
              <p className="no-hint">NOチャレンジ {fleeCount}回目（稀に捕まる）</p>
            )}
            {noStage > 0 && !pleadOpen && (
              <p className="no-hint">
                懇願レベル {noStage}/{FINAL_NO_STAGE - 1}
              </p>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}
        {demo && (
          <p className="demo-note">
            ※ デモ：NOはだいたい100回に1回捕まり、その後懇願に入ります（保存なし）
          </p>
        )}
      </section>
    </main>
  )
}
