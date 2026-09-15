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
const DEFAULT_LUCKY_CATCH_RATE = 0.01

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
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
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
      const btnW = btnRect.width
      const btnH = btnRect.height
      const minAway = touch ? TOUCH_SCARE_RADIUS * 0.85 : SCARE_RADIUS * 0.75

      const relX =
        clientX != null ? clientX - bounds.left : bounds.width / 2
      const relY =
        clientY != null ? clientY - bounds.top : bounds.height / 2
      const prev = lastPosRef.current

      // エリア全体にばらまいた候補から、指・直前位置から遠いものをランダム採用
      const candidates: { x: number; y: number; score: number }[] = []
      const sampleCount = 28
      for (let i = 0; i < sampleCount; i++) {
        const x = pad + Math.random() * Math.max(0, maxX - pad)
        const y = pad + Math.random() * Math.max(0, maxY - pad)
        const cx = x + btnW / 2
        const cy = y + btnH / 2
        const dxFinger = cx - relX
        const dyFinger = cy - relY
        const distFinger = Math.hypot(dxFinger, dyFinger)
        if (distFinger < minAway) continue

        let distPrev = 180
        if (prev) {
          distPrev = Math.hypot(x - prev.x, y - prev.y)
          if (distPrev < 48) continue
        }

        // 遠さ優先＋少しランダム性
        const score = distFinger * 1.15 + distPrev * 0.85 + Math.random() * 40
        candidates.push({ x, y, score })
      }

      // 候補が少なすぎたら制約を緩めて全域ランダム
      if (candidates.length < 4) {
        for (let i = 0; i < 16; i++) {
          const x = pad + Math.random() * Math.max(0, maxX - pad)
          const y = pad + Math.random() * Math.max(0, maxY - pad)
          const cx = x + btnW / 2
          const cy = y + btnH / 2
          const score = Math.hypot(cx - relX, cy - relY) + Math.random() * 60
          candidates.push({ x, y, score })
        }
      }

      candidates.sort((a, b) => b.score - a.score)
      // 上位の中からランダムに選ぶ → 毎回いろんな方向へ
      const pool = candidates.slice(0, Math.min(8, candidates.length))
      const pick = pool[Math.floor(Math.random() * pool.length)] ?? {
        x: Math.random() * maxX,
        y: Math.random() * maxY,
      }

      const next = { x: pick.x, y: pick.y }
      lastPosRef.current = next
      setPos(next)

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
