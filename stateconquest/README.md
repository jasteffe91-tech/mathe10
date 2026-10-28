# State Conquest – werbefreies Echtzeit-Eroberungsspiel

Minimalistisches Echtzeit-Strategiespiel im Stil von „State.io“: Gebiete produzieren Truppen, du schickst
sie per Wischen oder Tippen los und eroberst Karte für Karte. Eigenständige Umsetzung mit eigenen
Karten, eigener Oberfläche, selbst erzeugten Grafiken und Klängen.

**Keine Werbung, keine Tracking- oder Werbe-SDKs, keine In-App-Käufe, keine Energie- oder Wartezeiten,
kein Konto, komplett offline.** Der Fortschritt wird nur lokal gespeichert.

- Engine: **Godot 4.5.1**, GDScript, Renderer „Kompatibilität“ (läuft auf allen Android-Geräten, im Browser, unter Windows/Linux/macOS)
- Format: Hochformat 9:16 (passt sich an andere Seitenverhältnisse an), Touch und Maus

## Inhalt

| Bereich | Umfang |
|---|---|
| Kampagne | 100 Level auf 10 Kartenvorlagen, freischaltbar, jederzeit wiederholbar, 1–3 Sterne, Bestzeiten |
| Karten | Deutschland (16 Bundesländer), Europa, Nordamerika, Südamerika, Afrika, Asien, Australien & Ozeanien, Weltkarte, Drachenarchipel, Nebelreich (Fantasie) |
| Gegner-KI | Einfach, Mittel, Schwer, Sehr schwer – gleiche Regeln wie der Spieler |
| Upgrades | Starttruppen, Produktion, Tempo, Startgebiete, Münzbonus (je 20–25 Stufen, nur mit erspielten Münzen) |
| Modi | Kampagne, Endlosmodus (Zufallskarten, steigende Schwierigkeit), Freies Spiel, Sandbox |
| Menüs | Hauptmenü (mit live laufender KI-Demo), Levelauswahl, Upgrades, Einstellungen, Statistik, Pause, Sieg/Niederlage |
| Einstellungen | Musik, Soundeffekte, Vibration, Spielgeschwindigkeit (0,75–2×), Deutsch/Englisch, Farbpalette (Standard/Kontrast), Spielstand zurücksetzen |

### Steuerung

- **Ziehen** von einem eigenen (blauen) Gebiet auf ein Ziel: Truppen werden losgeschickt.
- **Tippen**: erst eigenes Gebiet, dann Ziel antippen. Eigenes Ziel = Verstärkung.
- **Mehrfachauswahl**: beim Ziehen über weitere eigene Gebiete wischen – alle greifen gemeinsam an.
- **Versandmenge** unten: 25 / 50 / 75 / 100 % (PC: Tasten 1–4).
- **Zoom** bei großen Karten: zwei Finger (Pinch) bzw. Mausrad; verschieben mit zwei Fingern bzw. rechter Maustaste.
  Kartensymbol unten rechts (PC: F) setzt den Zoom zurück.
- **Pause**: Knopf oben links, Android-Zurück-Taste oder Esc. Beim Wechsel in eine andere App wird automatisch pausiert.

## Starten

### Im Godot-Editor

1. Godot **4.5.1** (Standard-Version, nicht .NET) von <https://godotengine.org/download> laden.
2. Godot starten → *Importieren* → `stateconquest/project.godot` wählen.
3. **F5** startet das Spiel. Für ein Handy-Gefühl im Editor: *Projekt → Projekteinstellungen → Anzeige → Fenster*
   ist bereits auf 450 × 800 (Hochformat) eingestellt.

### Fertige Builds

Im Ordner `stateconquest/dist/` liegen fertige Builds, sofern sie mitgeliefert wurden:

| Datei | Plattform | Hinweis |
|---|---|---|
| `StateConquest-Windows.zip` | Windows 10/11 (64 Bit) | entpacken, `StateConquest.exe` starten. SmartScreen-Warnung („unbekannter Herausgeber“) mit *Weitere Informationen → Trotzdem ausführen* bestätigen. |
| `StateConquest.apk` | Android 7+ (ARM 32/64 Bit) | aufs Handy kopieren, Installation aus unbekannten Quellen erlauben, installieren. Mit Debug-Schlüssel signiert (zum Selbst-Installieren gedacht). |
| `web/` | Browser (auch iPhone/Safari) | über GitHub Pages: `https://jasteffe91-tech.github.io/mathe10/stateconquest/dist/web/` – nach dem ersten Laden auch offline (PWA, „Zum Home-Bildschirm“). |

