import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { E3_DIFFS, E3_MAP, E3_MAX_ENERGY, E3_STORM_SECTORS, E3_THRESHOLD } from '../game/content/flugZumMars'
import { stormReportCorrect } from '../game/reducer'
import { GM } from '../game/types'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

const W = E3_MAP[0].length
const H = E3_MAP.length

function Grid({ children }: { children: ReactNode }) {
  return <svg className="radar" viewBox={`0 0 ${W} ${H}`}>{children}</svg>
}

const Ship = ({ x, y }: { x: number; y: number }) => <text x={x + 0.5} y={y + 0.72} fontSize={0.72} textAnchor="middle">🚀</text>

function Trail({ view }: { view: PanelProps['view'] }) {
  const line = [...view.e3.trail, view.e3.pos].map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(' ')
  return <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.15 0.12" />
}

const list = (sectors: string[]) => sectors.join(', ')

export function E3({ view, role, act }: PanelProps) {
  const arrived = view.e3.arrived && <Notice tone="good">Die ARES 1 hat das Asteroidenfeld durchquert.</Notice>
  switch (role) {
    case 'LS': return <div className="stack">{arrived}<BridgeMap view={view} /></div>
    case 'S3': return <div className="stack">{arrived}<Pilot view={view} role={role} act={act} /></div>
    case 'S4': return <div className="stack">{arrived}<Energy view={view} role={role} act={act} /></div>
    case 'S2': return <Sensors view={view} role={role} act={act} />
    case 'S1': return <SpotDiff puzzle="mast" view={view} act={act} title="Funkmast" />
    case 'S6': return <SpotDiff puzzle="panel" view={view} act={act} title="Schaltpult des Funkmasts" />
    default: return <Crew view={view} role={role} act={act} />
  }
}

function BridgeMap({ view }: { view: PanelProps['view'] }) {
  const map = view.docs.e3Map ?? []
  const gm = view.me === GM
  const report = view.e3.stormReport
  // Die Spielleitung sieht die echten Sturmsektoren violett und alle anderen Sektoren als Umriss.
  const stormy = (c: string) => (gm ? E3_STORM_SECTORS.includes(c) : true)
  const labels = new Map<string, { x: number; y: number }>()
  map.forEach((row, y) => [...row].forEach((c, x) => { if (/[A-F]/.test(c) && !labels.has(c)) labels.set(c, { x, y }) }))
  return (
    <>
      <p>Nur ihr seht das Trümmerfeld. Gebt Antrieb die Richtung und Versorgung die Zahl der Felder, beides nur per Emoji. Ein Klick von Antrieb fliegt so viele Felder, wie Versorgung Schub geladen hat. Die Sektoren, die das Labor als Sturm meldet, erscheinen violett.</p>
      {gm && (
        <Notice tone={!report ? 'info' : stormReportCorrect(report) ? 'good' : 'bad'}>
          {!report
            ? <>Das Labor hat noch nichts gemeldet. Richtig wären die Sektoren {list(E3_STORM_SECTORS)}.</>
            : stormReportCorrect(report)
              ? <>Das Labor hat <strong>richtig</strong> gemeldet: {list(report)}.</>
              : <>Das Labor hat <strong>falsch</strong> gemeldet: {list(report)}. Richtig wären {list(E3_STORM_SECTORS)}. Die Brücke sieht die falschen Sektoren.</>}
        </Notice>
      )}
      <Grid>
        {map.flatMap((row, y) => [...row].map((c, x) => {
          const key = `${x}-${y}`
          if (c === '#') return <text key={key} x={x + 0.5} y={y + 0.72} fontSize={0.66} textAnchor="middle">🪨</text>
          if (c === 'G') return <text key={key} x={x + 0.5} y={y + 0.72} fontSize={0.66} textAnchor="middle">🏁</text>
          if (/[A-F]/.test(c)) {
            return stormy(c)
              ? <rect key={key} x={x} y={y} width={1} height={1} fill="#8d5cf0" opacity={0.55} />
              : <rect key={key} x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} fill="none" stroke="#8d5cf0" strokeWidth={0.04} strokeDasharray="0.12 0.1" />
          }
          return null
        }))}
        {[...labels].map(([c, p]) => (
          <text key={c} x={p.x + 0.12} y={p.y + 0.36} fontSize={0.32} fill="#fff" fontWeight={700}>
            {c}{gm && report?.includes(c) ? ' ✓' : ''}
          </text>
        ))}
        <Trail view={view} />
        <Ship {...view.e3.pos} />
      </Grid>
      <p className="muted small">
        Treffer: {view.e3.collisions} · Sturmfelder: {view.e3.stormHits}
        {report ? ` · Labor meldet Sturm in: ${list(report)}` : ' · Noch keine Meldung vom Labor'}
        {gm && ' · ✓ = vom Labor gemeldet'}
      </p>
    </>
  )
}

