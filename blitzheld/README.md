# Blitzheld – Das Mathe-Abenteuer

Ein Jump-and-Run für Kinder der 2. Klasse. Der Fuchs **Blitz** rennt automatisch nach vorne. Das Kind
springt über Steine, Baumstümpfe, Kristalle und Gräben, sammelt Münzen und Sterne und besiegt am Ende
jeder Welt einen Boss. Nach jedem Unfall löst es **drei Plus- oder Minusaufgaben im Zahlenraum bis 50**,
dann geht es weiter. Falsche Antworten sind erlaubt, es gibt keine Zeitbegrenzung und keine Strafe.

Ohne Werbung, ohne Konto, ohne Tracking und ohne externe Dienste. Alle Grafiken und Töne werden im
Browser erzeugt, die Schrift (Fredoka, SIL Open Font License) ist mitgeliefert.

Aufruf über GitHub Pages: `https://jasteffe91-tech.github.io/mathe10/blitzheld/`

## Steuerung

| Aktion | Tastatur | Maus | Touch |
|---|---|---|---|
| Springen | **Leertaste** (auch Pfeil ↑ oder W) | Klick ins Spielfeld | Tippen aufs Spielfeld oder großer Knopf „Springen“ |
| Höher und weiter springen | Taste länger gedrückt halten | Maustaste halten | Finger liegen lassen |
| Pause | Escape oder P | Pause-Knopf oben rechts | Pause-Knopf |
| Rechenaufgabe | Ziffern + Enter | Ziffernfeld + „Prüfen“ | Ziffernfeld + „Prüfen“ |

Mehr gibt es nicht zu lernen. Beim Start steht nur „Drücke LEERTASTE zum Springen!“ bzw. „Tippe zum Springen!“.

## Starten

