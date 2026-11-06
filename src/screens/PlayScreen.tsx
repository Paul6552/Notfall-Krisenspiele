import { useEffect, useState, useSyncExternalStore } from 'react'
import { go } from '../app/router'
import { ClientSession } from '../net/client'
import { isLocalNet } from '../net/transport'
import { deleteClient, loadClient, loadGame } from '../storage/db'
import { CutsceneOverlay } from '../ship/Cutscene'
import { setMuted } from '../ship/filmSound'
import { ShipScene } from '../ship/Ship'
import { GameRoom } from './GameRoom'
import { CenterMessage, Notice } from './shared'

export function PlayScreen({ code }: { code: string }) {
  const [name, setName] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [music, setMusic] = useState(true)

  useEffect(() => {
    void (async () => {
      // Der Spielleiter öffnet versehentlich den Einladungslink: zurück in die eigene Konsole.
      if (!isLocalNet() && (await loadGame(code))) return go(`/host/${code}`)
      const rec = await loadClient(code)
      setName(rec?.token ? rec.name : '')
    })()
  }, [code])

  if (name === null) return <CenterMessage title="Wird geladen …" />
  if (!name) {
    return (
      <div className="narrow">
        <a className="back" href="#/">← Zurück</a>
        <h1>Beitreten</h1>
        <p className="lead">Spielnummer <strong>{code}</strong></p>
        <form className="card" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setMuted(!music); setName(draft.trim()) } }}>
          <label htmlFor="org">Name eurer Organisation</label>
          <input id="org" autoFocus placeholder="z. B. Organisation Mustermann" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <label className="radio"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Musik und Klänge in den Filmen</label>
          <button className="btn primary">Beitreten</button>
        </form>
      </div>
    )
  }
  return <Client code={code} name={name} onReset={() => setName('')} />
}

function Client({ code, name, onReset }: { code: string; name: string; onReset: () => void }) {
  const [session, setSession] = useState<ClientSession | null>(null)
  useEffect(() => {
    const s = new ClientSession(code, name)
    void s.start()
    setSession(s)
    return () => s.close()
  }, [code, name])
  if (!session) return null
  return <Connected session={session} code={code} onReset={onReset} />
}

function Connected({ session, code, onReset }: { session: ClientSession; code: string; onReset: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, () => session.snapshot)
  const { status, view, joinError, rejected, clockOffset } = snap

  if (joinError && !view) {
    return (
      <CenterMessage title="Beitritt nicht möglich">
        <Notice tone="bad">{joinError}</Notice>
        <button className="btn" onClick={() => void deleteClient(code).then(onReset)}>Anderen Namen eingeben</button>
      </CenterMessage>
    )
  }
  if (status === 'notFound') {
    return (
      <CenterMessage title="Keine Verbindung zum Spiel">
        <p>Unter der Nummer {code} antwortet gerade kein Spielleiter. Prüft die Nummer und ob der Browser des Spielleiters offen ist.</p>
        <p className="muted">Blockiert euer Firmennetz vielleicht WebRTC? Das zeigt der <a href="#/verbindungstest">Verbindungstest</a>.</p>
        <button className="btn" onClick={() => go('/')}>Zur Startseite</button>
      </CenterMessage>
    )
  }
  if (!view) return <CenterMessage title="Verbinde mit dem Spiel …"><p className="muted">Das kann einige Sekunden dauern.</p></CenterMessage>

  const lost = status === 'hostLost' && <Notice tone="bad">Spielleitung getrennt. Das Spiel pausiert, bis die Spielleitung wieder da ist.</Notice>

  if (view.phase === 'lobby') {
    return (
      <div className="lobby">
        <div className="lobby-main">
          {lost}
          <section className="card">
            <p className="eyebrow">Spielnummer {view.code}</p>
            <h1>Willkommen an Bord</h1>
            <p>Ihr seid als <strong>{view.teams.find((t) => t.id === view.me)?.name}</strong> dabei. Der Spielleiter vergibt jetzt die Rollen und startet die Übung.</p>
            <p className="muted">{view.teams.length} von {view.teamCount} Teams sind da.</p>
          </section>
        </div>
        <aside className="lobby-ship">
          <ShipScene teams={view.teams} teamCount={view.teamCount} roleOwner={view.roleOwner} phase="lobby" me={view.me} />
        </aside>
      </div>
    )
  }
  return (
    <>
      <CutsceneOverlay cutscene={view.cutscene} teams={view.teams} roleOwner={view.roleOwner} offset={clockOffset} hostLost={status === 'hostLost'} />
      {lost}
      <GameRoom view={status === 'hostLost' ? { ...view, pausedAt: view.pausedAt ?? Date.now() } : view} act={session.dispatch} error={rejected} clockOffset={clockOffset} />
    </>
  )
}
