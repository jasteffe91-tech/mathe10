"""Unit-Tests der Medienbibliothek (isoliert in einer temporären Bibliothek).

Aufruf:  python3 -m unittest discover -s tests -v      (im Bibliotheksordner)
"""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

ECHT = Path(__file__).resolve().parent.parent
TMP = Path(tempfile.mkdtemp(prefix="medialib-test-"))
shutil.copytree(ECHT / "config", TMP / "config")
shutil.copytree(ECHT / "scripts", TMP / "scripts")
(TMP / "metadata").mkdir()
os.environ["MEDIA_LIB_ROOT"] = str(TMP)
sys.path.insert(0, str(ECHT))

from medialib import config, licenses  # noqa: E402
from medialib.credits import bildnachweis, medienverzeichnis  # noqa: E402
from medialib.db import DB  # noqa: E402
from medialib.search import suche  # noqa: E402
from medialib.taxonomy import load as load_tax  # noqa: E402


def item(mid, **kw):
    base = {
        "id": mid, "titel": "Testmedium", "originaltitel": "Test", "fach": "physik", "hauptthema": "ph.mechanik.wurf.schraeg",
        "unterthemen": [], "schlagworte": [], "schlagworte_en": [], "medientyp": "diagramm", "format": "png",
        "stufe_min": 10, "stufe_max": 11, "urheber": "Max Muster", "quelle": "Wikimedia Commons",
        "quelle_url": "https://commons.wikimedia.org/wiki/File:Test.png", "lizenz": "CC-BY-SA-4.0",
        "lizenz_kategorie": "A", "lizenz_status": "verifiziert", "pruefdatum": "2026-11-13", "speicherung": "lokal",
        "pfad": "", "qualitaet": 3, "herkunft": "commons", "quelle_id": mid,
    }
    base.update(kw)
    return base


def run_cli(*args) -> tuple[int, str, str]:
    from medialib.cli import main

    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        rc = main(list(args))
    return rc, out.getvalue(), err.getvalue()


class T1Lizenzen(unittest.TestCase):
    def test_normalisierung(self):
        cases = {
            ("CC BY-SA 4.0", ""): "CC-BY-SA-4.0", ("CC BY 2.5", ""): "CC-BY-2.5", ("CC0", ""): "CC0-1.0",
            ("Public domain", ""): "PD", ("CC BY-NC 2.5", ""): "CC-BY-NC-2.5", ("GFDL", ""): "GFDL",
            ("", ""): "unbekannt", ("irgendwas", ""): "unbekannt",
            ("", "https://creativecommons.org/licenses/by-sa/3.0/de/"): "CC-BY-SA-3.0",
            ("CC BY-NC-SA 2.0", ""): "CC-BY-NC-SA-2.0",
        }
        for (s, u), exp in cases.items():
            self.assertEqual(licenses.normalize(s, u)[0], exp, (s, u))
        self.assertIn("de", licenses.normalize("CC BY-SA 3.0 de")[1])

    def test_kategorien(self):
        self.assertEqual(licenses.get("CC-BY-SA-4.0").kategorie, "A")
        self.assertEqual(licenses.get("CC-BY-NC-2.5").kategorie, "B")
        self.assertEqual(licenses.get("CC-BY-NC-SA-2.0").kategorie, "B")  # synthetisch abgeleitet
        self.assertTrue(licenses.get("CC-BY-NC-SA-2.0").nc)
        self.assertEqual(licenses.get("unbekannt").kategorie, "C")
        self.assertEqual(licenses.get("gibtsnicht").id, "unbekannt")
        self.assertEqual(licenses.get("Eigenproduktion").kategorie, "E")

    def test_profile(self):
        a = item("a")
        nc = item("nc", lizenz="CC-BY-NC-2.5", lizenz_kategorie="B")
        nd = item("nd", lizenz="CC-BY-ND-4.0", lizenz_kategorie="B")
        ung = item("ung", lizenz_status="ungeprueft")
        c = item("c", lizenz="unbekannt", lizenz_kategorie="C")
        ext = item("ext", lizenz="CC-BY-NC-4.0", lizenz_kategorie="B", speicherung="extern")
        eig = item("eig", lizenz="Eigenproduktion", lizenz_kategorie="E", lizenz_status="eigen")
        P = licenses.pruefe_nutzung
        self.assertTrue(P(a, "offen").erlaubt)
        self.assertFalse(P(nc, "offen").erlaubt)
        self.assertTrue(P(nc, "unterricht").erlaubt)
        self.assertFalse(P(nd, "unterricht").erlaubt)          # ND standardmäßig ausgeschlossen
        self.assertTrue(P(nd, "unterricht", mit_nd=True).erlaubt)
        self.assertFalse(P(nd, "unterricht", bearbeitung=True, mit_nd=True).erlaubt)
        self.assertFalse(P(ung, "offen").erlaubt)
        self.assertFalse(P(ung, "unterricht").erlaubt)
        self.assertFalse(P(c, "unterricht").erlaubt)
        self.assertTrue(P(c, "recherche").erlaubt)
        self.assertTrue(P(ext, "extern").erlaubt)
        self.assertFalse(P(a, "extern").erlaubt)              # lokale Datei ist keine reine Verlinkung
        self.assertTrue(P(eig, "offen").erlaubt)
        self.assertTrue(any("ShareAlike" in h for h in P(a, "offen").hinweise))
        self.assertEqual(licenses.standardprofil(), "offen")


