/** Instrumente und Geräusche für die Filme. Alles entsteht im Browser, es gibt keine Audiodateien. */

/** Halbtöne ab A4 (440 Hz). */
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
  music.frequency.value = 5200
  music.connect(out)
  const hall = ac.createConvolver()
  hall.buffer = hallBuffer(ac)
  const hallLevel = ac.createGain()
  hallLevel.gain.value = 0.3
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
  const siren = (t: number, until: number, vol = 0.045) => {
    for (let x = t; x < until; x += 1.5) {
      tone(330, x, 0.75, { type: 'triangle', to: 494, vol, attack: 0.04, release: 0.05 })
      tone(494, x + 0.75, 0.75, { type: 'triangle', to: 330, vol, attack: 0.04, release: 0.05 })
    }
  }

  // ---------- Instrumente ----------

  /** Streicher: drei leicht verstimmte Sägezähne hinter einem Tiefpass, langsamer Ansatz. */
  const strings = (n: number, t: number, d: number, vol = 0.04, attack = Math.min(0.5, d * 0.35)) => {
    const e = sustain(music, t, d, { vol, attack, release: Math.min(0.7, d * 0.4) })
    if (!e) return
    const f = note(n)
    const filter = lowpass(e.gain, Math.min(2600, Math.max(500, f * 3.2)))
    const mix = ac.createGain()
    mix.gain.value = 0.34
    mix.connect(filter)
    for (const detune of [-9, 0, 8]) osc(mix, 'sawtooth', f, e.at, e.end, detune)
  }

  /** Blechbläser: zwei Sägezähne, deren Klang sich beim Ansatz öffnet. */
  const brass = (n: number, t: number, d: number, vol = 0.08) => {
    const e = sustain(music, t, d, { vol, attack: 0.05, release: Math.min(0.22, d / 2) })
    if (!e) return
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 1
    filter.frequency.setValueAtTime(300, e.at)
    filter.frequency.exponentialRampToValueAtTime(1500, Math.min(e.at + 0.1, e.end))
    filter.frequency.exponentialRampToValueAtTime(800, e.end)
    filter.connect(e.gain)
    const mix = ac.createGain()
    mix.gain.value = 0.5
    mix.connect(filter)
    for (const detune of [-6, 6]) osc(mix, 'sawtooth', note(n), e.at, e.end, detune)
  }

  const bass = (n: number, t: number, d: number, vol = 0.12) => {
    const e = sustain(music, t, d, { vol, attack: 0.02, release: Math.min(0.2, d / 2) })
    if (!e) return
    osc(e.gain, 'sine', note(n), e.at, e.end)
    const upper = ac.createGain()
    upper.gain.value = 0.3
    upper.connect(lowpass(e.gain, 420))
    osc(upper, 'triangle', note(n), e.at, e.end)
  }

  /** Gezupfter Ton für treibende Figuren. */
  const pluck = (n: number, t: number, vol = 0.06, d = 0.4) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3200, e.at)
    filter.frequency.exponentialRampToValueAtTime(500, e.end)
    filter.connect(e.gain)
    osc(filter, 'triangle', note(n), e.at, e.end)
    const edge = ac.createGain()
    edge.gain.value = 0.18
    edge.connect(filter)
    osc(edge, 'sawtooth', note(n), e.at, e.end)
  }

  const bell = (n: number, t: number, vol = 0.05, d = 1.6) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const f = note(n)
    for (const [mult, level] of [[1, 1], [2, 0.35], [3.01, 0.12]]) {
      const part = ac.createGain()
      part.gain.value = level
      part.connect(e.gain)
      osc(part, 'sine', f * mult, e.at, e.end)
    }
  }

  /** Pauke, gestimmt auf den Grundton. */
  const timpani = (t: number, vol = 0.3, n = -31) => {
    const e = struck(music, t, 0.7, vol)
    if (!e) return
    const o = osc(e.gain, 'sine', note(n) * 1.5, e.at, e.end)
    o.frequency.exponentialRampToValueAtTime(note(n), e.at + 0.06)
    noise(t, 0.07, { freq: 600, vol: vol * 0.25, release: 0.06 })
  }

  const snare = (t: number, vol = 0.06) => {
    const e = struck(music, t, 0.14, vol)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 'white')
    src.loop = true
    const band = ac.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1900
    band.Q.value = 0.7
    src.connect(band).connect(e.gain)
    keep(src, e.at, e.end)
  }

  const cymbal = (t: number, vol = 0.05, d = 1.8) => {
    const e = struck(music, t, d, vol)
    if (!e) return
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 'white')
    src.loop = true
    const high = ac.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 4200
    src.connect(high).connect(e.gain)
    keep(src, e.at, e.end)
  }

  /** Anschwellen vor einem Höhepunkt. */
  const riser = (t: number, d: number, vol = 0.08) => noise(t, d, { filter: 'bandpass', freq: 300, to: 2400, q: 1.2, vol, attack: d * 0.95, release: d * 0.04 })

  // ---------- Satz ----------

  /** Akkord der Streicher, der tiefste Ton zusätzlich im Bass. */
  const chord = (notes: number[], t: number, d: number, vol = 0.04, withBass = true) => {
    for (const n of notes) strings(n, t, d, vol)
    if (withBass) bass(notes[0], t, d, vol * 2.2)
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

  /** Treibende Achtelfigur über den oberen Akkordtönen. */
  const ostinato = (notes: number[], t: number, beats: number, beat: number, vol = 0.05, transpose = 12) => {
    const up = notes.slice(1)
    const pattern = [0, 1, 2, 1]
    for (let i = 0; i < beats * 2; i++) pluck(up[pattern[i % 4] % up.length] + transpose, t + i * beat * 0.5, i % 4 === 0 ? vol * 1.3 : vol, beat * 0.9)
  }

  return { sources, tone, noise, crackle, thump, whoosh, siren, strings, brass, bass, pluck, bell, timpani, snare, cymbal, riser, chord, line, ostinato }
}

