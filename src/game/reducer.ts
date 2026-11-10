import {
  DEVICES, E1_QUESTIONS, E3_DIFFS, E3_MAP, E3_MAX_ENERGY, E3_STORM_SECTORS, E5_BONUS_KW, E5_LIMIT_KW, E5_START_KW,
  E6_DEFAULT_RESTART_SECONDS, E7_ATTEMPTS, E7_DELAY_SECONDS, GAME, LANDING_CODE, MODULES, PIECE_SPECS, ROLES, SECTOR_CODES,
  SECTOR_ORDER,
  noGoText,
} from './content/flugZumMars'
import { cutsceneFor, followUpCutscene } from './content/cutscenes'
import { isEmojiOnly } from './emoji'
import { piecePolygon, shieldCoverage } from './geometry'
import { ALL, GM, PHASES, ROLE_IDS, RuleError } from './types'
import type { Action, GameState, Phase, RoleId, Settings, ShipStatus, Team } from './types'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function makeGameCode(random: () => number = Math.random) {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]
  return `ARES-${code}`
}

/** Reihenfolge der automatischen Verteilung: S5 hat die wenigsten Aufgaben und übernimmt zuerst eine Doppelrolle. */
export const AUTO_ORDER: RoleId[] = ['LS', 'S6', 'S1', 'S3', 'S4', 'S2', 'S5']

const uid = (random: () => number = Math.random) => Math.floor(random() * 2 ** 48).toString(36)

export function createGame(opts: { code: string; teamCount: number; now: number; settings?: Partial<Settings> }): GameState {
  return {
    code: opts.code,
    gameId: GAME.id,
    createdAt: opts.now,
    teamCount: opts.teamCount,
    settings: { gmMode: 'neutral', comm: 'ingame', restartSeconds: E6_DEFAULT_RESTART_SECONDS, cutscenes: true, ...opts.settings },
    teams: [],
    roleOwner: Object.fromEntries(ROLE_IDS.map((r) => [r, null])) as Record<RoleId, string | null>,
    phase: 'lobby',
    phaseStartedAt: opts.now,
    pausedAt: null,
    pausedMs: 0,
    startedAt: null,
    ship: { hull: 100, oxygen: 100, morale: 100, timeBuffer: 30 },
    failure: null,
    cutscene: null,
    chat: [],
    nextMsgId: 1,
    log: [],
    notes: [],
    consequences: [],
    comms: { net: 'primary', emojiOnly: false, silence: false },
    e1: { answers: {}, marks: {}, decision: null },
    e2: { cipherShift: 3 + Math.floor(Math.random() * 20), planSent: false, built: {}, placed: {}, repaired: false },
    e3: {
      pos: startPos(), trail: [], energy: 0, energyUsed: 0, collisions: 0, stormHits: 0, arrived: false,
      stormKnown: false, sectorTries: 0, found: { mast: [], panel: [] }, emojiStatement: false,
    },
    e4: { checkedIn: [], penaltyApplied: false },
    e5: { off: [], confirmed: false },
    e6: { restartStartedAt: null, interrupts: 0, done: false, statements: 0 },
    e7: { sent: {}, lastCharAt: null, attempts: E7_ATTEMPTS, lastFeedback: null, landed: false },
  }
}

function startPos() {
  const y = E3_MAP.findIndex((row) => row.includes('S'))
  return { x: E3_MAP[y].indexOf('S'), y }
}

export const rolesOf = (s: Pick<GameState, 'roleOwner'>, teamId: string): RoleId[] =>
  ROLE_IDS.filter((r) => s.roleOwner[r] === teamId)

export const totalKw = (off: string[]) => E5_START_KW - DEVICES.filter((d) => off.includes(d.id)).reduce((a, d) => a + d.kw, 0)

export const teamName = (s: { teams: { id: string; name: string }[] }, id: string) =>
  id === GM ? 'Spielleitung' : id === ALL ? 'Alle' : s.teams.find((t) => t.id === id)?.name ?? 'Unbekannt'

const log = (s: GameState, now: number, text: string, tone?: 'good' | 'bad' | 'info') => s.log.push({ ts: now, phase: s.phase, text, tone })

function system(s: GameState, now: number, text: string) {
  s.chat.push({ id: s.nextMsgId++, ts: now, from: GM, to: ALL, text, net: s.comms.net === 'backup' ? 'backup' : 'primary', kind: 'system' })
}

function hit(s: GameState, now: number, key: keyof ShipStatus, delta: number, reason: string) {
  const max = key === 'timeBuffer' ? 60 : 100
  s.ship[key] = Math.max(0, Math.min(max, s.ship[key] + delta))
  log(s, now, reason, delta < 0 ? 'bad' : 'good')
  if (s.ship.hull <= 0 && !s.failure) fail(s, now, 'Die Hülle der ARES 1 hat versagt.')
}

