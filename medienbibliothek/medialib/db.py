"""SQLite-Datenbank mit FTS5-Volltextindex.

Datenhaltung:
- metadata/katalog.jsonl ist die versionierbare Quelle (eine Zeile pro Medium,
  sortiert nach id). Sie wird nach jedem Schreibvorgang automatisch exportiert.
- database/media.sqlite ist der schnelle Arbeitsindex. Fehlt er oder passt seine
  Prüfsumme nicht mehr zum Katalog (z. B. nach `git pull`), wird er automatisch
  aus dem Katalog neu aufgebaut.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from medialib import config
from medialib.taxonomy import fold, load as load_tax

SCHEMA_VERSION = 1

# Feldname -> SQL-Typ. JSON-Listen werden als Text gespeichert.
FELDER: dict[str, str] = {
    "id": "TEXT PRIMARY KEY",
    "titel": "TEXT",
    "beschreibung": "TEXT",
    "originaltitel": "TEXT",
    "originalbeschreibung": "TEXT",
    "fach": "TEXT",
    "hauptthema": "TEXT",
    "unterthemen": "TEXT",
    "schlagworte": "TEXT",
    "schlagworte_en": "TEXT",
    "medientyp": "TEXT",
    "format": "TEXT",
    "mime": "TEXT",
    "stufe_min": "INTEGER",
    "stufe_max": "INTEGER",
    "schwierigkeit": "TEXT",
    "einsatzzweck": "TEXT",
    "didaktik": "TEXT",
    "fachlich": "TEXT",
    "fachlich_hinweis": "TEXT",
    "beschriftung": "TEXT",
    "breite": "INTEGER",
    "hoehe": "INTEGER",
    "seitenverhaeltnis": "REAL",
    "transparent": "INTEGER",
    "sw_geeignet": "INTEGER",
    "druck_geeignet": "INTEGER",
    "dateigroesse": "INTEGER",
    "urheber": "TEXT",
    "urheber_url": "TEXT",
    "quelle": "TEXT",
    "quelle_url": "TEXT",
    "medien_url": "TEXT",
    "lizenz": "TEXT",
    "lizenz_name": "TEXT",
    "lizenz_url": "TEXT",
    "lizenz_nachweis_url": "TEXT",
    "lizenz_detail": "TEXT",
    "lizenz_kategorie": "TEXT",
    "lizenz_status": "TEXT",
    "pruefdatum": "TEXT",
    "namensnennung_pflicht": "INTEGER",
    "einschraenkungen": "TEXT",
    "credit_vorgabe": "TEXT",
    "speicherung": "TEXT",
    "pfad": "TEXT",
    "thumbnail": "TEXT",
    "alt_text": "TEXT",
    "qualitaet": "INTEGER",
    "qualitaet_hinweis": "TEXT",
    "sha256": "TEXT",
    "quelle_sha1": "TEXT",
    "phash": "TEXT",
    "herkunft": "TEXT",
    "quelle_id": "TEXT",
    "importiert_am": "TEXT",
    "aktualisiert_am": "TEXT",
    "kuratiert": "INTEGER",
    "notizen": "TEXT",
}
LISTENFELDER = {"unterthemen", "schlagworte", "schlagworte_en", "einsatzzweck", "einschraenkungen"}

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS medien ({", ".join(f"{k} {v}" for k, v in FELDER.items())});
CREATE INDEX IF NOT EXISTS idx_medien_fach ON medien(fach);
CREATE INDEX IF NOT EXISTS idx_medien_thema ON medien(hauptthema);
CREATE INDEX IF NOT EXISTS idx_medien_typ ON medien(medientyp);
CREATE INDEX IF NOT EXISTS idx_medien_sha ON medien(sha256);
CREATE INDEX IF NOT EXISTS idx_medien_quelle ON medien(herkunft, quelle_id);
CREATE VIRTUAL TABLE IF NOT EXISTS medien_fts USING fts5(
    id UNINDEXED, titel, beschreibung, schlagworte, themen, original, englisch,
    tokenize = "unicode61 remove_diacritics 2"
);
CREATE VIRTUAL TABLE IF NOT EXISTS medien_tri USING fts5(id UNINDEXED, text, tokenize = "trigram");
CREATE TABLE IF NOT EXISTS kandidaten (
    schluessel TEXT PRIMARY KEY, herkunft TEXT, quelle_id TEXT, plan_id TEXT,
    titel TEXT, lizenz TEXT, lizenz_kategorie TEXT, score REAL, status TEXT, grund TEXT,
    medien_id TEXT, rohdaten TEXT, geprueft_am TEXT
);
CREATE INDEX IF NOT EXISTS idx_kand_plan ON kandidaten(plan_id, status);
CREATE TABLE IF NOT EXISTS plan_status (plan_id TEXT PRIMARY KEY, status TEXT, zeit TEXT, gefunden INTEGER, info TEXT);
CREATE TABLE IF NOT EXISTS importlog (zeit TEXT, ebene TEXT, plan_id TEXT, schluessel TEXT, nachricht TEXT);
"""


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def today() -> str:
    return time.strftime("%Y-%m-%d")


