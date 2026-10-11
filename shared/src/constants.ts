export const COLORS = ['red', 'green', 'yellow', 'blue'] as const
export type Color = (typeof COLORS)[number]

/** Shared outer loop of the board, clockwise. */
export const TRACK_LENGTH = 52

/** Where each colour enters the shared track (absolute square index). */
export const START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
}

/**
 * Token "progress" is relative to its own colour:
 *   -1        in base (off the board)
 *   0..50     on the shared track (0 = its own entry square)
 *   51..55    inside its private home column
 *   56        finished (centre)
 */
export const IN_BASE = -1
export const LAST_TRACK_PROGRESS = 50
export const FINISH_PROGRESS = 56
export const TOKENS_PER_PLAYER = 4

/** The 4 entry squares plus the 4 star squares 8 steps after each entry. */
export const SAFE_SQUARES: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47])

export type Team = 'A' | 'B'

export const TEAMS: Record<Team, readonly [Color, Color]> = {
  A: ['red', 'yellow'],
  B: ['green', 'blue']
} as const

