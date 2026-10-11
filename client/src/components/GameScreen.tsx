import { useMemo, useState } from 'react'
import { FINISH_PROGRESS, getActingColor, teamOf, type Color } from '@ludo/shared'
import Board from './Board'
import Die from './Die'
import MuteToggle from './MuteToggle'
import MatchHistoryModal from './MatchHistoryModal'
import { useAuth } from '../context/AuthContext'
import type { GameView } from '../lib/gameView'
import { COLOR_HEX, COLOR_NAME } from '../lib/geometry'
import { sound } from '../lib/sound'

interface Props {
  game: GameView
  onExit: () => void
}

export default function GameScreen({ game, onExit }: Props) {
  const { state, rolling, canAct, rows, log, roll, choose, restart } = game
  const { user } = useAuth()
  const [showHistory, setShowHistory] = useState(false)

  const color = state.players[state.turn]
  const actingColor = state.actingColor ?? getActingColor(state)
  const isHelpingPartner = state.mode === 'teams' && actingColor !== color
  const dicePlayer = rolling ? color : (state.lastRoller ?? color)
  const label = (c: Color) => rows.find((r) => r.color === c)?.label ?? ''

  const movable = useMemo(() => {
    const set = new Set<string>()
    if (!canAct || state.phase !== 'move') return set
    state.tokens[actingColor].forEach((p, i) => {
      if (state.legal.some((m) => m.from === p)) set.add(`${actingColor}:${i}`)
    })
    return set
  }, [canAct, state, actingColor])

  const hint =
    state.phase === 'over'
      ? state.mode === 'teams'
        ? `Game over! Team ${state.winningTeam ?? 'A'} wins!`
        : 'Game over.'
      : rolling
        ? 'Rolling…'
        : !canAct
          ? isHelpingPartner
            ? `${COLOR_NAME[color]} is rolling for partner ${COLOR_NAME[actingColor]}.`
            : `${COLOR_NAME[color]} (${label(color)}) is playing.`
          : state.phase === 'roll'
            ? isHelpingPartner
              ? `Your tokens are home! Roll for partner ${COLOR_NAME[actingColor]}.`
              : 'Tap the die to roll.'
            : isHelpingPartner
              ? `Tap partner ${COLOR_NAME[actingColor]}'s glowing token (or die) to move.`
              : 'Tap a glowing token (or tap die) to move.'

  const handleDieClick = () => {
    if (state.phase === 'roll') {
      roll()
    } else if (state.phase === 'move' && state.legal.length > 0) {
      choose(state.legal[0].tokenIndex)
    }
  }

  const recentLogs = log.slice(-6)

  // Team scores
  const teamAHome =
    state.mode === 'teams'
      ? (state.tokens.red?.filter((p) => p === FINISH_PROGRESS).length ?? 0) +
        (state.tokens.yellow?.filter((p) => p === FINISH_PROGRESS).length ?? 0)
      : 0
  const teamBHome =
    state.mode === 'teams'
      ? (state.tokens.green?.filter((p) => p === FINISH_PROGRESS).length ?? 0) +
        (state.tokens.blue?.filter((p) => p === FINISH_PROGRESS).length ?? 0)
      : 0

  return (
    <main className="min-h-screen px-4 py-6 md:px-10 md:py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="mx-auto w-full max-w-[720px]">
          <Board
            state={state}
            movable={movable}
            onTokenClick={(_, i) => choose(i)}
          />
        </div>

        <aside className="mx-auto w-full max-w-[420px] lg:max-w-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-6 w-6 rounded-full ring-2 ring-ivory/60"
                style={{ background: COLOR_HEX[color] }}
                aria-hidden
              />
              <div>
                <h2 className="font-display text-3xl text-ivory">
                  {state.phase === 'over' ? 'Finished' : `${COLOR_NAME[color]}'s turn`}
                </h2>
                {state.mode === 'teams' && state.phase !== 'over' && (
                  <p className="text-xs text-marigold font-medium mt-0.5">
                    {isHelpingPartner
                      ? `★ Tokens home • moving partner ${COLOR_NAME[actingColor]}`
                      : `Team ${teamOf(color)} • Partner: ${COLOR_NAME[color === 'red' ? 'yellow' : color === 'yellow' ? 'red' : color === 'green' ? 'blue' : 'green']}`}
                  </p>
                )}
              </div>
            </div>
            <MuteToggle />
          </div>

          <div className="stitch my-5" />

          <div className="flex items-center gap-5">
            <Die
              value={state.dice}
              rolling={rolling}
              canRoll={canAct && (state.phase === 'roll' || state.phase === 'move')}
              onRoll={handleDieClick}
              tint={COLOR_HEX[dicePlayer]}
            />
            <p className="text-ivory-dim text-sm" aria-live="polite">
              {hint}
            </p>
          </div>

          <div className="stitch my-5" />

          {/* Teams progress breakdown */}
          {state.mode === 'teams' && (
            <div className="rounded-xl border border-ivory/15 bg-cloth-soft/30 p-3 mb-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-dim block">
                Team Progress (8 to win)
              </span>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ivory flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ruby" />
                  <span className="h-2 w-2 rounded-full bg-marigold" />
                  Team A (Red &amp; Yellow)
                </span>
                <span className="font-bold text-marigold font-mono">{teamAHome} / 8 home</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ivory flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald" />
                  <span className="h-2 w-2 rounded-full bg-sapphire" />
                  Team B (Green &amp; Blue)
                </span>
                <span className="font-bold text-emerald font-mono">{teamBHome} / 8 home</span>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {state.players.map((c: Color) => {
              const home = state.tokens[c].filter((p) => p === FINISH_PROGRESS).length
              const place = state.mode !== 'teams' && state.placements.indexOf(c) >= 0 ? state.placements.indexOf(c) + 1 : 0
              return (
                <li key={c} className="flex items-center gap-3 text-ivory">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[c] }} />
                  <span className="w-16 text-sm font-medium">{COLOR_NAME[c]}</span>
                  {state.mode === 'teams' && (
                    <span className="rounded bg-ivory/10 px-1.5 py-0.5 text-[10px] font-semibold text-ivory-dim">
                      Team {teamOf(c)}
                    </span>
                  )}
                  <span className="truncate text-xs text-ivory-dim">{label(c)}</span>
                  <span className="ml-auto text-xs text-ivory-dim font-mono">
                    {state.mode === 'teams'
                      ? home === 4
                        ? '4/4 (Done)'
                        : `${home}/4 home`
                      : place
                        ? `${['', '1st', '2nd', '3rd', '4th'][place]} place`
                        : `${home} of 4 home`}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="stitch my-5" />

          <ol className="min-h-[7.5rem] space-y-1.5 text-sm text-ivory-dim" aria-label="Game log">
            {recentLogs.length === 0 && <li>Roll the die to begin. A six brings a token out.</li>}
            {recentLogs.map((l, i) => {
              const isLatest = i === recentLogs.length - 1
              return (
                <li
                  key={`${log.length}-${i}`}
                  className={`flex items-start gap-2 transition-colors ${
                    isLatest ? 'text-ivory font-medium' : 'text-ivory-dim/70'
                  }`}
                >
                  <span className="text-xs opacity-50 select-none">•</span>
                  <span className="flex-1">{l}</span>
                  {isLatest && (
                    <span className="text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-ivory/15 text-ivory/90 font-semibold select-none">
                      Latest
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          <div className="mt-6 flex gap-3">
            {restart && (
              <button
                className="btn-quiet"
                onClick={() => {
                  sound.playClick()
                  restart()
                }}
              >
                Restart
              </button>
            )}
            <button
              className="btn-quiet"
              onClick={() => {
                sound.playClick()
                onExit()
              }}
            >
              Back to menu
            </button>
          </div>
        </aside>
      </div>

      {state.phase === 'over' && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-cloth-deep/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg bg-cloth p-8 ring-1 ring-ivory/20 shadow-2xl">
            {state.mode === 'teams' ? (
              <>
                <span className="text-xs uppercase tracking-widest text-marigold font-bold block text-center">
                  Team Victory
                </span>
                <h2 className="font-display text-4xl text-ivory text-center mt-1">
                  Team {state.winningTeam ?? 'A'} wins!
                </h2>
                <p className="text-center text-ivory-dim text-sm mt-1">
                  All 8 tokens brought safely home!
                </p>

                <div className="mt-6 space-y-2.5">
                  <div
                    className={`rounded-xl border p-3.5 ${
                      state.winningTeam === 'A'
                        ? 'border-marigold bg-marigold/15 ring-2 ring-marigold/50'
                        : 'border-ivory/15 bg-cloth-soft/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-ruby" />
                        <span className="h-3 w-3 rounded-full bg-marigold" />
                        <span className="font-bold text-ivory">Team A</span>
                        <span className="text-xs text-ivory-dim">(Red &amp; Yellow)</span>
                      </div>
                      {state.winningTeam === 'A' && (
                        <span className="rounded bg-marigold/20 px-2 py-0.5 text-xs font-bold text-marigold">
                          Winners!
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      state.winningTeam === 'B'
                        ? 'border-marigold bg-marigold/15 ring-2 ring-marigold/50'
                        : 'border-ivory/15 bg-cloth-soft/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald" />
                        <span className="h-3 w-3 rounded-full bg-sapphire" />
                        <span className="font-bold text-ivory">Team B</span>
                        <span className="text-xs text-ivory-dim">(Green &amp; Blue)</span>
                      </div>
                      {state.winningTeam === 'B' && (
                        <span className="rounded bg-marigold/20 px-2 py-0.5 text-xs font-bold text-marigold">
                          Winners!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-4xl text-ivory">
                  {COLOR_NAME[state.placements[0]]} wins
                </h2>
                <ol className="mt-5 space-y-2 text-ivory">
                  {state.placements.map((c, i) => (
                    <li key={c} className="flex items-center gap-3">
                      <span className="w-8 text-ivory-dim">{i + 1}.</span>
                      <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[c] }} />
                      {COLOR_NAME[c]}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <div className="stitch my-5" />

            {user ? (
              <p className="text-xs text-ivory-dim">
                Signed in as <span className="text-ivory font-medium">{user.username}</span>. Result recorded to your match history.
              </p>
            ) : (
              <p className="text-xs text-ivory-dim/80">
                Played as a guest. Match results are not saved to an account.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {user && (
                <button
                  className="btn-quiet text-xs"
                  onClick={() => {
                    sound.playClick()
                    setShowHistory(true)
                  }}
                >
                  View history
                </button>
              )}
              {restart && (
                <button
                  className="btn-primary flex-1 text-center"
                  onClick={() => {
                    sound.playClick()
                    restart()
                  }}
                >
                  Play again
                </button>
              )}
              <button
                className={restart ? 'btn-quiet' : 'btn-primary flex-1'}
                onClick={() => {
                  sound.playClick()
                  onExit()
                }}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      <MatchHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </main>
  )
}
