import { describe, expect, it } from 'vitest'
import { chooseBotMove } from '@ludo/shared'
import { RoomManager, type Room } from '../src/rooms'

// Small seeded RNG so game tests are repeatable.
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lobby(mgr: RoomManager) {
  const res = mgr.createRoom('Asha', 's1')
  if (!res.ok) throw new Error(res.error)
  return { room: res.room, hostId: res.playerId }
}

describe('lobby', () => {
  it('creates a room with the host seated', () => {
    const { room } = lobby(new RoomManager())
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
    expect(room.seats).toHaveLength(1)
    expect(room.status).toBe('lobby')
  })
  it('lets others join by code (case-insensitive) and rejects bad codes', () => {
    const mgr = new RoomManager()
    const { room } = lobby(mgr)
    expect(mgr.joinRoom(room.code.toLowerCase(), 'Ben', 's2').ok).toBe(true)
    expect(mgr.joinRoom('ZZZZZ', 'Ben', 's3').ok).toBe(false)
  })
  it('rejects a fifth player', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    const r = mgr.joinRoom(room.code, 'Late', 's9')
    expect(r.ok).toBe(false)
  })
  it('only the host can add computers, remove seats and start', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    const j = mgr.joinRoom(room.code, 'Ben', 's2')
    if (!j.ok) throw new Error()
    expect(mgr.addBot(room, j.playerId).ok).toBe(false)
    expect(mgr.start(room, j.playerId).ok).toBe(false)
    expect(mgr.start(room, hostId).ok).toBe(true)
  })
  it('needs two players to start', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    expect(mgr.start(room, hostId).ok).toBe(false)
  })
  it('assigns opposite colours to two players', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.start(room, hostId)
    expect(room.seats.map((s) => s.color)).toEqual(['red', 'yellow'])
  })
  it('hands the host role on when the host leaves the lobby', () => {
    const mgr = new RoomManager()
    const { room } = lobby(mgr)
    const j = mgr.joinRoom(room.code, 'Ben', 's2')
    if (!j.ok) throw new Error()
    mgr.disconnect('s1')
    expect(room.hostId).toBe(j.playerId)
  })
  it('deletes a room when the last human leaves', () => {
    const mgr = new RoomManager()
    const { room } = lobby(mgr)
    mgr.disconnect('s1')
    expect(mgr.rooms.has(room.code)).toBe(false)
  })
})

describe('turns are enforced by the server', () => {
  function started() {
    const mgr = new RoomManager(seeded(7))
    const { room, hostId } = lobby(mgr)
    const j = mgr.joinRoom(room.code, 'Ben', 's2')
    if (!j.ok) throw new Error()
    mgr.start(room, hostId)
    return { mgr, room, host: hostId, guest: j.playerId }
  }
  it("rejects a roll from the player whose turn it isn't", () => {
    const { mgr, room, guest } = started()
    expect(mgr.roll(room, guest).ok).toBe(false)
  })
  it('rejects moving before rolling', () => {
    const { mgr, room, host } = started()
    expect(mgr.move(room, host, 0).ok).toBe(false)
  })
  it('rejects rolling in the lobby', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    expect(mgr.roll(room, hostId).ok).toBe(false)
  })
  it('lets the current player roll', () => {
    const { mgr, room, host } = started()
    expect(mgr.roll(room, host).ok).toBe(true)
    expect(room.state!.events.some((e) => e.type === 'rolled')).toBe(true)
  })
})

describe('reconnecting', () => {
  it('a dropped player keeps their seat and can rejoin with their id', () => {
    const mgr = new RoomManager(seeded(3))
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.start(room, hostId)
    mgr.disconnect('s1')
    expect(room.seats[0].connected).toBe(false)
    const back = mgr.joinRoom(room.code, 'Asha', 'new-socket', hostId)
    expect(back.ok).toBe(true)
    expect(room.seats[0].connected).toBe(true)
    expect(room.seats[0].socketId).toBe('new-socket')
  })
  it('the computer plays for an absent player', () => {
    const mgr = new RoomManager(seeded(3))
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.start(room, hostId)
    mgr.disconnect('s1')
    expect(mgr.needsBot(room)).toBe(true)
    expect(mgr.botStep(room)).toBe(true)
  })
  it('a stranger cannot take a seat by guessing', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.start(room, hostId)
    expect(mgr.joinRoom(room.code, 'X', 's9', 'not-a-real-id').ok).toBe(false)
  })
})

