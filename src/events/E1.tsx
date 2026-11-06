import { useState } from 'react'
import { E1_QUESTIONS, noGoText } from '../game/content/flugZumMars'
import { teamName } from '../game/reducer'
import { Notice } from '../screens/shared'
import type { PanelProps } from './types'

export function E1({ view, role, act }: PanelProps) {
  if (role === 'LS') return <Bridge view={view} role={role} act={act} />
  return (
    <div className="stack">
      <p>Recherchiert die Antworten und meldet sie an die Brücke. Die Brücke hat die Sollwerte.</p>
      {!view.e1.decision && Boolean(view.e1.noGos) && <Notice tone="warn">{noGoText(view.e1.noGos!)}</Notice>}
      {E1_QUESTIONS.map((q, i) => <Question key={i} index={i} text={q} sent={view.e1.answers[i]?.[view.me]} act={act} locked={view.e1.decision === 'go'} />)}
      {view.e1.decision === 'go' && <Notice tone="good">Die Brücke hat GO gegeben. Die ARES 1 hebt ab.</Notice>}
    </div>
  )
}

function Question({ index, text, sent, act, locked }: { index: number; text: string; sent?: string; act: PanelProps['act']; locked: boolean }) {
  const [draft, setDraft] = useState(sent ?? '')
  return (
    <form className="question" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) act({ type: 'e1Answer', q: index, text: draft }) }}>
      <label htmlFor={`q${index}`}><strong>Frage {index + 1}.</strong> {text}</label>
      <div className="row">
        <input id={`q${index}`} disabled={locked} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Eure Antwort" />
        <button className="btn small" disabled={locked}>Senden</button>
      </div>
      {sent && <p className="muted small">Gesendet: {sent}</p>}
    </form>
  )
}

function Bridge({ view, act }: PanelProps) {
  const targets = view.docs.e1Targets ?? []
  const decided = view.e1.decision === 'go'
  return (
    <div className="stack">
      <Notice tone="warn">Nur die Brücke hat diese Startdaten. Gebt sie nicht weiter, prüft die Antworten der Teams.</Notice>
      {E1_QUESTIONS.map((q, i) => {
        const answers = Object.entries(view.e1.answers[i] ?? {})
        const mark = view.e1.marks[i]
        return (
          <div className="question" key={i}>
            <p><strong>Frage {i + 1}.</strong> {q}</p>
            <p className="target">Sollwert: {targets[i]}</p>
            {answers.length ? (
              <ul className="answers">
                {answers.map(([team, text]) => <li key={team}>Antwort von {teamName(view, team)}: <strong>{text}</strong></li>)}
              </ul>
            ) : <p className="muted">Noch keine Antwort</p>}
            <div className="row">
              <button className={`btn small ${mark === true ? 'selected' : ''}`} aria-pressed={mark === true} onClick={() => act({ type: 'e1Mark', q: i, ok: true })}>Korrekt</button>
              <button className={`btn small ${mark === false ? 'selected bad' : ''}`} aria-pressed={mark === false} onClick={() => act({ type: 'e1Mark', q: i, ok: false })}>Falsch</button>
            </div>
          </div>
        )
      })}
      {!decided && Boolean(view.e1.noGos) && <Notice tone="warn">{noGoText(view.e1.noGos!)}</Notice>}
      {decided ? <Notice tone="good">GO erteilt. Die Spielleitung startet das nächste Ereignis.</Notice> : (
        <div className="row">
          <button className="btn primary" onClick={() => act({ type: 'e1Decide', go: true })}>GO für den Start</button>
          <button className="btn danger" onClick={() => act({ type: 'e1Decide', go: false })}>NO-GO (kostet 10 Minuten)</button>
        </div>
      )}
    </div>
  )
}
