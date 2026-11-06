import { GAME, ROLES, roleLabel } from '../game/content/flugZumMars'
import { ROLE_IDS } from '../game/types'
import type { Phase, RoleId } from '../game/types'

interface RoomTeam {
  id: string
  name: string
  online: boolean
}

const sceneOf = (phase: Phase) => {
  if (phase === 'lobby' || phase === 'checkin' || phase === 'e1') return 'earth'
  if (phase === 'e7' || phase === 'lessons' || phase === 'done') return 'mars'
  return 'space'
}

export function ShipScene(props: {
  teams: RoomTeam[]
  teamCount: number
  roleOwner: Record<RoleId, string | null>
  phase: Phase
  me?: string
  ignition?: boolean
  landed?: boolean
  alert?: boolean
}) {
  const { teams, teamCount, roleOwner, phase, me, ignition, landed, alert } = props
  const scene = sceneOf(phase)
  const empty = Math.max(0, teamCount - teams.length)
  const flying = scene !== 'earth' && !landed
  return (
    <div className={`scene scene-${scene} ${alert ? 'alert' : ''}`} role="img" aria-label={`Raumschiff ${GAME.shipName} mit ${teamCount} Räumen`}>
      <div className="stars" />
      {scene === 'earth' && <Earth />}
      {scene === 'mars' && <div className="mars-ground" />}
      <div className="rocket">
        <svg className="nose" viewBox="0 0 200 110" preserveAspectRatio="none" aria-hidden>
          <path d="M100 0 C 150 30 196 74 200 110 L0 110 C 4 74 50 30 100 0Z" fill="var(--hull)" />
          <path d="M100 0 C 120 12 136 26 150 40 L50 40 C 64 26 80 12 100 0Z" fill="var(--hull-dark)" />
          <circle cx="100" cy="72" r="15" fill="#0e2233" stroke="var(--accent)" strokeWidth="4" />
        </svg>
        <div className="hull">
          <div className="hull-name">{GAME.shipName}</div>
          {teams.map((t) => {
            const roles = ROLE_IDS.filter((r) => roleOwner[r] === t.id)
            return (
              <div key={t.id} className={`room ${t.id === me ? 'me' : ''}`}>
                <div className="room-name">
                  <span className={`dot ${t.online ? 'on' : ''}`} title={t.online ? 'Verbunden' : 'Nicht verbunden'} />
                  {t.name}
                </div>
                <div className="room-roles">
                  {roles.length ? roles.map((r) => <span key={r} title={ROLES[r].skkm}>{roleLabel(r)}</span>) : <span className="muted">Rolle offen</span>}
                </div>
              </div>
            )
          })}
          {Array.from({ length: empty }, (_, i) => (
            <div key={i} className="room empty">
              <div className="room-name muted">Raum frei</div>
            </div>
          ))}
        </div>
        <svg className="tail" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 H200 V24 L240 70 H150 L140 40 H60 L50 70 H-40 L0 24Z" fill="var(--hull-dark)" />
          <rect x="72" y="40" width="56" height="26" rx="4" fill="#33424f" />
        </svg>
        {(ignition || flying) && <div className={`flame ${ignition ? 'big' : ''}`} aria-hidden />}
      </div>
    </div>
  )
}

function Earth() {
  return (
    <>
      <div className="tower" aria-hidden />
      <div className="ground" aria-hidden />
    </>
  )
}