describe('full games', () => {
  it.each([11, 22, 33])('a 4-player game with one human and 3 computers finishes (seed %i)', (seed) => {
    const mgr = new RoomManager(seeded(seed))
    const { room, hostId } = lobby(mgr)
    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    mgr.start(room, hostId)

    let steps = 0
    while ((room as Room).status === 'playing' && steps++ < 50000) {
      const human = room.seats[0].color === (room.state as any).players[(room.state as any).turn]
      if (human) {
        // the human seat plays like a bot, through the public actions
        if (room.state!.phase === 'roll') expect(mgr.roll(room, hostId).ok).toBe(true)
        else expect(mgr.move(room, hostId, chooseBotMove(room.state!)).ok).toBe(true)
      } else {
        expect(mgr.botStep(room)).toBe(true)
      }
    }
    expect(room.status).toBe('over')
    expect(room.state!.placements).toHaveLength(4)
    expect(new Set(room.state!.placements).size).toBe(4)
  })
})

describe('team rooms', () => {
  it('creates a room in teams mode and enforces 4 players to start', () => {
    const mgr = new RoomManager()
    const res = mgr.createRoom('Host', 's1', null, 'teams')
    if (!res.ok) throw new Error(res.error)
    const { room, playerId: hostId } = res
    expect(room.mode).toBe('teams')

    // Cannot start with only 1 player
    expect(mgr.start(room, hostId).ok).toBe(false)

    // Add 2 bots -> 3 players, still cannot start in teams mode
    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    expect(mgr.start(room, hostId).ok).toBe(false)

    // Add 3rd bot -> 4 players, can now start
    mgr.addBot(room, hostId)
    expect(mgr.start(room, hostId).ok).toBe(true)
    expect(room.status).toBe('playing')
    expect(room.state?.mode).toBe('teams')
    expect(room.seats.map((s) => s.color)).toEqual(['red', 'green', 'yellow', 'blue'])
  })

  it('allows changing mode in lobby by host', () => {
    const mgr = new RoomManager()
    const { room, hostId } = lobby(mgr)
    expect(room.mode).toBe('solo')

    expect(mgr.setMode(room, hostId, 'teams').ok).toBe(true)
    expect(room.mode).toBe('teams')
  })

  it('allows host to swap players in teams mode, and rejects non-hosts', () => {
    const mgr = new RoomManager()
    const res = mgr.createRoom('Host', 's1', null, 'teams')
    if (!res.ok) throw new Error(res.error)
    const { room, playerId: hostId } = res

    const guestRes = mgr.joinRoom(room.code, 'Guest', 's2')
    if (!guestRes.ok) throw new Error(guestRes.error)
    const guestId = guestRes.playerId

    mgr.addBot(room, hostId)
    mgr.addBot(room, hostId)
    expect(room.seats.map((s) => s.name)).toEqual(['Host', 'Guest', 'Computer 1', 'Computer 2'])

    // Non-host (guest) tries to swap players -> REJECTED
    const guestAttempt = mgr.swapSeats(room, guestId, 0, 1)
    expect(guestAttempt.ok).toBe(false)
    if (!guestAttempt.ok) {
      expect(guestAttempt.error).toBe('Only the host can swap players.')
    }

    // Host swaps Seat 1 (Guest) and Seat 2 (Computer 1)
    const hostAttempt = mgr.swapSeats(room, hostId, 1, 2)
    expect(hostAttempt.ok).toBe(true)
    expect(room.seats.map((s) => s.name)).toEqual(['Host', 'Computer 1', 'Guest', 'Computer 2'])

    // Now Guest is Seat 2 (Team A partner of Host at Seat 0!)
    // Invalid index is rejected
    expect(mgr.swapSeats(room, hostId, 1, 99).ok).toBe(false)

    // Cannot swap once game has started
    mgr.start(room, hostId)
    expect(mgr.swapSeats(room, hostId, 0, 1).ok).toBe(false)
  })

  it('ensures normal users (guests) receive isHost: false in publicView and cannot adjust teams or mode', () => {
    const mgr = new RoomManager()
    const res = mgr.createRoom('HostPlayer', 's1', null, 'teams')
    if (!res.ok) throw new Error(res.error)
    const { room, playerId: hostId } = res

    const guestRes = mgr.joinRoom(room.code, 'NormalGuest', 's2')
    if (!guestRes.ok) throw new Error(guestRes.error)
    const guestId = guestRes.playerId

    // Host view: host seat has isHost = true, guest seat has isHost = false
    const hostView = mgr.publicView(room, hostId)
    expect(hostView.you).toBe(0)
    expect(hostView.seats[0].isHost).toBe(true)
    expect(hostView.seats[1].isHost).toBe(false)

    // Normal guest view: you points to seat 1, own seat has isHost = false
    const guestView = mgr.publicView(room, guestId)
    expect(guestView.you).toBe(1)
    expect(guestView.seats[guestView.you!].isHost).toBe(false)

    // Normal guest cannot perform host actions:
    expect(mgr.swapSeats(room, guestId, 0, 1).ok).toBe(false)
    expect(mgr.setMode(room, guestId, 'solo').ok).toBe(false)
    expect(mgr.removeSeat(room, guestId, 0).ok).toBe(false)
    expect(mgr.addBot(room, guestId).ok).toBe(false)
    expect(mgr.start(room, guestId).ok).toBe(false)
  })
})

