import { useEffect, useRef, useState } from 'react'
import { E6_INJECTS } from '../game/content/flugZumMars'
import { teamName } from '../game/reducer'
import { ALL, GM } from '../game/types'
import type { Action, ChatMsg, View } from '../game/types'
import { timeOf } from '../events/Lessons'

/** Mit diesem Absender schreibt die Spielleitung offen. Jeder andere Name erscheint als eingespielte Meldung. */
const GM_SENDER = 'Spielleitung'
const SENDERS = [GM_SENDER, 'Unbekannter Sender', 'Flugkontrolle']

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
  const [sender, setSender] = useState(GM_SENDER)
  const [org, setOrg] = useState(view.teams[0]?.name ?? '')
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

  const disguised = gm && Boolean(sender.trim()) && sender.trim() !== GM_SENDER
  const from = (m: ChatMsg) => (m.kind === 'inject' ? m.fromLabel ?? 'Unbekannt' : m.kind === 'system' ? 'System' : teamName(view, m.from))
  const send = () => {
    if (!text.trim()) return
    act(disguised ? { type: 'inject', text, label: sender.trim(), to } : { type: 'chat', to, text })
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
              <strong>{from(m)}</strong>
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
      {gm && (
        <div className="gm-sender">
          {view.phase === 'e6' && (
            <div className="row wrap">
              <label className="field">Organisation in der Vorlage
                <select value={org} onChange={(e) => setOrg(e.target.value)}>{view.teams.map((t) => <option key={t.id}>{t.name}</option>)}</select>
              </label>
              <label className="field">Falschmeldung als Vorlage
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    setText(e.target.value.replaceAll('{org}', org))
                    if (!disguised) setSender('Unbekannter Sender')
                  }}
                >
                  <option value="">Vorlage wählen</option>
                  {E6_INJECTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          )}
          <label className="field">Absender
            <input list="chat-senders" value={sender} onChange={(e) => setSender(e.target.value)} onBlur={() => { if (!sender.trim()) setSender(GM_SENDER) }} />
          </label>
          <datalist id="chat-senders">{SENDERS.map((n) => <option key={n} value={n} />)}</datalist>
          <p className="muted small">{disguised ? `Die Teams sehen „${sender.trim()}“ als Absender, nicht die Spielleitung. So spielt ihr Meldungen und Gerüchte ein.` : 'Ändert den Absender, um eine Meldung von außen einzuspielen, zum Beispiel „Unbekannter Sender“.'}</p>
        </div>
      )}
      <form className={`chat-form ${gm ? 'gm' : ''}`} onSubmit={(e) => { e.preventDefault(); send() }}>
        <select aria-label="Empfänger" value={to} onChange={(e) => setTo(e.target.value)}>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {gm
          ? <textarea aria-label="Nachricht" rows={2} placeholder="Nachricht oder Meldung" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          : <input aria-label="Nachricht" disabled={blocked} placeholder={blocked ? 'Kein Kanal verfügbar' : 'Nachricht'} value={text} onChange={(e) => setText(e.target.value)} />}
        <button className="btn small" disabled={blocked}>{disguised ? 'Einspielen' : 'Senden'}</button>
      </form>
    </section>
  )
}
