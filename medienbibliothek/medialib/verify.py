"""Nachprüfung: Lizenzen erneut an der Quelle lesen, Links prüfen, Status aktualisieren.

- Commons: Lizenz aus den aktuellen Dateimetadaten (gebündelt, 50 pro Anfrage).
- Wellcome/Met: Lizenz bzw. Public-Domain-Flag aus der jeweiligen API.
- NASA, extern: Erreichbarkeit der Quellseite.
Geänderte Lizenzen -> lizenz_status 'geaendert' (von allen Profilen ausgeschlossen, bis geklärt).
Nicht mehr erreichbar -> 'nicht-erreichbar' (ebenfalls ausgeschlossen).
"""

from __future__ import annotations

import sys
import time

from medialib.db import DB, today


def pruefen(db: DB, ids: list[str] | None = None, aelter_als: int | None = None, nur_links: bool = False, out=sys.stdout) -> int:
    from medialib.net import Client
    from medialib.sources import commons

    items = [db.get(i) for i in ids] if ids else db.all()
    items = [i for i in items if i and i.get("herkunft") not in ("eigen",)]
    if aelter_als:
        grenze = time.strftime("%Y-%m-%d", time.localtime(time.time() - aelter_als * 86400))
        items = [i for i in items if (i.get("pruefdatum") or "") < grenze]
    client = Client()
    bericht = {"ok": 0, "geaendert": 0, "nicht-erreichbar": 0}

    def setze(it, status, notiz=None):
        it = dict(it)
        if status == "ok":
            it["lizenz_status"] = "verifiziert" if it.get("lizenz_status") != "ungeprueft" else "ungeprueft"
            it["pruefdatum"] = today()
            bericht["ok"] += 1
        else:
            it["lizenz_status"] = status
            it["notizen"] = ((it.get("notizen") or "") + f"; {today()}: {notiz}").strip("; ")
            bericht[status] += 1
            print(f"  {it['id']}: {status} – {notiz}", file=out)
        db.upsert(it, export=False)

    com = [i for i in items if i.get("herkunft") == "commons"]
    if com and not nur_links:
        res = {c["quelle_id"]: c for c in commons.by_titles(client, [i["quelle_id"] for i in com])}
        for it in com:
            c = res.get(it["quelle_id"])
            if not c or c.get("fehlt"):
                setze(it, "nicht-erreichbar", "Datei auf Commons nicht mehr vorhanden")
            elif c["lizenz"] != it["lizenz"]:
                setze(it, "geaendert", f"Lizenz jetzt {c['lizenz']} (vorher {it['lizenz']})")
            else:
                setze(it, "ok")
    rest = [i for i in items if i.get("herkunft") != "commons" or nur_links]
    for it in rest:
        url = it.get("quelle_url")
        if not url:
            continue
        try:
            if it.get("herkunft") == "wellcome" and not nur_links:
                d = client.json(it["lizenz_nachweis_url"])
                lic = ((d.get("locations") or [{}])[0].get("license") or {}).get("id")
                ok = {"pdm": "PDM-1.0", "cc-by": "CC-BY-4.0", "cc-0": "CC0-1.0"}.get(lic) == it["lizenz"]
                setze(it, "ok") if ok else setze(it, "geaendert", f"Wellcome-Lizenz jetzt '{lic}'")
                continue
            if it.get("herkunft") == "met" and not nur_links:
                d = client.json(it["lizenz_nachweis_url"])
                setze(it, "ok") if d.get("isPublicDomain") else setze(it, "geaendert", "Met: isPublicDomain nicht mehr true")
                continue
            r = client.get(url, accept_404=True)
            setze(it, "ok") if r.status_code < 400 else setze(it, "nicht-erreichbar", f"HTTP {r.status_code}")
        except Exception as exc:  # noqa: BLE001
            setze(it, "nicht-erreichbar", str(exc)[:120])
    db.export_jsonl()
    print(f"Nachprüfung: {bericht}", file=out)
    return 0 if not (bericht["geaendert"] or bericht["nicht-erreichbar"]) else 4
