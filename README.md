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

Nach jedem „Weiter“ läuft bei allen gleichzeitig ein kurzer Film von 9 bis 24 Sekunden: vom Start der ARES 1 bis zur Landung auf dem Mars. Der Ausgang hängt vom Spielverlauf ab. „Gestartet mit Verspätung“ erscheint zum Beispiel nur, wenn die Brücke das Startfenster mit einem NO-GO verschoben hat.

Die Filme sind im Browser animiert und brauchen keine Videodateien. Manche Übergänge haben zwei Filme hintereinander:

- Beim Start in den Check-in läuft noch kein Film, damit sich erst alle einloggen. Verlässt die Spielleitung den Check-in, laufen nacheinander der Titelfilm, die Startvorbereitung und die Flugkontrolle, die die letzte Überprüfung anfordert.
- Nach dem Start folgen Alarm, Meteoritenschauer und die Treffer, die zum Hüllenschaden führen.
- Vor Ereignis 3 trifft der Sonnen-Ionensturm das Schiff. Dann zoomt das Bild auf die ARES 1 („An Bord: Kommunikationsserver“) und schneidet in ihren Serverraum, wo der Sturm die Server lahmlegt.
- Vor Ereignis 4 trifft ein Meteorit die Satellitenschüssel, vor Ereignis 5 steigt der Reaktor auf 410 kW, vor Ereignis 7 wartet die nervöse Crew auf der Brücke.
- Nach der Landung feiert die Crew. Danach rückt die ARES 1 zur Seite und der Abspann mit allen Organisationen läuft. Erst dann beginnt „Lessons Learned“.

Am Ende jedes Films läuft das Schlussbild weiter: Triebwerke brennen, Sterne ziehen vorbei, dazu spielt leise Grundmusik. Das bleibt so, bis die Spielleitung mit „Weiter für alle“ freigibt. Erst dann sehen alle das nächste Ereignis, und erst dann läuft dessen Uhr. Zwischen zwei Filmen bleibt das Bild dunkel, das Spiel ist dabei nicht zu sehen. Jede Person kann den Film für sich überspringen und landet dann ebenfalls beim Schlussbild. Die Spielleitung kann die Filme in der Lobby abschalten.

Musik und Klänge entstehen im Browser, es gibt keine Audiodateien. Die Musik ist bewusst hell gehalten: C-Dur, Flächen, Arpeggien, Glockenspiel und ein leichter Rhythmus. Auch Gefahr klingt nach Abenteuer und Tempo, nicht nach Dunkelheit. Ein wiederkehrendes Thema verbindet die Filme. Vor dem Spiel prüft jede Person den Ton mit „Musik testen“: beim Beitritt, im Warteraum und in der Lobby der Spielleitung. Dort und in jedem Film lässt sich die Musik für das eigene Gerät ein- und ausschalten, die Spielleitung kann das nicht für andere festlegen. Die Lautstärke regelt jede Person am Betriebssystem. Browser spielen Ton erst nach einem Klick auf der Seite: Wer während eines Films neu lädt, hört ihn erst nach dem nächsten Klick.

### Ereignis 3: Ionensturm und Asteroidenfeld

- **Brücke** sieht als Einzige die Karte. Sie gibt Antrieb die Richtung und Versorgung die Zahl der Felder, beides nur per Emoji.
- **Versorgung** lädt den Schub mit +1, +3 oder +5 Energie, auch kombiniert. **Antrieb** zündet ihn mit einem Klick, und das Schiff fliegt genau so viele Felder in die gewählte Richtung. Ein Schub, der aus dem Feld führen würde, wird abgelehnt und kostet nichts.
- **Labor** wertet die Sensordaten aus und meldet die Sturmsektoren (A bis F). Die Brücke sieht die gemeldeten Sektoren violett, ob die Meldung stimmt oder nicht. Das Labor kann die Meldung korrigieren. Ob sie stimmt, sieht nur die Spielleitung: in der Konsole unter dem Briefing und in der Brückenkarte unter „Rollenansichten und Lösungen“.
- **Asteroid getroffen:** Hülle −5 %, alle sehen einen roten Rahmen mit dem Hinweis. **Sturmfeld:** Das Schiff bleibt im ersten Sturmfeld stehen, der restliche Schub ist verloren, Moral −3 %, alle sehen einen violetten Rahmen.
- **Funkmast und Schaltpult:** Suchbilder mit je 9 kleinen Abweichungen. Ein Fehlklick sperrt das Bild für 4 Sekunden. Sind alle Schäden gefunden, kann der Funkmast wieder repariert werden.
- **Kommunikationsdeck** informiert die Crew mit einer Emoji-Meldung über den Funk rechts an „Alle“.

### Konsole der Spielleitung

Rechts steht der Funk, direkt darunter die Karte „Ablauf“ mit „Weiter“ und „Pausieren“. Meldungen von außen spielt die Spielleitung im Funk ein: Sie ändert dazu das Feld „Absender“, zum Beispiel auf „Unbekannter Sender“. In Ereignis 6 gibt es dort Vorlagen für Falschmeldungen.

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

Die Texte der Filme stehen in `src/game/content/cutscenes.ts`, die Szenen in `src/ship/Cutscene.tsx` und `src/ship/cutscene.css`. Die Musik je Film steht in `src/ship/filmSound.ts`, die Instrumente und das Thema in `src/ship/music.ts`.

## Tests

```bash
npm test                                   # Spiellogik
npm run test:e2e                           # Kompletter Durchlauf im installierten Chrome
REAL_NET=1 npm run test:e2e -- realNetwork # Echte WebRTC-Verbindung, braucht Internet
BASE_URL=https://paul6552.github.io/Notfall-Krisenspiele/ REAL_NET=1 npm run test:e2e -- realNetwork # Gegen die Live-Seite
```

Für Probeläufe auf einem Rechner: `?net=local` an die Adresse anhängen (`http://localhost:5173/?net=local#/`). Dann verbinden sich mehrere Tabs desselben Browsers ohne Internet.
