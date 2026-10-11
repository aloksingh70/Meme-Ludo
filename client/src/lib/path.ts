import {
  FINISH_PROGRESS,
  IN_BASE,
  START_INDEX,
  TRACK_LENGTH,
  type Color
} from '@ludo/shared'
import { baseSlot, HOME_COLUMN, RING, tokenPoint, type Pt } from './geometry'

export interface PathStep {
  x: number
  y: number
  progress: number
}

/**
 * Computes all intermediate board coordinates for a token move.
 * Includes leaving base to entry square, stepping along the ring,
 * entering the home column, and finishing in the centre.
 */
export function getTokenPath(
  color: Color,
  fromProgress: number,
  toProgress: number,
  tokenIndex: number
): PathStep[] {
  if (fromProgress === toProgress) {
    const pt = tokenPoint(color, toProgress, tokenIndex)
    return [{ x: pt.x, y: pt.y, progress: toProgress }]
  }

  const steps: PathStep[] = []

  // Token is leaving base on a 6: base slot -> entry square (progress 0)
  if (fromProgress === IN_BASE) {
    const startPt = baseSlot(color, tokenIndex)
    steps.push({ x: startPt.x, y: startPt.y, progress: IN_BASE })
    const entryPt = RING[START_INDEX[color]]
    steps.push({ x: entryPt.x, y: entryPt.y, progress: 0 })
    return steps
  }

  // Token is moving forward step by step along track / home lane
  for (let p = fromProgress; p <= toProgress; p++) {
    const pt = tokenPoint(color, p, tokenIndex)
    steps.push({ x: pt.x, y: pt.y, progress: p })
  }

  return steps
}

/**
 * Calculates per-hop and total animation duration.
 * Keeps individual hops around 120-150ms while capping total travel time at ~1.2s.
 */
export function calculateHopTiming(stepCount: number): { hopMs: number; totalMs: number } {
  if (stepCount <= 1) return { hopMs: 0, totalMs: 0 }
  const hops = stepCount - 1
  // Target 140ms per hop, but cap total at 1200ms
  const hopMs = Math.max(90, Math.min(150, Math.floor(1200 / hops)))
  return { hopMs, totalMs: hopMs * hops }
}
