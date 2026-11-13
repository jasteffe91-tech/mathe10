# Hinweise für Claude Code in diesem Repository

Dieses Repository enthält Unterrichtsmaterialien (Lernseiten, Labore, Spiele) und wird über **GitHub Pages öffentlich** ausgeliefert.

## Medien für Mathematik und Physik

- Vor dem Zeichnen oder Generieren einer Grafik für Mathe-/Physikmaterial zuerst die Medienbibliothek in `medienbibliothek/` durchsuchen (Skill `medienbibliothek`, Anleitung in `medienbibliothek/README.md`):
  `medienbibliothek/bin/media search "Begriff" --fach physik --profil offen --json`
- Weil alles hier öffentlich erscheint, gilt das Einsatzprofil **`offen`** (nur CC0, gemeinfrei, CC BY, CC BY-SA, Eigenproduktionen). NC-Material (z. B. PhET, xkcd) nur verlinken, nie kopieren.
- Übernommene Medien mit `media export ID … --ziel <seitenordner>/medien --profil offen` in den Ordner der jeweiligen Seite kopieren und den Bildnachweis (`media verzeichnis …`) sichtbar auf der Seite angeben.
- Gelungene eigene Grafiken mit `media add DATEI --eigen …` in die Bibliothek aufnehmen.
