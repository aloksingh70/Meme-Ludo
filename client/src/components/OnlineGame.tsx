import { useOnlineGame } from '../hooks/useOnlineGame'
import GameScreen from './GameScreen'
import Lobby from './Lobby'
import ChatBox from './ChatBox'

export default function OnlineGame({ onBack }: { onBack: () => void }) {
  const g = useOnlineGame()
  const inGame = g.room && g.room.status !== 'lobby' && g.view

  return (
    <>
      {inGame && g.view ? (
        <GameScreen game={g.view} onExit={g.leave} />
      ) : (
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
      )}

      {g.room && (
        <ChatBox
          room={g.room}
          messages={g.chatMessages}
          onSend={g.sendChat}
        />
      )}
    </>
  )
}
