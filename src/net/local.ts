import type { NetMsg, Transport } from './transport'

type Envelope =
  | { k: 'join' | 'here' | 'leave'; from: string; to?: string }
  | { k: 'msg'; from: string; to?: string; msg: NetMsg }

/** Transport über mehrere Tabs desselben Browsers, für Tests und Probeläufe (?net=local). */
export class LocalTransport implements Transport {
  onPeerJoin: Transport['onPeerJoin'] = null
  onPeerLeave: Transport['onPeerLeave'] = null
  onMessage: Transport['onMessage'] = null
  onError: Transport['onError'] = null
  private id = crypto.randomUUID()
  private peers = new Set<string>()
  private channel: BroadcastChannel
  private leave = () => this.post({ k: 'leave', from: this.id })

  constructor(room: string) {
    this.channel = new BroadcastChannel(`bcm-${room}`)
    this.channel.onmessage = (e: MessageEvent<Envelope>) => this.receive(e.data)
    addEventListener('pagehide', this.leave)
    queueMicrotask(() => this.post({ k: 'join', from: this.id }))
  }

  private post(e: Envelope) {
    this.channel.postMessage(e)
  }

  private addPeer(id: string) {
    if (this.peers.has(id)) return
    this.peers.add(id)
    this.onPeerJoin?.(id)
  }

  private receive(e: Envelope) {
    if (e.from === this.id || (e.to && e.to !== this.id)) return
    if (e.k === 'join') {
      this.post({ k: 'here', from: this.id, to: e.from })
      this.addPeer(e.from)
    } else if (e.k === 'here') {
      this.addPeer(e.from)
    } else if (e.k === 'leave') {
      if (this.peers.delete(e.from)) this.onPeerLeave?.(e.from)
    } else if (e.k === 'msg') {
      this.onMessage?.(e.from, e.msg)
    }
  }

  send(msg: NetMsg, peerId?: string) {
    this.post({ k: 'msg', from: this.id, to: peerId, msg })
  }

  close() {
    removeEventListener('pagehide', this.leave)
    this.leave()
    this.channel.close()
  }
}
