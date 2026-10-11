import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Database } from '../src/db'
import { RoomManager } from '../src/rooms'
import {
  hashPassword,
  verifyPassword,
  validateUsername,
  validatePassword,
  hashToken,
  generateSessionToken
} from '../src/auth'

describe('Database and Migrations', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
    const migrationsDir = join(__dirname, '../db/migrations')
    db.runMigrations(migrationsDir)
  })

  afterEach(() => {
    db.close()
  })

  it('runs migrations and creates tables', () => {
    const row = db.db
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as { cnt: number }
    expect(row.cnt).toBe(1)
  })

  it('enforces foreign key constraints and username uniqueness', () => {
    const pw = hashPassword('secret123')
    db.createUser('u1', 'Alice', pw)

    // Case-insensitive uniqueness check
    expect(() => db.createUser('u2', 'alice', pw)).toThrow()

    // Create session
    const token = generateSessionToken()
    const tokenHash = hashToken(token)
    db.createSession('s1', 'u1', tokenHash, Date.now() + 60_000)

    const session = db.findSessionByTokenHash(tokenHash)
    expect(session).toBeDefined()
    expect(session?.username).toBe('Alice')

    // Deleting user cascades sessions
    db.deleteUser('u1')
    expect(db.findSessionByTokenHash(tokenHash)).toBeUndefined()
  })

  it('records match and computes statistics and longest win streak', () => {
    const pw = hashPassword('pass123')
    db.createUser('u1', 'Champion', pw)

    // Sequence of 5 matches for Champion: Win, Win, Loss, Win, Win, Win (longest streak = 3)
    const outcomes = [
      { id: 'm1', placement: 1, endedAt: 1000 },
      { id: 'm2', placement: 1, endedAt: 2000 },
      { id: 'm3', placement: 3, endedAt: 3000 },
      { id: 'm4', placement: 1, endedAt: 4000 },
      { id: 'm5', placement: 1, endedAt: 5000 },
      { id: 'm6', placement: 1, endedAt: 6000 }
    ]

    for (const match of outcomes) {
      db.recordMatch({
        id: match.id,
        roomCode: 'ABC12',
        startedAt: match.endedAt - 500,
        endedAt: match.endedAt,
        playerCount: 2,
        rulesetVersion: '0.1.0',
        players: [
          {
            seatIndex: 0,
            userId: 'u1',
            displayName: 'Champion',
            color: 'red',
            kind: 'human',
            placement: match.placement,
            tokensHome: match.placement === 1 ? 4 : 2,
            capturesMade: 3,
            timesCaptured: 1,
            sixesRolled: 5
          },
          {
            seatIndex: 1,
            userId: null,
            displayName: 'Bot',
            color: 'yellow',
            kind: 'bot',
            placement: match.placement === 1 ? 2 : 1,
            tokensHome: match.placement === 1 ? 2 : 4,
            capturesMade: 1,
            timesCaptured: 3,
            sixesRolled: 3
          }
        ]
      })
    }

    const stats = db.getUserStats('u1')
    expect(stats.totalGames).toBe(6)
    expect(stats.wins).toBe(5)
    expect(stats.winRate).toBe(83.3)
    expect(stats.totalCaptures).toBe(18)
    expect(stats.longestWinStreak).toBe(3) // 3 in a row
  })

  it('paginates leaderboard with keyset pagination', () => {
    const pw = hashPassword('pass123')
    db.createUser('u1', 'PlayerOne', pw)
    db.createUser('u2', 'PlayerTwo', pw)
    db.createUser('u3', 'PlayerThree', pw)

    // PlayerOne: 2 wins
    for (let i = 0; i < 2; i++) {
      db.recordMatch({
        id: `m_p1_${i}`,
        roomCode: 'RM001',
        startedAt: 100,
        endedAt: 200 + i,
        playerCount: 2,
        rulesetVersion: '0.1.0',
        players: [
          {
            seatIndex: 0,
            userId: 'u1',
            displayName: 'PlayerOne',
            color: 'red',
            kind: 'human',
            placement: 1,
            tokensHome: 4,
            capturesMade: 2,
            timesCaptured: 0,
            sixesRolled: 4
          },
          {
            seatIndex: 1,
            userId: 'u2',
            displayName: 'PlayerTwo',
            color: 'yellow',
            kind: 'human',
            placement: 2,
            tokensHome: 1,
            capturesMade: 0,
            timesCaptured: 2,
            sixesRolled: 2
          }
        ]
      })
    }

    // PlayerThree: 1 win
    db.recordMatch({
      id: 'm_p3_0',
      roomCode: 'RM002',
      startedAt: 300,
      endedAt: 400,
      playerCount: 2,
      rulesetVersion: '0.1.0',
      players: [
        {
          seatIndex: 0,
          userId: 'u3',
          displayName: 'PlayerThree',
          color: 'red',
          kind: 'human',
          placement: 1,
          tokensHome: 4,
          capturesMade: 1,
          timesCaptured: 0,
          sixesRolled: 3
        },
        {
          seatIndex: 1,
          userId: null,
          displayName: 'Computer',
          color: 'yellow',
          kind: 'bot',
          placement: 2,
          tokensHome: 0,
          capturesMade: 0,
          timesCaptured: 1,
          sixesRolled: 1
        }
      ]
    })

    // Fetch page 1 (limit 2)
    const page1 = db.getLeaderboard(1, 2)
    expect(page1).toHaveLength(2)
    expect(page1[0].username).toBe('PlayerOne') // 2 wins

    // Keyset paginate to next item
    const last = page1[page1.length - 1]
    const page2 = db.getLeaderboard(1, 2, {
      wins: last.wins,
      winRate: last.winRate,
      totalGames: last.totalGames,
      userId: last.userId
    })
    expect(page2.length).toBeGreaterThanOrEqual(1)
    expect(page2.some((p) => p.userId === page1[0].userId)).toBe(false)
  })

  it('calculates head-to-head records accurately', () => {
    const pw = hashPassword('pass123')
    db.createUser('uA', 'Alice', pw)
    db.createUser('uB', 'Bob', pw)

    // Alice beats Bob
    db.recordMatch({
      id: 'm_h2h_1',
      roomCode: 'H2H01',
      startedAt: 100,
      endedAt: 200,
      playerCount: 2,
      rulesetVersion: '0.1.0',
      players: [
        {
          seatIndex: 0,
          userId: 'uA',
          displayName: 'Alice',
          color: 'red',
          kind: 'human',
          placement: 1,
          tokensHome: 4,
          capturesMade: 2,
          timesCaptured: 0,
          sixesRolled: 4
        },
        {
          seatIndex: 1,
          userId: 'uB',
          displayName: 'Bob',
          color: 'yellow',
          kind: 'human',
          placement: 2,
          tokensHome: 1,
          capturesMade: 0,
          timesCaptured: 2,
          sixesRolled: 2
        }
      ]
    })

    const h2h = db.getHeadToHead('uA', 'uB')
    expect(h2h.matchesPlayed).toBe(1)
    expect(h2h.userAWinsOverB).toBe(1)
    expect(h2h.userBWinsOverA).toBe(0)
  })

  it('anonymizes matches on user deletion (ON DELETE SET NULL)', () => {
    const pw = hashPassword('pass123')
    db.createUser('uDel', 'DeleteMe', pw)

    db.recordMatch({
      id: 'm_del_1',
      roomCode: 'DEL01',
      startedAt: 100,
      endedAt: 200,
      playerCount: 2,
      rulesetVersion: '0.1.0',
      players: [
        {
          seatIndex: 0,
          userId: 'uDel',
          displayName: 'DeleteMe',
          color: 'red',
          kind: 'human',
          placement: 1,
          tokensHome: 4,
          capturesMade: 0,
          timesCaptured: 0,
          sixesRolled: 0
        },
        {
          seatIndex: 1,
          userId: null,
          displayName: 'Bot',
          color: 'yellow',
          kind: 'bot',
          placement: 2,
          tokensHome: 0,
          capturesMade: 0,
          timesCaptured: 0,
          sixesRolled: 0
        }
      ]
    })

    db.deleteUser('uDel')
    const matchRow = db.db.prepare('SELECT user_id, display_name FROM match_players WHERE match_id = ?').get('m_del_1') as {
      user_id: string | null
      display_name: string
    }
    expect(matchRow.user_id).toBeNull()
    expect(matchRow.display_name).toBe('DeleteMe') // match record preserved
  })

  it('records match exactly once when a game ends in RoomManager', () => {
    db.createUser('uHost', 'HostUser', hashPassword('pass123'))
    const mgr = new RoomManager(() => 0.5, () => 1000, db)
    const createRes = mgr.createRoom('Host', 'sock1', 'uHost')
    expect(createRes.ok).toBe(true)
    if (!createRes.ok) return
    const room = createRes.room
    mgr.addBot(room, createRes.playerId)
    mgr.start(room, createRes.playerId)

    // Simulate game over state
    room.state!.phase = 'over'
    room.state!.placements = ['red', 'yellow']
    room.state!.tokens.red = [56, 56, 56, 56]
    room.state!.tokens.yellow = [0, 0, 0, 0]

    // @ts-expect-error testing afterAction directly
    mgr.afterAction(room)

    const matchesCount1 = db.db.prepare('SELECT count(*) as cnt FROM matches').get() as { cnt: number }
    expect(matchesCount1.cnt).toBe(1)

    // Calling afterAction again should NOT create duplicate match row
    // @ts-expect-error testing afterAction directly
    mgr.afterAction(room)
    const matchesCount2 = db.db.prepare('SELECT count(*) as cnt FROM matches').get() as { cnt: number }
    expect(matchesCount2.cnt).toBe(1)
  })
})

describe('Auth validation and hashing', () => {
  it('hashes passwords with scrypt and verifies correctly', () => {
    const password = 'mySecretPassword123'
    const hash = hashPassword(password)
    expect(hash).toContain(':')
    expect(verifyPassword(password, hash)).toBe(true)
    expect(verifyPassword('wrongPassword', hash)).toBe(false)
  })

  it('validates username criteria', () => {
    expect(validateUsername('Alice_99')).toEqual({ ok: true, value: 'Alice_99' })
    expect(validateUsername('al')).toEqual({ ok: false, error: 'Username must be between 3 and 20 characters.' })
    expect(validateUsername('bad name!')).toEqual({
      ok: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens.'
    })
  })

  it('validates password criteria', () => {
    expect(validatePassword('123456')).toEqual({ ok: true, value: '123456' })
    expect(validatePassword('short')).toEqual({
      ok: false,
      error: 'Password must be between 6 and 100 characters.'
    })
  })
})