function Pilot({ view, act }: PanelProps) {
  const move = (dx: number, dy: number) => act({ type: 'e3Move', dx, dy })
  const charge = view.e3.energy
  return (
    <>
      <p>Ihr fliegt blind. Ein Klick zündet den ganzen Schub, den Versorgung geladen hat: Bei 3 Energie fliegt das Schiff 3 Felder in die gewählte Richtung. Achtet darauf, dass Richtung und Schub zusammenpassen.</p>
      <Grid><Trail view={view} /><Ship {...view.e3.pos} /></Grid>
      <div className="row between wrap">
        <p>Geladener Schub: <strong data-testid="energy">{charge}</strong> {charge === 1 ? 'Feld' : 'Felder'}</p>
        <div className="dpad">
          <button className="btn" aria-label="Nach oben" onClick={() => move(0, -1)}>⬆️</button>
          <button className="btn" aria-label="Nach links" onClick={() => move(-1, 0)}>⬅️</button>
          <button className="btn" aria-label="Nach rechts" onClick={() => move(1, 0)}>➡️</button>
          <button className="btn" aria-label="Nach unten" onClick={() => move(0, 1)}>⬇️</button>
        </div>
      </div>
    </>
  )
}

function Energy({ view, act }: PanelProps) {
  const released = view.e3.energy + view.e3.energyUsed
  const charge = view.e3.energy
  return (
    <>
      <p>Ihr bestimmt, wie weit das Schiff fliegt. Jede Einheit Energie bringt es ein Feld weit. Antrieb verbraucht beim nächsten Klick den ganzen geladenen Schub. Fragt die Brücke, wie viele Felder es diesmal sein sollen. Die Reserve ist begrenzt.</p>
      <p>Geladen für den nächsten Schub: <strong data-testid="charge">{charge}</strong> {charge === 1 ? 'Feld' : 'Felder'} · Reserve: <strong>{E3_MAX_ENERGY - released}</strong></p>
      <div className="row">
        {[1, 3, 5].map((n) => <button key={n} className="btn" onClick={() => act({ type: 'e3Energy', amount: n })}>+{n} Energie</button>)}
      </div>
    </>
  )
}

function Sensors({ view, act }: PanelProps) {
  const report = view.e3.stormReport
  const [picked, setPicked] = useState<string[]>(report ?? [])
  const rows = view.docs.e3Sensors ?? []
  return (
    <div className="stack">
      <p>Wertet die Sensordaten aus: Sektoren mit einem Mittelwert über {E3_THRESHOLD} liegen im Ionensturm. Meldet sie. Die Brücke sieht die gemeldeten Sektoren auf ihrer Karte und weicht ihnen aus. Meldet ihr falsch, fliegt sie in den Sturm.</p>
      {report && <Notice tone="info">Gemeldet: {list(report)}. Die Brücke sieht diese Sektoren. Ihr könnt die Meldung korrigieren.</Notice>}
      <table className="data">
        <thead><tr><th>Sektor</th><th colSpan={4}>Messwerte</th><th>Im Sturm</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sector}>
              <th>{r.sector}</th>
              {r.values.map((v, i) => <td key={i}>{v}</td>)}
              <td><input type="checkbox" aria-label={`Sektor ${r.sector} im Sturm`} checked={picked.includes(r.sector)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.sector] : picked.filter((x) => x !== r.sector))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary" disabled={!picked.length} onClick={() => act({ type: 'e3Sectors', sectors: picked })}>{report ? 'Meldung korrigieren' : 'Analyse melden'}</button>
    </div>
  )
}

