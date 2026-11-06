import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { E5_START_KW, ROLES } from '../game/content/flugZumMars'
import { SHIELD_TARGET } from '../game/geometry'
import { ROLE_IDS } from '../game/types'
import type { Cutscene, CutsceneScene, RoleId } from '../game/types'
import './cutscene.css'

function Rocket({ flame = false }: { flame?: boolean }) {
  return (
    <svg className="c-rocket" viewBox="0 0 80 240" aria-hidden>
      {flame && (
        <g className="c-flame">
          <path d="M26 196 Q40 300 54 196Z" fill="#ff8a2b" />
          <path d="M32 196 Q40 262 48 196Z" fill="#ffe08a" />
        </g>
      )}
      <path d="M8 196 L22 150 V196Z M72 196 L58 150 V196Z" fill="#7d8c9a" />
      <path d="M40 2 C58 26 62 56 62 84 V192 H18 V84 C18 56 22 26 40 2Z" fill="#dfe6ec" />
      <path d="M40 2 C50 15 56 30 59 46 H21 C24 30 30 15 40 2Z" fill="#a9b7c4" />
      <rect x="18" y="176" width="44" height="16" fill="#a9b7c4" />
      <rect x="26" y="192" width="28" height="8" fill="#3a4753" />
      <circle cx="40" cy="74" r="9" fill="#0e2233" stroke="#f2b544" strokeWidth="3" />
      <text x="40" y="120" textAnchor="middle" fontSize="9" fontWeight="800" fill="#33424f" letterSpacing="1">ARES 1</text>
    </svg>
  )
}

const Pad = () => (
  <div className="c-ground">
    <div className="c-tower" />
    <div className="c-pad" />
  </div>
)

const Stars = () => <div className="c-stars" />

const ASTEROIDS = [
  [12, 0, 9, 70], [32, 2.2, 7, 110], [58, 1, 8, 54], [76, 3.1, 6.5, 90], [22, 4.4, 7.5, 60], [66, 5, 8.5, 80], [46, 6, 6, 120], [86, 0.6, 9, 50],
]

