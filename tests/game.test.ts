import { describe, expect, it } from 'vitest'
import {
  DEVICES, E3_MAP, E3_MAX_ENERGY, E3_STORM_SECTORS, E3_SENSORS, E3_THRESHOLD, LANDING_CODE, MODULES, PIECE_SPECS, PLAY_PHASES, PHASE_INFO, TOTAL_MINUTES,
} from '../src/game/content/flugZumMars'
import { shiftText } from '../src/game/cipher'
import { isEmojiOnly } from '../src/game/emoji'
import { CM_PER_UNIT, FRAME_H, FRAME_W, piecePolygon, polygonArea, shieldCoverage } from '../src/game/geometry'
import { project } from '../src/game/projection'
import { canStart, createGame, joinTeam, makeGameCode, pauseAfterHostReturn, reduce, setHostTeam, tick, totalKw } from '../src/game/reducer'
import { GM, ROLE_IDS } from '../src/game/types'
import type { Action, GameState, PieceKind, Placement } from '../src/game/types'
import { solveShield } from './solveShield'

function setup(teams: number) {
  let s = createGame({ code: 'ARES-TEST01', teamCount: teams, now: 0 })
  for (let i = 0; i < teams; i++) s = joinTeam(s, { name: `Org ${i}` }).state
  s = reduce(s, { type: 'autoAssign' }, GM, 0)
  return s
}
const owner = (s: GameState, r: keyof GameState['roleOwner']) => s.roleOwner[r]!
const toPhase = (s: GameState, phase: GameState['phase']): GameState => {
  let t = 1
  while (s.phase !== phase) s = reduce(s, { type: 'advance' }, GM, t++)
  return { ...s, failure: null }
}

describe('Rechenwerte aus der Excel', () => {
  it('Geräte ergeben 410 kW', () => expect(DEVICES.reduce((a, d) => a + d.kw, 0)).toBe(410))
  it('Gesamtdauer ist 245 Minuten', () => {
    expect(TOTAL_MINUTES).toBe(245)
    expect(PLAY_PHASES.map((p) => PHASE_INFO[p].minutes)).toEqual([10, 30, 30, 60, 10, 20, 10, 45, 30])
  })
  it('Lande-Code hat 12 Ziffern', () => expect(LANDING_CODE).toMatch(/^\d{12}$/))
  it('14 Teile ergeben zusammen 288 cm²', () => {
    const area = MODULES.reduce((a, m) => a + polygonArea(piecePolygon(m.kind, { x: 0, y: 0, rot: 0, flip: false })) * CM_PER_UNIT ** 2, 0)
    expect(area).toBe(288)
    expect(FRAME_W * FRAME_H * CM_PER_UNIT ** 2).toBe(288)
  })
  it('Maße der Teile passen zur Geometrie', () => {
    for (const kind of Object.keys(PIECE_SPECS) as PieceKind[]) {
      const pts = piecePolygon(kind, { x: 0, y: 0, rot: 0, flip: false })
      const sides = pts.map(([x, y], i) => Math.hypot(x - pts[(i + 1) % pts.length][0], y - pts[(i + 1) % pts.length][1]) * CM_PER_UNIT)
      for (const d of PIECE_SPECS[kind].dims.filter((v) => v !== 45)) expect(sides.some((l) => Math.abs(l - d) < 0.05)).toBe(true)
    }
  })
  it('Sturmsektoren passen zu den Sensorwerten', () => {
    const hot = E3_SENSORS.filter((r) => r.values.reduce((a, b) => a + b, 0) / r.values.length > E3_THRESHOLD).map((r) => r.sector)
    expect(hot).toEqual(E3_STORM_SECTORS)
  })
})

