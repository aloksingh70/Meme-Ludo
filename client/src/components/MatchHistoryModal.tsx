import { useEffect, useState } from 'react'
import { api, type MatchHistoryItem } from '../lib/api'
import { COLOR_HEX, COLOR_NAME } from '../lib/geometry'
import type { Color } from '@ludo/shared'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function MatchHistoryModal({ isOpen, onClose }: Props) {
  const [history, setHistory] = useState<MatchHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setError(null)
    api
      .getHistory()
      .then((res) => {
        if (!active) return
        setHistory(res)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load match history')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatPlacement = (p: number) => {
    if (p === 1) return '1st place'
    if (p === 2) return '2nd place'
    if (p === 3) return '3rd place'
    return '4th place'
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cloth-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-cloth p-6 ring-1 ring-ivory/20 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 id="history-modal-title" className="font-display text-3xl text-ivory">
            Match history
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

        <p className="mt-1 text-sm text-ivory-dim">Your authoritative online game results.</p>

        <div className="stitch my-4" />

        {error && (
          <div className="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          {history.length === 0 && !loading && (
            <p className="py-8 text-center text-ivory-dim text-sm">
              No recorded matches yet. Play an online match to save your results.
            </p>
          )}

          {history.map((m) => (
            <div key={m.matchId} className="py-4 border-b border-ivory/15 last:border-b-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-ivory/50"
                    style={{ background: COLOR_HEX[m.color as Color] ?? '#D2402E' }}
                  />
                  <span className="font-medium text-ivory">
                    {formatPlacement(m.placement)}
                  </span>
                  <span className="text-xs text-ivory-dim">
                    ({m.playerCount} players · room {m.roomCode})
                  </span>
                </div>
                <span className="text-xs text-ivory-dim">{formatDate(m.endedAt)}</span>
              </div>

              <div className="flex items-center gap-4 text-xs text-ivory-dim">
                <span>{m.tokensHome} home</span>
                <span>{m.capturesMade} captures</span>
                <span>{m.sixesRolled} sixes</span>
              </div>

              {m.opponents.length > 0 && (
                <div className="pt-1 text-xs text-ivory-dim/90 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-ivory-dim">Opponents:</span>
                  {m.opponents.map((opp, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: COLOR_HEX[opp.color as Color] ?? '#EBB021' }}
                      />
                      <span>
                        {opp.displayName} ({formatPlacement(opp.placement)})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <p className="py-4 text-center text-sm text-ivory-dim animate-pulse">Loading history…</p>
          )}
        </div>
      </div>
    </div>
  )
}
