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
 * Rock/Pop in E-Dur: Band aus verzerrter Gitarre, E-Bass, Schlagzeug und Keyboard, darüber die Leadgitarre.
 * Gefahr klingt nach schnellem Rock, nicht nach Untergang.
 */
function helpers(k: Kit, film: Film) {
  /** Das Thema mit ganzer Band. Gibt die Länge zurück. */
  const theme = (part: 'A' | 'B', t: number, b: number, level = 1, open = part === 'B') => {
    const [melody, chords] = part === 'A' ? [THEME_A, THEME_A_CHORDS] : [THEME_B, THEME_B_CHORDS]
    const length = k.band(chords, t, b, { level, open })
    k.line((n, x, d) => k.lead(n, x, d, 0.045 * level), melody, t, b)
    return length
  }

  /** Schneller Rock bis `until`: gedämpfte Gitarre, Bass, Beat, alle vier Takte ein Becken. */
  const action = (t: number, until: number, bpm = 150, level = 1) => {
    const b = 60 / bpm
    for (let x = t, i = 0; x < until - 0.1; i++) {
      const [c, beats] = ACTION_CHORDS[i % ACTION_CHORDS.length]
      const n = Math.min(beats, Math.floor((until - x) / b + 0.01))
      if (n < 1) break
      if (i % 4 === 0) k.crash(x, 0.035 * level)
      k.band([[c, n]], x, b, { level })
      x += n * b
    }
  }

  /** Schlussakkord zum Titel. */
  const sting = (t: number) => {
    if (film.tone === 'good') {
      // Großes Rock-Finale: Wirbel, dann E-Dur offen mit Becken und Lead hoch oben.
      k.fill(t - 0.5, 0.5)
      k.crash(t, 0.06, 2.6)
      k.kick(t, 0.34)
      k.guitar(CHORD.E.root + 12, t, 3.2, 0.05)
      k.bass(CHORD.E.root, t, 3, 0.14)
      k.lead(14, t, 0.25, 0.04)
      k.lead(19, t + 0.25, 2.6, 0.045)
      for (const n of CHORD.E.keys) k.keys(n + 12, t, 3, 0.02)
    } else if (film.tone === 'warn') {
      // Offene Frage: A, dann H, gehalten. Klingt nach „Wird schon“.
      k.crash(t, 0.04)
      k.guitar(CHORD.A.root + 12, t, 1.4, 0.042)
      k.bass(CHORD.A.root, t, 1.4, 0.12)
      k.guitar(CHORD.B.root + 12, t + 1.5, 2.2, 0.042)
      k.bass(CHORD.B.root, t + 1.5, 2.2, 0.12)
      k.lead(6, t + 1.5, 2, 0.035)
      k.kick(t, 0.28)
      k.kick(t + 1.5, 0.28)
    } else {
      // Weckruf: drei harte Schläge D – D – E, dann klingt E aus. Rock statt Horror.
      for (const [i, x] of [0, 0.25, 0.6].entries()) {
        const c = i < 2 ? CHORD.D : CHORD.E
        const d = i < 2 ? 0.18 : 2.6
        k.guitar(c.root + 12, t + x, d, 0.05)
        k.bass(c.root, t + x, d, 0.14)
        k.kick(t + x, 0.34)
        k.snare(t + x, 0.1)
      }
      k.crash(t + 0.6, 0.06, 2.4)
    }
  }

  return { theme, action, sting }
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
  const { theme, action, sting } = helpers(k, film)

  if (reduced) {
    sting(0)
    return k.sources
  }

  switch (film.scene) {
    case 'intro': {
      // Gitarre allein, dann Drums und das Thema: das klassische Rock-Intro.
      const b = 60 / 140
      k.guitar(CHORD.E.root + 12, 0, 1.6, 0.045)
      k.riser(0.6, 1.1, 0.03)
      k.fill(1.7, b)
      k.crash(2.5, 0.05)
      theme('A', 2.5, b)
      break
    }
    case 'prep': {
      // Aufbruch: Bass und Beat zuerst, dann die Strophe.
      const b = 60 / 128
      k.band([[CHORD.E, 4]], 0, b, { level: 0.8 })
      k.crash(4 * b, 0.04)
      theme('A', 4 * b, b, 0.9)
      break
    }
    case 'control': {
      // Erwartungsvoll: halbes Tempo, offene Akkorde, vor jeder Durchsage ein Funkton.
      const b = 0.6
      k.band([[CHORD.E, 4], [CHORD.A, 4], [CHORD.Cshm, 4], [CHORD.B, 4], [CHORD.E, 4], [CHORD.A, 4], [CHORD.B, 3]], 0, b, { level: 0.7, open: true, half: true })
      for (const t of [1.1, 5.9]) {
        k.tone(880, t, 0.08, { vol: 0.035 })
        k.tone(1175, t + 0.1, 0.08, { vol: 0.03 })
      }
      break
    }
    case 'launch': {
      // Countdown über pochendem Bass, Zündung, dann der Refrain mit ganzer Band.
      COUNTDOWN.forEach((_, i) => {
        const t = countdownAt(i)
        k.tone(880, t, 0.1, { vol: 0.035 })
        k.kick(t, 0.12 + i * 0.025)
        k.bass(CHORD.B.root, t, 0.5, 0.06 + i * 0.01)
        if (i >= 4) k.guitar(CHORD.B.root + 12, t, 0.3, 0.025 + i * 0.003, true)
      })
      k.riser(8.6, 3, 0.04)
      k.fill(IGNITION - 0.6, 0.6)
      // Zündung: kräftig, aber kurz.
      k.crash(IGNITION, 0.06, 2.4)
      k.thump(IGNITION, 0.4)
      k.noise(IGNITION, 7, { kind: 'brown', freq: 200, to: 600, vol: 0.2, attack: 0.4, release: 5 })
      k.crackle(IGNITION + 0.2, 5, { vol: 0.05, freq: 2000, attack: 0.3, release: 4 })
      action(IGNITION, stingAt - 12 * (60 / 150) + 0.01, 150)
      theme('B', stingAt - 12 * (60 / 150), 60 / 150)
      k.crash(stingAt, 0.06, 2.6)
      k.guitar(CHORD.E.root + 12, stingAt, 24 - stingAt, 0.04)
      k.bass(CHORD.E.root, stingAt, 24 - stingAt - 1, 0.12)
      k.lead(19, stingAt, 3.4, 0.04)
      break
    }
    case 'impact':
      k.band([[CHORD.E, 2]], 0, 0.6, { level: 0.6, open: true, drums: false })
      k.siren(1, 6)
      action(4.6, stingAt, 156)
      for (let i = 0; i < 16; i++) k.whoosh(8.3 + i * 0.36, 0.8, 0.06)
      for (const t of IMPACT_HITS) k.thump(t, 0.4)
      sting(stingAt)
      break
    case 'repair': {
      // Werkstatt-Groove: Mit jedem Teil ein Ton der Leadgitarre, die Tonleiter steigt.
      const scale = [-5, -3, -1, 0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 19]
      scale.forEach((n, i) => {
        k.noise(0.5 + i * 0.32, 0.06, { filter: 'bandpass', freq: 2400, vol: 0.03 })
        k.lead(n, 0.5 + i * 0.32, 0.28, 0.03)
      })
      k.band([[CHORD.A, 4], [CHORD.B, 6]], 0.5, 0.48, { level: 0.75 })
      sting(stingAt)
      break
    }
    case 'storm': {
      k.band([[CHORD.E, 4]], 0, 0.6, { level: 0.6, open: true, half: true })
      // Der Ausbruch rauscht heran, dann knistert es auf der Hülle. Die Band legt los.
      k.noise(2.6, 6.4, { filter: 'bandpass', freq: 500, to: 2600, q: 0.7, vol: 0.07, attack: 2, release: 2 })
      for (const t of [4.9, 5.9, 7]) k.thump(t, 0.3)
      k.crackle(4.9, 4, { vol: 0.06, freq: 2400 })
      action(3, STORM_ZOOM, 150)
      // Zoom auf die ARES 1: Die Band hält einen Akkord, ein Wirbel führt ins Schiff.
      k.riser(STORM_ZOOM, STORM_INSIDE - STORM_ZOOM, 0.04)
      k.guitar(CHORD.B.root + 12, STORM_ZOOM, STORM_INSIDE - STORM_ZOOM, 0.04)
      k.bass(CHORD.B.root, STORM_ZOOM, STORM_INSIDE - STORM_ZOOM, 0.11)
      k.lead(14, STORM_ZOOM + 0.2, STORM_INSIDE - STORM_ZOOM - 0.4, 0.035)
      k.fill(STORM_INSIDE - 0.6, 0.6)
      // Im Schiff: Die Server summen, dann der Stromstoß und ein Rack nach dem anderen fällt aus.
      for (let t = STORM_INSIDE; t < STORM_SURGE; t += 0.25) k.tone(1320, t, 0.04, { vol: 0.012 })
      k.band([[CHORD.E, 4]], STORM_INSIDE, (STORM_SURGE - STORM_INSIDE) / 4, { level: 0.7, half: true })
      k.thump(STORM_SURGE, 0.4)
      k.noise(STORM_SURGE, 0.7, { freq: 2400, to: 400, vol: 0.12, release: 0.6 })
      ;[19, 16, 12, 9, 7].forEach((n, i) => k.lead(n, STORM_SURGE + 0.4 + i * 0.45, 0.35, 0.035))
      k.crackle(STORM_SURGE + 0.2, 3.5, { vol: 0.04, freq: 2200, release: 2 })
      action(STORM_SURGE + 2.6, stingAt, 144, 0.9)
      sting(stingAt)
      break
    }
    case 'asteroids':
      action(0.2, stingAt, 156)
      for (const t of [1.4, 3.2, 4.9, 6.3]) k.whoosh(t, 1, 0.07)
      sting(stingAt)
      break
    case 'dish':
      k.band([[CHORD.E, 4], [CHORD.A, 4]], 0, 0.55, { level: 0.7 })
      for (const t of [4.6, 5.5, 6.4, 7.3]) k.tone(988, t, 0.1, { vol: 0.03 })
      k.band([[CHORD.B, 6]], 4.4, 0.55, { level: 0.6, open: true, half: true })
      k.whoosh(7.7, 0.75, 0.09)
      k.thump(DISH_HIT, 0.45)
      k.noise(DISH_HIT, 1.2, { freq: 2000, to: 300, vol: 0.1, release: 1 })
      action(DISH_HIT + 0.4, stingAt, 150, 0.85)
      sting(stingAt)
      break
    case 'signal':
      ;[0, 0.14, 0.28, 0.6, 0.74, 1.05, 1.5, 1.64, 2].forEach((t) => k.tone(988, t + 0.2, 0.07, { vol: 0.03 }))
      k.band([[CHORD.A, 4], [CHORD.B, 4]], 1.2, (stingAt - 1.2) / 8, { level: 0.8 })
      ;[7, 9, 11, 14].forEach((n, i) => k.lead(n, 1.2 + i * ((stingAt - 1.2) / 4), (stingAt - 1.2) / 4, 0.035))
      sting(stingAt)
      break
    case 'overload':
      k.band([[CHORD.E, 4], [CHORD.A, 4]], 0, 0.6, { level: 0.7 })
      // Die Last steigt: Ein Ton klettert, die Warntöne kommen immer schneller, die Band zieht das Tempo an.
      k.tone(220, 5, 8.5, { type: 'triangle', to: 660, vol: 0.035, attack: 1, release: 0.2 })
      for (let t = 5.4, step = 1; t < 13.3; t += step, step = Math.max(0.24, step * 0.86)) k.tone(1175, t, 0.06, { vol: 0.03 })
      action(8, stingAt, 160, 0.9)
      k.thump(13.5, 0.4)
      k.siren(13.5, 17)
      sting(stingAt)
      break
    case 'reactor':
      k.tone(330, 0, 5.8, { type: 'triangle', to: 165, vol: 0.03, attack: 0.5, release: 1 })
      k.band([[CHORD.A, 4], [CHORD.B, 4]], 0, stingAt / 8, { level: 0.7, half: true })
      sting(stingAt)
      break
    case 'restart':
      k.tone(165, 0, 5.8, { type: 'triangle', to: 330, vol: 0.03, attack: 0.5, release: 1 })
      k.band([[CHORD.E, 4], [CHORD.A, 4], [CHORD.B, 2]], 0, stingAt / 10, { level: 0.8 })
      sting(stingAt)
      break
    case 'bridge':
      k.band([[CHORD.E, 4], [CHORD.A, 4]], 0, 0.575, { level: 0.6, open: true, half: true })
      // Nervöse Crew: Die Warnung der Anzeigen, dann zieht die Band an.
      for (let t = 5.4; t < 12; t += 1.6) k.tone(1175, t, 0.08, { vol: 0.025 })
      action(4.6, stingAt, 144, 0.8)
      sting(stingAt)
      break
    case 'landing': {
      // Bremsschub über gedämpften Achteln, beim Aufsetzen explodiert der Refrain.
      k.noise(0, TOUCHDOWN, { filter: 'bandpass', freq: 900, to: 400, q: 0.6, vol: 0.06, attack: 1, release: 0.25 })
      k.crackle(0.5, TOUCHDOWN - 0.5, { vol: 0.03, freq: 2000, release: 0.3 })
      k.band([[CHORD.B, 12]], 0.4, (TOUCHDOWN - 0.9) / 12, { level: 0.7 })
      k.riser(TOUCHDOWN - 2.5, 2.5, 0.04)
      k.fill(TOUCHDOWN - 0.5, 0.5)
      k.thump(TOUCHDOWN, 0.45)
      // Feier: der Refrain zweimal, beim zweiten Mal mit Glocken obendrauf.
      const b = 0.39
      const pass = 16 * b
      for (const [i, t] of [stingAt, stingAt + pass].entries()) {
        k.crash(t, 0.06, 2.2)
        theme('B', t, b, 1.05)
        if (i === 1) for (let x = 0; x < 16; x++) k.bell([19, 23, 26, 31][x % 4], t + x * b, 0.016, 0.6)
      }
      k.crash(stingAt + pass + 12 * b, 0.07, 2.6)
      break
    }
    case 'failure':
      // Ernst, aber nicht trostlos: ruhige Gitarre, dann der Weckruf.
      k.band([[CHORD.Cshm, 2], [CHORD.A, 3]], 0, stingAt / 5, { level: 0.6, open: true, drums: false })
      sting(stingAt)
      break
    case 'credits': {
      // Abspann als lockere Rock-Ballade: halbes Tempo, offene Gitarre, das ganze Thema.
      const b = 60 / 88
      k.crash(0.6, 0.04)
      for (const [i, part] of ([[THEME_A, THEME_A_CHORDS], [THEME_B, THEME_B_CHORDS]] as const).entries()) {
        const t = 0.6 + i * 16 * b
        k.band(part[1], t, b, { level: 0.75, open: true, half: true })
        k.line((n, x, d) => k.lead(n, x, d, 0.035), part[0], t, b)
      }
      break
    }
  }
  return k.sources
}

