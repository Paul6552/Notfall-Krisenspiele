import { useState } from 'react'
import { E5_BONUS_KW, E5_LIMIT_KW, E5_START_KW, ROLES } from '../game/content/flugZumMars'
import { useNow, clock } from '../app/hooks'
import { GM } from '../game/types'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

export function E4({ view, role, act }: PanelProps) {
  const external = view.settings.comm === 'external'
  const active = view.comms.net === 'backup'
  const gm = view.me === GM
  const mine = view.e4.checkedIn.includes(view.me)
  return (
    <div className="stack">
      {external && <Notice tone="warn">Wechselt jetzt auf die Ersatzplattform, zum Beispiel Mattermost. Baut dort die Kanäle neu auf.</Notice>}
      {role === 'LS' && !active && <button className="btn primary" onClick={() => act({ type: 'e4Activate' })}>Notkanal aktivieren</button>}
      {!active && role !== 'LS' && <p>Der Hauptkanal ist tot. Wartet auf den Befehl der Brücke.</p>}
      {active && !mine && !gm && <button className="btn primary" onClick={() => act({ type: 'e4CheckIn' })}>Am Notkanal anmelden</button>}
      {active && mine && !gm && <Notice tone="good">Ihr seid am Notkanal angemeldet.</Notice>}
      <h3>Anmeldungen ({view.e4.checkedIn.length} von {view.teams.length})</h3>
      <ul className="team-list">
        {view.teams.map((t) => <li key={t.id}>
            <span>{t.name}</span>
            {gm && active && !view.e4.checkedIn.includes(t.id)
              ? <button className="btn small" onClick={() => act({ type: 'e4CheckIn', teamId: t.id })}>Anmelden</button>
              : <span>{view.e4.checkedIn.includes(t.id) ? '✅' : '⏳'}</span>}
          </li>)}
      </ul>
      {view.e3.collisions + view.e3.stormHits > 0 && <p className="muted">Kursbilanz aus dem Ionensturm: {view.e3.collisions} Kollisionen, {view.e3.stormHits} Sturmfelder.</p>}
    </div>
  )
}

export function E5({ view, role, act }: PanelProps) {
  const devices = view.docs.e5Devices ?? []
  const goal = view.docs.e5Goals?.[role]
  if (role === 'LS') {
    const kw = view.e5.totalKw ?? E5_START_KW
    const tone = kw <= E5_BONUS_KW ? 'good' : kw <= E5_LIMIT_KW ? 'ok' : 'bad'
    return (
      <div className="stack">
        <p>Ihr entscheidet, wer Strom bekommt. Ihr wisst aber nicht, was die Komponenten tun. Lasst euch nicht bequatschen und fragt nach, was passiert, wenn ein System ausfällt.</p>
        <div className={`meter ${tone}`}>
          <div className="meter-bar" style={{ width: `${Math.min(100, (kw / E5_START_KW) * 100)}%` }} />
          <span data-testid="kw">{kw} kW</span>
        </div>
        <p className="muted small">Ziel: höchstens {E5_LIMIT_KW} kW. Bonus für die Landung bei höchstens {E5_BONUS_KW} kW.</p>
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.id}>
              <label>
                <input type="checkbox" checked={!d.off} disabled={view.e5.confirmed} onChange={() => act({ type: 'e5Toggle', device: d.id })} />
                <span>{d.name}</span>
              </label>
              <span className="muted">{ROLES[d.owner].section} · {d.kw} kW</span>
            </li>
          ))}
        </ul>
        {view.e5.confirmed ? <Notice tone="good">Lastverteilung bestätigt.</Notice> : <button className="btn primary" onClick={() => act({ type: 'e5Confirm' })}>Lastverteilung bestätigen</button>}
      </div>
    )
  }
  return (
    <div className="stack">
      {goal && <Notice tone="warn"><strong>Euer Ziel:</strong> {goal}</Notice>}
      {devices.filter((d) => d.owner === role).map((d) => (
        <div className="question" key={d.id}>
          <div className="row between">
            <strong>{d.name} ({d.kw} kW)</strong>
            <span className={`tag ${d.off ? 'bad' : 'good'}`}>{d.off ? 'Aus' : 'An'}</span>
          </div>
          <p>{d.info}</p>
        </div>
      ))}
    </div>
  )
}

export function E6({ view, role, act }: PanelProps) {
  const now = useNow()
  const [text, setText] = useState('')
  const { restartStartedAt, done, interrupts } = view.e6
  const total = view.settings.restartSeconds * 1000
  const running = view.comms.silence && restartStartedAt !== null
  const left = running ? total - (now - restartStartedAt) : 0
  return (
    <div className="stack">
      {done ? <Notice tone="good">Reaktor-Neustart abgeschlossen.</Notice> : running ? (
        <>
          <Notice tone="bad">Neustart läuft. Sendet keine Nachrichten!</Notice>
          <div className="meter ok"><div className="meter-bar" style={{ width: `${Math.min(100, 100 - (left / total) * 100)}%` }} /><span>{clock(left)}</span></div>
        </>
      ) : role === 'LS' ? (
        <button className="btn primary" onClick={() => act({ type: 'e6Start' })}>Reaktor-Neustart einleiten</button>
      ) : <p>Wartet auf die Brücke. Sobald der Neustart läuft, gilt Funkstille.</p>}
      {interrupts > 0 && <p className="muted">Unterbrechungen bisher: {interrupts} von 3.</p>}
      {role === 'S5' && (
        <>
          <h3>Offizielle Richtigstellung</h3>
          <p>Als Einzige dürft ihr während des Neustarts senden, aber nur über diese offizielle Meldung. Sie stört den Reaktor nicht.</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'statement', text }); setText('') }}>
            <input aria-label="Richtigstellung" placeholder="Stellt die Falschmeldungen richtig" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn">Veröffentlichen</button>
          </form>
        </>
      )}
    </div>
  )
}
