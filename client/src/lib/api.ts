export interface User {
  id: string
  username: string
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

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export const api = {
  async getMe(): Promise<{ user: User | null; stats: UserStats | null }> {
    try {
      const res = await request<{ ok: boolean; user: User | null; stats: UserStats | null }>('/api/me')
      return { user: res.user, stats: res.stats }
    } catch {
      return { user: null, stats: null }
    }
  },

  async login(username: string, password: string): Promise<{ user: User }> {
    const res = await request<{ ok: boolean; user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    return { user: res.user }
  },

  async register(username: string, password: string): Promise<{ user: User }> {
    const res = await request<{ ok: boolean; user: User }>('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    return { user: res.user }
  },

  async logout(): Promise<void> {
    await request('/api/logout', { method: 'POST' })
  },

  async getHistory(userId?: string): Promise<MatchHistoryItem[]> {
    const path = userId ? `/api/history?userId=${encodeURIComponent(userId)}` : '/api/history'
    const res = await request<{ ok: boolean; history: MatchHistoryItem[] }>(path)
    return res.history
  },

  async getLeaderboard(
    minGames = 1,
    limit = 15,
    cursor?: { wins: number; winRate: number; totalGames: number; userId: string }
  ): Promise<LeaderboardEntry[]> {
    const params = new URLSearchParams({
      minGames: String(minGames),
      limit: String(limit)
    })
    if (cursor) {
      params.set('cursorWins', String(cursor.wins))
      params.set('cursorWinRate', String(cursor.winRate))
      params.set('cursorTotalGames', String(cursor.totalGames))
      params.set('cursorUserId', cursor.userId)
    }
    const res = await request<{ ok: boolean; entries: LeaderboardEntry[] }>(
      `/api/leaderboard?${params.toString()}`
    )
    return res.entries
  },

  async deleteAccount(): Promise<void> {
    await request('/api/account', { method: 'DELETE' })
  }
}
