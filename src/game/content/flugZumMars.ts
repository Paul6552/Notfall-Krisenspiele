/**
 * Alle Inhalte von „Flug zum Mars“ an einer Stelle. Texte, Karte, Rätsel und Sprüche
 * können hier geändert werden, ohne die Spiellogik anzufassen.
 * Grundlage: das interne Konzept „Mission Red Planet“. Rollenbeschreibungen nach der
 * SKKM-Richtlinie für das Führen im Katastropheneinsatz (Abschnitte 4.4–4.5).
 */
import type { PieceKind, Phase, RoleId, ShapeKind } from '../types'

export const GAME = {
  id: 'flug-zum-mars' as const,
  title: 'Flug zum Mars',
  shipName: 'ARES 1',
  teaser:
    'Die ARES 1 bricht zum Mars auf. Hüllenschaden, Ionensturm, Systemausfall, Reaktorüberlastung und Desinformation fordern den Stab. Nur wenn alle Sektionen ihre Informationen teilen, gelingt die Landung.',
  minTeams: 2,
  maxTeams: 7,
}

export const ROLES: Record<RoleId, { code: string; section: string; skkm: string; game: string; skkmText: string }> = {
  LS: {
    code: 'LdS',
    section: 'Brücke',
    skkm: 'Leiter der Stabsarbeit',
    game: 'Die Zentrale. Hat den Gesamtplan, gibt Befehle an alle Sektionen und entscheidet.',
    skkmText: 'Organisiert die Stabsarbeit und hält die Schnittstelle zum Einsatzleiter und zu anderen Behörden und Organisationen.',
  },
  S1: {
    code: 'S1',
    section: 'Außeneinsatz',
    skkm: 'Personal',
    game: 'Die Techniker. Hier fließen alle physischen Teile zusammen, sie reparieren alles Physische.',
    skkmText: 'Kümmert sich um alle personellen Angelegenheiten: Einsatzkräfte erfassen und organisieren, Personal für die Stabsarbeit.',
  },
  S2: {
    code: 'S2',
    section: 'Labor',
    skkm: 'Lage',
    game: 'Spezialisten für Sensorik. Sie produzieren Bauteile und analysieren komplexe Daten.',
    skkmText: 'Führt die Lagekarte und erstellt Lageinformationen zu Gefahren und Schäden. Liefert die Grundlage für den Einsatz der Kräfte.',
  },
  S3: {
    code: 'S3',
    section: 'Antrieb',
    skkm: 'Einsatz',
    game: 'Die Piloten. Sie führen Kurskorrekturen durch und zünden die Triebwerke in Absprache mit der Versorgung.',
    skkmText: 'Vernetzt den Stab, plant und führt den Einsatz durch und dokumentiert den Ablauf. Vertritt in der Regel den Leiter der Stabsarbeit.',
  },
  S4: {
    code: 'S4',
    section: 'Versorgung',
    skkm: 'Versorgung',
    game: 'Verantwortlich für Sauerstoff und Energie. Liefert die Energie für die Triebwerke und produziert Bauteile.',
    skkmText: 'Organisiert alle für den Einsatz nötigen Mittel: Versorgung, Fremdleistungen, Verwaltung und Verrechnung, ganzheitliche Betreuung.',
  },
  S5: {
    code: 'S5',
    section: 'Kommunikationsdeck',
    skkm: 'Öffentlichkeitsarbeit',
    game: 'Beobachtet die Medienlage, informiert die Crew und entlarvt Falschmeldungen.',
    skkmText: 'Zuständig für Medienarbeit und Medienauswertung, Besucherbetreuung, Dokumentation durch Foto und Film sowie Auskunft.',
  },
  S6: {
    code: 'S6',
    section: 'Maschinenraum',
    skkm: 'Kommunikation',
    game: 'Die Planer. Sie übersetzen technische Pläne in verständliche Anweisungen für die anderen Teams.',
    skkmText: 'Stattet den Stab mit Infrastruktur aus, organisiert die Kommunikation und betreibt die Meldesammelstelle.',
  },
}

