"""Import von Schülerlisten aus CSV (z. B. aus Excel gespeichert).

Unterstützt: UTF-8 (mit/ohne BOM), Windows-1252 (Excel „CSV (Trennzeichen-getrennt)“),
Trennzeichen Semikolon, Komma und Tabulator, Spaltenköpfe wie „Vorname“, „Nachname“,
„Name“ oder „Nachname, Vorname“ in einer Spalte.
Offensichtliche Probleme und Dubletten werden zur Prüfung gemeldet.
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

FIRST = {"vorname", "vornamen", "rufname", "first name", "firstname", "given name"}
LAST = {"nachname", "familienname", "name, nachname", "last name", "lastname", "surname"}
FULL = {"name", "schüler", "schueler", "schülerin", "schüler/in", "schülername", "schuelername", "vollständiger name", "kind"}


@dataclass
class Person:
    first_name: str
    last_name: str
    zeile: int

    @property
    def anzeige(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def schluessel(self) -> str:
        """Vergleichsschlüssel für Dublettenerkennung (Groß-/Kleinschreibung, Akzente, Leerzeichen egal)."""
        s = unicodedata.normalize("NFKD", f"{self.first_name} {self.last_name}".casefold())
        s = "".join(c for c in s if not unicodedata.combining(c))
        return re.sub(r"\s+", " ", s).strip()


@dataclass
class ImportErgebnis:
    personen: list[Person] = field(default_factory=list)
    probleme: list[str] = field(default_factory=list)
    dubletten: list[tuple[Person, Person]] = field(default_factory=list)
    kodierung: str = ""
    trennzeichen: str = ""


def _decode(raw: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "utf-8"):
        try:
            return raw.decode(enc), "UTF-8"
        except UnicodeDecodeError:
            pass
    return raw.decode("cp1252", errors="replace"), "Windows-1252"


def _sniff(text: str) -> str:
    lines = [l for l in text.splitlines() if l.strip()]
    first = lines[0] if lines else ""
    # Kopfzeile ohne jedes Trennzeichen (z. B. nur „Name“) → einspaltige Liste („Nachname, Vorname“ bleibt zusammen)
    if lines and not any(d in first for d in (";", "\t", ",")) and first.strip().casefold() in FULL:
        return "\x1f"
    sample = "\n".join(lines[:20])
    counts = {d: sample.count(d) for d in (";", "\t", ",")}
    if counts[";"] >= max(1, counts[","] // 2) and counts[";"] > 0:
        return ";"
    if counts["\t"] > 0:
        return "\t"
    return "," if counts[","] > 0 else ";"


def _clean(s: str) -> str:
    s = unicodedata.normalize("NFC", (s or "").replace(" ", " ")).strip()
    return re.sub(r"\s+", " ", s)


def read_csv(path: str | Path | None = None, *, data: bytes | None = None) -> ImportErgebnis:
    raw = data if data is not None else Path(path).read_bytes()  # type: ignore[arg-type]
    text, enc = _decode(raw)
    delim = _sniff(text)
    res = ImportErgebnis(kodierung=enc, trennzeichen={";": "Semikolon", ",": "Komma", "\t": "Tabulator", "\x1f": "keins (eine Spalte)"}[delim])
    if "�" in text:
        res.probleme.append("Einige Zeichen konnten nicht gelesen werden (�). Bitte die Datei in Excel als „CSV UTF-8“ speichern.")

    rows = [[_clean(c) for c in r] for r in csv.reader(io.StringIO(text), delimiter=delim)]
    rows = [r for r in rows if any(c for c in r)]
    if not rows:
        res.probleme.append("Die Datei enthält keine Namen.")
        return res

    head = [c.casefold() for c in rows[0]]
    i_first = next((i for i, c in enumerate(head) if c in FIRST), None)
    i_last = next((i for i, c in enumerate(head) if c in LAST), None)
    i_full = next((i for i, c in enumerate(head) if c in FULL), None)
    has_header = i_first is not None or i_last is not None or i_full is not None
    body = rows[1:] if has_header else rows
    start = 2 if has_header else 1

    if not has_header:
        if len(rows[0]) >= 2:
            i_last, i_first = 0, 1  # typische Excel-Liste: Nachname; Vorname
            res.probleme.append("Keine Spaltenüberschriften gefunden – angenommen: 1. Spalte Nachname, 2. Spalte Vorname. Bitte prüfen!")
        else:
            i_full = 0

    for n, r in enumerate(body, start=start):
        def col(i: int | None) -> str:
            return r[i] if i is not None and i < len(r) else ""

        if i_first is not None or i_last is not None:
            first, last = col(i_first), col(i_last)
            if not first and not last and i_full is not None:
                first, last = _split_full(col(i_full))
        else:
            first, last = _split_full(col(i_full))
        if not first and not last:
            res.probleme.append(f"Zeile {n}: leer oder ohne Namen – übersprungen.")
            continue
        if re.search(r"\d", first + last):
            res.probleme.append(f"Zeile {n}: „{first} {last}“ enthält Ziffern – bitte prüfen.")
        if "@" in first + last:
            res.probleme.append(f"Zeile {n}: enthält eine E-Mail-Adresse – E-Mail-Adressen werden nicht benötigt.")
        if len(first) > 40 or len(last) > 60:
            res.probleme.append(f"Zeile {n}: ungewöhnlich langer Name – bitte prüfen.")
        if not first or not last:
            res.probleme.append(f"Zeile {n}: nur ein Namensteil („{first or last}“) – bitte prüfen.")
        res.personen.append(Person(first, last, n))

    seen: dict[str, Person] = {}
    for p in res.personen:
        if p.schluessel in seen:
            res.dubletten.append((seen[p.schluessel], p))
        else:
            seen[p.schluessel] = p
    return res


def _split_full(s: str) -> tuple[str, str]:
    s = _clean(s)
    if not s:
        return "", ""
    if "," in s:  # „Mustermann, Max“
        last, first = [x.strip() for x in s.split(",", 1)]
        return first, last
    parts = s.split(" ")
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]
