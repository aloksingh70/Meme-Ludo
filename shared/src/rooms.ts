import {
  FINISH_PROGRESS,
  chooseBotMove,
  chooseMove,
  createGame,
  currentColor,
  rollDice,
  rollDie,
  smartRollDie,
  type Color,
  type GameMode,
  type GameState,
  type RoomPublic
} from './index'

function secureRng(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0] / 2 ** 32
  }
  return Math.random()
}

function randomInt(min: number, max: number): number {
  return Math.floor(secureRng() * (max - min)) + min
}

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (secureRng() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const CODE_LENGTH = 5
const MAX_SEATS = 4
const MAX_NAME = 20

const COLOR_ORDER: Record<number, Color[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue']
}

export interface Seat {
  playerId: string // secret: lets this player rejoin their seat
  userId?: string | null // optional authenticated user id
  name: string
  kind: 'human' | 'bot'
  color: Color | null
  socketId: string | null
  connected: boolean
}

export interface RoomStats {
  capturesMade: number
  timesCaptured: number
  sixesRolled: number
}

export interface Room {
  code: string
  mode: GameMode
  seats: Seat[]
  hostId: string
  status: 'lobby' | 'playing' | 'over'
  state: GameState | null
  lastActive: number
  startedAt?: number
  stats?: Record<string, RoomStats>
  recorded?: boolean
}

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

function cleanName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : ''
  return s || fallback
}

export interface MatchDbRecorder {
  recordMatch: (match: any) => void
}

export class RoomManager {
  readonly rooms = new Map<string, Room>()

  constructor(
    private readonly rng: () => number = secureRng,
    private readonly now: () => number = Date.now,
    public readonly db?: MatchDbRecorder
  ) {}

  private newCode(): string {
    for (;;) {
      let code = ''
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
      if (!this.rooms.has(code)) return code
    }
  }

  private touch(room: Room) {
    room.lastActive = this.now()
  }

  private seatOf(room: Room, playerId: string): Seat | undefined {
    return room.seats.find((s) => s.playerId === playerId)
  }

  private humans(room: Room): Seat[] {
    return room.seats.filter((s) => s.kind === 'human')
  }

  createRoom(
    name: unknown,
    socketId: string,
    userId?: string | null,
    mode: GameMode = 'solo'
  ): Result<{ room: Room; playerId: string }> {
    const playerId = randomUUID()
    const room: Room = {
      code: this.newCode(),
      mode,
      seats: [
        {
          playerId,
          userId: userId ?? null,
          name: cleanName(name, 'Player 1'),
          kind: 'human',
          color: null,
          socketId,
          connected: true
        }
      ],
      hostId: playerId,
      status: 'lobby',
      state: null,
      lastActive: this.now()
    }
    this.rooms.set(room.code, room)
    return { ok: true, room, playerId }
  }

  joinRoom(
    codeRaw: unknown,
    name: unknown,
    socketId: string,
    playerId?: string,
    userId?: string | null
  ): Result<{ room: Room; playerId: string }> {
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : ''
    const room = this.rooms.get(code)
    if (!room) return fail('No room with that code.')

    // Rejoin: a known player id takes its old seat back (refresh, dropped signal).
    if (typeof playerId === 'string') {
      const seat = this.seatOf(room, playerId)
      if (seat && seat.kind === 'human') {
        seat.socketId = socketId
        seat.connected = true
        if (userId) seat.userId = userId
        this.touch(room)
        return { ok: true, room, playerId }
      }
    }

    if (room.status !== 'lobby') return fail('That game has already started.')
    if (room.seats.length >= MAX_SEATS) return fail('That room is full.')

    const id = randomUUID()
    room.seats.push({
      playerId: id,
      userId: userId ?? null,
      name: cleanName(name, `Player ${room.seats.length + 1}`),
      kind: 'human',
      color: null,
      socketId,
      connected: true
    })
    this.touch(room)
    return { ok: true, room, playerId: id }
  }

  addBot(room: Room, playerId: string): Result {
    if (room.hostId !== playerId) return fail('Only the host can add a computer player.')
    if (room.status !== 'lobby') return fail('The game has already started.')
    if (room.seats.length >= MAX_SEATS) return fail('That room is full.')
    const n = room.seats.filter((s) => s.kind === 'bot').length + 1
    room.seats.push({
      playerId: randomUUID(),
      userId: null,
      name: `Computer ${n}`,
      kind: 'bot',
      color: null,
      socketId: null,
      connected: true
    })
    this.touch(room)
    return { ok: true }
  }