function Crew({ view, act }: PanelProps) {
  const [text, setText] = useState('')
  // Ohne Funk im Spiel (externe Tools) bleibt das Formular als Ersatz.
  const external = view.settings.comm === 'external'
  return (
    <div className="stack">
      <p>Die Crew ist verunsichert. Informiert sie mit einer Meldung, die nur aus Emojis besteht.</p>
      {!external && <Notice tone="info">Sendet eure Meldung über den <strong>Funk rechts an „Alle“</strong>. Im Ionensturm kommen nur Emojis durch.</Notice>}
      {view.e3.emojiStatement && <Notice tone="good">Eure Crew-Meldung ist draußen.</Notice>}
      {external && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'statement', text }); setText('') }}>
          <input aria-label="Crew-Meldung" placeholder="🚀 ☄️ 👍" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn">Veröffentlichen</button>
        </form>
      )}
    </div>
  )
}

/** Nach einem Fehlklick bleibt das Bild kurz gesperrt. So hilft wildes Antippen nicht weiter. */
const MISS_LOCK_MS = 4000

function SpotDiff({ puzzle, view, act, title }: { puzzle: 'mast' | 'panel'; view: PanelProps['view']; act: PanelProps['act']; title: string }) {
  const diffs = E3_DIFFS[puzzle]
  const found = view.e3.found[puzzle]
  const [lockedUntil, setLockedUntil] = useState(0)
  const [, rerender] = useState(0)
  const locked = lockedUntil > Date.now()
  useEffect(() => {
    if (!locked) return
    const timer = setTimeout(() => rerender((n) => n + 1), lockedUntil - Date.now())
    return () => clearTimeout(timer)
  }, [locked, lockedUntil])
  const Scene = puzzle === 'mast' ? Mast : Panel
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (lockedUntil > Date.now()) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 300
    const y = ((e.clientY - r.top) / r.height) * 260
    const hit = diffs.find((d) => Math.hypot(d.x - x, d.y - y) <= d.r)
    if (!hit) setLockedUntil(Date.now() + MISS_LOCK_MS)
    else if (!found.includes(hit.id)) act({ type: 'e3Found', puzzle, diff: hit.id })
  }
  return (
    <div className="stack">
      <p>{title}: Der Ionensturm hat den Funkmast der ARES 1 beschädigt. Vergleicht Soll und Ist und tippt im Ist-Bild jede Abweichung an. <strong>Ziel: Sind alle Schäden gefunden, kann der Funkmast wieder repariert werden.</strong></p>
      <p className="muted small">Die Abweichungen sind klein. Ein Fehlklick sperrt das Bild für {MISS_LOCK_MS / 1000} Sekunden.</p>
      <p><strong>{found.length} von {diffs.length}</strong> gefunden</p>
      {found.length === diffs.length && <Notice tone="good">Fehlerprüfung abgeschlossen. Der Funkmast kann repariert werden.</Notice>}
      {locked && <Notice tone="warn">Dort ist keine Abweichung. Kurz warten …</Notice>}
      <div className="spot">
        <figure><svg viewBox="0 0 300 260"><Scene broken={false} /></svg><figcaption>Soll</figcaption></figure>
        <figure>
          <svg viewBox="0 0 300 260" data-testid={`spot-${puzzle}`} onClick={click} className={locked ? 'clickable locked' : 'clickable'}>
            <Scene broken />
            {diffs.filter((d) => found.includes(d.id)).map((d) => <circle key={d.id} cx={d.x} cy={d.y} r={d.r} fill="none" stroke="#5be08a" strokeWidth={3} />)}
          </svg>
          <figcaption>Ist</figcaption>
        </figure>
      </div>
    </div>
  )
}

const STARS = [[20, 18], [44, 120], [96, 22], [118, 54], [236, 150], [276, 40], [284, 196], [30, 230], [214, 92], [106, 110], [262, 228], [12, 96]]

/** Gitterturm: x der Beine auf Höhe y. */
const legL = (y: number) => 150 - (35 * (y - 40)) / 195
const legR = (y: number) => 150 + (35 * (y - 40)) / 195
const LEVELS = [40, 80, 120, 160, 200, 235]

