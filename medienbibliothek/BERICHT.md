# Abschlussbericht: Medienbibliothek Mathematik & Physik

Stand: 2026-11-13 20:47 · erzeugt mit `python3 scripts/bericht.py` aus Datenbank, Quellenmatrix und Testergebnissen.

## 1. Speicherort

- Bibliothek im Repository: `medienbibliothek/` (Branch `claude/medienbibliothek-mathe-physik-mvhzqh`), dauerhaft per Git gesichert.
- Zentraler Speicherort `~/Unterrichtsmedien/Mathe-Physik/` = Verweis auf diesen Ordner, angelegt von `install.sh` (Abweichung vom Vorschlag: Die Arbeitsumgebung war ein flüchtiger Cloud-Container; nur das Repository bleibt erhalten).
- Projektübergreifend: Befehl `media` (`~/.local/bin`), globale Skill `~/.claude/skills/medienbibliothek`, Hinweisblock in `~/.claude/CLAUDE.md`.

## 2. Technischer Aufbau

Python (Standardbibliothek für Suche/Lizenzen/Nachweise; `requests`/`Pillow` nur für Import), SQLite mit FTS5 (Wort- und Trigramm-Index), versionierter JSONL-Katalog als Quelle der Wahrheit (automatischer Index-Neuaufbau), JSON-Konfiguration (Taxonomie mit 164 Knoten, Lizenztabelle, Profile, Importplan mit 406 Einträgen), statische Weboberfläche, CLI `media`, Claude-Code-Skill. Details: [README.md](README.md).

## 3. Bestand

- **172 Medien** erfasst: **90 lokal gespeichert** (Dateien in `assets/`, 6.5 MB) und **81 extern verlinkt** (Simulationen, Webcomics, Lehrbücher), 1 Recherchekandidat(en).
- Sichtgeprüft/kuratiert: 172 Medien; fachlich als sichtgeprüft markiert: 90.
- Geprüfte Kandidaten insgesamt: 997 (neu: 495, abgelehnt: 436, importiert: 37, abgelehnt-kuration: 24, fehler: 5). Importplan: 77 von 406 Anfragen ausgeführt.

### 4. Verteilung Mathematik / Physik

| Fach | Anzahl |
|---|---:|
| Physik | 117 |
| Mathematik | 55 |

| Bereich | Anzahl |
|---|---:|
| Mechanik (`ph.mechanik`) | 22 |
| Astronomie und Astrophysik (`ph.astronomie`) | 22 |
| Elektrizitätslehre (`ph.elektrizitaet`) | 19 |
| Zahlen und Arithmetik (`ma.arithmetik`) | 18 |
| Funktionen (`ma.funktionen`) | 13 |
| Experimente und Messtechnik (`ph.experimente`) | 12 |
| Optik (`ph.optik`) | 9 |
| Stochastik (`ma.stochastik`) | 9 |
| Schwingungen und Wellen (`ph.schwingungen`) | 8 |
| Wärmelehre (Thermodynamik) (`ph.waerme`) | 7 |
| Physik (`ph`) | 7 |
| Atom-, Quanten- und Kernphysik (`ph.atom`) | 6 |
| Analysis (`ma.analysis`) | 6 |
| Mathematik (`ma`) | 6 |
| Magnetismus und Elektrodynamik (`ph.magnetismus`) | 5 |
| Analytische Geometrie und lineare Algebra (`ma.vektorgeometrie`) | 2 |
| Geometrie (`ma.geometrie`) | 1 |

Lokal gespeicherte Medien nach Fach: mathematik: 28, physik: 62
Klassenstufen (Überschneidung): Sek I 158, Sek II 120.

### 5. Verteilung nach Medientyp

| Medientyp | Anzahl |
|---|---:|
| Interaktive Simulation (Link) | 56 |
| Symbol/Icon (SVG) | 44 |
| Diagramm/Schema | 28 |
| Comic | 20 |
| Foto | 11 |
| Illustration | 6 |
| Historische Abbildung | 4 |
| Animation (GIF) | 2 |
| Cartoon | 1 |

| Dateiformat (lokal bzw. Verweis) | Anzahl |
|---|---:|
| html | 82 |
| svg | 53 |
| png | 19 |
| jpg | 16 |
| gif | 2 |