describe('Trümmerfeld', () => {
  const path = () => {
    const y0 = E3_MAP.findIndex((r) => r.includes('S'))
    const start = [E3_MAP[y0].indexOf('S'), y0]
    const seen = new Map<string, number[][]>([[start.join(), []]])
    const queue = [start]
    while (queue.length) {
      const [x, y] = queue.shift()!
      const cur = seen.get(`${x},${y}`)!
      if (E3_MAP[y][x] === 'G') return cur
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = E3_MAP[y + dy]?.[x + dx]
        if (!c || c === '#' || c === '~' || seen.has(`${x + dx},${y + dy}`)) continue
        seen.set(`${x + dx},${y + dy}`, [...cur, [dx, dy]])
        queue.push([x + dx, y + dy])
      }
    }
    return null
  }
  it('hat einen sicheren Weg innerhalb der Energiereserve', () => {
    const p = path()
    expect(p).not.toBeNull()
    expect(p!.length).toBeLessThanOrEqual(E3_MAX_ENERGY)
    expect(p!.length).toBeGreaterThan(16) // Der kürzeste Weg führt durch den Sturm und ist 16 Felder lang.
    expect(E3_MAP.every((r) => r.length === E3_MAP[0].length)).toBe(true)
  })
  it('lässt sich mit Energie von Versorgung abfliegen, ohne Treffer', () => {
    let s = toPhase(setup(6), 'e3')
    for (const [dx, dy] of path()!) {
      if (s.e3.energy === 0) s = reduce(s, { type: 'e3Energy', amount: 5 }, owner(s, 'S4'), 5)
      s = reduce(s, { type: 'e3Move', dx, dy }, owner(s, 'S3'), 5)
    }
    expect(s.e3.arrived).toBe(true)
    expect(s.e3.collisions).toBe(0)
  })
  it('verlangt Energie für jede Bewegung', () => {
    const s = toPhase(setup(6), 'e3')
    expect(() => reduce(s, { type: 'e3Move', dx: 1, dy: 0 }, owner(s, 'S3'), 5)).toThrow(/Energie/)
  })
})

describe('Hitzeschild', () => {
  it('ist mit den 14 Teilen lösbar und wird erkannt', () => {
    const solution = solveShield()
    expect(solution).not.toBeNull()
    let s = toPhase(setup(6), 'e2')
    for (const m of MODULES) {
      const spec = PIECE_SPECS[m.kind]
      s = reduce(s, { type: 'e2Build', module: m.id, shape: spec.shape, dims: spec.dims }, owner(s, m.owner), 5)
    }
    for (const m of MODULES) s = reduce(s, { type: 'e2Place', module: m.id, placement: solution![m.id] }, owner(s, 'S1'), 6)
    expect(s.e2.repaired).toBe(true)
  })
  it('lehnt falsche Maße beim Einbau ab', () => {
    let s = toPhase(setup(6), 'e2')
    const m = MODULES[0]
    s = reduce(s, { type: 'e2Build', module: m.id, shape: 'triangle', dims: [11, 8.5] }, owner(s, m.owner), 5)
    const placement: Placement = { x: 0, y: 0, rot: 0, flip: false }
    expect(() => reduce(s, { type: 'e2Place', module: m.id, placement }, owner(s, 'S1'), 6)).toThrow(/Maße/)
  })
  it('erkennt Überlappung', () => {
    const p = { x: 0, y: 0, rot: 0, flip: false }
    expect(shieldCoverage([piecePolygon('L', p), piecePolygon('L', p)]).overlaps).toBeGreaterThan(0)
  })
  it('Verschlüsselung lässt sich zurückdrehen', () => {
    const line = 'S4-1 GROSSES DREIECK BASIS 12,0 CM'
    expect(shiftText(shiftText(line, 7), -7)).toBe(line)
    expect(shiftText(line, 7)).not.toBe(line)
  })
})

