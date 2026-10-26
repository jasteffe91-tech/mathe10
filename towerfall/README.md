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
- **12 Türme** mit je 3 Stufen, umschaltbarer Zielwahl (Vorderster, Hinterster, Stärkster, Nächster),
  Verkauf zu 70 % und Versetzen gegen eine kleine Gebühr (10 % des investierten Goldes, mind. 5 G)

| Turm | Preis | Grundfläche | Schadensart | Rolle |
|---|---|---|---|---|
| Pfeilturm | 70 | 1 × 1 | ⚔ physisch | schnell, günstig, schwach gegen Panzerung |
| Kanonenturm | 120 | 2 × 2 | ✹ explosiv | langsam, Flächenschaden, trifft keine Flieger |
| Frostturm | 90 | 1 × 1 | ❄ Frost | verlangsamt Gegner im Trefferbereich (stapelt nicht, max. 70 %) |
| Blitzturm | 140 | 2 × 2 | ✦ Magie | Kettenblitz über 3–6 Gegner, halbiert Panzerung |
| Scharfschützenturm | 160 | 1 × 1 | ⚔ physisch | riesige Reichweite, durchschlägt Panzerung, zielt auf den Stärksten |
| Giftschleuderer | 110 | 1 × 1 | ☠ Gift | Gift auf alle Gegner im Umkreis, ignoriert Panzerung, trifft keine Flieger |
| Speerschleuder | 130 | 2 × 1, drehbar | ⚔ physisch | Speer durchbohrt bis zu 5–10 Gegner auf einer Linie |
| Kriegsbanner | 140 | 2 × 2 | – | greift nicht an; Türme im Radius 140–170 px: +20–40 % Schaden, +10–20 % Feuerrate, längere Verlangsamung, Stufe 3 auch +10 % Reichweite (stapelt nicht) |
| Tribok | 240 | 3 × 3 | ✹ explosiv | Belagerungsgeschütz, 250–290 px Reichweite, trifft nichts unter 80 px, +50–75 % Schaden gegen große Gegner, trifft keine Flieger |
| Flammenwerfer | 100 | 1 × 1 | 🔥 Feuer | schneller Feuerkegel (86–104 px, 50–60°), setzt alle Getroffenen in Brand (5–12 Schaden/s je Stufe, bis 3 Stufen, 3–3,5 s) |
| Schleimwerfer | 80 | 1 × 1 | ◉ Säure | lange Verlangsamung (30–40 % für 5–7 s) plus Säure (2–6/s), neuer Treffer erneuert die Dauer |
| Tesla-Spule | 150 | 2 × 2 | ✦ Magie | Entladung auf die nächsten 4–6 Gegner im Umkreis: Schaden und Schock (0,5–0,75 s Stillstand) |

Der Frostturm lässt Gegner außerdem nach 5–6 Treffern kurz **einfrieren** (0,6–0,9 s Stillstand).

**Statuseffekte** (ein gemeinsames System, `js/game/status.js`):

| Effekt | Quelle | Regel bei erneutem Treffer | Grenze |
|---|---|---|---|
| Verlangsamt | Frost | stärkere Verlangsamung gilt, Dauer = längere | Verlangsamungen addieren sich nie, max. 70 % |
| Verschleimt | Schleimwerfer | stärkere gilt, Dauer beginnt neu | zählt nicht zusätzlich zu Frost |
| Vergiftet | Giftschleuderer | stärkere Dosis gilt, Dauer = längere | ignoriert Panzerung |
| Brennt | Flammenwerfer | +1 Stufe (max. 3), Dauer beginnt neu | ignoriert Panzerung |
| Geschockt / Eingefroren | Tesla / Frost | wirkt nicht während einer Betäubung | danach 2,5 s immun (Bosse 6 s), Bosse stehen nur ein Drittel der Zeit |

Berserker in Raserei ignorieren alles, was bremst oder festhält; Schaden über Zeit wirkt weiter. Pause und
Spieltempo gelten für alle Effekte, weil sie im normalen Simulationsschritt laufen.

