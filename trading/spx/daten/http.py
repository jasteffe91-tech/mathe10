"""Gemeinsamer HTTP-Zugriff mit Wiederholungen und Protokollierung von Datenfehlern."""

from __future__ import annotations

import logging
import time

import requests

log = logging.getLogger("spx.daten")

STANDARD_UA = "spx-analyse/0.1 (privates Analyseprojekt)"


class DatenFehler(RuntimeError):
    pass


def sitzung(user_agent: str = STANDARD_UA) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = user_agent
    return s


def holen(s: requests.Session, url: str, *, params=None, headers=None, versuche: int = 4,
          timeout: float = 20) -> requests.Response:
    warte = 2.0
    letzter: Exception | None = None
    for versuch in range(1, versuche + 1):
        try:
            r = s.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                raise DatenFehler(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r
        except (requests.RequestException, DatenFehler) as e:
            letzter = e
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status is not None and 400 <= status < 500 and status != 429:
                break  # Client-Fehler: Wiederholen bringt nichts
            if versuch < versuche:
                time.sleep(warte)
                warte *= 2
    log.warning("Abruf fehlgeschlagen: %s (%s)", url.split("?")[0], letzter)
    raise DatenFehler(f"{url.split('?')[0]}: {letzter}")
