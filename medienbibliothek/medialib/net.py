"""Höflicher HTTP-Client: Mindestabstand pro Host, Retry-After, exponentielles Backoff.

Heruntergeladene Inhalte sind nicht vertrauenswürdig: Sie werden nur gespeichert
und mit Pillow/Parser gelesen, niemals ausgeführt.
"""

from __future__ import annotations

import random
import time
from urllib.parse import urlparse

from medialib.config import user_agent

DEFAULT_INTERVALS = {
    "commons.wikimedia.org": 7.0,   # unidentifizierte Clients: ca. 10 Anfragen/Minute
    "upload.wikimedia.org": 3.0,
    "thumb.wikimedia.org": 3.0,
    "images-api.nasa.gov": 1.0,
    "images-assets.nasa.gov": 1.0,
    "api.wellcomecollection.org": 1.0,
    "iiif.wellcomecollection.org": 1.5,
    "collectionapi.metmuseum.org": 0.5,
    "images.metmuseum.org": 1.0,
    "openaccess-api.clevelandart.org": 1.0,
    "cdn.jsdelivr.net": 0.3,
    "xkcd.com": 1.0,
}
MAX_BYTES = 25 * 1024 * 1024


class HttpError(Exception):
    pass


class Client:
    def __init__(self, intervals: dict | None = None, max_retries: int = 6):
        import requests  # lazy: Suche braucht requests nicht

        self.s = requests.Session()
        self.s.headers.update({"User-Agent": user_agent(), "Accept-Encoding": "gzip, deflate"})
        self.intervals = dict(DEFAULT_INTERVALS)
        if intervals:
            self.intervals.update(intervals)
        self.last: dict[str, float] = {}
        self.max_retries = max_retries
        self.stats = {"anfragen": 0, "429": 0, "fehler": 0}

    def _wait(self, host: str) -> None:
        iv = self.intervals.get(host, 1.0)
        dt = time.time() - self.last.get(host, 0)
        if dt < iv:
            time.sleep(iv - dt + random.uniform(0, 0.3))

    def get(self, url: str, params: dict | None = None, stream: bool = False, timeout: int = 60, accept_404: bool = False):
        host = urlparse(url).netloc
        delay = 5.0
        last_exc = None
        for attempt in range(self.max_retries):
            self._wait(host)
            self.last[host] = time.time()
            self.stats["anfragen"] += 1
            try:
                r = self.s.get(url, params=params, timeout=timeout, stream=stream)
            except Exception as exc:  # Netzwerkfehler
                last_exc = exc
                self.stats["fehler"] += 1
                time.sleep(delay)
                delay = min(delay * 2, 120)
                continue
            if r.status_code in (429, 503, 502, 504):
                self.stats["429"] += 1
                ra = r.headers.get("retry-after")
                try:
                    wait = float(ra) + 1 if ra else delay
                except ValueError:
                    wait = delay
                # Intervall für diesen Host dauerhaft vergrößern (adaptiv)
                self.intervals[host] = min(self.intervals.get(host, 1.0) * 1.2, 15)
                if wait > 120:
                    # Lange Sperre: nicht weiter anfragen, sondern sauber abbrechen
                    raise HttpError(f"Gedrosselt (HTTP {r.status_code}, Retry-After {ra}s) für {url}")
                time.sleep(wait)
                delay = min(delay * 2, 120)
                continue
            if r.status_code == 404 and accept_404:
                return r
            if r.status_code >= 400:
                raise HttpError(f"HTTP {r.status_code} für {url}")
            return r
        raise HttpError(f"Abbruch nach {self.max_retries} Versuchen: {url} ({last_exc})")

    def json(self, url: str, params: dict | None = None) -> dict:
        return self.get(url, params=params).json()

    def download(self, url: str, dest, max_bytes: int = MAX_BYTES) -> int:
        """Lädt eine Datei atomar herunter (tmp + rename). Gibt Bytes zurück."""
        from pathlib import Path

        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".part")
        r = self.get(url, stream=True, timeout=120)
        n = 0
        try:
            with open(tmp, "wb") as fh:
                for chunk in r.iter_content(1 << 16):
                    n += len(chunk)
                    if n > max_bytes:
                        raise HttpError(f"Datei größer als {max_bytes // (1024 * 1024)} MB: {url}")
                    fh.write(chunk)
            tmp.replace(dest)
        finally:
            r.close()
            if tmp.exists():
                tmp.unlink()
        return n
