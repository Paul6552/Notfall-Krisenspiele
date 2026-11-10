/** Musik und Klänge der Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */
import type { Cutscene } from '../game/types'
import { CHORD, TENSION_CHORDS, THEME_A, THEME_A_CHORDS, THEME_B, THEME_B_CHORDS, createKit, note } from './music'
import type { Kit, Progression } from './music'

/** Treffer der Mikrometeoriten in Sekunden, passend zum Bild. */
export const IMPACT_HITS = [12.6, 13.4, 14.1, 14.8, 15.3]

/** Einschlag in die Satellitenschüssel in Sekunden, passend zum Bild. */
export const DISH_HIT = 8.4

/** Ionensturm: Schnitt in den Serverraum und Stromstoß, passend zum Bild. */
export const STORM_INSIDE = 10.5
export const STORM_SURGE = 12.6

/** Aufsetzen auf dem Mars in Sekunden, passend zum Bild. */
export const TOUCHDOWN = 8.6

/** Countdown des Starts in Sekunden, passend zum Bild. */
export const COUNTDOWN = [8, 7, 6, 5, 4, 3, 2, 1]
export const COUNTDOWN_STEP = 1.4
export const countdownAt = (i: number) => 0.4 + i * COUNTDOWN_STEP
const IGNITION = 11.6

type Film = Pick<Cutscene, 'scene' | 'tone'>

/** Tiefster Akkordton als Paukenton, nie tiefer als D. */
const drum = (chord: number[]) => (chord[0] < -31 ? chord[0] + 12 : chord[0])

function helpers(k: Kit, film: Film) {
  /** Streicher über eine Akkordfolge, wahlweise mit treibender Figur. Gibt die Länge zurück. */
  const prog = (list: Progression, t: number, beat: number, vol = 0.04, figure = 0) => {
    let x = t
    for (const [c, beats] of list) {
      k.chord(c, x, beats * beat + 0.25, vol)
      if (figure) k.ostinato(c, x, beats, beat, figure)
      x += beats * beat
    }
    return x - t
  }

  /** Spannung: pochender Bass in Moll unter dunklen Streichern. */
  const tension = (t: number, until: number, bpm = 120, vol = 0.035) => {
    const beat = 60 / bpm
    for (let x = t, i = 0; x < until - 0.1; x += beat * 4, i++) {
      const c = TENSION_CHORDS[i % 4]
      k.chord(c, x, Math.min(beat * 4, until - x) + 0.2, vol, false)
      for (let b = 0; b < 8 && x + (b * beat) / 2 < until; b++) k.bass(c[0] + 12, x + (b * beat) / 2, beat * 0.42, vol * 2.4)
    }
  }

  /** Das Thema in voller Besetzung. */
  const theme = (part: 'A' | 'B', t: number, beat: number, level = 1, figure = 0.04) => {
    const [melody, chords] = part === 'A' ? [THEME_A, THEME_A_CHORDS] : [THEME_B, THEME_B_CHORDS]
    prog(chords, t, beat, 0.045 * level, figure * level)
    k.line((n, x, d) => k.brass(n, x, d, 0.085 * level), melody, t, beat)
    k.line((n, x, d) => k.strings(n + 12, x, d, 0.028 * level), melody, t, beat)
    let x = t
    for (const [c, beats] of chords) {
      k.timpani(x, 0.28 * level, drum(c))
      x += beats * beat
    }
    return x - t
  }

  /** Akzent zum Titel: Auflösung, offene Frage oder Bedrohung. */
  const sting = (t: number) => {
    if (film.tone === 'good') {
      k.chord(CHORD.D, t, 3.4, 0.05)
      ;[-7, -3, 0].forEach((n, i) => k.brass(n, t + i * 0.14, 0.2, 0.07))
      k.brass(5, t + 0.42, 1.8, 0.08)
      ;[5, 9, 12, 17].forEach((n, i) => k.bell(n, t + 0.42 + i * 0.16, 0.035))
      k.timpani(t, 0.28)
      k.cymbal(t + 0.42, 0.05)
    } else if (film.tone === 'warn') {
      k.chord(CHORD.Bm, t, 3.2, 0.045)
      ;[-10, -7, -3].forEach((n, i) => k.pluck(n + 12, t + i * 0.2, 0.07, 0.8))
      k.timpani(t, 0.18, -22)
    } else {
      k.chord(CHORD.Dm, t, 3.8, 0.055)
      k.brass(-19, t, 2.2, 0.07)
      k.brass(-12, t, 2.2, 0.05)
      k.timpani(t, 0.34)
      k.timpani(t + 0.35, 0.24)
      k.noise(t, 1.6, { kind: 'brown', freq: 300, to: 70, vol: 0.3, release: 1.2 })
    }
  }

  return { prog, tension, theme, sting }
}

