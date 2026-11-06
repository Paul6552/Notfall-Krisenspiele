# Krisenübung „Flug zum Mars“

Browserspiel für Notfall- und Krisenübungen nach SKKM. Organisationen an verschiedenen Standorten spielen gemeinsam über das Internet, jede in einer Stabsrolle. Grundlage ist das interne Konzept „Mission Red Planet“.

React, Vite und TypeScript. Es gibt keinen eigenen Backendserver.

## Starten

```bash
npm install
npm run dev        # Entwicklung
npm run build      # Statische Seite in dist/
```

Das Spiel läuft unter **https://paul6552.github.io/Notfall-Krisenspiele/**. Jeder Push auf `main` prüft die Tests und veröffentlicht die Seite neu (`.github/workflows/pages.yml`). Alle Beteiligten brauchen dieselbe Adresse.

## Ablauf einer Übung

1. **Vorher:** Jede Organisation öffnet „Verbindung vor der Übung testen“. Zwei Organisationen geben dasselbe Testwort ein. So zeigt sich früh, ob ein Firmennetz WebRTC blockiert.
2. **Spielleiter:** Teamzahl eingeben, „Flug zum Mars“ starten, Spielnummer oder Einladungslink verschicken.
3. **Teams:** Mit der Spielnummer und ihrem Organisationsnamen beitreten.
4. **Spielleiter:** Rollen vergeben, festlegen, ob er selbst die Brücke spielt und ob der Chat im Spiel oder externe Tools genutzt werden. Dann die Übung starten.
5. **Während der Übung:** Der Spielleiter schaltet Ereignisse per Knopf weiter. Timer sind nur Richtwerte.

### Filme zwischen den Ereignissen

Nach jedem „Weiter“ läuft bei allen gleichzeitig ein kurzer Film von 8 bis 18 Sekunden: vom Start der ARES 1 bis zur Landung auf dem Mars, am Schluss ein Abspann mit allen Organisationen. Der Ausgang hängt vom Spielverlauf ab, zum Beispiel „Erfolgreich gestartet“ oder „Gestartet mit Verspätung“.

Die Filme sind im Browser animiert und brauchen keine Videodateien. Jede Person kann sie für sich überspringen. Die Spielleitung kann sie in der Lobby abschalten.

### Wenn der Spielleiter-Browser zugeht

Der Browser des Spielleiters hält den Spielstand und speichert jede Änderung sofort in der IndexedDB. Beim Schließen fragt er nach.

1. Dieselbe Seite im **selben Browser auf demselben Gerät** öffnen und unter „Spiel fortsetzen“ das Spiel wählen.
2. Die Teams verbinden sich von selbst neu. Sie müssen nichts tun, solange ihre Seite offen bleibt.
3. Das Spiel steht ab dem Moment der Unterbrechung still. Die Spielleitung drückt „Fortsetzen“, wenn alle wieder da sind. Timer und Reaktor-Neustart laufen dann dort weiter, wo sie standen.

Der Spielstand liegt nur in diesem Browser. Ein privates Fenster löscht ihn beim Schließen, nutzt es deshalb nicht. Für einen Gerätewechsel oder als Sicherung gibt es in der Konsole „Spielstand als Datei sichern“. Die Datei lässt sich auf der Startseite wieder laden.

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

Die Texte der Filme stehen in `src/game/content/cutscenes.ts`, die Szenen in `src/ship/Cutscene.tsx` und `src/ship/cutscene.css`.

## Tests

```bash
npm test                                   # Spiellogik
npm run test:e2e                           # Kompletter Durchlauf im installierten Chrome
REAL_NET=1 npm run test:e2e -- realNetwork # Echte WebRTC-Verbindung, braucht Internet
BASE_URL=https://paul6552.github.io/Notfall-Krisenspiele/ REAL_NET=1 npm run test:e2e -- realNetwork # Gegen die Live-Seite
```

Für Probeläufe auf einem Rechner: `?net=local` an die Adresse anhängen (`http://localhost:5173/?net=local#/`). Dann verbinden sich mehrere Tabs desselben Browsers ohne Internet.