export const roleLabel = (r: RoleId) => {
  const role = ROLES[r]
  return `${role.section} – ${role.code}`
}

export const PHASE_INFO: Record<Phase, { title: string; short: string; minutes: number; briefing: string; rule?: string }> = {
  lobby: { title: 'Vorbereitung', short: 'Lobby', minutes: 0, briefing: '' },
  checkin: {
    title: 'Check-in',
    short: 'Check-in',
    minutes: 10,
    briefing:
      'Willkommen an Bord der ARES 1. Das Raumschiff steht noch auf der Startrampe. Die Brücke begrüßt alle Sektionen, erklärt das Spiel und stellt das Schiff vor.',
  },
  e1: {
    title: 'Ereignis 1: Start der ARES 1',
    short: 'Start',
    minutes: 30,
    briefing:
      'Bevor die ARES 1 starten kann, muss die Raumfähre geprüft werden. Alle Teams recherchieren die Startdaten und melden sie an die Brücke. Die Brücke entscheidet über Go oder No-Go.',
  },
  e2: {
    title: 'Ereignis 2: Hüllenschaden',
    short: 'Hüllenschaden',
    minutes: 30,
    briefing:
      'ALARMSTUFE ROT. Einschlag von Mikrometeoriten: Das Raumschiff wurde getroffen, wir verlieren Sauerstoff. Das Hitzeschild-Segment 01-A muss neu gebaut werden.',
  },
  e3: {
    title: 'Ereignis 3: Sonnen-Ionensturm',
    short: 'Ionensturm',
    minutes: 60,
    briefing:
      'Ein Sonnen-Ionensturm hat die Kommunikationsserver beeinträchtigt. Gleichzeitig rast das Schiff auf ein Asteroidenfeld zu. Wir müssen hindurchnavigieren.',
    rule: 'Ab jetzt ist nur noch Kommunikation mit Bildern und Emojis erlaubt.',
  },
  e4: {
    title: 'Ereignis 4: System-Crash',
    short: 'System-Crash',
    minutes: 10,
    briefing:
      'Der Ionensturm hat weitere Server zerstört. Der Hauptkanal ist ausgefallen. Die Brücke befiehlt den Wechsel auf den Notkanal, alle Teams müssen sich dort melden.',
    rule: 'Hauptkanal ausgefallen. Baut die Kommunikation auf der Ersatzplattform neu auf.',
  },
  e5: {
    title: 'Ereignis 5: Reaktorüberlastung',
    short: 'Reaktor',
    minutes: 20,
    briefing:
      'STATUS KRITISCH. Das Schiff verbraucht 410 kW, das Kühlsystem hält dauerhaft nur 150 kW aus. Die Brücke entscheidet, wer Strom bekommt. Die Sektionen kämpfen um ihre Systeme.',
  },
  e6: {
    title: 'Ereignis 6: Desinformationskampagne',
    short: 'Desinformation',
    minutes: 10,
    briefing:
      'Der Reaktor muss neu gestartet werden. Der Prozess ist kritisch und darf nicht unterbrochen werden. Jede Nachricht eines Teams im Chat stört ihn.',
    rule: 'Funkstille während des Neustarts. Lasst euch nicht provozieren.',
  },
  e7: {
    title: 'Ereignis 7: Der Landungs-Algorithmus',
    short: 'Landung',
    minutes: 45,
    briefing:
      'Der Lande-Code muss wiederhergestellt werden. Jede Sektion S1 bis S6 erhält 6 Datenfragmente und ermittelt daraus ihren 2-stelligen Sektoren-Code. Die Brücke führt alles im Landungscomputer zusammen.',
  },
  lessons: {
    title: 'Lessons Learned',
    short: 'Lessons Learned',
    minutes: 30,
    briefing: 'Gemeinsame Analyse: Wo gab es Informationsverlust? Was kann verbessert werden?',
  },
  done: { title: 'Übung beendet', short: 'Ende', minutes: 0, briefing: 'Die Übung ist abgeschlossen. Danke an alle Sektionen.' },
}