function fail(s: GameState, now: number, reason: string) {
  s.failure = reason
  log(s, now, `MISSION GESCHEITERT: ${reason}`, 'bad')
}

function need(s: GameState, actor: string, role: RoleId) {
  if (actor !== GM && s.roleOwner[role] !== actor) throw new RuleError(`Das darf nur ${ROLES[role].section} (${ROLES[role].code}).`)
}

function needPhase(s: GameState, ...phases: Phase[]) {
  if (!phases.includes(s.phase)) throw new RuleError('Diese Aktion ist in der aktuellen Phase nicht möglich.')
}

function needGm(actor: string) {
  if (actor !== GM) throw new RuleError('Das darf nur die Spielleitung.')
}

export function canStart(s: GameState) {
  const problems: string[] = []
  if (s.teams.length !== s.teamCount) problems.push(`${s.teams.length} von ${s.teamCount} Teams sind da.`)
  const open = ROLE_IDS.filter((r) => !s.roleOwner[r])
  if (open.length) problems.push(`Noch nicht vergeben: ${open.map((r) => ROLES[r].code).join(', ')}.`)
  const empty = s.teams.filter((t) => rolesOf(s, t.id).length === 0)
  if (empty.length) problems.push(`Ohne Rolle: ${empty.map((t) => t.name).join(', ')}.`)
  return problems
}

