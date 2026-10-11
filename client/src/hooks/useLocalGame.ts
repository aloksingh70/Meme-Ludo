import { useCallback, useEffect, useRef, useState } from 'react'
import {
  chooseBotMove,
  chooseMove,
  createGame,
  currentColor,
  rollDice,
  rollDie,
  smartRollDie,
  type Color,
  type GameEvent,
  type GameMode,
  type GameState
} from '@ludo/shared'
import { eventsToText } from '../lib/eventText'
import type { GameView } from '../lib/gameView'
import { calculateHopTiming, getTokenPath } from '../lib/path'
import { sound } from '../lib/sound'

export interface Seat {
  color: Color
  kind: 'human' | 'bot'
}

const ROLL_MS = 650
const BOT_DELAY_MS = 600

/**
 * Runs a whole game in the browser using the shared rules engine.
 * Used for pass-and-play and for playing against the computer.
 */
export function useLocalGame(initialSeats: Seat[], initialMode: GameMode = 'solo'): GameView {
  const [seats, setSeats] = useState<Seat[]>(initialSeats)
  const [state, setState] = useState<GameState>(() =>
    createGame(initialSeats.map((s) => s.color), initialMode)
  )
  const [rolling, setRolling] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const lastEvents = useRef(state.events)
  const lastTurnColor = useRef<Color | null>(null)

  useEffect(() => {
    setSeats(initialSeats)
  }, [initialSeats])

  const color = currentColor(state)
  const currentSeat = seats.find((s) => s.color === color)
  const kind = currentSeat ? currentSeat.kind : 'human'

  useEffect(() => {
    if (state.events === lastEvents.current) return
    lastEvents.current = state.events
    const lines = eventsToText(state.events)
    if (lines.length) setLog((l) => [...l, ...lines].slice(-40))

    if (state.phase === 'over') {
      sound.playWin()
    }
  }, [state.events, state.phase])

  // Play "your turn" chime when it becomes a human's turn
  useEffect(() => {
    if (state.phase === 'over') return
    if (lastTurnColor.current !== color) {
      lastTurnColor.current = color
      if (kind === 'human' && seats.some((s) => s.kind === 'bot')) {
        sound.playYourTurn()
      }
    }
  }, [color, kind, seats, state.phase])

  const roll = useCallback(() => {
    if (state.phase !== 'roll' || rolling || animating) return
    sound.playDiceRattle()
    const value = smartRollDie(state)
    setRolling(true)
    setTimeout(() => {
      sound.playDiceLand()
      if (value === 6) sound.playSixOrExtra()
      try {
        const nextState = rollDice(state, value)
        const moveEvent = nextState.events.find(
          (e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved'
        )

        if (moveEvent) {
          const steps = getTokenPath(
            moveEvent.color,
            moveEvent.move.from,
            moveEvent.move.to,
            moveEvent.move.tokenIndex
          )
          const { totalMs } = calculateHopTiming(steps.length)
          const captureDelay = moveEvent.move.captures.length > 0 ? 350 : 0
          const animDuration = totalMs + captureDelay

          setAnimating(true)
          setState(nextState)
          setRolling(false)
          setTimeout(() => {
            setAnimating(false)
          }, animDuration)
        } else {
          setState(nextState)
          setRolling(false)
        }
      } catch {
        setRolling(false)
      }
    }, ROLL_MS)
  }, [state, rolling, animating])

  const choose = useCallback(
    (tokenIndex: number) => {
      if (state.phase !== 'move' || rolling || animating) return
      try {
        const nextState = chooseMove(state, tokenIndex)
        const moveEvent = nextState.events.find(
          (e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved'
        )

        if (moveEvent) {
          const steps = getTokenPath(
            moveEvent.color,
            moveEvent.move.from,
            moveEvent.move.to,
            moveEvent.move.tokenIndex
          )
          const { totalMs } = calculateHopTiming(steps.length)
          const captureDelay = moveEvent.move.captures.length > 0 ? 350 : 0
          const animDuration = totalMs + captureDelay

          setAnimating(true)
          setState(nextState)
          setTimeout(() => {
            setAnimating(false)
          }, animDuration)
        } else {
          setState(nextState)
        }
      } catch {
        // Illegal move ignored
      }
    },
    [state, rolling, animating]
  )

  // The computer plays its own turns after previous actions/animations finish
  useEffect(() => {
    if (kind !== 'bot' || rolling || animating || state.phase === 'over') return
    const t = setTimeout(() => {
      if (state.phase === 'roll') roll()
      else if (state.phase === 'move') choose(chooseBotMove(state))
    }, BOT_DELAY_MS)
    return () => clearTimeout(t)
  }, [kind, rolling, animating, state, roll, choose])

  const restart = useCallback(() => {
    setState(createGame(seats.map((s) => s.color), initialMode))
    setLog([])
    setRolling(false)
    setAnimating(false)
  }, [seats, initialMode])

  const rows = seats.map((s) => ({
    color: s.color,
    label: s.kind === 'bot' ? 'Computer' : ''
  }))
  const canAct = kind === 'human' && state.phase !== 'over' && !rolling && !animating

  return { state, rolling, canAct, rows, log, roll, choose, restart }
}
