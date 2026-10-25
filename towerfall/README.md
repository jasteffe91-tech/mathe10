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
- **Freies Bauen auf einem Raster** (32 px je Zelle, 40 × 22 Zellen): Jeder Turm belegt seine Grundfläche;
  Wege, Wasser, Bastion, Hindernisse und andere Türme sind tabu. Bäume, Steine, Felsbrocken und Ruinen
  lassen sich gegen Gold räumen, Klippen und Wasser nicht.
- **2 Geländemodi:** *Normal* (wenige Hindernisse, alles bebaubar) und *Fortgeschritten* (Flüsse mit Brücken,
  Klippen, Ruinen, dichter Wald, Bauzone nur bis 200 px vom Weg, Klippen/Mauern blockieren die Sicht;
  +60 Startgold fürs Räumen, ×1,3 Punkte)
- **9 Türme** mit je 3 Stufen, umschaltbarer Zielwahl (Vorderster, Hinterster, Stärkster, Nächster),
  Verkauf zu 70 % und Versetzen gegen eine kleine Gebühr (10 % des investierten Goldes, mind. 5 G)

| Turm | Preis | Grundfläche | Rolle |
|---|---|---|---|
| Pfeilturm | 70 | 1 × 1 | schnell, günstig, schwach gegen Panzerung |
| Kanonenturm | 120 | 2 × 2 | langsam, Flächenschaden |
| Frostturm | 90 | 1 × 1 | verlangsamt Gegner im Trefferbereich (stapelt nicht, max. 70 %) |
| Blitzturm | 140 | 2 × 2 | Kettenblitz über 3–6 Gegner, halbiert Panzerung |
| Scharfschützenturm | 160 | 1 × 1 | riesige Reichweite, durchschlägt Panzerung, zielt auf den Stärksten |
| Giftschleuderer | 110 | 1 × 1 | Gift auf alle Gegner im Umkreis, ignoriert Panzerung |
| Speerschleuder | 130 | 2 × 1, drehbar | Speer durchbohrt bis zu 5–10 Gegner auf einer Linie |
| Kriegsbanner | 140 | 2 × 2 | greift nicht an; Türme im Radius 140–170 px: +20–40 % Schaden, +10–20 % Feuerrate, längere Verlangsamung, Stufe 3 auch +10 % Reichweite (stapelt nicht) |
| Tribok | 240 | 3 × 3 | Belagerungsgeschütz, 250–290 px Reichweite, trifft nichts unter 80 px, +60–100 % Schaden gegen große Gegner |

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

- **Bauen:** Turm im Baumenü wählen → auf der Karte erscheint das Raster mit Vorschau (grün = passt,
  gelb = Position passt, aber zu wenig Gold, rot = belegt; nur die betroffenen Zellen sind rot) →
  bestätigen. Erst dann wird bezahlt.
  - *Maus:* Vorschau folgt dem Zeiger, Klick baut, Umschalt+Klick baut und bleibt im Baumodus, Rechtsklick bricht ab.
  - *Finger:* tippen oder ziehen setzt die Vorschau, ein zweiter Tipp auf dieselbe Stelle oder „Bauen“
    bestätigt. Die Pfeil-Knöpfe im Panel verschieben die Vorschau zellgenau.
  - Steht ein räumbares Hindernis im Weg, bietet das Panel „… räumen“ direkt an.
- **Turm antippen:** verbessern, Zielwahl ändern, versetzen (der Turm bleibt bis zur Bestätigung stehen
  und schießt weiter), verkaufen.
- **Hindernis antippen:** Eigenschaften (Fläche, passierbar, sichtblockierend, Aufwand) und „Räumen“.
- **Tastatur:** `1`–`9` Turm · Pfeiltasten Vorschau verschieben (sonst Türme durchblättern) · `R` drehen ·
  `Enter` bauen/bestätigen · `Esc` abbrechen · `M` versetzen · `C` Hindernis räumen · `U` verbessern ·
  `V` verkaufen · `T` Zielwahl · `Leertaste` Pause · `N` nächste Welle · `F` Tempo

## Speichern

| Was | Schlüssel | Wann |
|---|---|---|
| Einstellungen | `towerfall.settings.v1` | sofort bei Änderung |
| Fortschritt (höchste Welle, Bestleistung, Siege je Karte und Schwierigkeit) | `towerfall.progress.v1` | bei Wellenstart und Partieende |
| Laufender Spielstand | `towerfall.save.v1` | zwischen den Wellen und nach jedem Bauen, Versetzen, Räumen in der Pause |

