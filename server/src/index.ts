import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@ludo/shared'
import { RoomManager, type Room } from './rooms'
import { Database } from './db'
import {
  authenticateSession,
  authLimiter,
  clearSessionCookie,
  createSessionCookie,
  generateSessionToken,
  hashPassword,
  hashToken,
  parseCookies,
  validatePassword,
  validateUsername,
  verifyPassword,
  SESSION_TTL_MS
} from './auth'

const PORT = Number(process.env.PORT ?? 3001)
const ORIGINS = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,https://meme-ludo.vercel.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const IS_PROD = process.env.NODE_ENV === 'production'

const BOT_DELAY_MS = 1100

// Initialize SQLite database and run versioned migrations
const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL('../db/ludo.db', import.meta.url))
const db = new Database(DB_PATH)
db.runMigrations(fileURLToPath(new URL('../db/migrations', import.meta.url)))

interface SocketData {
  playerId?: string
  code?: string
  user?: {
    id: string
    username: string
  }
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 50_000) {
        req.destroy()
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const sendJson = (res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    ...headers
  })
  res.end(JSON.stringify(data))
}

const http = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie')
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const ip = req.socket.remoteAddress ?? 'unknown'

  // Health check
  if (url.pathname === '/health') {
    return sendJson(res, 200, { ok: true })
  }

  // --- Auth & Account HTTP API ---

  // POST /api/register
  if (req.method === 'POST' && url.pathname === '/api/register') {
    if (!authLimiter.isAllowed(ip, 12, 60_000)) {
      return sendJson(res, 429, { ok: false, error: 'Too many requests. Please wait a minute.' })
    }
    try {
      const body = await parseJsonBody(req)
      const uRes = validateUsername(body.username)
      if (!uRes.ok) return sendJson(res, 400, { ok: false, error: uRes.error })
      const pRes = validatePassword(body.password)
      if (!pRes.ok) return sendJson(res, 400, { ok: false, error: pRes.error })

      const existing = db.findUserByUsername(uRes.value)
      if (existing) {
        return sendJson(res, 409, { ok: false, error: 'That username is already taken.' })
      }

      const userId = randomUUID()
      const pwHash = hashPassword(pRes.value)
      const user = db.createUser(userId, uRes.value, pwHash)

      // Create session
      const token = generateSessionToken()
      const tokenHash = hashToken(token)
      const expiresAt = Date.now() + SESSION_TTL_MS
      db.createSession(randomUUID(), user.id, tokenHash, expiresAt)

      const cookie = createSessionCookie(token, IS_PROD)
      return sendJson(res, 201, { ok: true, user: { id: user.id, username: user.username } }, {
        'Set-Cookie': cookie
      })
    } catch {
      return sendJson(res, 500, { ok: false, error: 'Registration failed.' })
    }
  }

  // POST /api/login
  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!authLimiter.isAllowed(ip, 12, 60_000)) {
      return sendJson(res, 429, { ok: false, error: 'Too many attempts. Please wait a minute.' })
    }
    try {
      const body = await parseJsonBody(req)
      const username = typeof body.username === 'string' ? body.username.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''

      const user = username ? db.findUserByUsername(username) : undefined
      const valid = user ? verifyPassword(password, user.password_hash) : false

      if (!user || !valid) {
        return sendJson(res, 401, { ok: false, error: 'Incorrect username or password.' })
      }

      const token = generateSessionToken()
      const tokenHash = hashToken(token)
      const expiresAt = Date.now() + SESSION_TTL_MS
      db.createSession(randomUUID(), user.id, tokenHash, expiresAt)

      const cookie = createSessionCookie(token, IS_PROD)
      return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username } }, {
        'Set-Cookie': cookie
      })
    } catch {
      return sendJson(res, 500, { ok: false, error: 'Login failed.' })
    }
  }

  // POST /api/logout
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies['ludo_session']
    if (token) {
      db.deleteSession(hashToken(token))
    }
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': clearSessionCookie(IS_PROD)
    })
  }

  // GET /api/me
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const auth = authenticateSession(db, req.headers.cookie)
    if (!auth) {
      return sendJson(res, 200, { ok: true, user: null, stats: null })
    }
    const stats = db.getUserStats(auth.user.id)
    return sendJson(res, 200, {
      ok: true,
      user: { id: auth.user.id, username: auth.user.username },
      stats
    })
  }

  // GET /api/history
  if (req.method === 'GET' && url.pathname === '/api/history') {
    const auth = authenticateSession(db, req.headers.cookie)
    const targetUserId = url.searchParams.get('userId') ?? auth?.user.id
    if (!targetUserId) {
      return sendJson(res, 401, { ok: false, error: 'Please sign in to view history.' })
    }
    const history = db.getUserHistory(targetUserId, 30)
    return sendJson(res, 200, { ok: true, history })
  }

  // GET /api/leaderboard
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 15)))
    const minGames = Math.max(1, Number(url.searchParams.get('minGames') ?? 1))
    const cursorWins = url.searchParams.get('cursorWins')
    const cursorWinRate = url.searchParams.get('cursorWinRate')
    const cursorTotalGames = url.searchParams.get('cursorTotalGames')
    const cursorUserId = url.searchParams.get('cursorUserId')

    let cursor = undefined
    if (cursorWins && cursorWinRate && cursorTotalGames && cursorUserId) {
      cursor = {
        wins: Number(cursorWins),
        winRate: Number(cursorWinRate),
        totalGames: Number(cursorTotalGames),
        userId: cursorUserId
      }
    }

    const entries = db.getLeaderboard(minGames, limit, cursor)
    return sendJson(res, 200, { ok: true, entries })
  }

  // DELETE /api/account
  if (req.method === 'DELETE' && url.pathname === '/api/account') {
    const auth = authenticateSession(db, req.headers.cookie)
    if (!auth) {
      return sendJson(res, 401, { ok: false, error: 'Not authenticated.' })
    }
    db.deleteUser(auth.user.id)
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': clearSessionCookie(IS_PROD)
    })
  }

  res.writeHead(404)
  res.end()
})

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  http,
  {
    cors: {
      origin: ORIGINS,
      credentials: true
    }
  }
)

