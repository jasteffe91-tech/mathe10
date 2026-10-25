# Towerfall – Die letzte Bastion

Klassisches Tower-Defense-Spiel für den Browser. Gegner laufen einen geschwungenen Weg entlang zur
Bastion; du baust an festen Bauplätzen Türme, verbesserst sie und kombinierst ihre Stärken.
Werbefrei, ohne Konto, ohne Tracking, ohne externe Dienste. Nach dem ersten Laden offline spielbar (PWA).

Aufruf (GitHub Pages): `https://jasteffe91-tech.github.io/mathe10/towerfall/`

## Inhalt

- **5 Karten** mit eigener Landschaft. Jede weitere Karte wird freigeschaltet, sobald du auf der vorherigen
  Welle 10 erreichst:

| Karte | Landschaft | Besonderheit |
|---|---|---|
| Grünental | Wiesen und Wälder | Einstieg, lange gewundene Route |
| Felsenpass | Geröll und Nadelwald, Pflasterweg | kurze Route, wenig Reaktionszeit |
| Sumpfgabel | Nebelsumpf, Bohlenwege, Glühwürmchen | zwei Eingänge, die Wege treffen sich in der Mitte |
| Frostgipfel | Schnee, Fichten, Schneefall | lange Serpentinen, Plätze zwischen den Kehren, stärkere Gegner |
| Wüstenschlucht | Sand, Kakteen, Oase | Spirale mit der Bastion in der Mitte, deutlich stärkere Gegner |
- **20 Wellen** mit Bosswellen in Welle 5, 10, 15 und 20
- **3 Schwierigkeitsgrade:** Entspannt (30 Leben), Normal (20), Hart (10)
- **8 Türme** mit je 3 Stufen, umschaltbarer Zielwahl (Vorderster, Hinterster, Stärkster, Nächster)
  und Verkauf zu 70 % des investierten Goldes

| Turm | Preis | Rolle |
|---|---|---|
| Pfeilturm | 70 | schnell, günstig, schwach gegen Panzerung |
| Kanonenturm | 120 | langsam, Flächenschaden |
| Frostturm | 90 | verlangsamt Gegner im Trefferbereich |
| Blitzturm | 140 | Kettenblitz über 3–6 Gegner, halbiert Panzerung |
| Scharfschützenturm | 160 | riesige Reichweite, durchschlägt Panzerung, zielt auf den Stärksten |
| Giftschleuderer | 110 | Gift auf alle Gegner im Umkreis, ignoriert Panzerung |
| Speerschleuder | 130 | Speer durchbohrt bis zu 5–10 Gegner auf einer Linie |
| Kriegsbanner | 140 | greift nicht an; Türme in Reichweite +20–40 % Schaden, +10–20 % Feuerrate (stapelt nicht) |

| Gegner | Besonderheit |
|---|---|
| Plünderer | ausgewogen |
| Flitzer | schnell, wenig Leben |
| Eisenwache | langsam, Panzerung 5 |
| Schwärmer | winzig, in großen Gruppen |
| Schamane | heilt Gegner in der Nähe |
| Ogerhäuptling (Boss) | ruft Schwärmer, wird unter 35 % Leben wütend und schneller |
| Schattentitan (Endboss) | Panzerung 6, kaum zu verlangsamen, schickt Flitzer voraus |

**Wirtschaft:** nur Gold. Gold gibt es für besiegte Gegner, für jede überstandene Welle und als Bonus,
wenn du die nächste Welle früher startest. Keine Echtgeldkäufe, keine Wartezeiten.

## Starten

Es gibt keinen Build-Schritt und keine Abhängigkeiten – nur statische Dateien mit nativen ES-Modulen.

```bash
cd towerfall
npm start            # = node tools/serve.mjs 8080  →  http://localhost:8080/
```

Jeder andere statische Webserver geht auch (z. B. `python3 -m http.server`). Direktes Öffnen der
`index.html` per Doppelklick (`file://`) funktioniert **nicht**, weil Browser ES-Module und Service
Worker dort blockieren.

## Offline spielen und installieren

1. Spiel einmal über **https** (z. B. GitHub Pages) oder **http://localhost** öffnen. Nur dort
   erlauben Browser einen Service Worker.
2. Warten, bis im Hauptmenü **„✓ Offline spielbar“** steht. Dann sind alle Dateien auf dem Gerät gespeichert.
3. Ab jetzt startet das Spiel auch ohne Internet – im Browser unter derselben Adresse oder als App.

**Installieren:**
- Chrome/Edge (Desktop, Android): Knopf „Als App installieren“ im Hauptmenü oder Installieren-Symbol in der Adressleiste.
- Safari (iPhone/iPad): Teilen → „Zum Home-Bildschirm“.

Für die allererste Bereitstellung braucht es eine Verbindung. Danach werden keine Daten mehr
geladen oder gesendet. Spielstände, Bestleistungen und Einstellungen liegen im `localStorage` dieses Browsers.

## Steuerung

