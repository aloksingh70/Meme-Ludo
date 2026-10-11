import Peer, { type DataConnection } from 'peerjs'
import {
  RoomManager,
  type ChatMessage,
  type ClientToServerEvents,
  type GameMode,
  type GameState,
  type Room,
  type RoomPublic
} from '@ludo/shared'

const PEER_PREFIX = 'meme-ludo-v2-'
const BOT_DELAY_MS = 1000

type MessageToHost =
  | { type: 'join'; name: string; playerId?: string; id: string }
  | { type: 'start'; playerId: string; id: string }
  | { type: 'setMode'; mode: GameMode; playerId: string; id: string }
  | { type: 'addBot'; playerId: string; id: string }
  | { type: 'removeSeat'; index: number; playerId: string; id: string }
  | { type: 'swapSeats'; index1: number; index2: number; playerId: string; id: string }
  | { type: 'roll'; playerId: string; id: string }
  | { type: 'move'; tokenIndex: number; playerId: string; id: string }
  | { type: 'chat'; text: string; playerId: string }
  | { type: 'leave'; playerId: string }

type MessageToGuest =
  | { type: 'ack'; id: string; ok: boolean; data?: any; error?: string }
  | { type: 'room:update'; room: RoomPublic }
  | { type: 'game:state'; state: GameState }
  | { type: 'chat'; message: ChatMessage }

export class P2PSocket {
  private listeners = new Map<string, Set<(...args: any[]) => void>>()
  private peer: Peer | null = null
  private guestConn: DataConnection | null = null
  private hostConns = new Map<string, DataConnection>()
  private mgr: RoomManager | null = null
  private room: Room | null = null
  private myPlayerId: string | null = null
  private botTimer: any = null
  private isHost = false
  public connected = false

  constructor() {
    this.initPeer()
  }

  private initPeer() {
    try {
      this.peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      })

      this.peer.on('open', () => {
        this.connected = true
        this.emitLocal('connect')
      })

      this.peer.on('error', (err) => {
        console.warn('P2P Peer error:', err)
      })