## Exportieren

Voraussetzung: Godot 4.5.1 und die passenden **Export-Vorlagen** (*Editor → Export-Vorlagen verwalten → Herunterladen*).
Die Export-Voreinstellungen liegen in `export_presets.cfg` (Web, Windows Desktop, Android, Linux).

**Im Editor:** *Projekt → Exportieren…* → Voreinstellung wählen → *Projekt exportieren*.

**Per Kommandozeile** (im Ordner `stateconquest`):

```bash
godot --headless --path . --export-release "Windows Desktop" build/windows/StateConquest.exe
godot --headless --path . --export-release "Linux"           build/linux/StateConquest.x86_64
godot --headless --path . --export-release "Web"             build/web/index.html
godot --headless --path . --export-debug   "Android"         build/android/StateConquest.apk
```

Unter Linux/macOS erledigt `tools/export_all.sh` alles in einem Schritt (Pfad zu Godot per `GODOT=...`).

### Android

1. **Android SDK** (Android Studio oder nur die *Command line tools*) installieren, darin *platform-tools*,
   *build-tools* und eine *platform* (z. B. Android 35). Dazu ein **JDK 17** oder neuer.
2. In Godot: *Editor → Editoreinstellungen → Export → Android*: Pfad zum Android-SDK und zum JDK eintragen.
   Godot erzeugt beim ersten Export automatisch einen Debug-Schlüssel.
3. Export „Android“ mit *Debug* → installierbare APK zum Selbst-Installieren.
4. **Für den Play Store** wird ein eigener Release-Schlüssel benötigt:
   ```bash
   keytool -genkeypair -v -keystore stateconquest-release.keystore -alias stateconquest -keyalg RSA -validity 10000
   ```
   Den Schlüssel in der Android-Voreinstellung unter *Keystore → Release* eintragen (Datei, Alias, Passwort –
   **nicht** ins Repository einchecken) und mit *Release* exportieren. Für den Play Store unter
   *Gradle Build* „Use Gradle Build“ aktivieren und als Format **AAB** wählen.
5. Paketname: `org.stateconquest.game` (in der Voreinstellung änderbar). Berechtigungen: nur `VIBRATE`, **kein Internet**.

### iPhone / iPad

Der iOS-Export braucht einen **Mac mit Xcode** und ein Apple-Entwicklerkonto (auch das kostenlose reicht für das eigene Gerät):

1. Auf dem Mac in Godot eine Export-Voreinstellung „iOS“ anlegen, *App Store Team ID* und *Bundle Identifier* eintragen.
2. Exportieren → Godot erzeugt ein Xcode-Projekt → in Xcode öffnen, Gerät wählen, *Run*.

Ohne Mac: die **Web-Version** läuft in Safari und lässt sich über *Teilen → Zum Home-Bildschirm* wie eine App nutzen.

### Web

Export „Web“ erzeugt `build/web/` (ohne Threads, daher keine besonderen Server-Header nötig). Den Ordner
auf einen beliebigen statischen Webserver oder GitHub Pages legen. Lokal testen: `python3 -m http.server` im Ordner.

## Projektstruktur

```
stateconquest/
├─ project.godot, export_presets.cfg, icon.svg
├─ scenes/main.tscn            Einstieg (UIManager übernimmt die Bildschirme)
├─ scripts/
│  ├─ core/                    reine Spiellogik, ohne Darstellung
│  │  ├─ territory.gd          Territory: Besitzer, Truppen, Produktion, Form, Nachbarn
│  │  ├─ faction.gd            Faction: Spieler/KI/neutral, Multiplikatoren, Statistik
│  │  ├─ troop_movement.gd     TroopMovement: Truppenstrom mit geschlossen berechenbaren Ankunftszeiten
│  │  ├─ combat_system.gd      CombatSystem: 1 Angreifer tötet 1 Verteidiger, Übernahme bei 0
│  │  ├─ territory_manager.gd  TerritoryManager: Produktion, Abfragen, Treffer-Test
│  │  ├─ simulation.gd         Simulation: fester Zeitschritt (30 Hz), Ankünfte in Zeitreihenfolge, Sieg/Niederlage
│  │  └─ json_util.gd          JSON lesen/schreiben (atomar)
│  ├─ ai/ai_controller.gd      AIController: vier Profile, nutzt nur die Spielerbefehle
│  ├─ map/                     MapGenerator (Voronoi + verwackelte Grenzen, Zufallskarten), MapData
│  ├─ game/game_session.gd     GameSession: baut aus einer Level-Beschreibung eine Partie
│  ├─ view/game_view.gd        GameView: Zeichnen, Effekte, Touch/Maus, Zoom
│  ├─ ui/                      Bildschirme (Hauptmenü, Levelauswahl, Upgrades, …), UITheme, UIIcon
│  └─ autoload/                Config, I18n, SaveManager, SettingsManager, UpgradeManager,
│                              LevelManager, AudioManager, GameManager, UIManager
├─ data/
│  ├─ config/                  game.json, upgrades.json, ai.json, colors.json
│  ├─ maps/                    Kartenvorlagen (*.json) + index.json
│  ├─ levels/campaign.json     die 100 Kampagnenlevel
│  └─ i18n/                    de.json, en.json
├─ assets/                     audio/ (selbst erzeugt), fonts/ (Nunito, OFL), icons/
├─ tests/                      automatisierte Tests (test_runner.tscn)
└─ tools/                      Karten-/Kampagnen-/Sound-Generatoren, Balancing-Werkzeuge, Export-Skript
```

