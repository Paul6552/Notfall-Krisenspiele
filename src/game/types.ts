export const ROLE_IDS = ['LS', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const
export type RoleId = (typeof ROLE_IDS)[number]

export const PHASES = ['lobby', 'checkin', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'lessons', 'done'] as const
export type Phase = (typeof PHASES)[number]

export const GM = 'gm'
export const ALL = 'all'

export interface Team {
  id: string
  name: string
  token: string
  online: boolean
  isHost?: boolean
}

export interface Settings {
  /** neutral: Spielleiter ist kein Team. bridge: Spielleiter spielt zugleich die Brücke. */
  gmMode: 'neutral' | 'bridge'
  /** ingame: Chat im Spiel erzwingt die Regeln. external: Kommunikation über externe Tools. */
  comm: 'ingame' | 'external'
  restartSeconds: number
  /** Filme zwischen den Ereignissen. */
  cutscenes: boolean
}

export type CutsceneScene = 'intro' | 'prep' | 'control' | 'launch' | 'impact' | 'repair' | 'storm' | 'asteroids' | 'dish' | 'signal' | 'overload' | 'reactor' | 'restart' | 'bridge' | 'landing' | 'failure' | 'credits'

export interface Cutscene {
  id: number
  scene: CutsceneScene
  title: string
  subtitle: string
  tone: 'good' | 'warn' | 'bad'
  at: number
  seconds: number
  /** Reaktorlast für die Szene „reactor“. */
  kw?: number
  /** Erst die Spielleitung gibt das nächste Ereignis frei. */
  released: boolean
}

export interface ChatMsg {
  id: number
  ts: number
  from: string
  fromLabel?: string
  to: string
  text: string
  net: 'primary' | 'backup'
  kind?: 'system' | 'inject' | 'statement'
}

export interface LogEntry {
  ts: number
  phase: Phase
  text: string
  tone?: 'good' | 'bad' | 'info'
}

export interface ShipStatus {
  hull: number
  oxygen: number
  morale: number
  timeBuffer: number
}

export type ShapeKind = 'triangle' | 'square' | 'parallelogram'
export type PieceKind = 'L' | 'M' | 'S' | 'Q' | 'P'

export interface BuiltPiece {
  shape: ShapeKind
  dims: number[]
  ok: boolean
  by: string
}

export interface Placement {
  x: number
  y: number
  rot: number
  flip: boolean
}

export interface GameState {
  code: string
  gameId: 'flug-zum-mars'
  createdAt: number
  teamCount: number
  settings: Settings
  teams: Team[]
  roleOwner: Record<RoleId, string | null>
  phase: Phase
  phaseStartedAt: number
  pausedAt: number | null
  pausedMs: number
  startedAt: number | null
  /** Letztes Lebenszeichen des Spielleiter-Browsers. */
  hostSeenAt?: number
  ship: ShipStatus
  failure: string | null
  cutscene: Cutscene | null
  chat: ChatMsg[]
  nextMsgId: number
  log: LogEntry[]
  notes: { ts: number; team: string; text: string }[]
  consequences: string[]
  comms: { net: 'primary' | 'down' | 'backup'; emojiOnly: boolean; silence: boolean }
  e1: {
    /** Frage → Team → Antwort. Jedes Team hat seine eigene Antwort. */
    answers: Record<number, Record<string, string>>
    marks: Record<number, boolean>
    decision: 'go' | null
    /** Wie oft die Brücke das Startfenster verschoben hat. */
    noGos?: number
  }
  e2: {
    cipherShift: number
    planSent: boolean
    built: Record<string, BuiltPiece>
    placed: Record<string, Placement>
    repaired: boolean
  }
  e3: {
    pos: { x: number; y: number }
    trail: { x: number; y: number }[]
    energy: number
    energyUsed: number
    collisions: number
    stormHits: number
    arrived: boolean
    /** Sektoren, die das Labor zuletzt als Sturm gemeldet hat. null: noch keine Meldung. */
    stormReport: string[] | null
    /** Letzter Treffer durch Asteroid oder Sturm, für den Alarm bei allen. */
    lastHit: { at: number; kind: 'rock' | 'storm' } | null
    sectorTries: number
    found: Record<'mast' | 'panel', string[]>
    emojiStatement: boolean
  }
  e4: { checkedIn: string[]; penaltyApplied: boolean }
  e5: { off: string[]; confirmed: boolean }
  e6: { restartStartedAt: number | null; interrupts: number; done: boolean; statements: number }
  e7: {
    sent: Partial<Record<RoleId, string>>
    lastCharAt: number | null
    attempts: number
    lastFeedback: string | null
    landed: boolean
  }
}

/** Geheime Dokumente, die der Host nur an zuständige Rollen ausliefert. */
export interface Docs {
  e1Targets?: string[]
  e2CipherShift?: number
  e2PlanText?: string[]
  e2Cipher?: string[]
  e2Solution?: { kind: PieceKind; pts: [number, number][] }[]
  e3Map?: string[]
  e3Sensors?: { sector: string; values: number[] }[]
  e5Devices?: { id: string; owner: RoleId; name: string; kw: number; info?: string; off?: boolean }[]
  e5Goals?: Partial<Record<RoleId, string>>
  e7Fragments?: Partial<Record<RoleId, { instruction: string; cards: string[]; matchstick?: boolean }>>
  landingCode?: string
}

export interface View extends Omit<GameState, 'teams' | 'e2' | 'e5'> {
  me: string
  myRoles: RoleId[]
  teams: Omit<Team, 'token'>[]
  e2: Omit<GameState['e2'], 'cipherShift'>
  e5: Omit<GameState['e5'], 'off'> & { totalKw?: number }
  flags: { blurS6: boolean; oxygenRule: boolean; delayedS3: boolean; injuredS1: boolean }
  docs: Docs
}

export type Action =
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'assignRole'; role: RoleId; teamId: string | null }
  | { type: 'autoAssign' }
  | { type: 'addSlot'; name: string }
  | { type: 'removeTeam'; teamId: string }
  | { type: 'advance' }
  | { type: 'releaseCutscene' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'adjustShip'; key: keyof ShipStatus; delta: number }
  | { type: 'clearFailure' }
  | { type: 'inject'; text: string; label: string; to: string }
  | { type: 'flagViolation' }
  | { type: 'chat'; to: string; text: string }
  | { type: 'statement'; text: string }
  | { type: 'e1Answer'; q: number; text: string }
  | { type: 'e1Mark'; q: number; ok: boolean }
  | { type: 'e1Decide'; go: boolean }
  | { type: 'e2SendPlan' }
  | { type: 'e2Build'; module: string; shape: ShapeKind; dims: number[] }
  | { type: 'e2Reject'; module: string }
  | { type: 'e2Place'; module: string; placement: Placement }
  | { type: 'e2Remove'; module: string }
  | { type: 'e3Move'; dx: number; dy: number }
  | { type: 'e3Energy'; amount: number }
  | { type: 'e3Found'; puzzle: 'mast' | 'panel'; diff: string }
  | { type: 'e3Sectors'; sectors: string[] }
  | { type: 'e4Activate' }
  | { type: 'e4CheckIn'; teamId?: string }
  | { type: 'e5Toggle'; device: string }
  | { type: 'e5Confirm' }
  | { type: 'e6Start' }
  | { type: 'e7Send'; role: RoleId; code: string }
  | { type: 'e7Land'; code: string }
  | { type: 'note'; text: string }

export class RuleError extends Error {}
