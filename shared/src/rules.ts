import {
  FINISH_PROGRESS,
  IN_BASE,
  LAST_TRACK_PROGRESS,
  SAFE_SQUARES,
  START_INDEX,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
  type Color,
  type Team
} from './constants'
import type { GameMode, GameState, Move, TokenRef } from './types'

/**
 * Pure game rules. No UI, no network, no randomness (the dice value is
 * passed in). The same file runs in the browser (local + vs-bot modes) and
 * on the server (online mode), so the rules can never drift apart.
 */

export function absoluteSquare(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK_PROGRESS) return null
  return (START_INDEX[color] + progress) % TRACK_LENGTH
}

export function teamOf(color: Color): Team {
  return color === 'red' || color === 'yellow' ? 'A' : 'B'
}

export function partnerOf(color: Color): Color {
  switch (color) {
    case 'red':
      return 'yellow'
    case 'yellow':
      return 'red'
    case 'green':
      return 'blue'
    case 'blue':
      return 'green'
  }
}

export function getActingColor(s: GameState): Color {
  const roller = currentColor(s)
  if (s.mode === 'teams') {
    const rollerDone = s.tokens[roller].every((p) => p === FINISH_PROGRESS)
    if (rollerDone) {
      return partnerOf(roller)
    }
  }
  return roller
}

export function createGame(players: Color[], mode: GameMode = 'solo'): GameState {
  if (mode === 'teams') {
    if (players.length !== 4) throw new Error('Team mode requires exactly 4 players')
  } else {
    if (players.length < 2 || players.length > 4) throw new Error('Ludo needs 2-4 players')
  }
  if (new Set(players).size !== players.length) throw new Error('Duplicate colours')
  const tokens: Record<Color, number[]> = { red: [], green: [], yellow: [], blue: [] }
  for (const p of players) tokens[p] = Array(TOKENS_PER_PLAYER).fill(IN_BASE)
  return {
    mode,
    players: [...players],
    tokens,
    turn: 0,
    phase: 'roll',
    dice: null,
    sixes: 0,
    legal: [],
    placements: [],
    winningTeam: null,
    events: [],
    turnsWithoutSix: { red: 0, green: 0, yellow: 0, blue: 0 },
    lastRoller: null,
    actingColor: players[0]
  }
}

export const currentColor = (s: GameState): Color => s.players[s.turn]

export const rollDie = (rng: () => number = Math.random): number => Math.floor(rng() * 6) + 1

export function tokensOnSquare(s: GameState, square: number): TokenRef[] {
  const out: TokenRef[] = []
  for (const color of s.players) {
    s.tokens[color].forEach((p, tokenIndex) => {
      if (absoluteSquare(color, p) === square) out.push({ color, tokenIndex })
    })
  }
  return out
}

export function isSquareBlocked(s: GameState, square: number, moverColor: Color): boolean {
  if (s.mode !== 'teams') return false
  const moverTeam = teamOf(moverColor)
  const tokens = tokensOnSquare(s, square)
  const opponentTokens = tokens.filter((t) => teamOf(t.color) !== moverTeam)
  return opponentTokens.length >= 2
}

/**
 * Legal moves for the current acting player with this roll.
 * Tokens in identical positions give identical outcomes, so they are
 * collapsed into one move. That is what lets "4 tokens in base + a six"
 * auto-play instead of asking which identical token to bring out.
 */
export function getLegalMoves(s: GameState, roll: number): Move[] {
  const acting = getActingColor(s)
  const moves: Move[] = []
  const seenFrom = new Set<number>()

  s.tokens[acting].forEach((from, tokenIndex) => {
    if (from === FINISH_PROGRESS || seenFrom.has(from)) return

    let to: number
    if (from === IN_BASE) {
      if (roll !== 6) return // a six is required to leave base
      to = 0
      if (s.mode === 'teams') {
        const entrySq = START_INDEX[acting]
        if (isSquareBlocked(s, entrySq, acting)) {
          return // Entry square blocked by opponent team block
        }
      }
    } else {
      to = from + roll
      if (to > FINISH_PROGRESS) return // strict: exact or smaller to finish

      if (s.mode === 'teams') {
        let blocked = false
        for (let step = 1; step <= roll; step++) {
          const checkProgress = from + step
          if (checkProgress <= LAST_TRACK_PROGRESS) {
            const sq = absoluteSquare(acting, checkProgress)!
            if (isSquareBlocked(s, sq, acting)) {
              blocked = true
              break
            }
          }
        }
        if (blocked) return
      }
    }

    // Capture: lands on a non-safe track square holding opponent token(s).
    let captures: TokenRef[] = []
    if (to <= LAST_TRACK_PROGRESS) {
      const sq = absoluteSquare(acting, to)!
      if (!SAFE_SQUARES.has(sq)) {
        if (s.mode === 'teams') {
          // Never capture partner! Only opponents!
          captures = tokensOnSquare(s, sq).filter((t) => teamOf(t.color) !== teamOf(acting))
        } else {
          captures = tokensOnSquare(s, sq).filter((t) => t.color !== acting)
        }
      }
    }

    seenFrom.add(from)
    moves.push({ tokenIndex, from, to, captures })
  })

  return moves
}

