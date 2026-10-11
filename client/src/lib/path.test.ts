import { describe, expect, it } from 'vitest'
import { FINISH_PROGRESS, IN_BASE, START_INDEX } from '@ludo/shared'
import { calculateHopTiming, getTokenPath } from './path'
import { RING, baseSlot } from './geometry'

describe('getTokenPath', () => {
  it('handles leaving base on a 6', () => {
    const path = getTokenPath('red', IN_BASE, 0, 0)
    expect(path).toHaveLength(2)
    expect(path[0]).toEqual({ ...baseSlot('red', 0), progress: IN_BASE })
    expect(path[1]).toEqual({ ...RING[START_INDEX.red], progress: 0 })
  })

  it('steps through consecutive squares on the track', () => {
    const path = getTokenPath('red', 0, 4, 0)
    expect(path).toHaveLength(5)
    expect(path.map((p) => p.progress)).toEqual([0, 1, 2, 3, 4])
  })

  it('steps through home column into centre finish', () => {
    const path = getTokenPath('yellow', 50, FINISH_PROGRESS, 2)
    // 50, 51, 52, 53, 54, 55, 56 -> 7 steps
    expect(path).toHaveLength(7)
    expect(path[0].progress).toBe(50)
    expect(path[path.length - 1].progress).toBe(FINISH_PROGRESS)
  })

  it('returns single point when from === to', () => {
    const path = getTokenPath('blue', 10, 10, 1)
    expect(path).toHaveLength(1)
    expect(path[0].progress).toBe(10)
  })
})

describe('calculateHopTiming', () => {
  it('caps total duration around 1200ms for long moves', () => {
    const timing = calculateHopTiming(7) // 6 hops
    expect(timing.totalMs).toBeLessThanOrEqual(1200)
    expect(timing.hopMs).toBeGreaterThanOrEqual(90)
    expect(timing.hopMs).toBeLessThanOrEqual(150)
  })

  it('returns 0 for no hops', () => {
    expect(calculateHopTiming(1)).toEqual({ hopMs: 0, totalMs: 0 })
  })
})
