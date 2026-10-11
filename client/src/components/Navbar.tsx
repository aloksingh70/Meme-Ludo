import { sound } from '../lib/sound'
import { useAuth } from '../context/AuthContext'
import MuteToggle from './MuteToggle'

interface Props {
  onOpenAuth: () => void
  onOpenProfile: () => void
  onOpenLeaderboard: () => void
}

export default function Navbar({ onOpenAuth, onOpenProfile, onOpenLeaderboard }: Props) {
  const { user } = useAuth()

  return (
    <header className="w-full px-4 py-3 sm:px-8 flex items-center justify-between border-b border-ivory/10 bg-cloth-deep/40">
      <div className="flex items-center gap-2">
        <span className="font-display text-xl text-ivory tracking-wide">Ludo</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            sound.playClick()
            onOpenLeaderboard()
          }}
          className="text-sm text-ivory-dim hover:text-ivory px-2 py-1 rounded transition"
        >
          Leaderboard
        </button>

        <MuteToggle />

        {user ? (
          <button
            type="button"
            onClick={() => {
              sound.playClick()
              onOpenProfile()
            }}
            className="flex items-center gap-1.5 rounded bg-ivory/10 hover:bg-ivory/20 px-3 py-1 text-sm font-medium text-ivory ring-1 ring-ivory/20 transition"
          >
            <span className="h-2 w-2 rounded-full bg-marigold" />
            <span>{user.username}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              sound.playClick()
              onOpenAuth()
            }}
            className="btn-quiet text-xs py-1 px-3"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
