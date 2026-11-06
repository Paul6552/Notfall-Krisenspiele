import { useState } from 'react'
import { inviteLink } from '../app/router'
import { ROLES } from '../game/content/flugZumMars'
import { canStart } from '../game/reducer'
import { ROLE_IDS } from '../game/types'
import type { Action, GameState, RoleId } from '../game/types'
import { ShipScene } from '../ship/Ship'
import { Notice } from './shared'

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn small"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? 'Kopiert ✓' : label}
    </button>
  )
}

export function Lobby({ state, act, onError, setHostTeam }: {
  state: GameState
  act: (a: Action) => void
  onError: string | null
  setHostTeam: (name: string) => void
}) {
  const [slot, setSlot] = useState('')
  const [hostName, setHostName] = useState(state.teams.find((t) => t.isHost)?.name ?? '')
  const problems = canStart(state)
  const bridge = state.settings.gmMode === 'bridge'

  return (
    <div className="lobby">
      <div className="lobby-main">
        <section className="card code-card">
          <p className="eyebrow">Spielnummer</p>
          <p className="game-code" data-testid="game-code">{state.code}</p>
          <div className="row wrap">
            <Copy text={state.code} label="Nummer kopieren" />
            <Copy text={inviteLink(state.code)} label="Einladungslink kopieren" />
          </div>
          <p className="muted small">Schickt die Nummer oder den Link an alle Organisationen. Dieser Browser hält den Spielstand, lasst ihn während der Übung offen.</p>
        </section>

        <section className="card">
          <h2>Einstellungen</h2>
          <fieldset>
            <legend>Rolle des Spielleiters</legend>
            <label className="radio"><input type="radio" name="gm" checked={!bridge} onChange={() => act({ type: 'setSettings', settings: { gmMode: 'neutral' } })} /> Spielleiter ist kein Team</label>
            <label className="radio"><input type="radio" name="gm" checked={bridge} onChange={() => act({ type: 'setSettings', settings: { gmMode: 'bridge' } })} /> Spielleiter spielt die Brücke</label>
          </fieldset>
          {bridge && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (hostName.trim()) setHostTeam(hostName.trim()) }}>
              <input aria-label="Name der eigenen Organisation" placeholder="Eigene Organisation" value={hostName} onChange={(e) => setHostName(e.target.value)} />
              <button className="btn small">Speichern</button>
            </form>
          )}
          <fieldset>
            <legend>Kommunikation</legend>
            <label className="radio"><input type="radio" name="comm" checked={state.settings.comm === 'ingame'} onChange={() => act({ type: 'setSettings', settings: { comm: 'ingame' } })} /> Chat im Spiel, das Spiel erzwingt die Regeln</label>
            <label className="radio"><input type="radio" name="comm" checked={state.settings.comm === 'external'} onChange={() => act({ type: 'setSettings', settings: { comm: 'external' } })} /> Externe Tools, zum Beispiel MS Teams und Mattermost</label>
          </fieldset>
        </section>

        <section className="card">
          <div className="row between">
            <h2>Teams ({state.teams.length} von {state.teamCount})</h2>
          </div>
          {state.teams.length === 0 && <p className="muted">Noch niemand da. Teams erscheinen hier, sobald sie beitreten.</p>}
          <ul className="team-list">
            {state.teams.map((t) => (
              <li key={t.id}>
                <span><span className={`dot ${t.online ? 'on' : ''}`} /> {t.name}{t.isHost ? ' (Spielleiter)' : ''}</span>
                {!t.isHost && <button className="btn small ghost" onClick={() => act({ type: 'removeTeam', teamId: t.id })}>Entfernen</button>}
              </li>
            ))}
          </ul>
          {state.teams.length < state.teamCount && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (slot.trim()) { act({ type: 'addSlot', name: slot }); setSlot('') } }}>
              <input aria-label="Organisation vorab eintragen" placeholder="Organisation vorab eintragen" value={slot} onChange={(e) => setSlot(e.target.value)} />
              <button className="btn small">Eintragen</button>
            </form>
          )}
        </section>

        <section className="card">
          <div className="row between">
            <h2>Rollen vergeben</h2>
            <button className="btn small" disabled={!state.teams.length} onClick={() => act({ type: 'autoAssign' })}>Automatisch verteilen</button>
          </div>
          <p className="muted small">Alle Rollen müssen vergeben sein. Ein Team kann mehrere Rollen übernehmen.</p>
          <div className="role-grid">
            {ROLE_IDS.map((r: RoleId) => (
              <label key={r} className="role-row">
                <span><strong>{ROLES[r].section}</strong> <span className="muted">{ROLES[r].code} {ROLES[r].skkm}</span></span>
                <select
                  aria-label={`Team für ${ROLES[r].section}`}
                  disabled={r === 'LS' && bridge}
                  value={state.roleOwner[r] ?? ''}
                  onChange={(e) => act({ type: 'assignRole', role: r, teamId: e.target.value || null })}
                >
                  <option value="">Offen</option>
                  {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>

        {onError && <Notice tone="bad">{onError}</Notice>}
        {problems.length > 0 && <Notice tone="warn">{problems.join(' ')}</Notice>}
        <button className="btn primary big" disabled={problems.length > 0} onClick={() => act({ type: 'advance' })}>Übung starten</button>
      </div>
      <aside className="lobby-ship">
        <ShipScene teams={state.teams} teamCount={state.teamCount} roleOwner={state.roleOwner} phase="lobby" />
      </aside>
    </div>
  )
}
