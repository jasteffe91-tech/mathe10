"""Tests des lokalen Lehrerprogramms (ohne Server)."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from lernlabor_lehrer import berichte, codes, demo, modell, sync
from lernlabor_lehrer.api import ApiFehler, SupabaseClient
from lernlabor_lehrer.auswertung import build_rows, task_statistics
from lernlabor_lehrer.csvimport import read_csv
from lernlabor_lehrer.tresor import FalschesPasswort, Tresor, TresorFehler, decrypt_document

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "tests" / "fixtures" / "klasse-7a-fiktiv.csv"
PW = "Sicheres-Testpasswort-2026"


# ---------------------------------------------------------------- Test 1: CSV-Import
def test_import_30_fiktive_schueler_utf8():
    res = read_csv(FIXTURE)
    assert len(res.personen) == 30
    assert res.trennzeichen == "Semikolon"
    names = {p.anzeige for p in res.personen}
    assert "Ayşe Özdemir" in names and "Jürgen Müller" in names and "Sören Weiß" in names
    assert not res.dubletten


def test_import_excel_windows1252_komma_und_dubletten():
    text = "Vorname,Nachname\r\nJürgen,Müller\r\nZoë,Käfer\r\njürgen ,Müller\r\n,\r\nMax3,Muster\r\n"
    res = read_csv(data=text.encode("cp1252"))
    assert res.kodierung == "Windows-1252"
    assert res.trennzeichen == "Komma"
    assert [p.anzeige for p in res.personen][:2] == ["Jürgen Müller", "Zoë Käfer"]
    assert len(res.dubletten) == 1
    assert any("Ziffern" in x for x in res.probleme)
    assert len(res.personen) == 4  # leere Zeile wird übersprungen


def test_import_eine_spalte_nachname_komma_vorname_ohne_kopf():
    res = read_csv(data="Name\nMustermann, Max\nErika Musterfrau\n".encode("utf-8"))
    assert [(p.first_name, p.last_name) for p in res.personen] == [("Max", "Mustermann"), ("Erika", "Musterfrau")]


# ---------------------------------------------------------------- Test 2: Codes
def test_codes_sind_eindeutig_zufaellig_und_lesbar():
    cs = {codes.generate_code() for _ in range(5000)}
    assert len(cs) == 5000
    for c in list(cs)[:500]:
        assert re.fullmatch(r"[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}", c)
    assert not any(re.search(r"(\d)\1\1\1", c) and c.startswith("SCHUELER") for c in cs)


def test_gruppe_bekommt_pseudonyme_und_codes_ohne_doppelte():
    data = {"groups": []}
    g = modell.new_group(data, "7a Physik")
    modell.add_people(g, [(p.first_name, p.last_name) for p in read_csv(FIXTURE).personen], with_codes=False)
    assert all(p["code"] is None for p in g["participants"])
    assert modell.create_missing_codes(g) == 30
    ps = g["participants"]
    assert len({p["pseudonym"] for p in ps}) == 30
    assert len({p["code"] for p in ps}) == 30
    assert len({p["id"] for p in ps}) == 30
    assert all(re.fullmatch(r"P-[A-HJKMNP-Z2-9]{4}", p["pseudonym"]) for p in ps)


# ---------------------------------------------------------------- Tresor
def test_tresor_verschluesselt_und_erkennt_falsches_passwort(tmp_path):
    path = tmp_path / "tresor.llv"
    t = Tresor.create(path, PW)
    g = modell.new_group(t.data, "8b")
    modell.add_people(g, [("Max", "Mustermann")])
    t.save()
    raw = path.read_text(encoding="utf-8")
    assert "Mustermann" not in raw and g["participants"][0]["code"] not in raw
    doc = json.loads(raw)
    assert doc["format"] == "LLV1" and doc["kdf"]["name"] == "argon2id"
    with pytest.raises(FalschesPasswort):
        Tresor.open(path, "falsches-passwort-123")
    t2 = Tresor.open(path, PW)
    assert t2.data["groups"][0]["participants"][0]["last_name"] == "Mustermann"


def test_tresor_erkennt_manipulation(tmp_path):
    path = tmp_path / "tresor.llv"
    Tresor.create(path, PW)
    doc = json.loads(path.read_text())
    doc["kdf"]["t"] = 1  # Kopf verändert → Authentifizierung schlägt fehl
    with pytest.raises(TresorFehler):
        decrypt_document(doc, PW)


def test_tresor_sicherung_und_wiederherstellung(tmp_path):
    t = Tresor.create(tmp_path / "a.llv", PW)
    modell.new_group(t.data, "Sicherungstest")
    t.save()
    backup = t.backup(tmp_path / "sicherung.llv", "Anderes-Sicherungspasswort")
    t.data["groups"].clear()
    t.save()
    with pytest.raises(FalschesPasswort):
        t.restore_from(backup, PW)
    t.restore_from(backup, "Anderes-Sicherungspasswort")
    assert t.data["groups"][0]["label"] == "Sicherungstest"
    assert (tmp_path / "a.llv.bak").exists()


def test_tresor_passwort_zu_kurz(tmp_path):
    with pytest.raises(TresorFehler):
        Tresor.create(tmp_path / "x.llv", "kurz")


# ---------------------------------------------------------------- Test 3: keine Namen an den Server
class FakeClient:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, fn, args=None):
        self.calls.append((fn, json.loads(json.dumps(args))))
        if fn == "teacher_register_participants":
            return {"ok": True, "created": len(args["p_participants"]), "reissued": 0, "unchanged": 0}
        return {"ok": True}


def test_synchronisierung_sendet_keine_namen_und_markiert_erst_nach_bestaetigung():
    data = {"groups": []}
    g = modell.new_group(data, "7a Physik")
    modell.add_people(g, [(p.first_name, p.last_name) for p in read_csv(FIXTURE).personen])
    fc = FakeClient()
    r = sync.sync_group(fc, g)
    assert r.created == 30
    sent = json.dumps(fc.calls, ensure_ascii=False)
    for p in g["participants"]:
        assert p["last_name"] not in sent and p["first_name"] not in sent
        assert p["server_code"] == p["code"]
    reg = [a for f, a in fc.calls if f == "teacher_register_participants"][0]
    assert set(reg["p_participants"][0]) == {"id", "pseudonym", "code"}
    assert g["server"]["synced_at"]


def test_keine_bestaetigung_kein_synchronisiert_stempel():
    class Kaputt(FakeClient):
        def rpc(self, fn, args=None):
            if fn == "teacher_register_participants":
                raise ApiFehler("Serverfehler", 500)
            return super().rpc(fn, args)
    data = {"groups": []}
    g = modell.new_group(data, "8c")
    modell.add_people(g, [("A", "B")])
    with pytest.raises(ApiFehler):
        sync.sync_group(Kaputt(), g)
    assert g["participants"][0]["server_code"] is None
    assert g["server"]["synced_at"] is None


def test_sperren_neuer_code_und_entfernen_werden_uebertragen():
    data = {"groups": []}
    g = modell.new_group(data, "9a")
    a, b, c = modell.add_people(g, [("A", "Eins"), ("B", "Zwei"), ("C", "Drei")])
    sync.sync_group(FakeClient(), g)
    modell.set_blocked(g, a["id"], True)
    old = b["code"]
    modell.reissue_code(g, b["id"])
    modell.mark_removed(g, c["id"])
    assert modell.needs_sync(g) == {"codes": 1, "status": 1, "removed": 1, "group": 0}
    fc = FakeClient()
    sync.sync_group(fc, g)
    fns = [f for f, _ in fc.calls]
    assert "teacher_set_participant_status" in fns and "teacher_remove_participants" in fns
    assert b["code"] != old and b["server_code"] == b["code"]
    assert len(g["participants"]) == 2
    assert modell.needs_sync(g) == {"codes": 0, "status": 0, "removed": 0, "group": 0}


def test_client_lehnt_geheimen_schluessel_ab():
    with pytest.raises(ApiFehler):
        SupabaseClient("https://x.supabase.co", "sb_secret_abc")
    with pytest.raises(ApiFehler):
        SupabaseClient("http://example.org", "sb_publishable_x")


# ---------------------------------------------------------------- Test 9 (offline-Teil) + Test 14: Zuordnung und PDF
def _demo_export(group):
    """Baut einen Export im Serverformat für die Personen der Gruppe."""
    lab = json.loads((ROOT / "labs" / "physik-entdecker" / "lab.manifest.json").read_text(encoding="utf-8"))
    tasks = [{**t, "version": lab["version"], "position": i + 1, "graded": t.get("graded", False), "counts_for_progress": True,
              "options": t.get("options", []), "solution": t.get("solution")} for i, t in enumerate(lab["tasks"])]
    ps = group["participants"]
    results = [
        {"participant_id": ps[0]["id"], "lab_id": lab["id"], "task_id": "m1-vermutung", "lab_version": "1.0", "answer": {"choice": "steil"}, "data": {}, "status": "completed", "is_correct": None, "first_is_correct": None, "revision": 1, "updated_at": "2026-11-17T10:00:00Z"},
        {"participant_id": ps[0]["id"], "lab_id": lab["id"], "task_id": "m2-versuch", "lab_version": "1.0", "answer": {"getestete_rampen": 3}, "data": {"laeufe": [{"rampe": "flach", "zeit_s": 1.81}, {"rampe": "steil", "zeit_s": 1.0}]}, "status": "completed", "is_correct": None, "first_is_correct": None, "revision": 2, "updated_at": "2026-11-17T10:02:00Z"},
        {"participant_id": ps[0]["id"], "lab_id": lab["id"], "task_id": "m3-auswertung", "lab_version": "1.0", "answer": {"choice": "steil"}, "data": {}, "status": "completed", "is_correct": True, "first_is_correct": False, "revision": 2, "updated_at": "2026-11-17T10:03:00Z"},
    ]
    return {"format": "lernlabore2-export", "format_version": 1, "exported_at": "2026-11-17T10:05:00Z", "group": {"id": group["id"], "label": group["label"], "kind": group["kind"]},
            "labs": [{"id": lab["id"], "title": lab["title"], "current_version": "1.0", "tasks": tasks}],
            "participants": [{"id": p["id"], "pseudonym": p["pseudonym"], "status": "active"} for p in ps],
            "progress": [{"participant_id": ps[0]["id"], "lab_id": lab["id"], "lab_version": "1.0", "completed": 3, "total": 6, "percent": 50, "last_saved_at": "2026-11-17T10:03:00Z", "finished_at": None}],
            "results": results}


def test_lokale_zuordnung_und_berichte(tmp_path):
    data = {"groups": []}
    g = modell.new_group(data, "7a Physik")
    modell.add_people(g, [("Max", "Mustermann"), ("Erika", "Musterfrau")])
    sync.import_export_file(g, _demo_export(g))
    rows = build_rows(g, "physik-entdecker")
    mx = next(z for z in rows if z.nachname == "Mustermann")
    assert mx.percent == 50 and mx.ergebnis_text == "1 von 2" and mx.completed == 3
    assert "flach: 1,81 s" in mx.antworten[1].messwerte
    assert mx.antworten[0].antwort_text == "Auf der steilen Rampe"
    er = next(z for z in rows if z.nachname == "Musterfrau")
    assert er.percent == 0 and len(er.offene) == 6
    stats = task_statistics(rows)
    assert stats[2]["erst_richtig"] == 0 and stats[2]["richtig"] == 1

    files = [
        berichte.pdf_klassenuebersicht(tmp_path / "k.pdf", g, rows),
        berichte.pdf_klassenuebersicht(tmp_path / "s.pdf", g, rows, mit_einzelantworten=False),
        berichte.pdf_einzelauswertung(tmp_path / "e.pdf", g, rows),
        berichte.pdf_offene_aufgaben(tmp_path / "o.pdf", g, rows),
        berichte.pdf_anonym(tmp_path / "a.pdf", g, rows),
        berichte.pdf_zugangskarten(tmp_path / "z.pdf", g, "https://beispiel.example/lernlabore2/site", "physik-entdecker", "Physik-Entdecker"),
    ]
    for f in files:
        b = f.read_bytes()
        assert b.startswith(b"%PDF") and len(b) > 1500
    assert b"Mustermann" not in (tmp_path / "a.pdf").read_bytes()  # anonym
    x = berichte.xlsx_export(tmp_path / "x.xlsx", g, rows)
    from openpyxl import load_workbook
    wb = load_workbook(x)
    assert wb.sheetnames[:3] == ["Übersicht", "Antworten", "Offene Aufgaben"]
    c = berichte.csv_export(tmp_path / "c.csv", rows)
    text = c.read_text(encoding="utf-8-sig")
    assert text.splitlines()[0].startswith("Name;Kennung")
    assert "Max Mustermann" in text


def test_formel_injektion_wird_entschaerft(tmp_path):
    data = {"groups": []}
    g = modell.new_group(data, "x")
    modell.add_people(g, [("=HYPERLINK(1)", "Test")])
    sync.import_export_file(g, _demo_export(g))
    c = berichte.csv_export(tmp_path / "c.csv", build_rows(g), mit_antworten=False)
    assert "'=HYPERLINK" in c.read_text(encoding="utf-8-sig")


def test_demo_datensatz_identisch_und_fiktiv():
    a = json.loads((ROOT / "config" / "demo-datensatz.json").read_text(encoding="utf-8"))
    b = demo.dataset()
    assert a == b, "lernlabor_lehrer/demo_datensatz.json muss eine Kopie von config/demo-datensatz.json sein"
    assert "FIKTIV" in a["hinweis"].upper()
    data = {"groups": []}
    g = demo.create_online_demo_group(data)
    assert g["kind"] == "demo" and len(g["participants"]) == 12
    assert all(p["pseudonym"].startswith("D-") for p in g["participants"])
    bg = demo.browser_demo_group(data)
    assert bg["participants"][0]["code"] == "TEST-HAUS-2345"
