import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startCreateInviteFlow } from '../utils/share'
import './ViralCta.css'

type Props = {
  /** 表示開始までの遅延 ms */
  delayMs?: number
}

export function ViralCta({ delayMs = 1600 }: Props) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      await startCreateInviteFlow(navigate)
    } catch {
      setError('作成に失敗しました')
      setLoading(false)
    }
  }

  return (
    <aside
      className={`viral-cta ${visible ? 'is-visible' : ''}`}
      aria-hidden={!visible}
    >
      <p className="viral-cta-heading">あなたも気になる人に聞いてみる？</p>
      <button
        type="button"
        className="viral-cta-btn"
        onClick={handleCreate}
        disabled={loading || !visible}
      >
        {loading ? 'つくってる…' : '質問をつくってみる'}
      </button>
      {error && <p className="viral-cta-error">{error}</p>}
    </aside>
  )
}
