---
name: medienbibliothek
description: Lizenzgeprüfte Medienbibliothek für Mathematik und Physik (Diagramme, Fotos, Animationen, Cartoons, Symbole, Simulationen) mit Suche, Lizenzprofilen und automatischen Bildnachweisen. Verwenden, sobald Unterrichtsmaterial für Mathematik oder Physik entsteht oder überarbeitet wird – Arbeitsblätter, Klassenarbeiten, Erwartungshorizonte, Präsentationen, Tafelbilder, Lernseiten, Lernkarten, Versuchsanleitungen, Erklärtexte, digitale/interaktive Angebote – oder wenn dafür ein Bild, eine Grafik, ein Foto, ein Cartoon, eine Animation oder eine Simulation gebraucht wird. Vor dem Zeichnen oder Generieren einer neuen Grafik immer zuerst hier suchen.
---

# Medienbibliothek Mathematik/Physik

Zentrale, lokale Bibliothek mit lizenzgeprüften Medien. Ziel: **vorhandene, gute Bilder wiederverwenden statt jede Grafik neu zu zeichnen** – und dabei Lizenzen korrekt einhalten.

## 1. Bibliothek finden

Den ersten funktionierenden Aufruf verwenden und für die Sitzung merken:

1. `media pfad` (global installiert, siehe `install.sh`)
2. `~/Unterrichtsmedien/Mathe-Physik/bin/media pfad`
3. `<repo>/medienbibliothek/bin/media pfad` (z. B. im Repository `mathe10`)
4. Ohne Bash: `cd <bibliothek> && python3 -m medialib pfad`

Fehlt die Bibliothek, das Repository mit dem Ordner `medienbibliothek/` klonen und `medienbibliothek/install.sh` ausführen. Der Suchindex (`database/media.sqlite`) wird beim ersten Aufruf automatisch aus `metadata/katalog.jsonl` aufgebaut. Für Suche und Bildnachweise genügt die Python-Standardbibliothek.

## 2. Verbindlicher Ablauf beim Erstellen von Material

1. **Medienbedarf analysieren** – Wo hilft ein Bild didaktisch (Einstieg, Veranschaulichung, Aufgabe, Experiment, Merkkasten)?
2. **Einsatzprofil festlegen** (siehe 3). Unklar → `offen`.
3. **Zuerst suchen**, pro Bedarf eine Anfrage, deutsch formuliert:
   `media search "schräger Wurf" --fach physik --stufe 10 --profil offen --json`
4. **Treffer bewerten** – Passung zum Lernziel, fachliche Korrektheit (`fachlich`, `fachlich_hinweis`), Lesbarkeit, Beschriftungssprache (`beschriftung: de` bevorzugen), Klassenstufe, `hinweise` (z. B. US-Schaltzeichen, Personenrechte). Vorschau ansehen: Pfad aus `thumbnail` bzw. `pfad` mit dem Read-Werkzeug öffnen. `nur_verwandt: true` heißt: nur thematisch benachbart – nicht als Treffer für das eigentliche Thema ausgeben.
5. **Wiederverwenden**, wenn ein Treffer die Aufgabe sinnvoll erfüllt: Datei mit `media export ID … --ziel <materialordner>/medien --profil <profil>` in das Projekt kopieren (legt `BILDNACHWEISE.md` an) und relativ einbinden. Alternativ `pfad` direkt referenzieren.
6. **Neue Grafik nur bei Bedarf** – wenn nichts passt, wenn eine mathematisch exakte, maßgeschneiderte Zeichnung oder ein besonderer Versuchsaufbau nötig ist, wenn der Treffer fachlich unzureichend ist oder die Lizenz die Nutzung nicht erlaubt. Dann präzise selbst erstellen (SVG bevorzugt; Helfer für DIN-Schaltpläne und Koordinatensysteme: `medialib/zeichnen.py`).
7. **Bildnachweise** für jedes übernommene Medium erzeugen und ins Material schreiben:
   `media verzeichnis ID1 ID2 … --format markdown|html|latex --profil <profil>` (Exit-Code 3 = Medium im Profil unzulässig → ersetzen!). Einzeln: `media credit ID --format html`. Bei Bearbeitung (Zuschnitt, Beschriftung): `--bearbeitet ID="zugeschnitten, beschriftet"`.
