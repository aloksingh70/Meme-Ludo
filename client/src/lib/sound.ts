/**
 * Zero-dependency Web Audio API sound synthesizer.
 * All sounds are synthesized with Web Audio oscillators and noise buffers,
 * requiring no external audio assets.
 */

const STORAGE_KEY = 'ludo:muted'

class SoundManager {
  private ctx: AudioContext | null = null
  private muted: boolean = false
  private unlocked: boolean = false

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      this.muted = false
    }

    // Unlock AudioContext on first user gesture
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureContext()
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {})
        }
        window.removeEventListener('pointerdown', unlock)
        window.removeEventListener('keydown', unlock)
      }
      window.addEventListener('pointerdown', unlock, { passive: true })
      window.addEventListener('keydown', unlock, { passive: true })
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx()
        } catch {
          this.ctx = null
        }
      }
    }
    return this.ctx
  }

  public isMuted(): boolean {
    return this.muted
  }

  public setMuted(muted: boolean): void {
    this.muted = muted
    try {
      localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false')
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  private canPlay(): AudioContext | null {
    if (this.muted) return null
    const ctx = this.ensureContext()
    if (!ctx || ctx.state === 'suspended') return null
    return ctx
  }

  /** Subtle UI click */
  public playClick(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.02)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.025)
  }

  /** Soft woodblock / tick for each token hop square */
  public playHopTick(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(950, now)
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.035)

    gain.gain.setValueAtTime(0.09, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.04)
  }

  /** Die rattling tumble */
  public playDiceRattle(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    // 4 quick rattling taps
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(350 + Math.random() * 200, t)
      gain.gain.setValueAtTime(0.06, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.06)
    }
  }

  /** Die solid landing thud */
  public playDiceLand(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.13)
  }

  /** Capture punch and whistle */
  public playCapture(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 30, 40])
      } catch {
        // ignore
      }
    }

    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    // Descending snap
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18)

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.22)
  }

  /** Token reaching home center - celebratory ascending chord */
  public playTokenHome(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.26)
    })
  }

  /** Extra turn / rolled a six - cheerful double chime */
  public playSixOrExtra(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    const notes = [880, 1108.73] // A5, C#6
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.1
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.1, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.23)
    })
  }

  /** Your turn notification */
  public playYourTurn(): void {
    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(659.25, now) // E5
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15) // D5

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.26)
  }

  /** Win fanfare */
  public playWin(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100, 50, 200])
      } catch {
        // ignore
      }
    }

    const ctx = this.canPlay()
    if (!ctx) return
    const now = ctx.currentTime

    // Vibrant fanfare
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51]
    freqs.forEach((f, i) => {
      const t = now + i * 0.11
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = i === freqs.length - 1 ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(f, t)
      const duration = i === freqs.length - 1 ? 0.7 : 0.25
      gain.gain.setValueAtTime(0.16, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + duration + 0.05)
    })
  }
}

export const sound = new SoundManager()