Spiellogik und Darstellung sind strikt getrennt: `Simulation` kennt keine Nodes; `GameView` liest nur den Zustand
und holt Ereignisse (`drain_events()`) für Effekte und Klänge. Die Simulation läuft in festen Schritten
(`Simulation.FIXED_DT`), daher sind Produktion und Kampf unabhängig von der Bildrate.

### Wichtige Regeln im Code

- **Keine Duplikate:** Truppen werden beim Versand sofort vom Startgebiet abgezogen und gehören dann dem Strom.
- **Keine negativen Zahlen:** `CombatSystem.apply_units` berechnet geschlossen; überzählige Angreifer werden zur Garnison.
- **Gleichzeitige Angriffe:** alle Ankünfte eines Schritts werden nach Ankunftszeit (bei Gleichstand nach Strom-ID) einzeln verarbeitet.
- **Besitzerwechsel unterwegs:** ein Strom gehört seiner Fraktion, nicht dem Startgebiet; er kämpft bei Ankunft gegen den *aktuellen* Besitzer.
- **Sieg:** alle Gebiete gehören dir und keine fremden Truppen sind unterwegs. **Niederlage:** keine Gebiete und keine Truppen unterwegs.
- **KI ohne Schummeln:** gleiche Produktion, gleiches Tempo, gleiche Versandmengen (25/50/75/100 %).

## Neue Level hinzufügen

Die Kampagne steht in `data/levels/campaign.json`. Jedes Level ist ein Eintrag; das Spiel liest die Datei beim Start.
Ein neues Level ans Ende anhängen (oder `tools/build_campaign.py` anpassen und neu erzeugen):

```json
{
  "id": 101,
  "map": {"template": "europe", "regions": 24},
  "seed": 4242,
  "player_start_mode": "edge",
  "player_starts": 1,
  "enemies": [
    {"faction": 2, "ai": "hard", "starts": 1},
    {"faction": 3, "ai": "medium", "starts": 2}
  ],
  "start_troops": 20,
  "enemy_start_troops": 22,
  "neutral_troops": [6, 18],
  "bonus_slots": 1,
  "production_mult": 1.3,
  "speed_mult": 1.0,
  "restrict_neighbors": false,
  "par_time": 240,
  "tutorial": ""
}
```

| Feld | Bedeutung |
|---|---|
| `id` | fortlaufende Levelnummer (Freischaltung erfolgt in dieser Reihenfolge) |
| `map.template` | ID einer Kartenvorlage aus `data/maps/` – oder `{"random": true, "regions": 20, "style": "continent"}` (`continent`, `twin`, `archipelago`) |
| `map.regions` | Anzahl Gebiete; weniger als die Vorlage hat → die Vorlage wird gröber unterteilt (gut verteilte Auswahl, abhängig von `seed`) |
| `seed` | bestimmt Auswahl, Grenzverlauf, Startplätze und neutrale Truppen – gleiches `seed` = gleiches Level |
| `player_start_mode` | `edge` (Rand), `center` (Mitte, zwischen den Gegnern) oder `random` |
| `player_starts`, `enemies[].starts` | Anzahl Startgebiete |
| `enemies[].faction` | 2 = Rot, 3 = Grün, 4 = Gelb |
| `enemies[].ai` | `easy`, `medium`, `hard`, `very_hard` |
| `neutral_troops` | Bereich [min, max] für neutrale Gebiete (große Gebiete etwas mehr) |
| `bonus_slots` | so viele Zusatz-Startgebiete erlaubt das Level für das Upgrade „Startgebiete“ |
| `production_mult`, `speed_mult` | Produktion bzw. Truppentempo für **alle** Parteien |
| `restrict_neighbors` | `true` = Angriffe nur auf angrenzende Gebiete |
| `par_time` | Sekunden für 3 Sterne (bis 1,6 × Par: 2 Sterne, sonst 1 Stern) |
| `tutorial` | optionaler Hinweis: `drag`, `tap`, `multi`, `ratio`, `zoom` |