/**
 * Plant die Klänge eines Films ein. `base` ist die Zeit des Filmbeginns im Audiokontext,
 * `from` die Sekunde, ab der gespielt wird (wer später dazukommt, hört nur den Rest).
 */
export function scheduleFilm(
  ac: BaseAudioContext,
  out: AudioNode,
  film: Film,
  base: number,
  from: number,
  stingAt: number,
  reduced = false,
): AudioScheduledSourceNode[] {
  const k = createKit(ac, out, base, from)
  const { prog, tension, theme, sting } = helpers(k, film)

  if (reduced) {
    sting(0)
    return k.sources
  }

  switch (film.scene) {
    case 'intro': {
      // Paukenwirbel steigert sich bis zum Titel, dann das Thema als Fanfare.
      ;[0, 0.6, 1.1, 1.5, 1.8, 2.05, 2.25, 2.38].forEach((t, i) => k.timpani(t, 0.08 + i * 0.03))
      k.strings(-31, 0, 2.7, 0.05)
      k.strings(-19, 0, 2.7, 0.04)
      k.riser(1.2, 1.3, 0.04)
      k.cymbal(2.5, 0.06)
      theme('A', 2.5, 0.4, 1, 0)
      break
    }
    case 'prep': {
      // Aufbruch: treibende Figur, Marschtrommel und das Thema in den Bläsern.
      const beat = 60 / 126
      k.chord(CHORD.D, 0, 4 * beat + 0.25, 0.03)
      k.ostinato(CHORD.D, 0, 4, beat, 0.05)
      k.cymbal(4 * beat, 0.035)
      theme('A', 4 * beat, beat, 0.9, 0.05)
      for (let bar = 0; bar < 5; bar++) for (const b of [0, 1, 1.5, 2, 3, 3.5]) k.snare((bar * 4 + b) * beat, 0.022 + bar * 0.006)
      k.noise(1, 7, { filter: 'bandpass', freq: 900, vol: 0.012, attack: 1, release: 2 })
      break
    }
    case 'control': {
      // Erwartungsvoll: ruhige Figur, vor jeder Durchsage ein Funkton.
      prog([[CHORD.D, 4], [CHORD.G, 4], [CHORD.Bm, 4], [CHORD.A, 4], [CHORD.D, 4], [CHORD.G, 4], [CHORD.A, 3]], 0, 0.6, 0.035, 0.03)
      for (const t of [1.1, 5.9]) {
        k.tone(660, t, 0.1, { vol: 0.05 })
        k.noise(t + 0.1, 0.35, { filter: 'bandpass', freq: 700, vol: 0.02, release: 0.3 })
      }
      break
    }
    case 'launch': {
      // Countdown über einer anschwellenden Dominante, dann die Triebwerke und das Thema.
      k.strings(-24, 0, 6.2, 0.03)
      k.strings(-12, 0, 6.2, 0.03)
      k.chord(CHORD.A, 5.6, IGNITION - 5.4, 0.05)
      COUNTDOWN.forEach((_, i) => {
        const t = countdownAt(i)
        k.tone(660, t, 0.12, { vol: 0.045 })
        k.timpani(t, 0.08 + i * 0.03, -24)
      })
      k.riser(8.6, 3, 0.06)
      // Zündung: tiefes Grollen, Prasseln und ein Bass, den man eher spürt als hört.
      k.cymbal(IGNITION, 0.07, 2.5)
      k.thump(IGNITION, 0.5)
      k.noise(IGNITION, 10, { kind: 'brown', freq: 90, to: 420, vol: 0.5, attack: 0.6, release: 7 })
      k.noise(IGNITION, 6, { filter: 'bandpass', freq: 500, to: 1200, q: 0.6, vol: 0.05, attack: 0.4, release: 4.5 })
      k.crackle(IGNITION + 0.2, 7, { vol: 0.12, freq: 1500, attack: 0.3, release: 5 })
      k.tone(38, IGNITION, 8, { to: 55, vol: 0.22, attack: 0.5, release: 5 })
      // Der Schlusston des Themas fällt auf den Titel.
      const beat = 60 / 132
      theme('B', stingAt - 12 * beat, beat)
      k.cymbal(stingAt, 0.07)
      k.chord(CHORD.D, stingAt, 24 - stingAt, 0.045)
      k.brass(5, stingAt, 3.4, 0.07)
      ;[5, 9, 12, 17, 12, 9].forEach((n, i) => k.bell(n, stingAt + 0.3 + i * 0.3, 0.035))
      break
    }
    case 'impact': {
      k.chord(CHORD.D, 0, 1.4, 0.03)
      k.siren(1, 8.2)
      tension(5.2, 16, 120)
      for (let i = 0; i < 16; i++) k.whoosh(8.3 + i * 0.36, 0.8, 0.08)
      for (const t of IMPACT_HITS) {
        k.thump(t)
        k.timpani(t, 0.2)
      }
      k.noise(15.4, 3, { filter: 'bandpass', freq: 1000, vol: 0.03, attack: 0.3, release: 2 })
      sting(stingAt)
      break
    }
    case 'repair': {
      // Mit jedem Teil steigt die Tonleiter.
      const scale = [-7, -5, -3, -2, 0, 2, 4, 5, 7, 9, 10, 12, 14, 17]
      scale.forEach((n, i) => {
        k.noise(0.5 + i * 0.32, 0.1, { filter: 'bandpass', freq: 1400, vol: 0.05 })
        k.pluck(n, 0.5 + i * 0.32, 0.06)
      })
      k.chord(CHORD.G, 0, 3, 0.03)
      k.chord(CHORD.A, 2.8, stingAt - 2.7, 0.035)
      sting(stingAt)
      break
    }
    case 'storm': {
      k.chord(CHORD.D, 0, 3, 0.03)
      // Der Ausbruch rollt heran, dann knistert es auf der Hülle.
      k.noise(2.6, 7.6, { kind: 'brown', freq: 120, to: 500, vol: 0.4, attack: 2, release: 2.5 })
      k.tone(42, 2.6, 7.6, { to: 60, vol: 0.14, attack: 2, release: 2.5 })
      for (const t of [4.9, 5.9, 7]) k.thump(t, 0.45)
      k.crackle(4.9, 4.6, { vol: 0.12, freq: 1800 })
      tension(4.9, STORM_INSIDE, 126)
      // Im Schiff: Die Server brummen, dann der Stromstoß und ein Rack nach dem anderen fällt aus.
      k.tone(60, STORM_INSIDE, STORM_SURGE - STORM_INSIDE, { type: 'triangle', vol: 0.1, attack: 0.3, release: 0.05 })
      k.tone(120, STORM_INSIDE, STORM_SURGE - STORM_INSIDE, { vol: 0.04, attack: 0.3, release: 0.05 })
      k.thump(STORM_SURGE, 0.55)
      k.noise(STORM_SURGE, 0.9, { freq: 900, to: 160, vol: 0.22, release: 0.7 })
      ;[-9, -12, -16, -19, -24].forEach((n, i) => k.tone(note(n), STORM_SURGE + 0.4 + i * 0.45, 0.32, { type: 'triangle', vol: 0.1 }))
      k.crackle(STORM_SURGE + 0.2, 5, { vol: 0.07, freq: 1200, release: 2 })
      tension(STORM_SURGE, stingAt, 100, 0.03)
      sting(stingAt)
      break
    }
    case 'asteroids':
      tension(0.2, stingAt, 132)
      for (const t of [1.4, 3.2, 4.9, 6.3, 8.4]) k.whoosh(t, 1.1, 0.1)
      sting(stingAt)
      k.crackle(10.6, 1.3, { vol: 0.12, freq: 1300, rate: 60 })
      break
    case 'dish':
      prog([[CHORD.D, 4], [CHORD.G, 4]], 0, 0.55, 0.03, 0.035)
      k.noise(1, 3.4, { kind: 'brown', freq: 240, to: 500, vol: 0.1, attack: 1, release: 1 })
      for (const t of [4.6, 5.5, 6.4, 7.3]) k.tone(784, t, 0.14, { vol: 0.04 })
      k.chord(CHORD.Dm, 4.4, 4.2, 0.04)
      k.whoosh(7.7, 0.75, 0.12)
      k.thump(DISH_HIT, 0.55)
      k.noise(DISH_HIT, 1.6, { freq: 900, to: 140, vol: 0.2, release: 1.3 })
      k.crackle(9, 1, { vol: 0.06 })
      sting(stingAt)
      break
    case 'signal':
      ;[0, 0.14, 0.28, 0.6, 0.74, 1.05, 1.5, 1.64, 2].forEach((t) => k.tone(620, t + 0.2, 0.08, { vol: 0.045 }))
      ;[5, 9, 12, 14, 17].forEach((n, i) => k.bell(n, 1.2 + i * 0.8, 0.055))
      k.chord(CHORD.G, 0, 3, 0.03)
      k.chord(CHORD.A, 2.8, stingAt - 2.7, 0.035)
      sting(stingAt)
      break
    case 'overload': {
      prog([[CHORD.D, 4], [CHORD.G, 4]], 0, 0.6, 0.03, 0.03)
      // Die Last steigt: Das Brummen wird höher, die Warntöne kommen immer schneller.
      k.tone(55, 5, 8.5, { type: 'triangle', to: 165, vol: 0.12, attack: 1, release: 0.2 })
      k.tone(110, 5, 8.5, { to: 330, vol: 0.06, attack: 1, release: 0.2 })
      k.noise(5, 8.5, { kind: 'brown', freq: 180, to: 700, vol: 0.2, attack: 3, release: 0.2 })
      for (let t = 5.4, step = 1; t < 13.3; t += step, step = Math.max(0.24, step * 0.86)) k.tone(587, t, 0.08, { type: 'triangle', vol: 0.045 })
      tension(8, stingAt, 132, 0.03)
      k.thump(13.5, 0.55)
      k.siren(13.5, 19, 0.04)
      sting(stingAt)
      break
    }
    case 'reactor':
      k.tone(160, 0, 5.8, { type: 'triangle', to: 55, vol: 0.08, attack: 0.5, release: 1 })
      k.noise(0, 5.8, { kind: 'brown', freq: 500, to: 120, vol: 0.1, attack: 0.5, release: 1 })
      k.chord(CHORD.A, 0, stingAt + 0.1, 0.035)
      sting(stingAt)
      break
    case 'restart':
      k.tone(55, 0, 5.8, { type: 'triangle', to: 110, vol: 0.07, attack: 0.5, release: 1 })
      prog([[CHORD.D, 4], [CHORD.G, 4], [CHORD.A, 2]], 0, stingAt / 10, 0.035, 0.03)
      sting(stingAt)
      break
    case 'bridge':
      prog([[CHORD.D, 4], [CHORD.G, 4]], 0, 0.575, 0.03)
      k.chord(CHORD.Dm, 4.6, 4.9, 0.03, false)
      k.chord(CHORD.Gm, 9.2, stingAt - 9.1, 0.035, false)
      // Herzschlag, der immer schneller wird, dazu die Warnung der Anzeigen.
      for (let t = 5, step = 1.1; t < 17; t += step, step = Math.max(0.55, step * 0.95)) {
        k.timpani(t, 0.2)
        k.timpani(t + 0.2, 0.12)
      }
      for (let t = 5.4; t < 12; t += 1.6) k.tone(587, t, 0.12, { type: 'triangle', vol: 0.04 })
      sting(stingAt)
      break
    case 'landing': {
      // Bremsschub über einer Dominante, die sich beim Aufsetzen in die Feier auflöst.
      k.noise(0, TOUCHDOWN, { kind: 'brown', freq: 600, to: 200, vol: 0.28, attack: 1, release: 0.25 })
      k.crackle(0.5, TOUCHDOWN - 0.5, { vol: 0.06, freq: 1200, release: 0.3 })
      k.tone(70, 0, TOUCHDOWN, { to: 42, vol: 0.12, attack: 1, release: 0.2 })
      k.chord(CHORD.A, 0, TOUCHDOWN + 0.2, 0.035)
      k.chord(CHORD.A, 4, TOUCHDOWN - 3.8, 0.03, false)
      k.riser(TOUCHDOWN - 2.5, 2.5, 0.05)
      k.thump(TOUCHDOWN, 0.6)
      k.noise(TOUCHDOWN, 2.4, { kind: 'brown', freq: 700, to: 150, vol: 0.14, release: 1.8 })
      // Feier: das Thema zweimal, beim zweiten Mal mit Glocken und Becken.
      const beat = 0.39
      const pass = 16 * beat
      for (const [i, t] of [stingAt, stingAt + pass].entries()) {
        k.cymbal(t, 0.08, 2.5)
        theme('B', t, beat, 1.05, 0.05)
        for (let bar = 0; bar < 4; bar++) for (const b of [1, 3, 3.5]) k.snare(t + (bar * 4 + b) * beat, 0.04)
        if (i === 1) for (let b = 0; b < 16; b++) k.bell([17, 21, 24, 21][b % 4], t + b * beat, 0.03, 1)
      }
      k.cymbal(stingAt + pass + 12 * beat, 0.09, 3)
      break
    }
    case 'failure':
      k.chord(CHORD.Dm, 0, stingAt + 0.3, 0.04)
      for (let t = 0.4; t < stingAt; t += 0.7) k.tone(294, t, 0.3, { type: 'triangle', vol: 0.08 })
      sting(stingAt)
      break
    case 'credits': {
      // Ruhige Reprise des ganzen Themas mit Glocken.
      const beat = 60 / 84
      for (const [i, part] of ([[THEME_A, THEME_A_CHORDS], [THEME_B, THEME_B_CHORDS]] as const).entries()) {
        const t = 0.6 + i * 16 * beat
        prog(part[1], t, beat, 0.035, 0.03)
        k.line((n, x, d) => k.bell(n + 12, x, 0.05, Math.max(1.4, d)), part[0], t, beat)
        k.line((n, x, d) => k.strings(n, x, d, 0.02), part[0], t, beat)
      }
      break
    }
  }
  return k.sources
}

