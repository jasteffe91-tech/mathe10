# Balance – Analyse, Kriterien und Messwerte

Alle Zahlen stammen aus reproduzierbaren Simulationen mit den echten Spielregeln (Strategie-Bots in
`tests/helpers/strategies.js`, feste Seeds). Ein Bot ist kein Mensch: Er räumt keine Hindernisse, nutzt
keine Zielwahl und baut nach festem Plan. Die Tabellen zeigen daher Tendenzen, keine exakten
Schwierigkeitsgrade für Menschen.

Werkzeuge:

```bash
node tools/balance-report.mjs gruenental,felsenpass normal normal 1,2   # Strategien × Karten → Markdown-Tabelle
node tools/tower-efficiency.mjs                                         # Schaden je Gold und Schadensanteil je Turmtyp
node tools/balance-experiment.mjs '<json-patch>' <karten> <strategien>  # Werte testweise ändern (nur im Speicher)
```

## Strategien

| Kürzel | Strategie | Platzierung |
|---|---|---|
| cluster | Ballung an einer Stelle | alles um die eine Stelle mit der höchsten Wegabdeckung (Fluglinien bewusst ignoriert) |
| spread | Verteilt auf drei Brennpunkte | drei Brennpunkte ≥ 260 px auseinander, reihum |
| control | Gemischt mit Kontrolle | alle Turmtypen inkl. Frost/Banner, jeweils beste Abdeckung (Fluglinien zählen, sobald Harpyien angekündigt sind) |
| single | Einzelziel & Panzerbrechung | Pfeil, Scharfschütze, Speer, Tribok |
| aoe | Schwerpunkt Flächenschaden | Kanone, Blitz, Gift, Frost |
| economy | Sparsam | höchstens 1400 G verbaut, ruft Wellen früh |

## Ursachen: Warum das Raster zu starke Positionen ermöglichte

Gemessen vor den Änderungen (Stand des Raster-Updates):

1. **Viele gleich gute Plätze an einem Brennpunkt.** Die beste Einzelposition deckt mit Raster kaum mehr
   Weg ab als vorher mit festen Bauplätzen (Grünental, Reichweite 140: 12 % → 16 %). Aber statt *einem*
   Platz erreichen jetzt 8–25 Rasterzellen fast diese Abdeckung – die ganze Verteidigung passt in eine
   einzige U-Kurve.
2. **Das Kriegsbanner verstärkte beliebig viele dicht gepackte Türme.** Ohne Banner verlor die Ballung auf
   allen Karten in Welle 20, mit Banner gewann sie überall.
3. **Nichts bestrafte die Ballung.** Alle Gegner liefen denselben Weg durch die Todeszone; es gab keinen
   Gegner, der räumlich ausweicht oder dichte Türme stört.
4. **Einzelne Ausreißer:** Der Tribok lag bei etwa 90–100 Schaden je Gold (alle anderen 30–55),
   Scharfschützen decken von einem Punkt 41–65 % des Weges ab.

Ergebnis vorher, Normal (Karten: Grünental, Felsenpass, Sumpfgabel, Frostgipfel, Wüstenschlucht;
S−n = gewonnen mit n verlorenen Leben, Wn = verloren in Welle n):

| Strategie | Grün | Fels | Sumpf | Frost | Wüste |
|---|---|---|---|---|---|
| cluster | S−0 | S−0 | S−0 | S−0 | S−0 |
| control | S−0 | S−1 | S−0 | S−2 | S−2 |
| single | S−0 | S−0 | S−0 | S−8 | S−2 |
| spread | W10 | W10 | W15 | W10 | W10 |
| aoe | W10 | W4 | W15 | W3 | W15 |
| economy | W15 | W15 | W18 | W15 | W15 |

Die Ballung war fehlerfrei auf jeder Karte – die dominante Strategie.

## Balancekriterien

