import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { project } from '../game/projection'
import { GM, RuleError } from '../game/types'
import type { Action, GameState } from '../game/types'
import { HostSession } from '../net/host'
import { loadGame } from '../storage/db'
import { Console } from './Console'
import { GameRoom } from './GameRoom'
import { Lobby } from './Lobby'
import { CenterMessage } from './shared'

function useHost(code: string) {
  const [session, setSession] = useState<HostSession | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    let created: HostSession | undefined
    void loadGame(code).then((state) => {
      if (!alive) return
      if (!state) return setSession(null)
      created = new HostSession(state)
      void created.start()
      setSession(created)
    })
    return () => {
      alive = false
      created?.close()
    }
  }, [code])
  return session
}

export function HostScreen({ code }: { code: string }) {
  const session = useHost(code)
  if (session === undefined) return <CenterMessage title="Spielstand wird geladen …" />
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

  const bridgeView = useMemo(() => (hostTeam && state.phase !== 'lobby' ? project(state, hostTeam.id) : null), [state, hostTeam])

  if (state.phase === 'lobby') {
    return (
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
    )
  }

  return (
    <div>
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