| Gegner | Besonderheit | ab Welle |
|---|---|---|
| Plünderer | ausgewogen | 1 |
| Flitzer | schnell, wenig Leben | 2 |
| Eisenwache | langsam, Panzerung 5 | 4 |
| Schwärmer | winzig, in großen Gruppen | 6 |
| Schamane | heilt Gegner in der Nähe | 8 |
| Geist | physischer Schaden nur 40 %, Blitz +25 % | 6 |
| Harpyie | fliegt geradlinig zur Bastion (gestrichelte Linie); Kanone, Tribok, Gift treffen nicht | 7 |
| Berserker | Raserei alle 8 s: schneller und frostimmun (rote Aura) | 8 |
| Runenhexer | lädt sichtbar auf und lähmt Türme in 100 px für 2,5 s | 11 |
| Elite-Gegner | goldener Rand: +60 % Leben, +2 Panzerung, doppelte Belohnung | 13 |
| Ogerhäuptling (Boss) | ruft Schwärmer, stampft (betäubt nahe Türme), wird unter 35 % Leben wütend | 5 |
| Schattentitan (Endboss) | Panzerung 6, −25 % physischer Schaden, stampft, schickt Flitzer voraus | 20 |

Neue Gegnerarten werden beim ersten Auftauchen in der Wellenvorschau und per Meldung erklärt. Wie die
Gegnerrollen gegen übermächtige Turm-Ballungen wirken, steht in [BALANCE.md](BALANCE.md).

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
  bestätigen. Erst dann wird bezahlt; Abbrechen kostet nie etwas.
  - *Maus:* Vorschau folgt dem Zeiger, Klick baut, Umschalt+Klick baut und bleibt im Baumodus, Rechtsklick bricht ab.
  - *Finger:* Die Vorschau folgt dem Finger, eine **Lupe** links oberhalb des Fingers (Rechtshänder;
    Einstellung „Lupe beim Bauen“ für Linkshänder, „Lupengröße“ Normal/Groß) zeigt Raster, Grundfläche
    (grün/rot) und ein Fadenkreuz vergrößert. Ist links oben kein Platz, weicht sie nach links, oben,
    rechts und erst zuletzt nach unten aus. **Loslassen baut nie** – gebaut wird nur mit „Bauen“.
    Nach einem Bau sind weitere Aktionen 0,4 s gesperrt, damit ein Doppeltipp nicht doppelt baut oder den
    neuen Turm verbessert. Die Pfeil-Knöpfe (Infobereich hochziehen) verschieben die Vorschau zellgenau.
  - Steht ein räumbares Hindernis im Weg, bietet das Panel „… räumen“ direkt an.
- **Smartphone-Ansicht:** Im Hochformat wird die Karte um 90° gedreht dargestellt (Türme, Gegner und Texte
  bleiben aufrecht) – sie ist so deutlich größer. Abschaltbar unter Einstellungen → „Karte im
  Hochformat drehen“. Unten liegen die Turmauswahl (zwei Reihen à 6 Türme mit Symbol, Name, Preis) und der Infobereich als
  *Bottom Sheet*: kompakt zeigt er nur das Wichtigste und die Hauptaktion (Bauen, Verbessern, Räumen),
  per Wischen am Griff öffnet er halb oder ganz. Kartentipps öffnen ihn nie. Im Querformat liegt die Karte
  in voller Höhe links, rechts eine schmale Spalte (Turmauswahl dort 4 × 3 nur mit Symbol und Preis). Am Desktop
  steht die Turmauswahl in zwei Reihen unter der Karte.
- **Turm antippen:** verbessern, Zielwahl ändern, versetzen (der Turm bleibt bis zur Bestätigung stehen
  und schießt weiter), verkaufen.
