import type { Color } from './constants'
import type { GameMode, GameState } from './types'

/**
 * Messages exchanged between client and server. Kept in the shared package so
 * both sides are type-checked against the same contract.
 *
 * Player ids are secrets (they let you rejoin your seat), so they are only ever
 * sent to their owner, in an ack. Everyone else sees seats by index.
 */
export interface SeatPublic {
  name: string
  kind: 'human' | 'bot'
  /** Colours are handed out when the host starts the game. */
  color: Color | null
  connected: boolean
  isHost: boolean
}

export interface RoomPublic {
  code: string
  mode: GameMode
  status: 'lobby' | 'playing' | 'over'
  seats: SeatPublic[]
  /** Index into `seats` of the receiving player. */
  you: number | null
}

export type Ack<T extends object = object> = (
  res: ({ ok: true } & T) | { ok: false; error: string }
) => void

export interface ClientToServerEvents {
  'room:create': (
    payload: string | { name: string; mode?: GameMode },
    ack: Ack<{ code: string; playerId: string }>
  ) => void
  'room:setMode': (mode: GameMode, ack: Ack) => void
  'room:join': (
    p: { code: string; name: string; playerId?: string },
    ack: Ack<{ code: string; playerId: string }>
  ) => void
  'room:addBot': (ack: Ack) => void
  'room:removeSeat': (seatIndex: number, ack: Ack) => void
  'room:swapSeats': (index1: number, index2: number, ack: Ack) => void
  'room:start': (ack: Ack) => void
  'room:leave': () => void
  'game:roll': (ack: Ack) => void
  'game:move': (tokenIndex: number, ack: Ack) => void
}

export interface ServerToClientEvents {
  'room:update': (room: RoomPublic) => void
  'game:state': (state: GameState) => void
}