describe('Lobby', () => {
  it('erzeugt eindeutig aussehende Codes', () => expect(makeGameCode()).toMatch(/^ARES-[A-Z2-9]{6}$/))
  it('startet erst, wenn alle Rollen und Teams vollständig sind', () => {
    let s = createGame({ code: 'X', teamCount: 2, now: 0 })
    s = joinTeam(s, { name: 'A' }).state
    expect(canStart(s).length).toBeGreaterThan(0)
    expect(() => reduce(s, { type: 'advance' }, GM, 1)).toThrow()
    s = joinTeam(s, { name: 'B' }).state
    s = reduce(s, { type: 'autoAssign' }, GM, 1)
    expect(canStart(s)).toEqual([])
    expect(reduce(s, { type: 'advance' }, GM, 1).phase).toBe('checkin')
  })
  it.each([2, 3, 6, 7])('verteilt alle Rollen auf %i Teams', (n) => {
    const s = setup(n)
    expect(canStart(s)).toEqual([])
    expect(new Set(ROLE_IDS.map((r) => s.roleOwner[r])).size).toBe(n)
    expect(s.roleOwner.LS).not.toBe(s.roleOwner.S6) // Sonst wäre die Bauplan-Übergabe sinnlos.
    expect(s.roleOwner.S3).not.toBe(s.roleOwner.S4) // Antrieb und Versorgung müssen sich absprechen.
  })
  it('lässt im Brücken-Modus den Spielleiter die Brücke spielen', () => {
    let s = createGame({ code: 'X', teamCount: 2, now: 0, settings: { gmMode: 'bridge' } })
    s = setHostTeam(s, 'Leitstelle')
    s = joinTeam(s, { name: 'B' }).state
    s = reduce(s, { type: 'autoAssign' }, GM, 1)
    expect(s.teams.find((t) => t.isHost)!.id).toBe(s.roleOwner.LS)
    expect(canStart(s)).toEqual([])
    expect(() => reduce(s, { type: 'assignRole', role: 'LS', teamId: s.teams[1].id }, GM, 1)).toThrow()
  })
  it('nimmt Teams über ihr Token und ihren Namen wieder auf', () => {
    let s = setup(2)
    s = reduce(s, { type: 'advance' }, GM, 1)
    const t = s.teams[0]
    expect(() => joinTeam(s, { name: 'Neu' })).toThrow()
    expect(joinTeam(s, { name: '', token: t.token }).team.id).toBe(t.id)
  })
})

describe('Kommunikationsregeln', () => {
  const chat = (text: string): Action => ({ type: 'chat', to: 'all', text })
  it('Emoji-Erkennung', () => {
    expect(isEmojiOnly('⬆️ 🚀 ❗')).toBe(true)
    expect(isEmojiOnly('3️⃣ ➡️')).toBe(true)
    expect(isEmojiOnly('links 🚀')).toBe(false)
    expect(isEmojiOnly('3')).toBe(false)
    expect(isEmojiOnly('  ')).toBe(false)
  })
  it('erzwingt Emojis in Ereignis 3', () => {
    const s = toPhase(setup(6), 'e3')
    expect(() => reduce(s, chat('Kurs links'), owner(s, 'S3'), 5)).toThrow(/Emojis/)
    expect(reduce(s, chat('⬅️'), owner(s, 'S3'), 5).chat.length).toBe(1)
  })
  it('sperrt den Hauptkanal in Ereignis 4 und öffnet den Notkanal nach der Anmeldung', () => {
    let s = toPhase(setup(6), 'e4')
    const team = owner(s, 'S3')
    expect(() => reduce(s, chat('Hallo'), team, 5)).toThrow(/ausgefallen/)
    s = reduce(s, { type: 'e4Activate' }, owner(s, 'LS'), 5)
    expect(() => reduce(s, chat('Hallo'), team, 5)).toThrow(/Notkanal/)
    s = reduce(s, { type: 'e4CheckIn' }, team, 5)
    expect(reduce(s, chat('Hallo'), team, 5).chat.at(-1)!.net).toBe('backup')
  })
  it('Nachricht in Ereignis 6 unterbricht den Neustart, Spielleitung und S5 nicht', () => {
    let s = toPhase(setup(6), 'e6')
    s = reduce(s, { type: 'e6Start' }, owner(s, 'LS'), 1000)
    s = reduce(s, { type: 'inject', text: 'Gerücht', label: 'Unbekannt', to: 'all' }, GM, 2000)
    s = reduce(s, { type: 'statement', text: 'Das stimmt nicht.' }, owner(s, 'S5'), 3000)
    expect(s.e6.interrupts).toBe(0)
    s = { ...s, e4: { ...s.e4, checkedIn: s.teams.map((t) => t.id) } }
    s = reduce(s, chat('Das ist eine Frechheit!'), owner(s, 'S4'), 4000)
    expect(s.e6.interrupts).toBe(1)
    expect(s.e6.restartStartedAt).toBe(4000)
    expect(tick(s, 4000 + 299_000).e6.done).toBe(false)
    expect(tick(s, 4000 + 300_000).e6.done).toBe(true)
  })
  it('Drei Unterbrechungen führen zum Ausfall', () => {
    let s = toPhase(setup(6), 'e6')
    s = reduce(s, { type: 'e6Start' }, owner(s, 'LS'), 1000)
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'flagViolation' }, GM, 2000)
    expect(s.failure).toMatch(/drei Unterbrechungen/)
  })
  it('sperrt den Chat bei externer Kommunikation', () => {
    let s = setup(2)
    s = reduce(s, { type: 'setSettings', settings: { comm: 'external' } }, GM, 0)
    expect(() => reduce(s, chat('Hallo'), s.teams[0].id, 1)).toThrow(/extern/)
  })
})

