/** Musik und Klänge der Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */
import type { Cutscene } from '../game/types'
import { ACTION_CHORDS, CHORD, THEME_A, THEME_A_CHORDS, THEME_B, THEME_B_CHORDS, createKit } from './music'
import type { Kit, Progression } from './music'

/** Treffer der Mikrometeoriten in Sekunden, passend zum Bild. */
export const IMPACT_HITS = [12.6, 13.4, 14.1, 14.8, 15.3]

/** Einschlag in die Satellitenschüssel in Sekunden, passend zum Bild. */
export const DISH_HIT = 8.4

/** Ionensturm: Zoom auf die ARES 1, Schnitt in den Serverraum und Stromstoß, passend zum Bild. */
export const STORM_ZOOM = 8.6
export const STORM_INSIDE = 11.8
export const STORM_SURGE = 13.8

/** Aufsetzen auf dem Mars in Sekunden, passend zum Bild. */
export const TOUCHDOWN = 8.6

/** Countdown des Starts in Sekunden, passend zum Bild. */
export const COUNTDOWN = [8, 7, 6, 5, 4, 3, 2, 1]
export const COUNTDOWN_STEP = 1.4
export const countdownAt = (i: number) => 0.4 + i * COUNTDOWN_STEP
const IGNITION = 11.6

type Film = Pick<Cutscene, 'scene' | 'tone'>

/**
 * Die Musik ist durchgehend hell: C-Dur, Flächen, Arpeggien, Glockenspiel und ein leichter Rhythmus.
 * Gefahr klingt nach Abenteuer und Tempo, nicht nach Dunkelheit.
 */
