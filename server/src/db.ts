import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const req = createRequire(import.meta.url)
const { DatabaseSync } = req('node:sqlite')
type DatabaseSyncType = InstanceType<typeof import('node:sqlite').DatabaseSync>

export interface UserRow {
  id: string
  username: string
  password_hash: string
  created_at: number
}

export interface SessionRow {
  id: string
  user_id: string
  token_hash: string
  created_at: number
  expires_at: number
  last_seen_at: number
}

export interface MatchPlayerInput {
  seatIndex: number
  userId: string | null
  displayName: string
  color: string
  kind: 'human' | 'bot'
  placement: number
  tokensHome: number
  capturesMade: number
  timesCaptured: number
  sixesRolled: number
}

export interface MatchInput {
  id: string
  roomCode: string
  startedAt: number
  endedAt: number
  playerCount: number
  rulesetVersion: string
  players: MatchPlayerInput[]
}

export interface UserStats {
  totalGames: number
  wins: number
  winRate: number
  avgPlacement: number
  totalCaptures: number
  totalTimesCaptured: number
  totalSixes: number
  longestWinStreak: number
}

export interface LeaderboardEntry {
  userId: string
  username: string
  totalGames: number
  wins: number
  winRate: number
  totalCaptures: number
}

export interface KeysetCursor {
  wins: number
  winRate: number
  totalGames: number
  userId: string
}

export interface MatchHistoryItem {
  matchId: string
  roomCode: string
  startedAt: number
  endedAt: number
  playerCount: number
  color: string
  placement: number
  tokensHome: number
  capturesMade: number
  timesCaptured: number
  sixesRolled: number
  opponents: {
    displayName: string
    color: string
    placement: number
    kind: string
    userId: string | null
  }[]
}

export class Database {
  readonly db: DatabaseSyncType

  constructor(location: string = ':memory:') {
    this.db = new DatabaseSync(location)
    // Enforce foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON;')
  }