- **Maus/Touch:** Bauplatz antippen → Turm im Baumenü wählen → nochmal antippen (oder „Bauen“).
  Alternativ zuerst den Turm wählen und dann auf einen leuchtenden Bauplatz tippen.
  Turm antippen → verbessern, Zielwahl ändern, verkaufen. Rechtsklick hebt die Auswahl auf.
- **Tastatur:** `1`–`8` Turm · Pfeiltasten Bauplatz wechseln · `Enter` bauen/verbessern ·
  `U` verbessern · `V` verkaufen · `T` Zielwahl · `Leertaste` Pause · `N` nächste Welle · `F` Tempo · `Esc` Menü

## Speichern

| Was | Schlüssel | Wann |
|---|---|---|
| Einstellungen | `towerfall.settings.v1` | sofort bei Änderung |
| Fortschritt (höchste Welle, Bestleistung, Siege je Karte und Schwierigkeit) | `towerfall.progress.v1` | bei Wellenstart und Partieende |
| Laufender Spielstand | `towerfall.save.v1` | zwischen den Wellen und nach jeder Turmänderung in der Pause |

Gespeichert wird der laufende Spielstand nur **zwischen** den Wellen – dann ist er vollständig durch
Gold, Leben, Wellennummer und Türme beschrieben. Wer mitten in einer Welle abbricht, setzt vor dieser
Welle wieder ein. „Einstellungen → Zurücksetzen“ löscht alles (mit Sicherheitsabfrage).

## Tests

```bash
npm test               # Spielmechanik, Balance-Bot, Speicherung, Service-Worker-Liste (node --test)
npm run test:browser   # echter Browser via Playwright: Bauen per Maus/Touch/Tastatur, Pause, Tempo,
                       # Einstellungen nach Neuladen, Offline-Start, Layout auf Smartphone/Tablet
```

`test:browser` braucht Playwright mit Chromium (`npm i -D playwright && npx playwright install chromium`).
Screenshots landen in `towerfall/.shots/` (nicht im Repository).

Der **Balance-Bot** (`tests/helpers/bot.js`) baut nach einem festen Plan an den Plätzen mit der meisten
Wegabdeckung. Die Tests sichern ab: ohne Türme verliert man nach wenigen Wellen, nur mit Pfeiltürmen
vor dem Ende, mit gemischter Verteidigung gewinnt man Grünental auf Normal.

## Architektur

```
towerfall/
├── index.html, css/style.css     Oberfläche (keine externen Schriften/Bilder)
├── manifest.webmanifest, sw.js   PWA: Installierbarkeit, Offline-Cache (cache first)
├── icon*.png, icon.svg           Icons (PNG erzeugt mit `npm run icons`)
├── js/
│   ├── main.js                   Einstieg: Bildschirme, Spielablauf, Dialoge, Verbindung aller Teile
│   ├── config/                   ALLE Spielwerte – getrennt von der Engine
│   │   ├── balance.js            Startgold, Verkaufsquote, Wellenpause, HP-Wachstum, Schwierigkeitsgrade, Simulationstakt
│   │   ├── towers.js             Türme mit Werten je Stufe
│   │   ├── enemies.js            Gegnertypen
│   │   ├── waves.js              Wellenzusammensetzung
│   │   └── maps.js               Karten: Route, Bauplätze, Deko, Farben
│   ├── core/                     loop.js (feste Schrittweite, Pause, Tempo), rng.js, math.js
│   ├── game/                     Simulation ohne DOM – in Node testbar
│   │   ├── game.js               Spielzustand, Simulationsschritt, Bauen/Verbessern/Verkaufen, Speichern
│   │   ├── path.js               Route (Catmull-Rom-Spline → Polylinie mit Längen)
│   │   ├── enemies.js            Bewegung, Panzerung, Frost, Gift, Heilen, Beschwören, Wut
│   │   ├── towers.js             Zielwahl und Angriffe (Geschoss, Bogen, Kette, Sofort)
│   │   ├── projectiles.js        Geschossflug, Neuausrichtung, Einschlag
│   │   ├── waves.js              Phasen (Aufbau, Pause, Welle), Spawner
│   │   └── economy.js            Gold, Verkaufswert, Boni
│   ├── render/                   Canvas 2D: renderer.js (inkl. Atmosphäre), terrain.js (vorgerendert, je Thema),
│   │                             sprites.js (Türme in 3/4-Ansicht, Gegner, Geschosse), effects.js (Partikel, Licht)
│   ├── ui/                       controller.js (Auswahl/Aktionen), panel.js, hud.js, input.js, modal.js, format.js
│   ├── storage.js                localStorage mit Fallback im Speicher
│   ├── audio.js                  Soundeffekte per Web Audio API (keine Audiodateien)
│   └── pwa.js                    Service-Worker-Registrierung, Installationsangebot, Offline-Status
├── tests/                        node:test-Tests, Balance-Bot, Browser-Check
└── tools/                        serve.mjs (Mini-Webserver), icons.mjs
```

**Simulation:** `GameLoop` sammelt die echte Zeit (× Tempo) und ruft `game.step(1/60)` so oft wie nötig.
Dadurch läuft das Spiel bei 30, 60 oder 144 FPS exakt gleich (per Test geprüft). Pause stoppt die
Simulation komplett – auch Wellen-Countdown und Spawner. Die Darstellung interpoliert Positionen zwischen
zwei Schritten.