function helpers(k: Kit, film: Film) {
  /** Akkordfolge als Fläche, wahlweise mit Arpeggio. Gibt die Länge zurück. */
  const prog = (list: Progression, t: number, beat: number, vol = 0.028, arp = 0) => {
    let x = t
    for (const [c, beats] of list) {
      k.chord(c, x, beats * beat + 0.2, vol)
      if (arp) k.arp(c, x, beats, beat, arp)
      x += beats * beat
    }
    return x - t
  }

  /** Aufregung mit Zuversicht: schnelle Achtel, pumpender Bass, Rhythmus. Läuft bis `until`. */
  const action = (t: number, until: number, bpm = 132, level = 1) => {
    const beat = 60 / bpm
    for (let x = t, i = 0; x < until - 0.1; x += beat * 4, i++) {
      const c = ACTION_CHORDS[i % 4]
      const len = Math.min(beat * 4, until - x)
      k.chord(c, x, len + 0.15, 0.022 * level, false)
      for (let b = 0; b < 8 && x + (b * beat) / 2 < until; b++) {
        k.bass(c[0] + (b % 2 ? 12 : 0), x + (b * beat) / 2, beat * 0.4, 0.07 * level)
        k.pluck(c[1 + (b % 4)] + 12, x + (b * beat) / 2, 0.03 * level, beat * 0.45)
      }
      k.groove(x, Math.min(4, Math.floor(len / beat + 0.01)), beat, 0.8 * level)
    }
  }

  /** Das Thema in voller Besetzung. */
  const theme = (part: 'A' | 'B', t: number, beat: number, level = 1, arp = 0.035, drums = true) => {
    const [melody, chords] = part === 'A' ? [THEME_A, THEME_A_CHORDS] : [THEME_B, THEME_B_CHORDS]
    const length = prog(chords, t, beat, 0.026 * level, arp * level)
    k.line((n, x, d) => k.lead(n, x, d, 0.055 * level), melody, t, beat)
    k.line((n, x, d) => k.bell(n + 12, x, 0.018 * level, Math.max(0.8, d)), melody, t, beat)
    if (drums) k.groove(t, Math.round(length / beat), beat, 0.9 * level)
    return length
  }

  /** Akzent zum Titel. Auch schlechte Nachrichten enden mit einem Klang, der nach „Wir schaffen das“ klingt. */
  const sting = (t: number) => {
    if (film.tone === 'good') {
      k.chord(CHORD.C, t, 3.2, 0.035)
      ;[3, 7, 10].forEach((n, i) => k.lead(n, t + i * 0.12, 0.16, 0.05))
      k.lead(15, t + 0.36, 1.8, 0.055)
      ;[15, 19, 22, 27].forEach((n, i) => k.bell(n, t + 0.36 + i * 0.14, 0.03))
      k.timpani(t, 0.2)
      k.cymbal(t + 0.36, 0.04)
    } else if (film.tone === 'warn') {
      // Offene Frage: Fadd9 nach Gsus, ohne Auflösung, aber freundlich.
      k.chord(CHORD.Fadd9, t, 1.6, 0.032)
      k.chord(CHORD.Gsus, t + 1.5, 2.2, 0.032)
      ;[0, 3, 7, 10].forEach((n, i) => k.marimba(n + 12, t + i * 0.18, 0.05))
      k.bell(15, t + 1.5, 0.03, 2)
    } else {
      // Weckruf: zwei kräftige Schläge auf B-Dur, dann C-Dur. Klingt nach Aufbruch, nicht nach Untergang.
      for (const [i, c] of [CHORD.Bb, CHORD.Bb, CHORD.C].entries()) {
        const x = t + [0, 0.22, 0.6][i]
        const d = i < 2 ? 0.16 : 2.6
        for (const n of c.slice(2)) k.lead(n, x, d, 0.035)
        k.bass(c[0], x, d, 0.12)
        k.timpani(x, 0.24, c[0] + 12)
      }
      k.cymbal(t + 0.6, 0.05, 2)
      k.chord(CHORD.C, t + 0.6, 2.8, 0.025, false)
    }
  }

  return { prog, action, theme, sting }
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
  const { prog, action, theme, sting } = helpers(k, film)

  if (reduced) {
    sting(0)
    return k.sources
  }

  switch (film.scene) {
    case 'intro': {
      // Glitzernder Anlauf bis zum Titel, dann das Thema.
      ;[3, 7, 10, 15, 19, 22, 27].forEach((n, i) => k.bell(n, 0.3 + i * 0.3, 0.03))
      k.chord(CHORD.Cadd9, 0, 2.6, 0.022)
      k.riser(1, 1.5, 0.03)
      k.cymbal(2.5, 0.04)
      theme('A', 2.5, 0.42, 1, 0.03)
      break
    }
    case 'prep': {
      // Aufbruchstimmung: Arpeggio, dann das Thema mit Rhythmus.
      const beat = 60 / 120
      k.chord(CHORD.C, 0, 4 * beat + 0.2, 0.022)
      k.arp(CHORD.C, 0, 4, beat, 0.035)
      k.cymbal(4 * beat, 0.03)
      theme('A', 4 * beat, beat, 0.9, 0.035)
      break
    }
    case 'control': {
      // Erwartungsvoll und freundlich: Marimba-Puls, vor jeder Durchsage ein Funkton.
      const beat = 0.6
      prog([[CHORD.C, 4], [CHORD.F, 4], [CHORD.Am, 4], [CHORD.G, 4], [CHORD.C, 4], [CHORD.F, 4], [CHORD.Gsus, 3]], 0, beat, 0.022)
      for (let b = 0; b < 27; b++) k.marimba([3, 7, 10, 7][b % 4] + (b % 8 < 4 ? 0 : 2), b * beat, 0.03)
      for (const t of [1.1, 5.9]) {
        k.tone(880, t, 0.08, { vol: 0.035 })
        k.tone(1175, t + 0.1, 0.08, { vol: 0.03 })
      }
      break
    }
    case 'launch': {
      // Countdown über einer wachsenden Dominante, Zündung, dann das Thema in voller Pracht.
      k.chord(CHORD.Gsus, 0, IGNITION, 0.02)
      COUNTDOWN.forEach((_, i) => {
        const t = countdownAt(i)
        k.tone(880, t, 0.1, { vol: 0.035 })
        k.marimba(-2 + i, t, 0.035)
        k.kick(t, 0.06 + i * 0.02)
      })
      k.riser(8.6, 3, 0.04)
      // Zündung: kräftig, aber kurz. Das Triebwerk rauscht hell statt zu grollen.
      k.cymbal(IGNITION, 0.06, 2.4)
      k.thump(IGNITION, 0.4)
      k.noise(IGNITION, 7, { kind: 'brown', freq: 200, to: 600, vol: 0.22, attack: 0.4, release: 5 })
      k.noise(IGNITION, 6, { filter: 'bandpass', freq: 900, to: 2000, q: 0.6, vol: 0.04, attack: 0.3, release: 4.5 })
      k.crackle(IGNITION + 0.2, 5, { vol: 0.06, freq: 2000, attack: 0.3, release: 4 })
      // Der Schlusston des Themas fällt auf den Titel.
      const beat = 60 / 132
      theme('B', stingAt - 12 * beat, beat)
      k.cymbal(stingAt, 0.05)
      k.chord(CHORD.C, stingAt, 24 - stingAt, 0.03)
      ;[15, 19, 22, 27, 22, 19].forEach((n, i) => k.bell(n, stingAt + 0.3 + i * 0.3, 0.028))
      break
    }
    case 'impact': {
      k.chord(CHORD.C, 0, 1.4, 0.022)
      k.siren(1, 6)
      action(4.6, stingAt, 138)
      for (let i = 0; i < 16; i++) k.whoosh(8.3 + i * 0.36, 0.8, 0.06)
      for (const t of IMPACT_HITS) {
        k.thump(t, 0.4)
        k.timpani(t, 0.14)
      }
      sting(stingAt)
      break
    }
    case 'repair': {
      // Mit jedem Teil steigt die Tonleiter.
      const scale = [-9, -7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12, 15]
      scale.forEach((n, i) => {
        k.noise(0.5 + i * 0.32, 0.06, { filter: 'bandpass', freq: 2400, vol: 0.03 })
        k.marimba(n + 12, 0.5 + i * 0.32, 0.045)
      })
      k.chord(CHORD.F, 0, 2.9, 0.022)
      k.chord(CHORD.G, 2.8, stingAt - 2.7, 0.025)
      k.groove(0.5, 10, 0.5, 0.6)
      sting(stingAt)
      break
    }
    case 'storm': {
      k.chord(CHORD.C, 0, 2.8, 0.022)
      // Der Ausbruch rauscht heran, dann knistert es auf der Hülle. Die Musik zieht das Tempo an.
      k.noise(2.6, 6.4, { filter: 'bandpass', freq: 500, to: 2600, q: 0.7, vol: 0.08, attack: 2, release: 2 })
      for (const t of [4.9, 5.9, 7]) k.thump(t, 0.3)
      k.crackle(4.9, 4, { vol: 0.07, freq: 2400 })
      action(3, STORM_ZOOM, 132)
      // Zoom auf die ARES 1: aufsteigendes Glockenspiel lenkt den Blick aufs Schiff.
      k.riser(STORM_ZOOM, STORM_INSIDE - STORM_ZOOM, 0.04)
      ;[3, 7, 10, 15, 19].forEach((n, i) => k.bell(n, STORM_ZOOM + 0.3 + i * 0.5, 0.032))
      k.chord(CHORD.Gsus, STORM_ZOOM, STORM_INSIDE - STORM_ZOOM + 0.2, 0.024)
      // Im Schiff: Die Server summen, dann der Stromstoß und ein Rack nach dem anderen fällt aus.
      k.tone(240, STORM_INSIDE, STORM_SURGE - STORM_INSIDE, { type: 'triangle', vol: 0.03, attack: 0.3, release: 0.05 })
      for (let t = STORM_INSIDE; t < STORM_SURGE; t += 0.25) k.tone(1320, t, 0.04, { vol: 0.012 })
      k.thump(STORM_SURGE, 0.4)
      k.noise(STORM_SURGE, 0.7, { freq: 2400, to: 400, vol: 0.12, release: 0.6 })
      ;[15, 12, 8, 5, 3].forEach((n, i) => k.marimba(n, STORM_SURGE + 0.4 + i * 0.45, 0.05))
      k.crackle(STORM_SURGE + 0.2, 3.5, { vol: 0.04, freq: 2200, release: 2 })
      action(STORM_SURGE + 2.6, stingAt, 120, 0.8)
      sting(stingAt)
      break
    }
    case 'asteroids':
      action(0.2, stingAt, 138)
      for (const t of [1.4, 3.2, 4.9, 6.3]) k.whoosh(t, 1, 0.07)
      sting(stingAt)
      break
    case 'dish':
      prog([[CHORD.C, 4], [CHORD.F, 4]], 0, 0.55, 0.022, 0.03)
      for (const t of [4.6, 5.5, 6.4, 7.3]) k.tone(988, t, 0.1, { vol: 0.03 })
      k.chord(CHORD.Gsus, 4.4, 4.1, 0.025)
      k.whoosh(7.7, 0.75, 0.09)
      k.thump(DISH_HIT, 0.45)
      k.noise(DISH_HIT, 1.2, { freq: 2000, to: 300, vol: 0.1, release: 1 })
      action(DISH_HIT + 0.4, stingAt, 132, 0.8)
      sting(stingAt)
      break
    case 'signal':
      ;[0, 0.14, 0.28, 0.6, 0.74, 1.05, 1.5, 1.64, 2].forEach((t) => k.tone(988, t + 0.2, 0.07, { vol: 0.03 }))
      ;[3, 7, 10, 12, 15].forEach((n, i) => k.bell(n + 12, 1.2 + i * 0.7, 0.04))
      k.chord(CHORD.F, 0, 2.9, 0.022)
      k.chord(CHORD.G, 2.8, stingAt - 2.7, 0.025)
      k.arp(CHORD.G, 2.8, Math.floor((stingAt - 2.8) / 0.5), 0.5, 0.03)
      sting(stingAt)
      break
    case 'overload': {
      prog([[CHORD.C, 4], [CHORD.F, 4]], 0, 0.6, 0.022, 0.03)
      // Die Last steigt: Ein Ton klettert, die Warntöne kommen immer schneller, die Musik zieht mit.
      k.tone(220, 5, 8.5, { type: 'triangle', to: 660, vol: 0.04, attack: 1, release: 0.2 })
      for (let t = 5.4, step = 1; t < 13.3; t += step, step = Math.max(0.24, step * 0.86)) k.tone(1175, t, 0.06, { vol: 0.03 })
      action(8, stingAt, 144, 0.9)
      k.thump(13.5, 0.4)
      k.siren(13.5, 17)
      sting(stingAt)
      break
    }
    case 'reactor':
      k.tone(330, 0, 5.8, { type: 'triangle', to: 165, vol: 0.03, attack: 0.5, release: 1 })
      prog([[CHORD.F, 4], [CHORD.G, 4]], 0, stingAt / 8, 0.024, 0.03)
      sting(stingAt)
      break
    case 'restart':
      k.tone(165, 0, 5.8, { type: 'triangle', to: 330, vol: 0.03, attack: 0.5, release: 1 })
      prog([[CHORD.C, 4], [CHORD.F, 4], [CHORD.G, 2]], 0, stingAt / 10, 0.025, 0.035)
      k.groove(0, 10, stingAt / 10, 0.6)
      sting(stingAt)
      break
    case 'bridge':
      prog([[CHORD.C, 4], [CHORD.F, 4]], 0, 0.575, 0.022)
      // Herzklopfen der Crew als leiser Puls, dazu die Warnung der Anzeigen. Die Musik bleibt zuversichtlich.
      for (let t = 4.6, step = 0.6; t < 12.4; t += step, step = Math.max(0.42, step * 0.97)) k.kick(t, 0.12)
      for (let t = 5.4; t < 12; t += 1.6) k.tone(1175, t, 0.08, { vol: 0.025 })
      action(4.6, stingAt, 126, 0.7)
      sting(stingAt)
      break
    case 'landing': {
      // Bremsschub über einer Spannung, die sich beim Aufsetzen in die Feier auflöst.
      k.noise(0, TOUCHDOWN, { filter: 'bandpass', freq: 900, to: 400, q: 0.6, vol: 0.07, attack: 1, release: 0.25 })
      k.crackle(0.5, TOUCHDOWN - 0.5, { vol: 0.03, freq: 2000, release: 0.3 })
      k.chord(CHORD.Gsus, 0, 4.1, 0.024)
      k.chord(CHORD.G, 4, TOUCHDOWN - 3.8, 0.026)
      k.arp(CHORD.G, 4, Math.floor((TOUCHDOWN - 4) / 0.42), 0.42, 0.03)
      k.riser(TOUCHDOWN - 2.5, 2.5, 0.04)
      k.thump(TOUCHDOWN, 0.45)
      // Feier: das Thema zweimal, beim zweiten Mal mit mehr Glanz.
      const beat = 0.39
      const pass = 16 * beat
      for (const [i, t] of [stingAt, stingAt + pass].entries()) {
        k.cymbal(t, 0.06, 2.2)
        theme('B', t, beat, 1.05, 0.04)
        if (i === 1) for (let b = 0; b < 32; b++) k.bell([15, 19, 22, 27][b % 4] + 12, t + (b * beat) / 2, 0.016, 0.6)
      }
      k.cymbal(stingAt + pass + 12 * beat, 0.07, 2.6)
      break
    }
    case 'failure':
      // Ernst, aber nicht trostlos: ruhige Fläche, dann der Weckruf.
      k.chord(CHORD.Am, 0, 1.3, 0.024)
      k.chord(CHORD.F, 1.2, stingAt - 1.1, 0.024)
      for (let t = 0.4; t < stingAt; t += 0.6) k.marimba(3, t, 0.035)
      sting(stingAt)
      break
    case 'credits': {
      // Ruhige, warme Fassung des ganzen Themas mit Glockenspiel und Marimba.
      const beat = 60 / 88
      for (const [i, part] of ([[THEME_A, THEME_A_CHORDS], [THEME_B, THEME_B_CHORDS]] as const).entries()) {
        const t = 0.6 + i * 16 * beat
        prog(part[1], t, beat, 0.024, 0.026)
        k.line((n, x, d) => k.bell(n + 12, x, 0.04, Math.max(1.2, d)), part[0], t, beat)
        k.line((n, x, d) => k.marimba(n, x, 0.03, Math.max(0.5, d)), part[0], t, beat)
      }
      break
    }
  }
  return k.sources
}