describe('Reaktor und Folgen', () => {
  const run = (off: string[]) => {
    let s = toPhase(setup(6), 'e5')
    for (const d of off) s = reduce(s, { type: 'e5Toggle', device: d }, owner(s, 'LS'), 5)
    return reduce(s, { type: 'advance' }, GM, 6)
  }
  const keep = (ids: string[]) => DEVICES.filter((d) => !ids.includes(d.id)).map((d) => d.id)
  it('nur die Brücke schaltet', () => {
    const s = toPhase(setup(7), 'e5')
    expect(() => reduce(s, { type: 'e5Toggle', device: 'light' }, owner(s, 'S6'), 5)).toThrow()
  })
  it('über 150 kW explodiert das Schiff', () => expect(run(['light']).failure).toMatch(/explodierte/))
  it('ohne Kühlung kommt die Kernschmelze', () => expect(run(['cooling']).failure).toMatch(/Kernschmelze/))
  it('150 kW sichern die Mission ohne Bonus', () => {
    const off = keep(['cooling', 'oxygen', 'hydro', 'water'])
    expect(totalKw(off)).toBe(150)
    const s = run(off)
    expect(s.failure).toBeNull()
    expect(s.e7.attempts).toBe(3)
  })
  it('100 kW geben den Bonus', () => {
    const off = keep(['cooling', 'preheat'])
    expect(totalKw(off)).toBeLessThanOrEqual(105)
    const s = run(keep(['cooling', 'gravity', 'light']))
    expect(totalKw(s.e5.off)).toBe(100)
    expect(s.e7.attempts).toBe(4)
  })
  it('Folgen kommen in Ereignis 7 an', () => {
    const s = run(['light', 'preheat', 'oxygen', 'damper', 'gravity', 'hydro', 'water', 'freezer', 'probe', 'robots', 'airlock'].concat(['monitor', 'coffee', 'display']))
    const v = project(s, owner(s, 'S6'))
    expect(v.flags).toEqual({ blurS6: true, oxygenRule: true, delayedS3: true, injuredS1: true })
  })
  it('Vorwärmer aus: Antrieb überträgt Zeichen einzeln mit 5 Minuten Pause', () => {
    let s = run(['preheat', 'light', 'damper', 'gravity', 'hydro', 'water', 'freezer', 'probe', 'robots', 'airlock', 'monitor', 'coffee', 'display'])
    s = { ...s, failure: null, phase: 'e7' }
    const a = owner(s, 'S3')
    expect(() => reduce(s, { type: 'e7Send', role: 'S3', code: '56' }, a, 10)).toThrow(/ein Zeichen/)
    s = reduce(s, { type: 'e7Send', role: 'S3', code: '5' }, a, 10_000)
    expect(() => reduce(s, { type: 'e7Send', role: 'S3', code: '6' }, a, 20_000)).toThrow(/Pause/)
    s = reduce(s, { type: 'e7Send', role: 'S3', code: '6' }, a, 310_000)
    expect(s.e7.sent.S3).toBe('56')
  })
})