| | Kriterium | abgesichert durch |
|---|---|---|
| K1 | Keine Strategie gewinnt auf Normal alle Karten ohne Lebensverlust. | `tests/balance.test.js` |
| K2 | Die Ballung an einer Stelle scheitert auf mehreren Karten. | `tests/balance.test.js` |
| K3 | Jede Karte ist auf Normal mit einer Nicht-Ballungs-Strategie schaffbar. | `tests/balance.test.js` |
| K4 | Kein Turmtyp macht in einer gemischten Verteidigung ≥ 45 % des Schadens. | `tests/balance.test.js` |
| K5 | Auf Entspannt gewinnt eine gemischte Verteidigung jede Karte. | `tests/balance.test.js` |
| K6 | Ohne Türme bzw. nur mit Pfeiltürmen ist das Spiel nicht zu gewinnen. | `tests/balance.test.js` |
| K7 | Die ersten vier Wellen kommen ohne Fähigkeiten aus; danach kommt höchstens eine neue Fähigkeit je Welle (5, 6, 7, 8, 11, 13), jede mit sichtbarer Kennzeichnung und Erklärung. | `tests/enemies.test.js` |

## Neue Gegnerrollen und ihre Konter

| Gegner | Rolle | Stärke | Schwäche / Konter | Kennzeichnung | ab Welle |
|---|---|---|---|---|---|
| Geist | resistent | physischer Schaden nur 40 % | Blitz +25 %, Kanone, Frost, Gift voll | halb durchsichtig, Schleppe | 6 |
| Harpyie | schnell / umgeht | fliegt geradlinig zur Bastion; Kanone, Tribok, Gift treffen nicht | Pfeil, Frost, Blitz, Speer, Scharfschütze; Türme an die Fluglinie | Flügel, Schatten, gestrichelte Fluglinie | 7 |
| Berserker | zeitweise immun | alle 8 s Raserei: +45 % Tempo, frostimmun | Schaden statt Kontrolle | rote Flammenaura | 8 |
| Runenhexer | Unterstützung (stört Türme) | lähmt alle Türme in 100 px für 2,5 s | Abstand zum Weg, verteilte Türme, schnell töten | violetter Ladering (1 s Vorwarnung) | 11 |
| Elite | schwer gepanzert | +60 % Leben, +2 Panzerung | panzerbrechend (Scharfschütze, Speer, Kanone, Gift) | goldener Rand und Krone | 13 |
| Oger / Titan (Bosse) | Boss | stampfen: betäuben Türme in 100/120 px (max. alle 10 s) | weit reichende Türme mit Abstand | brauner Ladering | 5 / 20 |

Schadensarten der Türme: ⚔ physisch (Pfeil, Speer, Scharfschütze), ✹ explosiv (Kanone, Tribok),
✦ Magie (Blitz), ❄ Frost, ☠ Gift. Angezeigt im Infobereich und in der Anleitung; „trifft keine Flieger“
steht bei Kanone, Tribok und Gift.

**Warum das gegen Ballung wirkt, ohne Bauverbote:** Harpyien nehmen einen anderen Weg als die Todeszone
(wer nur an einer Kurve baut, lässt sie durch). Lähm-Puls und Stampfen treffen nur Türme dicht am Gegner –
dichte Pakete direkt am Weg verlieren für 2,5 s ihre Feuerkraft, verteilte oder zurückgesetzte Türme nicht.
Geister und Berserker verlangen gemischte Schadensarten statt eines einzigen Turmtyps. Das Raster bleibt
völlig frei.

## Geänderte Werte und warum

