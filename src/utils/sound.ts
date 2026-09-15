let audioCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.08,
) {
  const ac = ctx()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = frequency
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** ポロロン系の軽い決定音 */
export function playChime() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  tone(523.25, t, 0.18, 'triangle', 0.07)
  tone(659.25, t + 0.12, 0.2, 'triangle', 0.07)
  tone(783.99, t + 0.24, 0.28, 'triangle', 0.08)
}

/** YES のキラキラ */
export function playSuccess() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, t + i * 0.09, 0.22, 'sine', 0.07)
  })
}

/** NO のしょぼん */
export function playSad() {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime
  tone(392, t, 0.25, 'triangle', 0.07)
  tone(349.23, t + 0.18, 0.28, 'triangle', 0.06)
  tone(293.66, t + 0.4, 0.4, 'triangle', 0.05)
}

export function vibrate(pattern: number | number[] = 40) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}
