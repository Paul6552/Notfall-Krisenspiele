import { useState } from 'react'
import { LESSONS_QUESTIONS, PHASE_INFO } from '../game/content/flugZumMars'
import type { View } from '../game/types'
import type { Action } from '../game/types'
import { Notice } from '../screens/shared'

export const timeOf = (ts: number) => new Date(ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

export function Lessons({ view, act }: { view: View; act: (a: Action) => void }) {
  const [text, setText] = useState('')
  const exportJson = () => {
    const data = { code: view.code, ship: view.ship, failure: view.failure, consequences: view.consequences, notes: view.notes, log: view.log }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `auswertung-${view.code}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="stack">
      {view.e7.landed && !view.failure ? <Notice tone="good">Mission erfüllt: Die ARES 1 ist auf dem Mars gelandet.</Notice> : <Notice tone="bad">Mission gescheitert. {view.failure}</Notice>}
      {view.consequences.length > 0 && (
        <>
          <h3>Folgen der Entscheidungen</h3>
          <ul>{view.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      <h3>Fragen zur Analyse</h3>
      <ul>{LESSONS_QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul>
      <h3>Notizen</h3>
      <form className="row" onSubmit={(e) => { e.preventDefault(); act({ type: 'note', text }); setText('') }}>
        <input aria-label="Notiz" placeholder="Erkenntnis festhalten" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Hinzufügen</button>
      </form>
      <ul className="notes">{view.notes.map((n, i) => <li key={i}><strong>{n.team}:</strong> {n.text}</li>)}</ul>
      <h3>Zeitleiste</h3>
      <ol className="timeline">
        {view.log.map((l, i) => (
          <li key={i} className={l.tone}>
            <time>{timeOf(l.ts)}</time>
            <span className="muted">{PHASE_INFO[l.phase].short}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ol>
      <button className="btn" onClick={exportJson}>Auswertung als JSON herunterladen</button>
    </div>
  )
}
