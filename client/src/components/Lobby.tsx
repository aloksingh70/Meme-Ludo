import { useEffect, useState } from 'react'
import type { GameMode, RoomPublic } from '@ludo/shared'
import { useAuth } from '../context/AuthContext'
import { sound } from '../lib/sound'

const NAME_KEY = 'ludo:name'

interface Props {
  connected: boolean
  room: RoomPublic | null
  error: string | null
  busy: boolean
  onCreate: (name: string, mode?: GameMode) => void
  onSetMode?: (mode: GameMode) => void
  onJoin: (code: string, name: string) => void
  onAddBot: () => void
  onRemove: (index: number) => void
  onSwapSeats?: (index1: number, index2: number) => void
  onStart: () => void
  onLeave: () => void
  onBack: () => void
}

export default function Lobby(p: Props) {
  const { user } = useAuth()
  const [name, setName] = useState(() => user?.username ?? localStorage.getItem(NAME_KEY) ?? '')
  const [mode, setMode] = useState<GameMode>('solo')
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null)
  const [code, setCode] = useState(() =>
    (new URLSearchParams(location.search).get('room') ?? '').toUpperCase().slice(0, 5)
  )
  const [copied, setCopied] = useState(false)
  const [connectingTooLong, setConnectingTooLong] = useState(false)

  useEffect(() => {
    if (p.connected) {
      setConnectingTooLong(false)
      return
    }
    const t = setTimeout(() => setConnectingTooLong(true), 4000)
    return () => clearTimeout(t)
  }, [p.connected])

  useEffect(() => {
    if (user?.username) {
      setName(user.username)
    }
  }, [user])

  useEffect(() => {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim())
  }, [name])

  const canCreate = p.connected && !p.busy
  const canJoin = canCreate && code.length === 5

  // ---- inside a room ----
  if (p.room) {
    const room = p.room
    const me = typeof room.you === 'number' && room.you >= 0 ? room.seats[room.you] : null
    const isHost = Boolean(me && me.isHost)
    const link = `${location.origin}${location.pathname}?room=${room.code}`
    const copy = async () => {
      sound.playClick()
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch {
        /* clipboard blocked; the code is shown on screen anyway */
      }
    }

    const isTeams = room.mode === 'teams'
    const canStart = isTeams ? room.seats.length === 4 : room.seats.length >= 2

    return (
      <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-ivory-dim">Room code</p>
              <h1
                className="font-display text-7xl tracking-widest text-ivory md:text-8xl"
                aria-label={`Room code ${room.code.split('').join(' ')}`}
              >
                {room.code}
              </h1>
            </div>
            <div className="rounded-xl border border-ivory/20 bg-cloth-soft/50 px-4 py-3">
              <span className="block text-xs uppercase tracking-wider text-ivory-dim font-medium">Game Mode</span>
              <span className="text-lg font-bold text-marigold">
                {isTeams ? 'Team (2 v 2)' : 'Individual (Solo)'}
              </span>
            </div>
          </div>

          <button className="btn-quiet mt-4" onClick={copy}>
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>

          {/* Mode switch for host only */}
          {isHost && (
            <div className="mt-6 rounded-xl border border-ivory/15 bg-cloth-soft/30 p-4">
              <span className="text-sm text-ivory-dim block mb-2 font-medium">Change Game Mode:</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick()
                    p.onSetMode?.('solo')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    !isTeams
                      ? 'bg-marigold text-cloth shadow-md ring-2 ring-marigold'
                      : 'bg-cloth-soft text-ivory hover:bg-cloth-soft/70'
                  }`}
                >
                  Individual (Solo)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick()
                    p.onSetMode?.('teams')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    isTeams
                      ? 'bg-marigold text-cloth shadow-md ring-2 ring-marigold'
                      : 'bg-cloth-soft text-ivory hover:bg-cloth-soft/70'
                  }`}
                >
                  Team (2 v 2)
                </button>
              </div>
              {isTeams && (
                <p className="mt-2 text-xs text-ivory-dim">
                  Red &amp; Yellow are Team A. Green &amp; Blue are Team B. A team wins when all 8 tokens reach home.
                </p>
              )}
            </div>
          )}

          <div className="stitch my-8" />

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl text-ivory">
              Players ({room.seats.length} of {isTeams ? 4 : 4})
            </h2>
            {isHost && room.seats.length > 1 && (
              <span className="text-xs text-ivory-dim">
                Host: Use <span className="text-ivory font-semibold">↑ / ↓</span> or{' '}
                <span className="text-ivory font-semibold">Swap</span> to change teams &amp; seats.
              </span>
            )}
          </div>
          {swapSourceIndex !== null && isHost && (
            <p className="mt-2 text-xs text-marigold font-medium">
              Swapping <span className="underline">{room.seats[swapSourceIndex]?.name}</span>: click "Swap here" on another player.
            </p>
          )}

          <ul className="mt-4 divide-y divide-ivory/15">
            {room.seats.map((s, i) => {
              const teamLabel = isTeams
                ? i === 0
                  ? 'Team A • Red'
                  : i === 1
                    ? 'Team B • Green'
                    : i === 2
                      ? 'Team A • Yellow'
                      : 'Team B • Blue'
                : null

              const isSwappingThis = swapSourceIndex === i

              return (
                <li
                  key={i}
                  className={`flex flex-wrap items-center gap-3 py-3 text-ivory transition-all ${
                    isSwappingThis
                      ? 'rounded-lg bg-marigold/10 px-3 ring-1 ring-marigold'
                      : ''
                  }`}
                >
                  <span className="text-xl font-medium">{s.name}</span>
                  <span className="text-ivory-dim text-sm">
                    {i === room.you ? ' (You)' : s.kind === 'bot' ? ' (Computer)' : ''}
                    {s.isHost ? (i === room.you ? ', Host' : 'Host') : ''}
                  </span>
                  {teamLabel && (
                    <span
                      className={`ml-1 rounded px-2.5 py-0.5 text-xs font-bold ${
                        i % 2 === 0
                          ? 'bg-ruby/25 text-marigold border border-marigold/40'
                          : 'bg-sapphire/25 text-emerald border border-emerald/40'
                      }`}
                    >
                      {teamLabel}
                    </span>
                  )}

                  {/* Host-only player management: Swap, Reorder, Remove */}
                  {isHost && (
                    <div className="ml-auto flex items-center gap-2">
                      {/* Move up / down arrows */}
                      {room.seats.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-quiet px-2 py-1 text-xs disabled:opacity-20 cursor-pointer"
                            onClick={() => {
                              sound.playClick()
                              setSwapSourceIndex(null)
                              p.onSwapSeats?.(i, i - 1)
                            }}
                            disabled={i === 0}
                            title="Move up"
                            aria-label={`Move ${s.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-quiet px-2 py-1 text-xs disabled:opacity-20 cursor-pointer"
                            onClick={() => {
                              sound.playClick()
                              setSwapSourceIndex(null)
                              p.onSwapSeats?.(i, i + 1)
                            }}
                            disabled={i === room.seats.length - 1}
                            title="Move down"
                            aria-label={`Move ${s.name} down`}
                          >
                            ↓
                          </button>
                        </div>
                      )}

                      {/* Swap button */}
                      {room.seats.length > 1 && (
                        swapSourceIndex === null ? (
                          <button
                            type="button"
                            className="btn-quiet text-xs px-2.5 py-1 cursor-pointer"
                            onClick={() => {
                              sound.playClick()
                              setSwapSourceIndex(i)
                            }}
                            title="Select this player to swap with another"
                          >
                            Swap
                          </button>
                        ) : isSwappingThis ? (
                          <button
                            type="button"
                            className="btn-quiet text-xs px-2.5 py-1 text-marigold ring-1 ring-marigold cursor-pointer"
                            onClick={() => {
                              sound.playClick()
                              setSwapSourceIndex(null)
                            }}
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary text-xs px-2.5 py-1 cursor-pointer"
                            onClick={() => {
                              sound.playClick()
                              p.onSwapSeats?.(swapSourceIndex, i)
                              setSwapSourceIndex(null)
                            }}
                          >
                            Swap here
                          </button>
                        )
                      )}

                      {/* Remove button (host cannot remove themselves) */}
                      {i !== room.you && (
                        <button
                          type="button"
                          className="btn-quiet text-xs px-2.5 py-1 cursor-pointer"
                          onClick={() => {
                            sound.playClick()
                            setSwapSourceIndex(null)
                            p.onRemove(i)
                          }}
                          aria-label={`Remove ${s.name}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {isTeams && room.seats.length < 4 && (
            <p className="mt-4 text-sm text-marigold">
              Team mode requires exactly 4 players. Invite friends to join using the room code or link.
            </p>
          )}

          {p.error && (
            <p role="alert" className="mt-4 text-marigold">
              {p.error}
            </p>
          )}

          <div className="stitch my-8" />

          {isHost ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="btn-primary"
                onClick={() => {
                  sound.playClick()
                  p.onStart()
                }}
                disabled={!canStart}
              >
                Start game
              </button>
              <button
                className="btn-quiet"
                onClick={() => {
                  sound.playClick()
                  p.onLeave()
                }}
              >
                Leave room
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-ivory-dim">Waiting for the host to start…</p>
              <button
                className="btn-quiet"
                onClick={() => {
                  sound.playClick()
                  p.onLeave()
                }}
              >
                Leave
              </button>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ---- before joining a room ----
  return (
    <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-6xl text-ivory md:text-7xl">Play online</h1>
        <p className="mt-4 max-w-xl text-lg text-ivory-dim">
          Make a room and share its code with friends, or enter a friend's code to join their game.
        </p>

        <div className="stitch my-8" />

        <label className="block max-w-md">
          <span className="font-display text-2xl text-ivory">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoComplete="nickname"
            placeholder="e.g. Asha"
            className="field mt-3"
          />
          {user ? (
            <span className="block mt-2 text-xs text-ivory-dim">
              Signed in as <span className="text-ivory font-medium">{user.username}</span>. Your match results will be saved.
            </span>
          ) : (
            <span className="block mt-2 text-xs text-ivory-dim/80">
              Playing as a guest. Match results are not saved to an account.
            </span>
          )}
        </label>

        {/* Side-by-side Start a room & Join a room sections */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Start a room section */}
          <div>
            <h2 className="font-display text-3xl text-ivory">Start a room</h2>
            <p className="mt-1 text-sm text-ivory-dim">You'll get a code to share.</p>

            {/* Game Mode Selector: Individual vs Team */}
            <div className="mt-6 max-w-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-ivory-dim block mb-3">
                Select game mode
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick()
                    setMode('solo')
                  }}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                    mode === 'solo'
                      ? 'border-marigold bg-marigold/15 ring-2 ring-marigold'
                      : 'border-ivory/20 bg-cloth-soft/40 hover:bg-cloth-soft/70'
                  }`}
                >
                  <span
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      mode === 'solo' ? 'border-marigold bg-marigold' : 'border-ivory/40'
                    }`}
                  >
                    {mode === 'solo' && <span className="h-1.5 w-1.5 rounded-full bg-cloth" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-ivory">Individual</span>
                      <span className="rounded bg-ivory/10 px-2 py-0.5 text-[11px] font-medium text-ivory-dim">
                        2–4 Players
                      </span>
                    </div>
                    <p className="text-xs text-ivory-dim mt-0.5">Classic free-for-all. First player home wins.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick()
                    setMode('teams')
                  }}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                    mode === 'teams'
                      ? 'border-marigold bg-marigold/15 ring-2 ring-marigold'
                      : 'border-ivory/20 bg-cloth-soft/40 hover:bg-cloth-soft/70'
                  }`}
                >
                  <span
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      mode === 'teams' ? 'border-marigold bg-marigold' : 'border-ivory/40'
                    }`}
                  >
                    {mode === 'teams' && <span className="h-1.5 w-1.5 rounded-full bg-cloth" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-ivory">Team (2 v 2)</span>
                      <span className="rounded bg-marigold/20 px-2 py-0.5 text-[11px] font-bold text-marigold">
                        2v2 • 4 Players
                      </span>
                    </div>
                    <p className="text-xs text-ivory-dim mt-0.5">
                      Red &amp; Yellow vs Green &amp; Blue. Share blocks, roll for your partner, team wins!
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <button
              className="btn-primary mt-6 cursor-pointer"
              disabled={!canCreate}
              onClick={() => {
                sound.playClick()
                p.onCreate(name, mode)
              }}
            >
              Create room
            </button>
          </div>

          {/* Join a room section (side of Create room) */}
          <div>
            <h2 className="font-display text-3xl text-ivory">Join a room</h2>
            <label className="block mt-1" htmlFor="room-code">
              <span className="text-sm text-ivory-dim">Five-character code</span>
              <input
                id="room-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))
                }
                className="field mt-3 tracking-[0.45em] text-center font-mono text-2xl uppercase py-3"
                placeholder="A B C D E"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <button
              className="btn-primary mt-6 cursor-pointer"
              disabled={!canJoin}
              onClick={() => {
                sound.playClick()
                p.onJoin(code, name)
              }}
            >
              Join room
            </button>
          </div>
        </div>

        {p.error && (
          <p role="alert" className="mt-6 text-marigold font-medium">
            {p.error}
          </p>
        )}
        {!p.connected && (
          <div className="mt-6 space-y-2">
            <p className="text-ivory-dim text-sm" aria-live="polite">
              Connecting to the game server…
            </p>
            {connectingTooLong && (
              <div className="rounded-lg border border-marigold/30 bg-marigold/10 p-3 text-xs text-marigold max-w-sm">
                <span className="font-semibold block mb-0.5">⚠️ Game server unreachable</span>
                Online multiplayer requires the backend game server to be running online.
              </div>
            )}
          </div>
        )}

        <button
          className="btn-quiet mt-12 cursor-pointer"
          onClick={() => {
            sound.playClick()
            p.onBack()
          }}
        >
          Back to menu
        </button>
      </div>
    </main>
  )
}

