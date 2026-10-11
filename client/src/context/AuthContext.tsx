import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, type User, type UserStats } from '../lib/api'

interface AuthContextType {
  user: User | null
  stats: UserStats | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (u: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  stats: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
  logout: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api.getMe()
      setUser(res.user)
      setStats(res.stats)
    } catch {
      setUser(null)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setStats(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, stats, loading, refresh, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