  removeSeat(room: Room, playerId: string, index: number): Result {
    if (room.hostId !== playerId) return fail('Only the host can remove players.')
    if (room.status !== 'lobby') return fail('The game has already started.')
    const seat = room.seats[index]
    if (!seat) return fail('No such seat.')
    if (seat.playerId === playerId) return fail('You cannot remove yourself.')
    room.seats.splice(index, 1)
    this.touch(room)
    return { ok: true }
  }

  swapSeats(room: Room, playerId: string, index1: number, index2: number): Result {
    if (room.hostId !== playerId) return fail('Only the host can swap players.')
    if (room.status !== 'lobby') return fail('The game has already started.')
    if (
      !Number.isInteger(index1) ||
      !Number.isInteger(index2) ||
      index1 < 0 ||
      index1 >= room.seats.length ||
      index2 < 0 ||
      index2 >= room.seats.length
    ) {
      return fail('Invalid seat index.')
    }
    if (index1 === index2) return { ok: true }
    const temp = room.seats[index1]
    room.seats[index1] = room.seats[index2]
    room.seats[index2] = temp
    this.touch(room)
    return { ok: true }
  }

  setMode(room: Room, playerId: string, mode: GameMode): Result {
    if (room.hostId !== playerId) return fail('Only the host can change game mode.')
    if (room.status !== 'lobby') return fail('The game has already started.')
    room.mode = mode
    this.touch(room)
    return { ok: true }
  }

  start(room: Room, playerId: string): Result {
    if (room.hostId !== playerId) return fail('Only the host can start the game.')
    if (room.status !== 'lobby') return fail('The game has already started.')
    if (room.mode === 'teams') {
      if (room.seats.length !== 4) return fail('Team mode requires exactly 4 players. Invite friends to join.')
      const colors: Color[] = ['red', 'green', 'yellow', 'blue']
      room.seats.forEach((s, i) => (s.color = colors[i]))
      room.state = createGame(colors, 'teams')
    } else {
      if (room.seats.length < 2) return fail('You need at least 2 players.')
      const colors = COLOR_ORDER[room.seats.length]
      room.seats.forEach((s, i) => (s.color = colors[i]))
      room.state = createGame(colors, 'solo')
    }
    room.status = 'playing'
    room.startedAt = this.now()
    room.recorded = false
    room.stats = {}
    for (const s of room.seats) {
      if (s.color) {
        room.stats[s.color] = { capturesMade: 0, timesCaptured: 0, sixesRolled: 0 }
      }
    }
    this.touch(room)
    return { ok: true }
  }

  private seatToAct(room: Room): Seat | undefined {
    if (!room.state) return undefined
    const color = currentColor(room.state)
    return room.seats.find((s) => s.color === color)
  }

  private trackEvents(room: Room) {
    if (!room.state || !room.stats) return
    for (const e of room.state.events) {
      if (e.type === 'rolled' && e.value === 6) {
        if (room.stats[e.color]) room.stats[e.color].sixesRolled++
      } else if (e.type === 'moved' && e.move.captures.length > 0) {
        if (room.stats[e.color]) room.stats[e.color].capturesMade += e.move.captures.length
        for (const victim of e.move.captures) {
          if (room.stats[victim.color]) room.stats[victim.color].timesCaptured++
        }
      }
    }
  }

  private recordFinishedMatch(room: Room) {
    if (!room.state || !this.db) return
    const placements = room.state.placements
    const players = room.seats.map((seat, seatIndex) => {
      const color = seat.color!
      const placeIdx = placements.indexOf(color)
      const placement =
        room.mode === 'teams'
          ? placeIdx < 2
            ? 1
            : 2
          : placeIdx >= 0
            ? placeIdx + 1
            : room.seats.length
      const tokensHome = room.state!.tokens[color].filter((p) => p === FINISH_PROGRESS).length
      const s = room.stats?.[color] ?? { capturesMade: 0, timesCaptured: 0, sixesRolled: 0 }

      return {
        seatIndex,
        userId: seat.kind === 'human' && seat.userId ? seat.userId : null,
        displayName: seat.name,
        color,
        kind: seat.kind,
        placement,
        tokensHome,
        capturesMade: s.capturesMade,
        timesCaptured: s.timesCaptured,
        sixesRolled: s.sixesRolled
      }
    })

    this.db.recordMatch({
      id: randomUUID(),
      roomCode: room.code,
      startedAt: room.startedAt ?? this.now(),
      endedAt: this.now(),
      playerCount: room.seats.length,
      rulesetVersion: '0.1.0',
      players
    })
  }

