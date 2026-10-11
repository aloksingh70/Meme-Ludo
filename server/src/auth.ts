import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import type { Database, UserRow } from './db'

const SCRYPT_KEYLEN = 64
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'ludo_session'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `${salt}:${derivedKey.toString('hex')}`
}

export function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, hashHex] = combined.split(':')
    if (!salt || !hashHex) return false
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex') // 256 bits of entropy
}

export function validateUsername(username: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof username !== 'string') return { ok: false, error: 'Username must be a string.' }
  const trimmed = username.trim()
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { ok: false, error: 'Username must be between 3 and 20 characters.' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { ok: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' }
  }
  return { ok: true, value: trimmed }
}

export function validatePassword(password: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== 'string') return { ok: false, error: 'Password must be a string.' }
  if (password.length < 6 || password.length > 100) {
    return { ok: false, error: 'Password must be between 6 and 100 characters.' }
  }
  return { ok: true, value: password }
}

/** In-memory rate limiter per IP */
class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>()

  isAllowed(key: string, limit = 10, windowMs = 60_000): boolean {
    const now = Date.now()
    const record = this.attempts.get(key)
    if (!record || now > record.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (record.count >= limit) return false
    record.count++
    return true
  }
}

export const authLimiter = new RateLimiter()

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {}
  if (!cookieHeader) return list
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const val = parts.slice(1).join('=').trim()
      list[key] = decodeURIComponent(val)
    }
  })
  return list
}

export function createSessionCookie(token: string, isProduction: boolean = false): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  const secure = isProduction ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

export function clearSessionCookie(isProduction: boolean = false): string {
  const secure = isProduction ? '; Secure' : ''
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
}

export function authenticateSession(
  db: Database,
  cookieHeader?: string
): { user: UserRow; sessionToken: string } | null {
  const cookies = parseCookies(cookieHeader)
  const token = cookies[COOKIE_NAME]
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = db.findSessionByTokenHash(tokenHash)
  if (!session) return null
  const user = db.findUserById(session.user_id)
  if (!user) return null
  return { user, sessionToken: token }
}

export { COOKIE_NAME, SESSION_TTL_MS }