/** Team tritt bei oder kehrt zurück. Rückkehr über Token, sonst über den Namen eines freien Platzes. */
export function joinTeam(state: GameState, input: { name: string; token?: string }, random: () => number = Math.random) {
  const s = structuredClone(state)
  const name = input.name.trim()
  let team: Team | undefined = input.token ? s.teams.find((t) => t.token === input.token) : undefined
  if (!team && name) {
    team = s.teams.find((t) => t.name.toLowerCase() === name.toLowerCase() && !t.online && !t.isHost)
  }
  if (!team) {
    if (!name) throw new RuleError('Bitte einen Organisationsnamen eingeben.')
    if (s.phase !== 'lobby') throw new RuleError('Das Spiel läuft bereits. Der Name passt zu keinem freien Team.')
    if (s.teams.length >= s.teamCount) throw new RuleError('Alle Plätze sind vergeben.')
    if (s.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new RuleError('Dieser Name ist bereits vergeben.')
    team = { id: `t${uid(random)}`, name, token: uid(random) + uid(random), online: true }
    s.teams.push(team)
  }
  team.online = true
  return { state: s, team }
}

export function setOnline(state: GameState, teamId: string, online: boolean) {
  const s = structuredClone(state)
  const t = s.teams.find((x) => x.id === teamId)
  if (t) t.online = online
  return s
}

/** Legt im Modus „Spielleiter ist die Brücke“ das Team des Spielleiters an. */
export function setHostTeam(state: GameState, name: string, random: () => number = Math.random) {
  const s = structuredClone(state)
  const existing = s.teams.find((t) => t.isHost)
  if (existing) existing.name = name
  else {
    if (s.teams.length >= s.teamCount) throw new RuleError('Alle Plätze sind vergeben. Entfernt zuerst ein Team.')
    const team: Team = { id: `t${uid(random)}`, name, token: uid(random), online: true, isHost: true }
    s.teams.push(team)
    s.roleOwner.LS = team.id
  }
  return s
}

function enterPhase(s: GameState, now: number) {
  s.phaseStartedAt = now
  s.pausedMs = 0
  s.pausedAt = null
  if (s.phase === 'e3') s.comms.emojiOnly = true
  if (s.phase === 'e4') {
    s.comms.net = 'down'
    const { collisions, stormHits } = s.e3
    if (collisions + stormHits > 0 && !s.e4.penaltyApplied) {
      s.e4.penaltyApplied = true
      if (collisions) hit(s, now, 'timeBuffer', -5 * collisions, `Kursstrafe: ${collisions} Kollisionen kosten ${5 * collisions} Minuten Zeitpuffer.`)
      if (stormHits) hit(s, now, 'morale', -3 * stormHits, `Kursstrafe: ${stormHits} Sturmfelder senken die Moral.`)
    }
  }
}

function finishPhase(s: GameState, now: number) {
  switch (s.phase) {
    case 'e1': {
      if (s.e1.decision === 'go') {
        const wrong = E1_QUESTIONS.filter((_, i) => !s.e1.marks[i]).length
        if (wrong) hit(s, now, 'hull', -5 * wrong, `Start mit ${wrong} ungeklärten Prüfpunkten: die Hülle leidet.`)
      } else log(s, now, 'Die Spielleitung hat den Start ohne GO der Brücke freigegeben.', 'info')
      break
    }
    case 'e2':
      if (!s.e2.repaired) {
        hit(s, now, 'hull', -15, 'Hitzeschild nicht repariert: Hülle beschädigt.')
        hit(s, now, 'oxygen', -25, 'Hitzeschild nicht repariert: Sauerstoffverlust.')
      }
      break
    case 'e3':
      if (!s.e3.arrived) hit(s, now, 'hull', -20, 'Asteroidenfeld nicht durchquert: schwere Treffer.')
      if (s.e3.found.mast.length < E3_DIFFS.mast.length) hit(s, now, 'timeBuffer', -5, 'Funkmast nicht vollständig geprüft.')
      break
    case 'e4':
      if (s.comms.net !== 'backup' || s.e4.checkedIn.length < s.teams.length) {
        hit(s, now, 'timeBuffer', -5, 'Nicht alle Teams waren rechtzeitig auf dem Notkanal.')
      }
      s.comms.net = 'backup'
      s.comms.emojiOnly = false
      s.e4.checkedIn = s.teams.map((t) => t.id)
      break
    case 'e5':
      evaluateReactor(s, now)
      break
    case 'e6':
      s.comms.silence = false
      if (!s.e6.done) hit(s, now, 'hull', -15, 'Reaktor-Neustart nicht abgeschlossen: Notbetrieb belastet das Schiff.')
      break
    case 'e7':
      if (!s.e7.landed && !s.failure) fail(s, now, 'Die Landung wurde nicht abgeschlossen.')
      break
  }
}

function evaluateReactor(s: GameState, now: number) {
  const off = s.e5.off
  const kw = totalKw(off)
  const add = (text: string) => s.consequences.push(text)
  log(s, now, `Reaktor: ${kw} kW Dauerlast.`, kw <= E5_LIMIT_KW ? 'good' : 'bad')
  if (off.includes('cooling')) return fail(s, now, 'Ohne Reaktorkühlung kam es zur Kernschmelze.')
  if (kw > E5_LIMIT_KW) return fail(s, now, `Der Reaktor explodierte bei ${kw} kW Dauerlast.`)
  if (kw <= E5_BONUS_KW) {
    s.e7.attempts += 1
    hit(s, now, 'morale', 10, 'Bonus: Reaktor bei höchstens 100 kW. Ein zusätzlicher Landeversuch.')
  }
  if (off.includes('oxygen')) hit(s, now, 'oxygen', -20, 'Sauerstoff-Umwälzung aus: Die Luft wird stickig.')
  if (off.includes('water')) hit(s, now, 'morale', -10, 'Kein Warmwasser: Die Moral sinkt.')
  if (off.includes('coffee')) hit(s, now, 'morale', -5, 'Keine Kaffeemaschine: Die Moral sinkt.')
  if (off.includes('airlock')) hit(s, now, 'hull', -10, 'Luftschleuse nur mechanisch gesichert: instabil bei Manövern.')
  if (off.includes('gravity')) add('Schwerelosigkeit: Lose Teile und Werkzeug flogen unkontrolliert durch das Schiff.')
  if (off.includes('hydro')) add('Hydrokulturen ohne Strom: Die Pflanzen für die Mars-Kolonie sind abgestorben.')
  if (off.includes('freezer')) add('Proben-Tiefkühler aus: 10 Jahre Forschung sind verloren.')
  if (off.includes('probe')) add('Sonden-Check unterbrochen: Die Sondendaten sind korrupt.')
  if (off.includes('robots')) add('Reparatur-Bots ohne Ladung: Außeneinsatz musste alles allein machen.')
  if (off.includes('display')) add('Cockpit-Scheiben beschlagen: schlechtere Sicht für die Piloten.')
}

/** Was offen ist und was beim Weiterschalten passiert. Die Werte entsprechen finishPhase. */
export function advanceWarnings(s: GameState): string[] {
  const list: string[] = []
  switch (s.phase) {
    case 'e1': {
      if (s.e1.decision !== 'go') list.push('Die Brücke hat noch kein GO gegeben. Der Start erfolgt trotzdem, ohne Strafe.')
      else {
        const open = E1_QUESTIONS.filter((_, i) => !s.e1.marks[i]).length
        if (open) list.push(`${open} Prüfpunkte sind nicht als korrekt bestätigt: −${5 * open} Hülle.`)
      }
      break
    }
    case 'e2':
      if (!s.e2.repaired) list.push('Das Hitzeschild ist nicht repariert: −15 Hülle und −25 Sauerstoff.')
      break
    case 'e3':
      if (!s.e3.arrived) list.push('Das Schiff hat das Asteroidenfeld nicht durchquert: −20 Hülle.')
      if (s.e3.found.mast.length < E3_DIFFS.mast.length) list.push('Der Funkmast ist nicht vollständig geprüft: −5 Minuten Zeitpuffer.')
      break
    case 'e4':
      if (s.comms.net !== 'backup' || s.e4.checkedIn.length < s.teams.length) list.push('Nicht alle Teams sind am Notkanal: −5 Minuten Zeitpuffer.')
      break
    case 'e5': {
      const kw = totalKw(s.e5.off)
      if (s.e5.off.includes('cooling')) list.push('Die Reaktorkühlung ist aus: Die Mission scheitert durch Kernschmelze.')
      else if (kw > E5_LIMIT_KW) list.push(`Die Last liegt bei ${kw} kW: Die Mission scheitert durch eine Explosion.`)
      if (!s.e5.confirmed) list.push('Die Brücke hat die Lastverteilung noch nicht bestätigt.')
      break
    }
    case 'e6':
      if (!s.e6.done) list.push('Der Reaktor-Neustart ist nicht abgeschlossen: −15 Hülle.')
      break
    case 'e7':
      if (!s.e7.landed) list.push('Die ARES 1 ist nicht gelandet: Die Mission gilt als gescheitert.')
      break
    case 'lessons':
      list.push('Die Übung wird damit beendet.')
      break
  }
  return list
}

/**
 * Wird beim Öffnen eines gespeicherten Spiels aufgerufen. Die Zeit ohne Spielleiter zählt nicht:
 * Das Spiel steht ab dem letzten Lebenszeichen still, bis die Spielleitung fortsetzt.
 */
/** Spielstände aus älteren Versionen hatten nur eine Antwort je Frage. */
export function upgradeGame(state: GameState): GameState {
  const old = Object.entries(state.e1.answers as Record<string, unknown>).filter(([, a]) => typeof (a as { by?: unknown }).by === 'string')
  // Der Film „servers“ ist im Sturmfilm aufgegangen.
  const oldFilm = (state.cutscene?.scene as string | undefined) === 'servers'
  if (!old.length && !oldFilm) return state
  const s = structuredClone(state)
  if (oldFilm && s.cutscene) s.cutscene.scene = 'storm'
  for (const [q, a] of old) {
    const { text, by } = a as { text: string; by: string }
    s.e1.answers[Number(q)] = { [by]: text }
  }
  return s
}

export function pauseAfterHostReturn(state: GameState, now: number): GameState {
  if (state.phase === 'lobby' || state.phase === 'done' || state.pausedAt) return state
  const s = structuredClone(state)
  s.pausedAt = s.hostSeenAt ?? now
  log(s, now, 'Spielleitung war getrennt. Die Übung ist pausiert.', 'info')
  system(s, now, 'Die Spielleitung ist zurück. Die Übung ist pausiert und geht gleich weiter.')
  return s
}

export function tick(state: GameState, now: number): GameState {
  if (state.phase !== 'e6' || state.pausedAt) return state
  const started = state.e6.restartStartedAt
  if (!started || state.e6.done || now - started < state.settings.restartSeconds * 1000) return state
  const s = structuredClone(state)
  s.e6.done = true
  s.comms.silence = false
  log(s, now, 'Reaktor-Neustart erfolgreich abgeschlossen.', 'good')
  system(s, now, 'Reaktor-Neustart abgeschlossen. Die Funkstille ist aufgehoben.')
  return s
}

function interruptRestart(s: GameState, now: number, who: string) {
  s.e6.interrupts += 1
  s.e6.restartStartedAt = now
  hit(s, now, 'hull', -10, `${who} hat den Reaktor-Neustart unterbrochen. Systemfehler!`)
  system(s, now, 'SYSTEMFEHLER: Der Neustart wurde unterbrochen und beginnt von vorn.')
  if (s.e6.interrupts >= 3 && !s.failure) fail(s, now, 'Nach drei Unterbrechungen ist die ARES 1 ausgefallen.')
}

export function reduce(state: GameState, action: Action, actor: string, now: number): GameState {
  const s = structuredClone(state)
  const gm = actor === GM
  if (s.pausedAt && !gm && action.type !== 'chat') throw new RuleError('Die Übung ist pausiert.')
  const held = Boolean(s.cutscene && !s.cutscene.released)
  if (held && !gm) throw new RuleError('Die Spielleitung gibt das nächste Ereignis gleich frei.')

  switch (action.type) {
    case 'setSettings': {
      needGm(actor)
      const { gmMode, comm } = action.settings
      if ((gmMode || comm) && s.phase !== 'lobby') throw new RuleError('Das kann nur vor dem Start geändert werden.')
      Object.assign(s.settings, action.settings)
      if (gmMode === 'neutral') {
        const host = s.teams.find((t) => t.isHost)
        if (host) {
          s.teams = s.teams.filter((t) => t !== host)
          for (const r of ROLE_IDS) if (s.roleOwner[r] === host.id) s.roleOwner[r] = null
        }
      }
      break
    }
    case 'assignRole':
      needGm(actor)
      needPhase(s, 'lobby')
      if (action.role === 'LS' && s.settings.gmMode === 'bridge') throw new RuleError('Die Brücke spielt der Spielleiter.')
      s.roleOwner[action.role] = action.teamId
      break
    case 'autoAssign': {
      needGm(actor)
      needPhase(s, 'lobby')
      if (!s.teams.length) throw new RuleError('Es ist noch kein Team da.')
      const host = s.teams.find((t) => t.isHost)
      const others = s.teams.filter((t) => !t.isHost)
      const pool = others.length ? others : s.teams
      const roles = AUTO_ORDER.filter((r) => !(host && r === 'LS'))
      roles.forEach((r, i) => (s.roleOwner[r] = pool[i % pool.length].id))
      if (host) s.roleOwner.LS = host.id
      break
    }
    case 'addSlot': {
      needGm(actor)
      needPhase(s, 'lobby')
      const name = action.name.trim()
      if (!name) throw new RuleError('Bitte einen Namen eingeben.')
      if (s.teams.length >= s.teamCount) throw new RuleError('Alle Plätze sind vergeben.')
      if (s.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new RuleError('Dieser Name ist bereits vergeben.')
      s.teams.push({ id: `t${uid()}`, name, token: uid() + uid(), online: false })
      break
    }
    case 'removeTeam':
      needGm(actor)
      needPhase(s, 'lobby')
      s.teams = s.teams.filter((t) => t.id !== action.teamId)
      for (const r of ROLE_IDS) if (s.roleOwner[r] === action.teamId) s.roleOwner[r] = null
      break
    case 'advance': {
      needGm(actor)
      if (held) throw new RuleError('Zuerst muss das aktuelle Ereignis freigegeben werden.')
      const idx = PHASES.indexOf(s.phase)
      if (s.phase === 'done') throw new RuleError('Die Übung ist beendet.')
      if (s.phase === 'lobby') {
        const problems = canStart(s)
        if (problems.length) throw new RuleError(problems.join(' '))
        s.startedAt = now
      } else finishPhase(s, now)
      const from = s.phase
      s.phase = PHASES[idx + 1]
      s.cutscene = s.settings.cutscenes === false ? null : cutsceneFor(from, s, totalKw(s.e5.off), now, (s.cutscene?.id ?? 0) + 1)
      enterPhase(s, now)
      log(s, now, `Phase gestartet.`, 'info')
      break
    }
    case 'releaseCutscene':
      needGm(actor)
      if (!s.cutscene || !held) break
      s.cutscene = followUpCutscene(s.cutscene, now, s.phase) ?? { ...s.cutscene, released: true }
      // Die Uhr des Ereignisses läuft erst ab der Freigabe.
      s.phaseStartedAt = now
      s.pausedMs = 0
      if (s.pausedAt) s.pausedAt = now
      break
    case 'pause':
      needGm(actor)
      if (!s.pausedAt) s.pausedAt = now
      break
    case 'resume':
      needGm(actor)
      if (s.pausedAt) {
        const pause = now - s.pausedAt
        s.pausedMs += pause
        if (s.e6.restartStartedAt) s.e6.restartStartedAt += pause
        if (s.e7.lastCharAt) s.e7.lastCharAt += pause
        s.pausedAt = null
      }
      break
    case 'adjustShip':
      needGm(actor)
      hit(s, now, action.key, action.delta, `Spielleitung korrigiert ${action.key} um ${action.delta}.`)
      break
    case 'clearFailure':
      needGm(actor)
      log(s, now, `Spielleitung setzt die Übung fort. (${s.failure})`, 'info')
      s.failure = null
      if (s.ship.hull <= 0) s.ship.hull = 10
      break
    case 'inject':
      needGm(actor)
      if (!action.text.trim()) throw new RuleError('Die Meldung ist leer.')
      s.chat.push({
        id: s.nextMsgId++, ts: now, from: GM, fromLabel: action.label || 'Unbekannter Sender', to: action.to, text: action.text.trim(),
        net: s.comms.net === 'backup' ? 'backup' : 'primary', kind: 'inject',
      })
      log(s, now, `Meldung eingespielt: ${action.text.trim()}`, 'info')
      break
    case 'flagViolation':
      needGm(actor)
      needPhase(s, 'e6')
      if (!s.comms.silence) throw new RuleError('Der Neustart läuft gerade nicht.')
      interruptRestart(s, now, 'Ein Team')
      break
    case 'chat': {
      const text = action.text.trim()
      if (!text) throw new RuleError('Die Nachricht ist leer.')
      if (!gm) {
        if (s.settings.comm === 'external') throw new RuleError('In dieser Übung läuft die Kommunikation über externe Tools.')
        if (s.comms.net === 'down') throw new RuleError('Der Hauptkanal ist ausgefallen. Wartet auf den Notkanal.')
        if (s.comms.net === 'backup' && !s.e4.checkedIn.includes(actor)) throw new RuleError('Meldet euch zuerst am Notkanal an.')
        if (s.comms.emojiOnly && !isEmojiOnly(text)) throw new RuleError('Ionensturm: Es sind nur Emojis erlaubt.')
      }
      s.chat.push({ id: s.nextMsgId++, ts: now, from: actor, to: action.to, text, net: s.comms.net === 'backup' ? 'backup' : 'primary' })
      if (!gm && s.comms.silence && !s.pausedAt) interruptRestart(s, now, teamName(s, actor))
      break
    }
    case 'statement': {
      need(s, actor, 'S5')
      needPhase(s, 'e3', 'e6')
      const text = action.text.trim()
      if (!text) throw new RuleError('Die Meldung ist leer.')
      if (s.phase === 'e3') {
        if (!isEmojiOnly(text)) throw new RuleError('Ionensturm: Auch die Crew-Meldung darf nur aus Emojis bestehen.')
        if (!s.e3.emojiStatement) {
          s.e3.emojiStatement = true
          hit(s, now, 'morale', 5, 'Kommunikationsdeck informiert die Crew trotz Ionensturm.')
        }
      } else {
        s.e6.statements += 1
        if (s.e6.statements === 1) hit(s, now, 'morale', 5, 'Kommunikationsdeck stellt die Falschmeldungen richtig.')
      }
      s.chat.push({ id: s.nextMsgId++, ts: now, from: actor, to: ALL, text, net: s.comms.net === 'backup' ? 'backup' : 'primary', kind: 'statement' })
      break
    }
    case 'e1Answer':
      needPhase(s, 'e1')
      if (!E1_QUESTIONS[action.q]) throw new RuleError('Unbekannte Frage.')
      if (s.e1.decision) throw new RuleError('Die Brücke hat bereits entschieden.')
      s.e1.answers[action.q] = { ...s.e1.answers[action.q], [actor]: action.text.trim() }
      break
    case 'e1Mark':
      need(s, actor, 'LS')
      needPhase(s, 'e1')
      s.e1.marks[action.q] = action.ok
      break
    case 'e1Decide':
      need(s, actor, 'LS')
      needPhase(s, 'e1')
      if (s.e1.decision) throw new RuleError('Die Brücke hat bereits entschieden.')
      if (action.go) {
        s.e1.decision = 'go'
        log(s, now, 'Die Brücke gibt GO für den Start.', 'good')
      } else {
        s.e1.noGos = (s.e1.noGos ?? 0) + 1
        log(s, now, 'Die Brücke entscheidet NO-GO.', 'bad')
        hit(s, now, 'timeBuffer', -10, 'Startfenster verschoben: 10 Minuten Zeitpuffer verloren.')
        system(s, now, noGoText(s.e1.noGos))
      }
      break
    case 'e2SendPlan':
      need(s, actor, 'LS')
      needPhase(s, 'e2')
      s.e2.planSent = true
      log(s, now, 'Brücke hat den verschlüsselten Bauplan an Maschinenraum gesendet.', 'info')
      break
    case 'e2Build': {
      needPhase(s, 'e2')
      const mod = MODULES.find((m) => m.id === action.module)
      if (!mod) throw new RuleError('Unbekanntes Modul.')
      need(s, actor, mod.owner)
      const spec = PIECE_SPECS[mod.kind]
      const ok = spec.shape === action.shape && spec.dims.length === action.dims.length && spec.dims.every((d, i) => Math.abs(d - action.dims[i]) < 0.051)
      s.e2.built[action.module] = { shape: action.shape, dims: action.dims, ok, by: actor }
      break
    }
    case 'e2Reject':
      need(s, actor, 'S1')
      needPhase(s, 'e2')
      delete s.e2.built[action.module]
      delete s.e2.placed[action.module]
      break
    case 'e2Place': {
      need(s, actor, 'S1')
      needPhase(s, 'e2')
      const built = s.e2.built[action.module]
      if (!built) throw new RuleError('Dieses Teil wurde noch nicht geliefert.')
      if (!built.ok) throw new RuleError('Die Maße stimmen nicht. Das Teil passt nicht in den Rahmen.')
      s.e2.placed[action.module] = action.placement
      if (!s.e2.repaired && Object.keys(s.e2.placed).length === MODULES.length) {
        const polys = MODULES.map((m) => piecePolygon(m.kind, s.e2.placed[m.id]))
        if (shieldCoverage(polys).complete) {
          s.e2.repaired = true
          log(s, now, 'Hitzeschild-Segment 01-A ist repariert.', 'good')
          system(s, now, 'Außeneinsatz meldet: Hülle repariert, Sauerstoffverlust gestoppt.')
        }
      }
      break
    }
    case 'e2Remove':
      need(s, actor, 'S1')
      needPhase(s, 'e2')
      if (s.e2.repaired) throw new RuleError('Das Hitzeschild ist bereits fertig.')
      delete s.e2.placed[action.module]
      break
    case 'e3Move': {
      need(s, actor, 'S3')
      needPhase(s, 'e3')
      if (s.e3.arrived) throw new RuleError('Das Schiff hat das Feld bereits durchquert.')
      if (Math.abs(action.dx) + Math.abs(action.dy) !== 1) throw new RuleError('Ungültiger Kursbefehl.')
      if (s.e3.energy < 1) throw new RuleError('Keine Energie. Versorgung muss Schub freigeben.')
      const x = s.e3.pos.x + action.dx
      const y = s.e3.pos.y + action.dy
      const cell = E3_MAP[y]?.[x]
      if (cell === undefined) throw new RuleError('Dieser Kurs führt aus dem Sektor hinaus.')
      s.e3.energy -= 1
      s.e3.energyUsed += 1
      s.e3.trail.push({ ...s.e3.pos })
      s.e3.pos = { x, y }
      if (cell === '#') {
        s.e3.collisions += 1
        hit(s, now, 'hull', -5, 'Kollision mit einem Asteroiden!')
      }
      if (cell === '~') s.e3.stormHits += 1
      if (cell === 'G') {
        s.e3.arrived = true
        log(s, now, 'ARES 1 hat das Asteroidenfeld durchquert.', 'good')
      }
      break
    }
    case 'e3Energy': {
      need(s, actor, 'S4')
      needPhase(s, 'e3')
      const released = s.e3.energy + s.e3.energyUsed
      if (action.amount < 1 || action.amount > 5) throw new RuleError('Es können 1 bis 5 Einheiten freigegeben werden.')
      if (released + action.amount > E3_MAX_ENERGY) throw new RuleError('Die Energiereserve reicht dafür nicht mehr.')
      s.e3.energy += action.amount
      break
    }
    case 'e3Found': {
      needPhase(s, 'e3')
      need(s, actor, action.puzzle === 'mast' ? 'S1' : 'S6')
      const found = s.e3.found[action.puzzle]
      if (!E3_DIFFS[action.puzzle].some((d) => d.id === action.diff)) throw new RuleError('Unbekannte Abweichung.')
      if (!found.includes(action.diff)) found.push(action.diff)
      if (found.length === E3_DIFFS[action.puzzle].length) log(s, now, action.puzzle === 'mast' ? 'Fehlerprüfung am Funkmast abgeschlossen.' : 'Fehlerprüfung im Schaltpult abgeschlossen.', 'good')
      break
    }
    case 'e3Sectors': {
      need(s, actor, 'S2')
      needPhase(s, 'e3')
      s.e3.sectorTries += 1
      const same = action.sectors.length === E3_STORM_SECTORS.length && E3_STORM_SECTORS.every((x) => action.sectors.includes(x))
      if (!same) throw new RuleError('Die Analyse passt nicht zu den Sensordaten. Prüft die Mittelwerte.')
      s.e3.stormKnown = true
      log(s, now, 'Labor hat die Sturmzonen bestimmt. Die Brücke sieht sie jetzt auf der Karte.', 'good')
      break
    }
    case 'e4Activate':
      need(s, actor, 'LS')
      needPhase(s, 'e4')
      s.comms.net = 'backup'
      s.comms.emojiOnly = false
      log(s, now, 'Brücke hat den Notkanal aktiviert.', 'info')
      system(s, now, 'Notkanal aktiv. Alle Teams melden sich jetzt an.')
      if (s.roleOwner.LS && !s.e4.checkedIn.includes(s.roleOwner.LS)) s.e4.checkedIn.push(s.roleOwner.LS)
      break
    case 'e4CheckIn': {
      needPhase(s, 'e4')
      if (s.comms.net !== 'backup') throw new RuleError('Die Brücke hat den Notkanal noch nicht aktiviert.')
      const id = gm ? action.teamId : actor
      if (!id || id === GM) throw new RuleError('Unbekanntes Team.')
      if (!s.e4.checkedIn.includes(id)) {
        s.e4.checkedIn.push(id)
        log(s, now, `${teamName(s, id)} ist am Notkanal angemeldet.`, 'info')
      }
      break
    }
    case 'e5Toggle': {
      need(s, actor, 'LS')
      needPhase(s, 'e5')
      if (s.e5.confirmed) throw new RuleError('Die Entscheidung ist bereits bestätigt.')
      if (!DEVICES.some((d) => d.id === action.device)) throw new RuleError('Unbekanntes Gerät.')
      s.e5.off = s.e5.off.includes(action.device) ? s.e5.off.filter((d) => d !== action.device) : [...s.e5.off, action.device]
      break
    }
    case 'e5Confirm':
      need(s, actor, 'LS')
      needPhase(s, 'e5')
      s.e5.confirmed = true
      log(s, now, `Brücke bestätigt die Lastverteilung: ${totalKw(s.e5.off)} kW.`, 'info')
      break
    case 'e6Start':
      need(s, actor, 'LS')
      needPhase(s, 'e6')
      if (s.e6.done) throw new RuleError('Der Neustart ist bereits abgeschlossen.')
      if (s.comms.silence) throw new RuleError('Der Neustart läuft bereits.')
      s.e6.restartStartedAt = now
      s.comms.silence = true
      log(s, now, 'Reaktor-Neustart eingeleitet. Funkstille für alle Teams.', 'info')
      system(s, now, 'Reaktor-Neustart läuft. Ab jetzt keine Nachrichten mehr senden!')
      break
    case 'e7Send': {
      needPhase(s, 'e7')
      need(s, actor, action.role)
      if (!SECTOR_ORDER.includes(action.role)) throw new RuleError('Die Brücke liefert keinen Sektoren-Code.')
      const code = action.code.trim()
      const delayed = s.e5.off.includes('preheat') && action.role === 'S3' && !gm
      if (!/^\d+$/.test(code)) throw new RuleError('Der Sektoren-Code besteht nur aus Ziffern.')
      if (delayed) {
        if (code.length !== 1) throw new RuleError('Vorwärmer aus: Übertragt jeweils nur ein Zeichen.')
        const wait = s.e7.lastCharAt ? E7_DELAY_SECONDS * 1000 - (now - s.e7.lastCharAt) : 0
        if (wait > 0) throw new RuleError(`Vorwärmer aus: Noch ${Math.ceil(wait / 1000)} Sekunden Pause.`)
        const previous = s.e7.sent.S3 ?? ''
        s.e7.sent.S3 = previous.length >= 2 ? code : previous + code
        s.e7.lastCharAt = now
      } else {
        if (code.length !== 2) throw new RuleError('Der Sektoren-Code hat 2 Stellen.')
        s.e7.sent[action.role] = code
      }
      log(s, now, `${ROLES[action.role].section} hat einen Sektoren-Code übermittelt.`, 'info')
      break
    }
    case 'e7Land': {
      need(s, actor, 'LS')
      needPhase(s, 'e7')
      if (s.e7.landed) throw new RuleError('Die ARES 1 ist bereits gelandet.')
      if (s.e7.attempts < 1) throw new RuleError('Es sind keine Landeversuche mehr übrig.')
      const code = action.code.replace(/\s/g, '')
      if (!/^\d{12}$/.test(code)) throw new RuleError('Der Lande-Code hat 12 Ziffern.')
      if (code === LANDING_CODE) {
        s.e7.landed = true
        s.e7.lastFeedback = null
        log(s, now, 'TOUCHDOWN! Die ARES 1 ist sicher auf dem Mars gelandet.', 'good')
        system(s, now, 'Touchdown. Die ARES 1 ist sicher auf dem Mars gelandet.')
      } else {
        s.e7.attempts -= 1
        const right = SECTOR_ORDER.filter((r, i) => code.slice(i * 2, i * 2 + 2) === SECTOR_CODES[r]).length
        s.e7.lastFeedback = `Code abgelehnt. ${right} von 6 Blöcken sind korrekt.`
        hit(s, now, 'hull', -10, 'Falscher Lande-Code: Das Schiff gerät ins Trudeln.')
        if (s.e7.attempts < 1 && !s.failure) fail(s, now, 'Kein gültiger Lande-Code: Die ARES 1 ist abgestürzt.')
      }
      break
    }
    case 'note':
      needPhase(s, 'lessons', 'done')
      if (action.text.trim()) s.notes.push({ ts: now, team: gm ? 'Spielleitung' : teamName(s, actor), text: action.text.trim() })
      break
    default: {
      const never: never = action
      throw new RuleError(`Unbekannte Aktion: ${JSON.stringify(never)}`)
    }
  }
  return s
}