function advanceTurn(s: GameState): void {
  const prevColor = currentColor(s)
  if (!s.turnsWithoutSix) {
    s.turnsWithoutSix = { red: 0, green: 0, yellow: 0, blue: 0 }
  }
  const prevActing = getActingColor(s)
  const prevAllInBase = s.tokens[prevActing].every((p) => p === IN_BASE)
  if (prevAllInBase && s.sixes === 0) {
    s.turnsWithoutSix[prevColor] = (s.turnsWithoutSix[prevColor] ?? 0) + 1
  } else {
    // Resets when a token is out of base or a six was rolled
    s.turnsWithoutSix[prevColor] = 0
  }

  let n = s.turn
  if (s.mode === 'teams') {
    // In teams mode, nobody is skipped while game is in progress
    n = (n + 1) % s.players.length
  } else {
    do {
      n = (n + 1) % s.players.length
    } while (s.placements.includes(s.players[n]))
  }
  s.turn = n
  s.phase = 'roll'
  s.sixes = 0
  s.legal = []
  s.actingColor = getActingColor(s)
}

/** Mutates an already-cloned state. */
function applyMove(s: GameState, move: Move, auto: boolean): void {
  const roller = currentColor(s)
  const acting = getActingColor(s)
  const roll = s.dice!

  s.tokens[acting][move.tokenIndex] = move.to
  s.events.push({ type: 'moved', color: acting, move, auto, by: roller })

  // Pity rule resets if a single token gets out of base
  if (s.turnsWithoutSix) {
    const allInBase = s.tokens[acting].every((p) => p === IN_BASE)
    if (!allInBase || roll === 6) {
      s.turnsWithoutSix[acting] = 0
    }
  }

  if (move.captures.length) {
    for (const c of move.captures) s.tokens[c.color][c.tokenIndex] = IN_BASE
    s.events.push({ type: 'captured', by: acting, victims: move.captures })
  }
  if (move.to === FINISH_PROGRESS) {
    s.events.push({ type: 'finishedToken', color: acting, tokenIndex: move.tokenIndex })
  }
  s.legal = []

  if (s.mode === 'teams') {
    const teamAHome =
      s.tokens.red.every((p) => p === FINISH_PROGRESS) &&
      s.tokens.yellow.every((p) => p === FINISH_PROGRESS)
    const teamBHome =
      s.tokens.green.every((p) => p === FINISH_PROGRESS) &&
      s.tokens.blue.every((p) => p === FINISH_PROGRESS)

    if (teamAHome || teamBHome) {
      const winningTeam: Team = teamAHome ? 'A' : 'B'
      s.winningTeam = winningTeam
      s.placements = winningTeam === 'A' ? ['red', 'yellow', 'green', 'blue'] : ['green', 'blue', 'red', 'yellow']
      s.phase = 'over'
      s.events.push({ type: 'gameOver', placements: [...s.placements], winningTeam })
      return
    }
  } else {
    const done = s.tokens[acting].every((p) => p === FINISH_PROGRESS)
    if (done) {
      s.placements.push(acting)
      s.events.push({ type: 'placed', color: acting, place: s.placements.length })
    }

    const remaining = s.players.filter((c) => !s.placements.includes(c))
    if (remaining.length <= 1) {
      if (remaining.length === 1) s.placements.push(remaining[0])
      s.phase = 'over'
      s.events.push({ type: 'gameOver', placements: [...s.placements] })
      return
    }
  }

  const reason = roll === 6 ? 'six' : move.captures.length ? 'capture' : null
  if (reason) {
    s.phase = 'roll'
    s.events.push({ type: 'extraTurn', color: roller, reason })
  } else {
    advanceTurn(s)
  }
}

