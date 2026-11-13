# Medienbibliothek Mathematik & Physik

Lokale, lizenzgeprüfte und durchsuchbare Bibliothek mit Unterrichtsmedien für Mathematik und Physik (Klassen 5–13).
Claude Code (und du selbst) findet hier vorhandene Diagramme, Fotos, Animationen, Cartoons, Symbole und Simulationen,
**bevor** neue Grafiken gezeichnet werden – inklusive automatisch erzeugter Bildnachweise und einer konservativen Lizenzprüfung.

- **Abschlussbericht:** [`BERICHT.md`](BERICHT.md) · **Quellenmatrix:** [`sources/QUELLEN.md`](sources/QUELLEN.md) · **Testergebnisse:** [`reports/testergebnisse.md`](reports/testergebnisse.md)
- **Weboberfläche:** [`index.html`](index.html) (Doppelklick genügt, kein Server nötig)

> Keine Rechtsberatung. Die Bibliothek dokumentiert Lizenzen sorgfältig und schließt Zweifelsfälle aus, kann aber eine eigene Prüfung im Einzelfall nicht ersetzen.

---

## 1. Speicherort und Einrichtung

Die Bibliothek liegt im Repository unter `medienbibliothek/` (dauerhaft per Git gesichert). Der vorgesehene zentrale Speicherort
`~/Unterrichtsmedien/Mathe-Physik/` wird von `install.sh` als Verweis (Symlink) auf diesen Ordner angelegt:

```bash
git clone <repo> && cd <repo>/medienbibliothek
./install.sh            # Link ~/Unterrichtsmedien/Mathe-Physik, Befehl ~/.local/bin/media, globale Claude-Skill, Hinweis in ~/.claude/CLAUDE.md
media stats             # Bestand anzeigen
```

`install.sh` ist idempotent und überschreibt keine bestehende Bibliothek (existiert `~/Unterrichtsmedien/Mathe-Physik` bereits als
echter Ordner, bleibt er unangetastet). Mit `--ohne-claude-md` wird die globale `CLAUDE.md` nicht verändert.

Voraussetzungen: Python ≥ 3.10. Suche, Bildnachweise und Lizenzprüfung brauchen **nur die Standardbibliothek**.
Für Import und Vorschaubilder zusätzlich `requests` und `Pillow`; SVG-Vorschaubilder optional über Node + Playwright.
Windows ohne Bash: `cd medienbibliothek && python -m medialib search "…"`.

## 2. Technischer Aufbau

```
medienbibliothek/
├── bin/media                 Kommandozeile (Wrapper für python3 -m medialib)
├── medialib/                 Python-Paket
│   ├── db.py                 SQLite + FTS5 (Wort- und Trigramm-Index), JSONL-Synchronisation
│   ├── taxonomy.py           Fachsystematik, Synonyme, Query-Erweiterung (direkt / Unterthema / verwandt)
│   ├── search.py             Ranking: Thema + BM25 + Wortabdeckung + Teilwörter + Qualität; harte Lizenzfilter
│   ├── licenses.py           Lizenznormalisierung, Kategorien A/B/C/E, Einsatzprofile
│   ├── credits.py            Bildnachweise (Text, Markdown, HTML, LaTeX), Medienverzeichnis mit Profilprüfung
│   ├── importer.py           Pipeline: entdecken → bewerten → auswählen → laden → verarbeiten (wiederaufnehmbar)
│   ├── sources/              Adapter: commons, nasa, wellcome, met
│   ├── extern.py             verlinkte Ressourcen (PhET, xkcd, GeoGebra …) und OpenMoji-Symbole
│   ├── media_files.py        Hashes, pHash (Dubletten), Transparenz, S/W-Eignung, Thumbnails, SVG-Prüfung
│   ├── zeichnen.py           Präzise SVG-Eigenproduktionen: DIN-Schaltpläne, Koordinatensysteme, Wurfbahnen
│   ├── kuration.py           Sichtprüfung: Overrides, Ablehnungen, Kontaktbögen
│   ├── verify.py             Lizenz-/Link-Nachprüfung
│   └── cli.py                Befehle (siehe 4.)
├── config/                   taxonomie.json, lizenzen.json, profile.json, importplan.json, extern.json
├── metadata/                 katalog.jsonl (Quelle der Wahrheit, versioniert), kuration.json,
│                             gepruefte_kandidaten.jsonl (bereits geprüfte Kandidaten), katalog.js (Weboberfläche)
├── database/media.sqlite     Arbeitsindex (nicht versioniert, wird automatisch aufgebaut)
├── assets/{mathematik,physik}/<bereich>/   Mediendateien  (ID__titel.ext)
├── thumbnails/               Vorschaubilder (WebP, 360 px)
├── sources/                  quellenmatrix.json, QUELLEN.md
├── skill/SKILL.md            Claude-Code-Skill (auch in ../.claude/skills/medienbibliothek/)
├── scripts/                  import_lauf.py, kuratieren.py, eigene_grafiken.py, render_svg.mjs
├── tests/                    test_medialib.py (Unit), akzeptanz.py (Tests A–F)
├── reports/  previews/  exports/
└── index.html                Weboberfläche
```

