import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getVolume, isMuted, playSample, setMuted, setVolume, subscribeSound } from '../ship/filmSound'

/** Musik ein- und ausschalten, Lautstärke einstellen und vor dem Spiel probehören. Gilt nur für dieses Gerät. */
export function SoundCheck() {
  const muted = useSyncExternalStore(subscribeSound, isMuted)
  const volume = useSyncExternalStore(subscribeSound, getVolume)
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
        <label className="field grow">Lautstärke
          <input type="range" min={0} max={1} step={0.05} value={volume} disabled={muted} onChange={(e) => setVolume(Number(e.target.value))} />
        </label>
        <button type="button" className="btn small" disabled={muted} aria-pressed={testing} onClick={test}>{testing ? 'Test stoppen' : 'Musik testen'}</button>
      </div>
      <p className="muted small">Gilt nur für dieses Gerät. Hört ihr beim Test nichts, prüft Lautsprecher und Lautstärke des Geräts.</p>
    </div>
  )
}
