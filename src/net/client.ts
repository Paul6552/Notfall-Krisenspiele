import type { Action, View } from '../game/types'
import { loadClient, saveClient } from '../storage/db'
import type { ClientRecord } from '../storage/db'
import { clientKey } from '../storage/db'
import { connect } from './transport'
import type { Transport } from './transport'

export type ClientStatus = 'connecting' | 'joined' | 'hostLost' | 'notFound'

export interface ClientSnapshot {
  status: ClientStatus
  view: View | null
  joinError: string | null
  rejected: { message: string; at: number } | null
  clockOffset: number
}

const NOT_FOUND_MS = 25_000
/** Bei Absturz oder Stromausfall meldet sich der Spielleiter nicht ab. Bleibt sein Herzschlag aus, gilt er als getrennt. */
const HOST_SILENT_MS = 12_000

/** Läuft im Browser eines Teams. */
export class ClientSession {
  snapshot: ClientSnapshot = { status: 'connecting', view: null, joinError: null, rejected: null, clockOffset: 0 }
  private transport: Transport | null = null
  private host: string | null = null
  private listeners = new Set<() => void>()
  private record: ClientRecord
  private notFound?: ReturnType<typeof setTimeout>
  private watchdog?: ReturnType<typeof setInterval>
  private lastHeard = 0
  private closed = false

  constructor(private code: string, name: string) {
    this.record = { key: clientKey(code), code, name, updatedAt: Date.now() }
  }

  async start() {
    const stored = await loadClient(this.code)
    if (stored) {
      this.record = { ...stored, name: this.record.name || stored.name }
      if (stored.lastView) this.set({ view: stored.lastView })
    }
    const transport = await connect(this.code)
    if (this.closed) return transport.close()
    this.transport = transport
    this.armNotFound()
    transport.onPeerLeave = (peer) => {
      if (peer !== this.host) return
      this.host = null
      this.set({ status: 'hostLost' })
    }
    transport.onError = (message) => this.set({ joinError: message })
    this.watchdog = setInterval(() => {
      if (!this.host || Date.now() - this.lastHeard < HOST_SILENT_MS) return
      this.host = null
      this.set({ status: 'hostLost' })
    }, 2000)
    const greet = (peer: string) => {
      this.host = peer
      clearTimeout(this.notFound)
      transport.send({ t: 'hello', name: this.record.name, token: this.record.token }, peer)
    }
    transport.onMessage = (peer, msg) => {
      this.lastHeard = Date.now()
      switch (msg.t) {
        case 'host':
          greet(peer)
          break
        case 'ping':
          // Nur der Spielleiter sendet Herzschläge. War er kurz weg, meldet sich das Team neu an.
          if (!this.host) greet(peer)
          break
        case 'welcome':
          this.record = { ...this.record, token: msg.token, teamId: msg.teamId, name: msg.name }
          this.set({ status: 'joined', joinError: null })
          this.persist()
          break
        case 'joinError':
          this.set({ joinError: msg.message })
          break
        case 'view':
          this.record.lastView = msg.view
          this.set({ view: msg.view, status: 'joined', clockOffset: msg.now - Date.now() })
          this.persist()
          break
        case 'rejected':
          this.set({ rejected: { message: msg.message, at: Date.now() } })
          break
      }
    }
  }

  private armNotFound() {
    clearTimeout(this.notFound)
    this.notFound = setTimeout(() => {
      if (!this.host) this.set({ status: this.snapshot.view ? 'hostLost' : 'notFound' })
    }, NOT_FOUND_MS)
  }

  private persist() {
    void saveClient({ ...this.record, updatedAt: Date.now() })
  }

  private set(patch: Partial<ClientSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  dispatch = (action: Action) => {
    if (!this.host) return this.set({ rejected: { message: 'Keine Verbindung zur Spielleitung.', at: Date.now() } })
    this.transport?.send({ t: 'action', action }, this.host)
  }

  close() {
    this.closed = true
    clearTimeout(this.notFound)
    clearInterval(this.watchdog)
    this.transport?.close()
  }
}
