# Auswertung: Lernstände abrufen und Berichte erstellen

## Online beobachten (pseudonym) – Lehrkraft-Dashboard

`…/lernlabore2/site/lehrkraft/` mit dem Supabase-Konto anmelden.

| Reiter | Inhalt |
|---|---|
| **Übersicht** | je Kennung: Fortschrittsbalken, erledigte Aufgaben (Punkte), letzte Speicherung, Status; Kacheln (begonnen, fertig, gerade aktiv). Aktualisiert sich alle 15 Sekunden. Sortiert nach Kennung – **keine Rangliste**. |
| **Aufgaben** | je Aufgabe: wie viele erledigt, Antwortverteilung, „beim ersten Versuch richtig“; Aufgaben mit weniger als 50 % Erstversuch-Treffern werden als **„besonders häufig falsch“** markiert. |
| **Antworten** | alle Antworten und Messwerte pseudonym (Matrix oder je Kennung); CSV-Download, pseudonymer JSON-Gesamtexport. |
| **Verwaltung** | Labore zuweisen, Durchgang archivieren, Ergebnisse löschen, Löschdatum, Gruppe archivieren/löschen, sperren, teilen, Protokoll. |
| **Gastzugänge** | Veranstaltungen anlegen und beenden. |

Angezeigt wird der Stand **nach jeder abgeschlossenen Aufgabe** – einzelne Tastendrücke oder Mausbewegungen werden nicht erfasst.

## Namentlich auswerten – nur im Lehrerprogramm

1. Lehrerprogramm starten, Tresor entsperren, Lerngruppe wählen.
2. **Lernstände jetzt abrufen** – das Programm meldet sich mit dem gespeicherten Erneuerungstoken an
   (beim ersten Mal mit Passwort), lädt die **pseudonymen** Ergebnisse und ordnet sie **lokal** den Namen zu.
3. **Auswertung öffnen** zeigt: Name · Kennung · Lernlabor · Fortschritt · Ergebnis („2 von 2“ = richtig beantwortete
   Auswertungsfragen) · letzte Speicherung. Doppelklick → alle Antworten und Messwerte der Person.
4. Die abgerufenen Daten liegen verschlüsselt im Tresor und sind **auch ohne Internet** wieder verfügbar
   (Datenstand wird oben angezeigt).

## Berichte

**PDF-Auswertung erstellen** → Lernlabor wählen → gewünschte Berichte anhaken:

| Bericht | Inhalt | Namen |
|---|---|---|
| Klassenübersicht mit Einzelantworten | Tabelle aller Personen mit Fortschritt, Ergebnis und Antworten je Aufgabe + Aufgabenstatistik | ja (vertraulich) |
| Klassenübersicht – nur Statistik | Fortschritt und Ergebnis je Person, ohne Einzelantworten (datensparsam) | ja (vertraulich) |
| Einzelauswertung | je Person eine Seite: alle Aufgaben, Antworten, Messwerte/Versuchsdaten, Bewertung | ja (vertraulich) |
| Offene Aufgaben | wer welche Aufgaben noch nicht abgeschlossen hat | ja (vertraulich) |
| Anonymisierte Auswertung | nur Statistik, keine Namen, keine Kennungen – z. B. für Fortbildungen | nein |
| Excel (XLSX) | Blätter „Übersicht“, „Antworten“, „Offene Aufgaben“ | ja (vertraulich) |
| CSV | alle Antworten, Semikolon-getrennt, öffnet in deutschem Excel | ja (vertraulich) |

Hinweise:
- Berichte mit Namen tragen den Vermerk **„VERTRAULICH – enthält personenbezogene Daten“**. Nur lokal speichern,
  nicht per E-Mail versenden, nicht in Cloud-Ordnern (OneDrive, Dropbox, iCloud) ablegen.
- Export-Dateien werden nie automatisch an den Server übertragen; die Zuordnung Name ↔ Kennung verlässt den Rechner nicht.
- Bei sehr kleinen Gruppen können auch anonyme Statistiken Rückschlüsse erlauben.
- Bewertet werden nur Auswertungsfragen mit hinterlegter Lösung. Vermutungen werden bewusst **nicht** bewertet.
  „Beim ersten Versuch richtig“ zeigt, ob die erste Antwort stimmte; Kinder dürfen nach einer Rückmeldung neu wählen.

## Ohne Internet / ohne Server

- Abgerufene Lernstände bleiben im Tresor; Auswertung und Berichte funktionieren offline.
- Demo-Daten aus dem Browser-Demo: Dashboard (`?demo=1`) → *Antworten* → „Pseudonymer Gesamtexport (JSON)“ →
  im Lehrerprogramm *Datei → Pseudonymen Export (JSON) einlesen*.

## Aufräumen nach einem Durchgang

1. Dashboard → *Verwaltung* → **Durchgang archivieren** (keine neuen Speicherungen mehr).
2. Berichte erstellt? → **Ergebnisse löschen** bzw. Löschdatum passend setzen.
3. Im Lehrerprogramm die Gruppe lokal löschen, wenn sie nicht mehr gebraucht wird (*Lerngruppe lokal löschen …*).
4. Alte PDF/Excel-Dateien gemäß schulischer Aufbewahrungsregeln löschen.
