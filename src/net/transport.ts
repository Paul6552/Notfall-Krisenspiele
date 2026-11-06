import type { Action, View } from '../game/types'

export type NetMsg =
  | { t: 'host' }
  | { t: 'hello'; name: string; token?: string }
  | { t: 'welcome'; token: string; teamId: string; name: string }
  | { t: 'joinError'; message: string }
  | { t: 'view'; view: View; now: number }
  | { t: 'action'; action: Action }
  | { t: 'rejected'; message: string }
  | { t: 'ping'; sent: number }
  | { t: 'pong'; sent: number }

/** Eine Verbindung zwischen Browsern. Der Rest des Spiels kennt nur diese Schnittstelle. */
export interface Transport {
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  onMessage: ((peerId: string, msg: NetMsg) => void) | null
  onError: ((message: string) => void) | null
  send(msg: NetMsg, peerId?: string): void
  close(): void
}

export const isLocalNet = () => new URLSearchParams(location.search).get('net') === 'local'

export async function connect(room: string): Promise<Transport> {
  if (isLocalNet()) {
    const { LocalTransport } = await import('./local')
    return new LocalTransport(room)
  }
  const { TrysteroTransport } = await import('./trystero')
  return new TrysteroTransport(room)
}
