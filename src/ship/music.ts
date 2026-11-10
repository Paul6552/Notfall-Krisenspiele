/** Instrumente und Geräusche für die Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */

/** Halbtöne ab A4 (440 Hz). C5 = 3, C4 = −9, C3 = −21. */
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
  music.frequency.value = 9000
  music.connect(out)
  const hall = ac.createConvolver()
  hall.buffer = hallBuffer(ac)
  const hallLevel = ac.createGain()
  hallLevel.gain.value = 0.2
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
  // Hell und luftig: Flächen, gezupfte Töne, Glockenspiel und ein leichtes Schlagzeug. Keine tiefen Dröhnklänge.

  /** Fläche: drei leicht verstimmte Sägezähne, offen gefiltert, weicher Ansatz. */
  const pad = (n: number, t: number, d: number, vol = 0.03, attack = Math.min(0.35, d * 0.3)) => {
    const e = sustain(music, t, d, { vol, attack, release: Math.min(0.6, d * 0.4) })
    if (!e) return
    const f = note(n)
    const filter = lowpass(e.gain, Math.min(5200, Math.max(1400, f * 5)))
    const mix = ac.createGain()
    mix.gain.value = 0.3
    mix.connect(filter)
    for (const detune of [-8, 0, 7]) osc(mix, 'sawtooth', f, e.at, e.end, detune)
  }

  /** Melodiestimme: hornartig, öffnet sich hell beim Ansatz, mit leichtem Vibrato. */
  const lead = (n: number, t: number, d: number, vol = 0.06) => {
    const e = sustain(music, t, d, { vol, attack: 0.03, release: Math.min(0.18, d / 2) })
    if (!e) return
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.8
    filter.frequency.setValueAtTime(900, e.at)
    filter.frequency.exponentialRampToValueAtTime(3600, Math.min(e.at + 0.08, e.end))
    filter.frequency.exponentialRampToValueAtTime(2200, e.end)
    filter.connect(e.gain)
    const mix = ac.createGain()
    mix.gain.value = 0.4
    mix.connect(filter)
    const voices = [osc(mix, 'sawtooth', note(n), e.at, e.end, -5), osc(mix, 'square', note(n), e.at, e.end, 5)]
    if (d > 0.5) {
      const lfo = ac.createOscillator()
      lfo.frequency.value = 5.2
      const depth = ac.createGain()
      depth.gain.setValueAtTime(0, e.at)
      depth.gain.linearRampToValueAtTime(9, Math.min(e.at + 0.4, e.end))
      lfo.connect(depth)
      for (const v of voices) depth.connect(v.detune)
      keep(lfo, e.at, e.end)
    }
  }

  const bass = (n: number, t: number, d: number, vol = 0.1) => {
    const e = sustain(music, t, d, { vol, attack: 0.01, release: Math.min(0.12, d / 2) })
    if (!e) return
    osc(e.gain, 'sine', note(n), e.at, e.end)
    const upper = ac.createGain()
    upper.gain.value = 0.35
    upper.connect(lowpass(e.gain, 900))
    osc(upper, 'triangle', note(n), e.at, e.end)
  }

  /** Marimba: weicher Schlag mit schnell verklingendem Oberton. */
  const marimba = (n: number, t: number, vol = 0.05, d = 0.6) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    osc(e.gain, 'sine', note(n), e.at, e.end)
    const tick = ac.createGain()
    tick.gain.setValueAtTime(0.5, e.at)
    tick.gain.exponentialRampToValueAtTime(0.001, e.at + 0.08)
    tick.connect(e.gain)
    osc(tick, 'sine', note(n) * 4, e.at, e.end)
  }

  /** Gezupfter, heller Ton für Arpeggien. */
  const pluck = (n: number, t: number, vol = 0.045, d = 0.35) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(5000, e.at)
    filter.frequency.exponentialRampToValueAtTime(900, e.end)
    filter.connect(e.gain)
    osc(filter, 'triangle', note(n), e.at, e.end)
    const edge = ac.createGain()
    edge.gain.value = 0.25
    edge.connect(filter)
    osc(edge, 'square', note(n), e.at, e.end)
  }

  /** Glockenspiel. */
  const bell = (n: number, t: number, vol = 0.04, d = 1.4) => {
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

  /** Weiche Bassdrum. */
  const kick = (t: number, vol = 0.22) => {
    const e = struck(music, t, 0.32, vol)
    if (!e) return
    const o = osc(e.gain, 'sine', 140, e.at, e.end)
    o.frequency.exponentialRampToValueAtTime(48, e.at + 0.12)
  }

  const noiseHit = (t: number, d: number, vol: number, type: BiquadFilterType, freq: number) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 'white')
    src.loop = true
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    src.connect(f).connect(e.gain)
    keep(src, e.at, e.end)
  }
  const hat = (t: number, vol = 0.02) => noiseHit(t, 0.05, vol, 'highpass', 7500)
  const clap = (t: number, vol = 0.05) => noiseHit(t, 0.16, vol, 'bandpass', 1600)
  const cymbal = (t: number, vol = 0.04, d = 1.6) => noiseHit(t, d, vol, 'highpass', 5200)

  /** Pauke für Akzente, gestimmt auf C. */
  const timpani = (t: number, vol = 0.22, n = -21) => {
    const e = struck(music, t, 0.6, vol)
    if (!e) return
    const o = osc(e.gain, 'sine', note(n) * 1.4, e.at, e.end)
    o.frequency.exponentialRampToValueAtTime(note(n), e.at + 0.05)
  }

  /** Anschwellen vor einem Höhepunkt, hell statt grollend. */
  const riser = (t: number, d: number, vol = 0.05) => noise(t, d, { filter: 'bandpass', freq: 600, to: 5000, q: 1, vol, attack: d * 0.95, release: d * 0.04 })

  // ---------- Satz ----------

  /** Akkord als Fläche, der tiefste Ton im Bass. */
  const chord = (notes: readonly number[], t: number, d: number, vol = 0.03, withBass = true) => {
    for (const n of notes.slice(1)) pad(n, t, d, vol)
    if (withBass) bass(notes[0], t, d, vol * 3)
  }

  /** Melodie aus [Halbton, Schläge]. Gibt die Länge in Sekunden zurück. */
  const line = (play: (n: number, t: number, d: number) => void, notes: readonly (readonly [number, number])[], t: number, beat: number, transpose = 0) => {
    let x = t
    for (const [n, beats] of notes) {
      play(n + transpose, x, beats * beat)
      x += beats * beat
    }
    return x - t
  }

  /** Aufsteigendes Arpeggio in Achteln über den Akkordtönen. */
  const arp = (notes: readonly number[], t: number, beats: number, beat: number, vol = 0.04, transpose = 12) => {
    const up = notes.slice(1)
    const pattern = [0, 1, 2, 3, 2, 1, 3, 2]
    for (let i = 0; i < beats * 2; i++) pluck(up[pattern[i % 8] % up.length] + transpose, t + i * beat * 0.5, i % 2 ? vol * 0.8 : vol, beat * 0.8)
  }

  /** Leichter Rhythmus: Bassdrum auf 1 und 3, Klatschen auf 2 und 4, Achtel im Hi-Hat. */
  const groove = (t: number, beats: number, beat: number, level = 1) => {
    for (let b = 0; b < beats; b++) {
      const x = t + b * beat
      if (b % 2 === 0) kick(x, 0.2 * level)
      else clap(x, 0.04 * level)
      hat(x, 0.014 * level)
      hat(x + beat / 2, 0.02 * level)
    }
  }

  return { sources, tone, noise, crackle, thump, whoosh, siren, pad, lead, bass, marimba, pluck, bell, kick, hat, clap, cymbal, timpani, riser, chord, line, arp, groove }
}

