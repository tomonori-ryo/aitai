import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_FIRST_PERSON,
  FIRST_PERSON_PRESETS,
  questionTitle,
  sanitizeFirstPerson,
} from '../utils/firstPerson'
import { startCreateInviteFlow } from '../utils/share'
import './HomePage.css'

const FP_STORAGE_KEY = 'aitai-first-person'

export function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')
  const [firstPerson, setFirstPerson] = useState(DEFAULT_FIRST_PERSON)
  const [customPerson, setCustomPerson] = useState('')
  const autoCreateStarted = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FP_STORAGE_KEY)
      if (saved) {
        const cleaned = sanitizeFirstPerson(saved)
        setFirstPerson(cleaned)
        if (!(FIRST_PERSON_PRESETS as readonly string[]).includes(cleaned)) {
          setCustomPerson(cleaned)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const resolvedPerson = sanitizeFirstPerson(
    customPerson.trim() ? customPerson : firstPerson,
  )

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      localStorage.setItem(FP_STORAGE_KEY, resolvedPerson)
      await startCreateInviteFlow(navigate, label, resolvedPerson)
    } catch {
      setError('作成に失敗しました。もう一度試してください。')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    if (autoCreateStarted.current) return
    autoCreateStarted.current = true
    setLoading(true)
    let person = DEFAULT_FIRST_PERSON
    try {
      person = sanitizeFirstPerson(
        localStorage.getItem(FP_STORAGE_KEY) || DEFAULT_FIRST_PERSON,
      )
    } catch {
      // ignore
    }
    void startCreateInviteFlow(navigate, '', person).catch(() => {
      setError('作成に失敗しました。もう一度試してください。')
      setLoading(false)
      autoCreateStarted.current = false
    })
  }, [searchParams, navigate])

  return (
    <main className="page home">
      <div className="atmosphere" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="heart heart-1">♡</span>
        <span className="heart heart-2">♡</span>
        <span className="heart heart-3">♡</span>
      </div>

      <div className="home-shell">
        <section className="hero">
          <p className="brand">{questionTitle(resolvedPerson)}</p>
          <h1 className="headline">Yes / No で答えさせる、ちょっとズルい質問。</h1>
          <p className="lede">
            同じリンクを複数人に送れます。「いいえ」は逃げ回って押せません。何度でも作れます。
          </p>

          <div className="create-field">
            <span className="field-label">一人称</span>
            <div className="person-chips" role="group" aria-label="一人称を選ぶ">
              {FIRST_PERSON_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`person-chip ${
                    !customPerson.trim() && firstPerson === p ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setFirstPerson(p)
                    setCustomPerson('')
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className="person-custom"
              value={customPerson}
              maxLength={10}
              placeholder="自由入力（例: オレ、うちら）"
              onChange={(e) => setCustomPerson(e.target.value)}
              aria-label="一人称を自由入力"
            />
            <p className="person-preview">プレビュー: {questionTitle(resolvedPerson)}</p>
          </div>

          <div className="create-field">
            <label className="field-label" htmlFor="home-label">
              相手向けラベル（任意）
            </label>
            <input
              id="home-label"
              value={label}
              maxLength={40}
              placeholder="例: Aさん宛"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="cta-row">
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'つくってる…' : '質問リンクをつくる'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        <footer className="home-foot">
          <Link to="/history">送信履歴</Link>
          <Link to="/demo">とりあえず試す</Link>
        </footer>
      </div>
    </main>
  )
}
