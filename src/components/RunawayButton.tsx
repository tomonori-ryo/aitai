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

const FLEE_COOLDOWN_MS = 90
const TOUCH_FLEE_COOLDOWN_MS = 55
const SCARE_RADIUS = 96
/** タッチ接近で逃げる半径（見た目よりかなり広め） */
const TOUCH_SCARE_RADIUS = 140
/** タッチ押下の当たり判定パディング */
const TOUCH_HIT_PAD = 64
const DEFAULT_LUCKY_CATCH_RATE = 0.1

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
  /** touchstart 直後の pointer/click 二重発火を抑止 */
  const lastTouchFleeAt = useRef(0)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [taunt, setTaunt] = useState('')
  const [lucky, setLucky] = useState(false)

  const flee = useCallback(
    (clientX?: number, clientY?: number, touch = false) => {
      if (caughtRef.current) return
      const now = performance.now()
      const cooldown = touch ? TOUCH_FLEE_COOLDOWN_MS : FLEE_COOLDOWN_MS
      if (now - lastFlee.current < cooldown) return
      lastFlee.current = now

      const btn = ref.current
      const wrap = wrapRef.current
      if (!btn || !wrap) return

      const btnRect = btn.getBoundingClientRect()
      const bounds = wrap.getBoundingClientRect()
      const pad = 4
      const maxX = Math.max(pad, bounds.width - btnRect.width - pad)
      const maxY = Math.max(pad, bounds.height - btnRect.height - pad)

      let nextX: number
      let nextY: number

      if (clientX != null && clientY != null) {
        const relX = clientX - bounds.left
        const relY = clientY - bounds.top
        const btnW = btnRect.width
        const btnH = btnRect.height

        // 指から遠い四隅・辺を候補にして、いちばん離れた位置へ飛ばす
        const candidates = [
          { x: pad, y: pad },
          { x: maxX, y: pad },
          { x: pad, y: maxY },
          { x: maxX, y: maxY },
          { x: pad, y: maxY * 0.45 },
          { x: maxX, y: maxY * 0.45 },
          { x: maxX * 0.5, y: pad },
          { x: maxX * 0.5, y: maxY },
        ]

        let best = candidates[0]!
        let bestDist = -1
        for (const c of candidates) {
          const cx = c.x + btnW / 2
          const cy = c.y + btnH / 2
          const dx = cx - relX
          const dy = cy - relY
          const dist = dx * dx + dy * dy
          if (dist > bestDist) {
            bestDist = dist
            best = c
          }
        }

        // わずかに揺らして毎回同じ角に固定されないようにする
        const jitter = touch ? 0.18 : 0.12
        nextX = Math.min(
          maxX,
          Math.max(pad, best.x + (Math.random() - 0.5) * maxX * jitter),
        )
        nextY = Math.min(
          maxY,
          Math.max(pad, best.y + (Math.random() - 0.5) * maxY * jitter),
        )

        const minDist = touch ? TOUCH_SCARE_RADIUS : SCARE_RADIUS
        const cx = nextX + btnW / 2
        const cy = nextY + btnH / 2
        const dx = cx - relX
        const dy = cy - relY
        if (dx * dx + dy * dy < minDist * minDist) {
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

  const isWithinScareRadius = useCallback(
    (clientX: number, clientY: number, radius: number) => {
      const btn = ref.current
      if (!btn) return false
      const rect = btn.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = clientX - cx
      const dy = clientY - cy
      return dx * dx + dy * dy < radius * radius
    },
    [],
  )

  /** 押下扱いで逃げる（回数消費・稀キャッチ） */
  const triggerFleeFromPress = useCallback(
    (clientX: number, clientY: number, touch = false) => {
      if (caughtRef.current || catchable) return
      onContact?.()
      if (tryLuckyCatch()) return
      onAttempt()
      flee(clientX, clientY, touch)
    },
    [catchable, flee, onAttempt, onContact, tryLuckyCatch],
  )

  /** 接近だけで逃げる（回数は消費しない） */
  const triggerFleeProximity = useCallback(
    (clientX: number, clientY: number, touch = false) => {
      if (caughtRef.current || catchable) return
      onContact?.()
      flee(clientX, clientY, touch)
    },
    [catchable, flee, onContact],
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
          Math.min(bounds.height - btnRect.height - 8, bounds.height * 0.4),
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

  // マウス: hover / 押下で逃げる
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || catchable || lucky) return

    const recentlyTouched = () =>
      performance.now() - lastTouchFleeAt.current < 700

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || recentlyTouched()) return
      if (caughtRef.current) return
      if (!isWithinScareRadius(e.clientX, e.clientY, SCARE_RADIUS)) return
      e.preventDefault()
      triggerFleeProximity(e.clientX, e.clientY, false)
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || recentlyTouched()) return
      if (caughtRef.current) return
      if (!isNearButton(e.clientX, e.clientY, 24)) return
      e.preventDefault()
      triggerFleeFromPress(e.clientX, e.clientY, false)
    }

    wrap.addEventListener('pointerdown', onDown, { passive: false })
    wrap.addEventListener('pointermove', onMove, { passive: false })
    return () => {
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('pointermove', onMove)
    }
  }, [
    catchable,
    lucky,
    isNearButton,
    isWithinScareRadius,
    triggerFleeFromPress,
    triggerFleeProximity,
  ])

  // タッチ: 広い範囲で touchstart / touchmove の瞬間に逃げる
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || catchable || lucky) return

    const onTouchStart = (e: TouchEvent) => {
      if (caughtRef.current) return
      const touch = e.touches[0]
      if (!touch) return
      const near =
        isNearButton(touch.clientX, touch.clientY, TOUCH_HIT_PAD) ||
        isWithinScareRadius(touch.clientX, touch.clientY, TOUCH_SCARE_RADIUS)
      if (!near) return
      e.preventDefault()
      e.stopPropagation()
      lastTouchFleeAt.current = performance.now()
      triggerFleeFromPress(touch.clientX, touch.clientY, true)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (caughtRef.current) return
      const touch = e.touches[0]
      if (!touch) return
      if (!isWithinScareRadius(touch.clientX, touch.clientY, TOUCH_SCARE_RADIUS)) {
        return
      }
      e.preventDefault()
      lastTouchFleeAt.current = performance.now()
      // 指を追って近づいたら回数消費なしで逃げる（ホバー相当）
      triggerFleeProximity(touch.clientX, touch.clientY, true)
    }

    wrap.addEventListener('touchstart', onTouchStart, {
      passive: false,
      capture: true,
    })
    wrap.addEventListener('touchmove', onTouchMove, {
      passive: false,
      capture: true,
    })
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart, true)
      wrap.removeEventListener('touchmove', onTouchMove, true)
    }
  }, [
    catchable,
    lucky,
    isNearButton,
    isWithinScareRadius,
    triggerFleeFromPress,
    triggerFleeProximity,
  ])

  const handleButtonPointer = (e: React.PointerEvent) => {
    if (catchable || caughtRef.current) return
    if (e.pointerType === 'touch') return
    if (performance.now() - lastTouchFleeAt.current < 700) return
    e.preventDefault()
    e.stopPropagation()
    triggerFleeFromPress(e.clientX, e.clientY, false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (catchable) {
      onCaught?.()
      return
    }
    if (caughtRef.current) return
    if (performance.now() - lastTouchFleeAt.current < 700) return
    triggerFleeFromPress(e.clientX, e.clientY, false)
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
          if (e.pointerType === 'touch') return
          if (performance.now() - lastTouchFleeAt.current < 700) return
          e.preventDefault()
          triggerFleeProximity(e.clientX, e.clientY, false)
        }}
        onPointerDown={handleButtonPointer}
        onFocus={(e) => {
          if (catchable || caughtRef.current) return
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