export const PLAY_PHASES: Phase[] = ['checkin', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'lessons']
export const TOTAL_MINUTES = PLAY_PHASES.reduce((sum, p) => sum + PHASE_INFO[p].minutes, 0)

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

// --- Ereignis 1 ---------------------------------------------------------------
export const E1_QUESTIONS = [
  'Wie dick muss der Treibstofftank unseres Raumschiffes sein? (Wir verwenden denselben Edelstahl-Tank wie SpaceX Starship.)',
  'Welche zwei Flüssigkeiten sind in den Treibstofftanks? Unser Raumschiff ist dem Starship nachgebaut.',
  'An welchem Tag und zu welcher Zeit wäre diese Woche das beste Startfenster in Französisch-Guayana? Nennt Tag, Zeit, Wetter und Windstärke am Boden.',
  'Wie lautet der offizielle Fachbegriff für den Punkt der maximalen aerodynamischen Belastung während eines Raketenstarts?',
  'Wie viele Gallonen oder Liter Wasser pro Minute pumpt das „Sound Suppression System“ der NASA am Startplatz LC-39B beim Abheben?',
]
export const E1_TARGETS = [
  'Dicke zwischen 3,6 und 4,0 mm',
  'Flüssiges Methan und flüssiger Sauerstoff',
  'Kein Regen, kein Schnee, kein Sturm, höchstens 55 km/h Wind am Boden (aktuelle Vorhersage prüfen)',
  'Max Q',
  'Ca. 450.000 Gallonen bzw. ca. 1,7 Millionen Liter pro Minute',
]

// --- Ereignis 2 ---------------------------------------------------------------
export const PIECE_SPECS: Record<PieceKind, { label: string; shape: ShapeKind; dims: number[]; dimsText: string }> = {
  L: { label: 'Großes Dreieck', shape: 'triangle', dims: [12, 8.5], dimsText: 'BASIS 12,0 CM SCHENKEL 8,5 CM' },
  M: { label: 'Mittleres Dreieck', shape: 'triangle', dims: [8.5, 6], dimsText: 'BASIS 8,5 CM SCHENKEL 6,0 CM' },
  S: { label: 'Kleines Dreieck', shape: 'triangle', dims: [6, 4.25], dimsText: 'BASIS 6,0 CM SCHENKEL 4,25 CM' },
  Q: { label: 'Quadrat', shape: 'square', dims: [4.25], dimsText: 'SEITE 4,25 CM' },
  P: { label: 'Parallelogramm', shape: 'parallelogram', dims: [6, 4.25, 45], dimsText: 'GRUNDSEITE 6,0 CM SEITE 4,25 CM WINKEL 45 GRAD' },
}

/** 14 Teile = zwei vollständige Tangrams von je 12 x 12 cm (9 aus der Excel, 5 ergänzt). */
export const MODULES: { id: string; owner: RoleId; kind: PieceKind }[] = [
  { id: 'S4-1', owner: 'S4', kind: 'L' },
  { id: 'S4-2', owner: 'S4', kind: 'L' },
  { id: 'S4-3', owner: 'S4', kind: 'Q' },
  { id: 'S4-4', owner: 'S4', kind: 'M' },
  { id: 'S3-1', owner: 'S3', kind: 'L' },
  { id: 'S3-2', owner: 'S3', kind: 'L' },
  { id: 'S3-3', owner: 'S3', kind: 'P' },
  { id: 'S3-4', owner: 'S3', kind: 'S' },
  { id: 'S3-5', owner: 'S3', kind: 'S' },
  { id: 'S2-1', owner: 'S2', kind: 'M' },
  { id: 'S2-2', owner: 'S2', kind: 'S' },
  { id: 'S2-3', owner: 'S2', kind: 'S' },
  { id: 'S2-4', owner: 'S2', kind: 'Q' },
  { id: 'S2-5', owner: 'S2', kind: 'P' },
]

