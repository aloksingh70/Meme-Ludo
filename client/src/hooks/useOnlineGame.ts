import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { P2PSocket } from '../lib/p2pSocket'
import type {
  ChatMessage,
  ClientToServerEvents,
  GameEvent,
  GameMode,
  GameState,
  RoomPublic,
  ServerToClientEvents
} from '@ludo/shared'
import { eventsToText } from '../lib/eventText'
import type { GameView } from '../lib/gameView'
import { calculateHopTiming, getTokenPath } from '../lib/path'
import { sound } from '../lib/sound'

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents> | P2PSocket

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'
const SESSION_KEY = 'ludo:session'
const ROLL_MS = 650

interface Session {
  code: string
  playerId: string
  name: string
}
const loadSession = (): Session | null => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}
/** True if this tab was in an online room before a refresh. */
export const hasSavedSession = (): boolean => loadSession() !== null

const saveSession = (s: Session | null) =>
  s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY)

export function useOnlineGame() {
  const socketRef = useRef<ClientSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomPublic | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [rolling, setRolling] = useState(false)
  const [waiting, setWaiting] = useState(false) // asked the server to roll, no answer yet
  const [log, setLog] = useState<string[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Track if this is the very first state loaded (e.g. after refresh/rejoin)
  const isInitialState = useRef(true)

  // States arrive in order; a state that contains a roll waits for the die to
  // finish tumbling before it is shown, and states containing moves wait for
  // token hop animation to finish before applying the next state.
  const queue = useRef<GameState[]>([])
  const playing = useRef(false)

  const pump = useCallback(() => {
    if (playing.current) return
    const next = queue.current.shift()
    if (!next) return
    playing.current = true

    // On initial load/rejoin, render the state instantly with no replay
    if (isInitialState.current) {
      isInitialState.current = false
      setState(next)
      const lines = eventsToText(next.events)
      if (lines.length) setLog((l) => [...l, ...lines].slice(-40))
      setRolling(false)
      setWaiting(false)
      playing.current = false
      pump()
      return
    }

    const hasRoll = next.events.some((e) => e.type === 'rolled')
    const moveEvent = next.events.find(
      (e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved'
    )

    if (hasRoll) {
      sound.playDiceRattle()
      setRolling(true)
      setTimeout(() => {
        sound.playDiceLand()
        const rolled = next.events.find(
          (e): e is Extract<GameEvent, { type: 'rolled' }> => e.type === 'rolled'
        )
        if (rolled?.value === 6 || next.dice === 6) sound.playSixOrExtra()
        setState(next)
        const lines = eventsToText(next.events)
        if (lines.length) setLog((l) => [...l, ...lines].slice(-40))
        setRolling(false)
        setWaiting(false)
        playing.current = false
        pump()
      }, ROLL_MS)
      return
    }

    if (moveEvent) {
      // Calculate token path and duration so queue delays next state until hop finishes
      const steps = getTokenPath(
        moveEvent.color,
        moveEvent.move.from,
        moveEvent.move.to,
        moveEvent.move.tokenIndex
      )
      const { totalMs } = calculateHopTiming(steps.length)
      const captureDelay = moveEvent.move.captures.length > 0 ? 350 : 0
      const totalAnimMs = totalMs + captureDelay

      setState(next)
      const lines = eventsToText(next.events)
      if (lines.length) setLog((l) => [...l, ...lines].slice(-40))
      setWaiting(false)

      setTimeout(() => {
        playing.current = false
        pump()
      }, totalAnimMs + 40)
      return
    }

    // Default action (extraTurn, forfeit, gameOver, etc.)
    setState(next)
    const lines = eventsToText(next.events)
    if (lines.length) setLog((l) => [...l, ...lines].slice(-40))
    if (next.phase === 'over') {
      sound.playWin()
    }
    setRolling(false)
    setWaiting(false)
    playing.current = false
    pump()
  }, [])

  const resetGame = useCallback(() => {
    queue.current = []
    playing.current = false
    isInitialState.current = true
    setState(null)
    setLog([])
    setRolling(false)
    setWaiting(false)
  }, [])

  useEffect(() => {
    const isProductionWithoutCustomServer =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      (SERVER_URL.includes('localhost') || SERVER_URL.includes('127.0.0.1'))

    if (isProductionWithoutCustomServer) {
      const p2p = new P2PSocket()
      socketRef.current = p2p
      p2p.on('connect', () => {
        setConnected(true)
        const saved = loadSession()
        if (saved) {
          p2p.emit(
            'room:join',
            { code: saved.code, name: saved.name, playerId: saved.playerId },
            (res: any) => {
              if (!res.ok) saveSession(null)
            }
          )
        }
      })
      p2p.on('disconnect', () => setConnected(false))
      p2p.on('room:update', setRoom)
      p2p.on('room:chat', (msg) => {
        setChatMessages((prev) => [...prev.slice(-99), msg])
      })
      p2p.on('game:state', (s) => {
        queue.current.push(s)
        pump()
      })
      if (p2p.connected) setConnected(true)

      return () => {
        p2p.disconnect()
        socketRef.current = null
      }
    }

    const socket: ClientSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      timeout: 3000
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      const saved = loadSession()
      if (saved) {
        socket.emit(
          'room:join',
          { code: saved.code, name: saved.name, playerId: saved.playerId },
          (res: any) => {
            if (!res.ok) saveSession(null)
          }
        )
      }
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('room:update', setRoom)
    socket.on('room:chat', (msg) => {
      setChatMessages((prev) => [...prev.slice(-99), msg])
    })
    socket.on('game:state', (s) => {
      queue.current.push(s)
      pump()
    })

    // If socket.io connection fails, seamlessly fall back to P2P
    socket.on('connect_error', () => {
      if (!socketRef.current || socketRef.current instanceof P2PSocket) return
      console.warn('Backend server unreachable, switching to P2P Room network')
      socket.disconnect()

      const p2p = new P2PSocket()
      socketRef.current = p2p
      p2p.on('connect', () => {
        setConnected(true)
        const saved = loadSession()
        if (saved) {
          p2p.emit(
            'room:join',
            { code: saved.code, name: saved.name, playerId: saved.playerId },
            (res: any) => {
              if (!res.ok) saveSession(null)
            }
          )
        }
      })
      p2p.on('disconnect', () => setConnected(false))
      p2p.on('room:update', setRoom)
      p2p.on('room:chat', (msg) => {
        setChatMessages((prev) => [...prev.slice(-99), msg])
      })
      p2p.on('game:state', (s) => {
        queue.current.push(s)
        pump()
      })
      if (p2p.connected) setConnected(true)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [pump])

  const createRoom = useCallback((name: string, mode: GameMode = 'solo') => {
    const s = socketRef.current
    if (!s) return
    setError(null)
    setBusy(true)
    sound.playClick()
    s.emit('room:create', { name, mode }, (res: any) => {
      setBusy(false)
      if (res.ok) saveSession({ code: res.code, playerId: res.playerId, name })
      else setError(res.error)
    })
  }, [])

  const setMode = useCallback((mode: GameMode) => {
    setError(null)
    sound.playClick()
    socketRef.current?.emit('room:setMode', mode, (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const joinRoom = useCallback((code: string, name: string) => {
    const s = socketRef.current
    if (!s) return
    setError(null)
    setBusy(true)
    sound.playClick()
    s.emit('room:join', { code, name }, (res: any) => {
      setBusy(false)
      if (res.ok) saveSession({ code: res.code, playerId: res.playerId, name })
      else setError(res.error)
    })
  }, [])

  const addBot = useCallback(() => {
    setError(null)
    sound.playClick()
    socketRef.current?.emit('room:addBot', (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const start = useCallback(() => {
    setError(null)
    sound.playClick()
    socketRef.current?.emit('room:start', (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const removeSeat = useCallback((index: number) => {
    sound.playClick()
    socketRef.current?.emit('room:removeSeat', index, (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const swapSeats = useCallback((index1: number, index2: number) => {
    sound.playClick()
    socketRef.current?.emit('room:swapSeats', index1, index2, (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const leave = useCallback(() => {
    sound.playClick()
    socketRef.current?.emit('room:leave')
    saveSession(null)
    setRoom(null)
    setChatMessages([])
    resetGame()
    setError(null)
  }, [resetGame])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    socketRef.current?.emit('room:chat', trimmed)
  }, [])

  const roll = useCallback(() => {
    const s = socketRef.current
    if (!s) return
    sound.playClick()
    setWaiting(true)
    s.emit('game:roll', (res: any) => {
      if (!res.ok) {
        setWaiting(false)
        setError(res.error)
      }
    })
  }, [])

  const choose = useCallback((tokenIndex: number) => {
    sound.playClick()
    socketRef.current?.emit('game:move', tokenIndex, (res: any) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const myColor = room && room.you !== null ? room.seats[room.you]?.color ?? null : null

  // Sound chime when it becomes the user's turn
  const lastActiveColor = useRef<string | null>(null)
  useEffect(() => {
    if (!state || !myColor || state.phase === 'over') return
    const current = state.players[state.turn]
    if (current === myColor && lastActiveColor.current !== myColor) {
      sound.playYourTurn()
    }
    lastActiveColor.current = current
  }, [state, myColor])

  const view: GameView | null = useMemo(() => {
    if (!state || !room) return null
    const current = state.players[state.turn]
    return {
      state,
      rolling: rolling || waiting,
      canAct:
        state.phase !== 'over' && myColor === current && !rolling && !waiting,
      rows: state.players.map((color) => {
        const seat = room.seats.find((s) => s.color === color)
        const you = seat && room.you !== null && room.seats[room.you] === seat
        const away = seat && seat.kind === 'human' && !seat.connected
        return {
          color,
          label: seat ? `${seat.name}${you ? ' (you)' : ''}${away ? ' (away)' : ''}` : ''
        }
      }),
      log,
      roll,
      choose
    }
  }, [state, room, rolling, waiting, myColor, log, roll, choose])

  return {
    connected,
    room,
    view,
    error,
    busy,
    chatMessages,
    sendChat,
    createRoom,
    joinRoom,
    setMode,
    addBot,
    start,
    removeSeat,
    swapSeats,
    leave,
    dismissError: () => setError(null)
  }
}