**Reihenfolge je Schritt:** Wellen erzeugen Gegner → Gegner bewegen sich (Statuseffekte, Fähigkeiten) →
Türme zielen und feuern → Geschosse treffen → tote Objekte werden aus den Listen entfernt. Getötete oder
angekommene Gegner werden sofort als `alive = false` markiert, damit kein Turm im selben Schritt noch auf
sie zielt. Einzelgeschosse merken sich ihren erwarteten Schaden (`incoming`), damit Türme keine Gegner
beschießen, die ohnehin fallen; fällt ein Ziel vorher, suchen Pfeile ein neues in der Nähe.

**Ereignisse:** `game.on('shot' | 'impact' | 'enemyDeath' | 'leak' | 'waveStart' | …)` – Effekte, Sound
und Oberfläche hängen sich daran, die Simulation kennt sie nicht.

## Erweitern

**Neue Karte** – in `js/config/maps.js` einen Eintrag ergänzen:

```js
{
  id: 'sumpf', name: 'Nebelsumpf', subtitle: '…', difficultyHint: 'Schwer',
  waves: 'classic',        // Wellensatz aus waves.js
  hpMult: 1.1,             // optional: Gegner stärker
  pathWidth: 44, seed: 5,  // seed bestimmt die Deko
  unlock: { map: 'felsenpass', wave: 15 },   // optional
  theme: 'swamp',          // meadow | rock | swamp | snow | desert – bestimmt Boden, Deko, Weg und Atmosphäre
  path: [[-50, 300], [200, 280], …],         // Kontrollpunkte, werden geglättet; Start außerhalb des Bildes
  // oder mehrere Eingänge: paths: [[…], […]] – Gegner verteilen sich abwechselnd, Wege sollten an der Bastion enden
  base: { x: 1180, y: 400 },                 // Bastion am Ende der Route
  spots: [{ x: 300, y: 200 }, …],            // Bauplätze, ca. 60–70 px neben dem Weg
  ponds: [{ x: 600, y: 80, rx: 80, ry: 40 }],
  palette: { grass, grassDark, grassLight, path, pathEdge },
}
```

`npm test` prüft automatisch, dass Bauplätze nicht auf dem Weg, auf der Bastion oder übereinander liegen.
Wenn die Datei `sw.js` neue Dateien braucht, dort eintragen und `CACHE` hochzählen.

**Neuer Turm** – in `js/config/towers.js` ein Objekt mit `attack` (`projectile`, `shell`, `chain`,
`instant`, `pierce`, `aura`), Farben und `levels` anlegen und die ID in `TOWER_ORDER` aufnehmen. Werte wie `splash`,
`slow`, `poisonDps`, `chains`, `pierceCount`, `armorPierce`, `auraDamage`/`auraRate` wirken automatisch. Für das Aussehen eine Zeichenfunktion
in `js/render/sprites.js` (`drawTower`) ergänzen.

**Neuer Gegner** – in `js/config/enemies.js` ergänzen (`hp`, `speed`, `armor`, `reward`, `damage`,
`radius`, optional `heal`, `summon`, `boss`, `slowResist`), Zeichenfunktion in `drawEnemy` hinzufügen und
in `waves.js` verwenden.

**Balancing** – alle Zahlen stehen in `js/config/`. Nach Änderungen `npm test` laufen lassen; die
Balance-Tests melden, wenn das Spiel zu leicht oder unschaffbar wird.

**Nach jeder Änderung an ausgelieferten Dateien:** `CACHE` in `sw.js` hochzählen (`towerfall-v2` …),
sonst behalten installierte Geräte die alte Version.

## Bekannte Einschränkungen

- Der Spielstand wird nur zwischen Wellen gesichert (siehe oben).
- Auf sehr schmalen Smartphones im Hochformat ist das Spielfeld klein; Querformat spielt sich besser.
- Safari unter iOS zeigt keinen Installieren-Knopf – dort über „Teilen → Zum Home-Bildschirm“.
- Löscht der Browser die Website-Daten (z. B. privater Modus, Speicher voll), sind Spielstand und
  Bestleistungen weg. Das Hauptmenü warnt, wenn dauerhaftes Speichern nicht möglich ist.
- Die Balance ist mit dem Bot abgestimmt (Ergebnis siehe unten) und für Grünental einmal von Hand
  durchgespielt; die neuen Karten sind noch nicht von Menschen probegespielt.

### Balance-Stand (Bot, gemischte Verteidigung inkl. neuer Türme)

| Karte | Entspannt | Normal | Hart |
|---|---|---|---|
| Grünental | gewonnen | gewonnen | verloren (Welle 5–20) |
| Felsenpass | gewonnen | verloren (Welle 20) | verloren |
| Sumpfgabel | gewonnen | verloren (Welle 20) | verloren |
| Frostgipfel | gewonnen | gewonnen, knapp | verloren |
| Wüstenschlucht | gewonnen | verloren (Welle 10–20) | verloren |

Ein Mensch, der Türme gezielt kombiniert, spielt deutlich besser als der Bot.
