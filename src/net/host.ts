import { project } from '../game/projection'
import { joinTeam, reduce, setHostTeam, setOnline, tick } from '../game/reducer'
import { GM, RuleError } from '../game/types'
import type { Action, GameState } from '../game/types'
import { saveGame } from '../storage/db'
import { connect } from './transport'
import type { NetMsg, Transport } from './transport'

/** Läuft im Browser des Spielleiters und hält den maßgeblichen Spielstand. */
export class HostSession {
  state: GameState
  private transport: Transport | null = null
  private peers = new Map<string, string>()
  private listeners = new Set<() => void>()
  private timer?: ReturnType<typeof setInterval>
  private flush?: ReturnType<typeof setTimeout>
  private closed = false

  constructor(state: GameState) {
    // Nach einem Neuladen ist niemand verbunden, bis sich die Teams wieder melden.
    this.state = { ...state, teams: state.teams.map((t) => ({ ...t, online: Boolean(t.isHost) })) }
  }

  async start() {
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
      const next = tick(this.state, Date.now())
      if (next !== this.state) this.commit(next)
    }, 1000)
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  private commit(next: GameState) {
    this.state = next
    void saveGame(next)
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