// Helles C-Dur, tiefster Ton zuerst.
export const CHORD = {
  C: [-21, -9, -5, -2, 3],
  Cadd9: [-21, -9, -7, -2, 3],
  F: [-28, -9, -4, 0, 3],
  Fadd9: [-28, -9, -4, -2, 0],
  G: [-26, -10, -7, -2, 2],
  Gsus: [-26, -9, -7, -2, 3],
  Am: [-24, -9, -5, 0, 3],
  Em: [-29, -10, -5, -2, 2],
  Dm: [-31, -7, -4, 0, 5],
  Bb: [-23, -11, -7, -4, 1],
} satisfies Record<string, number[]>

/** Begleitung als [Akkord, Schläge]. */
export type Progression = readonly (readonly [readonly number[], number])[]
type Melody = readonly (readonly [number, number])[]

/** ARES-Thema, erster Teil: steigt auf und öffnet sich. Vier Takte über I–V–vi–IV. */
export const THEME_A: Melody = [[-2, 1], [3, 1], [7, 1.5], [5, 0.5], [5, 2], [2, 1], [-2, 1], [0, 1], [3, 1], [7, 1], [12, 1], [10, 2], [8, 1], [7, 1]]
export const THEME_A_CHORDS: Progression = [[CHORD.C, 4], [CHORD.G, 4], [CHORD.Am, 4], [CHORD.F, 4]]
/** Zweiter Teil: schwingt sich hoch und kommt strahlend zu Hause an. */
export const THEME_B: Melody = [[8, 1.5], [7, 0.5], [5, 1], [3, 1], [7, 2], [10, 2], [12, 1.5], [10, 0.5], [8, 1], [5, 1], [7, 1], [5, 0.5], [2, 0.5], [3, 2]]
export const THEME_B_CHORDS: Progression = [[CHORD.F, 4], [CHORD.C, 4], [CHORD.Dm, 2], [CHORD.G, 2], [CHORD.C, 4]]
/** Aufregung, aber zuversichtlich: vi–IV–I–V mit treibendem Puls. */
export const ACTION_CHORDS = [CHORD.Am, CHORD.F, CHORD.C, CHORD.G]