Gespeichert wird der laufende Spielstand nur **zwischen** den Wellen – dann ist er vollständig durch
Gold, Leben, Wellennummer, Modus, Türme (Ankerzelle, Drehung, Stufe) und die IDs geräumter Hindernisse
beschrieben (Hindernisse entstehen je Karte und Modus immer gleich). Spielstände aus der Zeit der festen
Bauplätze (Format 1) werden übernommen: Jeder Turm landet auf der nächsten freien Rasterposition an
seinem alten Platz; passt er nirgends, wird sein Gold erstattet. Wer mitten in einer Welle abbricht, setzt vor dieser
Welle wieder ein. „Einstellungen → Zurücksetzen“ löscht alles (mit Sicherheitsabfrage).

## Tests

```bash
npm test               # Spielmechanik, Raster, Balance-Bot, Speicherung, Service-Worker-Liste (node --test)
npm run test:browser   # echter Browser via Playwright: Vorschau, Bauen per Maus/Touch/Tastatur, ungültige
                       # Positionen, Räumen, Versetzen, Pause, Tempo, Offline-Start, Smartphone/Tablet
```

`test:browser` braucht Playwright mit Chromium (`npm i -D playwright && npx playwright install chromium`).
Screenshots landen in `towerfall/.shots/` (nicht im Repository).

`tests/grid.test.js` deckt das Raster ab: Zellbelegung je Grundfläche (1 × 1 bis 3 × 3, Drehung),
Überlappung, Weg/Wasser/Bastion/Kartenrand, kein Goldabzug bei ungültigen Aktionen, Versetzen,
Hindernisse blockieren, Räumkosten und nicht entfernbare Klippen, Wege bleiben bei 300 zufälligen Bau-
und Räumaktionen je Karte und Modus passierbar, Sichtlinie, Mindestreichweite, Verlangsamungsdeckel,
Spielstand v2 und Übernahme von v1 sowie ein Leistungstest (60 Türme, 200 Gegner: < 8 ms je Schritt).

Der **Balance-Bot** (`tests/helpers/bot.js`) baut nach einem festen Plan an den Rasterpositionen mit der
meisten Wegabdeckung (räumt aber keine Hindernisse). Die Tests sichern ab: ohne Türme verliert man nach wenigen Wellen, nur mit Pfeiltürmen
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
│   │   ├── game.js               Spielzustand, Simulationsschritt, Wellen, Verbessern/Verkaufen (dünn, delegiert)
│   │   ├── grid.js               Raster: Welt ↔ Zelle, Belegungsebenen (Gelände/Hindernis/Turm), Sichtlinie
│   │   ├── terrainmap.js         Gelände je Zelle aus der Karte ableiten (Weg, Wasser, Brücke, Bastion, Bauzone)
│   │   ├── obstacles.js          Hindernisse deterministisch verteilen, Räumkosten
│   │   ├── placement.js          Platzierungsprüfung ohne Seiteneffekte (gültig/ungültig je Zelle, Begründung)
│   │   ├── routes.js             Zellen der Routen, Passierbarkeitsprüfung
│   │   ├── construction.js       Bauen, Versetzen, Räumen (erst prüfen, dann ändern)
│   │   ├── savegame.js           Spielstand v2, Übernahme v1
│   │   ├── path.js               Route (Catmull-Rom-Spline → Polylinie mit Längen)
│   │   ├── enemies.js            Bewegung, Panzerung, Frost, Gift, Heilen, Beschwören, Wut
│   │   ├── towers.js             Zielwahl und Angriffe (Geschoss, Bogen, Kette, Sofort)
│   │   ├── projectiles.js        Geschossflug, Neuausrichtung, Einschlag
│   │   ├── waves.js              Phasen (Aufbau, Pause, Welle), Spawner
│   │   └── economy.js            Gold, Verkaufswert, Boni
│   ├── render/                   Canvas 2D: renderer.js (Atmosphäre, Raster-Overlay, Vorschau), terrain.js
│   │                             (vorgerendert je Thema inkl. Hindernissen, Flüssen, Brücken),
│   │                             sprites.js (Türme in 3/4-Ansicht, Gegner, Geschosse), effects.js (Partikel, Licht)
│   ├── ui/                       controller.js (Auswahl, Bau-/Versetzmodus, Vorschau), panel.js, hud.js, input.js,
│   │                             modal.js, format.js
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