def _sha_file(p: Path) -> str:
    if not p.exists():
        return ""
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for k in LISTENFELDER:
        if k in d:
            try:
                d[k] = json.loads(d[k]) if d[k] else []
            except (TypeError, json.JSONDecodeError):
                d[k] = []
    return d


def _prepare(item: dict) -> dict:
    out = {}
    for k in FELDER:
        v = item.get(k)
        if k in LISTENFELDER:
            v = json.dumps(v or [], ensure_ascii=False)
        elif isinstance(v, bool):
            v = int(v)
        out[k] = v
    return out


def _fts_texts(item: dict) -> dict:
    tax = load_tax()
    themen = []
    for t in [item.get("hauptthema"), *(item.get("unterthemen") or [])]:
        if t:
            themen.append(tax.suchtext(t))
    kw = item.get("schlagworte") or []
    en = item.get("schlagworte_en") or []
    return {
        "titel": item.get("titel") or "",
        "beschreibung": " ".join(filter(None, [item.get("beschreibung"), item.get("alt_text"), item.get("didaktik")])),
        "schlagworte": " ".join(kw),
        "themen": " ".join(themen),
        "original": " ".join(filter(None, [item.get("originaltitel"), (item.get("originalbeschreibung") or "")[:600]])),
        "englisch": " ".join(en),
    }


