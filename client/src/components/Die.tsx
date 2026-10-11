import { useEffect, useState } from 'react'

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
}

interface Props {
  value: number | null
  rolling: boolean
  canRoll: boolean
  onRoll: () => void
  tint: string
}

export default function Die({ value, rolling, canRoll, onRoll, tint }: Props) {
  const [flicker, setFlicker] = useState(1)
  const [lastValue, setLastValue] = useState(1)

  useEffect(() => {
    if (value !== null && Number.isInteger(value)) {
      setLastValue(value)
    } else if (value === null) {
      setLastValue(1)
    }
  }, [value])

  useEffect(() => {
    if (!rolling) return
    const id = setInterval(() => setFlicker(1 + Math.floor(Math.random() * 6)), 80)
    return () => clearInterval(id)
  }, [rolling])

  const shown = rolling ? flicker : (value ?? lastValue)
  const displayValue = Math.min(6, Math.max(1, shown))
  const pips = PIPS[displayValue] ?? PIPS[1]

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={!canRoll}
      aria-label={canRoll ? 'Roll the die' : value ? `Die shows ${value}` : 'Die'}
      className={`die ${rolling ? 'die-rolling' : ''} ${canRoll ? 'die-ready' : ''}`}
      style={{ ['--tint' as string]: tint }}
    >
      <span className="die-face">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={pips.includes(i) ? 'pip' : 'pip pip-off'} />
        ))}
      </span>
    </button>
  )
}
