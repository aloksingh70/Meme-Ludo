import { useState } from 'react'
import Setup from './components/Setup'
import GameScreen from './components/GameScreen'
import OnlineGame from './components/OnlineGame'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import LeaderboardModal from './components/LeaderboardModal'
import MatchHistoryModal from './components/MatchHistoryModal'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useLocalGame, type Seat } from './hooks/useLocalGame'
import type { GameMode } from '@ludo/shared'
import { hasSavedSession } from './hooks/useOnlineGame'

function LocalGame({
  seats,
  mode,
  onExit
}: {
  seats: Seat[]
  mode?: GameMode
  onExit: () => void
}) {
  const game = useLocalGame(seats, mode)
  return <GameScreen game={game} onExit={onExit} />
}

type Screen =
  | { name: 'menu' }
  | { name: 'local'; seats: Seat[]; mode?: GameMode }
  | { name: 'online' }

function MainContent() {
  const { user, stats, refresh, logout } = useAuth()
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(location.search).has('room') || hasSavedSession()
      ? { name: 'online' }
      : { name: 'menu' }
  )

  const [authOpen, setAuthOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const menu = () => setScreen({ name: 'menu' })

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
      />

      <div className="flex-1">
        {screen.name === 'local' && (
          <LocalGame seats={screen.seats} mode={screen.mode} onExit={menu} />
        )}
        {screen.name === 'online' && (
          <OnlineGame onBack={menu} />
        )}
        {screen.name === 'menu' && (
          <Setup
            onStart={(seats, mode) => setScreen({ name: 'local', seats, mode })}
            onOnline={() => setScreen({ name: 'online' })}
          />
        )}
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          refresh()
        }}
      />

      {user && (
        <ProfileModal
          isOpen={profileOpen}
          user={user}
          stats={stats}
          onClose={() => setProfileOpen(false)}
          onLogout={logout}
          onOpenHistory={() => {
            setProfileOpen(false)
            setHistoryOpen(true)
          }}
        />
      )}

      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />

      <MatchHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  )
}
