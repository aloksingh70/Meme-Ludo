import { useEffect, useState } from 'react'
import { api, type LeaderboardEntry } from '../lib/api'
import { sound } from '../lib/sound'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function LeaderboardModal({ isOpen, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setError(null)
    api
      .getLeaderboard(1, 10)
      .then((res) => {
        if (!active) return
        setEntries(res)
        setHasMore(res.length === 10)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  const loadMore = async () => {
    if (entries.length === 0 || loading) return
    const last = entries[entries.length - 1]
    setLoading(true)
    sound.playClick()
    try {
      const more = await api.getLeaderboard(1, 10, {
        wins: last.wins,
        winRate: last.winRate,
        totalGames: last.totalGames,
        userId: last.userId
      })
      setEntries((prev) => [...prev, ...more])
      setHasMore(more.length === 10)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more entries')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cloth-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-cloth p-6 ring-1 ring-ivory/20 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 id="leaderboard-modal-title" className="font-display text-3xl text-ivory">
            Leaderboard
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

        <p className="mt-1 text-sm text-ivory-dim">
          Rankings by match wins and win rate with deterministic tie-breaking.
        </p>

        <div className="stitch my-4" />

        {error && (
          <div className="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          {entries.length === 0 && !loading && (
            <p className="py-8 text-center text-ivory-dim text-sm">
              No completed online matches recorded yet. Play a game to join the ranks.
            </p>
          )}

          {entries.length > 0 && (
            <div className="divide-y divide-ivory/15">
              <div className="grid grid-cols-[36px_1fr_60px_60px] pb-2 text-xs font-semibold text-ivory-dim">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">Wins</span>
                <span className="text-right">Win rate</span>
              </div>

              {entries.map((p, idx) => (
                <div
                  key={p.userId}
                  className="grid grid-cols-[36px_1fr_60px_60px] py-3 items-center text-sm text-ivory"
                >
                  <span className={idx === 0 ? 'text-marigold font-display text-lg' : 'text-ivory-dim'}>
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-medium text-ivory">{p.username}</span>
                    <span className="block text-xs text-ivory-dim">
                      {p.totalGames} {p.totalGames === 1 ? 'game' : 'games'} · {p.totalCaptures} captures
                    </span>
                  </div>
                  <span className="text-right font-display text-base text-marigold">{p.wins}</span>
                  <span className="text-right text-ivory-dim">{p.winRate}%</span>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <p className="py-4 text-center text-sm text-ivory-dim animate-pulse">Loading…</p>
          )}

          {hasMore && entries.length > 0 && !loading && (
            <div className="mt-4 text-center">
              <button type="button" onClick={loadMore} className="btn-quiet text-xs">
                Load more players
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