- **Hindernis antippen:** Eigenschaften (Fläche, passierbar, sichtblockierend, Aufwand) und „Räumen“.
- **Tastatur:** `1`–`9`, `0` und die beiden Tasten daneben (deutsch `ß` `´`) wählen die 12 Türme (nochmal = abbrechen) ·
  Pfeiltasten verschieben die Vorschau; **ist ein Turm ausgewählt, versetzen sie ihn** (Vorschau zellweise,
  `Enter` bestätigt mit der üblichen Gebühr, `Esc` bricht kostenlos ab, ungültige Stellen werden rot und nie
  übernommen) – Richtung wie auf dem Bildschirm, auch bei gedrehter Karte, die Lupe folgt · `,`/`.` Türme
  durchblättern · `R` drehen · `Enter` bauen/bestätigen (nur im Bau- oder Versetzmodus) · `Esc` abbrechen · `M` versetzen · `C` Hindernis räumen · `U` verbessern ·
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
npm test               # Spielmechanik, Raster, Gegnerrollen, Platzierung, Ansicht, Balancekriterien (node --test)
npm run test:browser   # echter Browser via Playwright: Bauen per Maus/Touch/Tastatur, Räumen, Versetzen,
                       # Pause, Tempo, Offline-Start, Smartphone/Tablet; Lupe und Präzisionsplatzierung;
                       # Robustheit (keine Textauswahl, abgebrochene Gesten, Fokusverlust, Pfeiltasten)
