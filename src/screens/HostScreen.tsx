import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { project } from '../game/projection'
import { GM, RuleError } from '../game/types'
import type { Action, GameState } from '../game/types'
import { HostSession } from '../net/host'
import { acquireHostLock, loadGame } from '../storage/db'
import { CutsceneOverlay } from '../ship/Cutscene'
import { Console } from './Console'
import { GameRoom } from './GameRoom'
import { Lobby } from './Lobby'
import { CenterMessage, Notice } from './shared'

function useHost(code: string) {
  const [session, setSession] = useState<HostSession | null | 'locked' | undefined>(undefined)
  useEffect(() => {
    let alive = true
    let created: HostSession | undefined
    let release: (() => void) | null = null
    void (async () => {
      release = await acquireHostLock(code)
      if (!alive) return release?.()
      if (!release) return setSession('locked')
      const state = await loadGame(code)
      if (!alive) return release()
      if (!state) return setSession(null)
      created = new HostSession(state)
      void created.start()
      setSession(created)
    })()
    return () => {
      alive = false
      created?.close()
      if (created) release?.()
    }
  }, [code])
  return session
}

export function HostScreen({ code }: { code: string }) {
  const session = useHost(code)
  if (session === undefined) return <CenterMessage title="Spielstand wird geladen …" />
  if (session === 'locked') {
    return (
      <CenterMessage title="Spiel ist schon geöffnet">
        <p>{code} läuft bereits in einem anderen Tab dieses Browsers. Arbeitet dort weiter, zwei Tabs würden sich gegenseitig überschreiben.</p>
      </CenterMessage>
    )
  }
  if (session === null) {
    return (
      <CenterMessage title="Spiel nicht gefunden">
        <p>In diesem Browser gibt es keinen Spielstand zu {code}.</p>
        <a className="btn" href="#/">Zur Startseite</a>
      </CenterMessage>
    )
  }
  return <HostGame session={session} />
}

function HostGame({ session }: { session: HostSession }) {
  const state: GameState = useSyncExternalStore(session.subscribe, () => session.state)
  const saveFailed = useSyncExternalStore(session.subscribe, () => session.saveFailed)
  const [error, setError] = useState<{ message: string; at: number } | null>(null)
  const [tab, setTab] = useState<'console' | 'bridge'>('console')
  const hostTeam = state.teams.find((t) => t.isHost)

  const run = (action: Action, actor: string = GM) => {
    try {
      session.dispatch(action, actor)
      setError(null)
    } catch (e) {
      if (!(e instanceof RuleError)) console.error(e)
      setError({ message: e instanceof Error ? e.message : 'Aktion fehlgeschlagen.', at: Date.now() })
    }
  }

  // Fragt vor dem Schließen nach, solange die Übung nicht beendet ist.
  const running = state.phase !== 'done'
  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Für ältere Browser
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [running])

  const warning = saveFailed && (
    <Notice tone="bad">Der Spielstand konnte nicht gespeichert werden. Sichert ihn sofort über „Spielstand als Datei sichern“ und schließt diesen Tab nicht.</Notice>
  )

  const bridgeView = useMemo(() => (hostTeam && state.phase !== 'lobby' ? project(state, hostTeam.id) : null), [state, hostTeam])

  if (state.phase === 'lobby') {
    return (
      <>
      {warning}
      <Lobby
        state={state}
        act={run}
        onError={error?.message ?? null}
        setHostTeam={(name) => {
          try {
            session.setHostTeam(name)
            setError(null)
          } catch (e) {
            setError({ message: e instanceof Error ? e.message : 'Fehler', at: Date.now() })
          }
        }}
      />
      </>
    )
  }

  return (
    <div>
      <CutsceneOverlay cutscene={state.cutscene} teams={state.teams} roleOwner={state.roleOwner} />
      {warning}
      {bridgeView && (
        <div className="tabs" role="tablist" aria-label="Ansicht">
          <button role="tab" aria-selected={tab === 'console'} onClick={() => setTab('console')}>Spielleitung</button>
          <button role="tab" aria-selected={tab === 'bridge'} onClick={() => setTab('bridge')}>Brücke</button>
        </div>
      )}
      {bridgeView && tab === 'bridge' ? (
        <GameRoom view={bridgeView} act={(a) => run(a, hostTeam!.id)} error={error} />
      ) : (
        <Console state={state} act={run} error={error} />
      )}
    </div>
  )
}