/** Länge eines Durchlaufs der Grundmusik in Sekunden. */
export const AMBIENT_SECONDS = (60 / 66) * 16

/** Ein Durchlauf der leisen Grundmusik, die läuft, bis die Spielleitung freigibt. */
export function scheduleAmbient(ac: BaseAudioContext, out: AudioNode, film: Film, base: number, index: number): AudioScheduledSourceNode[] {
  const k = createKit(ac, out, base)
  const bar = AMBIENT_SECONDS / 4
  const chords = film.tone === 'good' ? [CHORD.D, CHORD.G, CHORD.Bm, CHORD.A] : film.tone === 'warn' ? [CHORD.Bm, CHORD.G, CHORD.Em, CHORD.A] : TENSION_CHORDS
  chords.forEach((c, i) => {
    k.chord(c, i * bar, bar + 0.9, 0.017)
    if (film.tone === 'bad') {
      k.timpani(i * bar, 0.05)
      k.timpani(i * bar + 0.3, 0.03)
    }
  })
  if (film.tone !== 'bad') (index % 2 ? [0, 2, -2, 0] : [5, 9, 7, 4]).forEach((n, i) => k.bell(n + (film.tone === 'good' ? 12 : 0), i * bar + 0.02, 0.016, 2.4))
  if (film.scene === 'landing') chords.forEach((c, i) => k.ostinato(c, i * bar, 4, bar / 4, 0.014))
  return k.sources
}

