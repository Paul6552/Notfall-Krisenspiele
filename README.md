# Krisenübung „Flug zum Mars“

Browserspiel für Notfall- und Krisenübungen nach SKKM. Organisationen an verschiedenen Standorten spielen gemeinsam über das Internet, jede in einer Stabsrolle. Grundlage ist das interne Konzept „Mission Red Planet“.

React, Vite und TypeScript. Es gibt keinen eigenen Backendserver.

## Starten

```bash
npm install
npm run dev        # Entwicklung
npm run build      # Statische Seite in dist/
```

Für die Übung den Ordner `dist/` auf ein beliebiges statisches Hosting legen, zum Beispiel GitHub Pages oder Netlify. Alle Beteiligten brauchen dieselbe Adresse.

## Ablauf einer Übung

1. **Vorher:** Jede Organisation öffnet „Verbindung vor der Übung testen“. Zwei Organisationen geben dasselbe Testwort ein. So zeigt sich früh, ob ein Firmennetz WebRTC blockiert.
2. **Spielleiter:** Teamzahl eingeben, „Flug zum Mars“ starten, Spielnummer oder Einladungslink verschicken.
3. **Teams:** Mit der Spielnummer und ihrem Organisationsnamen beitreten.
4. **Spielleiter:** Rollen vergeben, festlegen, ob er selbst die Brücke spielt und ob der Chat im Spiel oder externe Tools genutzt werden. Dann die Übung starten.
5. **Während der Übung:** Der Spielleiter schaltet Ereignisse per Knopf weiter. Timer sind nur Richtwerte.

Der Browser des Spielleiters hält den Spielstand. Er muss während der Übung offen bleiben. Bei einem Absturz: dieselbe Seite im selben Browser wieder öffnen, „Spiel fortsetzen“ wählen, die Teams verbinden sich neu. Zur Sicherung gibt es in der Konsole „Spielstand als Datei sichern“.

## Technik

- **Vernetzung:** WebRTC mit [Trystero](https://github.com/dmotz/trystero). Öffentliche Nostr-Relays dienen nur dem Verbindungsaufbau. Die Spieldaten laufen verschlüsselt direkt zwischen den Browsern.
- **Spielstand:** IndexedDB. Der Host speichert den Spielstand, Teams ihre Zugangsdaten und letzte Ansicht.
- **Geheimnisse:** Der Host sendet jedem Team nur die Daten seiner Rollen (`src/game/projection.ts`). Die Inhalte liegen aber im ausgelieferten JavaScript. Wer die Entwicklertools nutzt, kann sie finden.

### Wenn ein Netz WebRTC blockiert

Ein TURN-Relay leitet die Daten weiter, wenn direkte Verbindungen nicht möglich sind. Dafür beim Build die Zugangsdaten eines TURN-Anbieters setzen:

```bash
VITE_TURN_CONFIG='[{"urls":"turn:turn.example.org:3478","username":"name","credential":"geheim"}]' npm run build
```

Die Zugangsdaten stehen danach im ausgelieferten JavaScript. Nutzt deshalb zeitlich begrenzte Zugänge.

## Inhalte ändern

Alle Texte, Rätsel, die Karte, die Geräte und die Sprüche für Ereignis 6 stehen in `src/game/content/flugZumMars.ts`. Nach Änderungen an Rätseln `npm test` ausführen. Die Tests prüfen unter anderem, ob die Karte einen sicheren Weg hat und die Summen stimmen.

Sektoren-Codes stehen in `SECTOR_CODES` und müssen zu den Fragmenten in `E7_FRAGMENTS` passen.

## Tests

```bash
npm test                                   # Spiellogik
npm run test:e2e                           # Kompletter Durchlauf im installierten Chrome
REAL_NET=1 npm run test:e2e -- realNetwork # Echte WebRTC-Verbindung, braucht Internet
```

Für Probeläufe auf einem Rechner: `?net=local` an die Adresse anhängen (`http://localhost:5173/?net=local#/`). Dann verbinden sich mehrere Tabs desselben Browsers ohne Internet.
