import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { E3_DIFFS, E3_MAX_ENERGY, E3_THRESHOLD } from '../game/content/flugZumMars'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

const W = 14
const H = 8

function Grid({ children }: { children: ReactNode }) {
  return <svg className="radar" viewBox={`0 0 ${W} ${H}`}>{children}</svg>
}

const Ship = ({ x, y }: { x: number; y: number }) => <text x={x + 0.5} y={y + 0.72} fontSize={0.72} textAnchor="middle">🚀</text>

function Trail({ view }: { view: PanelProps['view'] }) {
  const line = [...view.e3.trail, view.e3.pos].map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(' ')
  return <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.15 0.12" />
}

export function E3({ view, role, act }: PanelProps) {
  const arrived = view.e3.arrived && <Notice tone="good">Die ARES 1 hat das Asteroidenfeld durchquert.</Notice>
  switch (role) {
    case 'LS': return <div className="stack">{arrived}<BridgeMap view={view} /></div>
    case 'S3': return <div className="stack">{arrived}<Pilot view={view} role={role} act={act} /></div>
    case 'S4': return <div className="stack">{arrived}<Energy view={view} role={role} act={act} /></div>
    case 'S2': return <Sensors view={view} role={role} act={act} />
    case 'S1': return <SpotDiff puzzle="mast" view={view} act={act} title="Funkmast" />
    case 'S6': return <SpotDiff puzzle="panel" view={view} act={act} title="Schaltpult der Funkanlage" />
    default: return <Crew view={view} role={role} act={act} />
  }
}

function BridgeMap({ view }: { view: PanelProps['view'] }) {
  const map = view.docs.e3Map ?? []
  return (
    <>
      <p>Nur ihr seht das Trümmerfeld. Übermittelt Antrieb die Kursbefehle per Emoji. Das Labor kann die Sturmzonen bestimmen, sie erscheinen dann violett.</p>
      <Grid>
        {map.flatMap((row, y) => [...row].map((c, x) => {
          if (c === '#') return <text key={`${x}-${y}`} x={x + 0.5} y={y + 0.72} fontSize={0.66} textAnchor="middle">🪨</text>
          if (c === '~') return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#8d5cf0" opacity={0.55} />
          if (c === 'G') return <text key={`${x}-${y}`} x={x + 0.5} y={y + 0.72} fontSize={0.66} textAnchor="middle">🏁</text>
          return null
        }))}
        <Trail view={view} />
        <Ship {...view.e3.pos} />
      </Grid>
      <p className="muted small">Treffer: {view.e3.collisions} · Sturmfelder: {view.e3.stormHits}{view.e3.stormKnown ? '' : ' · Sturmzonen noch unbekannt'}</p>
    </>
  )
}

function Pilot({ view, act }: PanelProps) {
  const move = (dx: number, dy: number) => act({ type: 'e3Move', dx, dy })
  return (
    <>
      <p>Ihr fliegt blind. Führt die Kursbefehle der Brücke aus. Jede Bewegung kostet 1 Einheit Energie von Versorgung.</p>
      <Grid><Trail view={view} /><Ship {...view.e3.pos} /></Grid>
      <div className="row between wrap">
        <p>Verfügbare Energie: <strong data-testid="energy">{view.e3.energy}</strong></p>
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
  return (
    <>
      <p>Antrieb zündet, ihr liefert die Energie. Stimmt den Schub mit Antrieb ab. Die Reserve ist begrenzt, ein Umweg kann sie aufbrauchen.</p>
      <p>Freigegeben und noch nicht verbraucht: <strong>{view.e3.energy}</strong> · Reserve: <strong>{E3_MAX_ENERGY - released}</strong></p>
      <div className="row">
        {[1, 3, 5].map((n) => <button key={n} className="btn" onClick={() => act({ type: 'e3Energy', amount: n })}>+{n} Energie</button>)}
      </div>
    </>
  )
}

function Sensors({ view, act }: PanelProps) {
  const [picked, setPicked] = useState<string[]>([])
  const rows = view.docs.e3Sensors ?? []
  if (view.e3.stormKnown) return <Notice tone="good">Analyse abgeschlossen. Die Brücke sieht die Sturmzonen auf der Karte.</Notice>
  return (
    <div className="stack">
      <p>Wertet die Sensordaten aus: Sektoren mit einem Mittelwert über {E3_THRESHOLD} liegen im Ionensturm. Meldet sie, dann sieht die Brücke die Sturmzonen auf der Karte.</p>
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
      <button className="btn primary" disabled={!picked.length} onClick={() => act({ type: 'e3Sectors', sectors: picked })}>Analyse melden</button>
    </div>
  )
}

function Crew({ view, act }: PanelProps) {
  const [text, setText] = useState('')
  return (
    <div className="stack">
      <p>Die Crew ist verunsichert. Informiert sie mit einer Meldung, die nur aus Emojis besteht.</p>
      {view.e3.emojiStatement && <Notice tone="good">Eure Crew-Meldung ist draußen.</Notice>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'statement', text }); setText('') }}>
        <input aria-label="Crew-Meldung" placeholder="🚀 ☄️ 👍" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Veröffentlichen</button>
      </form>
    </div>
  )
}

