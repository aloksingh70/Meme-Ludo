import {
  FINISH_PROGRESS,
  IN_BASE,
  LAST_TRACK_PROGRESS,
  SAFE_SQUARES
} from './constants'
import { absoluteSquare, getActingColor } from './rules'
import type { GameState } from './types'

/**
 * Simple heuristic bot. Picks among the legal moves in `state.legal`:
 * capture > finish > leave base > reach a safe square / home column > go further.
 * Pure and deterministic, so it also runs on the server to fill empty seats.
 */
export function chooseBotMove(state: GameState): number {
  const color = getActingColor(state)
  let best = state.legal[0]
  let bestScore = -Infinity

  for (const m of state.legal) {
    let score = m.to * 0.5
    score += m.captures.length * 100
    if (m.to === FINISH_PROGRESS) score += 80
    if (m.from === IN_BASE) score += 60
    const sq = absoluteSquare(color, m.to)
    if (sq !== null && SAFE_SQUARES.has(sq)) score += 25
    if (m.to > LAST_TRACK_PROGRESS) score += 20
    if (score > bestScore) {
      best = m
      bestScore = score
    }
  }
  return best.tokenIndex
}