type Bed = { kind: 'white' | 'brown'; filter: BiquadFilterType; freq: number; q: number; vol: number }
const ENGINE: Bed = { kind: 'brown', filter: 'lowpass', freq: 220, q: 0.7, vol: 0.1 }
const HUM: Bed = { kind: 'brown', filter: 'bandpass', freq: 110, q: 5, vol: 0.12 }
const WIND: Bed = { kind: 'white', filter: 'bandpass', freq: 420, q: 0.6, vol: 0.018 }
/** Dauergeräusch unter dem Wartebild: Triebwerk, Maschinenbrummen oder Wind. */
const BEDS: Partial<Record<Cutscene['scene'], Bed>> = {
  intro: WIND, prep: WIND, landing: WIND, credits: WIND,
  launch: ENGINE, impact: ENGINE, repair: ENGINE, asteroids: ENGINE, dish: ENGINE, signal: ENGINE, restart: ENGINE,
  storm: HUM, overload: HUM, reactor: HUM, bridge: { ...HUM, vol: 0.05 }, control: { ...HUM, vol: 0.04 },
}

// Die Stummschaltung gilt nur für dieses Gerät. Die Lautstärke regelt jede Person am Betriebssystem.
const MUTE_KEY = 'krisenuebung.stumm'
/** Fester Pegel, auf den die Filmmischung abgestimmt ist. */
const LEVEL = 0.7