**Datenhaltung.** `metadata/katalog.jsonl` (eine Zeile pro Medium, sortiert) ist die versionierbare Quelle. Jeder Schreibbefehl
exportiert sie atomar. Passt die Prüfsumme nicht mehr zum Index (z. B. nach `git pull`), baut sich `database/media.sqlite`
automatisch neu auf. Abgebrochene Importe beschädigen nichts: Dateien werden über `.part`-Dateien atomar geschrieben,
Datenbankänderungen laufen in Transaktionen, jeder Kandidat hat einen Status (`neu`, `ausgewaehlt`, `importiert`, `abgelehnt`, `fehler`, …).

**Speicherarten.** `lokal` = Datei mit nachgewiesener Weiterverwendungserlaubnis liegt in `assets/`; `extern` = nur Verweis
(z. B. PhET, xkcd: eingeschränkte Lizenz oder interaktive Ressource); `kandidat` = noch zu prüfen, wird nie automatisch verwendet.

### Metadaten je Medium (Auszug)

`id, titel, beschreibung, originaltitel, originalbeschreibung, fach, hauptthema, unterthemen, schlagworte, schlagworte_en,
medientyp, format, mime, stufe_min/max, schwierigkeit, einsatzzweck, didaktik, fachlich (+hinweis), beschriftung (de/en/ohne),
breite, hoehe, seitenverhaeltnis, transparent, sw_geeignet, druck_geeignet, dateigroesse, urheber, quelle, quelle_url, medien_url,
lizenz, lizenz_name, lizenz_url, lizenz_nachweis_url, lizenz_detail, lizenz_kategorie, lizenz_status, pruefdatum,
namensnennung_pflicht, einschraenkungen, credit_vorgabe, speicherung, pfad, thumbnail, alt_text, qualitaet (1–5),
sha256, quelle_sha1, phash, herkunft, quelle_id, importiert_am, kuratiert, notizen`.

## 3. Lizenzlogik

| Kategorie | Lizenzen | Verwendung |
|---|---|---|
| **A** offen | CC0, Public Domain Mark, gemeinfrei (mit Begründung), CC BY, CC BY-SA, MIT | Kern der Bibliothek, lokal gespeichert |
| **B** eingeschränkt | CC BY-NC(-SA), ND-Lizenzen, Anbieterlizenzen (PhET: CC BY-NC 4.0, GeoGebra, Science and Ink) | nur dokumentiert, i. d. R. nur verlinkt, nie als OER |
| **C** ungeklärt | unbekannt, GFDL-only, nicht verifizierbar | nie automatisch; nur Profil `recherche` |
| **E** Eigenproduktion | mit Claude erstellte Grafiken | keine Drittrechte bekannt; **nicht** automatisch CC0 – Lizenz legt der Herausgeber fest |

