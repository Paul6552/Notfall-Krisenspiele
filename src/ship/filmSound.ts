/** Klänge der Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */
import type { Cutscene } from '../game/types'

/** Treffer der Mikrometeoriten in Sekunden, passend zum Bild. */
export const IMPACT_HITS = [12.6, 13.4, 14.1, 14.8, 15.3]

/** Einschlag in die Satellitenschüssel in Sekunden, passend zum Bild. */
export const DISH_HIT = 8.4

/** Countdown des Starts in Sekunden, passend zum Bild. */
export const COUNTDOWN = [8, 7, 6, 5, 4, 3, 2, 1]
export const COUNTDOWN_STEP = 1.4
export const countdownAt = (i: number) => 0.4 + i * COUNTDOWN_STEP
const IGNITION = 11.6

const VOLUME = 0.7
/** Obergrenze der Höhen je Film: Schrill darf es nur bei Alarm und Gefahr klingen. */
const CALM_CUT_HZ = 1300
const ALARM_CUT_HZ = 2600
const ALARM_SCENES: ReadonlySet<Cutscene['scene']> = new Set(['impact', 'overload', 'failure'])
const STORAGE_KEY = 'krisenuebung.stumm'

const note = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12)
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(ac: BaseAudioContext) {
  let buffer = noiseBuffers.get(ac)
  if (!buffer) {
    buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ac, buffer)
  }
  return buffer
}

interface Shape {
  vol?: number
  attack?: number
  release?: number
}

/**
 * Plant die Klänge eines Films ein. `base` ist die Zeit des Filmbeginns im Audiokontext,
 * `from` die Sekunde, ab der gespielt wird (wer später dazukommt, hört nur den Rest).
 */