function read<T>(key: string, parse: (raw: string | null) => T, fallback: T) {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return fallback
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ohne Speicher gilt die Einstellung nur bis zum Neuladen.
  }
}

const inBrowser = typeof window !== 'undefined'
let muted = inBrowser ? read(MUTE_KEY, (raw) => raw === '1', false) : false
const listeners = new Set<() => void>()
let context: AudioContext | null = null
let master: GainNode | null = null
const waiting = new Set<() => void>()

export const isMuted = () => muted
export const subscribeSound = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const subscribeMuted = subscribeSound

function applyLevel() {
  if (context && master) master.gain.setTargetAtTime(muted ? 0 : LEVEL, context.currentTime, 0.02)
  listeners.forEach((l) => l())
}

export function setMuted(value: boolean) {
  muted = value
  store(MUTE_KEY, value ? '1' : '0')
  applyLevel()
}

function audio() {
  if (!context && typeof AudioContext !== 'undefined') {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = muted ? 0 : LEVEL
    master.connect(context.createDynamicsCompressor()).connect(context.destination)
    context.onstatechange = () => {
      if (context?.state !== 'running') return
      const starts = [...waiting]
      waiting.clear()
      starts.forEach((start) => start())
    }
  }
  return context
}

// Browser erlauben Ton erst nach einer Bedienung. Der erste Klick im Spiel schaltet ihn frei.
if (inBrowser) {
  const unlock = () => { void audio()?.resume().catch(() => undefined) }
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  window.addEventListener('keydown', unlock, { capture: true, passive: true })
}

