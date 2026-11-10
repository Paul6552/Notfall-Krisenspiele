/** Instrumente und Geräusche für die Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */

/** Halbtöne ab A4 (440 Hz). E2 = −29, E3 = −17, E4 = −5, E5 = 7. */
export const note = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12)

type NoiseKind = 'white' | 'brown'
const buffers = new WeakMap<BaseAudioContext, Partial<Record<NoiseKind | 'hall', AudioBuffer>>>()

function cached(ac: BaseAudioContext, kind: NoiseKind | 'hall', make: () => AudioBuffer) {
  let set = buffers.get(ac)
  if (!set) buffers.set(ac, (set = {}))
  return (set[kind] ??= make())
}

function noiseBuffer(ac: BaseAudioContext, kind: NoiseKind) {
  return cached(ac, kind, () => {
    const buffer = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      if (kind === 'white') data[i] = white
      else {
        // Braunes Rauschen: tiefes Grollen statt Zischen.
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
    return buffer
  })
}

/** Verzerrerkennlinie für die Gitarre: weich begrenzt wie ein Röhrenverstärker. */
const curves = new WeakMap<BaseAudioContext, Float32Array<ArrayBuffer>>()
function driveCurve(ac: BaseAudioContext) {
  let curve = curves.get(ac)
  if (!curve) {
    curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 6) / Math.tanh(6)
    }
    curves.set(ac, curve)
  }
  return curve
}

/** Raumklang: abklingendes Rauschen als Impulsantwort. */
function hallBuffer(ac: BaseAudioContext) {
  return cached(ac, 'hall', () => {
    const seconds = 2.4
    const buffer = ac.createBuffer(2, Math.floor(ac.sampleRate * seconds), ac.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2.6
    }
    return buffer
  })
}

interface Shape {
  vol?: number
  attack?: number
  release?: number
}

export type Kit = ReturnType<typeof createKit>

/**
 * Baut die Instrumente für einen Film. `base` ist die Zeit des Filmbeginns im Audiokontext,
 * `from` die Sekunde, ab der gespielt wird (wer später dazukommt, hört nur den Rest).
 */
