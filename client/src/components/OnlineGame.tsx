import { useOnlineGame } from '../hooks/useOnlineGame'
import GameScreen from './GameScreen'
import Lobby from './Lobby'

export default function OnlineGame({ onBack }: { onBack: () => void }) {
  const g = useOnlineGame()
  const inGame = g.room && g.room.status !== 'lobby' && g.view

  if (inGame && g.view) {
    return <GameScreen game={g.view} onExit={g.leave} />
  }

  return (
    <Lobby
      connected={g.connected}
      room={g.room}
      error={g.error}
      busy={g.busy}
      onCreate={g.createRoom}
      onSetMode={g.setMode}
      onJoin={g.joinRoom}
      onAddBot={g.addBot}
      onRemove={g.removeSeat}
      onSwapSeats={g.swapSeats}
      onStart={g.start}
      onLeave={g.leave}
      onBack={onBack}
    />
  )
}