### 6. Verteilung nach Lizenz

| Kategorie | Anzahl |
|---|---:|
| A – offen (CC0/PD/CC BY/CC BY-SA) | 85 |
| B – eingeschränkt (NC, Anbieterlizenz) | 77 |
| E – Eigenproduktion | 9 |
| C – ungeklärt | 1 |

| Lizenz | Anzahl |
|---|---:|
| CC BY-SA 4.0 (`CC-BY-SA-4.0`) | 51 |
| CC BY-NC 4.0 (`CC-BY-NC-4.0`) | 51 |
| CC BY-NC 2.5 (`CC-BY-NC-2.5`) | 20 |
| Gemeinfrei als Werk der US-Bundesregierung (z. B. NASA) (`PD-USGov`) | 13 |
| Eigenproduktion (mit Claude erstellt) – keine bekannten Drittrechte (`Eigenproduktion`) | 9 |
| CC BY 4.0 (`CC-BY-4.0`) | 8 |
| CC BY-SA 3.0 (`CC-BY-SA-3.0`) | 5 |
| CC0 1.0 (Public Domain Dedication) (`CC0-1.0`) | 4 |
| Gemeinfrei (Public Domain) (`PD`) | 3 |
| GeoGebra-Lizenz (nichtkommerziell) (`GeoGebra-NC`) | 3 |
| Anbietererlaubnis für Bildungs-/Privatnutzung (keine freie Lizenz) (`Anbieter-Bildung`) | 2 |
| Lizenz unbekannt / nicht ausreichend dokumentiert (`unbekannt`) | 1 |
| GNU GPL 2.0 (Software) (`GPL-2.0`) | 1 |
| CC BY-NC-SA 4.0 (`CC-BY-NC-SA-4.0`) | 1 |

| Quelle | Anzahl |
|---|---:|
| PhET Interactive Simulations | 51 |
| OpenMoji | 44 |
| Wikimedia Commons | 21 |
| xkcd | 20 |
| NASA Image and Video Library | 13 |
| Eigenproduktion | 9 |
| OpenStax, Rice University | 3 |
| GeoGebra GmbH | 3 |
| Wellcome Collection | 2 |
| The Metropolitan Museum of Art | 1 |
| Serlo Education e.V. | 1 |
| Paul Falstad, Iain Sharp | 1 |
| Nick D Kim | 1 |
| Michael Bach | 1 |
| Joachim Herz Stiftung | 1 |

## 7. Geprüfte Bildquellen

48 Quellen geprüft (Prüfdatum 2026-11-13); vollständige Matrix mit Bewertung: [sources/QUELLEN.md](sources/QUELLEN.md).