describe('Landung', () => {
  it('Richtiger Code landet, falsche kosten Versuche', () => {
    let s = toPhase(setup(6), 'e7')
    const ls = owner(s, 'LS')
    const attempts = s.e7.attempts
    s = reduce(s, { type: 'e7Land', code: LANDING_CODE.replace(/^14/, '99') }, ls, 5)
    expect(s.e7.attempts).toBe(attempts - 1)
    expect(s.e7.lastFeedback).toMatch(/5 von 6/)
    s = reduce(s, { type: 'e7Land', code: LANDING_CODE }, ls, 6)
    expect(s.e7.landed).toBe(true)
  })
  it('Ohne Versuche stürzt das Schiff ab', () => {
    let s = toPhase(setup(6), 'e7')
    s = { ...s, ship: { ...s.ship, hull: 100 }, e7: { ...s.e7, attempts: 1 } }
    s = reduce(s, { type: 'e7Land', code: '000000000000' }, owner(s, 'LS'), 5)
    expect(s.failure).toMatch(/abgestürzt/)
  })
})

describe('Wiederaufnahme nach Ausfall der Spielleitung', () => {
  const restart = () => {
    let s = toPhase(setup(7), 'e6')
    s = reduce(s, { type: 'e6Start' }, owner(s, 'LS'), 1000)
    return { ...s, hostSeenAt: 61_000 }
  }
  it('Spiel steht ab dem letzten Lebenszeichen still', () => {
    const s = pauseAfterHostReturn(restart(), 3_600_000)
    expect(s.pausedAt).toBe(61_000)
  })
  it('Neustart gilt nach einer Stunde Ausfall nicht als geschafft und läuft mit der Restzeit weiter', () => {
    let s = pauseAfterHostReturn(restart(), 3_600_000)
    expect(tick(s, 3_600_000).e6.done).toBe(false)
    s = reduce(s, { type: 'resume' }, GM, 3_600_000)
    expect(s.pausedAt).toBeNull()
    expect(tick(s, 3_600_000).e6.done).toBe(false)
    expect(tick(s, 3_600_000 + 239_000).e6.done).toBe(false)
    expect(tick(s, 3_600_000 + 240_000).e6.done).toBe(true)
  })
  it('Phasenzeit zählt die Ausfallzeit nicht mit', () => {
    let s = pauseAfterHostReturn({ ...restart(), phaseStartedAt: 1000 }, 3_600_000)
    s = reduce(s, { type: 'resume' }, GM, 3_600_000)
    expect(3_600_000 - s.phaseStartedAt - s.pausedMs).toBe(60_000)
  })
  it('Chat während der Pause unterbricht den Neustart nicht', () => {
    let s = pauseAfterHostReturn(restart(), 3_600_000)
    s = { ...s, e4: { ...s.e4, checkedIn: s.teams.map((t) => t.id) } }
    s = reduce(s, { type: 'chat', to: 'all', text: 'Seid ihr noch da?' }, owner(s, 'S4'), 3_600_000)
    expect(s.e6.interrupts).toBe(0)
  })
  it('Bereits pausiertes Spiel, Lobby und Ende bleiben unverändert', () => {
    const paused = reduce(restart(), { type: 'pause' }, GM, 5000)
    expect(pauseAfterHostReturn(paused, 9000)).toBe(paused)
    const lobby = createGame({ code: 'X', teamCount: 2, now: 0 })
    expect(pauseAfterHostReturn(lobby, 9000)).toBe(lobby)
  })
})

