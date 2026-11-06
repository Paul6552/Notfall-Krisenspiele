import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { go } from '../app/router'
import { GAME, PHASE_INFO } from '../game/content/flugZumMars'
import type { GameState } from '../game/types'
import type { ClientRecord } from '../storage/db'
import { deleteClient, deleteGame, listClients, listGames, saveGame } from '../storage/db'

export function Start() {
  const [teams, setTeams] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [games, setGames] = useState<GameState[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])

  const reload = () => {
    void listGames().then((g) => setGames(g.sort((a, b) => b.createdAt - a.createdAt)))
    void listClients().then(setClients)
  }
  useEffect(reload, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(teams)
    if (!Number.isInteger(n) || n < GAME.minTeams) return setError(`Es sind mindestens ${GAME.minTeams} Teams notwendig.`)
    if (n > GAME.maxTeams) return setError(`Es gibt ${GAME.maxTeams} Rollen, also höchstens ${GAME.maxTeams} Teams.`)
    go(`/uebungen?teams=${n}`)
  }

  const join = (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c) go(`/play/${c.startsWith('ARES-') ? c : `ARES-${c}`}`)
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const state = JSON.parse(await file.text()) as GameState
      if (state.gameId !== GAME.id || !state.code) throw new Error()
      await saveGame(state)
      go(`/host/${state.code}`)
    } catch {
      setError('Diese Datei ist kein gültiger Spielstand.')
    }
  }

  return (
    <div className="hero">
      <section className="hero-text">
        <p className="eyebrow">Notfall- und Krisenübung</p>
        <h1>Üben, bevor es ernst wird</h1>
        <p className="lead">
          Mehrere Organisationen arbeiten als SKKM-Stab zusammen, jede von ihrem eigenen Standort aus. Das Spiel läuft direkt im Browser.
        </p>
      </section>

      <div className="cards">
        <form className="card" noValidate onSubmit={submit}>
          <h2>Neue Übung</h2>
          <label htmlFor="teams">Wie viele Teams oder Organisationen spielen mit?</label>
          <input id="teams" type="number" inputMode="numeric" min={GAME.minTeams} max={GAME.maxTeams} placeholder="z. B. 6" value={teams} onChange={(e) => { setTeams(e.target.value); setError('') }} />
          <p className="muted small">Mindestens {GAME.minTeams}, höchstens {GAME.maxTeams}.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary">Weiter zu den Übungen</button>
        </form>

        <form className="card" onSubmit={join}>
          <h2>Einem Spiel beitreten</h2>
          <label htmlFor="code">Spielnummer</label>
          <input id="code" placeholder="ARES-7K2F9Q" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
          <p className="muted small">Die Nummer bekommt ihr vom Spielleiter.</p>
          <button className="btn">Beitreten</button>
        </form>
      </div>

      {(games.length > 0 || clients.length > 0) && (
        <section className="card wide">
          <h2>Spiel fortsetzen</h2>
          <ul className="resume">
            {games.map((g) => (
              <li key={g.code}>
                <span><strong>{g.code}</strong> <span className="muted">Spielleitung · {PHASE_INFO[g.phase].short}</span></span>
                <span className="row">
                  <a className="btn small" href={`#/host/${g.code}`}>Fortsetzen</a>
                  <button className="btn small ghost" onClick={() => void deleteGame(g.code).then(reload)}>Löschen</button>
                </span>
              </li>
            ))}
            {clients.map((c) => (
              <li key={c.key}>
                <span><strong>{c.code}</strong> <span className="muted">{c.name}</span></span>
                <span className="row">
                  <a className="btn small" href={`#/play/${c.code}`}>Fortsetzen</a>
                  <button className="btn small ghost" onClick={() => void deleteClient(c.code).then(reload)}>Löschen</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="footer-links">
        <a href="#/verbindungstest">Verbindung vor der Übung testen</a>
        <label className="link">
          Spielstand aus Datei laden
          <input type="file" accept="application/json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
        </label>
      </p>
    </div>
  )
}