function SpotDiff({ puzzle, view, act, title }: { puzzle: 'mast' | 'panel'; view: PanelProps['view']; act: PanelProps['act']; title: string }) {
  const diffs = E3_DIFFS[puzzle]
  const found = view.e3.found[puzzle]
  const Scene = puzzle === 'mast' ? Mast : Panel
  const click = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 300
    const y = ((e.clientY - r.top) / r.height) * 260
    const hit = diffs.find((d) => Math.hypot(d.x - x, d.y - y) <= d.r && !found.includes(d.id))
    if (hit) act({ type: 'e3Found', puzzle, diff: hit.id })
  }
  return (
    <div className="stack">
      <p>{title}: Der Ionensturm hat Schäden verursacht. Vergleicht Soll und Ist und tippt im Ist-Bild jede Abweichung an.</p>
      <p><strong>{found.length} von {diffs.length}</strong> gefunden</p>
      {found.length === diffs.length && <Notice tone="good">Fehlerprüfung abgeschlossen.</Notice>}
      <div className="spot">
        <figure><svg viewBox="0 0 300 260"><Scene broken={false} /></svg><figcaption>Soll</figcaption></figure>
        <figure>
          <svg viewBox="0 0 300 260" data-testid={`spot-${puzzle}`} onClick={click} className="clickable">
            <Scene broken />
            {diffs.filter((d) => found.includes(d.id)).map((d) => <circle key={d.id} cx={d.x} cy={d.y} r={d.r} fill="none" stroke="#5be08a" strokeWidth={3} />)}
          </svg>
          <figcaption>Ist</figcaption>
        </figure>
      </div>
    </div>
  )
}

function Mast({ broken }: { broken: boolean }) {
  return (
    <g stroke="#c9d6e2" strokeWidth={4} fill="none">
      <rect width={300} height={260} fill="#12263a" stroke="none" />
      <path d="M150 30 L110 240 M150 30 L190 240" />
      <path d="M128 130 H172 M120 180 H180 M136 80 H164" />
      {!broken && <path d="M118 188 L172 130" />}
      {broken ? <path d="M36 40 Q60 92 90 62" strokeWidth={6} /> : <path d="M36 66 Q60 22 84 66" strokeWidth={6} />}
      <path d="M60 52 L140 90" />
      <circle cx={150} cy={24} r={9} fill={broken ? '#3b4654' : '#ff5a4f'} stroke="none" />
      {broken
        ? <><path d="M170 100 Q190 110 192 122" stroke="#e0a43a" /><path d="M204 128 Q216 160 240 170" stroke="#e0a43a" /></>
        : <path d="M170 100 Q210 130 240 170" stroke="#e0a43a" />}
      {broken ? <path d="M228 80 L228 48 L252 28" /> : <path d="M228 80 L228 18" />}
      <path d="M188 100 L228 80" />
      <rect x={126} y={214} width={48} height={32} fill="#23384d" />
      {broken ? <path d="M126 214 L100 196 L100 228 L126 246Z" fill="#23384d" /> : <path d="M134 230 H166" />}
    </g>
  )
}

function Panel({ broken }: { broken: boolean }) {
  return (
    <g stroke="#0b1622" strokeWidth={2}>
      <rect width={300} height={260} fill="#2b4258" stroke="none" />
      {[50, 86, 122].map((x, i) => <circle key={x} cx={x - 14 + 14} cy={40} r={10} fill={i === 0 && broken ? '#ff5a4f' : '#5be08a'} />)}
      <circle cx={150} cy={80} r={0} />
      <path d="M112 100 A40 40 0 0 1 188 100" fill="none" stroke="#c9d6e2" strokeWidth={8} />
      <path d="M172 62 A40 40 0 0 1 188 100" fill="none" stroke="#ff5a4f" strokeWidth={8} />
      <path d={broken ? 'M150 100 L180 76' : 'M150 100 L130 70'} stroke="#fff" strokeWidth={4} />
      <rect x={232} y={24} width={26} height={44} rx={4} fill="#14222f" />
      <rect x={236} y={broken ? 46 : 28} width={18} height={18} rx={3} fill="#e0a43a" />
      <rect x={30} y={150} width={70} height={50} fill="#14222f" />
      {!broken && <rect x={48} y={160} width={34} height={30} fill="#e0a43a" />}
      {[130, 160, 190, 220].map((x, i) => {
        const h = i === 1 && broken ? 16 : [40, 60, 50, 30][i]
        return <rect key={x} x={x} y={210 - h} width={20} height={h} fill="#8fa8e8" />
      })}
      {[[20, 20], [280, 20], [20, 240]].map(([x, y]) => <circle key={x + y} cx={x} cy={y} r={5} fill="#9aaab8" />)}
      {!broken && <circle cx={262} cy={228} r={5} fill="#9aaab8" />}
    </g>
  )
}