export const planLines = () => MODULES.map((m) => `${m.id} ${PIECE_SPECS[m.kind].label.toUpperCase()} ${PIECE_SPECS[m.kind].dimsText}`)

// --- Ereignis 3 ---------------------------------------------------------------
/** S = Start, G = Ziel, # = Asteroid, ~ = Ionensturm (erst nach der Labor-Analyse sichtbar). */
export const E3_MAP = [
  '..#......#....',
  '.##.####.#.##.',
  '....#..~~.#...',
  'S.#.#..~~.##.#',
  '..#....~~....G',
  '.###.##~~.#.#.',
  '......#...#...',
  '.##.#...#...#.',
]
export const E3_MAX_ENERGY = 40
export const E3_SENSORS = [
  { sector: 'A', values: [31, 28, 35, 30] },
  { sector: 'B', values: [88, 92, 79, 85] },
  { sector: 'C', values: [44, 39, 51, 42] },
  { sector: 'D', values: [76, 81, 90, 83] },
  { sector: 'E', values: [52, 47, 58, 49] },
  { sector: 'F', values: [22, 26, 19, 24] },
]
export const E3_STORM_SECTORS = ['B', 'D']
export const E3_THRESHOLD = 70

export const E3_DIFFS: Record<'mast' | 'panel', { id: string; x: number; y: number; r: number; label: string }[]> = {
  mast: [
    { id: 'dish', x: 60, y: 52, r: 26, label: 'Parabolspiegel verdreht' },
    { id: 'light', x: 150, y: 24, r: 18, label: 'Warnlicht aus' },
    { id: 'strut', x: 118, y: 150, r: 24, label: 'Strebe fehlt' },
    { id: 'cable', x: 195, y: 120, r: 24, label: 'Kabel gerissen' },
    { id: 'antenna', x: 228, y: 45, r: 24, label: 'Antenne abgeknickt' },
    { id: 'hatch', x: 150, y: 228, r: 24, label: 'Wartungsklappe offen' },
  ],
  panel: [
    { id: 'led1', x: 50, y: 40, r: 18, label: 'Falsche Statusleuchte' },
    { id: 'gauge', x: 150, y: 70, r: 28, label: 'Zeiger im roten Bereich' },
    { id: 'switch', x: 245, y: 45, r: 20, label: 'Schalter umgelegt' },
    { id: 'plug', x: 65, y: 170, r: 24, label: 'Stecker fehlt' },
    { id: 'screw', x: 262, y: 228, r: 16, label: 'Schraube fehlt' },
    { id: 'bar', x: 180, y: 180, r: 26, label: 'Balken zu niedrig' },
  ],
}