/** Startet, sobald der Ton freigeschaltet ist. Gibt eine Funktion zum Abbrechen zurück. */
function whenRunning(start: () => void) {
  if (audio()?.state === 'running') start()
  else waiting.add(start)
  return () => { waiting.delete(start) }
}

function fadeOut(bus: GainNode, sources: AudioScheduledSourceNode[], seconds = 0.08) {
  const ac = context
  if (!ac) return
  bus.gain.setTargetAtTime(0, ac.currentTime, seconds)
  const stopAt = ac.currentTime + seconds * 6
  for (const s of sources) {
    try {
      s.stop(stopAt)
    } catch {
      // Bereits beendet.
    }
  }
  setTimeout(() => bus.disconnect(), seconds * 6000 + 200)
}

/** Spielt die Klänge eines Films und gibt eine Funktion zum Beenden zurück. */
export function playFilm(film: Cutscene, elapsedSeconds: () => number, stingAt: number, reduced: boolean) {
  let bus: GainNode | null = null
  let sources: AudioScheduledSourceNode[] = []
  const cancel = whenRunning(() => {
    const ac = context
    if (!ac || !master) return
    bus = ac.createGain()
    bus.connect(master)
    const from = reduced ? 0 : Math.max(0, elapsedSeconds())
    sources = scheduleFilm(ac, bus, film, ac.currentTime + 0.05 - from, from, stingAt, reduced)
  })
  return () => {
    cancel()
    if (bus) fadeOut(bus, sources, 0.25)
  }
}