export function createKit(ac: BaseAudioContext, out: AudioNode, base: number, from = 0) {
  const sources: AudioScheduledSourceNode[] = []

  // Geräusche gehen trocken hinaus, Musik bekommt Hall und wird in den Höhen weich gehalten.
  const fx = ac.createGain()
  fx.connect(out)
  const music = ac.createBiquadFilter()
  music.type = 'lowpass'
  music.frequency.value = 11000
  music.connect(out)
  const hall = ac.createConvolver()
  hall.buffer = hallBuffer(ac)
  const hallLevel = ac.createGain()
  hallLevel.gain.value = 0.14
  music.connect(hall).connect(hallLevel).connect(out)

  const keep = <T extends AudioScheduledSourceNode>(src: T, at: number, end: number) => {
    src.start(at)
    src.stop(end + 0.05)
    sources.push(src)
    return src
  }

  /** Gehaltener Klang: weicher Ansatz, klingt zum Ende aus. Läuft der Film schon, setzt er mittendrin ein. */
  const sustain = (dest: AudioNode, t: number, d: number, { vol = 0.2, attack = 0.01, release = 0.08 }: Shape) => {
    if (t + d <= from) return null
    const at = base + Math.max(t, from)
    const end = base + t + d
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(vol, Math.min(at + attack, end))
    gain.gain.setValueAtTime(vol, Math.max(at + attack, end - release))
    gain.gain.linearRampToValueAtTime(0, end)
    gain.connect(dest)
    return { at, end, gain }
  }

  /** Angeschlagener Klang: sofort da, klingt von selbst ab. Verpasste Anschläge entfallen. */
  const struck = (dest: AudioNode, t: number, d: number, vol: number) => {
    if (t < from) return null
    const at = base + t
    const end = at + d
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(vol, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0005, end)
    gain.connect(dest)
    return { at, end, gain }
  }

  const osc = (dest: AudioNode, type: OscillatorType, freq: number, at: number, end: number, detune = 0) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    o.detune.value = detune
    o.connect(dest)
    return keep(o, at, end)
  }

  const lowpass = (dest: AudioNode, freq: number, q = 0.7) => {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    f.Q.value = q
    f.connect(dest)
    return f
  }

  // ---------- Geräusche ----------

  const tone = (freq: number, t: number, d: number, o: Shape & { type?: OscillatorType; to?: number } = {}) => {
    const e = sustain(fx, t, d, o)
    if (!e) return
    const src = osc(e.gain, o.type ?? 'sine', freq, e.at, e.end)
    if (o.to) src.frequency.exponentialRampToValueAtTime(o.to, e.end)
  }

  const noise = (t: number, d: number, o: Shape & { kind?: NoiseKind; filter?: BiquadFilterType; freq?: number; to?: number; q?: number } = {}) => {
    const e = sustain(fx, t, d, o)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, o.kind ?? 'white')
    src.loop = true
    const filter = ac.createBiquadFilter()
    filter.type = o.filter ?? 'lowpass'
    filter.Q.value = o.q ?? 1
    filter.frequency.setValueAtTime(o.freq ?? 800, e.at)
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, e.end)
    src.connect(filter).connect(e.gain)
    keep(src, e.at, e.end)
  }

  /** Knistern und Prasseln: Rauschen, dessen Lautstärke unregelmäßig flackert. */
  const crackle = (t: number, d: number, o: Shape & { freq?: number; rate?: number } = {}) => {
    const e = sustain(fx, t, d, o)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 'white')
    src.loop = true
    const band = ac.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = o.freq ?? 1400
    band.Q.value = 0.8
    const flicker = ac.createGain()
    flicker.gain.value = 0.35
    const wobbleSrc = ac.createBufferSource()
    wobbleSrc.buffer = noiseBuffer(ac, 'white')
    wobbleSrc.loop = true
    wobbleSrc.playbackRate.value = 0.37
    const wobble = ac.createBiquadFilter()
    wobble.type = 'lowpass'
    wobble.frequency.value = o.rate ?? 28
    const depth = ac.createGain()
    depth.gain.value = 5
    wobbleSrc.connect(wobble).connect(depth).connect(flicker.gain)
    src.connect(band).connect(flicker).connect(e.gain)
    keep(src, e.at, e.end)
    keep(wobbleSrc, e.at, e.end)
  }

  const thump = (t: number, vol = 0.5) => {
    tone(110, t, 0.4, { to: 36, vol, release: 0.3 })
    noise(t, 0.2, { kind: 'brown', freq: 500, vol: vol * 0.5, release: 0.16 })
  }

  /** Vorbeiflug: Rauschen, das heranzieht und abfällt. */
  const whoosh = (t: number, d = 1.1, vol = 0.1) => noise(t, d, { filter: 'bandpass', freq: 900, to: 200, q: 1.5, vol, attack: d * 0.35, release: d * 0.5 })

  /** Zweiton-Alarm, bewusst weich gefiltert. */
  const siren = (t: number, until: number, vol = 0.03) => {
    for (let x = t; x < until; x += 1.5) {
      tone(330, x, 0.75, { type: 'triangle', to: 494, vol, attack: 0.04, release: 0.05 })
      tone(494, x + 0.75, 0.75, { type: 'triangle', to: 330, vol, attack: 0.04, release: 0.05 })
    }
  }

  // ---------- Instrumente ----------
  // Rock/Pop: verzerrte Gitarre, kräftiger Bass, Schlagzeug, dazu eine Leadstimme und etwas Keyboard.

  /** Gitarrenverstärker: Verzerrer, dann eine Box, die Bässe und schrille Höhen beschneidet. */
  const amp = (dest: AudioNode, bright = 3400) => {
    const pre = ac.createGain()
    pre.gain.value = 2.2
    const shaper = ac.createWaveShaper()
    shaper.curve = driveCurve(ac)
    shaper.oversample = '2x'
    const low = ac.createBiquadFilter()
    low.type = 'highpass'
    low.frequency.value = 90
    const body = ac.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 900
    body.gain.value = 3
    const cab = lowpass(dest, bright, 0.9)
    pre.connect(shaper).connect(low).connect(body).connect(cab)
    return pre
  }

  /**
   * Powerchord: Grundton, Quinte und Oktave über den Verzerrer.
   * `mute` spielt ihn kurz und gedämpft (Palm-Mute) für treibende Achtel.
   */
  const guitar = (n: number, t: number, d: number, vol = 0.05, mute = false) => {
    const e = mute ? struck(music, t, Math.min(d, 0.22), vol) : sustain(music, t, d, { vol, attack: 0.008, release: Math.min(0.25, d / 2) })
    if (!e) return
    const input = amp(e.gain, mute ? 1500 : 3400)
    for (const [interval, detune] of [[0, -6], [7, 5], [12, 0]] as const) {
      const v = ac.createGain()
      v.gain.value = interval === 12 ? 0.18 : 0.3
      v.connect(input)
      osc(v, 'sawtooth', note(n + interval), e.at, e.end, detune)
    }
  }

  /** Leadstimme: singende, leicht verzerrte Gitarre mit Vibrato. */
  const lead = (n: number, t: number, d: number, vol = 0.045) => {
    const e = sustain(music, t, d, { vol, attack: 0.01, release: Math.min(0.15, d / 2) })
    if (!e) return
    const input = amp(e.gain, 4200)
    input.gain.value = 1.2
    const voices = [osc(input, 'sawtooth', note(n), e.at, e.end, -4), osc(input, 'square', note(n), e.at, e.end, 4)]
    if (d > 0.45) {
      const lfo = ac.createOscillator()
      lfo.frequency.value = 5.6
      const depth = ac.createGain()
      depth.gain.setValueAtTime(0, e.at)
      depth.gain.linearRampToValueAtTime(14, Math.min(e.at + 0.35, e.end))
      lfo.connect(depth)
      for (const v of voices) depth.connect(v.detune)
      keep(lfo, e.at, e.end)
    }
  }

  /** E-Bass: Sägezahn und Sinus, mit einem Filter, das beim Anschlag kurz aufgeht. Man soll ihn hören. */
  const bass = (n: number, t: number, d: number, vol = 0.14) => {
    const e = sustain(music, t, d, { vol, attack: 0.005, release: Math.min(0.06, d / 3) })
    if (!e) return
    osc(e.gain, 'sine', note(n), e.at, e.end)
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 2
    filter.frequency.setValueAtTime(1400, e.at)
    filter.frequency.exponentialRampToValueAtTime(380, Math.min(e.at + 0.18, e.end))
    filter.connect(e.gain)
    const growl = ac.createGain()
    growl.gain.value = 0.55
    growl.connect(filter)
    osc(growl, 'sawtooth', note(n), e.at, e.end)
  }

  /** Keyboard: heller E-Piano-Anschlag für Akkorde im Hintergrund. */
  const keys = (n: number, t: number, d: number, vol = 0.025) => {
    const e = struck(music, t, Math.max(0.6, d), vol)
    if (!e) return
    osc(e.gain, 'sine', note(n), e.at, e.end)
    const bell = ac.createGain()
    bell.gain.setValueAtTime(0.35, e.at)
    bell.gain.exponentialRampToValueAtTime(0.001, e.at + 0.3)
    bell.connect(e.gain)
    osc(bell, 'sine', note(n) * 3, e.at, e.end)
  }

  /** Glocke für kleine Glanzpunkte. */
  const bell = (n: number, t: number, vol = 0.03, d = 1.2) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const f = note(n)
    for (const [mult, level] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
      const part = ac.createGain()
      part.gain.value = level
      part.connect(e.gain)
      osc(part, 'sine', f * mult, e.at, e.end)
    }
  }

  // ---------- Schlagzeug ----------

  const noiseHit = (t: number, d: number, vol: number, type: BiquadFilterType, freq: number, q = 0.8) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 'white')
    src.loop = true
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    src.connect(f).connect(e.gain)
    keep(src, e.at, e.end)
  }

  /** Bassdrum mit Druck: tiefer Sinus, der schnell fällt, und ein kurzer Klick. */
  const kick = (t: number, vol = 0.32) => {
    const e = struck(music, t, 0.38, vol)
    if (!e) return
    const o = osc(e.gain, 'sine', 160, e.at, e.end)
    o.frequency.exponentialRampToValueAtTime(45, e.at + 0.1)
    noiseHit(t, 0.012, vol * 0.25, 'highpass', 3000)
  }

  /** Snare: Fell und Teppich. */
  const snare = (t: number, vol = 0.1) => {
    const e = struck(music, t, 0.14, vol * 0.6)
    if (e) {
      const o = osc(e.gain, 'triangle', 220, e.at, e.end)
      o.frequency.exponentialRampToValueAtTime(160, e.end)
    }
    noiseHit(t, 0.2, vol, 'bandpass', 2600, 0.6)
  }

  const hat = (t: number, vol = 0.025, open = false) => noiseHit(t, open ? 0.3 : 0.045, vol, 'highpass', 8000)
  const crash = (t: number, vol = 0.05, d = 1.8) => noiseHit(t, d, vol, 'highpass', 5000)
  const tom = (t: number, n: number, vol = 0.14) => {
    const e = struck(music, t, 0.3, vol)
    if (!e) return
    const o = osc(e.gain, 'sine', note(n) * 1.5, e.at, e.end)
    o.frequency.exponentialRampToValueAtTime(note(n), e.at + 0.08)
  }

  /** Trommelwirbel über die Toms vor einem Einsatz. */
  const fill = (t: number, beat: number, vol = 1) => {
    ;[-17, -17, -20, -20, -24, -24, -27, -27].forEach((n, i) => tom(t + (i * beat) / 4, n, 0.13 * vol))
  }

  /** Anschwellen vor einem Höhepunkt. */
  const riser = (t: number, d: number, vol = 0.04) => noise(t, d, { filter: 'bandpass', freq: 500, to: 6000, q: 1, vol, attack: d * 0.95, release: d * 0.04 })

  // ---------- Satz ----------

  /** Melodie aus [Halbton, Schläge]. Gibt die Länge in Sekunden zurück. */
  const line = (play: (n: number, t: number, d: number) => void, notes: readonly (readonly [number, number])[], t: number, beat: number, transpose = 0) => {
    let x = t
    for (const [n, beats] of notes) {
      play(n + transpose, x, beats * beat)
      x += beats * beat
    }
    return x - t
  }

  /** Rock-Beat: Bassdrum auf 1, „und“ von 2 und 3, Snare auf 2 und 4, Achtel-Hi-Hat. */
  const beat = (t: number, beats: number, b: number, level = 1, half = false) => {
    for (let i = 0; i < beats; i++) {
      const x = t + i * b
      if (i % 4 === 0 || i % 4 === 2) kick(x, 0.3 * level)
      if (!half && i % 4 === 1) kick(x + b / 2, 0.22 * level)
      if (half ? i % 4 === 2 : i % 2 === 1) snare(x, 0.1 * level)
      hat(x, 0.024 * level)
      hat(x + b / 2, 0.016 * level)
    }
  }

  /**
   * Begleitung einer Akkordfolge als Band: Bass in Achteln, Gitarre gedämpft in Achteln
   * oder offen angeschlagen, Keyboard leise darüber. Gibt die Länge zurück.
   */
  const band = (chords: Progression, t: number, b: number, o: { level?: number; open?: boolean; drums?: boolean; half?: boolean } = {}) => {
    const { level = 1, open = false, drums = true, half = false } = o
    let x = t
    for (const [c, beats] of chords) {
      for (let i = 0; i < beats * 2; i++) {
        const y = x + (i * b) / 2
        bass(c.root + (i % 4 === 3 ? 12 : 0), y, b * 0.46, 0.13 * level)
        if (!open) guitar(c.root + 12, y, b / 2, (i % 2 ? 0.032 : 0.042) * level, true)
      }
      if (open) guitar(c.root + 12, x, beats * b, 0.04 * level)
      for (const n of c.keys) keys(n, x, beats * b, 0.012 * level)
      if (drums) beat(x, beats, b, level, half)
      x += beats * b
    }
    return x - t
  }

  return { sources, tone, noise, crackle, thump, whoosh, siren, guitar, lead, bass, keys, bell, kick, snare, hat, crash, tom, fill, riser, line, beat, band }
}

