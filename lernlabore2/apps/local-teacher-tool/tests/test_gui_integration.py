"""GUI- und Integrationstest des Lehrerprogramms.

* läuft nur mit Bildschirm (unter Linux z. B. ``xvfb-run``)
* der Online-Teil läuft nur, wenn LERNLABOR_TEST_SERVER gesetzt ist (lokaler Testserver,
  siehe tests/e2e/) – er nutzt dann echte HTTP-Aufrufe gegen die echten SQL-Funktionen.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "tests" / "fixtures" / "klasse-7a-fiktiv.csv"
SERVER = os.environ.get("LERNLABOR_TEST_SERVER")
ANON = os.environ.get("LERNLABOR_TEST_ANON_KEY", "sb_publishable_lokaler_testschluessel")
DB_URL = os.environ.get("LERNLABOR_TEST_DB_URL")

pytestmark = pytest.mark.skipif((not os.environ.get("DISPLAY") and os.name != "nt") or bool(os.environ.get("LERNLABOR_SKIP_GUI")), reason="kein Bildschirm (xvfb-run verwenden)")


def pump(app, until, timeout=20.0):
    end = time.time() + timeout
    while time.time() < end:
        app.update()
        if until():
            return True
        time.sleep(0.02)
    raise AssertionError("Zeitüberschreitung beim Warten auf die Oberfläche")


def anon_rpc(fn, args):
    req = urllib.request.Request(f"{SERVER}/rest/v1/rpc/{fn}", data=json.dumps(args).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "apikey": ANON})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


@pytest.fixture()
def app(tmp_path):
    from lernlabor_lehrer.einstellungen import Einstellungen
    from lernlabor_lehrer.gui import App
    from lernlabor_lehrer.tresor import Tresor
    s = Einstellungen(tmp_path / "einstellungen.json")
    s["vault_path"] = str(tmp_path / "tresor.llv")
    s["export_dir"] = str(tmp_path / "berichte")
    s["lab_base_url"] = "http://localhost/lernlabore2/site/"
    a = App(s, interactive=False)
    a.tresor = Tresor.create(s["vault_path"], "GUI-Testpasswort-123")
    a.after_unlock()
    yield a
    a.destroy()


def test_gui_import_codes_karten(app, tmp_path):
    n = app.import_people(FIXTURE, interactive_preview=False)
    assert n == 30
    assert len(app.people.get_children()) == 30
    app.action_codes()
    assert all(p["code"] for p in app.group["participants"])
    # Codes werden standardmäßig verdeckt angezeigt
    first = app.people.item(app.people.get_children()[0])["values"]
    assert "••••" in first[2]
    app.action_cards()
    assert app.last_output.read_bytes().startswith(b"%PDF")
    # Screenshot für die Dokumentation (falls Pillow ImageGrab verfügbar)
    try:
        from PIL import ImageGrab
        app.update()
        x, y, w, h = app.winfo_rootx(), app.winfo_rooty(), app.winfo_width(), app.winfo_height()
        out = os.environ.get("LERNLABOR_SCREENSHOT_DIR")
        if out:
            ImageGrab.grab(bbox=(x, y, x + w, y + h), xdisplay=os.environ.get("DISPLAY")).save(Path(out) / "lehrerprogramm.png")
    except Exception:
        pass


@pytest.mark.skipif(not SERVER, reason="LERNLABOR_TEST_SERVER nicht gesetzt")
def test_gui_online_ablauf_ohne_klarnamen_auf_dem_server(app):
    app.settings["supabase_url"] = SERVER
    app.settings["supabase_anon_key"] = ANON
    app.settings["email"] = "lehrkraft@test.local"
    app.import_people(FIXTURE, interactive_preview=False)
    app.action_codes()
    app.make_client().login("lehrkraft@test.local", "test-passwort-123")

    # Test 2/3: Synchronisieren – erst nach Serverbestätigung als registriert markiert
    app.action_sync()
    pump(app, lambda: not app.busy and app.group["server"]["synced_at"])
    g = app.group
    assert all(p["server_code"] == p["code"] for p in g["participants"])
    assert "vom Server bestätigt" in app.status_left.cget("text")

    if DB_URL:  # Datenbank enthält keinen der Namen
        dump = subprocess.run(["pg_dump", "--data-only", DB_URL], capture_output=True, text=True, check=True).stdout
        for p in g["participants"]:
            assert p["last_name"] not in dump, f"Klarname {p['last_name']} in der Datenbank gefunden!"
            assert p["code"].replace("-", "") not in dump, "Rohcode in der Datenbank gefunden!"

    # Eine Schülerin meldet sich an und speichert (wie im Lernlabor)
    erika = next(p for p in g["participants"] if p["last_name"] == "Musterfrau")
    s = anon_rpc("student_login", {"p_code": erika["code"]})
    assert s["ok"]
    r = anon_rpc("student_save_task", {"p_session": s["session_token"], "p_lab_id": "physik-entdecker", "p_lab_version": "1.0",
                                       "p_task_id": "m3-auswertung", "p_op_id": "11111111-2222-4333-8444-555555555555",
                                       "p_base_revision": 0, "p_answer": {"choice": "steil"}, "p_completed": True})
    assert r["status"] == "saved"

    # Test 9: Abrufen und lokal zuordnen
    app.action_fetch()
    pump(app, lambda: not app.busy and app.group.get("results"))
    names = [app.eval.item(i)["values"][0] for i in app.eval.get_children()]
    assert "Erika Musterfrau" in names
    row = next(z for z in app._rows if z.nachname == "Musterfrau")
    assert row.ergebnis_text == "1 von 2" and row.completed == 1

    # Test 14: PDF-Auswertung
    files = app.create_reports("physik-entdecker", {"uebersicht": True, "einzeln": True, "xlsx": True, "anonym": True})
    assert all(f.exists() and f.stat().st_size > 1000 for f in files)

    # Offline: abgerufene Auswertung bleibt nach Neustart ohne Server verfügbar
    from lernlabor_lehrer.tresor import Tresor
    t2 = Tresor.open(app.settings["vault_path"], "GUI-Testpasswort-123")
    gg = next(x for x in t2.data["groups"] if x["id"] == g["id"])
    from lernlabor_lehrer.auswertung import build_rows
    assert any(z.nachname == "Musterfrau" and z.completed == 1 for z in build_rows(gg))