/** Leise Grundmusik und Dauergeräusch unter dem Wartebild. Läuft, bis die zurückgegebene Funktion sie beendet. */
export function playAmbient(film: Film) {
  let bus: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let blocks: AudioScheduledSourceNode[][] = []
  const cancel = whenRunning(() => {
    const ac = context
    if (!ac || !master) return
    const out = ac.createGain()
    out.gain.setValueAtTime(0, ac.currentTime)
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5)
    out.connect(master)
    bus = out

    const bed = BEDS[film.scene]
    if (bed) {
      const k = createKit(ac, out, ac.currentTime)
      // Praktisch endlos: Das Geräusch endet erst mit der Freigabe.
      k.noise(0, 86_400, { kind: bed.kind, filter: bed.filter, freq: bed.freq, q: bed.q, vol: bed.vol, attack: 2 })
      blocks.push(k.sources)
    }
    let next = ac.currentTime + 0.3
    let index = 0
    const fill = () => {
      while (next < ac.currentTime + 4) {
        blocks.push(scheduleAmbient(ac, out, film, next, index++))
        next += AMBIENT_SECONDS
      }
      // Ausgeklungene Durchläufe vergessen, das Dauergeräusch bleibt.
      if (blocks.length > 4) blocks = [blocks[0], ...blocks.slice(-3)]
    }
    fill()
    timer = setInterval(fill, 1000)
  })
  return () => {
    cancel()
    clearInterval(timer)
    if (bus) fadeOut(bus, blocks.flat(), 0.3)
  }
}

const SAMPLE_BEAT = 60 / 126

/** Musiktest: spielt das Thema einmal an. Muss aus einem Klick heraus aufgerufen werden. */
export function playSample(onEnd: () => void) {
  const ac = audio()
  if (!ac || !master) {
    onEnd()
    return () => undefined
  }
  void ac.resume().catch(() => undefined)
  const bus = ac.createGain()
  bus.connect(master)
  let sources: AudioScheduledSourceNode[] = []
  const cancel = whenRunning(() => {
    const k = createKit(ac, bus, ac.currentTime + 0.08)
    const seconds = helpers(k, { scene: 'intro', tone: 'good' }).theme('B', 0, SAMPLE_BEAT)
    k.cymbal(0, 0.05)
    k.chord(CHORD.D, seconds - 4 * SAMPLE_BEAT, 4 * SAMPLE_BEAT + 1.2, 0.04)
    sources = k.sources
  })
  const timer = setTimeout(onEnd, (16 * SAMPLE_BEAT + 1.4) * 1000)
  return () => {
    cancel()
    clearTimeout(timer)
    fadeOut(bus, sources, 0.1)
  }
}