function Mast({ broken }: { broken: boolean }) {
  return (
    <g stroke="#c9d6e2" strokeWidth={2.5} fill="none" strokeLinecap="round">
      <rect width={300} height={260} fill="#12263a" stroke="none" />
      {STARS.map(([x, y]) => <circle key={x + y} cx={x} cy={y} r={1.3} fill="#8fa3b8" stroke="none" />)}
      {/* Turm */}
      <path d={`M150 40 L${legL(235)} 235 M150 40 L${legR(235)} 235`} strokeWidth={3.5} />
      {LEVELS.slice(1, -1).map((y) => <path key={y} d={`M${legL(y)} ${y} H${legR(y)}`} />)}
      {LEVELS.slice(0, -1).map((y1, i) => {
        const y2 = LEVELS[i + 1]
        if (broken && y1 === 160) return <path key={y1} d={`M${legR(y1)} ${y1} L${legL(y2)} ${y2}`} strokeWidth={1.6} />
        return <path key={y1} d={`M${legL(y1)} ${y1} L${legR(y2)} ${y2} M${legR(y1)} ${y1} L${legL(y2)} ${y2}`} strokeWidth={1.6} />
      })}
      {/* Großer Parabolspiegel links */}
      <path d="M140 92 L84 74" />
      <g transform={broken ? 'rotate(14 62 70)' : undefined}>
        <path d="M44 50 Q72 70 44 92" strokeWidth={5} />
        <path d="M48 71 H70 M70 71 L76 68" strokeWidth={1.8} />
        <circle cx={76} cy={68} r={2.6} fill="#c9d6e2" stroke="none" />
      </g>
      {/* Kleine Schüssel rechts */}
      <path d="M160 90 L246 72" />
      <path d="M248 58 Q262 70 248 84" strokeWidth={4} />
      <path d="M250 71 H258" strokeWidth={1.5} />
      {!broken && <circle cx={260} cy={67} r={2.4} fill="#c9d6e2" stroke="none" />}
      {/* Warnlicht und Antenne */}
      <circle cx={150} cy={30} r={6} fill={broken ? '#ff9a3c' : '#ff5a4f'} stroke="none" />
      <path d="M165 60 L205 52 M205 52 L205 52" />
      <path d={broken ? 'M205 52 L205 32' : 'M205 52 L205 16'} strokeWidth={1.6} />
      <circle cx={205} cy={broken ? 32 : 16} r={2.2} fill="#c9d6e2" stroke="none" />
      {/* Kabel */}
      <path d={broken ? 'M168 110 Q210 120 250 170' : 'M168 110 Q210 160 250 170'} stroke="#e0a43a" strokeWidth={2.2} />
      <path d="M250 170 V200 H262" stroke="#e0a43a" strokeWidth={2.2} />
      <rect x={256} y={194} width={18} height={14} fill="#23384d" strokeWidth={1.5} />
      {/* Solarpaneel links */}
      <path d={`M${legL(165)} 165 L92 165`} />
      {[0, 1, 2, 3].flatMap((i) => [0, 1].map((j) => (
        <rect key={`${i}-${j}`} x={30 + i * 15} y={150 + j * 15} width={14} height={14} strokeWidth={1}
          fill={broken && i === 3 && j === 1 ? '#1b2633' : '#2f5f9e'} />
      )))}
      {/* Häuschen mit Kennung */}
      <rect x={122} y={212} width={56} height={30} fill="#23384d" />
      <rect x={128} y={218} width={10} height={18} strokeWidth={1.2} />
      <text x={156} y={233} fontSize={11} fill="#c9d6e2" stroke="none" fontWeight={700}>{broken ? 'A7' : 'A1'}</text>
      {/* Grundplatte mit Bolzen */}
      <rect x={100} y={244} width={100} height={10} fill="#3a4b5c" strokeWidth={1.5} />
      {[110, 130, 170, 190].map((x) => (broken && x === 190 ? null : <circle key={x} cx={x} cy={250} r={2.6} fill="#9aaab8" stroke="none" />))}
    </g>
  )
}

const LED_AMBER = new Set(['1-0', '2-2', '3-1'])