**Einsatzprofile** (`config/profile.json`): `offen` (Standard; öffentliche/OER-Materialien: nur A und E, verifiziert),
`unterricht` (nichtkommerziell, geschützte Plattform: zusätzlich B), `extern` (nur Verweise), `recherche` (alles, nie für Material).
ND-Medien sind standardmäßig aus automatischer Gestaltung ausgeschlossen (`--mit-nd` nur für unveränderte Nutzung, `--bearbeitung`
schließt sie immer aus). Weitere maschinenlesbare Einschränkungen: `personenrechte`, `marke`, `nasa-logo`, `us-pd`, `us-schaltzeichen`, `musik`.

**Prüfung je Medium.** Commons: Lizenz aus den Metadaten der Dateibeschreibungsseite (API `extmetadata`). NASA: Usage Guidelines +
`metadata.json` je Bild (Bilder mit Hinweisen auf Rechte Dritter werden verworfen). Wellcome: Lizenzfeld je Bild. Met: `isPublicDomain`.
PhET: Lizenzkopf jeder Simulationsdatei. xkcd: offizielle API + Lizenzseite. Prüfdatum und Nachweis-URL werden gespeichert.

## 4. Befehle (tatsächliche Syntax)

```bash
media search "schiefer Wurf" --fach physik
media search "quadratische Funktion" --fach mathematik --stufe 9-10
media search "elektrische Feldlinien" --typ svg          # inkl. Medien mit SVG-Original an der Quelle
media search "Newton Gesetze" --typ cartoon --profil unterricht
media search "Reflexion Brechung" --stufe 8-10
media search "Pendel Schwingung" --typ animation
media search "Kreisfläche" --profil offen --json
media search "Pendel" --profil extern                   # Simulationen/Links
media show ID [--json]
media credit ID … [--format text|markdown|html|latex] [--bearbeitung "zugeschnitten"]
media verzeichnis ID … --profil offen --format markdown [--bearbeitet ID="beschriftet"]   # Exit 3 = unzulässig
media check ID … --profil offen [--bearbeitung]                                          # Exit 3 = unzulässig
media export ID … --ziel ORDNER --profil offen [--nur-zulaessige]                        # Dateien + BILDNACHWEISE.md
media add DATEI --eigen --titel "…" --thema ph.optik.linsen [--stufe 8-10 --alt "…" --schlagworte "a,b" --entstehung "…"]
media add DATEI --titel "…" --thema … --lizenz "CC BY 4.0" --urheber "…" --quelle-url URL --nachweis-url URL
media topics [--fach physik] [--suche wurf]
media stats [--json]
media import entdecken|auswaehlen|laden|vorschau|alle|extern|openmoji|kuration [--nur REGEX]
media verify [ID …] [--aelter-als 180] [--nur-links]
media original ID            # Vektor-Original (SVG) eines Commons-Mediums einzeln nachladen (eigener Rechner)
media backup [--nur-metadaten] | media restore ARCHIV --ja | media rebuild
media web | media serve [--port 8765] | media kontaktbogen [--unkuratiert] | media pfad
```

Typfilter: `svg, png, jpg, gif, foto, diagramm, grafik, schema, cartoon, comic, humor, karikatur, animation, video, simulation,
interaktiv, historisch, illustration, symbol, icon, 3d`. Stufen: `8`, `8-10`, `sek1`, `sek2`, `ef`, `q1`, `q2`, `unterstufe`, `mittelstufe`, `oberstufe`.

**Suche.** Die Anfrage wird über die Taxonomie erweitert (Synonyme deutsch/englisch: „Wurfparabel“, „projectile motion“ → Wurfbewegungen
mit Unterthemen). Verwandte Themen (z. B. quadratische Funktionen bei „Wurfparabel“) erscheinen nachrangig und sind als
`nur_verwandt` bzw. „verwandtes Thema (keine Gleichsetzung)“ gekennzeichnet. Volltext (BM25 mit Feldgewichten), Präfixe und
Trigramme fangen Flexion und Komposita ab.

## 5. Nutzung aus Claude Code