| Quelle | Entscheidung | Lizenz(en) | Bedingungen geprüft unter |
|---|---|---|---|
| [Wikimedia Commons](https://commons.wikimedia.org/) | lokal importiert | pro Datei: CC0, gemeinfrei, CC BY, CC BY-SA (vereinzelt GFDL) | https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia |
| [NASA Image and Video Library](https://images.nasa.gov/) | lokal importiert | i. d. R. nicht urheberrechtlich geschützt (US-Bundesbehörde); Quellenangabe erbeten; Logos/Insignien ausgenommen; Material Dritter gekennzeichnet | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| [Wellcome Collection](https://wellcomecollection.org/) | lokal importiert | pro Bild im Katalog: Public Domain Mark, CC BY 4.0, CC BY-NC u. a. | https://developers.wellcomecollection.org/ |
| [The Metropolitan Museum of Art – Open Access](https://www.metmuseum.org/) | lokal importiert | CC0 für Objekte mit isPublicDomain = true | https://metmuseum.github.io/ |
| [OpenMoji](https://openmoji.org/) | lokal importiert | CC BY-SA 4.0 (Grafiken) | https://github.com/hfg-gmuend/openmoji#license |
| [PhET Interactive Simulations](https://phet.colorado.edu/) | nur extern verlinkt | CC BY-NC 4.0 (laut Lizenzkopf jeder Simulationsdatei, Stand 2026-11-13) | https://phet.colorado.edu/en/licensing |
| [GeoGebra](https://www.geogebra.org/) | nur extern verlinkt | GeoGebra-Lizenz: nur nichtkommerziell; Hinweis 'Made with GeoGebra®' | https://www.geogebra.org/license |
| [OpenStax](https://openstax.org/) | nur extern verlinkt | je Buch: 'Physics', 'Statistics' CC BY 4.0; neuere 2e-Auflagen (z. B. College Physics 2e, University Physics) CC BY-NC-SA 4.0 | https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=title,license_name,license_url |
| [xkcd](https://xkcd.com/) | nur extern verlinkt | CC BY-NC 2.5 | https://xkcd.com/license.html |
| [Falstad Circuit Simulator (CircuitJS)](https://www.falstad.com/circuit/) | nur extern verlinkt | GPL-2.0 (Software) | https://github.com/sharpie7/circuitjs1 |
| [Serlo](https://de.serlo.org/mathe) | nur extern verlinkt | CC BY-SA 4.0 | https://de.serlo.org/license/detail/1 |
| [Openverse](https://openverse.org/) | nicht verwendet | aggregiert, ohne Gewähr | https://docs.openverse.org/terms_of_service.html |
| [Smithsonian Open Access](https://www.si.edu/openaccess) | nicht verwendet | laut Bekanntheit CC0 – NICHT verifiziert | https://www.si.edu/termsofuse |
| [Europeana](https://www.europeana.eu/) | nicht verwendet | pro Objekt Rights Statements – NICHT verifiziert | https://www.europeana.eu/en/rights |
| [Library of Congress](https://www.loc.gov/) | Einzelaufnahme möglich, nicht automatisiert | keine Pauschallizenz; Rechte je Objekt selbst prüfen | https://www.loc.gov/legal/ |
| [Pixabay](https://pixabay.com/) | nicht verwendet | Pixabay Content License (keine CC-Lizenz) | https://pixabay.com/service/terms/ |
| [Pexels](https://www.pexels.com/) | nicht verwendet | Pexels-Lizenz (keine CC-Lizenz) | https://www.pexels.com/license/ |
| [Unsplash](https://unsplash.com/) | nicht verwendet | Unsplash-Lizenz (keine CC-Lizenz) | https://unsplash.com/license |
| [Flickr (CC-Fotos, Flickr Commons)](https://www.flickr.com/creativecommons/) | Einzelaufnahme möglich, nicht automatisiert | pro Foto (CC, PDM, 'no known copyright restrictions', sonst alle Rechte vorbehalten) | https://www.flickr.com/services/api/tos/ |
| [ESA/Hubble](https://esahubble.org/images/) | Einzelaufnahme möglich, nicht automatisiert | CC BY 4.0, Credit unverändert (z. B. 'ESA/Hubble') | https://esahubble.org/copyright/ |
| [ESA/Webb](https://esawebb.org/images/) | Einzelaufnahme möglich, nicht automatisiert | CC BY 4.0 mit bildspezifischer Credit-Zeile | https://esawebb.org/copyright/ |
| [ESO](https://www.eso.org/public/images/) | Einzelaufnahme möglich, nicht automatisiert | CC BY 4.0 (Ausnahmen u. a. VT-2004-Bilder); KI-Bearbeitung kennzeichnen | https://www.eso.org/public/copyright/ |
| [ESA (allgemeine Website)](https://www.esa.int/) | nicht verwendet | Website-Bedingungen untersagen Weiterverbreitung; einzelne Bilder ggf. CC BY-SA 3.0 IGO (nicht verifiziert) | https://www.esa.int/terms-and-conditions |
| [CERN](https://cds.cern.ch/) | nicht verwendet | CERN behält Urheberrecht; Weitergabe an Dritte untersagt | https://copyright.web.cern.ch/ |
| [DLR](https://www.dlr.de/de/medien) | Einzelaufnahme möglich, nicht automatisiert | Standard: alle Rechte DLR; ausdrücklich gekennzeichnete Bilder CC BY-NC-ND 3.0 DE | https://www.dlr.de/en/imprint |
| [NOAA](https://www.noaa.gov/digital-library) | nicht verwendet | nicht verifiziert | https://www.noaa.gov/disclaimer |
| [NOIRLab](https://noirlab.edu/public/images/) | nicht verwendet | nicht verifiziert (Seite leer) | https://noirlab.edu/public/copyright/ |
| [NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/) | Einzelaufnahme möglich, nicht automatisiert | gemeinfrei, sofern nicht anders angegeben; teils lizenzierte Musik | https://svs.gsfc.nasa.gov/help/ |
| [Cleveland Museum of Art – Open Access](https://www.clevelandart.org/open-access) | Einzelaufnahme möglich, nicht automatisiert | CC0 für share_license_status = CC0 | https://www.clevelandart.org/open-access |
| [Rijksmuseum](https://www.rijksmuseum.nl/en/research/conduct-research/data) | nicht verwendet | nicht verifiziert | https://data.rijksmuseum.nl/policy |
| [Science Museum Group](https://collection.sciencemuseumgroup.org.uk/) | Einzelaufnahme möglich, nicht automatisiert | überwiegend nichtkommerzielle CC-Lizenzen | https://collection.sciencemuseumgroup.org.uk/about |
| [Internet Archive Book Images (Flickr)](https://www.flickr.com/photos/internetarchivebookimages/) | nicht verwendet | keine Rechteangabe auf der Seite | https://publicdomainreview.org/rights-labelling-on-our-site/ |
| [The Public Domain Review](https://publicdomainreview.org/) | Einzelaufnahme möglich, nicht automatisiert | Kennzeichnung je Objekt (Leitfaden, keine Rechtsberatung) | https://publicdomainreview.org/rights-labelling-on-our-site/ |
| [Science and Ink (Nick D Kim)](https://lab-initio.com/index.html) | nur extern verlinkt | frei für Bildungs- und Privatnutzung (Anbietererlaubnis, keine freie Lizenz) | https://lab-initio.com/index.html |
| [Optische Täuschungen (Michael Bach)](https://michaelbach.de/ot/) | nur extern verlinkt | Nutzung mit Quellenangabe/Backlink erlaubt; Drittinhalte ausgenommen | https://michaelbach.de/ot/-misc/faq.html |
| [LEIFIphysik](https://www.leifiphysik.de/) | nicht verwendet | nicht verifiziert | – (nicht verfügbar) |
| [ZUM-Unterrichten](https://unterrichten.zum.de/) | nicht verwendet | nicht verifiziert (Lizenzseite 404) | – (nicht verfügbar) |
| [WirLernenOnline (WLO)](https://wirlernenonline.de/) | Einzelaufnahme möglich, nicht automatisiert | eigene Inhalte CC BY 4.0; indexierte Inhalte nach Lizenz der Partnerseite | https://wirlernenonline.de/impressum/ |
| [Mundo (mundo.schule)](https://mundo.schule/) | nicht verwendet | nicht verifiziert (JavaScript-Seite) | – (nicht verfügbar) |
| [Openclipart](https://openclipart.org/) | Einzelaufnahme möglich, nicht automatisiert | CC0 für alle Cliparts (Ausnahmen mit 'pd_issue') | https://openclipart.org/share |
| [Open Peeps](https://www.openpeeps.com/) | Einzelaufnahme möglich, nicht automatisiert | CC0 | https://www.openpeeps.com/ |
| [unDraw](https://undraw.co/) | nicht verwendet | eigene Lizenz: keine Weitergabe als Paket/konkurrierende Sammlung, kein KI-Training | https://undraw.co/license |
| [SVG Repo](https://www.svgrepo.com/) | nicht verwendet | gemischt; Standard-Lizenz verbietet Weiterverbreitung wie SVG Repo | https://www.svgrepo.com/page/licensing/ |
| [janosh/diagrams (TikZ-Physikdiagramme)](https://diagrams.janosh.dev/) | Einzelaufnahme möglich, nicht automatisiert | MIT (Herkunft einzelner Diagramme prüfen) | https://github.com/janosh/diagrams/blob/main/license |
| [digiLL](https://digill.de/) | Einzelaufnahme möglich, nicht automatisiert | CC BY-SA 4.0 'sofern nicht anders angegeben' | https://digill.de/ |
| [LibreTexts](https://phys.libretexts.org/) | nicht verwendet | auf Startseite 'not declared'; je Seite verschieden | – (nicht verfügbar) |
| [Desmos](https://www.desmos.com/) | nicht verwendet | nicht verifiziert (JavaScript-Seite) | https://www.desmos.com/terms |
| [Wolfram Demonstrations Project](https://demonstrations.wolfram.com/) | nicht verwendet | nicht verifiziert | – (nicht verfügbar) |

### Nicht für automatischen lokalen Download verwendet (Auswahl mit Grund)

- **PhET Interactive Simulations:** Fachlich exzellent, deutsch verfügbar. Lizenz ist inzwischen nichtkommerziell (Kategorie B) → nur Verlinkung/Einbettung, keine lokale Kopie, nicht als OER. 51 Simulationen einzeln verifiziert, 2 Pfade nicht mehr vorhanden.
- **GeoGebra:** Werkzeug-Links (Grafikrechner, Geometrie, 3D). Nutzerinhalte nicht weiterverbreiten (Nutzungsbedingungsseite /tou war 404).
- **OpenStax:** Englische Lehrbücher als Referenz. Abbildungen können Drittrechte enthalten → keine automatische Bildübernahme.
- **xkcd:** Humorvolle Einstiege (Oberstufe, englisch). NC → Kategorie B, nur verlinkt; Comics mit nicht altersgerechten Alt-Texten bewusst ausgelassen.
- **Falstad Circuit Simulator (CircuitJS):** Schaltungssimulation mit sichtbarem Stromfluss; als Link unkritisch.
- **Serlo:** Deutschsprachige Erklärungen; Grafiken könnten künftig einzeln (mit Nachweis 'Quelle: serlo.org') aufgenommen werden.
- **Openverse:** Nutzungsbedingungen untersagen Scraping und schließen Gewähr für Lizenzangaben aus; Lizenzen müssen ohnehin an der Originalquelle geprüft werden.
- **Smithsonian Open Access:** Bedingungsseiten lieferten 403; ohne verifizierte Bedingungen und ohne eigenen Schlüssel keine Nutzung.
- **Europeana:** Seiten lieferten 403, kein Schlüssel vorhanden.
- **Pixabay:** Bedingungen verbieten Massendownloads und den Aufbau ähnlicher/konkurrierender Sammlungen; nur Einzelnutzung per manuellem Download. Für die Bibliothek nicht automatisiert genutzt.
- **Pexels:** Weiterverbreitung auf anderen Bildplattformen untersagt; öffentliches Sammel-Repository daher riskant. Einzelnutzung im Material möglich.
- **Unsplash:** Lizenz schließt das Zusammenstellen zu einem ähnlichen/konkurrierenden Dienst aus; API verlangt Hotlinking. Nur Einzelnutzung.
- **ESA (allgemeine Website):** Weiterverbreitung laut Website-Bedingungen nicht gestattet; ESA/Hubble bzw. ESA/Webb nutzen.
- **CERN:** Verbot der Weitergabe passt nicht zu einer weitergebbaren Bibliothek.
- **NOAA:** Bildnutzungsbedingungen nicht abrufbar (405).
- **NOIRLab:** Bedingungen nicht lesbar.
- **Rijksmuseum:** Lizenzangaben auf der gelesenen Seite nicht enthalten.
- **Internet Archive Book Images (Flickr):** Ohne Rechteangabe nicht verwendbar.
- **Science and Ink (Nick D Kim):** Kategorie B: nur verlinken bzw. einzeln nach Anbieterbedingungen nutzen.
- **Optische Täuschungen (Michael Bach):** Kategorie B: verlinken.
- **LEIFIphysik:** Kategorie C: nur als ungeprüfter Link-Tipp (Profil 'recherche'); keine Inhalte übernehmen.
- **ZUM-Unterrichten:** Lizenzseite nicht gefunden; vor Nutzung manuell prüfen.
- **Mundo (mundo.schule):** Inhalt nicht lesbar.
- **unDraw:** Lizenz widerspricht einer Sammlung.
- **SVG Repo:** Nur einzelne Icons mit CC0/CC BY auf ihrer Seite wären möglich.
- **LibreTexts:** Lizenz nicht eindeutig.
- **Desmos:** Bedingungen nicht lesbar; keine Grafiken übernehmen.
- **Wolfram Demonstrations Project:** Bedingungen nicht lesbar.

## 8. Implementierte Suchbefehle

```
media search "schiefer Wurf" --fach physik
media search "quadratische Funktion" --fach mathematik
media search "elektrische Feldlinien" --typ svg
media search "Newton Gesetze" --typ cartoon --profil unterricht
media search "Reflexion Brechung" --stufe 8-10
media search "Pendel Schwingung" --typ animation
media search "Kreisfläche" --profil offen --json
media show ID | media credit ID --format html | media verzeichnis ID… --profil offen
media check ID… --profil offen | media export ID… --ziel ORDNER | media add DATEI --eigen …
media topics | media stats | media verify | media backup | media serve | media web | media original ID
```
Vollständige Referenz: README Abschnitt 4.

## 9. Nutzung aus Claude Code

Skill `medienbibliothek` (global und im Repository) mit verbindlichem Ablauf: Bedarf analysieren → `media search … --json` → Treffer bewerten → `media export` → nur bei Bedarf neu zeichnen (`medialib/zeichnen.py`) → `media verzeichnis` für Bildnachweise → gute Eigenproduktionen mit `media add --eigen` aufnehmen. Die Repository-`CLAUDE.md` legt für das öffentliche GitHub-Pages-Repository das Profil `offen` fest.

## 10. Eigene visuelle Suche

`medienbibliothek/index.html` per Doppelklick oder `media serve`. Filter nach Fach, Thema, Medientyp, Stufe, Lizenzprofil, lokal, S/W; Detailansicht mit Animation, Lizenz, kopierbarem Bildnachweis, Pfad/Download und Warnhinweisen.

## 11. Erweiterung

Importplan ergänzen und `python3 scripts/import_lauf.py` (wiederaufnehmbar); neue Quellenadapter in `medialib/sources/`; `media add` für Einzelmedien; `media verify` für Nachprüfungen und tote Links; `media backup/restore`; Kuration über `media kontaktbogen` + `scripts/kuratieren.py`.

## 12. Offene Lizenzfragen und bekannte Einschränkungen

- **Wikimedia-Drosselung:** Ohne Kontaktangabe im User-Agent gilt die Klasse „unidentifiziert“ (ca. 10 Anfragen/min je IP, geteilte Egress-IP). Effektiv ca. 1 Suchanfrage pro Minute; Originaldateien lieferten 429 mit Retry-After 600 s und dem Hinweis, Vorschaubilder in Standardgrößen zu nutzen. Daher sind Commons-Medien lokal als PNG/JPG/GIF in Wikimedia-Standardbreiten (SVG-Originale als 1280-px-PNG) gespeichert; das Vektor-Original ist verlinkt und per `media original ID` einzeln nachladbar.
- **Importplan nicht vollständig abgearbeitet:** 77 von 406 Anfragen ausgeführt. `python3 scripts/import_lauf.py` setzt an dieser Stelle fort.
- **Gemeinfreiheit nach US-Recht (NASA, PD-USGov):** in Deutschland nicht abschließend geklärt; NASA erlaubt Bildungsnutzung ausdrücklich. Gekennzeichnet (`us-pd`).
- **Persönlichkeitsrechte/Marken:** aus den Quellmetadaten übernommen und gekennzeichnet; keine werbliche Nutzung.
- **CC BY-SA:** Unverändert eingebunden genügt der Bildnachweis; bearbeitete Fassungen müssen unter derselben Lizenz weitergegeben werden (Hinweis in Nachweis und Prüfung).
- **PhET** steht inzwischen unter CC BY-NC 4.0 (nicht mehr CC BY) → nur Profil `unterricht`/`extern`.
- **Eigenproduktionen** sind nicht automatisch gemeinfrei/CC0; die Lizenz legt die veröffentlichende Lehrkraft fest.
- Automatische Qualitätsmerkmale (S/W-Eignung, Transparenz, Beschriftungssprache) sind Heuristiken; maßgeblich ist die Sichtprüfung (`fachlich`, `qualitaet`).
- Cartoons/Comics mit freier Lizenz sind selten: lokal nur gemeinfreie historische Karikaturen und frei lizenzierte Zeichnungen; moderne Webcomics (xkcd) nur verlinkt (NC).
- Nicht verifizierbar (403/404/JavaScript-Seiten): Smithsonian, Europeana, NOAA, NOIRLab, LEIFIphysik, ZUM-Unterrichten, Desmos, Wolfram – nicht verwendet.
- **Themenlücken** (Blattthemen ohne lokales Medium, 88 von 139): Dezimalzahlen, Prozentrechnung, Verhältnisrechnung und Proportionalität (nur extern), Größen und Einheiten (Mathematik), Funktionsbegriff und Graphen (nur extern), Transformation von Funktionsgraphen, Änderungsraten, Integrale (nur extern), Optimierungsprobleme, Ebene Figuren, Dreiecke, Vierecke, Kreise, Geometrische Körper, Oberfläche und Volumen, Symmetrie und Abbildungen, Kongruenz und Dreieckskonstruktion, Ähnlichkeit, Strahlensätze, Trigonometrie, Satz des Thales, Räumliche Geometrie und Darstellung, Koordinatensysteme, Vektoren (nur extern), Geraden und Ebenen im Raum, Lagebeziehungen und Abstände, Skalarprodukt und Vektorprodukt, Lineare Gleichungssysteme und Matrizen (nur extern), Wahrscheinlichkeiten, Baumdiagramme, Vierfeldertafeln und bedingte Wahrscheinlichkeit (nur extern), Kombinatorik, Wahrscheinlichkeitsverteilungen (nur extern), Beschreibende Statistik (nur extern), Bewegungen, Geschwindigkeit, Beschleunigung (nur extern), Freier Fall, Waagerechter Wurf, Senkrechter Wurf, Überlagerung von Bewegungen, Kräfte (nur extern), Reibung (nur extern), Einfache Maschinen und Drehmoment (nur extern), Arbeit und Leistung, Kreisbewegung (nur extern), Druck und Auftrieb (nur extern), Elektrische Stromstärke, Elektrischer Widerstand (nur extern), Elektrische Leistung und Energie, Elektrische Felder (nur extern), Halbleiter und Elektronik, Magnetfelder, Elektromagnete (nur extern), Elektromagnetische Induktion (nur extern), Generatoren (nur extern), Elektromotoren, Transformatoren und Energieübertragung, Lorentzkraft, Reflexion, Spiegel, Brechung (nur extern), Linsen und optische Abbildung (nur extern), Spektren (nur extern), Interferenz, Beugung und Polarisation von Licht, Optische Täuschungen und Wahrnehmung (nur extern), Wärmeübertragung, Gasgesetze (nur extern), Energieumwandlungen und Wirkungsgrad (nur extern), Wärmekraftmaschinen und Wärmepumpen, Pendel (nur extern), Harmonische Schwingungen, Feder-Masse-Systeme (nur extern), Gedämpfte und erzwungene Schwingungen, Resonanz (nur extern), Mechanische Wellen (nur extern), Interferenz und Beugung von Wellen (nur extern), Energieniveaus und Laser (nur extern), Photoeffekt, Quantenphänomene (nur extern), Kernspaltung und Kernenergie, Kernfusion, Teilchenphysik, Galaxien, Kosmologie, Versuchsaufbauten, Messunsicherheiten und Auswertung (nur extern), Physikalische Größen und Einheiten (nur extern).

### Häufigste Ablehnungsgründe beim Import

- 185× Suchbegriffe kommen in Titel/Beschreibung/Kategorien nicht vor
- 80× Format pdf nicht vorgesehen
- 37× Weder Suchbegriffe noch Fachbegriffe des Themas im Titel
- 31× Hinweis auf Rechte Dritter (z. B. ©, ESA, Agenturfoto)
- 30× Auflösung zu gering
- 24× Sichtprüfung
- 13× Titel/Kategorie deutet auf ungeeigneten Inhalt (Logo, Karte, Flagge, Werbung …)
- 12× Format tif: Original-Download von Wikimedia gedrosselt, kein geeignetes Standard-Vorschaub
- 6× Logo/Insignie
- 6× Urheberangabe 'JT Heineck' nicht eindeutig NASA
- 5× Marken-/Insignien-Einschränkung
- 5× Format webm nicht vorgesehen

## 13. Ergebnisse der Funktionstests

Noch nicht ausgeführt.