### Raster-Bausystem

- **Welt und Raster sind getrennt:** Die Spielwelt hat feste Koordinaten (1280 × 720), das Raster
  (`grid.js`) rechnet zwischen Welt und Zelle um. Türme speichern Ankerzelle, Drehung, belegte Zellen und
  ihren Mittelpunkt; Reichweite und Geschosse gehen vom Mittelpunkt aus. Die Darstellung skaliert nur das
  Bild – das Raster bleibt auf jedem Bildschirm gleich.
- **Drei Ebenen je Zelle:** Gelände (`grass`, `path`, `bridge`, `water`, `base`, `outside`), Hindernis-ID,
  Turm-ID. *Bebaubar* und *für Gegner passierbar* sind getrennte Eigenschaften (`config/terrain.js`).
- **Bestehende Karten ohne Neuzeichnen:** `terrainmap.js` leitet das Gelände aus den vorhandenen Routen,
  Teichen und der Bastion ab. Flüsse sind Linien; wo eine Route sie kreuzt, entsteht automatisch eine Brücke.
- **Platzierungsprüfung** (`placement.js`) ist frei von Seiteneffekten und liefert je Zelle gültig/ungültig
  plus Begründung. Bauen, Versetzen und Räumen (`construction.js`) prüfen zuerst vollständig – inklusive
  Gold – und ändern erst danach den Zustand. Versetzen tauscht alte und neue Fläche in einem Schritt.
- **Wege:** Gegner folgen weiterhin den festen Routen (keine Wegfindung nötig). `routes.js` ermittelt
  einmalig, welche Zellen jede Route berührt, und prüft bei jeder Kartenänderung, dass sie begehbar bleiben.
  Da Wegzellen nie bebaubar sind und Hindernisse nie auf Wegen liegen, kann keine Blockade entstehen –
  die Prüfung sichert das zusätzlich ab (Test mit 300 Zufallsaktionen je Karte und Modus). Gegner
  verändern nie ihre Position durch Bauaktionen.
- **Sichtlinie:** Klippen und Ruinenmauern (`blocksSight`) versperren Türmen die Sicht. Die Prüfung läuft
  nur, wenn eine Karte solche Hindernisse hat, und tastet die Linie in halben Zellschritten ab.
