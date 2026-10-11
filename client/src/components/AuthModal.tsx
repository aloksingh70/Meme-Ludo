import { useState } from 'react'
import { api, type User } from '../lib/api'
import { sound } from '../lib/sound'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
}

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    sound.playClick()
    try {
      const res = isRegister
        ? await api.register(username, password)
        : await api.login(username, password)
      onSuccess(res.user)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cloth-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-cloth p-6 ring-1 ring-ivory/20 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="auth-modal-title" className="font-display text-3xl text-ivory">
            {isRegister ? 'Create an account' : 'Sign in'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ivory-dim hover:text-ivory p-1 rounded"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-ivory-dim">
          {isRegister
            ? 'Save your match history and track your record on the leaderboard.'
            : 'Welcome back. Sign in to record your game results.'}
        </p>

        <div className="stitch my-4" />

        {error && (
          <div className="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-sm font-medium text-ivory mb-1">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-ivory/25 bg-cloth-deep px-3 py-2 text-ivory placeholder-ivory/40 focus:border-marigold focus:outline-none focus:ring-1 focus:ring-marigold"
              placeholder="e.g. pachisi_player"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-ivory mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-ivory/25 bg-cloth-deep px-3 py-2 text-ivory placeholder-ivory/40 focus:border-marigold focus:outline-none focus:ring-1 focus:ring-marigold"
              placeholder="At least 6 characters"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setError(null)
              }}
              className="text-sm text-ivory-dim hover:text-ivory underline underline-offset-4"
            >
              {isRegister ? 'Already have an account? Sign in' : 'Need an account? Create one'}
            </button>

            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="stitch my-5" />

        <p className="text-xs text-ivory-dim/75 leading-relaxed">
          Privacy note: We never ask for your email address or personal details. We only store your username, a salted cryptographic hash of your password, and completed match records.
        </p>
      </div>
    </div>
  )
}