  /** Run versioned migration scripts in alphanumeric order */
  runMigrations(migrationsDir?: string): void {
    const dir = migrationsDir ?? fileURLToPath(new URL('../db/migrations', import.meta.url))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `)

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const checkStmt = this.db.prepare('SELECT version FROM schema_migrations WHERE version = ?')
    const insertStmt = this.db.prepare(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
    )

    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const applied = checkStmt.get(version)
      if (applied) continue

      const sql = readFileSync(join(dir, file), 'utf-8')
      this.db.exec('BEGIN IMMEDIATE TRANSACTION;')
      try {
        this.db.exec(sql)
        insertStmt.run(version, Date.now())
        this.db.exec('COMMIT;')
      } catch (err) {
        this.db.exec('ROLLBACK;')
        throw err
      }
    }
  }

  // --- Users & Sessions ---

  createUser(id: string, username: string, passwordHash: string): UserRow {
    const now = Date.now()
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(id, username, passwordHash, now)
    return { id, username, password_hash: passwordHash, created_at: now }
  }

  findUserByUsername(username: string): UserRow | undefined {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at
      FROM users
      WHERE username = ? COLLATE NOCASE
    `)
    return stmt.get(username) as UserRow | undefined
  }

  findUserById(id: string): UserRow | undefined {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at
      FROM users
      WHERE id = ?
    `)
    return stmt.get(id) as UserRow | undefined
  }

  createSession(id: string, userId: string, tokenHash: string, expiresAt: number): SessionRow {
    const now = Date.now()
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, userId, tokenHash, now, expiresAt, now)
    return { id, user_id: userId, token_hash: tokenHash, created_at: now, expires_at: expiresAt, last_seen_at: now }
  }

  findSessionByTokenHash(tokenHash: string): (SessionRow & { username: string }) | undefined {
    const stmt = this.db.prepare(`
      SELECT s.id, s.user_id, s.token_hash, s.created_at, s.expires_at, s.last_seen_at, u.username
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `)
    const res = stmt.get(tokenHash, Date.now()) as (SessionRow & { username: string }) | undefined
    if (res) {
      this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), res.id)
    }
    return res
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  }

  deleteUser(userId: string): void {
    // Foreign keys: sessions deleted via CASCADE; match_players set user_id to NULL
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  }

  // --- Matches & Players ---

  recordMatch(m: MatchInput): void {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;')
    try {
      const matchStmt = this.db.prepare(`
        INSERT INTO matches (id, room_code, started_at, ended_at, player_count, ruleset_version)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      matchStmt.run(m.id, m.roomCode, m.startedAt, m.endedAt, m.playerCount, m.rulesetVersion)

      const playerStmt = this.db.prepare(`
        INSERT INTO match_players (
          match_id, seat_index, user_id, display_name, color, kind, placement,
          tokens_home, captures_made, times_captured, sixes_rolled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const p of m.players) {
        playerStmt.run(
          m.id,
          p.seatIndex,
          p.userId,
          p.displayName,
          p.color,
          p.kind,
          p.placement,
          p.tokensHome,
          p.capturesMade,
          p.timesCaptured,
          p.sixesRolled
        )
      }
      this.db.exec('COMMIT;')
    } catch (err) {
      this.db.exec('ROLLBACK;')
      throw err
    }
  }

  // --- Statistics & Queries (Hand-written SQL) ---

  getUserStats(userId: string): UserStats {
    const aggStmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total_games,
        COALESCE(SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END), 0) AS wins,
        ROUND(COALESCE(AVG(mp.placement), 0.0), 2) AS avg_placement,
        COALESCE(SUM(mp.captures_made), 0) AS total_captures,
        COALESCE(SUM(mp.times_captured), 0) AS total_times_captured,
        COALESCE(SUM(mp.sixes_rolled), 0) AS total_sixes
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = ?
    `)
    const agg = aggStmt.get(userId) as Record<string, number>

    const totalGames = agg.total_games || 0
    const wins = agg.wins || 0
    const winRate = totalGames > 0 ? Number(((wins / totalGames) * 100).toFixed(1)) : 0
    const avgPlacement = agg.avg_placement || 0
    const totalCaptures = agg.total_captures || 0
    const totalTimesCaptured = agg.total_times_captured || 0
    const totalSixes = agg.total_sixes || 0

    // Gaps-and-islands query using window functions to find longest win streak
    const streakStmt = this.db.prepare(`
      WITH user_games AS (
        SELECT
          m.ended_at,
          (CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END) AS is_win,
          ROW_NUMBER() OVER (ORDER BY m.ended_at ASC) AS rn,
          ROW_NUMBER() OVER (
            PARTITION BY (CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END)
            ORDER BY m.ended_at ASC
          ) AS win_rn
        FROM match_players mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = ?
      ),
      streaks AS (
        SELECT
          COUNT(*) AS streak_len
        FROM user_games
        WHERE is_win = 1
        GROUP BY (rn - win_rn)
      )
      SELECT COALESCE(MAX(streak_len), 0) AS longest_streak FROM streaks;
    `)
    const streakRow = streakStmt.get(userId) as { longest_streak: number } | undefined
    const longestWinStreak = streakRow?.longest_streak || 0

    return {
      totalGames,
      wins,
      winRate,
      avgPlacement,
      totalCaptures,
      totalTimesCaptured,
      totalSixes,
      longestWinStreak
    }
  }

  getUserHistory(userId: string, limit = 20): MatchHistoryItem[] {
    const matchesStmt = this.db.prepare(`
      SELECT
        m.id AS match_id,
        m.room_code,
        m.started_at,
        m.ended_at,
        m.player_count,
        mp.color,
        mp.placement,
        mp.tokens_home,
        mp.captures_made,
        mp.times_captured,
        mp.sixes_rolled
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = ?
      ORDER BY m.ended_at DESC
      LIMIT ?
    `)
    const rows = matchesStmt.all(userId, limit) as Record<string, unknown>[]
    if (rows.length === 0) return []

    const oppStmt = this.db.prepare(`
      SELECT
        match_id,
        display_name,
        color,
        placement,
        kind,
        user_id
      FROM match_players
      WHERE match_id = ? AND (user_id IS NULL OR user_id != ?)
      ORDER BY placement ASC
    `)

    return rows.map((r) => {
      const matchId = String(r.match_id)
      const opps = oppStmt.all(matchId, userId) as Record<string, unknown>[]
      return {
        matchId,
        roomCode: String(r.room_code),
        startedAt: Number(r.started_at),
        endedAt: Number(r.ended_at),
        playerCount: Number(r.player_count),
        color: String(r.color),
        placement: Number(r.placement),
        tokensHome: Number(r.tokens_home),
        capturesMade: Number(r.captures_made),
        timesCaptured: Number(r.times_captured),
        sixesRolled: Number(r.sixes_rolled),
        opponents: opps.map((o) => ({
          displayName: String(o.display_name),
          color: String(o.color),
          placement: Number(o.placement),
          kind: String(o.kind),
          userId: o.user_id ? String(o.user_id) : null
        }))
      }
    })
  }

  /**
   * Deterministic leaderboard with keyset pagination (no OFFSET).
   * Sorted by wins DESC, win_rate DESC, total_games ASC, user_id ASC.
   */
  getLeaderboard(minGames = 1, limit = 15, cursor?: KeysetCursor): LeaderboardEntry[] {
    let sql = `
      SELECT
        u.id AS user_id,
        u.username,
        COUNT(mp.match_id) AS total_games,
        COALESCE(SUM(CASE WHEN mp.placement = 1 THEN 1 ELSE 0 END), 0) AS wins,
        ROUND(COALESCE(SUM(CASE WHEN mp.placement = 1 THEN 1.0 ELSE 0.0 END), 0.0) / COUNT(mp.match_id) * 100.0, 1) AS win_rate,
        COALESCE(SUM(mp.captures_made), 0) AS total_captures
      FROM users u
      JOIN match_players mp ON mp.user_id = u.id
      GROUP BY u.id, u.username
      HAVING COUNT(mp.match_id) >= ?
    `

    const params: (number | string)[] = [minGames]

    if (cursor) {
      sql = `
        WITH leaderboard_all AS (${sql})
        SELECT * FROM leaderboard_all
        WHERE (
          wins < ?
          OR (wins = ? AND win_rate < ?)
          OR (wins = ? AND win_rate = ? AND total_games > ?)
          OR (wins = ? AND win_rate = ? AND total_games = ? AND user_id > ?)
        )
        ORDER BY wins DESC, win_rate DESC, total_games ASC, user_id ASC
        LIMIT ?
      `
      params.push(
        cursor.wins,
        cursor.wins,
        cursor.winRate,
        cursor.wins,
        cursor.winRate,
        cursor.totalGames,
        cursor.wins,
        cursor.winRate,
        cursor.totalGames,
        cursor.userId,
        limit
      )
    } else {
      sql = `
        WITH leaderboard_all AS (${sql})
        SELECT * FROM leaderboard_all
        ORDER BY wins DESC, win_rate DESC, total_games ASC, user_id ASC
        LIMIT ?
      `
      params.push(limit)
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map((r) => ({
      userId: String(r.user_id),
      username: String(r.username),
      totalGames: Number(r.total_games),
      wins: Number(r.wins),
      winRate: Number(r.win_rate),
      totalCaptures: Number(r.total_captures)
    }))
  }

  /** Head-to-head comparison between two users */
  getHeadToHead(
    userAId: string,
    userBId: string
  ): {
    matchesPlayed: number
    userAWinsOverB: number
    userBWinsOverA: number
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total_matches,
        COALESCE(SUM(CASE WHEN p1.placement < p2.placement THEN 1 ELSE 0 END), 0) AS a_ahead,
        COALESCE(SUM(CASE WHEN p2.placement < p1.placement THEN 1 ELSE 0 END), 0) AS b_ahead
      FROM match_players p1
      JOIN match_players p2 ON p1.match_id = p2.match_id AND p2.user_id = ?
      WHERE p1.user_id = ?
    `)
    const res = stmt.get(userBId, userAId) as Record<string, number> | undefined
    return {
      matchesPlayed: res?.total_matches || 0,
      userAWinsOverB: res?.a_ahead || 0,
      userBWinsOverA: res?.b_ahead || 0
    }
  }

  close(): void {
    this.db.close()
  }
}
