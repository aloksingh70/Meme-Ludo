import type { Color, GameState } from '@ludo/shared'

/** Everything the game screen needs, whether the game is local or online. */
export interface GameView {
  state: GameState
  /** Animate the die tumbling. */
  rolling: boolean
  /** May the person at this device roll or move right now? */
  canAct: boolean
  /** Short description of each player, e.g. "Computer" or "Asha (you)". */
  rows: { color: Color; label: string }[]
  log: string[]
  roll: () => void
  choose: (tokenIndex: number) => void
  /** Only local games can restart in place. */
  restart?: () => void
}