8. **Gute eigene Grafiken aufnehmen**, damit sie künftig gefunden werden:
   `media add grafik.svg --eigen --titel "…" --thema <taxonomie-id> --stufe 8-10 --beschreibung "…" --alt "…" --schlagworte "a,b" --entstehung "mit Claude erstellt für …"`
   Eigenproduktionen werden als „Eigenproduktion (mit Claude erstellt)“ geführt – **nicht** als CC0/gemeinfrei deklarieren.

## 3. Einsatzprofile (Lizenzlogik)

| Profil | Wann | Zugelassen |
|---|---|---|
| `offen` (Standard) | öffentlich: Webseite, GitHub Pages, OER, frei geteiltes PDF | CC0, gemeinfrei, CC BY, CC BY-SA, Eigenproduktionen – nur verifiziert |
| `unterricht` | eigene Klasse, geschützte Lernplattform (IServ, Moodle), nichtkommerziell | zusätzlich Kategorie B (z. B. CC BY-NC, PhET) – nie als OER kennzeichnen |
| `extern` | nur verlinkte Ressourcen (Simulationen, Webcomics) | A/B, ausschließlich Links, keine Kopie |
| `recherche` | nur zum Sichten | auch ungeprüfte Kandidaten – **nie** für Material |

Regeln: Niemals die großzügigste Freigabe annehmen. ND-Lizenzen nicht bearbeiten (`--bearbeitung` schließt sie aus). ShareAlike: bearbeitete Fassung eines Bildes unter derselben Lizenz weitergeben; ein Bildnachweis erfüllt NC/SA-Bedingungen nicht automatisch. Kategorie C/ungeprüft nie verwenden.

## 4. Befehlsübersicht

```
media search "Begriff" [--fach mathematik|physik] [--typ svg|foto|diagramm|animation|cartoon|comic|historisch|symbol|simulation|3d]
             [--stufe 8|8-10|sek1|ef|q1] [--profil offen|unterricht|extern] [--thema ph.optik] [--lokal] [--limit 10] [--json]
media show ID [--json]                 Details inkl. Pfad, Lizenz, Alt-Text
media credit ID… [--format text|markdown|html|latex] [--bearbeitung "…"]
media verzeichnis ID… [--profil …] [--format …] [--bearbeitet ID="…"]
media check ID… --profil offen [--bearbeitung]     Exit 3 = unzulässig
media export ID… --ziel ORDNER [--profil …]        Dateien + BILDNACHWEISE.md
media add DATEI --eigen --titel … --thema …        Eigenproduktion aufnehmen
media topics [--fach physik] [--suche wurf]        Taxonomie-IDs
media stats | media serve (Weboberfläche) | media verify | media backup
```

Die JSON-Ausgabe von `search` enthält je Treffer: `id, titel, pfad, thumbnail, url, medientyp, format, stufe, lizenz, lizenz_kategorie, bildnachweis, alt_text, hinweise, treffergrund, nur_verwandt`.

## 5. Einbindung – Kurzrezepte

- **HTML/Lernseite:** `<figure><img src="medien/abb-01__ID.png" alt="ALT_TEXT"><figcaption>BILDNACHWEIS_HTML</figcaption></figure>`; Alt-Text aus `alt_text` übernehmen.
- **LaTeX:** `\includegraphics{medien/abb-01__ID.png}` + Quellenverzeichnis aus `media verzeichnis … --format latex`.
- **Word/PowerPoint (docx/pptx):** Bild einfügen, Nachweis als Bildunterschrift oder Folien-/Seitenende.
- **Lokale PNG-Vorschauen von Commons-SVGs:** Vektor-Original steht unter `url`/`medien_url`; auf einem eigenen Rechner bei Bedarf `media original ID`.
- Für Schwarz-Weiß-Druck `sw_geeignet`, für Druck allgemein `druck_geeignet` beachten.

Wenn die Bibliothek keinen passenden Treffer liefert, das kurz begründen („keine lizenzgeeignete Grafik zu …“) und eine eigene präzise Grafik erstellen – anschließend mit `media add --eigen` aufnehmen.
