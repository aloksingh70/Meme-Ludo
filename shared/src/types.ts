import type { Color } from './constants'

export interface TokenRef {
  color: Color
  tokenIndex: number
}

export interface Move {
  tokenIndex: number
  from: number
  to: number
  captures: TokenRef[]
}

export type GameEvent =
  | { type: 'rolled'; color: Color; value: number }
  | { type: 'moved'; color: Color; move: Move; auto: boolean; by?: Color }
  | { type: 'captured'; by: Color; victims: TokenRef[] }
  | { type: 'finishedToken'; color: Color; tokenIndex: number }
  | { type: 'extraTurn'; color: Color; reason: 'six' | 'capture' }
  | { type: 'noMoves'; color: Color; value: number }
  | { type: 'forfeit'; color: Color }
  | { type: 'placed'; color: Color; place: number }
  | { type: 'gameOver'; placements: Color[]; winningTeam?: 'A' | 'B' }

export type Phase = 'roll' | 'move' | 'over'
export type GameMode = 'solo' | 'teams'

export interface GameState {
  mode: GameMode
  players: Color[]
  tokens: Record<Color, number[]>
  turn: number
  phase: Phase
  dice: number | null
  sixes: number
  legal: Move[]
  placements: Color[]
  winningTeam?: 'A' | 'B' | null
  /** Events produced by the most recent action, so a UI can animate them. */
  events: GameEvent[]
  /** Number of consecutive turns without rolling a six, per color. */
  turnsWithoutSix?: Record<Color, number>
  /** Color of the player who rolled the current dice value. */
  lastRoller?: Color | null
  /** Color whose tokens are currently being moved (roller's or partner's if finished). */
  actingColor?: Color
}