/** Akkord: Grundton für Bass und Gitarre (tiefe Lage), dazu Keyboard-Töne in der Mitte. */
export interface Chord { root: number; keys: readonly number[] }
const chord = (root: number, keys: number[]): Chord => ({ root, keys })

// E-Dur, gitarrenfreundlich. Grundtöne in der Lage des E-Basses.
export const CHORD = {
  E: chord(-29, [-5, -1, 2]),
  B: chord(-22, [-10, -6, -3]),
  Cshm: chord(-20, [-8, -5, -1]),
  A: chord(-24, [-8, -5, 0]),
  Fshm: chord(-27, [-3, 0, 4]),
  G: chord(-26, [-10, -7, -2]),
  D: chord(-19, [-7, -3, 0]),
  C: chord(-21, [-9, -5, -2]),
} satisfies Record<string, Chord>

/** Begleitung als [Akkord, Schläge]. */
export type Progression = readonly (readonly [Chord, number])[]
type Melody = readonly (readonly [number, number])[]

/** ARES-Thema, Strophe: über E – H – Cis-Moll – A, die klassische Pop-Rock-Folge. */
export const THEME_A: Melody = [[2, 0.5], [2, 0.5], [7, 1], [6, 0.5], [7, 0.5], [9, 1], [6, 2], [4, 1], [2, 1], [4, 0.5], [4, 0.5], [7, 1], [11, 1.5], [9, 0.5], [9, 2], [7, 1], [4, 1]]
export const THEME_A_CHORDS: Progression = [[CHORD.E, 4], [CHORD.B, 4], [CHORD.Cshm, 4], [CHORD.A, 4]]
/** Refrain: steigt hoch und landet auf dem Grundton. */
export const THEME_B: Melody = [[9, 1.5], [11, 0.5], [12, 1], [9, 1], [11, 2], [7, 1], [11, 1], [9, 1], [12, 1], [11, 1], [6, 1], [9, 0.5], [7, 0.5], [7, 3]]
export const THEME_B_CHORDS: Progression = [[CHORD.A, 4], [CHORD.E, 4], [CHORD.Fshm, 2], [CHORD.B, 2], [CHORD.E, 4]]
/** Action: E – G – A – D, kerniger Rock mit Tempo. */
export const ACTION_CHORDS: Progression = [[CHORD.E, 4], [CHORD.G, 4], [CHORD.A, 4], [CHORD.D, 4]]