Die Spiellogik muss dafür nicht geändert werden. Nach dem Ändern die Tests laufen lassen (siehe unten) –
`test_campaign_has_100_valid_levels` prüft jedes Level auf gültige Karten und Startgebiete.

### Neue Karte hinzufügen

Kartenvorlagen liegen in `data/maps/<id>.json` und werden in `data/maps/index.json` aufgelistet.
Eine Vorlage besteht aus Landmassen (Umrisse) und Regionspunkten; daraus erzeugt das Spiel die Gebiete:

```json
{
  "id": "alpen",
  "name": {"de": "Alpenland", "en": "Alpine Land"},
  "projection": {"type": "lonlat", "lat0": 47, "x_scale": 1.0, "y_scale": 1.0},
  "landmasses": [[[5.9, 47.8], [10.5, 47.6], [17.1, 48.0], [16.5, 46.5], [13.7, 46.5], [9.5, 45.9], [6.8, 45.9]]],
  "regions": [
    {"id": "ch", "name": "Schweiz", "pos": [8.2, 46.8]},
    {"id": "at_w", "name": "Tirol", "pos": [11.4, 47.2]},
    {"id": "at_o", "name": "Ostösterreich", "pos": [15.5, 47.6]}
  ]
}
```

- `projection.type`: `lonlat` (Längen-/Breitengrad) oder `xy` (freie Koordinaten, z. B. für Fantasiekarten).
- Die Karte wird automatisch auf die Spielfläche skaliert. Jeder Regionspunkt muss **an Land** liegen.
- `tools/build_maps.py` erzeugt alle mitgelieferten Vorlagen und prüft Umrisse auf Selbstüberschneidungen
  und Regionspunkte auf Lage an Land: `python3 tools/build_maps.py`.
- Vorschau aller Karten als SVG: `godot --headless --path . --script res://tools/dump_maps.gd` → `build/maps/`.

## Spielwerte und Upgrades anpassen

Alle Werte stehen in JSON-Dateien unter `data/config/` und werden beim Start gelesen:

**`game.json`** – Grundregeln

| Schlüssel | Bedeutung |
|---|---|
| `territory.base_production` | Truppen pro Sekunde eines durchschnittlich großen Gebiets |
| `territory.production_size_min/max` | Spanne des Größenfaktors (große Gebiete produzieren mehr, sind „wirtschaftlich wichtig“) |
| `territory.base_capacity`, `capacity_per_size` | ab dieser Truppenzahl produziert ein Gebiet nicht weiter |
| `territory.neutral_production` | Produktion neutraler Gebiete (Standard 0) |
| `troops.base_speed` | Truppentempo in Karteneinheiten/s (Karte ≈ 1000 × 1400) |
| `troops.emit_interval_max`, `stream_max_duration` | wie lang ein Strom ist (rein optisch und für die Ankunftszeiten) |
| `send_ratios`, `default_send_ratio` | wählbare Versandmengen |
| `rewards.*` | Münzen: Grundbetrag, pro Level, pro Stern, Wiederholungsfaktor, Trostmünzen, Endlos-/Freies Spiel |
| `stars.*` | Sterne-Schwellen relativ zur Par-Zeit |
| `endless.*` | Größenwachstum der Zufallskarten im Endlosmodus |

**`upgrades.json`** – je Upgrade `max_level`, Wirkung `value_per_level` (Truppen bzw. Anteil, 0,03 = +3 %
pro Stufe) und Kosten `cost_base · cost_growth^(Stufe−1)` (auf 5 gerundet). Alternativ eine explizite
Liste `"values": [0, 2, 5, …]`. Beim Upgrade „Startgebiete“ gibt `territories_every` an, nach wie vielen Stufen
ein weiteres Zusatzgebiet dazukommt, `garrison_per_level` die Zusatztruppen darin.

**`ai.json`** – KI-Profile: Denkintervall, Bevorzugung neutraler Ziele, Fehlerquote, Verteidigungsbereitschaft,
Sicherheitsmarge, Anzahl koordinierter Quellen und paralleler Angriffe, Reaktion auf Truppenbewegungen,
Front/Hinterland-Verteilung (`consolidate`), Vorausschau (`lookahead`) u. a.

