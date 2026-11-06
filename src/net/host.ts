import { project } from '../game/projection'
import { joinTeam, pauseAfterHostReturn, reduce, setHostTeam, setOnline, tick } from '../game/reducer'
import { GM, RuleError } from '../game/types'
import type { Action, GameState } from '../game/types'
import { saveGame } from '../storage/db'
import { connect } from './transport'
import type { NetMsg, Transport } from './transport'

const HEARTBEAT_MS = 5000

/** Läuft im Browser des Spielleiters und hält den maßgeblichen Spielstand. */
export class HostSession {
  state: GameState
  saveFailed = false
  private transport: Transport | null = null
  private peers = new Map<string, string>()
  private listeners = new Set<() => void>()
  private timer?: ReturnType<typeof setInterval>
  private flush?: ReturnType<typeof setTimeout>
  private closed = false
  private lastPing = 0

  constructor(state: GameState) {
    // Nach einem Neuladen ist niemand verbunden, bis sich die Teams wieder melden.
    const offline = { ...state, teams: state.teams.map((t) => ({ ...t, online: Boolean(t.isHost) })) }
    this.state = pauseAfterHostReturn(offline, Date.now())
  }

  async start() {
    this.save()
    // Bittet den Browser, den Spielstand nicht bei Speichermangel zu löschen.
    void navigator.storage?.persist?.()
    const transport = await connect(this.state.code)
    if (this.closed) return transport.close()
    this.transport = transport
    transport.onPeerJoin = (peer) => transport.send({ t: 'host' }, peer)
    transport.onPeerLeave = (peer) => {
      const team = this.peers.get(peer)
      this.peers.delete(peer)
      if (team && ![...this.peers.values()].includes(team)) this.commit(setOnline(this.state, team, false))
    }
    transport.onMessage = (peer, msg) => this.receive(peer, msg)
    this.timer = setInterval(() => {
      const now = Date.now()
      const next = tick(this.state, now)
      if (next !== this.state) this.commit(next)
      else if (now - (this.state.hostSeenAt ?? 0) >= HEARTBEAT_MS) this.save()
      if (now - this.lastPing >= HEARTBEAT_MS) {
        this.lastPing = now
        transport.send({ t: 'ping', sent: now })
      }
    }, 1000)
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  /** Speichert sofort und hält dabei das letzte Lebenszeichen fest. */
  private save() {
    this.state = { ...this.state, hostSeenAt: Date.now() }
    saveGame(this.state).then(
      () => this.setSaveFailed(false),
      (e) => {
        console.error(e)
        this.setSaveFailed(true)
      },
    )
  }

  private setSaveFailed(failed: boolean) {
    if (failed === this.saveFailed) return
    this.saveFailed = failed
    this.listeners.forEach((fn) => fn())
  }

  private commit(next: GameState) {
    this.state = next
    this.save()
    this.listeners.forEach((fn) => fn())
    clearTimeout(this.flush)
    this.flush = setTimeout(() => this.broadcast(), 40)
  }

  private broadcast() {
    const now = Date.now()
    for (const [peer, team] of this.peers) this.transport?.send({ t: 'view', view: project(this.state, team), now }, peer)
  }

  private receive(peer: string, msg: NetMsg) {
    if (msg.t === 'hello') {
      try {
        const { state, team } = joinTeam(this.state, { name: msg.name, token: msg.token })
        for (const [p, t] of this.peers) if (t === team.id && p !== peer) this.peers.delete(p)
        this.peers.set(peer, team.id)
        this.transport?.send({ t: 'welcome', token: team.token, teamId: team.id, name: team.name }, peer)
        this.commit(state)
      } catch (e) {
        this.transport?.send({ t: 'joinError', message: e instanceof Error ? e.message : 'Beitritt fehlgeschlagen.' }, peer)
      }
    } else if (msg.t === 'action') {
      const team = this.peers.get(peer)
      if (!team) return
      try {
        this.commit(reduce(this.state, msg.action, team, Date.now()))
      } catch (e) {
        if (!(e instanceof RuleError)) console.error(e)
        this.transport?.send({ t: 'rejected', message: e instanceof Error ? e.message : 'Aktion abgelehnt.' }, peer)
      }
    }
  }

  /** Aktion der Spielleitung oder, im Brücken-Modus, des eigenen Teams. */
  dispatch = (action: Action, actor: string = GM) => this.commit(reduce(this.state, action, actor, Date.now()))

  setHostTeam = (name: string) => this.commit(setHostTeam(this.state, name))

  close() {
    this.closed = true
    clearInterval(this.timer)
    clearTimeout(this.flush)
    this.transport?.close()
  }
}
