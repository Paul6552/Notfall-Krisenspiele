import { useState } from 'react'
import type { MouseEvent } from 'react'
import { MODULES, PIECE_SPECS, ROLES } from '../game/content/flugZumMars'
import { shiftText } from '../game/cipher'
import { FRAME_H, FRAME_W, piecePolygon } from '../game/geometry'
import type { PieceKind, Placement, ShapeKind } from '../game/types'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

const FIELDS: Record<ShapeKind, { label: string; names: string[] }> = {
  triangle: { label: 'Dreieck', names: ['Basis (cm)', 'Schenkel (cm)'] },
  square: { label: 'Quadrat', names: ['Seitenlänge (cm)'] },
  parallelogram: { label: 'Parallelogramm', names: ['Grundseite (cm)', 'Seite (cm)', 'Winkel (°)'] },
}

const COLORS: Record<PieceKind, string> = { L: '#e0a43a', M: '#4fb3a5', S: '#d9705a', Q: '#8fa8e8', P: '#b98ad9' }
const pts = (p: number[][]) => p.map((q) => q.join(',')).join(' ')

export function E2({ view, role, act }: PanelProps) {
  const repaired = view.e2.repaired && <Notice tone="good">Hitzeschild repariert. Der Sauerstoffverlust ist gestoppt.</Notice>
  if (role === 'LS') {
    return (
      <div className="stack">
        {repaired}
        <h3>Reparatur-Protokoll (nicht teilen)</h3>
        <p>Rekonstruktion Hitzeschild-Segment 01-A. Sendet den Bauplan verschlüsselt an Maschinenraum und nennt den Schlüssel auf einem getrennten Weg. Maschinenraum darf nur die Maße weitergeben.</p>
        <p>Schlüssel: <strong className="key">{view.docs.e2CipherShift}</strong></p>
        <ul className="plan">{view.docs.e2PlanText?.map((l) => <li key={l}>{l}</li>)}</ul>
        {view.e2.planSent ? <Notice tone="good">Bauplan gesendet. Auch Außeneinsatz hat das Zielbild bekommen.</Notice> : <button className="btn primary" onClick={() => act({ type: 'e2SendPlan' })}>Bauplan senden</button>}
        <Target view={view} />
      </div>
    )
  }
  if (role === 'S6') return <Decoder view={view} role={role} act={act} />
  if (role === 'S1') return <Assembly view={view} role={role} act={act} />
  if (role === 'S2' || role === 'S3' || role === 'S4') {
    return (
      <div className="stack">
        {repaired}
        <p>Baut eure Module nach den Maßen von Maschinenraum und liefert sie an Außeneinsatz. Maschinenraum kennt die Maße, ihr nicht.</p>
        {MODULES.filter((m) => m.owner === role).map((m) => <Builder key={m.id} id={m.id} view={view} role={role} act={act} />)}
      </div>
    )
  }
  return <div className="stack">{repaired}<p>Das Kommunikationsdeck baut keine Teile. Haltet die Crew auf dem Laufenden und helft, Meldungen zu ordnen.</p></div>
}

function Decoder({ view }: PanelProps) {
  const [key, setKey] = useState(0)
  const lines = view.docs.e2Cipher
  if (!lines) return <Notice>Wartet auf den verschlüsselten Bauplan der Brücke.</Notice>
  return (
    <div className="stack">
      <p>Entschlüsselt den Plan mit dem Schlüssel der Brücke. Gebt dann nur die Maße an die Produktionsteams weiter, nie das Dokument. Modulnummern zeigen, welches Team welches Teil baut.</p>
      <label htmlFor="key">Schlüssel: <strong>{key}</strong></label>
      <input id="key" type="range" min={0} max={25} value={key} onChange={(e) => setKey(Number(e.target.value))} />
      <ul className="plan">{lines.map((l, i) => <li key={i}>{shiftText(l, -key)}</li>)}</ul>
    </div>
  )
}