/** Länge eines Durchlaufs der Musik im Wartebild in Sekunden. */
export const AMBIENT_SECONDS = (60 / 96) * 16

/** Ein Durchlauf der leisen Musik im Wartebild: lockerer Groove mit Bass und offener Gitarre. */
export function scheduleAmbient(ac: BaseAudioContext, out: AudioNode, film: Film, base: number, index: number): AudioScheduledSourceNode[] {
  const k = createKit(ac, out, base)
  const b = AMBIENT_SECONDS / 16
  const chords: Progression = film.tone === 'bad'
    ? [[CHORD.E, 4], [CHORD.G, 4], [CHORD.A, 4], [CHORD.D, 4]]
    : [[CHORD.E, 4], [CHORD.B, 4], [CHORD.Cshm, 4], [CHORD.A, 4]]
  k.band(chords, 0, b, { level: 0.4, open: true, half: true })
  if (index % 2) [11, 9, 7, 4].forEach((n, i) => k.lead(n, i * 4 * b + 2 * b, 1.5 * b, 0.015))
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

const SAMPLE_BEAT = 60 / 132

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
    // Musiktest: der Refrain mit ganzer Band und Schlussakkord.
    const seconds = helpers(k, { scene: 'intro', tone: 'good' }).theme('B', 0, SAMPLE_BEAT)
    k.crash(0, 0.05)
    k.crash(seconds, 0.05, 1.4)
    k.guitar(CHORD.E.root + 12, seconds, 1.2, 0.04)
    k.bass(CHORD.E.root, seconds, 1.2, 0.12)
    sources = k.sources
  })
  const timer = setTimeout(onEnd, (16 * SAMPLE_BEAT + 1.6) * 1000)
  return () => {
    cancel()
    clearTimeout(timer)
    fadeOut(bus, sources, 0.1)
  }
}
