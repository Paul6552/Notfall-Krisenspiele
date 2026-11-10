import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isMuted, playSample, setMuted, subscribeSound } from '../ship/filmSound'

/** Musik ein- und ausschalten und vor dem Spiel probehören. Die Lautstärke regelt das Betriebssystem. */
export function SoundCheck() {
  const muted = useSyncExternalStore(subscribeSound, isMuted)
  const [testing, setTesting] = useState(false)
  const stop = useRef<(() => void) | null>(null)

  const end = () => {
    stop.current?.()
    stop.current = null
    setTesting(false)
  }
  useEffect(() => () => stop.current?.(), [])

  const test = () => {
    if (testing) return end()
    setTesting(true)
    stop.current = playSample(() => {
      stop.current = null
      setTesting(false)
    })
  }

  return (
    <div className="soundcheck">
      <label className="radio"><input type="checkbox" checked={!muted} onChange={(e) => { setMuted(!e.target.checked); if (!e.target.checked) end() }} /> Musik und Klänge in den Filmen</label>
      <div className="row wrap">
        <button type="button" className="btn small" disabled={muted} aria-pressed={testing} onClick={test}>{testing ? 'Test stoppen' : 'Musik testen'}</button>
      </div>
      <p className="muted small">Gilt nur für dieses Gerät. Die Lautstärke stellt ihr am Gerät ein. Hört ihr beim Test nichts, prüft Lautsprecher und Lautstärke des Geräts.</p>
    </div>
  )
}
