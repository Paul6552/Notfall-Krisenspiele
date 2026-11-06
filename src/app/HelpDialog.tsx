import { useRef } from 'react'
import { ROLES } from '../game/content/flugZumMars'
import { ROLE_IDS } from '../game/types'

export function HelpButton() {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button className="icon-btn" aria-label="Hilfe zu SKKM" title="Hilfe zu SKKM" onClick={() => ref.current?.showModal()}>
        ?
      </button>
      <dialog ref={ref} className="help" aria-labelledby="help-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="help-body">
          <header className="row between">
            <h2 id="help-title">Dieses Spiel arbeitet mit SKKM</h2>
            <button className="icon-btn" aria-label="Schließen" onClick={() => ref.current?.close()}>
              ✕
            </button>
          </header>
          <p>
            <strong>SKKM</strong> steht für <strong>Staatliches Krisen- und Katastrophenschutzmanagement</strong>. In einer Krise arbeitet ein
            Stab mit festen Rollen, damit Informationen geordnet fließen und Entscheidungen schnell fallen. Jedes Team übernimmt mindestens eine
            dieser Rollen. Der Spielleiter vergibt sie.
          </p>
          <div className="table-scroll">
            <table className="roles">
              <thead>
                <tr>
                  <th>Rolle</th>
                  <th>Im Stab</th>
                  <th>Im Raumschiff</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_IDS.map((id) => (
                  <tr key={id}>
                    <th scope="row">
                      {ROLES[id].code}
                      <span>{ROLES[id].skkm}</span>
                    </th>
                    <td>{ROLES[id].skkmText}</td>
                    <td>
                      <strong>{ROLES[id].section}.</strong> {ROLES[id].game}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Grundlage: SKKM-Richtlinie für das Führen im Katastropheneinsatz, Abschnitte 4.4 und 4.5.</p>
        </div>
      </dialog>
    </>
  )
}
