import { useMemo, useState } from 'react'
import { E6_INJECTS, PHASE_INFO, ROLES, SECTOR_ORDER, roleLabel } from '../game/content/flugZumMars'
import { Lessons } from '../events/Lessons'
import { project } from '../game/projection'
import { ALL, GM, PHASES, ROLE_IDS } from '../game/types'
import type { Action, GameState, ShipStatus, View } from '../game/types'
import { ShipScene } from '../ship/Ship'
import { Chat } from './Chat'
import { Banners, RoleWorkspace, StatusBar } from './GameRoom'
import { Notice } from './shared'

const download = (state: GameState) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `spielstand-${state.code}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function progress(view: View, state: GameState): string[] {
  switch (view.phase) {
    case 'e1': return [`Antworten: ${Object.keys(state.e1.answers).length} von 5`, `Entscheidung: ${state.e1.decision ?? 'offen'}`]
    case 'e2': return [`Bauplan gesendet: ${state.e2.planSent ? 'ja' : 'nein'}`, `Geliefert: ${Object.keys(state.e2.built).length} von 14`, `Eingebaut: ${Object.keys(state.e2.placed).length} von 14`, `Repariert: ${state.e2.repaired ? 'ja' : 'nein'}`]
    case 'e3': return [`Position: Spalte ${state.e3.pos.x + 1}, Zeile ${state.e3.pos.y + 1}`, `Kollisionen: ${state.e3.collisions}`, `Sturmfelder: ${state.e3.stormHits}`, `Durchquert: ${state.e3.arrived ? 'ja' : 'nein'}`, `Sturm bekannt: ${state.e3.stormKnown ? 'ja' : 'nein'}`, `Funkmast: ${state.e3.found.mast.length} von 6`, `Schaltpult: ${state.e3.found.panel.length} von 6`]
    case 'e4': return [`Notkanal: ${state.comms.net === 'backup' ? 'aktiv' : 'nicht aktiv'}`, `Angemeldet: ${state.e4.checkedIn.length} von ${state.teams.length}`]
    case 'e5': return [`Abgeschaltete Geräte: ${state.e5.off.length}`, `Bestätigt: ${state.e5.confirmed ? 'ja' : 'nein'}`]
    case 'e6': return [`Neustart: ${state.e6.done ? 'fertig' : state.comms.silence ? 'läuft' : 'nicht gestartet'}`, `Unterbrechungen: ${state.e6.interrupts}`]
    case 'e7': return [`Gesendete Sektoren-Codes: ${SECTOR_ORDER.filter((r) => state.e7.sent[r]).length} von 6`, `Versuche übrig: ${state.e7.attempts}`, `Gelandet: ${state.e7.landed ? 'ja' : 'nein'}`]
    default: return []
  }
}

function Injects({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const [text, setText] = useState('')
  const [label, setLabel] = useState('Unbekannter Sender')
  const [org, setOrg] = useState(state.teams[0]?.name ?? '')
  const [to, setTo] = useState(ALL)
  return (
    <section className="card">
      <h2>Meldung einspielen</h2>
      {state.phase === 'e6' && (
        <div className="row wrap">
          <label className="field">Organisation in der Vorlage
            <select value={org} onChange={(e) => setOrg(e.target.value)}>{state.teams.map((t) => <option key={t.id}>{t.name}</option>)}</select>
          </label>
          <label className="field grow">Vorlage
            <select value="" onChange={(e) => e.target.value && setText(e.target.value.replaceAll('{org}', org))}>
              <option value="">Vorlage wählen</option>
              {E6_INJECTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      )}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); act({ type: 'inject', text, label, to }); setText('') }}>
        <textarea aria-label="Text der Meldung" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text der Meldung" />
        <div className="row wrap">
          <label className="field grow">Absender<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <label className="field">An
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value={ALL}>Alle</option>
              {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <button className="btn small">Einspielen</button>
        </div>
      </form>
    </section>
  )
}

export function Console({ state, act, error }: { state: GameState; act: (a: Action) => void; error: { message: string } | null }) {
  const view = useMemo(() => project(state, GM), [state])
  const [reveal, setReveal] = useState(false)
  const paused = Boolean(state.pausedAt)
  const next = PHASES[PHASES.indexOf(state.phase) + 1]
  const debrief = state.phase === 'lessons' || state.phase === 'done'

  const adjust = (key: keyof ShipStatus, delta: number) => act({ type: 'adjustShip', key, delta })

  return (
    <div className="room-layout console">
      <StatusBar view={view} />
      <aside className="ship-col">
        <ShipScene
          teams={state.teams}
          teamCount={state.teamCount}
          roleOwner={state.roleOwner}
          phase={state.phase}
          ignition={state.phase === 'e1' && state.e1.decision === 'go'}
          landed={state.e7.landed}
          alert={state.phase === 'e2' && !state.e2.repaired}
        />
      </aside>
      <div className="work stack">
        <section className="card stack">
          <h2>Spielleitung</h2>
          <Banners view={view} />
          {error && <Notice tone="bad">{error.message}</Notice>}
          <p className="briefing">{PHASE_INFO[state.phase].briefing}</p>
          <div className="row wrap">
            {next && <button className="btn primary" onClick={() => act({ type: 'advance' })}>Weiter: {PHASE_INFO[next].short}</button>}
            <button className="btn" onClick={() => act({ type: paused ? 'resume' : 'pause' })}>{paused ? 'Fortsetzen' : 'Pausieren'}</button>
            {state.failure && <button className="btn" onClick={() => act({ type: 'clearFailure' })}>Scheitern aufheben und weiterspielen</button>}
            {state.phase === 'e6' && state.comms.silence && <button className="btn danger" onClick={() => act({ type: 'flagViolation' })}>Verstoß erfassen</button>}
          </div>
          {progress(view, state).length > 0 && <ul className="progress">{progress(view, state).map((p) => <li key={p}>{p}</li>)}</ul>}
          <details>
            <summary>Schiffswerte korrigieren</summary>
            <div className="adjust">
              {(['hull', 'oxygen', 'morale', 'timeBuffer'] as const).map((k) => (
                <div className="row" key={k}>
                  <span>{{ hull: 'Hülle', oxygen: 'Sauerstoff', morale: 'Moral', timeBuffer: 'Zeitpuffer' }[k]}</span>
                  <button className="btn small" onClick={() => adjust(k, -5)}>−5</button>
                  <button className="btn small" onClick={() => adjust(k, 5)}>+5</button>
                </div>
              ))}
            </div>
          </details>
          {state.phase === 'e6' && (
            <label className="field">Dauer des Neustarts (Sekunden)
              <input type="number" min={10} value={state.settings.restartSeconds} onChange={(e) => act({ type: 'setSettings', settings: { restartSeconds: Math.max(10, Number(e.target.value)) } })} />
            </label>
          )}
          <button className="btn small ghost" onClick={() => download(state)}>Spielstand als Datei sichern</button>
        </section>

        {debrief && <section className="card"><Lessons view={view} act={act} /></section>}
        {!debrief && <Injects key={state.phase} state={state} act={act} />}

        {!debrief && state.phase !== 'checkin' && (
          <section className="card">
            <div className="row between">
              <h2>Rollenansichten und Lösungen</h2>
              <button className="btn small" aria-expanded={reveal} onClick={() => setReveal(!reveal)}>{reveal ? 'Verbergen' : 'Anzeigen'}</button>
            </div>
            {reveal ? (
              <>
                <Notice tone="warn">Hier seht ihr geheime Daten aller Rollen und könnt für ein Team eingreifen.</Notice>
                {view.docs.landingCode && <p>Lande-Code: <strong className="mono">{view.docs.landingCode}</strong></p>}
                <RoleWorkspace view={view} roles={[...ROLE_IDS]} act={act} />
              </>
            ) : <p className="muted small">Verdeckt, damit niemand versehentlich Lösungen sieht.</p>}
          </section>
        )}

        <section className="card">
          <h2>Besetzung</h2>
          <ul className="team-list">
            {state.teams.map((t) => (
              <li key={t.id}>
                <span><span className={`dot ${t.online ? 'on' : ''}`} /> {t.name}</span>
                <span className="muted small">{ROLE_IDS.filter((r) => state.roleOwner[r] === t.id).map((r) => ROLES[r].code).join(', ')}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{ROLE_IDS.map(roleLabel).join(' · ')}</p>
        </section>
      </div>
      <Chat view={view} act={act} />
    </div>
  )
}
