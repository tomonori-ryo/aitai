import { useEffect, useState, type CSSProperties } from 'react'
import './Celebration.css'

type Props = {
  mode: 'yes' | 'no' | null
}

type Particle = {
  id: number
  left: number
  delay: number
  duration: number
  size: number
  kind: 'heart' | 'confetti'
  color: string
  drift: number
}

const COLORS = ['#ff4d6d', '#ff8fa3', '#ffd166', '#fff', '#ff6b6b', '#f72585']

export function Celebration({ mode }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (mode !== 'yes') {
      setParticles([])
      return
    }

    const next: Particle[] = Array.from({ length: 42 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 2.2,
      size: 10 + Math.random() * 16,
      kind: Math.random() > 0.45 ? 'heart' : 'confetti',
      color: COLORS[i % COLORS.length],
      drift: -40 + Math.random() * 80,
    }))
    setParticles(next)
  }, [mode])

  if (mode !== 'yes' || particles.length === 0) return null

  return (
    <div className="celebration" aria-hidden="true">
      {particles.map((p) => {
        const style = {
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          fontSize: `${p.size}px`,
          color: p.color,
          background: p.kind === 'confetti' ? p.color : undefined,
          ['--drift' as string]: `${p.drift}px`,
        } as CSSProperties
        return (
          <span
            key={p.id}
            className={`particle particle-${p.kind}`}
            style={style}
          >
            {p.kind === 'heart' ? '♥' : ''}
          </span>
        )
      })}
    </div>
  )
}
