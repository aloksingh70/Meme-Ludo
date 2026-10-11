import { useState } from 'react'
import type { Color, GameMode } from '@ludo/shared'
import type { Seat } from '../hooks/useLocalGame'
import { sound } from '../lib/sound'

type Mode = 'local' | 'bots'

const ORDER: Record<number, Color[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue']
}

interface Props {
  onStart: (seats: Seat[], gameMode?: GameMode) => void
  onOnline: () => void
}

export default function Setup({ onStart, onOnline }: Props) {
  const [mode, setMode] = useState<Mode | 'online'>('local')
  const [count, setCount] = useState(2)

  const start = () => {
    sound.playClick()
    if (mode === 'online') return onOnline()
    const seats: Seat[] = ORDER[count].map((color, i) => ({
      color,
      kind: mode === 'bots' && i > 0 ? 'bot' : 'human'
    }))
    onStart(seats, 'solo')
  }

  const modes: { id: Mode | 'online'; title: string; text: string; disabled?: boolean }[] = [
    { id: 'local', title: 'Pass and play', text: 'One screen. Hand the device over after each turn.' },
    { id: 'bots', title: 'Play the computer', text: 'You are red. The computer plays the other colours.' },
    { id: 'online', title: 'Play online', text: 'Make a room and share its code with friends on their own devices.' }
  ]

  return (
    <main className="px-6 py-10 md:px-16 md:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-7xl text-ivory md:text-8xl">Ludo</h1>
        <p className="mt-4 max-w-md text-lg text-ivory-dim">
          Race four tokens around the board and home. Roll a six to bring one out.
        </p>

        <div className="stitch my-10" />

        <fieldset>
          <legend className="font-display text-2xl text-ivory">How do you want to play?</legend>
          <div className="mt-4 divide-y divide-ivory/15">
            {modes.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-4 py-4 ${m.disabled ? 'opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m.id}
                  className="mt-1.5 h-4 w-4 accent-marigold"
                  checked={mode === m.id}
                  disabled={m.disabled}
                  onChange={() => {
                    if (!m.disabled) {
                      sound.playClick()
                      setMode(m.id)
                    }
                  }}
                />
                <span>
                  <span className="block text-xl text-ivory">{m.title}</span>
                  <span className="block text-ivory-dim">{m.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode !== 'online' && (
          <>
            <div className="stitch my-10" />

            <fieldset>
              <legend className="font-display text-2xl text-ivory">Players</legend>
              <div className="mt-4 flex gap-3">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      sound.playClick()
                      setCount(n)
                    }}
                    aria-pressed={count === n}
                    className={`h-12 w-14 rounded-md text-xl transition-colors cursor-pointer ${
                      count === n
                        ? 'bg-ivory text-cloth font-bold ring-2 ring-marigold'
                        : 'bg-cloth-soft text-ivory hover:bg-cloth-soft/70'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <button className="btn-primary mt-12 cursor-pointer" onClick={start}>
          {mode === 'online' ? 'Continue' : 'Start game'}
        </button>
      </div>
    </main>
  )
}