function ReactorCounter({ kw, held }: { kw: number; held: boolean }) {
  const [value, setValue] = useState(E5_START_KW)
  useEffect(() => {
    const start = performance.now() + 1500
    let frame = 0
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 4000))
      setValue(Math.round(E5_START_KW + (kw - E5_START_KW) * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [kw])
  return <div className="c-kw">{held ? kw : value} kW</div>
}

function Credits({ teams, roleOwner, title, subtitle, seconds }: Props & { title: string; subtitle: string; seconds: number }) {
  return (
    <div className="c-credits" style={{ animationDuration: `${seconds}s` }}>
      <h2>{title}</h2>
      <p>Die Crew der ARES 1</p>
      {teams.map((t) => (
        <div key={t.id} className="c-credit">
          <strong>{t.name}</strong>
          <span>{ROLE_IDS.filter((r) => roleOwner[r] === t.id).map((r) => ROLES[r].section).join(' · ')}</span>
        </div>
      ))}
      <h2>{subtitle}</h2>
    </div>
  )
}

function Stage({ c, teams, roleOwner, held }: { c: Cutscene; held: boolean } & Props) {
  const scenes: Record<CutsceneScene, React.ReactNode> = {
    intro: <><Pad /><div className="c-ship c-on-pad"><Rocket /></div></>,
    prep: (
      <>
        <Pad />
        <i className="c-beam left" /><i className="c-beam right" />
        <div className="c-ship c-on-pad"><Rocket /><i className="c-vapor" /></div>
        <div className="c-clock">T − 30:00</div>
      </>
    ),
    launch: (
      <>
        <Stars />
        <div className="c-day" />
        <div className="c-limb" />
        <Pad />
        {['3', '2', '1'].map((n, i) => <div key={n} className="c-count" style={{ animationDelay: `${0.3 + i}s` }}>{n}</div>)}
        <div className="c-ship c-launching"><Rocket flame /></div>
        {[-15, -5, 5, 15].map((x) => <i key={x} className="c-smoke" style={{ left: `calc(50% + ${x}vh)`, animationDelay: `${3.1 + Math.abs(x) / 50}s` }} />)}
      </>
    ),
    repair: (
      <>
        <Stars />
        <div className="c-sun" />
        <svg className="c-shield" viewBox="-0.2 -0.2 8.4 4.4" aria-hidden>
          <rect x="0" y="0" width="8" height="4" fill="#14222f" stroke="#f2b544" strokeWidth="0.05" />
          {SHIELD_TARGET.map((p, i) => (
            <polygon key={i} points={p.pts.map((q) => q.join(',')).join(' ')} className="c-piece" style={{ animationDelay: `${0.5 + i * 0.32}s`, '--dx': `${(i % 2 ? 1 : -1) * (3 + (i % 3))}px`, '--dy': `${(i % 3) * 2 - 2}px` } as CSSProperties} />
          ))}
        </svg>
        <i className="c-spark" />
      </>
    ),
    asteroids: (
      <>
        <Stars />
        {ASTEROIDS.map(([top, delay, dur, size], i) => <i key={i} className="c-rock" style={{ top: `${top}%`, width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}
        <div className="c-ship c-weaving"><Rocket flame /></div>
        <div className="c-glitch" />
      </>
    ),
    signal: (
      <>
        <Stars />
        <div className="c-ship c-cruise"><Rocket flame /></div>
        {[0, 1, 2].map((i) => <i key={i} className="c-ring" style={{ animationDelay: `${i * 0.9}s` }} />)}
        <div className="c-bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ height: `${20 + i * 18}%`, animationDelay: `${1.2 + i * 0.8}s` }} />)}</div>
      </>
    ),
    reactor: <><div className="c-core" /><ReactorCounter kw={c.kw ?? 150} held={held} /></>,
    restart: (
      <>
        <Stars />
        <div className="c-mars" />
        <div className="c-ship c-approach"><Rocket flame /></div>
      </>
    ),
    landing: (
      <>
        <Stars />
        <div className="c-mars-sky" />
        <div className="c-mars-ground" />
        <div className="c-ship c-descent"><Rocket flame /></div>
        {[-18, -8, 8, 18].map((x) => <i key={x} className="c-dust" style={{ left: `calc(50% + ${x}vh)`, animationDelay: `${8.4 + Math.abs(x) / 60}s` }} />)}
        {Array.from({ length: 28 }, (_, i) => <i key={i} className="c-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${9.6 + (i % 7) * 0.25}s`, background: ['#f2b544', '#5be08a', '#8fa8e8', '#ff8a6b'][i % 4] }} />)}
      </>
    ),
    failure: <><Stars /><div className="c-alarm" /><div className="c-ship c-drift"><Rocket /></div></>,
    credits: (
      <>
        <Stars />
        <div className="c-mars-sky" />
        <div className="c-mars-ground still" />
        <div className="c-ship c-landed"><Rocket /></div>
        <Credits teams={teams} roleOwner={roleOwner} title={c.title} subtitle={c.subtitle} seconds={c.seconds} />
      </>
    ),
  }
  return <>{scenes[c.scene]}</>
}

const CAPTION_AT: Record<CutsceneScene, number> = {
  intro: 2.5, prep: 3, launch: 10.5, repair: 6, asteroids: 7.5, signal: 5.5, reactor: 6, restart: 6, landing: 9.5, failure: 2.5, credits: 0,
}

interface Props {
  teams: { id: string; name: string }[]
  roleOwner: Record<RoleId, string | null>
}

interface OverlayProps extends Props {
  cutscene: Cutscene | null
  offset?: number
  /** Nur die Spielleitung bekommt den Knopf zur Freigabe. */
  onRelease?: () => void
  nextTitle?: string
  hostLost?: boolean
}

/** Zeigt den Film bei allen gleichzeitig. Danach bleibt das Schlussbild stehen, bis die Spielleitung freigibt. */
export function CutsceneOverlay({ cutscene, teams, roleOwner, offset = 0, onRelease, nextTitle, hostLost = false }: OverlayProps) {
  const [finished, setFinished] = useState(0)
  const skip = useRef<HTMLButtonElement>(null)
  const id = cutscene?.id ?? 0
  const expired = cutscene ? Date.now() + offset - cutscene.at >= cutscene.seconds * 1000 : true
  const active = Boolean(cutscene) && !cutscene?.released
  const playing = active && !expired && finished !== id

  useEffect(() => {
    if (!playing || !cutscene) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = cutscene.at + cutscene.seconds * 1000 - (Date.now() + offset)
    const timer = setTimeout(() => setFinished(id), reduced ? Math.min(left, 5000) : left)
    skip.current?.focus()
    return () => clearTimeout(timer)
  }, [playing, id, cutscene, offset])

  if (!active || !cutscene) return null
  const credits = cutscene.scene === 'credits'
  return (
    <div className={`cut cut-${cutscene.scene}${playing ? '' : ' held'}`} role="dialog" aria-label={`Film: ${cutscene.title}`} data-testid="cutscene">
      <Stage c={cutscene} teams={teams} roleOwner={roleOwner} held={!playing} />
      {!credits && (
        <div className={`c-caption ${cutscene.tone}`} style={{ animationDelay: `${CAPTION_AT[cutscene.scene]}s` }}>
          <h1>{cutscene.title}</h1>
          <p>{cutscene.subtitle}</p>
        </div>
      )}
      {playing && <button ref={skip} className="c-skip" onClick={() => setFinished(id)}>Überspringen</button>}
      {!playing && (
        <div className="c-wait" data-testid="cutscene-wait">
          {onRelease
            ? <button className="btn primary" onClick={onRelease}>Weiter für alle – {nextTitle}</button>
            : <p role="status">{hostLost ? 'Die Verbindung zur Spielleitung ist unterbrochen. Es geht weiter, sobald sie zurück ist.' : 'Die Spielleitung gibt gleich den nächsten Abschnitt frei.'}</p>}
        </div>
      )}
    </div>
  )
}