function Builder({ id, view, act }: PanelProps & { id: string }) {
  const built = view.e2.built[id]
  const [shape, setShape] = useState<ShapeKind>(built?.shape ?? 'triangle')
  const [dims, setDims] = useState<string[]>([])
  const fields = FIELDS[shape]
  const submit = () => {
    const values = fields.names.map((_, i) => Number((dims[i] ?? '').replace(',', '.')))
    if (values.some((v) => !v)) return
    act({ type: 'e2Build', module: id, shape, dims: values })
  }
  return (
    <form className="question" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <div className="row between">
        <strong>Modul {id}</strong>
        {built ? <span className="tag good">Geliefert</span> : <span className="tag">Offen</span>}
      </div>
      <div className="row wrap">
        <label className="field">Form
          <select value={shape} onChange={(e) => { setShape(e.target.value as ShapeKind); setDims([]) }}>
            {Object.entries(FIELDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        {fields.names.map((n, i) => (
          <label className="field" key={n}>{n}
            <input inputMode="decimal" value={dims[i] ?? ''} onChange={(e) => { const next = [...dims]; next[i] = e.target.value; setDims(next) }} />
          </label>
        ))}
        <button className="btn small">{built ? 'Neu liefern' : 'An Außeneinsatz liefern'}</button>
      </div>
    </form>
  )
}

function Target({ view }: { view: PanelProps['view'] }) {
  const target = view.docs.e2Solution
  if (!target) return null
  return (
    <figure className="target-img">
      <svg viewBox={`-0.1 -0.1 ${FRAME_W + 0.2} ${FRAME_H + 0.2}`}>
        {target.map((t, i) => <polygon key={i} points={pts(t.pts)} fill={COLORS[t.kind]} stroke="#0b1622" strokeWidth={0.04} />)}
      </svg>
      <figcaption>Zielbild: Doppel-Hitzeschild, 24 x 12 cm</figcaption>
    </figure>
  )
}

function Assembly({ view, act }: PanelProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [rot, setRot] = useState(0)
  const [flip, setFlip] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const { built, placed, repaired } = view.e2

  const delivered = MODULES.filter((m) => built[m.id])
  const tray = delivered.filter((m) => !placed[m.id])
  const kind = MODULES.find((m) => m.id === selected)?.kind

  const cell = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: Math.floor(((e.clientX - r.left) / r.width) * FRAME_W), y: Math.floor(((e.clientY - r.top) / r.height) * FRAME_H) }
  }
  const fit = (c: { x: number; y: number }, k: PieceKind): Placement => {
    const poly = piecePolygon(k, { x: 0, y: 0, rot, flip })
    const w = Math.max(...poly.map((p) => p[0]))
    const h = Math.max(...poly.map((p) => p[1]))
    return { x: Math.min(c.x, FRAME_W - w), y: Math.min(c.y, FRAME_H - h), rot, flip }
  }
  const place = (e: MouseEvent<SVGSVGElement>) => {
    if (!selected || !kind) return
    act({ type: 'e2Place', module: selected, placement: fit(cell(e), kind) })
    setSelected(null)
  }

  return (
    <div className="stack">
      {repaired && <Notice tone="good">Hitzeschild repariert. Der Sauerstoffverlust ist gestoppt.</Notice>}
      <p>Fügt alle 14 Teile zum Doppel-Hitzeschild zusammen. Teil auswählen, drehen und im Rahmen auf die gewünschte Stelle tippen. Ein Tipp auf ein eingebautes Teil nimmt es wieder heraus.</p>
      <Target view={view} />
      <svg className="frame" data-testid="shield-frame" viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} onClick={place} onMouseMove={(e) => setHover(cell(e))} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: FRAME_W + 1 }, (_, x) => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={FRAME_H} className="grid-line" />)}
        {Array.from({ length: FRAME_H + 1 }, (_, y) => <line key={`y${y}`} y1={y} y2={y} x1={0} x2={FRAME_W} className="grid-line" />)}
        {MODULES.filter((m) => placed[m.id]).map((m) => (
          <polygon
            key={m.id}
            points={pts(piecePolygon(m.kind, placed[m.id]))}
            fill={COLORS[m.kind]}
            stroke="#0b1622"
            strokeWidth={0.04}
            onClick={(e) => { if (!selected && !repaired) { e.stopPropagation(); act({ type: 'e2Remove', module: m.id }) } }}
          />
        ))}
        {selected && kind && hover && <polygon points={pts(piecePolygon(kind, fit(hover, kind)))} fill={COLORS[kind]} opacity={0.5} pointerEvents="none" />}
      </svg>
      <div className="row wrap">
        <button className="btn small" onClick={() => setRot((rot + 1) % 4)}>Drehen ↻</button>
        <button className="btn small" onClick={() => setFlip(!flip)}>Spiegeln ⇋</button>
        <span className="muted small">{Object.keys(placed).length} von {MODULES.length} eingebaut</span>
      </div>
      <h3>Gelieferte Teile</h3>
      {delivered.length === 0 && <p className="muted">Noch keine Teile geliefert.</p>}
      <div className="tray">
        {tray.map((m) => {
          const b = built[m.id]
          const poly = piecePolygon(m.kind, { x: 0, y: 0, rot: selected === m.id ? rot : 0, flip: selected === m.id && flip })
          return (
            <div className={`tray-item ${selected === m.id ? 'selected' : ''}`} key={m.id}>
              <button aria-label={`Teil ${m.id} auswählen`} disabled={!b.ok} onClick={() => setSelected(selected === m.id ? null : m.id)}>
                <svg viewBox="-0.1 -0.1 4.2 4.2"><polygon points={pts(poly)} fill={b.ok ? COLORS[m.kind] : '#667'} /></svg>
                <span>{m.id}</span>
              </button>
              {!b.ok && (
                <>
                  <span className="tag bad">Maße falsch</span>
                  <button className="btn small ghost" onClick={() => act({ type: 'e2Reject', module: m.id })}>Zurückweisen</button>
                </>
              )}
            </div>
          )
        })}
      </div>
      <p className="muted small">Produktion: {ROLES.S2.section}, {ROLES.S3.section}, {ROLES.S4.section}. Verlangte Maße je Modul stehen im Bauplan ({PIECE_SPECS.L.label} und andere).</p>
    </div>
  )
}