// D-Dur und d-Moll, tiefster Ton zuerst.
export const CHORD = {
  D: [-31, -19, -12, -7, -3],
  G: [-26, -14, -10, -7, -2],
  A: [-24, -12, -8, -5, 0],
  Bm: [-22, -15, -10, -7, -3],
  Em: [-29, -17, -14, -10, -5],
  Dm: [-31, -19, -16, -12, -7],
  Bb: [-35, -23, -16, -11, -7],
  Gm: [-26, -14, -11, -7, -2],
  C: [-33, -21, -17, -14, -9],
} satisfies Record<string, number[]>

/** ARES-Thema, erster Teil: öffnet sich und bleibt auf der Dominante stehen. Vier Takte. */
export const THEME_A: readonly (readonly [number, number])[] = [[-7, 1.5], [-7, 0.5], [0, 2], [2, 1.5], [0, 0.5], [-3, 2], [-2, 1], [0, 1], [2, 1], [5, 1], [4, 3], [0, 1]]
/** Begleitung als [Akkord, Schläge]. */
export type Progression = readonly (readonly [number[], number])[]
export const THEME_A_CHORDS: Progression = [[CHORD.D, 4], [CHORD.Bm, 4], [CHORD.G, 4], [CHORD.A, 4]]
/** Zweiter Teil: steigt höher und kommt zu Hause an. Vier Takte. */
export const THEME_B: readonly (readonly [number, number])[] = [[5, 1.5], [5, 0.5], [9, 2], [7, 1.5], [5, 0.5], [2, 2], [-2, 1], [2, 1], [0, 1], [4, 1], [5, 4]]
export const THEME_B_CHORDS: Progression = [[CHORD.D, 4], [CHORD.Em, 4], [CHORD.G, 2], [CHORD.A, 2], [CHORD.D, 4]]
/** Spannung in Moll. */
export const TENSION_CHORDS = [CHORD.Dm, CHORD.Bb, CHORD.Gm, CHORD.A]