class T2Taxonomie(unittest.TestCase):
    def test_erweiterung(self):
        tax = load_tax()
        top = lambda q: tax.erkenne(q)[0].thema  # noqa: E731
        self.assertEqual(top("schiefer Wurf"), "ph.mechanik.wurf.schraeg")
        self.assertEqual(top("Wurfparabel"), "ph.mechanik.wurf")
        self.assertEqual(top("projectile motion"), "ph.mechanik.wurf")
        self.assertEqual(top("Kreisfläche"), "ma.geometrie.kreis")
        self.assertEqual(top("quadratische Funktion"), "ma.funktionen.quadratisch")
        arten = {t.thema: t.art for t in tax.erkenne("Wurfparabel")}
        self.assertEqual(arten["ph.mechanik.wurf.schraeg"], "unterthema")
        self.assertEqual(arten["ma.funktionen.quadratisch"], "verwandt")

    def test_konsistenz(self):
        tax = load_tax()
        for kid, kn in tax.knoten.items():
            self.assertTrue(kn.parent is None or kn.parent in tax.knoten, kid)
            for v in kn.verwandt:
                self.assertIn(v, tax.knoten, f"{kid} -> {v}")
            self.assertLessEqual(kn.stufe[0], kn.stufe[1], kid)


class T3DatenbankUndSuche(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = DB()
        cls.db.upsert_many([
            item("wmc-wurf", titel="Bahnkurve beim schiefen Wurf", schlagworte=["Wurfweite"], format="png", medientyp="diagramm"),
            item("wmc-anim", titel="Federpendel (Animation)", hauptthema="ph.schwingungen.federpendel", medientyp="animation", format="gif",
                 lizenz="CC0-1.0"),
            item("wmc-nc", titel="Comic zu Newtons Gesetzen", hauptthema="ph.mechanik.newton", medientyp="comic",
                 lizenz="CC-BY-NC-2.5", lizenz_kategorie="B", speicherung="extern", format="html"),
            item("wmc-parab", titel="Normalparabel", fach="mathematik", hauptthema="ma.funktionen.quadratisch", stufe_min=9, stufe_max=10,
                 lizenz="PD"),
            item("wmc-kreis", titel="Flächeninhalt des Kreises", fach="mathematik", hauptthema="ma.geometrie.kreis", stufe_min=8, stufe_max=9),
        ])

    def test_persistenz_jsonl(self):
        self.assertTrue(config.KATALOG_JSONL.exists())
        zeilen = config.KATALOG_JSONL.read_text().strip().splitlines()
        self.assertEqual(len(zeilen), 5)
        config.DB_PATH.unlink()
        for ext in ("-wal", "-shm"):
            p = Path(str(config.DB_PATH) + ext)
            if p.exists():
                p.unlink()
        db2 = DB()  # baut Index automatisch aus katalog.jsonl neu auf
        self.assertEqual(db2.get("wmc-wurf")["titel"], "Bahnkurve beim schiefen Wurf")
        type(self).db = db2

    def test_suche_synonym(self):
        res, info = suche("Wurfparabel", db=self.db)
        self.assertEqual(res[0].item["id"], "wmc-wurf")
        res, _ = suche("projectile motion", db=self.db)
        self.assertEqual(res[0].item["id"], "wmc-wurf")
        res, _ = suche("Kreisfläche", fach="mathematik", db=self.db)
        self.assertEqual(res[0].item["id"], "wmc-kreis")

    def test_filter(self):
        res, _ = suche("Schwingung", typ="animation", db=self.db)
        self.assertEqual([e.item["id"] for e in res], ["wmc-anim"])
        res, _ = suche("Parabel", stufe="5-6", db=self.db)
        self.assertNotIn("wmc-parab", [e.item["id"] for e in res])
        res, _ = suche("Parabel", stufe="9", fach="physik", db=self.db)
        self.assertNotIn("wmc-parab", [e.item["id"] for e in res])

    def test_profilfilter(self):
        res, info = suche("Newton Gesetze", db=self.db)  # Standard: offen
        self.assertNotIn("wmc-nc", [e.item["id"] for e in res])
        self.assertGreaterEqual(info["ausgeschlossen_lizenz"], 1)
        res, _ = suche("Newton Gesetze", profil="unterricht", db=self.db)
        self.assertIn("wmc-nc", [e.item["id"] for e in res])
        res, _ = suche("Newton Gesetze", profil="extern", typ="comic", db=self.db)
        self.assertEqual([e.item["id"] for e in res], ["wmc-nc"])

    def test_verwandt_markiert(self):
        res, _ = suche("Wurfparabel", fach="mathematik", db=self.db)
        ids = {e.item["id"]: e for e in res}
        self.assertIn("wmc-parab", ids)
        self.assertTrue(ids["wmc-parab"].nur_verwandt)


class T4Bildnachweise(unittest.TestCase):
    def test_formate(self):
        it = item("x", originaltitel="Projectile motion", urheber="Jane Doe", lizenz_url="https://creativecommons.org/licenses/by-sa/4.0/")
        t = bildnachweis(it)
        for s in ("Projectile motion", "Jane Doe", "CC BY-SA 4.0", "Wikimedia Commons", "https://creativecommons.org/licenses/by-sa/4.0/"):
            self.assertIn(s, t)
        self.assertIn("[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Test.png)", bildnachweis(it, "markdown"))
        self.assertIn('<a href="https://commons', bildnachweis(it, "html"))
        self.assertIn(r"\href{", bildnachweis(item("y", originaltitel="A_B & C"), "latex"))
        self.assertIn(r"A\_B \& C", bildnachweis(item("y", originaltitel="A_B & C"), "latex"))
        self.assertIn("bearbeitet: zugeschnitten", bildnachweis(it, bearbeitung="zugeschnitten"))
        nasa = item("n", lizenz="PD-USGov", lizenz_kategorie="A", urheber="NASA/JPL", credit_vorgabe="NASA/JPL", quelle="NASA Image and Video Library")
        self.assertTrue(bildnachweis(nasa).startswith("Bild: NASA/JPL"))
        nc = item("nc", lizenz="CC-BY-NC-2.5", lizenz_kategorie="B")
        self.assertIn("nichtkommerziell", bildnachweis(nc))
        eig = item("e", lizenz="Eigenproduktion", lizenz_kategorie="E", lizenz_status="eigen", importiert_am="2026-11-13T10:00:00")
        self.assertIn("Eigene Grafik", bildnachweis(eig))

    def test_verzeichnis_prueft_profil(self):
        ok = item("ok")
        nc = item("nc", lizenz="CC-BY-NC-2.5", lizenz_kategorie="B")
        text, v = medienverzeichnis([ok, nc], "markdown", "offen")
        self.assertIn("Abb. 1", text)
        self.assertEqual([m for m, _ in v], ["nc"])
        text, v = medienverzeichnis([ok], "markdown", "offen", {"ok": "beschriftet"})
        self.assertIn("ShareAlike", text) if False else self.assertIn("derselben Lizenz", text)


class T5CliUndDateien(unittest.TestCase):
    def test_add_eigen_export_check(self):
        svg = TMP / "test.svg"
        svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#fff"/>'
                       '<line x1="0" y1="0" x2="100" y2="50" stroke="#000"/></svg>')
        rc, out, err = run_cli("add", str(svg), "--eigen", "--titel", "Testlinie", "--thema", "ma.geometrie.grundbegriffe",
                               "--alt", "Eine Linie", "--entstehung", "Test")
        self.assertEqual(rc, 0, err)
        mid = out.split("Aufgenommen: ")[1].split(" ")[0]
        rc, out, _ = run_cli("check", mid, "--profil", "offen")
        self.assertEqual(rc, 0)
        ziel = TMP / "export"
        rc, out, err = run_cli("export", mid, "--ziel", str(ziel), "--profil", "offen")
        self.assertEqual(rc, 0, err)
        self.assertTrue((ziel / "BILDNACHWEISE.md").exists())
        self.assertEqual(len(list(ziel.glob("abb-01__*.svg"))), 1)
        # gleiche Datei erneut -> Dublette erkannt
        rc, out, _ = run_cli("add", str(svg), "--eigen", "--titel", "Nochmal", "--thema", "ma.geometrie.grundbegriffe")
        self.assertIn("Bereits vorhanden", out)

    def test_export_verweigert_nc(self):
        db = DB()
        db.upsert(item("nc-lokal", lizenz="CC-BY-NC-4.0", lizenz_kategorie="B", pfad="assets/x.png"))
        rc, out, err = run_cli("export", "nc-lokal", "--ziel", str(TMP / "exp2"), "--profil", "offen")
        self.assertEqual(rc, 3)
        self.assertIn("NonCommercial", err)
        rc, out, err = run_cli("verzeichnis", "nc-lokal", "--profil", "offen")
        self.assertEqual(rc, 3)

    def test_svg_mit_skript_abgelehnt(self):
        from medialib.media_files import svg_check

        p = TMP / "boese.svg"
        p.write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
        self.assertFalse(svg_check(p)[0])
        p.write_text('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>')
        self.assertFalse(svg_check(p)[0])

    def test_wikimedia_standardbreiten(self):
        from medialib.importer import commons_thumb

        u, w = commons_thumb({"medien_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.svg", "format": "svg"})
        self.assertTrue(u.endswith("/1280px-X.svg.png"))
        u, w = commons_thumb({"medien_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Y.gif", "format": "gif", "breite": 400})
        self.assertEqual(w, 330)
        with self.assertRaises(ValueError):
            commons_thumb({"medien_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Z.png", "format": "png", "breite": 200})


class T6Integration(unittest.TestCase):
    def test_skill_kopie_identisch(self):
        repo_skill = ECHT.parent / ".claude" / "skills" / "medienbibliothek" / "SKILL.md"
        if repo_skill.exists():
            self.assertEqual(repo_skill.read_text(), (ECHT / "skill" / "SKILL.md").read_text())

    def test_skill_frontmatter(self):
        t = (ECHT / "skill" / "SKILL.md").read_text()
        self.assertTrue(t.startswith("---\nname: medienbibliothek\ndescription: "))

    def test_wrapper_aus_fremdem_ordner(self):
        env = dict(os.environ)
        r = subprocess.run([str(ECHT / "bin" / "media"), "pfad"], cwd=tempfile.gettempdir(), capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), str(TMP))


def tearDownModule():
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