      this.peer.on('disconnected', () => {
        this.connected = false
        this.emitLocal('disconnect')
      })
    } catch (e) {
      console.error('Failed to init Peer:', e)
    }
  }

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(fn)
  }

  off(event: string, fn: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(fn)
  }

  private emitLocal(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args)
      } catch (err) {
        console.error('Listener error:', err)
      }
    })
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): void
  emit(event: string, ...args: any[]): void
  emit(event: string, ...args: any[]) {
    if (this.isHost) {
      this.handleHostEmit(event, args)
    } else {
      this.handleGuestEmit(event, args)
    }
  }

  // =================== HOST LOGIC ===================
  private handleHostEmit(event: string, args: any[]) {
    if (!this.mgr || !this.room) return

    if (event === 'room:setMode') {
      const [mode, ack] = args
      const res = this.mgr.setMode(this.room, this.myPlayerId!, mode)
      ack?.(res)
      if (res.ok) this.broadcastRoom()
    } else if (event === 'room:addBot') {
      const [ack] = args
      const res = this.mgr.addBot(this.room, this.myPlayerId!)
      ack?.(res)
      if (res.ok) this.broadcastRoom()
    } else if (event === 'room:removeSeat') {
      const [index, ack] = args
      const res = this.mgr.removeSeat(this.room, this.myPlayerId!, index)
      ack?.(res)
      if (res.ok) this.broadcastRoom()
    } else if (event === 'room:swapSeats') {
      const [idx1, idx2, ack] = args
      const res = this.mgr.swapSeats(this.room, this.myPlayerId!, idx1, idx2)
      ack?.(res)
      if (res.ok) this.broadcastRoom()
    } else if (event === 'room:start') {
      const [ack] = args
      const res = this.mgr.start(this.room, this.myPlayerId!)
      ack?.(res)
      if (res.ok) {
        this.broadcastRoom()
        this.broadcastState()
        this.checkBot()
      }
    } else if (event === 'game:roll') {
      const [ack] = args
      const res = this.mgr.roll(this.room, this.myPlayerId!)
      ack?.(res)
      if (res.ok) {
        this.broadcastState()
        this.checkBot()
      }
    } else if (event === 'game:move') {
      const [tokenIndex, ack] = args
      const res = this.mgr.move(this.room, this.myPlayerId!, tokenIndex)
      ack?.(res)
      if (res.ok) {
        this.broadcastState()
        this.checkBot()
      }
    } else if (event === 'room:chat') {
      const [text] = args
      if (typeof text !== 'string') return
      const clean = text.trim().slice(0, 200)
      if (!clean) return
      const seat = this.room.seats.find((s) => s.playerId === this.myPlayerId)
      const chatMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        senderName: seat?.name ?? 'Host',
        senderColor: seat?.color ?? null,
        text: clean,
        time: Date.now()
      }
      this.emitLocal('room:chat', chatMsg)
      for (const conn of this.hostConns.values()) {
        conn.send({ type: 'chat', message: chatMsg })
      }
    } else if (event === 'room:leave') {
      this.mgr.leave(this.room, this.myPlayerId!)
      this.broadcastRoom()
      this.disconnect()
    }
  }

  private broadcastRoom() {
    if (!this.mgr || !this.room) return

    // To local host
    const hostView = this.mgr.publicView(this.room, this.myPlayerId)
    this.emitLocal('room:update', hostView)

    // To each connected guest
    for (const [peerId, conn] of this.hostConns) {
      const seat = this.room.seats.find((s) => s.socketId === peerId)
      const guestView = this.mgr.publicView(this.room, seat?.playerId ?? null)
      conn.send({ type: 'room:update', room: guestView })
    }
  }

  private broadcastState() {
    if (!this.room?.state) return

    // To local host
    this.emitLocal('game:state', this.room.state)

    // To guests
    for (const conn of this.hostConns.values()) {
      conn.send({ type: 'game:state', state: this.room.state })
    }
  }

  private checkBot() {
    if (!this.mgr || !this.room || !this.mgr.needsBot(this.room)) return
    if (this.botTimer) return

    this.botTimer = setTimeout(() => {
      this.botTimer = null
      if (!this.mgr || !this.room) return
      if (this.mgr.botStep(this.room)) {
        this.broadcastState()
        this.checkBot()
      }
    }, BOT_DELAY_MS)
  }

  // =================== GUEST LOGIC ===================
  private handleGuestEmit(event: string, args: any[]) {
    if (event === 'room:create') {
      this.startHostRoom(args[0], args[1])
      return
    }

    if (event === 'room:join') {
      const [{ code, name, playerId }, ack] = args
      this.joinAsGuest(code, name, playerId, ack)
      return
    }

    if (!this.guestConn) return

    const id = Math.random().toString(36).slice(2)
    if (event === 'room:start') {
      const [ack] = args
      this.sendGuestAction({ type: 'start', playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'room:setMode') {
      const [mode, ack] = args
      this.sendGuestAction({ type: 'setMode', mode, playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'room:addBot') {
      const [ack] = args
      this.sendGuestAction({ type: 'addBot', playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'room:removeSeat') {
      const [index, ack] = args
      this.sendGuestAction({ type: 'removeSeat', index, playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'room:swapSeats') {
      const [index1, index2, ack] = args
      this.sendGuestAction({ type: 'swapSeats', index1, index2, playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'game:roll') {
      const [ack] = args
      this.sendGuestAction({ type: 'roll', playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'game:move') {
      const [tokenIndex, ack] = args
      this.sendGuestAction({ type: 'move', tokenIndex, playerId: this.myPlayerId!, id }, ack)
    } else if (event === 'room:chat') {
      const [text] = args
      if (typeof text === 'string' && text.trim()) {
        this.guestConn.send({ type: 'chat', text: text.trim().slice(0, 200), playerId: this.myPlayerId! })
      }
    } else if (event === 'room:leave') {
      this.guestConn.send({ type: 'leave', playerId: this.myPlayerId! })
      this.disconnect()
    }
  }

  private pendingAcks = new Map<string, (res: any) => void>()
  private sendGuestAction(msg: MessageToHost, ack?: (res: any) => void) {
    if (ack && 'id' in msg) {
      this.pendingAcks.set(msg.id, ack)
    }
    this.guestConn?.send(msg)
  }

  // =================== CREATING A ROOM (HOST) ===================
  private startHostRoom(payload: any, ack: (res: any) => void) {
    const name = typeof payload === 'object' ? payload.name : payload
    const mode = typeof payload === 'object' ? payload.mode ?? 'solo' : 'solo'

    this.mgr = new RoomManager()
    const res = this.mgr.createRoom(name, 'host', null, mode)
    if (!res.ok) {
      ack?.(res)
      return
    }

    this.room = res.room
    this.myPlayerId = res.playerId
    this.isHost = true

    // Re-create peer with the room code ID so guests can find it
    this.peer?.destroy()
    const hostPeerId = PEER_PREFIX + this.room.code

    this.peer = new Peer(hostPeerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    })

    this.peer.on('open', () => {
      this.connected = true
      this.emitLocal('connect')
      ack?.({ ok: true, code: this.room!.code, playerId: this.myPlayerId! })
      this.broadcastRoom()
    })

    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.hostConns.set(conn.peer, conn)
      })

      conn.on('data', (data: any) => {
        this.handleGuestMessage(conn, data as MessageToHost)
      })

      conn.on('close', () => {
        this.hostConns.delete(conn.peer)
        if (this.mgr && this.room) {
          this.mgr.disconnect(conn.peer)
          this.broadcastRoom()
          this.checkBot()
        }
      })
    })

    this.peer.on('error', (err: any) => {
      console.warn('Host Peer error:', err)
      if (err.type === 'unavailable-id') {
        // Retry with another code if by rare chance already taken
        this.startHostRoom(payload, ack)
      } else {
        ack?.({ ok: false, error: err.message ?? 'Failed to create room' })
      }
    })
  }

  private handleGuestMessage(conn: DataConnection, msg: MessageToHost) {
    if (!this.mgr || !this.room) return

    if (msg.type === 'join') {
      const res = this.mgr.joinRoom(this.room.code, msg.name, conn.peer, msg.playerId)
      conn.send({
        type: 'ack',
        id: msg.id,
        ok: res.ok,
        data: res.ok ? { code: this.room.code, playerId: res.playerId } : undefined,
        error: res.ok ? undefined : res.error
      })
      if (res.ok) {
        this.broadcastRoom()
      }
    } else if (msg.type === 'start') {
      const res = this.mgr.start(this.room, msg.playerId)
      conn.send({ type: 'ack', id: msg.id, ok: res.ok, error: res.ok ? undefined : res.error })
      if (res.ok) {
        this.broadcastRoom()
        this.broadcastState()
        this.checkBot()
      }
    } else if (msg.type === 'roll') {
      const res = this.mgr.roll(this.room, msg.playerId)
      conn.send({ type: 'ack', id: msg.id, ok: res.ok, error: res.ok ? undefined : res.error })
      if (res.ok) {
        this.broadcastState()
        this.checkBot()
      }
    } else if (msg.type === 'move') {
      const res = this.mgr.move(this.room, msg.playerId, msg.tokenIndex)
      conn.send({ type: 'ack', id: msg.id, ok: res.ok, error: res.ok ? undefined : res.error })
      if (res.ok) {
        this.broadcastState()
        this.checkBot()
      }
    } else if (msg.type === 'chat') {
      const seat = this.room.seats.find((s) => s.playerId === msg.playerId)
      const chatMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        senderName: seat?.name ?? 'Player',
        senderColor: seat?.color ?? null,
        text: msg.text,
        time: Date.now()
      }
      this.emitLocal('room:chat', chatMsg)
      for (const guestConn of this.hostConns.values()) {
        guestConn.send({ type: 'chat', message: chatMsg })
      }
    } else if (msg.type === 'leave') {
      this.mgr.leave(this.room, msg.playerId)
      this.broadcastRoom()
      this.checkBot()
    }
  }

  // =================== JOINING A ROOM (GUEST) ===================
  private joinAsGuest(code: string, name: string, playerId: string | undefined, ack: (res: any) => void) {
    const formattedCode = code.trim().toUpperCase()
    const targetPeerId = PEER_PREFIX + formattedCode

    if (!this.peer || this.peer.destroyed) {
      this.initPeer()
    }

    const doConnect = () => {
      const conn = this.peer!.connect(targetPeerId, {
        reliable: true
      })
      this.guestConn = conn

      const timeout = setTimeout(() => {
        ack?.({ ok: false, error: 'Could not connect to host. Make sure the host room is open.' })
      }, 9000)

      conn.on('open', () => {
        clearTimeout(timeout)
        const reqId = 'join-' + Math.random().toString(36).slice(2)
        this.pendingAcks.set(reqId, (res) => {
          if (res.ok) {
            this.myPlayerId = res.playerId
          }
          ack?.(res)
        })
        conn.send({
          type: 'join',
          name,
          playerId,
          id: reqId
        })
      })

      conn.on('data', (data: any) => {
        const msg = data as MessageToGuest
        if (msg.type === 'ack') {
          const fn = this.pendingAcks.get(msg.id)
          if (fn) {
            this.pendingAcks.delete(msg.id)
            fn(msg.ok ? { ok: true, ...(msg.data ?? {}) } : { ok: false, error: msg.error })
          }
        } else if (msg.type === 'room:update') {
          this.emitLocal('room:update', msg.room)
        } else if (msg.type === 'game:state') {
          this.emitLocal('game:state', msg.state)
        } else if (msg.type === 'chat') {
          this.emitLocal('room:chat', msg.message)
        }
      })

      conn.on('close', () => {
        this.emitLocal('disconnect')
      })

      conn.on('error', (err) => {
        clearTimeout(timeout)
        ack?.({ ok: false, error: 'Connection error: ' + (err.message ?? 'Host unreachable') })
      })
    }

    if (this.peer?.open) {
      doConnect()
    } else {
      this.peer?.once('open', doConnect)
    }
  }

  disconnect() {
    if (this.botTimer) {
      clearTimeout(this.botTimer)
      this.botTimer = null
    }
    this.guestConn?.close()
    this.guestConn = null
    for (const c of this.hostConns.values()) c.close()
    this.hostConns.clear()
    this.peer?.destroy()
    this.peer = null
    this.connected = false
    this.emitLocal('disconnect')
  }
}