export function scheduleFilm(
  ac: BaseAudioContext,
  out: AudioNode,
  film: Pick<Cutscene, 'scene' | 'tone'>,
  base: number,
  from: number,
  stingAt: number,
  reduced = false,
): AudioScheduledSourceNode[] {
  const sources: AudioScheduledSourceNode[] = []
  const highCut = ac.createBiquadFilter()
  highCut.type = 'lowpass'
  highCut.frequency.value = ALARM_SCENES.has(film.scene) ? ALARM_CUT_HZ : CALM_CUT_HZ
  highCut.connect(out)

  const envelope = (t: number, d: number, { vol = 0.2, attack = 0.01, release = 0.08 }: Shape) => {
    if (t + d <= from) return null
    const at = base + Math.max(t, from)
    const end = base + t + d
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(vol, Math.min(at + attack, end))
    gain.gain.setValueAtTime(vol, Math.max(at + attack, end - release))
    gain.gain.linearRampToValueAtTime(0, end)
    gain.connect(highCut)
    return { at, end, gain }
  }

  const tone = (freq: number, t: number, d: number, o: Shape & { type?: OscillatorType; to?: number } = {}) => {
    const e = envelope(t, d, o)
    if (!e) return
    const osc = ac.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, e.at)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, e.end)
    osc.connect(e.gain)
    osc.start(e.at)
    osc.stop(e.end + 0.02)
    sources.push(osc)
  }

  const noise = (t: number, d: number, o: Shape & { filter?: BiquadFilterType; freq?: number; to?: number; q?: number } = {}) => {
    const e = envelope(t, d, o)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac)
    src.loop = true
    const filter = ac.createBiquadFilter()
    filter.type = o.filter ?? 'lowpass'
    filter.Q.value = o.q ?? 1
    filter.frequency.setValueAtTime(o.freq ?? 800, e.at)
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, e.end)
    src.connect(filter).connect(e.gain)
    src.start(e.at)
    src.stop(e.end + 0.02)
    sources.push(src)
  }

  /** Weicher Flächenklang als Musik unter dem Film. */
  const pad = (semitones: number[], t: number, d: number, vol = 0.14) => {
    for (const s of semitones) tone(note(s), t, d, { type: 'triangle', vol: vol / semitones.length, attack: d * 0.3, release: d * 0.35 })
  }

  const melody = (semitones: number[], t: number, step: number, vol = 0.16) => {
    semitones.forEach((s, i) => tone(note(s), t + i * step, step * 1.6, { type: 'triangle', vol, release: step }))
  }

  /** Blechbläser: zwei leicht verstimmte Sägezähne, deren Klang sich beim Ansatz öffnet. */
  const brass = (semitone: number, t: number, d: number, vol = 0.1) => {
    const e = envelope(t, d, { vol, attack: 0.06, release: Math.min(0.25, d / 2) })
    if (!e) return
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(280, e.at)
    filter.frequency.exponentialRampToValueAtTime(1150, Math.min(e.at + 0.12, e.end))
    filter.frequency.exponentialRampToValueAtTime(650, e.end)
    filter.connect(e.gain)
    for (const detune of [-7, 7]) {
      const osc = ac.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = note(semitone)
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(e.at)
      osc.stop(e.end + 0.02)
      sources.push(osc)
    }
  }

  const chord = (semitones: number[], t: number, d: number, vol = 0.04) => {
    for (const s of semitones) brass(s, t, d, vol)
  }

  /** Pauke: tiefer Schlag, der schnell ausklingt. */
  const timpani = (t: number, vol = 0.4) => {
    tone(82, t, 0.55, { to: 58, vol, attack: 0.005, release: 0.5 })
    noise(t, 0.09, { freq: 500, vol: vol * 0.35, release: 0.08 })
  }

  const sting = (t: number) => {
    if (film.tone === 'good') {
      melody([-9, -5, -2, 3], t, 0.16)
      pad([-21, -9, -5, -2], t + 0.5, 3, 0.28)
    } else if (film.tone === 'warn') {
      melody([-9, -6, -2], t, 0.2)
      pad([-21, -9, -6, -2], t + 0.5, 3, 0.24)
    } else {
      pad([-33, -32, -21, -20], t, 4, 0.5)
      noise(t, 1.4, { freq: 300, to: 60, vol: 0.4, release: 1 })
    }
  }

  const thump = (t: number, vol = 0.5) => {
    tone(120, t, 0.3, { to: 40, vol, release: 0.2 })
    noise(t, 0.16, { filter: 'bandpass', freq: 900, vol: vol * 0.45, release: 0.12 })
  }

  if (reduced) {
    sting(0)
    return sources
  }

  switch (film.scene) {
    case 'intro':
      // Paukenwirbel steigert sich bis zum Titel, dann die Fanfare in tiefer Lage (D-Dur, B-Dur, C-Dur, D-Dur).
      pad([-31, -24], 0, 2.6, 0.3)
      ;[0, 0.6, 1.1, 1.5, 1.8, 2.05, 2.25, 2.38].forEach((t, i) => timpani(t, 0.1 + i * 0.03))
      chord([-31, -19, -12, -7], 2.5, 1.9)
      timpani(2.5, 0.38)
      ;[[-19, 2.5, 0.5], [-12, 3, 0.4], [-12, 3.4, 0.2], [-7, 3.6, 0.9], [-9, 4.5, 0.3], [-11, 4.8, 0.3], [-9, 5.1, 0.4], [-7, 5.5, 3]].forEach(([s, t, d]) => brass(s, t, d, 0.07))
      chord([-35, -23, -16, -11], 4.4, 1)
      timpani(4.4, 0.28)
      chord([-33, -21, -14, -9], 5.4, 0.8)
      timpani(5.4, 0.3)
      chord([-31, -19, -12, -7], 6.2, 2.5)
      for (const t of [6.2, 6.5, 6.8, 7.1]) timpani(t, 0.34)
      break
    case 'prep':
      pad([-21, -14, -9], 0, 7.5, 0.12)
      for (let t = 0.5; t < 7.5; t += 1) tone(392, t, 0.07, { type: 'triangle', vol: 0.05 })
      noise(1, 6, { filter: 'bandpass', freq: 900, vol: 0.03, attack: 1, release: 2 })
      break
    case 'launch':
      // Jede Zahl des Countdowns bekommt einen Ton und einen immer stärkeren Paukenschlag.
      pad([-33, -26, -21], 0, 11.6, 0.3)
      COUNTDOWN.forEach((_, i) => {
        const t = countdownAt(i)
        tone(330, t, 0.22, { type: 'triangle', vol: 0.12 })
        timpani(t, 0.1 + i * 0.03)
      })
      tone(440, IGNITION + 0.05, 0.45, { type: 'triangle', vol: 0.14 })
      noise(IGNITION, 7.5, { freq: 240, to: 900, vol: 0.5, attack: 0.5, release: 4 })
      tone(48, IGNITION, 7, { type: 'sawtooth', to: 80, vol: 0.2, attack: 0.5, release: 4 })
      pad([-21, -9, -2, 3], IGNITION + 3, 8, 0.14)
      break
    case 'impact': {
      pad([-21, -9, -2], 0, 1.3, 0.1)
      for (let t = 1; t < 8.2; t += 1.5) {
        tone(330, t, 0.75, { type: 'sawtooth', to: 520, vol: 0.075, release: 0.03 })
        tone(520, t + 0.75, 0.75, { type: 'sawtooth', to: 330, vol: 0.075, release: 0.03 })
      }
      pad([-33, -32, -26], 5.2, 11, 0.4)
      for (let i = 0; i < 16; i++) {
        const t = 8.3 + i * 0.36
        noise(t, 0.8, { filter: 'bandpass', freq: 1200, to: 200, q: 2, vol: 0.12, attack: 0.2, release: 0.5 })
      }
      for (const t of IMPACT_HITS) thump(t)
      noise(15.4, 3, { filter: 'bandpass', freq: 1000, vol: 0.035, attack: 0.3, release: 2 })
      break
    }
    case 'repair':
      for (let i = 0; i < 14; i++) {
        noise(0.5 + i * 0.32, 0.12, { filter: 'bandpass', freq: 1400, vol: 0.08 })
        tone(note(-9 + (i % 7) * 2), 0.5 + i * 0.32, 0.1, { type: 'triangle', vol: 0.05 })
      }
      pad([-21, -14, -9], 0, 6, 0.1)
      break
    case 'asteroids':
      for (let t = 0.2; t < 10.4; t += 0.6) tone(note(-33), t, 0.34, { type: 'sawtooth', vol: 0.09 })
      for (const t of [1.4, 3.2, 4.9, 6.3, 8.4]) noise(t, 1.1, { filter: 'bandpass', freq: 1000, to: 180, q: 2, vol: 0.12, attack: 0.3, release: 0.6 })
      for (let t = 10.6; t < 11.9; t += 0.11) noise(t, 0.05, { filter: 'bandpass', freq: 1300, vol: 0.1 })
      break
    case 'dish':
      pad([-21, -14, -9], 0, 4.4, 0.12)
      noise(1, 3.4, { freq: 240, to: 500, vol: 0.14, attack: 1, release: 1 })
      for (const t of [4.6, 5.5, 6.4, 7.3]) tone(392, t, 0.16, { vol: 0.07 })
      pad([-33, -26], 4.4, 4, 0.22)
      noise(7.7, 0.7, { filter: 'bandpass', freq: 500, to: 1100, q: 2, vol: 0.14, attack: 0.5, release: 0.05 })
      thump(DISH_HIT, 0.75)
      noise(DISH_HIT, 1.6, { freq: 900, to: 140, vol: 0.3, release: 1.3 })
      for (let t = 9; t < 9.9; t += 0.16) noise(t, 0.06, { filter: 'bandpass', freq: 800, vol: 0.06 })
      break
    case 'signal':
      ;[0, 0.14, 0.28, 0.6, 0.74, 1.05, 1.5, 1.64, 2].forEach((t) => tone(520, t + 0.2, 0.09, { vol: 0.07 }))
      ;[1.2, 2, 2.8, 3.6, 4.4].forEach((t, i) => tone(note(-9 + i * 2), t, 0.2, { type: 'triangle', vol: 0.1 }))
      pad([-21, -14, -9], 0, 5.5, 0.1)
      break
    case 'overload': {
      pad([-21, -14, -9], 0, 5, 0.12)
      // Die Last steigt: Brummen wird höher, die Warntöne kommen immer schneller.
      tone(55, 5, 8.5, { type: 'sawtooth', to: 165, vol: 0.13, attack: 1, release: 0.2 })
      tone(110, 5, 8.5, { type: 'triangle', to: 330, vol: 0.1, attack: 1, release: 0.2 })
      noise(5, 8.5, { freq: 180, to: 800, vol: 0.2, attack: 3, release: 0.2 })
      for (let t = 5.4, step = 1; t < 13.3; t += step, step = Math.max(0.24, step * 0.86)) tone(294, t, 0.1, { type: 'triangle', vol: 0.09 })
      thump(13.5, 0.7)
      for (let t = 13.5; t < 19; t += 1.5) {
        tone(330, t, 0.75, { type: 'sawtooth', to: 520, vol: 0.075, release: 0.03 })
        tone(520, t + 0.75, 0.75, { type: 'sawtooth', to: 330, vol: 0.075, release: 0.03 })
      }
      break
    }
    case 'reactor':
      tone(160, 0, 5.8, { type: 'sawtooth', to: 55, vol: 0.09, attack: 0.5, release: 1 })
      tone(320, 0, 5.8, { type: 'triangle', to: 110, vol: 0.07, attack: 0.5, release: 1 })
      noise(0, 5.8, { freq: 500, to: 120, vol: 0.09, attack: 0.5, release: 1 })
      break
    case 'restart':
      tone(55, 0, 5.8, { type: 'sawtooth', to: 165, vol: 0.08, attack: 0.5, release: 1 })
      pad([-21, -9, -5, 0], 0, 6, 0.12)
      pad([-16, -4, 0, 3], 4, 5, 0.12)
      break
    case 'landing':
      noise(0, 8.6, { freq: 700, to: 180, vol: 0.34, attack: 1, release: 0.2 })
      tone(90, 0, 8.6, { type: 'sawtooth', to: 40, vol: 0.12, attack: 1, release: 0.2 })
      pad([-21, -14, -9], 0, 8.4, 0.1)
      thump(8.6, 0.7)
      noise(8.6, 2.4, { freq: 700, to: 150, vol: 0.14, release: 1.8 })
      break
    case 'failure':
      for (let t = 0.4; t < 2.5; t += 0.7) tone(294, t, 0.3, { type: 'triangle', vol: 0.12 })
      break
    case 'credits': {
      const chords = [[-9, -5, 0, 3], [-14, -7, -2, 3], [-12, -5, 0, 7], [-7, 0, 3, 7]]
      for (let i = 0; i < 4; i++) pad(chords[i], i * 4.2, 5.4, 0.2)
      melody([-5, -2, 0, -2, -5, -7, -9], 1, 0.75, 0.09)
      melody([-9, -7, -5, 0, -2, -5, -9], 9.4, 0.75, 0.09)
      break
    }
  }
  if (film.scene !== 'credits' && film.scene !== 'intro') sting(stingAt)
  return sources
}

