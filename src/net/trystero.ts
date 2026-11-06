import { joinRoom } from 'trystero'
import type { NetMsg, Transport } from './transport'

const APP_ID = 'krisenuebung-flug-zum-mars-v1'

/** Optionales TURN-Relay für Netze, die direkte Verbindungen blockieren. Siehe README. */
function turnConfig() {
  const raw = import.meta.env.VITE_TURN_CONFIG as string | undefined
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    console.warn('VITE_TURN_CONFIG ist kein gültiges JSON und wird ignoriert.')
    return undefined
  }
}

export const hasTurn = () => Boolean(turnConfig())

/** WebRTC über Trystero. Öffentliche Relays dienen nur dem Verbindungsaufbau, die Spieldaten fließen direkt. */
export class TrysteroTransport implements Transport {
  onPeerJoin: Transport['onPeerJoin'] = null
  onPeerLeave: Transport['onPeerLeave'] = null
  onMessage: Transport['onMessage'] = null
  onError: Transport['onError'] = null
  private room: ReturnType<typeof joinRoom>
  private action: { send: (data: string, options?: { target?: string }) => Promise<void> }

  constructor(roomId: string) {
    this.room = joinRoom({ appId: APP_ID, password: roomId, turnConfig: turnConfig() }, roomId, {
      onJoinError: (details) => this.onError?.(String(details.error ?? 'Verbindung fehlgeschlagen.')),
    })
    const action = this.room.makeAction<string>('msg')
    action.onMessage = (data, context) => this.onMessage?.(context.peerId, JSON.parse(data) as NetMsg)
    this.action = action
    this.room.onPeerJoin = (peerId) => this.onPeerJoin?.(peerId)
    this.room.onPeerLeave = (peerId) => this.onPeerLeave?.(peerId)
  }

  send(msg: NetMsg, peerId?: string) {
    void this.action.send(JSON.stringify(msg), peerId ? { target: peerId } : undefined)
  }

  close() {
    void this.room.leave()
  }
}
