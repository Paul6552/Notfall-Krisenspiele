import { useEffect, useRef, useState } from 'react'
import { teamName } from '../game/reducer'
import { ALL, GM } from '../game/types'
import type { Action, ChatMsg, View } from '../game/types'
import { timeOf } from '../events/Lessons'

const EMOJIS = ['⬆️', '⬇️', '⬅️', '➡️', '🛑', '✅', '❌', '⚡', '🔥', '☄️', '🚀', '🔋', '❗', '❓', '👍', '👎']

function status(view: View) {
  if (view.comms.net === 'down') return { label: 'Hauptkanal ausgefallen', tone: 'bad', blocked: true }
  if (view.comms.net === 'backup') {
    const in_ = view.me === GM || view.e4.checkedIn.includes(view.me)
    return { label: 'Notkanal', tone: 'warn', blocked: !in_ }
  }
  if (view.comms.emojiOnly) return { label: 'Nur Emojis', tone: 'warn', blocked: false }
  return { label: 'Hauptkanal', tone: 'good', blocked: false }
}

export function Chat({ view, act }: { view: View; act: (a: Action) => void }) {
  const [to, setTo] = useState(ALL)
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const gm = view.me === GM
  const st = status(view)
  const blocked = st.blocked && !gm

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [view.chat.length])

  if (view.settings.comm === 'external' && !gm) {
    return (
      <section className="chat card">
        <h2>Kommunikation</h2>
        <p className="muted">In dieser Übung kommuniziert ihr über externe Tools. {view.comms.net === 'primary' ? 'Nutzt den vereinbarten Hauptkanal, zum Beispiel MS Teams.' : 'Nutzt die Ersatzplattform, zum Beispiel Mattermost.'}</p>
        {view.comms.emojiOnly && <p className="notice warn">Ab jetzt sind nur Bilder und Emojis erlaubt.</p>}
        {view.comms.silence && <p className="notice bad">Funkstille: Keine Nachrichten senden!</p>}
      </section>
    )
  }

  const sender = (m: ChatMsg) => (m.kind === 'inject' ? m.fromLabel ?? 'Unbekannt' : m.kind === 'system' ? 'System' : teamName(view, m.from))
  const send = () => {
    if (!text.trim()) return
    act({ type: 'chat', to, text })
    setText('')
  }
  const targets = [{ id: ALL, name: 'Alle' }, ...view.teams.filter((t) => t.id !== view.me), ...(gm ? [] : [{ id: GM, name: 'Spielleitung' }])]

  return (
    <section className="chat card">
      <div className="row between">
        <h2>Funk</h2>
        <span className={`tag ${st.tone}`} data-testid="chat-status">{st.label}</span>
      </div>
      <div className="chat-list" ref={list} aria-live="polite">
        {view.chat.length === 0 && <p className="muted small">Noch keine Nachrichten.</p>}
        {view.chat.map((m) => (
          <div key={m.id} className={`msg ${m.from === view.me && !m.kind ? 'mine' : ''} ${m.kind ?? ''}`}>
            <div className="msg-head">
              <strong>{sender(m)}</strong>
              {m.to !== ALL && <span> → {teamName(view, m.to)}</span>}
              <time>{timeOf(m.ts)}</time>
            </div>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      {view.comms.silence && !gm && <p className="notice bad small">Funkstille! Jede Nachricht unterbricht den Neustart.</p>}
      {view.comms.emojiOnly && !blocked && (
        <div className="emoji-bar">
          {EMOJIS.map((e) => <button key={e} type="button" aria-label={`Emoji ${e}`} onClick={() => setText(text + e)}>{e}</button>)}
        </div>
      )}
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send() }}>
        <select aria-label="Empfänger" value={to} onChange={(e) => setTo(e.target.value)}>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input aria-label="Nachricht" disabled={blocked} placeholder={blocked ? 'Kein Kanal verfügbar' : 'Nachricht'} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn small" disabled={blocked}>Senden</button>
      </form>
    </section>
  )
}
