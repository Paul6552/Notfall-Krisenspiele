import { useEffect, useState } from 'react'
import { clock, useNow } from '../app/hooks'
import { E1 } from '../events/E1'
import { E2 } from '../events/E2'
import { E3 } from '../events/E3'
import { E4, E5, E6 } from '../events/E4toE6'
import { E7 } from '../events/E7'
import { Lessons } from '../events/Lessons'
import { PHASE_INFO, ROLES, TOTAL_MINUTES, formatDuration } from '../game/content/flugZumMars'
import type { Action, RoleId, ShipStatus, View } from '../game/types'
import { ShipScene } from '../ship/Ship'
import { Chat } from './Chat'
import { Notice } from './shared'

const GAUGES: { key: keyof ShipStatus; label: string; unit: string; max: number }[] = [
  { key: 'hull', label: 'Hülle', unit: '%', max: 100 },
  { key: 'oxygen', label: 'Sauerstoff', unit: '%', max: 100 },
  { key: 'morale', label: 'Moral', unit: '%', max: 100 },
  { key: 'timeBuffer', label: 'Zeitpuffer', unit: ' min', max: 30 },
]

export function StatusBar({ view, offset = 0 }: { view: View; offset?: number }) {
  const now = useNow(offset)
  const info = PHASE_INFO[view.phase]
  const elapsed = (view.pausedAt ?? now) - view.phaseStartedAt - view.pausedMs
  const over = info.minutes > 0 && elapsed > info.minutes * 60_000
  return (
    <div className="statusbar">
      <div>
        <p className="eyebrow">{view.code} · Gesamt {formatDuration(TOTAL_MINUTES)}</p>
        <h1 data-testid="phase-title">{info.title}</h1>
      </div>
      {info.minutes > 0 && (
        <div className={`timer ${over ? 'over' : ''}`} title="Richtwert, die Spielleitung startet das nächste Ereignis">
          {view.pausedAt ? 'Pause' : clock(elapsed)} <span>/ {info.minutes} min</span>
        </div>
      )}
      <div className="gauges">
        {GAUGES.map((g) => {
          const v = view.ship[g.key]
          return (
            <div key={g.key} className={`gauge ${v / g.max < 0.34 ? 'low' : ''}`}>
              <span>{g.label}</span>
              <strong data-testid={`gauge-${g.key}`}>{v}{g.unit}</strong>
              <div className="gauge-bar"><i style={{ width: `${Math.min(100, (v / g.max) * 100)}%` }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RolePanel({ view, role, act }: { view: View; role: RoleId; act: (a: Action) => void }) {
  const props = { view, role, act }
  switch (view.phase) {
    case 'checkin':
      return (
        <div className="stack">
          <h3>{ROLES[role].section} – {ROLES[role].code} {ROLES[role].skkm}</h3>
          <p>{ROLES[role].game}</p>
          <p className="muted">Im Stab: {ROLES[role].skkmText}</p>
        </div>
      )
    case 'e1': return <E1 {...props} />
    case 'e2': return <E2 {...props} />
    case 'e3': return <E3 {...props} />
    case 'e4': return <E4 {...props} />
    case 'e5': return <E5 {...props} />
    case 'e6': return <E6 {...props} />
    case 'e7': return <E7 {...props} />
    default: return null
  }
}

export function RoleWorkspace({ view, roles, act }: { view: View; roles: RoleId[]; act: (a: Action) => void }) {
  const [picked, setPicked] = useState<RoleId | null>(null)
  const role = picked && roles.includes(picked) ? picked : roles[0]
  if (!role) return null
  return (
    <>
      {roles.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Rollen">
          {roles.map((r) => <button key={r} role="tab" aria-selected={r === role} onClick={() => setPicked(r)}>{ROLES[r].section} <span>{ROLES[r].code}</span></button>)}
        </div>
      )}
      <RolePanel key={role} view={view} role={role} act={act} />
    </>
  )
}

export function Banners({ view }: { view: View }) {
  const rule = PHASE_INFO[view.phase].rule
  return (
    <>
      {view.pausedAt && <Notice tone="warn">Die Übung ist pausiert.</Notice>}
      {view.failure && <Notice tone="bad"><strong>Mission gescheitert.</strong> {view.failure} Die Spielleitung entscheidet, wie es weitergeht.</Notice>}
      {rule && <Notice tone="warn">{rule}</Notice>}
    </>
  )
}

export function GameRoom({ view, act, error, clockOffset }: { view: View; act: (a: Action) => void; error: { message: string; at: number } | null; clockOffset?: number }) {
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!error) return
    setToast(error.message)
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [error])

  const info = PHASE_INFO[view.phase]
  const debrief = view.phase === 'lessons' || view.phase === 'done'
  return (
    <div className="room-layout">
      <StatusBar view={view} offset={clockOffset} />
      <aside className="ship-col">
        <ShipScene
          teams={view.teams}
          teamCount={view.teamCount}
          roleOwner={view.roleOwner}
          phase={view.phase}
          me={view.me}
          ignition={view.phase === 'e1' && view.e1.decision === 'go'}
          landed={view.e7.landed}
          alert={view.phase === 'e2' && !view.e2.repaired}
        />
      </aside>
      <section className="work card">
        <Banners view={view} />
        <p className="briefing">{info.briefing}</p>
        {debrief ? <Lessons view={view} act={act} /> : <RoleWorkspace view={view} roles={view.myRoles} act={act} />}
      </section>
      <Chat view={view} act={act} />
      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  )
}
