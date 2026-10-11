import { useState } from 'react'
import { api, type User, type UserStats } from '../lib/api'
import { sound } from '../lib/sound'

interface Props {
  isOpen: boolean
  user: User
  stats: UserStats | null
  onClose: () => void
  onLogout: () => void
  onOpenHistory: () => void
}

export default function ProfileModal({
  isOpen,
  user,
  stats,
  onClose,
  onLogout,
  onOpenHistory
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    sound.playClick()
    try {
      await api.deleteAccount()
      onLogout()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cloth-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-cloth p-6 ring-1 ring-ivory/20 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="profile-modal-title" className="font-display text-3xl text-ivory">
            {user.username}
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

        <p className="mt-1 text-sm text-ivory-dim">Player profile and record</p>

        <div className="stitch my-4" />

        {error && (
          <div className="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Games played</span>
            <span className="font-display text-2xl text-ivory">{stats?.totalGames ?? 0}</span>
          </div>
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Wins (1st place)</span>
            <span className="font-display text-2xl text-marigold">{stats?.wins ?? 0}</span>
          </div>
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Win rate</span>
            <span className="font-display text-2xl text-ivory">
              {stats ? `${stats.winRate}%` : '0%'}
            </span>
          </div>
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Longest win streak</span>
            <span className="font-display text-2xl text-marigold">
              {stats?.longestWinStreak ?? 0}
            </span>
          </div>
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Average finish</span>
            <span className="font-display text-2xl text-ivory">
              {stats && stats.totalGames > 0 ? `${stats.avgPlacement}` : '—'}
            </span>
          </div>
          <div className="rounded border border-ivory/15 bg-cloth-deep/60 p-3">
            <span className="block text-xs text-ivory-dim">Captures made</span>
            <span className="font-display text-2xl text-ivory">{stats?.totalCaptures ?? 0}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => {
              sound.playClick()
              onOpenHistory()
            }}
            className="btn-primary flex-1 text-center"
          >
            Match history
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playClick()
              onLogout()
              onClose()
            }}
            className="btn-quiet"
          >
            Sign out
          </button>
        </div>

        <div className="stitch my-5" />

        {!confirmDelete ? (
          <div className="text-right">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-300/80 hover:text-red-300 underline underline-offset-2"
            >
              Delete my account and data
            </button>
          </div>
        ) : (
          <div className="rounded border border-red-500/30 bg-red-950/40 p-3">
            <p className="text-xs text-red-200 leading-relaxed mb-3">
              This will permanently delete your account, session tokens, and personal profile. Your past matches will be anonymized. Are you sure?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="btn-quiet text-xs py-1 px-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="rounded bg-red-800 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
              >
                {busy ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