// Stummschaltung gilt nur für dieses Gerät.
function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = typeof window === 'undefined' ? false : readMuted()
const listeners = new Set<() => void>()
let context: AudioContext | null = null
let master: GainNode | null = null
let pending: (() => void) | null = null

export const isMuted = () => muted
export const subscribeMuted = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Ohne Speicher gilt die Einstellung nur bis zum Neuladen.
  }
  if (context && master) master.gain.setTargetAtTime(value ? 0 : VOLUME, context.currentTime, 0.02)
  listeners.forEach((l) => l())
}

function audio() {
  if (!context && typeof AudioContext !== 'undefined') {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = muted ? 0 : VOLUME
    master.connect(context.createDynamicsCompressor()).connect(context.destination)
    context.onstatechange = () => {
      if (context?.state === 'running' && pending) {
        const start = pending
        pending = null
        start()
      }
    }
  }
  return context
}

// Browser erlauben Ton erst nach einer Bedienung. Der erste Klick im Spiel schaltet ihn frei.
if (typeof window !== 'undefined') {
  const unlock = () => { void audio()?.resume().catch(() => undefined) }
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  window.addEventListener('keydown', unlock, { capture: true, passive: true })
}

/** Spielt die Klänge eines Films und gibt eine Funktion zum Beenden zurück. */
export function playFilm(film: Cutscene, elapsedSeconds: () => number, stingAt: number, reduced: boolean) {
  let bus: GainNode | null = null
  let sources: AudioScheduledSourceNode[] = []
  const start = () => {
    const ac = context
    if (!ac || !master) return
    bus = ac.createGain()
    bus.connect(master)
    const from = reduced ? 0 : Math.max(0, elapsedSeconds())
    sources = scheduleFilm(ac, bus, film, ac.currentTime + 0.05 - from, from, stingAt, reduced)
  }
  if (audio()?.state === 'running') start()
  else pending = start

  return () => {
    if (pending === start) pending = null
    const ac = context
    if (!ac || !bus) return
    const ending = bus
    ending.gain.setTargetAtTime(0, ac.currentTime, 0.08)
    const stopAt = ac.currentTime + 0.5
    for (const s of sources) {
      try {
        s.stop(stopAt)
      } catch {
        // Bereits beendet.
      }
    }
    setTimeout(() => ending.disconnect(), 700)
  }
}