npm run measure:map    # Kartenfläche auf iPhone-Viewports (Browser-Simulation)
npm run balance        # Balance-Tabelle aller Strategien (siehe BALANCE.md)
```

`tests/placement.test.js` prüft die Bausteuerung ohne Browser: Touch-Tipps und Ziehen bauen nie, „Bauen“
baut genau einmal mit genau einem Abzug (auch bei Doppeltipp und Enter-Enter), Abbrechen ist kostenlos,
Vorschau und Bau nutzen an jeder Zelle dieselbe Prüfung, beim Bestätigen wird neu geprüft, Touch und
Tastatur führen zur selben Vorschau, die Vorschau bleibt an allen Rändern im Raster, die Umrechnung
Bildschirm ↔ Welt stimmt hin und zurück (gedreht und ungedreht) und die Lupe liegt nie außerhalb des
Spielfelds oder unter dem Finger.

`tests/status.test.js` prüft die Statuseffekte und neuen Türme: Brand-Stufen und Ablauf, Tod während eines
Effekts, Schleim-Erneuerung ohne Addition (auch mit Frost), Deckel, Schock mit Immunität und Boss-Regeln,
Raserei-Immunität, Einfrieren nach Frosttreffern, Pause und Tempo, Feuerkegel (nur im Kegel und in Reichweite),
Tesla (höchstens n Ziele, jeder einmal), Kettenblitz ohne Doppeltreffer, Bau und Verbesserung aller 12 Türme.

`tests/browser/robustness.mjs` prüft, dass auf der Spieloberfläche nichts markiert werden kann (Doppelklick,
langes Drücken), eine hängende Markierung sofort verschwindet, abgebrochene Gesten und Fokusverlust Lupe und
Ziehen zurücksetzen und die Pfeiltasten einen ausgewählten Turm versetzen (nicht aber in Eingabefeldern).

`tests/browser/placement.mjs` simuliert iPhone SE (DPR 2), iPhone 14 (DPR 3, hoch und quer) und ein
Android-Gerät (DPR 2,625): schnelles Ziehen, Pixelvergleich Lupe ↔ Spielfeld, alle vier Kartenränder und
darüber hinaus, Drehen des Geräts mitten im Bauen, Doppeltipp auf „Bauen“, Bottom Sheet, Tastatur mit Lupe.
**Das sind Browser-Simulationen** (Chromium mit Touch-Emulation), keine Tests auf echten iPhones.

`test:browser` braucht Playwright mit Chromium (`npm i -D playwright && npx playwright install chromium`).
Screenshots landen in `towerfall/.shots/` (nicht im Repository).

`tests/grid.test.js` deckt das Raster ab: Zellbelegung je Grundfläche (1 × 1 bis 3 × 3, Drehung),
Überlappung, Weg/Wasser/Bastion/Kartenrand, kein Goldabzug bei ungültigen Aktionen, Versetzen,
Hindernisse blockieren, Räumkosten und nicht entfernbare Klippen, Wege bleiben bei 300 zufälligen Bau-
und Räumaktionen je Karte und Modus passierbar, Sichtlinie, Mindestreichweite, Verlangsamungsdeckel,
Spielstand v2 und Übernahme von v1 sowie ein Leistungstest (60 Türme, 200 Gegner: < 8 ms je Schritt).

Die **Balance-Tests** spielen mit sechs Strategie-Bots (`tests/helpers/strategies.js`) echte Partien und
prüfen die Kriterien aus [BALANCE.md](BALANCE.md) (z. B. „keine Strategie gewinnt alle Karten fehlerfrei“,
„die Ballung an einer Stelle ist nicht automatisch die beste Strategie“).

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
│   │   ├── ui.js                 Lupe (Größe, Zoom, Abstände, bevorzugte Lage)
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
│   │   ├── telemetry.js          Zähler für Balance-Auswertungen (Schaden je Turm/Gegner, Durchbrüche)
│   │   ├── status.js             Statuseffekte (Verlangsamung, Schleim, Gift, Brand, Schock, Einfrieren)
│   │   └── economy.js            Gold, Verkaufswert, Boni
│   ├── render/                   Canvas 2D: renderer.js (Ansicht inkl. Drehung im Hochformat, Raster-Overlay,
│   │                             Vorschau), terrain.js (vorgerendert je Thema und Ansicht), sprites.js (Türme in
│   │                             3/4-Ansicht, Gegner, Geschosse – aufrecht auch bei gedrehter Karte),
│   │                             effects.js (Partikel, Licht), loupe.js (Lupe für die Platzierung)
│   ├── ui/                       controller.js (Auswahl, Bau-/Versetzmodus, Vorschau, Doppeltipp-Sperre),
│   │                             panel.js (Baumenü, Infobereich, Kompaktzeile), sheet.js (Bottom Sheet),
│   │                             hud.js, input.js (Maus/Touch/Tastatur), guard.js (keine Textauswahl,
│   │                             Gesten-Reset), keys.js (Turmtasten), modal.js, format.js
│   ├── storage.js                localStorage mit Fallback im Speicher
│   ├── audio.js                  Soundeffekte per Web Audio API (keine Audiodateien)
│   └── pwa.js                    Service-Worker-Registrierung, Installationsangebot, Offline-Status
├── tests/                        node:test-Tests, Strategie-Bots, Browser-Checks
└── tools/                        serve.mjs (Mini-Webserver), icons.mjs, balance-report.mjs,
                                  balance-experiment.mjs, tower-efficiency.mjs
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
`radius`, optional `heal`, `summon`, `boss`, `slowResist`, `resist`, `flying`, `frenzy`, `disrupt`, `hint`),
Zeichenfunktion in `drawEnemy` hinzufügen und in `waves.js` verwenden (mit `intro`, wenn er eine neue
Fähigkeit mitbringt). Jede Fähigkeit braucht eine sichtbare Kennzeichnung und eine Erklärung.

**Balancing** – alle Zahlen stehen in `js/config/`. Nach Änderungen `npm test` laufen lassen; die
Balance-Tests melden, wenn das Spiel zu leicht oder unschaffbar wird.

**Neuer Statuseffekt** – in `js/game/status.js` unter `STATUS` mit Stapelregel (`strongest`, `refresh`,
`intensity`, `stun`, `build`), optional `impairs` (bremst/hält fest → Raserei-Immunität) und `damageType`
eintragen; Türme lösen ihn über ihre Stufenwerte in `applyHitEffects` (`js/game/towers.js`) aus. Die
Kennzeichnung auf dem Gegner gehört in `drawStatusMarks` (`js/render/sprites.js`).

**Lupe einstellen** – alle Maße (Größe, Zoom, Abstände, Rahmen, Hysterese, Reihenfolge der Positionen je
Hand) stehen in `js/config/ui.js` (`MAGNIFIER`).

**Nach jeder Änderung an ausgelieferten Dateien:** `CACHE` in `sw.js` hochzählen (`towerfall-v2` …),
sonst behalten installierte Geräte die alte Version.

## Bekannte Einschränkungen

- Der Spielstand wird nur zwischen Wellen gesichert (siehe oben).
- Auf kleinen Smartphones (iPhone SE) bleibt die Karte trotz Drehung schmal (245 × 436 px); Rasterzellen
  sind dort etwa 11 px groß. Die Lupe gleicht das beim Bauen aus. Die zweireihige Turmauswahl kostet im
  Hochformat etwa 15 % Kartenfläche gegenüber der einreihigen Leiste.
- Im Querformat auf dem Smartphone zeigt die Turmauswahl nur Symbol und Preis (4 × 3), weil für Namen und
  zwei Reihen die Höhe fehlt; der Name steht im Infobereich.
- Die Ursache der blauen Markierungen (Textauswahl unter iOS) ist im Code behoben und in Chromium geprüft;
  ein Test auf einem echten iPhone steht noch aus.
- iPhone-Verhalten (Safe Areas, Home-Indikator, Safari-Gesten am Bildschirmrand) ist nur in der
  Chromium-Simulation geprüft, nicht auf echten Geräten.
- Safari unter iOS zeigt keinen Installieren-Knopf – dort über „Teilen → Zum Home-Bildschirm“.
- Löscht der Browser die Website-Daten (z. B. privater Modus, Speicher voll), sind Spielstand und
  Bestleistungen weg. Das Hauptmenü warnt, wenn dauerhaftes Speichern nicht möglich ist.
- Die Balance ist mit Bots abgestimmt (siehe [BALANCE.md](BALANCE.md)); wie schwer sich das für Menschen
  anfühlt, ist nicht gemessen. Auf „Hart“ scheitern fast alle Bots am ersten Boss (Welle 5).
- Gegner laufen auf festen Routen; Türme und Hindernisse beeinflussen den Weg nicht (siehe Erweiterungen).
- Sichtlinien gelten für das Zielen; ein Geschoss, das bereits fliegt, wird von Hindernissen nicht aufgehalten.
- Die Hindernisse sind je Karte und Modus fest (nicht zufällig pro Partie) – Aufstellungen lassen sich so
  vergleichen und lernen.

### Balance-Stand

Kurzfassung (Normal, Strategie-Bots, Details und Vorher-Nachher in [BALANCE.md](BALANCE.md)): Vorher gewann
die Ballung aller Türme an einer Stelle jede Karte ohne Lebensverlust. Jetzt scheitert sie auf drei von
fünf Karten (Harpyien fliegen an ihr vorbei); gemischte und panzerbrechende Aufstellungen gewinnen, keine
Strategie ist überall fehlerfrei.

## Nächste Erweiterungen mit dem größten Mehrwert

Abgeleitet aus den Messungen:

1. **Probespielen durch Menschen auf echten Geräten** (iPhone/Android): Lupe, Bottom Sheet und gedrehte
   Karte sind nur simuliert geprüft. Besonders: Gesten am Bildschirmrand in Safari, Lesbarkeit kleiner Zellen.
2. **„Hart“ entschärfen oder neu definieren:** Fast alle Bots scheitern am Oger in Welle 5 – der Sprung von
   Welle 4 zu 5 ist dort zu groß (z. B. Oger-Leben auf „Hart“ nicht voll skalieren).
3. **Bot mit Zielwahl und Räumen:** Die Bots unterschätzen menschliche Spieler; ein Bot, der Hindernisse
   räumt und die Zielwahl nutzt, würde die Balance-Tabellen aussagekräftiger machen.
4. **Kenngröße „gewonnene Zeit je Gold“** für die Kontrolltürme (Frost, Schleim, Tesla): Ihr Schaden je Gold
   ist gering (≈ 10), ihr Nutzen ist die Zeit, die andere Türme zusätzlich schießen. Ohne diese Messung
   lassen sie sich nur indirekt (über Siege der Strategien) ausbalancieren.
5. **Schallturm mit Rückstoß:** Das Statussystem trägt das bereits (Gegner bekommen dafür einen Effekt, der
   `dist` kurz verringert); dazu Grenzen gegen Dauerschleifen wie bei den Betäubungen.
6. **Fallenleger / Labyrinth-Modus:** nutzt das Raster direkt; die Passierbarkeitsprüfung (`routes.js`) ist
   vorbereitet.