/** Länge eines Durchlaufs der Grundmusik in Sekunden. */
export const AMBIENT_SECONDS = (60 / 72) * 16

/** Ein Durchlauf der leisen, hellen Grundmusik, die läuft, bis die Spielleitung freigibt. */
export function scheduleAmbient(ac: BaseAudioContext, out: AudioNode, film: Film, base: number, index: number): AudioScheduledSourceNode[] {
  const k = createKit(ac, out, base)
  const bar = AMBIENT_SECONDS / 4
  const beat = bar / 4
  const chords = film.tone === 'good' ? [CHORD.C, CHORD.F, CHORD.Am, CHORD.G] : film.tone === 'warn' ? [CHORD.F, CHORD.C, CHORD.G, CHORD.Am] : [CHORD.Am, CHORD.F, CHORD.C, CHORD.G]
  chords.forEach((c, i) => {
    k.chord(c, i * bar, bar + 0.6, 0.014)
    // Leises Marimba-Arpeggio in Vierteln hält die Musik in Bewegung.
    for (let b = 0; b < 4; b++) k.marimba(c[1 + ((b + index) % 4)] + 12, i * bar + b * beat, 0.018)
    if (film.tone === 'bad') k.kick(i * bar, 0.05)
  })
  ;(index % 2 ? [3, 7, 5, 2] : [10, 8, 12, 7]).forEach((n, i) => k.bell(n + 12, i * bar + beat * 2, 0.012, 2))
  return k.sources
}

