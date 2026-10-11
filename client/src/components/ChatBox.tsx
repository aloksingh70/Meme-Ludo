import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, RoomPublic } from '@ludo/shared'
import { COLOR_HEX } from '../lib/geometry'
import { sound } from '../lib/sound'

interface Props {
  room: RoomPublic
  messages: ChatMessage[]
  onSend: (text: string) => void
}

const QUICK_REACTIONS = [
  '👋 Hi!',
  '🎲 Roll high!',
  '🔥 Nice move!',
  '😂 Haha!',
  '⏳ Your turn!',
  '😱 Oh no!',
  '🏆 GG!'
]

export default function ChatBox({ room, messages, onSend }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastCountRef = useRef(messages.length)

  const mySeat = room.you !== null ? room.seats[room.you] : null
  const myName = mySeat?.name ?? ''

  // Track unread count when panel is closed
  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      if (!isOpen) {
        setUnreadCount((prev) => prev + (messages.length - lastCountRef.current))
      }
    }
    lastCountRef.current = messages.length
  }, [messages.length, isOpen])

  // Reset unread count when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen])

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    sound.playClick()
    onSend(trimmed)
    setInput('')
  }

  const handleQuickSend = (text: string) => {
    sound.playClick()
    onSend(text)
  }

  return (
    <aside aria-label="Room chat" className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {/* Expanded Chat Box */}
      {isOpen && (
        <div className="mb-3 flex w-[19rem] sm:w-[22rem] flex-col rounded-2xl border border-ivory/20 bg-cloth-deep/95 shadow-2xl backdrop-blur-md overflow-hidden ring-1 ring-ivory/10 transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ivory/15 bg-cloth-soft/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-marigold/20 text-marigold">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-ivory">Room Chat</h3>
                <span className="text-[10px] text-ivory-dim font-mono tracking-wider">
                  #{room.code}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playClick()
                setIsOpen(false)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ivory-dim hover:text-ivory hover:bg-ivory/10 transition-colors cursor-pointer"
              title="Close chat"
              aria-label="Close chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="6" />
              </svg>
            </button>
          </div>

          {/* Quick Reactions bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-ivory/10 scrollbar-none bg-cloth/40">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => handleQuickSend(reaction)}
                className="shrink-0 rounded-full border border-ivory/15 bg-cloth-soft/70 px-2.5 py-0.5 text-xs text-ivory/90 hover:bg-marigold/20 hover:border-marigold/50 hover:text-marigold transition-all cursor-pointer select-none active:scale-95"
              >
                {reaction}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex h-64 flex-col gap-2.5 overflow-y-auto p-3 text-xs">
            {messages.length === 0 ? (
              <div className="my-auto text-center text-ivory-dim/70 space-y-1">
                <p className="font-medium text-ivory-dim">No messages yet</p>
                <p className="text-[11px]">Say hi or send a reaction to your friends!</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = myName && m.senderName === myName
                const colorHex = m.senderColor ? COLOR_HEX[m.senderColor] : '#d5c4a1'
                const timeStr = new Date(m.time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorHex }}
                      />
                      <span className="font-semibold text-ivory text-[11px]">
                        {isMe ? 'You' : m.senderName}
                      </span>
                      <span className="text-[10px] text-ivory-dim/60 font-mono">{timeStr}</span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 break-words text-sm shadow-sm ${
                        isMe
                          ? 'bg-marigold/25 text-ivory border border-marigold/40 rounded-tr-none'
                          : 'bg-cloth-soft/90 text-ivory border border-ivory/15 rounded-tl-none'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-ivory/15 bg-cloth-soft/40 p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={200}
              placeholder="Type message..."
              className="flex-1 rounded-xl border border-ivory/20 bg-cloth-deep/80 px-3 py-2 text-xs text-ivory placeholder-ivory-dim/50 focus:border-marigold focus:outline-none focus:ring-1 focus:ring-marigold"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-marigold text-cloth font-bold hover:bg-marigold-bright disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 ml-0.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Floating Chat Button */}
      <button
        type="button"
        onClick={() => {
          sound.playClick()
          setIsOpen(!isOpen)
        }}
        className={`group relative flex items-center gap-2 rounded-full border px-4 py-2.5 font-medium shadow-2xl transition-all cursor-pointer backdrop-blur-md ${
          isOpen
            ? 'border-marigold bg-marigold text-cloth shadow-marigold/30 font-bold'
            : 'border-ivory/25 bg-cloth-deep/90 text-ivory hover:border-marigold hover:bg-cloth-soft hover:text-marigold'
        }`}
        aria-label="Toggle chat"
      >
        <span className="relative flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 transition-transform group-hover:scale-110"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-2.5 -right-2.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-ruby px-1 text-[10px] font-bold text-white shadow-md animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        <span className="text-sm font-semibold tracking-wide">
          {isOpen ? 'Close' : 'Chat'}
        </span>
      </button>
    </aside>
  )
}