Voraussetzung: [Node.js](https://nodejs.org/) ab Version 18.

```bash
cd blitzheld
npm install          # einmalig: Phaser, Vite, TypeScript, Vitest
npm run dev          # Entwicklungsserver → http://localhost:5173/
```

Fertigen Build erzeugen und ansehen:

```bash
npm run build        # Typprüfung + Build nach blitzheld/index.html und blitzheld/assets/
npm run preview      # → http://localhost:4173/
```

Der Build liegt direkt im Ordner `blitzheld/`, damit GitHub Pages das Spiel ohne eigenen Build-Schritt
ausliefert. Nach Änderungen am Quelltext also `npm run build` ausführen und den neuen Build mit einchecken.
Ein Doppelklick auf `index.html` (`file://`) funktioniert nicht, weil Browser dort ES-Module blockieren.
Es wird immer ein (beliebiger) Webserver gebraucht.

## Tests

```bash
npm test             # Unit-Tests (Vitest): Spielzustand, Physik, Kollisionen, Mathe, Level, Boss, Speichern
npm run test:e2e     # Browsertests (Playwright/Chromium) gegen den fertigen Build
npm run test:all     # Typprüfung + Unit-Tests + Build + Browsertests
```

Die Browsertests brauchen Playwright mit Chromium:
`npm i -D playwright && npx playwright install chromium`.
Bei Fehlern speichern sie Screenshots in `blitzheld/.shots/`.

### Was geprüft wird

- **Unit-Tests** (`tests/unit/`, 144 Tests):
  - Zustandsautomat: erlaubte und verbotene Wechsel; kein zweiter Tod während DYING; Pause kehrt in den richtigen Zustand zurück.
  - Mathe: über 20 000 erzeugte Aufgaben liegen alle im Zahlenraum 0–50, Subtraktionen sind nie negativ, Additionen nie über 50.
    Pro Satz gibt es drei verschiedene Aufgaben und keine direkte Wiederholung. Falsche Antworten lassen die Aufgabe stehen,
    nach einer richtigen Antwort ist die Eingabe gesperrt (Doppelklick und Doppel-Enter überspringen nichts),
    ungültige Eingaben werden abgewiesen, die Stufe passt sich an.
  - Physik und Kollisionen: automatisches Laufen, Sprung per Taste, kurzer und langer Sprung, Sprungpuffer, Coyote-Zeit,
    kleine Stufen, Hindernisse, Gräben, Gegner (Draufhüpfen), Feuerfontänen (Warnphase harmlos), Federn,
    bewegliche Plattformen, genau ein Todesereignis pro Tod, Checkpoints, sicherer Wiedereinstieg, Unverwundbarkeit.
  - **Alle 12 Level werden von einem automatischen Löser durchgespielt**, und zwar vom Start und von jedem Checkpoint aus,
    zu verschiedenen Zeitpunkten (andere Phasen von Feuer, Gegnern und Plattformen). Dabei muss an jeder Sprungstelle
    ein Zeitfenster von mindestens **200 ms** zum Ziel führen. Kein Level verlangt also millisekundengenaues Timing.
  - Levelaufbau: freier Anlauf nach Start und Checkpoints, keine schwebenden oder unsichtbaren Hindernisse,
    keine Münzen in Hindernissen, Sterne erreichbar.
  - Bosse: Alle vier sind mit gutem Timing besiegbar (auch im Hilfsmodus). Das Ausweichfenster ist mindestens 0,4 s lang.
    Nach drei verpassten Würfen kommt genau ein „Held erschöpft“, nach der Wiederbelebung behält der Boss seinen Schaden.
  - Speicherstand: Freischaltung, Bestleistungen, Laden und Speichern, Zurücksetzen, kaputte Daten.
- **Browsertests** (`tests/e2e/run.mjs`, echtes Spiel in Chromium): Menü und Knöpfe; „Bereit? Los!“; automatisches Laufen;
  Springen mit Leertaste, Pfeil hoch und W; Sprung über einen Stein; Treffer führt zu genau einem Tod und einem Mathefenster
  mit 3 Aufgaben; der Game-Loop steht während des Mathefensters; falsche, richtige und mehrfach bestätigte Antworten;
  sicherer Wiedereinstieg; Sturz in einen Graben; 0 Herzen mit „Oh nein!“ und Wiederbelebung; Checkpoint;
  Pause und Neustart; Levelabschluss mit Speichern und Laden nach dem Neuladen; Bosskampf bis zum Sieg und Freischalten
  von Welt 2; Bosskampf ohne Reaktion; Touch mit Sprungknopf, Tippen und Bildschirmtastatur (Smartphone quer);
  Drehhinweis im Hochformat; Hilfsmodus; Zurücksetzen mit Sicherheitsabfrage; alle 16 Etappen laden ohne Konsolenfehler.

## Spielinhalt

| Welt | Level | Neu in dieser Welt | Boss |
|---|---|---|---|
| 1 Die grüne Wiese | Sonnige Wiese · Schneckenhügel · Kistenpfad | Steine, Baumstümpfe, kleine Gräben, Hügel, Schnecken, Kisten | Stumpi, der Baumstumpf-Riese |
| 2 Die Kristallhöhle | Glitzergang · Fledermaushöhle · Kristallsprünge | Kristalle, Felsen, Felsplatten, Käfer, Fledermäuse, lange Sprünge | Brocko, das Felsmonster |
| 3 Die Wolkenwelt | Wolkenweg · Federwolken · Himmelsleiter | Wolkeninseln, Sprungfedern, Vögel, fahrende Wolken | Blinki-Bot, der freche Roboter |
| 4 Die Vulkaninsel | Heiße Steine · Feuertanz · Drachenpfad | freundliche Lava, Feuerfontänen mit Warnung, bewegliche Plattformen, Hindernisketten | Flammi, der Vulkan-Drache |

Ein Level dauert etwa 35 bis 55 Sekunden und hat zwei bis drei Checkpoints (grüne Fahnen).
Jede neue Hindernisart kommt zuerst allein, mit viel Platz und einem Münzbogen, der den Sprung vormacht.
In den ersten Leveln stehen zusätzlich Schilder („Springen!“, „Baumstumpf!“).

### Leben, Unfälle und Rechenaufgaben

- Jedes Level beginnt mit **5 Herzen**. Jede Berührung eines Hindernisses oder Gegners und jeder Sturz in einen Graben ist
  ein Unfall und kostet genau ein Herz. Der Held verschwindet dabei harmlos in einer Sternenwolke.
- Danach steht das Spiel still und das **Mathefenster** öffnet sich. Drei verschiedene Aufgaben müssen richtig gelöst werden.
  Falsche Antworten: „Noch nicht! Versuch es noch einmal.“ Die Aufgabe bleibt dieselbe, es gibt keine Strafe.
  Richtige Antwort: „Richtig! Super!“, dann kommt automatisch die nächste.
- Danach erscheint der Held am letzten Checkpoint, ist gut 2 Sekunden unverwundbar (blinkt) und es heißt wieder „Bereit? Los!“.
- **0 Herzen:** „Oh nein! Alle Herzen sind weg.“ Nach den drei Aufgaben gibt es ein Wiederbelebungsherz.
  Alternativ kann das Kind das Level neu starten. Niemand verliert seinen Fortschritt.

**Aufgaben:** nur Plus und Minus, Zahlenraum 0–50, nie negativ. Fünf Stufen: bis 10 · bis 20 ohne Zehnerübergang ·
bis 20 mit Zehnerübergang · bis 50 ohne Übergang · bis 50 mit Übergang. Die ersten Aufgaben überhaupt sind immer
aus Stufe 1. Danach richtet sich die Stufe nach der Welt (Welt 1 → Stufe 1, Welt 4 → Stufe 4). Wer zweimal hintereinander
alles auf Anhieb richtig hat, bekommt eine Stufe schwerer; wer sich oft schwertut, eine leichter.
Die erste Aufgabe jedes Fensters ist zum Aufwärmen eine Stufe leichter.

### Bosskampf (eine Taste)

1. Der Boss holt sichtbar aus (er lehnt sich zurück, ein rotes „!“ erscheint).
2. Er wirft etwas, das über den Boden auf Blitz zurollt. Ein gelber Ring zieht sich um Blitz zusammen.
   Wird er **grün** („Spring!“), drücken: Blitz springt drüber. Das Zeitfenster ist mindestens 0,4 s lang.
3. Nach 2–3 Ausweichern ist der Boss benommen (Sterne kreisen). „Jetzt angreifen!“ – drücken, Blitz saust hin, Treffer!
4. Nach 3–5 Treffern ist der Boss besiegt, wird freundlich und es regnet Konfetti.

Verpasste Würfe kosten nur einen von drei Kraftblitzen. Sind alle weg, zählt das wie ein Unfall (ein Herz, Mathefenster).
Danach geht es mit voller Kraft weiter, und der Boss behält seinen Schaden. Eine verpasste Angriffschance wird nicht bestraft.

### Belohnungen und Fortschritt

- **Münzen** (Gesamtzahl wird gespeichert), **3 Sterne pro Level** (an etwas kniffligen Stellen; einmal gefunden, bleiben sie
  gefunden), **Welt-Abzeichen** (alle drei Level einer Welt geschafft) und **Boss-Trophäen**.
- Ein besiegter Boss schaltet die nächste Welt frei. „Spielen“ setzt an der nächsten offenen Etappe fort, auch am zuletzt
  erreichten Checkpoint.
- Gespeichert wird im `localStorage` des Browsers unter `blitzheld.save.v1`: freigeschaltete Welten, geschaffte Level,
  Sterne, beste Münzzahl und Zeit je Level, besiegte Bosse, Gesamtmünzen, letzter Checkpoint, Einstellungen und Lernstand.
  „Hilfe → Spielstand löschen“ setzt alles nach einer Sicherheitsabfrage zurück.

### Fairness und Hilfen

- Die Kollisionsbox des Helden (28 × 46 px) ist deutlich kleiner als die Figur, die der Hindernisse ein paar Pixel kleiner als
  deren Grafik.
- Sprungpuffer (0,15 s): Ein Druck kurz vor der Landung wird ausgeführt. Coyote-Zeit (0,1 s): Kurz nach einer Kante darf
  noch gesprungen werden.
- Nach **3 Unfällen im selben Level** wird es automatisch etwas langsamer und großzügiger („Rückenwind!“), nach 6 noch etwas mehr.
- **Hilfsmodus** (Hilfe → Hilfsmodus): 20 % langsamer, größere Sprungtoleranz, kleinere Kollisionsbox, längere
  Unverwundbarkeit, langsamere Bossangriffe mit längerem Zeitfenster und gelbe Sprungpfeile vor jeder Gefahr.
  Erleichtert wird über die Spielgeschwindigkeit: Sprungweiten bleiben gleich, jedes Level bleibt also garantiert schaffbar.
  Die Rechenaufgaben bleiben Pflicht.

## Technik

- **TypeScript**, **Vite**, **Phaser 3** (Darstellung), Oberfläche in HTML/CSS
- Spiellogik ohne Phaser (feste Schrittweite 1/120 s), dadurch in Node testbar
- Grafiken prozedural (Canvas 2D → Phaser-Texturen), Töne und Musik per Web Audio. Ton erst nach der ersten Eingabe,
  komplett abschaltbar. Das Spiel funktioniert auch ganz ohne Ton.
- `?renderer=canvas` an der Adresse erzwingt den Canvas-Renderer (für sehr alte Geräte ohne WebGL).

```
blitzheld/
├── index.html, assets/          fertiger Build (von `npm run build` erzeugt, für GitHub Pages)
├── src/
│   ├── index.html               Seite mit allen Bildschirmen (Menü, HUD, Mathefenster …)
│   ├── main.ts                  Einstieg: Schrift laden, Phaser starten, Controller verbinden
│   ├── config/                  gameConfig.ts (Physik, Zeiten, Größen), difficulty.ts (Hilfsmodus, Erleichterung)
│   ├── core/                    stateMachine.ts (Spielzustände), gameController.ts (Ablauf Tod → Mathe → Wiedereinstieg,
│   │                            Belohnungen, Speichern), input.ts (eine Taste), rng.ts
│   ├── game/                    levelSim.ts (Spieler, Bewegung, Kollisionen, Checkpoints), collision.ts,
│   │                            levelBuilder.ts (Baukasten für Level), solver.ts (automatischer Löser für Tests), types.ts
│   ├── levels/                  world1–4.ts (12 Level), catalog.ts
│   ├── math/                    mathTasks.ts (Aufgabengenerator), mathChallenge.ts (Mathefenster-Logik, Lernstand)
│   ├── boss/                    bossConfig.ts (4 Bosse), bossFight.ts (rhythmische Kampflogik)
│   ├── progress/                saveData.ts (Speicherstand, Freischaltung, Bestleistungen)
│   ├── audio/                   audio.ts (Soundeffekte und Melodien per Web Audio)
│   ├── render/                  textures.ts, bossArt.ts (prozedurale Grafiken), hero.ts (animierter Held),
│   │                            backgrounds.ts (Parallax), effects.ts (Partikel), scenes/ (Boot, Menü, Level, Boss)
│   ├── ui/                      ui.ts (DOM-Oberfläche), icons.ts (SVG-Symbole)
│   ├── styles/main.css
│   └── debug.ts                 Testschnittstelle window.__blitz (für die Browsertests)
├── tests/unit/                  Vitest
├── tests/e2e/run.mjs            Playwright-Browsertests
└── tools/clean.mjs              entfernt den alten Build vor dem neuen
```

**Spielzustände:** `MENU → RESPAWNING („Bereit? Los!“) → PLAYING → DYING → MATH_CHALLENGE → RESPAWNING → PLAYING`,
dazu `PAUSED`, `BOSS_FIGHT`, `LEVEL_COMPLETE`, `GAME_COMPLETE`. Ungültige Wechsel lehnt der Automat ab. Ein Leben wird nur beim
gelungenen Wechsel nach `DYING` abgezogen, deshalb kann ein Unfall nie zwei Herzen kosten. Der Game-Loop läuft nur in
`PLAYING` bzw. `BOSS_FIGHT`.

## Offene Punkte

- Getestet wurde in Chromium (Desktop und simuliertes Smartphone). Auf echten iPhones, iPads und Android-Geräten ist das
  Spiel nicht ausprobiert. Touch wurde nur per Emulation geprüft.
- Im Testcontainer gibt es keine Grafikkarte, deshalb lief WebGL dort nur mit Software-Rendering (ca. 18–20 Bilder/s).
  Die Spielzeit läuft trotzdem korrekt in Echtzeit, aber flüssige 60 Bilder/s auf echten Geräten sind nicht gemessen.
- Töne und Melodien sind einfache Synthesizer-Klänge. Gehört hat sie bisher niemand.
- Kein Offline-Modus (PWA) – für das erste Laden braucht es eine Verbindung.
- Balance (Geschwindigkeit, Abstände, Schwierigkeit der Aufgaben) ist am Rechner abgeschätzt und vom Löser abgesichert,
  aber noch nicht mit einem Kind ausprobiert.