  private afterAction(room: Room) {
    this.trackEvents(room)
    if (room.state?.phase === 'over') {
      room.status = 'over'
      if (!room.recorded && this.db) {
        room.recorded = true
        this.recordFinishedMatch(room)
      }
    }
    this.touch(room)
  }

  roll(room: Room, playerId: string): Result {
    if (room.status !== 'playing' || !room.state) return fail('The game is not in progress.')
    if (room.state.phase !== 'roll') return fail('Choose a token to move first.')
    if (this.seatToAct(room)?.playerId !== playerId) return fail("It's not your turn.")
    room.state = rollDice(room.state, smartRollDie(room.state, this.rng))
    this.afterAction(room)
    return { ok: true }
  }

  move(room: Room, playerId: string, tokenIndex: unknown): Result {
    if (room.status !== 'playing' || !room.state) return fail('The game is not in progress.')
    if (room.state.phase !== 'move') return fail('Roll the die first.')
    if (this.seatToAct(room)?.playerId !== playerId) return fail("It's not your turn.")
    if (!Number.isInteger(tokenIndex)) return fail('Illegal move.')
    try {
      room.state = chooseMove(room.state, tokenIndex as number)
    } catch {
      return fail('Illegal move.')
    }
    this.afterAction(room)
    return { ok: true }
  }

  needsBot(room: Room): boolean {
    if (room.status !== 'playing' || !room.state) return false
    const seat = this.seatToAct(room)
    return !!seat && (seat.kind === 'bot' || !seat.connected)
  }

  botStep(room: Room): boolean {
    if (!this.needsBot(room) || !room.state) return false
    if (room.state.phase === 'roll') {
      room.state = rollDice(room.state, smartRollDie(room.state, this.rng))
    } else if (room.state.phase === 'move') {
      room.state = chooseMove(room.state, chooseBotMove(room.state))
    } else {
      return false
    }
    this.afterAction(room)
    return true
  }

  findBySocket(socketId: string): { room: Room; seat: Seat } | null {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socketId)
      if (seat) return { room, seat }
    }
    return null
  }

  leave(room: Room, playerId: string): void {
    const seat = this.seatOf(room, playerId)
    if (!seat) return
    if (room.status === 'playing') {
      seat.kind = 'bot'
      seat.name = `${seat.name} (computer)`
      seat.socketId = null
      seat.connected = true
    } else {
      room.seats = room.seats.filter((s) => s !== seat)
    }
    this.afterLeave(room)
  }

  disconnect(socketId: string): Room | null {
    const found = this.findBySocket(socketId)
    if (!found) return null
    const { room, seat } = found
    seat.socketId = null
    if (room.status === 'lobby') {
      room.seats = room.seats.filter((s) => s !== seat)
    } else {
      seat.connected = false
    }
    this.afterLeave(room)
    return this.rooms.get(room.code) ?? null
  }

  private afterLeave(room: Room) {
    const humans = this.humans(room)
    if (humans.length === 0) {
      this.rooms.delete(room.code)
      return
    }
    if (!room.seats.some((s) => s.playerId === room.hostId)) room.hostId = humans[0].playerId
    this.touch(room)
  }

  sweep(maxIdleMs = 2 * 60 * 60 * 1000): number {
    let removed = 0
    for (const [code, room] of this.rooms) {
      const anyoneHere = room.seats.some((s) => s.kind === 'human' && s.connected)
      const idle = this.now() - room.lastActive
      if (idle > maxIdleMs || (!anyoneHere && idle > 10 * 60 * 1000)) {
        this.rooms.delete(code)
        removed++
      }
    }
    return removed
  }

  publicView(room: Room, playerId: string | null): RoomPublic {
    return {
      code: room.code,
      mode: room.mode ?? 'solo',
      status: room.status,
      seats: room.seats.map((s) => ({
        name: s.name,
        kind: s.kind,
        color: s.color,
        connected: s.connected,
        isHost: s.playerId === room.hostId
      })),
      you: playerId
        ? room.seats.findIndex((s) => s.playerId === playerId) >= 0
          ? room.seats.findIndex((s) => s.playerId === playerId)
          : null
        : null
    }
  }
}
