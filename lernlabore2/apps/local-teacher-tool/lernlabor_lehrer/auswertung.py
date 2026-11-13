"""Lokale Zusammenführung: pseudonyme Ergebnisse (vom Server) + Namen (aus dem Tresor).

Die Zuordnung passiert ausschließlich hier auf dem Rechner der Lehrkraft.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .modell import full_name


@dataclass
class Aufgabe:
    task_id: str
    title: str
    section: str
    kind: str
    graded: bool
    position: int
    options: list[dict[str, str]]
    solution: dict[str, Any] | None
    counts: bool = True


@dataclass
class Antwort:
    aufgabe: Aufgabe
    status: str              # completed | in_progress | open
    antwort_text: str
    messwerte: str
    is_correct: bool | None
    first_is_correct: bool | None
    gespeichert: str | None


@dataclass
class Zeile:
    participant_id: str
    name: str
    vorname: str
    nachname: str
    pseudonym: str
    im_tresor: bool
    lab_id: str
    lab_title: str
    percent: int
    completed: int
    total: int
    correct: int
    graded: int
    last_saved: str | None
    finished: str | None
    antworten: list[Antwort] = field(default_factory=list)

    @property
    def ergebnis_text(self) -> str:
        return f"{self.correct} von {self.graded}" if self.graded else "–"

    @property
    def offene(self) -> list[Aufgabe]:
        return [a.aufgabe for a in self.antworten if a.status != "completed" and a.aufgabe.counts]


def fmt_time(iso: str | None) -> str:
    if not iso:
        return "–"
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone().strftime("%d.%m.%Y %H:%M")
    except ValueError:
        return iso


def option_label(a: Aufgabe, value: Any) -> str:
    if not isinstance(value, str):
        return ""
    for o in a.options:
        if o.get("value") == value:
            return o.get("label", value)
    return value


def describe_data(data: dict[str, Any] | None) -> str:
    if not data:
        return ""
    if isinstance(data.get("laeufe"), list):
        teile = []
        for l in data["laeufe"]:
            try:
                teile.append(f"{l.get('rampe')}: {float(l.get('zeit_s')):.2f} s".replace(".", ","))
            except (TypeError, ValueError):
                continue
        return "; ".join(teile)
    if "an" in data and "aus" in data:
        return f"Lampe {data['an']}× an, {data['aus']}× aus"
    return ", ".join(f"{k}: {v}" for k, v in data.items() if k not in ("probiert",) and not isinstance(v, (list, dict)))


def describe_answer(a: Aufgabe, answer: dict[str, Any] | None) -> str:
    if not answer:
        return ""
    if "choice" in answer:
        return option_label(a, answer["choice"])
    if "text" in answer:
        return str(answer["text"])
    if "value" in answer:
        return str(answer["value"])
    parts = [f"{k}: {v}" for k, v in answer.items() if k not in ("demo", "versuche") and not isinstance(v, (dict, list))]
    return ", ".join(parts)


def labs_of(export: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {l["id"]: l for l in export.get("labs", [])}


def tasks_for(lab: dict[str, Any], version: str | None = None) -> list[Aufgabe]:
    v = version or lab.get("current_version")
    out = [Aufgabe(t["task_id"], t["title"], t.get("section", ""), t["kind"], bool(t.get("graded")), int(t.get("position", 0)),
                   t.get("options") or [], t.get("solution"), t.get("counts_for_progress", True))
           for t in lab.get("tasks", []) if t.get("version", v) == v]
    return sorted(out, key=lambda a: a.position)


def build_rows(group: dict[str, Any], lab_id: str | None = None) -> list[Zeile]:
    """Erzeugt je Person und Lernlabor eine Zeile mit Namen (lokal), Fortschritt und Antworten."""
    res = group.get("results") or {}
    export = res.get("export")
    if not export:
        return []
    names = {p["id"]: p for p in group.get("participants", [])}
    labs = labs_of(export)
    progress = {(p["participant_id"], p["lab_id"]): p for p in export.get("progress", [])}
    results: dict[tuple[str, str], dict[str, dict[str, Any]]] = {}
    for r in export.get("results", []):
        results.setdefault((r["participant_id"], r["lab_id"]), {})[r["task_id"]] = r

    rows: list[Zeile] = []
    lab_ids = [lab_id] if lab_id else list(labs.keys())
    for lid in lab_ids:
        lab = labs.get(lid)
        if not lab:
            continue
        for sp in export.get("participants", []):
            pid = sp["id"]
            local = names.get(pid)
            if local is not None and local.get("status") == "removed":
                continue
            pr = progress.get((pid, lid))
            tasks = tasks_for(lab, pr.get("lab_version") if pr else None)
            rs = results.get((pid, lid), {})
            antworten = []
            correct = graded = 0
            for a in tasks:
                r = rs.get(a.task_id)
                if a.graded:
                    graded += 1
                    if r and r.get("is_correct"):
                        correct += 1
                antworten.append(Antwort(a, r["status"] if r else "open", describe_answer(a, r.get("answer") if r else None),
                                         describe_data(r.get("data") if r else None), r.get("is_correct") if r else None,
                                         r.get("first_is_correct") if r else None, r.get("updated_at") if r else None))
            completed = sum(1 for x in antworten if x.status == "completed" and x.aufgabe.counts)
            total = sum(1 for a in tasks if a.counts)
            rows.append(Zeile(
                participant_id=pid,
                name=full_name(local) if local else f"(nicht im Tresor) {sp['pseudonym']}",
                vorname=local.get("first_name", "") if local else "", nachname=local.get("last_name", "") if local else "",
                pseudonym=sp["pseudonym"], im_tresor=local is not None, lab_id=lid, lab_title=lab["title"],
                percent=int(pr["percent"]) if pr else 0, completed=completed, total=total, correct=correct, graded=graded,
                last_saved=pr.get("last_saved_at") if pr else None, finished=pr.get("finished_at") if pr else None,
                antworten=antworten))
    rows.sort(key=lambda z: (z.lab_title, z.nachname.casefold() or "~", z.vorname.casefold(), z.pseudonym))
    return rows


def task_statistics(rows: list[Zeile]) -> list[dict[str, Any]]:
    """Anonyme Statistik je Aufgabe (für datensparsame Berichte und Fortbildungen)."""
    if not rows:
        return []
    stats: dict[str, dict[str, Any]] = {}
    for z in rows:
        for a in z.antworten:
            s = stats.setdefault(a.aufgabe.task_id, {"aufgabe": a.aufgabe, "n": 0, "erledigt": 0, "richtig": 0, "erst_richtig": 0, "bewertet": 0, "verteilung": {}})
            s["n"] += 1
            if a.status == "completed":
                s["erledigt"] += 1
            if a.aufgabe.graded and a.is_correct is not None:
                s["bewertet"] += 1
                s["richtig"] += 1 if a.is_correct else 0
                s["erst_richtig"] += 1 if a.first_is_correct else 0
            if a.antwort_text and a.aufgabe.kind == "choice":
                s["verteilung"][a.antwort_text] = s["verteilung"].get(a.antwort_text, 0) + 1
    return sorted(stats.values(), key=lambda s: s["aufgabe"].position)
