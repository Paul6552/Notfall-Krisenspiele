import { useEffect, useRef, useState } from 'react'
import { connect } from '../net/transport'
import type { Transport } from '../net/transport'
import { Notice } from './shared'

type Check = 'pending' | 'ok' | 'fail'

async function checkStun(): Promise<Check> {
  if (typeof RTCPeerConnection === 'undefined') return 'fail'
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    const finish = (r: Check) => {
      pc.close()
      resolve(r)
    }
    pc.onicecandidate = (e) => {
      if (e.candidate?.type === 'srflx') finish('ok')
      if (!e.candidate) finish('fail')
    }
    pc.createDataChannel('test')
    void pc.createOffer().then((o) => pc.setLocalDescription(o))
    setTimeout(() => finish('fail'), 8000)
  })
}

const label = { pending: '⏳ Wird geprüft', ok: '✅ In Ordnung', fail: '❌ Blockiert' }

export function ConnectionTest() {
  const [stun, setStun] = useState<Check>('pending')
  const [room, setRoom] = useState('')
  const [joined, setJoined] = useState(false)
  const [peers, setPeers] = useState(0)
  const [latency, setLatency] = useState<number | null>(null)
  const transport = useRef<Transport | null>(null)

  useEffect(() => void checkStun().then(setStun), [])
  useEffect(() => () => transport.current?.close(), [])

  const join = async () => {
    const t = await connect(`test-${room.trim().toUpperCase()}`)
    transport.current = t
    setJoined(true)
    t.onPeerJoin = (peer) => {
      setPeers((n) => n + 1)
      t.send({ t: 'ping', sent: Date.now() }, peer)
    }
    t.onPeerLeave = () => setPeers((n) => n - 1)
    t.onMessage = (peer, msg) => {
      if (msg.t === 'ping') t.send({ t: 'pong', sent: msg.sent }, peer)
      if (msg.t === 'pong') setLatency(Date.now() - msg.sent)
    }
  }

  return (
    <div className="narrow">
      <a className="back" href="#/">← Zurück</a>
      <h1>Verbindungstest</h1>
      <p className="lead">Prüft vor dem Übungstag, ob euer Netz die direkte Verbindung zwischen Browsern zulässt.</p>
      <section className="card stack">
        <h2>1. Dieses Gerät</h2>
        <p>Netz erlaubt WebRTC: <strong data-testid="stun">{label[stun]}</strong></p>
        {stun === 'fail' && <Notice tone="warn">Dieses Netz blockiert vermutlich WebRTC. Bittet eure IT um Freigabe oder richtet ein TURN-Relay ein. Teil 2 zeigt, ob es trotzdem klappt.</Notice>}
      </section>
      <section className="card stack">
        <h2>2. Test mit einer zweiten Organisation</h2>
        <p>Vereinbart ein Testwort und gebt es auf beiden Seiten gleichzeitig ein.</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (room.trim()) void join() }}>
          <input aria-label="Testwort" disabled={joined} placeholder="Testwort" value={room} onChange={(e) => setRoom(e.target.value)} />
          <button className="btn" disabled={joined}>Test starten</button>
        </form>
        {joined && (peers > 0
          ? <Notice tone="good"><span data-testid="peer-ok">Verbunden mit {peers} Gegenstelle{peers > 1 ? 'n' : ''}.</span>{latency !== null && ` Laufzeit: ${latency} ms.`}</Notice>
          : <Notice>Warte auf die Gegenstelle … Das kann bis zu einer Minute dauern.</Notice>)}
      </section>
    </div>
  )
}