/** Apply a dice value. Returns a new state; the input is never mutated. */
export function rollDice(prev: GameState, value: number): GameState {
  if (prev.phase !== 'roll') throw new Error('Not in roll phase')
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('Dice must be 1-6')

  const s = structuredClone(prev)
  const roller = currentColor(s)
  s.events = [{ type: 'rolled', color: roller, value }]
  s.dice = value
  s.lastRoller = roller
  s.sixes = value === 6 ? s.sixes + 1 : 0
  s.actingColor = getActingColor(s)

  // Third six in a row: turn is forfeited.
  if (s.sixes >= 3) {
    s.events.push({ type: 'forfeit', color: roller })
    advanceTurn(s)
    return s
  }

  const legal = getLegalMoves(s, value)
  if (legal.length === 0) {
    s.events.push({ type: 'noMoves', color: roller, value })
    advanceTurn(s)
    return s
  }
  if (legal.length === 1) {
    applyMove(s, legal[0], true) // only one legal move: play it automatically
    return s
  }

  s.phase = 'move'
  s.legal = legal
  return s
}

/** Player picks a token (any token in the same position as a legal one works). */
export function chooseMove(prev: GameState, tokenIndex: number): GameState {
  if (prev.phase !== 'move') throw new Error('Not in move phase')
  const acting = getActingColor(prev)
  const from = prev.tokens[acting][tokenIndex]
  const match = prev.legal.find((m) => m.from === from)
  if (!match) throw new Error('Illegal move')

  const s = structuredClone(prev)
  s.events = []
  applyMove(s, { ...match, tokenIndex }, false)
  return s
}

/**
 * Smart dice algorithm that enhances game pace, comebacks, and excitement:
 * 1. Pity 6 / First-turn 6: Guarantees/heavily favors rolling a 6 when all tokens are in base.
 * 2. Dynamic captures: Boosts probability of rolling to capture an opponent token.
 * 3. Final stretch assistance: Heavy bias to roll exact number to finish in home column.
 */
export function smartRollDie(s: GameState, rng: () => number = Math.random): number {
  const acting = getActingColor(s)
  const tokens = s.tokens[acting]
  const turnsNoSix = s.turnsWithoutSix?.[acting] ?? 0
  const allInBase = tokens.every((p) => p === IN_BASE)
  const thirdSixRisk = s.sixes === 2

  // 1. Pity / First-turn 6: Getting a token out from home
  if (allInBase && !thirdSixRisk) {
    const pityChance =
      turnsNoSix === 0 ? 0.5 : turnsNoSix === 1 ? 0.7 : turnsNoSix === 2 ? 0.88 : 1.0
    if (rng() < pityChance) return 6
    return Math.floor(rng() * 5) + 1
  }

  // 2. Kill / Capture assistance
  if (!thirdSixRisk) {
    const captureRolls: number[] = []
    for (let r = 1; r <= 6; r++) {
      const moves = getLegalMoves(s, r)
      if (moves.some((m) => m.captures.length > 0)) {
        captureRolls.push(r)
      }
    }
    if (captureRolls.length > 0 && rng() < 0.55) {
      return captureRolls[Math.floor(rng() * captureRolls.length)]
    }
  }

  // 3. Final line / Home stretch assistance
  const homeStretchTokens = tokens.filter((p) => p >= 51 && p < FINISH_PROGRESS)
  if (homeStretchTokens.length > 0 && !thirdSixRisk) {
    const finishRolls: number[] = []
    for (const p of homeStretchTokens) {
      const dist = FINISH_PROGRESS - p
      if (dist >= 1 && dist <= 6) finishRolls.push(dist)
    }
    if (finishRolls.length > 0 && rng() < 0.65) {
      return finishRolls[Math.floor(rng() * finishRolls.length)]
    }

    const validRolls: number[] = []
    for (let r = 1; r <= 6; r++) {
      if (getLegalMoves(s, r).length > 0) validRolls.push(r)
    }
    if (validRolls.length > 0 && rng() < 0.7) {
      return validRolls[Math.floor(rng() * validRolls.length)]
    }
  }

  // 4. Default: Standard fair die
  return rollDie(rng)
}