**`colors.json`** – Farben der Parteien (Standard- und Kontrastpalette), Meer, Rahmen, Oberfläche.

Texte stehen in `data/i18n/de.json` und `en.json`.

## Tests

```bash
godot --headless --path . res://tests/test_runner.tscn
```

35 Tests mit über 9.000 Einzelprüfungen: Truppenproduktion (inkl. Bildraten-Unabhängigkeit und Kapazität),
Truppenversand (Mengen, ungültige Befehle, Reisezeit, keine Duplikate), Kampfberechnung (Beispiel aus der
Spezifikation, Gleichstand, Verstärkung, keine negativen Werte), Besitzerwechsel während laufender Bewegungen,
gleichzeitige Angriffe (deterministisch, Truppenbilanz), Sieg- und Niederlagebedingungen, Upgrades (Kosten,
Kauf, Wirkung im Spiel, KI ohne Bonus), Belohnungen und Freischaltung, Sandbox ohne Fortschritt, Speichern/Laden
(inkl. beschädigter Datei → Sicherungskopie), alle Karten und alle 100 Level (gültige Polygone, zusammenhängende
Nachbarschaft), KI-Partien (Truppenbilanz, stärkere KI gewinnt).

Die Tests schreiben in einen eigenen Test-Spielstand und lassen den echten Spielstand unberührt.

**Balancing-Stand** (mit den Werkzeugen unten gemessen): Im KI-Turnier gewinnt *Mittel* gegen *Einfach* 20/20,
*Schwer* gegen *Mittel* 19/20, *Sehr schwer* gegen *Schwer* 15/20. Ein Bot auf Stufe *Mittel* mit mäßigen Upgrades
(Stufe = Level/5) gewinnt 84 von 100 Kampagnenleveln, ein Bot auf *Schwer* 90 von 100. Eine Simulationsrunde kostet
im Schnitt unter 0,1 ms (Level 100, vier Parteien).

Weitere Werkzeuge:

- `tools/ai_tournament.tscn` – KI-Stufen gegeneinander (`-- 30` Partien je Paarung)
- `tools/campaign_balance.tscn` – ein KI-Bot spielt alle Kampagnenlevel (`-- hard 1 100`)
- `tools/check_scripts.gd` – alle Skripte auf Parse-Fehler prüfen
- `tools/make_sounds.py` – Soundeffekte und Musik neu erzeugen

## Speichern

Der Spielstand liegt in `user://save.json` (Windows: `%APPDATA%\Godot\app_userdata\State Conquest\`,
Android: im privaten App-Speicher) mit Sicherungskopie `save.bak.json`. Gespeichert werden aktuelles und
freigeschaltete Level, Münzen, Upgrade-Stufen, Bestzeiten, Sterne, Einstellungen und Gesamtstatistik –
automatisch nach jedem Levelende, Upgrade-Kauf und jeder Einstellungsänderung. Schreiben erfolgt atomar
(Temp-Datei, dann Umbenennen).

## Stand der Umsetzung

**Fertig**

- Phase 1 – spielbarer Kern: Gebiete, Produktion, Versand (Ziehen, Tippen, Mehrfachauswahl), sichtbare Truppenströme, Kampf, KI, Sieg/Niederlage
- Phase 2 – Grundspiel: Hauptmenü, Levelsystem, 10 Karten, mehrere Gegner, Upgrades, Münzen, Speichern/Laden
- Phase 3 – Erweiterungen: 100 Level aus Vorlagen + Konfiguration, vier KI-Stufen, Endlosmodus, freies Spiel, Sandbox
- Phase 4 – Feinschliff: Farbübergänge, Eroberungsringe und Partikel, Konfetti, Sterne-Animation, Klänge und Musik,
  Vibration, Zoom/Pan, Tutorials in den ersten Leveln, PC-Tastenkürzel, Tests, Balancing-Werkzeuge, Exporte

**Offen / Ideen**

- iOS-Build (benötigt einen Mac mit Xcode, Projekt ist vorbereitet)
- Release-Signatur für den Play Store (eigener Schlüssel nötig, siehe oben)
- Weitere Karten und Level (Architektur und Tests unterstützen beliebig viele)
- Feineres Balancing anhand echter Spielerfahrung (Werte in `data/config/`)

## Lizenzen

- Code, Karten, Grafiken, Klänge und Musik: eigene Werke dieses Projekts (Klänge synthetisch erzeugt mit `tools/make_sounds.py`).
- Schrift **Nunito** © The Nunito Project Authors, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
- Godot Engine: MIT-Lizenz.