type Bed = { kind: 'white' | 'brown'; filter: BiquadFilterType; freq: number; q: number; vol: number }
// Das Dauergeräusch bleibt leise im Hintergrund, damit das Wartebild nicht bedrückend wirkt.
const ENGINE: Bed = { kind: 'brown', filter: 'bandpass', freq: 380, q: 0.8, vol: 0.04 }
const HUM: Bed = { kind: 'brown', filter: 'bandpass', freq: 240, q: 4, vol: 0.03 }
const WIND: Bed = { kind: 'white', filter: 'bandpass', freq: 900, q: 0.6, vol: 0.01 }
/** Dauergeräusch unter dem Wartebild: Triebwerk, Maschinensummen oder Wind. */
const BEDS: Partial<Record<Cutscene['scene'], Bed>> = {
  intro: WIND, prep: WIND, landing: WIND, credits: WIND,
  launch: ENGINE, impact: ENGINE, repair: ENGINE, asteroids: ENGINE, dish: ENGINE, signal: ENGINE, restart: ENGINE,
  storm: HUM, overload: HUM, reactor: HUM, bridge: { ...HUM, vol: 0.015 }, control: { ...HUM, vol: 0.015 },
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
    k.cymbal(0, 0.04)
    k.chord(CHORD.C, seconds - 4 * SAMPLE_BEAT, 4 * SAMPLE_BEAT + 1.2, 0.03)
    sources = k.sources
  })
  const timer = setTimeout(onEnd, (16 * SAMPLE_BEAT + 1.4) * 1000)
  return () => {
    cancel()
    clearTimeout(timer)
    fadeOut(bus, sources, 0.1)
  }
}
