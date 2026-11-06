import { useState } from 'react'
import { E7_DELAY_SECONDS, ROLES, SECTOR_ORDER } from '../game/content/flugZumMars'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

/** Streichhölzer als Sieben-Segment-Ziffern: 3 + 3 = 8 */
const SEGMENTS: Record<string, number[]> = { '3': [0, 1, 2, 3, 6], '8': [0, 1, 2, 3, 4, 5, 6] }
const LINES = [[0, 0, 20, 0], [20, 0, 20, 20], [20, 20, 20, 40], [0, 40, 20, 40], [0, 20, 0, 40], [0, 0, 0, 20], [0, 20, 20, 20]]

function Digit({ d, x }: { d: string; x: number }) {
  return <g transform={`translate(${x} 6)`}>{SEGMENTS[d].map((s) => <Stick key={s} l={LINES[s]} />)}</g>
}
const Stick = ({ l }: { l: number[] }) => (
  <>
    <line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#e8cfa0" strokeWidth={3.4} strokeLinecap="round" />
    <circle cx={l[2]} cy={l[3]} r={2.4} fill="#d9544a" />
  </>
)

function Matchsticks() {
  return (
    <svg className="matches" viewBox="0 0 190 52" role="img" aria-label="Streichholz-Gleichung: 3 plus 3 ist gleich 8">
      <Digit d="3" x={8} />
      <g transform="translate(46 6)"><Stick l={[0, 20, 20, 20]} /><Stick l={[10, 10, 10, 30]} /></g>
      <Digit d="3" x={84} />
      <g transform="translate(122 6)"><Stick l={[0, 14, 20, 14]} /><Stick l={[0, 26, 20, 26]} /></g>
      <Digit d="8" x={160} />
    </svg>
  )
}

export function E7({ view, role, act }: PanelProps) {
  const [draft, setDraft] = useState('')
  if (role === 'LS') return <Landing view={view} role={role} act={act} />
  const frag = view.docs.e7Fragments?.[role]
  if (!frag) return null
  const blurred = role === 'S6' && view.flags.blurS6
  const delayed = role === 'S3' && view.flags.delayedS3
  const sent = view.e7.sent[role]
  return (
    <div className="stack">
      {role === 'S4' && view.flags.oxygenRule && <Notice tone="warn">Sauerstoff reduziert: Es dürfen höchstens 2 Personen in einem Raum sein.</Notice>}
      {role === 'S1' && view.flags.injuredS1 && <Notice tone="warn">Dämpfer waren aus: Ein Teammitglied ist verletzt. Eure aktuelle Einsatzleitung pausiert, die Kommunikation läuft nur über eine Vertretung.</Notice>}
      {blurred && <Notice tone="warn">Werkbank-Licht aus: Die Fragmente sind kaum lesbar.</Notice>}
      {delayed && <Notice tone="warn">Vorwärmer waren aus: Ihr könnt nur ein Zeichen pro Übermittlung senden, danach {E7_DELAY_SECONDS / 60} Minuten Pause.</Notice>}
      <p>{frag.instruction}</p>
      {frag.matchstick && <Matchsticks />}
      <ol className={`fragments ${blurred ? 'blurred' : ''}`}>
        {frag.cards.map((c) => <li key={c}><code>{c}</code></li>)}
      </ol>
      <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'e7Send', role, code: draft }); setDraft('') }}>
        <input aria-label="Sektoren-Code" inputMode="numeric" maxLength={delayed ? 1 : 2} placeholder={delayed ? 'Ein Zeichen' : 'Sektoren-Code'} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn">An die Brücke senden</button>
      </form>
      {sent && <p className="muted">Gesendet: {sent}</p>}
    </div>
  )
}

function Landing({ view, act }: PanelProps) {
  const [code, setCode] = useState('')
  const { sent, attempts, lastFeedback, landed } = view.e7
  return (
    <div className="stack">
      {landed && <Notice tone="good">Touchdown! Die ARES 1 ist sicher auf dem Mars gelandet.</Notice>}
      <h3>Master-Matrix</h3>
      <table className="data">
        <thead><tr>{SECTOR_ORDER.map((r) => <th key={r}>{ROLES[r].code}</th>)}</tr></thead>
        <tbody><tr>{SECTOR_ORDER.map((r) => <td key={r} className="mono">{sent[r] ?? '··'}</td>)}</tr></tbody>
      </table>
      <p className="muted small">Der Code ergibt sich aus den Sektoren-Codes in der Reihenfolge S1 bis S6.</p>
      {!landed && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'e7Land', code }) }}>
          <input aria-label="Lande-Code" className="mono" inputMode="numeric" maxLength={14} placeholder="12-stelliger Lande-Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn primary">Landen</button>
        </form>
      )}
      {!landed && <p>Verbleibende Versuche: <strong>{attempts}</strong></p>}
      {lastFeedback && !landed && <Notice tone="bad">{lastFeedback}</Notice>}
    </div>
  )
}
