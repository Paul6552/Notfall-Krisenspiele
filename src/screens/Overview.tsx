import { useEffect } from 'react'
import { go } from '../app/router'
import { GAME, PHASE_INFO, PLAY_PHASES, TOTAL_MINUTES, formatDuration } from '../game/content/flugZumMars'
import { createGame, makeGameCode } from '../game/reducer'
import { saveGame } from '../storage/db'

export function Overview({ teamCount }: { teamCount: number }) {
  const valid = Number.isInteger(teamCount) && teamCount >= GAME.minTeams && teamCount <= GAME.maxTeams
  useEffect(() => {
    if (!valid) go('/')
  }, [valid])
  if (!valid) return null

  const start = async () => {
    const code = makeGameCode()
    await saveGame(createGame({ code, teamCount, now: Date.now() }))
    go(`/host/${code}`)
  }

  return (
    <div className="narrow">
      <a className="back" href="#/">← Zurück</a>
      <h1>Angebotene Übungen</h1>
      <p className="lead">{teamCount} Teams nehmen teil.</p>
      <article className="game-card">
        <div className="game-art" aria-hidden>
          <span className="planet" />
          <span className="rocket-mini">🚀</span>
        </div>
        <div className="game-info">
          <h2>{GAME.title}</h2>
          <p className="duration">
            <span aria-hidden>⏱</span> Dauer: <strong>{formatDuration(TOTAL_MINUTES)}</strong>
          </p>
          <p>{GAME.teaser}</p>
          <details>
            <summary>Ablauf ansehen</summary>
            <ol className="phases">
              {PLAY_PHASES.map((p) => (
                <li key={p}>
                  <span>{PHASE_INFO[p].title}</span>
                  <span className="muted">{PHASE_INFO[p].minutes} min</span>
                </li>
              ))}
            </ol>
          </details>
          <button className="btn primary" onClick={() => void start()}>Spiel starten</button>
        </div>
      </article>
    </div>
  )
}