| Wert | vorher | nachher | Grund |
|---|---|---|---|
| Tribok Schaden (Stufe 1/2/3) | 110 / 170 / 260 | 75 / 115 / 175 | Ausreißer bei Schaden je Gold |
| Tribok Bonus gegen große Gegner | 60 / 80 / 100 % | 50 / 60 / 75 % | dito |
| Blitz Schaden | 16 / 24 / 36 | 21 / 31 / 46 | war zu schwach, ist jetzt Konter gegen Geister |
| Speer Schaden | 22 / 34 / 52 | 28 / 43 / 64 | war zu schwach |
| Kartenfaktor Grünental / Felsenpass / Frostgipfel | 0,92 / 1,15 / 1,45 | 0,9 / 1,0 / 1,2 | neue Gegner machen die Karten schwerer; Ausgleich |
| Elite | – | ×1,6 Leben, +2 Panzerung, ×2 Belohnung | neue Rolle |
| Flugzeit Harpyien | – | mind. 50 % der Laufzeit eines Plünderers auf dem Weg | auf Karten mit kurzer Luftlinie (Felsenpass) sonst kaum aufzuhaltbar |
| Oger-Stampfen | – | 100 px, 2,5 s, alle 10 s, ab 6 s | erst als 140 px / 3 s zu stark gemessen |
| Titan-Stampfen | – | 120 px, 2,5 s, alle 10 s | erst als 140 px / 3 s / 8 s zu stark gemessen |

Nicht geändert: `enemyHpMult` (1,25), Startgold, Verkaufsquote, Banner (die Begrenzung auf die nächsten
n Türme ist im Code möglich – `maxTargets` –, brachte in Messungen aber kaum Wirkung; die neuen Gegner
lösen das Ballungsproblem wirksamer).

## Ergebnisse nachher

Normal, gleiche Bots und Seeds:

| Strategie | Grün | Fels | Sumpf | Frost | Wüste |
|---|---|---|---|---|---|
| cluster | W19 | W19 | S−2 | W19 | S−0 |
| control | S−1 | W20 | S−18 | W20 | S−10 |
| single | S−10 | S−8 | S−0 | S−8 | S−3 |
| spread | W10 | W8 | W15 | W10 | W10 |
| aoe | W7 | W5 | W10 | W5 | W10 |
| economy | W15 | W14 | W15 | W12 | W15 |

- Die Ballung scheitert auf drei von fünf Karten – jeweils an durchgelassenen Harpyien (20 je Karte).
- Keine Strategie ist überall fehlerfrei; jede Karte wird von mindestens einer Nicht-Ballungs-Strategie
  gewonnen.
- Reine Flächenschaden-Aufstellungen scheitern früh (Panzerung, Harpyien) – gewollt: Sie brauchen Partner.

Entspannt: control und single gewinnen alle Karten; cluster gewinnt alle, aber mit bis zu 27 verlorenen
Leben. Hart: fast alle Bots scheitern in Welle 5 (Oger) – wie schon vor den Änderungen.

Schaden je Gold (Grünental, Felsenpass, Sumpfgabel × cluster/control/spread):

| Turm | Schaden je Gold | Anteil am Schaden |
|---|---|---|
| Gift | 55 | 14 % |
| Scharfschütze | 45 | 26 % |
| Pfeil | 37 | 14 % |
| Tribok | 37 | 7 % |
| Kanone | 34 | 16 % |
| Blitz | 31 | 7 % |
| Speer | 29 | 14 % |
| Frost | 7 | 3 % (Kontrollturm, wirkt über Verlangsamung) |

## Bewiesen vs. manuell zu prüfen

**Durch Tests bewiesen** (`npm test`): K1–K7, Reproduzierbarkeit (gleicher Seed → gleiches Ergebnis),
Resistenzen und Panzerung in der richtigen Reihenfolge, Raserei-Immunität, Lähm-Puls nur bei Nähe und
nicht gegen Banner, gelähmte Türme feuern nicht, Elite-Werte, Flieger-Route und -Tempo, Bogengeschosse
ignorieren Flieger.

**Nur manuell beurteilbar:**
- Wie schwer sich die Karten für Menschen anfühlen (Bots räumen nicht und nutzen keine Zielwahl).
- Ob die Vorwarnung des Lähm-Pulses (1 s) im Getümmel reicht.
- Ob „Hart“ ab Welle 5 zu steil ist – die Bots scheitern dort fast immer, ein Mensch mit gezielter
  Turmwahl vermutlich seltener.
- Ob die Einführungsmeldungen beim ersten Auftauchen ausreichend erklären.