function Panel({ broken }: { broken: boolean }) {
  const needle = (deg: number, cx: number, cy: number, len: number) => {
    const a = (deg * Math.PI) / 180
    return `M${cx} ${cy} L${cx + Math.cos(a) * len} ${cy + Math.sin(a) * len}`
  }
  return (
    <g stroke="#0b1622" strokeWidth={2}>
      <rect width={300} height={260} fill="#2b4258" stroke="none" />
      {/* Statusleuchten */}
      {Array.from({ length: 6 }, (_, i) => [0, 1, 2].map((j) => {
        const amber = LED_AMBER.has(`${i}-${j}`) || (broken && i === 5 && j === 1)
        return <circle key={`${i}-${j}`} cx={24 + i * 16} cy={24 + j * 16} r={4.5} fill={amber ? '#f2c14e' : '#5be08a'} strokeWidth={1} />
      }))}
      {/* Großes Messinstrument */}
      <circle cx={160} cy={80} r={44} fill="#14222f" />
      <path d="M124 80 A36 36 0 0 1 196 80" fill="none" stroke="#c9d6e2" strokeWidth={6} />
      <path d="M185 54 A36 36 0 0 1 196 80" fill="none" stroke="#ff5a4f" strokeWidth={6} />
      <path d={needle(broken ? -104 : -124, 160, 80, 32)} stroke="#fff" strokeWidth={3} />
      <circle cx={160} cy={80} r={4} fill="#c9d6e2" />
      {/* Kleines Messinstrument */}
      <circle cx={240} cy={78} r={24} fill="#14222f" />
      <path d={needle(-60, 240, 78, 18)} stroke="#fff" strokeWidth={2} />
      <text x={240} y={121} fontSize={10} fill="#c9d6e2" stroke="none" textAnchor="middle" fontWeight={700}>{broken ? 'CH-3' : 'CH-2'}</text>
      {/* Drehknöpfe */}
      {[40, 80, 120].map((x, i) => {
        const deg = [-60, 20, -150][i] + (broken && i === 1 ? 50 : 0)
        return (
          <g key={x}>
            <circle cx={x} cy={150} r={13} fill="#1d2c3a" />
            <path d={needle(deg, x, 150, 11)} stroke="#e0a43a" strokeWidth={3} />
          </g>
        )
      })}
      {/* Schieberegler */}
      {[170, 195, 220, 245].map((x, i) => {
        const y = [140, 170, 155, 180][i] - (broken && i === 2 ? 22 : 0)
        return (
          <g key={x}>
            <path d={`M${x} 125 V195`} stroke="#14222f" strokeWidth={4} />
            <rect x={x - 8} y={y - 4} width={16} height={8} rx={2} fill="#8fa8e8" strokeWidth={1} />
          </g>
        )
      })}
      {/* Kippschalter */}
      {[140, 165, 190].map((y, i) => {
        const up = [true, false, true][i] !== (broken && i === 1)
        return (
          <g key={y}>
            <rect x={255} y={y - 10} width={14} height={20} rx={3} fill="#14222f" strokeWidth={1} />
            <rect x={258} y={up ? y - 8 : y} width={8} height={8} rx={2} fill="#e0a43a" stroke="none" />
          </g>
        )
      })}
      {/* Anzeige */}
      <rect x={24} y={190} width={110} height={40} rx={4} fill="#0a1a12" />
      <text x={34} y={216} fontSize={16} fill="#5be08a" stroke="none" fontFamily="monospace">{broken ? '41.3' : '47.3'} kPa</text>
      {/* Kabel */}
      <path d="M150 260 C150 236 176 222 186 200" fill="none" stroke="#ff5a4f" strokeWidth={4} />
      <path d={broken ? 'M176 260 C176 238 220 222 236 202' : 'M176 260 C176 238 200 222 211 202'} fill="none" stroke="#4fb3a5" strokeWidth={4} />
      {/* Schrauben */}
      {[[10, 10], [290, 10], [10, 250], [290, 250]].map(([x, y]) => (broken && x === 290 && y === 250 ? null : <circle key={x * 1000 + y} cx={x} cy={y} r={5} fill="#9aaab8" strokeWidth={1} />))}
    </g>
  )
}