const mgr = new RoomManager(undefined, undefined, db)

function broadcast(room: Room) {
  for (const seat of room.seats) {
    if (!seat.socketId) continue
    io.to(seat.socketId).emit('room:update', mgr.publicView(room, seat.playerId))
    if (room.state) io.to(seat.socketId).emit('game:state', room.state)
  }
}

// One pending computer move per room at a time.
const botTimers = new Map<string, NodeJS.Timeout>()
function scheduleBot(room: Room) {
  if (botTimers.has(room.code) || !mgr.needsBot(room)) return
  botTimers.set(
    room.code,
    setTimeout(() => {
      botTimers.delete(room.code)
      const r = mgr.rooms.get(room.code)
      if (!r) return
      if (mgr.botStep(r)) {
        broadcast(r)
        scheduleBot(r)
      }
    }, BOT_DELAY_MS)
  )
}

function changed(room: Room | null | undefined) {
  if (!room) return
  broadcast(room)
  scheduleBot(room)
}

io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie
  const auth = authenticateSession(db, cookieHeader)
  if (auth) {
    socket.data.user = { id: auth.user.id, username: auth.user.username }
  }
  next()
})

io.on('connection', (socket) => {
  let burst = 0
  const timer = setInterval(() => (burst = 0), 1000)
  socket.onAny(() => {
    if (++burst > 40) socket.disconnect(true)
  })

  const ctx = () => {
    const { code, playerId } = socket.data
    const room = code ? mgr.rooms.get(code) : undefined
    return room && playerId ? { room, playerId } : null
  }
  const noRoom = { ok: false as const, error: 'You are not in a room.' }

  socket.on('room:create', (payload: any, ack: any) => {
    const rawName = typeof payload === 'object' && payload !== null ? payload.name : payload
    const mode = typeof payload === 'object' && payload !== null && payload.mode === 'teams' ? 'teams' : 'solo'
    const displayName = socket.data.user ? socket.data.user.username : rawName
    const res = mgr.createRoom(displayName, socket.id, socket.data.user?.id, mode)
    if (!res.ok) return ack?.(res)
    socket.data.code = res.room.code
    socket.data.playerId = res.playerId
    ack?.({ ok: true, code: res.room.code, playerId: res.playerId })
    changed(res.room)
  })

  socket.on('room:setMode', (mode: any, ack: any) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const validMode = mode === 'teams' ? 'teams' : 'solo'
    const res = mgr.setMode(c.room, c.playerId, validMode)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('room:join', (p, ack) => {
    const displayName = socket.data.user ? socket.data.user.username : p?.name
    const res = mgr.joinRoom(p?.code, displayName, socket.id, p?.playerId, socket.data.user?.id)
    if (!res.ok) return ack?.(res)
    socket.data.code = res.room.code
    socket.data.playerId = res.playerId
    ack?.({ ok: true, code: res.room.code, playerId: res.playerId })
    changed(res.room)
  })

  socket.on('room:addBot', (ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.addBot(c.room, c.playerId)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('room:removeSeat', (index, ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.removeSeat(c.room, c.playerId, index)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('room:swapSeats', (index1, index2, ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.swapSeats(c.room, c.playerId, index1, index2)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('room:start', (ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.start(c.room, c.playerId)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('game:roll', (ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.roll(c.room, c.playerId)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('game:move', (tokenIndex, ack) => {
    const c = ctx()
    if (!c) return ack?.(noRoom)
    const res = mgr.move(c.room, c.playerId, tokenIndex)
    ack?.(res)
    if (res.ok) changed(c.room)
  })

  socket.on('room:leave', () => {
    const c = ctx()
    if (!c) return
    mgr.leave(c.room, c.playerId)
    socket.data.code = undefined
    socket.data.playerId = undefined
    changed(mgr.rooms.get(c.room.code))
  })

  socket.on('disconnect', () => {
    clearInterval(timer)
    changed(mgr.disconnect(socket.id))
  })
})

setInterval(() => mgr.sweep(), 10 * 60 * 1000).unref()

http.listen(PORT, () => {
  console.log(`Ludo server listening on :${PORT} (allowed origins: ${ORIGINS.join(', ')})`)
})
