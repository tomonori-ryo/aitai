import { useCallback, useEffect, useRef, useState } from 'react'
import './RunawayButton.css'

type Props = {
  label: string
  /** 逃げた／触れようとした回数（念押し演出用） */
  onAttempt: () => void
  /** NOに触れた／近づいた検知（からかい演出用・データには影響しない） */
  onContact?: () => void
  /** true のとき逃げにくくなり、クリックで確定できる */
  catchable?: boolean
  onCaught?: () => void
  /** 押そうとしたときに稀に捕まる確率（0〜1） */
  luckyRate?: number
}

const FLEE_COOLDOWN_MS = 120
const SCARE_RADIUS = 88
/** タッチ時の当たり判定をボタン外周へ広げる量(px) */
const TOUCH_HIT_PAD = 28
const DEFAULT_LUCKY_CATCH_RATE = 0.1

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  // スマホ／タブレット向け。PCのタッチ対応トラックパッドは除外する
  return window.matchMedia('(pointer: coarse)').matches
}

export function RunawayButton({
  label,
  onAttempt,
  onContact,
  catchable = false,
  onCaught,
  luckyRate = DEFAULT_LUCKY_CATCH_RATE,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastFlee = useRef(0)
  const caughtRef = useRef(false)
  const touchModeRef = useRef(isTouchDevice())
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [taunt, setTaunt] = useState('')
  const [lucky, setLucky] = useState(false)

  const flee = useCallback(
    (clientX?: number, clientY?: number) => {
      if (caughtRef.current) return
      const now = performance.now()
      if (now - lastFlee.current < FLEE_COOLDOWN_MS) return
      lastFlee.current = now

      const btn = ref.current
      const wrap = wrapRef.current
      if (!btn || !wrap) return

      const btnRect = btn.getBoundingClientRect()
      const bounds = wrap.getBoundingClientRect()
      const pad = 6
      const maxX = Math.max(pad, bounds.width - btnRect.width - pad)
      const maxY = Math.max(pad, bounds.height - btnRect.height - pad)

      let nextX: number
      let nextY: number

      if (clientX != null && clientY != null) {
        const relX = clientX - bounds.left
        const relY = clientY - bounds.top
        const awayRight = relX < bounds.width / 2
        const awayDown = relY < bounds.height / 2
        nextX = awayRight
          ? maxX * (0.55 + Math.random() * 0.4)
          : maxX * Math.random() * 0.4
        nextY = awayDown
          ? maxY * (0.55 + Math.random() * 0.4)
          : maxY * Math.random() * 0.4

        const cx = nextX + btnRect.width / 2
        const cy = nextY + btnRect.height / 2
        const dx = cx - relX
        const dy = cy - relY
        if (dx * dx + dy * dy < SCARE_RADIUS * SCARE_RADIUS) {
          nextX = Math.min(maxX, Math.max(pad, maxX - nextX))
          nextY = Math.min(maxY, Math.max(pad, maxY - nextY))
        }
      } else {
        nextX = Math.random() * maxX
        nextY = Math.random() * maxY
      }

      setPos({ x: nextX, y: nextY })

      const lines = ['え？無理〜', '捕まんないよ', 'いやだいやだ', 'こっち来ないで', 'YES一択でしょ']
      setTaunt(lines[Math.floor(Math.random() * lines.length)])
    },
    [],
  )

  const tryLuckyCatch = useCallback(() => {
    if (caughtRef.current || catchable) return false
    const rate = Math.min(1, Math.max(0, luckyRate))
    if (Math.random() >= rate) return false
    caughtRef.current = true
    setLucky(true)
    setTaunt('あれ…捕まった？')
    window.setTimeout(() => onCaught?.(), 280)
    return true
  }, [catchable, luckyRate, onCaught])

  const isNearButton = useCallback(
    (clientX: number, clientY: number, pad = 0) => {
      const btn = ref.current
      if (!btn) return false
      const rect = btn.getBoundingClientRect()
      return (
        clientX >= rect.left - pad &&
        clientX <= rect.right + pad &&
        clientY >= rect.top - pad &&
        clientY <= rect.bottom + pad
      )
    },
    [],
  )

  /** 既存の「押そうとして逃げた」処理（回数消費・稀キャッチ含む） */
  const triggerFleeFromPress = useCallback(
    (clientX: number, clientY: number) => {
      if (caughtRef.current || catchable) return
      onContact?.()
      if (tryLuckyCatch()) return
      onAttempt()
      flee(clientX, clientY)
    },
    [catchable, flee, onAttempt, onContact, tryLuckyCatch],
  )

  useEffect(() => {
    const place = () => {
      const btn = ref.current
      const wrap = wrapRef.current
      if (!btn || !wrap) return
      const btnRect = btn.getBoundingClientRect()
      const bounds = wrap.getBoundingClientRect()
      setPos({
        x: Math.max(0, (bounds.width - btnRect.width) / 2),
        y: Math.max(
          0,
          Math.min(bounds.height - btnRect.height - 8, bounds.height * 0.35),
        ),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('orientationchange', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('orientationchange', place)
    }
  }, [])

  // PC: マウス接近・押下で逃げる（従来どおり）
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || catchable || lucky || touchModeRef.current) return

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (caughtRef.current) return
      if (!isNearButton(e.clientX, e.clientY, SCARE_RADIUS * 0.35)) return
      e.preventDefault()
      onContact?.()
      flee(e.clientX, e.clientY)
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (caughtRef.current) return
      if (!isNearButton(e.clientX, e.clientY, SCARE_RADIUS * 0.35)) return
      e.preventDefault()
      triggerFleeFromPress(e.clientX, e.clientY)
    }

    wrap.addEventListener('pointerdown', onDown, { passive: false })
    wrap.addEventListener('pointermove', onMove, { passive: false })
    return () => {
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('pointermove', onMove)
    }
  }, [
    flee,
    isNearButton,
    catchable,
    lucky,
    onContact,
    triggerFleeFromPress,
  ])

  // タッチ: touchstart の瞬間に逃げる（タップ確定前）
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || catchable || lucky || !touchModeRef.current) return

    const onTouchStart = (e: TouchEvent) => {
      if (caughtRef.current) return
      const touch = e.touches[0]
      if (!touch) return
      if (!isNearButton(touch.clientX, touch.clientY, TOUCH_HIT_PAD)) return
      e.preventDefault()
      triggerFleeFromPress(touch.clientX, touch.clientY)
    }

    wrap.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart)
    }
  }, [catchable, lucky, isNearButton, triggerFleeFromPress])

  const handleButtonPointer = (e: React.PointerEvent) => {
    if (catchable || caughtRef.current) return
    if (touchModeRef.current || e.pointerType === 'touch') return
    e.preventDefault()
    e.stopPropagation()
    triggerFleeFromPress(e.clientX, e.clientY)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (catchable) {
      onCaught?.()
      return
    }
    if (caughtRef.current) return
    if (touchModeRef.current) return
    triggerFleeFromPress(e.clientX, e.clientY)
  }

  return (
    <div
      className={`runaway-wrap ${catchable || lucky ? 'is-catchable' : ''}`}
      ref={wrapRef}
    >
      {taunt && pos && !catchable && (
        <span
          className="runaway-taunt"
          style={{
            left: Math.min(
              (wrapRef.current?.clientWidth ?? 200) - 96,
              Math.max(8, pos.x + 12),
            ),
            top: Math.max(4, pos.y - 26),
          }}
        >
          {taunt}
        </span>
      )}
      <button
        ref={ref}
        type="button"
        className={`runaway-btn ${catchable || lucky ? 'is-catchable' : ''} ${
          lucky ? 'is-lucky' : ''
        }`}
        style={
          catchable || lucky
            ? undefined
            : pos
              ? { left: pos.x, top: pos.y }
              : { left: '50%', top: '55%', transform: 'translateX(-50%)' }
        }
        onPointerEnter={(e) => {
          if (catchable || caughtRef.current) return
          if (touchModeRef.current || e.pointerType === 'touch') return
          e.preventDefault()
          onContact?.()
          flee(e.clientX, e.clientY)
        }}
        onPointerDown={handleButtonPointer}
        onFocus={(e) => {
          if (catchable || caughtRef.current) return
          if (touchModeRef.current) return
          e.target.blur()
          onContact?.()
          flee()
        }}
        onClick={handleClick}
        aria-label={label}
      >
        {lucky ? '捕まった…' : label}
      </button>
    </div>
  )
}