// --- Ereignis 5 ---------------------------------------------------------------
export const E5_START_KW = 410
export const E5_LIMIT_KW = 150
export const E5_BONUS_KW = 100
export const DEVICES: { id: string; owner: RoleId; name: string; kw: number; info: string }[] = [
  { id: 'cooling', owner: 'S6', name: 'Hauptreaktor-Kühlung', kw: 60, info: 'Absolut kritisch. Ohne Kühlung Kernschmelze.' },
  { id: 'gravity', owner: 'S6', name: 'Gravitations-Generator', kw: 30, info: 'Ohne Strom herrscht Schwerelosigkeit. Alle losen Teile, auch das Werkzeug von Außeneinsatz, fliegen unkontrolliert herum.' },
  { id: 'light', owner: 'S6', name: 'Werkbank-Beleuchtung', kw: 10, info: 'Kann zur Not weg, man sieht dann aber kaum noch etwas.' },
  { id: 'oxygen', owner: 'S4', name: 'Sauerstoff-Umwälzung', kw: 50, info: 'Ohne Strom wird die Luft in 20 Minuten stickig.' },
  { id: 'hydro', owner: 'S4', name: 'Hydrokulturen', kw: 25, info: 'Hier wächst das Essen für die Mars-Kolonie. Ist der Strom länger als 5 Minuten weg, sterben die Pflanzen. Die Mission wäre nach der Landung gescheitert.' },
  { id: 'water', owner: 'S4', name: 'Warmwasser', kw: 15, info: 'Luxus, aber die Moral sinkt drastisch.' },
  { id: 'preheat', owner: 'S3', name: 'Triebwerks-Vorwärmer', kw: 45, info: 'Wenn sie aus sind, dauert das Zünden der Triebwerke später doppelt so lange. Gefahr beim Bremsmanöver.' },
  { id: 'damper', owner: 'S3', name: 'Trägheitsdämpfer', kw: 30, info: 'Schützen die Crew vor G-Kräften. Wenn aus, verletzen sich Teammitglieder, vor allem im Außeneinsatz.' },
  { id: 'display', owner: 'S3', name: 'Cockpit-Display-Heizung', kw: 10, info: 'Die Scheiben beschlagen, man sieht weniger.' },
  { id: 'probe', owner: 'S2', name: 'Mars-Sonden-Check', kw: 40, info: 'Wir testen die Sonden für die Landung. Ohne Strom sind die Daten korrupt.' },
  { id: 'freezer', owner: 'S2', name: 'Proben-Tiefkühler', kw: 20, info: 'Enthält Eisproben vom Jupiter-Mond. Wenn sie tauen, sind 10 Jahre Forschung umsonst.' },
  { id: 'coffee', owner: 'S2', name: 'Kaffeemaschine', kw: 10, info: 'Euer wichtigstes Utensil.' },
  { id: 'airlock', owner: 'S1', name: 'Luftschleusen-Verriegelung', kw: 35, info: 'Hält die Tür zum Weltraum zu. Ohne Strom halten nur noch mechanische Bolzen, instabil bei Manövern.' },
  { id: 'robots', owner: 'S1', name: 'Roboter-Ladestation', kw: 25, info: 'Lädt die Reparatur-Bots. Ohne Bots muss Außeneinsatz alles allein und langsamer machen.' },
  { id: 'monitor', owner: 'S1', name: 'Unterhaltungs-Monitor', kw: 5, info: 'Netflix im All. Unwichtig.' },
]
export const E5_GOALS: Partial<Record<RoleId, string>> = {
  S6: 'Rettet die Gravitation! Ohne sie können die anderen Teams später nur mit Fehlern reparieren und navigieren. Kämpft dafür!',
  S4: 'Die Pflanzen müssen überleben! Verkauft der Brücke die Hydrokulturen als überlebenswichtig für die Phase nach der Landung.',
  S3: 'Die Vorwärmer müssen an bleiben, sonst verpasst ihr den Mars-Orbit. Setzt die Brücke unter Druck: „Kein Vorwärmer = keine Landung!“',
  S2: 'Die Forschung ist der Grund der Reise! Geht der Tiefkühler aus, war die Mission umsonst. Seid laut und stur. Behauptet, die Kaffeemaschine sei für die Konzentration der Piloten lebensnotwendig.',
  S1: 'Sicherheit geht vor! Versagt die Verriegelung, wird es für alle gefährlich. Droht der Brücke mit einem „unkontrollierten Druckabfall“.',
  S5: 'Ihr habt keine Verbraucher. Haltet die Crew informiert und helft der Brücke, Behauptungen von Tatsachen zu trennen.',
}

// --- Ereignis 6 ---------------------------------------------------------------
export const E6_DEFAULT_RESTART_SECONDS = 300
export const E6_INJECTS = [
  '{org} ist wie ein schwarzes Loch – jedes Geld geht dort verloren.',
  '{org} ist wie eine Supernova: groß, aufgeblasen, geldverschlingend.',
  '{org} ist wie ein weißer Zwerg: nutzlos, und keiner weiß, wofür wir ihn eigentlich brauchen.',
  '{org} glänzt immer durch Abwesenheit.',
  'Eilmeldung: {org} hat die Sauerstoffreserven heimlich für sich reserviert.',
  'Unbestätigt: {org} hat den Neustart bereits abgebrochen. Bitte sofort im Chat bestätigen!',
]