Die Skill `medienbibliothek` (global in `~/.claude/skills/`, im Repository zusätzlich in `.claude/skills/`) legt den verbindlichen Ablauf fest:
Medienbedarf analysieren → `media search … --json` → Treffer bewerten (Vorschau ansehen) → wiederverwenden (`media export`) →
nur bei Bedarf neu zeichnen (`medialib/zeichnen.py`) → Bildnachweise (`media verzeichnis`) → gute Eigenproduktionen mit
`media add --eigen` aufnehmen. Im Repository `mathe10` weist zusätzlich die `CLAUDE.md` darauf hin; weil dieses Repository öffentlich
über GitHub Pages ausgeliefert wird, gilt dort das Profil `offen`.

Beispiel für eine neue präzise Grafik:

```python
from medialib import zeichnen as Z
s = Z.SVG(500, 320, "Parallelschaltung zweier Lampen", "Schaltplan …")
Z.spannungsquelle(s, 80, 250, 80, 70, "U"); Z.wire(s, (80, 70), (400, 70)); Z.wire(s, (80, 250), (400, 250))
Z.lampe(s, 260, 70, 260, 250, "L₁"); Z.lampe(s, 400, 70, 400, 250, "L₂"); s.dot(260, 70); s.dot(260, 250)
open("parallel.svg", "w").write(s.render())
```

## 6. Eigene visuelle Suche

`index.html` im Bibliotheksordner per Doppelklick öffnen (oder `media serve` → http://127.0.0.1:8765/index.html).
Suchfeld, Filter (Fach, Thema, Medientyp, Klassenstufe, Lizenzprofil, nur lokal, S/W-tauglich), Vorschaubilder, große Ansicht
(GIF-Animationen laufen), Quellen-/Lizenzangaben, kopierbarer Bildnachweis (Text/HTML), Dateipfad und Download (nur zulässige),
Warnhinweise für eingeschränkte/ungeklärte Lizenzen. Filterzustand steht in der URL (teilbar). Hell/Dunkel umschaltbar.
Nach Änderungen am Bestand `media web` ausführen (machen Import und Kuration automatisch).

## 7. Erweiterung und Pflege

- **Weitere Medien:** Einträge in `config/importplan.json` ergänzen (`[id, thema, quelle, suche, typ, max, medientyp]`) und
  `python3 scripts/import_lauf.py` starten – bereits geprüfte Kandidaten und Planeinträge werden übersprungen.
- **Neue Quelle:** Adapter in `medialib/sources/` mit `search(client, query, limit, typ)` → normalisierte Kandidaten (siehe `sources/__init__.py`).
- **Einzelmedium:** `media add` (eigene Grafik oder einzeln geprüftes Fremdmedium mit Nachweis-URL).
- **Sichtprüfung:** `media kontaktbogen --unkuratiert` → Entscheidungen als JSON an `scripts/kuratieren.py` (Titel, Alt-Text,
  Qualität, Stufe, `entfernen`). Abgelehnte Kandidaten werden nie erneut importiert.
- **Lizenzen nachprüfen / tote Links:** `media verify --aelter-als 180` (geänderte Lizenzen → Status `geaendert`, aus allen Profilen ausgeschlossen).
- **Sicherung:** `media backup` bzw. `media backup --nur-metadaten`; Wiederherstellung `media restore ARCHIV --ja`.
- **Dubletten:** SHA-256 (identisch) und pHash (visuell ähnlich, Hinweis in `notizen`).
- **Schnellere Importe:** Wikimedia stuft Clients ohne Kontaktangabe als „unidentifiziert“ ein (ca. 10 Anfragen/min je IP,
  Originaldateien gedrosselt). Wer möchte, trägt in `config/einstellungen.json` `{"kontakt": "name@example.org"}` ein
  (oder setzt `MEDIA_LIB_CONTACT`); diese Angabe wird dann im User-Agent an Wikimedia übermittelt.
- Es laufen **keine** Dienste dauerhaft; alles wird bei Bedarf per Befehl gestartet.

## 8. Tests

```bash
python3 -m unittest discover -s tests -v     # Unit-Tests (isoliert, ändern den Bestand nicht)
python3 tests/akzeptanz.py                   # Akzeptanztests A–F → reports/testergebnisse.md
```