- **Leistung:** Platzierungsvorschau prüft nur die Zellen der Grundfläche und nur bei Zellwechsel; das
  Raster-Overlay ist ein zwischengespeichertes Bild, das nur bei Änderungen neu entsteht; der Hintergrund
  wird nur nach dem Räumen neu gezeichnet.

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
  spots: [{ x: 300, y: 200 }, …],            // optional: frühere feste Bauplätze (nur für alte Spielstände)
  ponds: [{ x: 600, y: 80, rx: 80, ry: 40 }],   // Wasser: nicht bebaubar
  advanced: {                                    // nur im fortgeschrittenen Modus
    rivers: [{ points: [[650, -20], [640, 110], …], width: 30, frozen: false }],  // Brücken entstehen automatisch
    ponds: [ … ],
    scatter: { tree: 40, stones: 14, rock: 8, wall: 4, cliff: 2 },   // überschreibt MODES.advanced.scatter
  },
  palette: { grass, grassDark, grassLight, path, pathEdge },
}
```

Bebaubare Fläche, Hindernisse und Brücken entstehen automatisch; `npm test` prüft u. a., dass Hindernisse
nie auf Wegen liegen, alle Wege passierbar sind und genug Bauland (auch für 3 × 3) vorhanden ist.
Wenn die Datei `sw.js` neue Dateien braucht, dort eintragen und `CACHE` hochzählen.

**Neues Hindernis / Gelände** – in `js/config/terrain.js` unter `OBSTACLES` mit `walkable`,
`blocksSight`, `blocksProjectiles`, `removable`, `costPerCell` anlegen, die Form in `obstacles.js`
(`shapeFor`) und das Aussehen in `render/terrain.js` (`drawObstacle`) ergänzen. Neue Geländearten unter
`TERRAIN` (mit `buildable`, `walkable`, `reason`).

**Neuer Modus** – in `MODES` (`scatter`, `maxBuildDistance`, `features`, `clearCostMult`, `startGoldBonus`,
`scoreMult`) ergänzen; die Moduswahl im Kartenmenü zeigt ihn automatisch an.

**Neuer Turm** – in `js/config/towers.js` ein Objekt mit `attack` (`projectile`, `shell`, `chain`,
`instant`, `pierce`, `aura`), `footprint` (`{ w, h, rotatable }`), `spriteScale`, Farben und `levels`
anlegen und die ID in `TOWER_ORDER` aufnehmen. Werte wie `splash`, `slow`, `poisonDps`, `chains`,
`pierceCount`, `armorPierce`, `minRange`, `largeBonus`, `auraDamage`/`auraRate`/`auraRange` wirken automatisch. Für das Aussehen eine Zeichenfunktion
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
- Die Balance ist mit dem Bot abgestimmt (Ergebnis siehe unten). Das Raster-Bausystem ist noch nicht von
  Menschen probegespielt; besonders Banner-Ballungen und der Tribok sollten im echten Spiel beobachtet werden.
- Gegner laufen auf festen Routen; Türme und Hindernisse beeinflussen den Weg nicht (siehe Erweiterungen).
- Auf dem Smartphone sind Rasterzellen klein (etwa 10 px). Zum genauen Platzieren gibt es die Pfeil-Knöpfe
  im Panel; Querformat oder Tablet sind angenehmer.
- Sichtlinien gelten für das Zielen; ein Geschoss, das bereits fliegt, wird von Hindernissen nicht aufgehalten.
- Die Hindernisse sind je Karte und Modus fest (nicht zufällig pro Partie) – Aufstellungen lassen sich so
  vergleichen und lernen.

### Balance-Stand (Bot mit allen Turmtypen, platziert an den Stellen mit der meisten Wegabdeckung, räumt nicht)

Normalmodus:

| Karte | Entspannt | Normal | Hart |
|---|---|---|---|
| Grünental | gewonnen (30 ♥) | gewonnen (20 ♥) | verloren W5 |
| Felsenpass | gewonnen (30 ♥) | verloren W20 | verloren W5 |
| Sumpfgabel | gewonnen (30 ♥) | gewonnen (20 ♥) | verloren W15 |
| Frostgipfel | gewonnen (30 ♥) | gewonnen (18 ♥) | verloren W5 |
| Wüstenschlucht | gewonnen (30 ♥) | gewonnen (18 ♥) | verloren W4 |

Fortgeschrittener Modus:

| Karte | Entspannt | Normal | Hart |
|---|---|---|---|
| Grünental | gewonnen (30 ♥) | gewonnen (20 ♥) | verloren W10 |
| Felsenpass | gewonnen (30 ♥) | verloren W20 | verloren W5 |
| Sumpfgabel | gewonnen (30 ♥) | gewonnen (20 ♥) | verloren W20 |
| Frostgipfel | gewonnen (30 ♥) | verloren W20 | verloren W5 |
| Wüstenschlucht | gewonnen (30 ♥) | verloren W5 | verloren W5 |

Durch das freie Bauen wurde das Spiel deutlich leichter; ein globaler Faktor (`BALANCE.enemyHpMult = 1.25`)
und angepasste Kartenfaktoren gleichen das aus. Ein Mensch, der Türme gezielt kombiniert und Hindernisse
räumt, spielt deutlich besser als der Bot.

## Nächste Erweiterungen mit dem größten Mehrwert

1. **Fallenleger** (1 × 1, baut Fallen auf Wegzellen) – nutzt das Raster direkt und macht Engstellen wertvoll.
2. **Karten mit offener Wegfindung** (Labyrinth-Modus): Gegner suchen ihren Weg selbst, Türme lenken sie um.
   Die Passierbarkeitsprüfung (`routes.js`) ist dafür schon vorbereitet und müsste auf eine Breitensuche
   über begehbare Zellen umgestellt werden.
3. **Feuerturm** (2 × 2, Brand über Zeit, entzündet Bäume?) und **Reparaturstation** für die Bastion.
4. **Brückenbau** im fortgeschrittenen Modus: Bauland jenseits von Flüssen erschließen.
5. **Kartenspezifische Wellen** statt eines gemeinsamen Wellensatzes.