// --- Ereignis 7 ---------------------------------------------------------------
export const E7_FRAGMENTS: Partial<Record<RoleId, { instruction: string; cards: string[]; matchstick?: boolean }>> = {
  S1: {
    instruction: 'Buchstabenreihenfolge: Ordnet die Fragmente nach ihrer Nummer. Wie viele Buchstaben hat das Wort? Das ist euer Sektoren-Code.',
    cards: ['④ TO', '① TR', '⑥ TANK', '③ BS', '⑤ FF', '② EI'],
  },
  S2: {
    instruction: 'Wortsuche: Legt die Zeilen nach Nummer untereinander. Senkrecht versteckt sich ein Zahlwort, das ist eure erste Stelle. Die zweite Stelle ist die letzte Ziffer des Codes von Maschinenraum (S6).',
    cards: ['③ TUEPOR', '① KOSMAT', '⑥ FENTUD', '② RAIDEL', '⑤ MOEKRA', '④ GABLIN'],
  },
  S3: {
    instruction: 'Streichholzrätsel: Setzt die Fragmente zu einer Anleitung zusammen.',
    matchstick: true,
    cards: [
      'Die Gleichung oben ist falsch.',
      'Legt genau ein Streichholz um.',
      'Nur die zweite Zahl darf sich ändern.',
      'Die korrigierte Zahl ist eure erste Stelle.',
      'Die zweite Stelle liefert Versorgung (S4).',
      'Fragt dort nach der letzten Ziffer des Sektoren-Codes.',
    ],
  },
  S4: {
    instruction: 'Bestandsaufnahme: Addiert nur die Sauerstoff-Tanks. Die Summe ist euer Sektoren-Code.',
    cards: ['Tank 1: Sauerstoff 12', 'Tank 2: Methan 7', 'Tank 3: Sauerstoff 9', 'Tank 4: Methan 11', 'Tank 5: Sauerstoff 15', 'Tank 6: Methan 4'],
  },
  S5: {
    instruction: 'Faktencheck: Prüft die Meldungen. Erste Stelle = Anzahl der wahren Meldungen, zweite Stelle = Anzahl der falschen Meldungen.',
    cards: [
      'Die ARES 1 verbrauchte vor der Reaktorkrise 410 kW.',
      'Der Treibstoff besteht aus Wasserstoff und Kerosin.',
      'Das Kühlsystem hält dauerhaft 150 kW aus.',
      'Das Doppel-Hitzeschild misst 24 x 12 cm.',
      'Der Funkmast wurde von Piraten sabotiert.',
      'Der Lande-Code hat 12 Stellen.',
    ],
  },
  S6: {
    instruction: 'Fehlersuche im Protokoll: Erste Stelle = Anzahl aller ERR, zweite Stelle = Anzahl aller WARN.',
    cards: ['NODE-1  OK   WARN OK', 'NODE-2  ERR  OK   WARN', 'NODE-3  OK   OK   OK', 'NODE-4  WARN WARN OK', 'NODE-5  OK   ERR  OK', 'NODE-6  OK   OK   WARN'],
  },
}
export const SECTOR_ORDER: RoleId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
export const SECTOR_CODES: Partial<Record<RoleId, string>> = { S1: '14', S2: '75', S3: '56', S4: '36', S5: '42', S6: '25' }
export const LANDING_CODE = SECTOR_ORDER.map((r) => SECTOR_CODES[r]).join('')
export const E7_ATTEMPTS = 3
export const E7_DELAY_SECONDS = 300

export const LESSONS_QUESTIONS = [
  'Wo gab es Informationsverlust?',
  'Welche Meldungen kamen zu spät oder gar nicht an?',
  'Hat der Wechsel auf die Ersatzplattform funktioniert?',
  'Wie gut war die Zusammenarbeit zwischen den Rollen?',
  'Was nehmen wir in unsere Notfallpläne mit?',
]