class DB:
    def __init__(self, path: Path | None = None, katalog: Path | None = None):
        self.path = Path(path or config.DB_PATH)
        self.katalog = Path(katalog or config.KATALOG_JSONL)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(self.path, timeout=60, isolation_level=None)
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA busy_timeout=60000")
        self.con.execute("PRAGMA journal_mode=WAL")
        self.con.execute("PRAGMA foreign_keys=ON")
        self.con.executescript(SCHEMA)
        self._ensure_synced()

    # ------------------------------------------------------------------ Sync
    def _meta(self, key: str) -> str | None:
        r = self.con.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return r[0] if r else None

    def _set_meta(self, key: str, value: str) -> None:
        self.con.execute("INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)", (key, value))

    def _ensure_synced(self) -> None:
        sha = _sha_file(self.katalog)
        if sha and sha != self._meta("katalog_sha256"):
            self.rebuild_from_jsonl()
        kand = config.KANDIDATEN_JSONL
        if self.katalog == config.KATALOG_JSONL and kand.exists():
            ksha = _sha_file(kand)
            if ksha != self._meta("kandidaten_sha256"):
                with self.tx():
                    self._load_kandidaten(kand)
                    self._set_meta("kandidaten_sha256", ksha)

    def rebuild_from_jsonl(self) -> int:
        n = 0
        with self.tx():
            self.con.execute("DELETE FROM medien")
            self.con.execute("DELETE FROM medien_fts")
            self.con.execute("DELETE FROM medien_tri")
            if self.katalog.exists():
                with open(self.katalog, encoding="utf-8") as fh:
                    for line in fh:
                        line = line.strip()
                        if line:
                            self._upsert(json.loads(line))
                            n += 1
            self._set_meta("katalog_sha256", _sha_file(self.katalog))
            self._set_meta("schema_version", str(SCHEMA_VERSION))
        return n

    def _load_kandidaten(self, path: Path) -> None:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                k = json.loads(line)
                self.con.execute(
                    """INSERT INTO kandidaten(schluessel, herkunft, quelle_id, plan_id, titel, lizenz, lizenz_kategorie,
                       score, status, grund, medien_id, geprueft_am) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(schluessel) DO UPDATE SET status=excluded.status, grund=excluded.grund,
                       medien_id=excluded.medien_id, geprueft_am=excluded.geprueft_am
                       WHERE kandidaten.geprueft_am IS NULL OR kandidaten.geprueft_am <= excluded.geprueft_am""",
                    (k["schluessel"], k.get("herkunft"), k.get("quelle_id"), k.get("plan_id"), k.get("titel"),
                     k.get("lizenz"), k.get("lizenz_kategorie"), k.get("score"), k.get("status"), k.get("grund"),
                     k.get("medien_id"), k.get("geprueft_am")),
                )

    # ------------------------------------------------------------ Schreiben
    @contextmanager
    def tx(self):
        try:
            self.con.execute("BEGIN")
            yield self.con
            self.con.execute("COMMIT")
        except BaseException:
            self.con.execute("ROLLBACK")
            raise

    def _upsert(self, item: dict) -> None:
        row = _prepare(item)
        cols = ", ".join(row)
        qs = ", ".join("?" for _ in row)
        upd = ", ".join(f"{k}=excluded.{k}" for k in row if k != "id")
        self.con.execute(f"INSERT INTO medien({cols}) VALUES({qs}) ON CONFLICT(id) DO UPDATE SET {upd}", list(row.values()))
        self.con.execute("DELETE FROM medien_fts WHERE id=?", (item["id"],))
        self.con.execute("DELETE FROM medien_tri WHERE id=?", (item["id"],))
        t = _fts_texts(item)
        self.con.execute(
            "INSERT INTO medien_fts(id, titel, beschreibung, schlagworte, themen, original, englisch) VALUES(?,?,?,?,?,?,?)",
            (item["id"], t["titel"], t["beschreibung"], t["schlagworte"], t["themen"], t["original"], t["englisch"]),
        )
        tri = fold(" ".join([t["titel"], t["schlagworte"], t["englisch"], t["beschreibung"][:300], t["original"][:300]]))
        self.con.execute("INSERT INTO medien_tri(id, text) VALUES(?, ?)", (item["id"], tri))

    def upsert(self, item: dict, export: bool = True) -> None:
        item = dict(item)
        item.setdefault("aktualisiert_am", now())
        with self.tx():
            self._upsert(item)
        if export:
            self.export_jsonl()

    def upsert_many(self, items: list[dict]) -> None:
        with self.tx():
            for it in items:
                it = dict(it)
                it.setdefault("aktualisiert_am", now())
                self._upsert(it)
        self.export_jsonl()

    def delete(self, mid: str) -> None:
        with self.tx():
            self.con.execute("DELETE FROM medien WHERE id=?", (mid,))
            self.con.execute("DELETE FROM medien_fts WHERE id=?", (mid,))
            self.con.execute("DELETE FROM medien_tri WHERE id=?", (mid,))
        self.export_jsonl()

    def export_jsonl(self) -> None:
        """Schreibt den Katalog atomar (tmp + rename) und merkt sich die Prüfsumme."""
        if self.katalog != config.KATALOG_JSONL and not self.katalog.parent.exists():
            self.katalog.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.katalog.with_suffix(".jsonl.tmp")
        rows = self.con.execute("SELECT * FROM medien ORDER BY id").fetchall()
        with open(tmp, "w", encoding="utf-8") as fh:
            for r in rows:
                d = row_to_dict(r)
                d = {k: v for k, v in d.items() if v not in (None, "", [])}
                fh.write(json.dumps(d, ensure_ascii=False, sort_keys=True) + "\n")
        tmp.replace(self.katalog)
        self._set_meta("katalog_sha256", _sha_file(self.katalog))
        self.con.commit()

    def export_kandidaten(self) -> None:
        tmp = config.KANDIDATEN_JSONL.with_suffix(".jsonl.tmp")
        rows = self.con.execute(
            "SELECT schluessel, herkunft, quelle_id, plan_id, titel, lizenz, lizenz_kategorie, score, status, grund, medien_id, geprueft_am "
            "FROM kandidaten ORDER BY schluessel"
        ).fetchall()
        with open(tmp, "w", encoding="utf-8") as fh:
            for r in rows:
                d = {k: v for k, v in dict(r).items() if v not in (None, "")}
                fh.write(json.dumps(d, ensure_ascii=False, sort_keys=True) + "\n")
        tmp.replace(config.KANDIDATEN_JSONL)
        self._set_meta("kandidaten_sha256", _sha_file(config.KANDIDATEN_JSONL))
        self.con.commit()

    # ---------------------------------------------------------------- Lesen
    def get(self, mid: str) -> dict | None:
        r = self.con.execute("SELECT * FROM medien WHERE id=?", (mid,)).fetchone()
        return row_to_dict(r) if r else None

    def all(self, where: str = "1=1", params: tuple = ()) -> list[dict]:
        return [row_to_dict(r) for r in self.con.execute(f"SELECT * FROM medien WHERE {where} ORDER BY id", params)]

    def find_by_hash(self, sha256: str | None = None, quelle: tuple | None = None) -> dict | None:
        if sha256:
            r = self.con.execute("SELECT * FROM medien WHERE sha256=?", (sha256,)).fetchone()
            if r:
                return row_to_dict(r)
        if quelle:
            r = self.con.execute("SELECT * FROM medien WHERE herkunft=? AND quelle_id=?", quelle).fetchone()
            if r:
                return row_to_dict(r)
        return None

    def log(self, ebene: str, nachricht: str, plan_id: str = "", schluessel: str = "") -> None:
        self.con.execute("INSERT INTO importlog VALUES(?,?,?,?,?)", (now(), ebene, plan_id, schluessel, nachricht))
        self.con.commit()

    def close(self) -> None:
        self.con.close()


def open_db() -> DB:
    return DB()