describe('Rollenfilter', () => {
  const json = (s: GameState, team: string) => JSON.stringify(project(s, team))
  it('enthält nie Tokens fremder Teams', () => {
    const s = setup(3)
    for (const t of s.teams) for (const o of s.teams) expect(json(s, t.id)).not.toContain(o.token)
  })
  it('Sollwerte in Ereignis 1 nur für die Brücke', () => {
    const s = toPhase(setup(7), 'e1')
    expect(json(s, owner(s, 'LS'))).toContain('3,6 und 4,0')
    expect(json(s, owner(s, 'S3'))).not.toContain('3,6 und 4,0')
  })
  it('Bauplan im Klartext nur für die Brücke, Maschinenraum bekommt ihn verschlüsselt und ohne Schlüssel', () => {
    let s = toPhase(setup(7), 'e2')
    expect(project(s, owner(s, 'S6')).docs.e2Cipher).toBeUndefined()
    s = reduce(s, { type: 'e2SendPlan' }, owner(s, 'LS'), 5)
    const v = project(s, owner(s, 'S6'))
    expect(v.docs.e2PlanText).toBeUndefined()
    expect(v.docs.e2Cipher![0]).not.toContain('DREIECK')
    expect(v.docs.e2CipherShift).toBeUndefined()
    expect(JSON.stringify(v)).not.toContain('cipherShift')
    expect(project(s, owner(s, 'S4')).docs.e2Cipher).toBeUndefined()
  })
  it('Karte nur für die Brücke, Sturm erst nach der Analyse', () => {
    let s = toPhase(setup(7), 'e3')
    expect(project(s, owner(s, 'S3')).docs.e3Map).toBeUndefined()
    expect(project(s, owner(s, 'LS')).docs.e3Map!.join('')).not.toContain('~')
    s = reduce(s, { type: 'e3Sectors', sectors: ['D', 'B'] }, owner(s, 'S2'), 5)
    expect(project(s, owner(s, 'LS')).docs.e3Map!.join('')).toContain('~')
  })
  it('Die Brücke sieht bei Geräten nur Name und kW, Teams nur ihre eigenen', () => {
    const s = toPhase(setup(7), 'e5')
    const ls = project(s, owner(s, 'LS')).docs.e5Devices!
    expect(ls).toHaveLength(15)
    expect(ls.every((d) => d.info === undefined)).toBe(true)
    const s4 = project(s, owner(s, 'S4')).docs.e5Devices!
    expect(s4.map((d) => d.id)).toEqual(['oxygen', 'hydro', 'water'])
    expect(s4[1].info).toContain('Pflanzen')
  })
  it('Fragmente nur für die eigene Rolle, Lande-Code nur für die Spielleitung', () => {
    const s = toPhase(setup(7), 'e7')
    expect(Object.keys(project(s, owner(s, 'S1')).docs.e7Fragments!)).toEqual(['S1'])
    expect(json(s, owner(s, 'LS'))).not.toContain(LANDING_CODE)
    expect(project(s, GM).docs.landingCode).toBe(LANDING_CODE)
  })
  it('Direktnachrichten sehen nur Absender und Empfänger', () => {
    let s = toPhase(setup(3), 'checkin')
    const [a, b, c] = s.teams.map((t) => t.id)
    s = reduce(s, { type: 'chat', to: b, text: 'geheim' }, a, 5)
    expect(project(s, a).chat).toHaveLength(1)
    expect(project(s, b).chat).toHaveLength(1)
    expect(project(s, c).chat).toHaveLength(0)
  })
})
