"""Verbindung zum Onlinedienst (Supabase): Anmeldung der Lehrkraft und RPC-Aufrufe.

* Nur der öffentliche Schlüssel (anon/publishable) wird verwendet – NIEMALS der service_role-Schlüssel.
* Die Lehrkraft meldet sich mit E-Mail und Passwort an; danach genügt das Erneuerungstoken
  (sicher gespeichert, siehe ``zugangsdaten.py``).
* Alle Daten werden über HTTPS als JSON im Request-Body übertragen.
"""
from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from typing import Any, Callable


class ApiFehler(Exception):
    def __init__(self, message: str, status: int = 0, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code


class OfflineFehler(ApiFehler):
    """Server nicht erreichbar (keine Internetverbindung)."""


class AnmeldungNoetig(ApiFehler):
    """Keine gültige Anmeldung – E-Mail und Passwort erforderlich."""


class SupabaseClient:
    def __init__(self, url: str, anon_key: str, timeout: float = 25.0,
                 on_session: Callable[[dict[str, Any] | None], None] | None = None):
        url = (url or "").strip().rstrip("/")
        if not url or not anon_key:
            raise ApiFehler("Server-Adresse und öffentlicher Schlüssel fehlen (Einstellungen → Server-Verbindung).")
        if not (url.startswith("https://") or url.startswith("http://localhost") or url.startswith("http://127.0.0.1")):
            raise ApiFehler("Die Server-Adresse muss mit https:// beginnen.")
        if anon_key.startswith("sb_secret_") or "service_role" in _jwt_role(anon_key):
            raise ApiFehler("Das ist der GEHEIME Schlüssel! Bitte nur den öffentlichen anon-/publishable-Schlüssel eintragen.")
        self.url = url
        self.key = anon_key
        self.timeout = timeout
        self.session: dict[str, Any] | None = None
        self.on_session = on_session
        self._ctx = ssl.create_default_context()

    # ------------------------------------------------------------ HTTP
    def _request(self, path: str, body: dict[str, Any], token: str | None = None) -> Any:
        headers = {"Content-Type": "application/json", "Accept": "application/json", "apikey": self.key,
                   "User-Agent": "Lernlabore2-Lehrerprogramm"}
        bearer = token or (self.key if self.key.startswith("eyJ") else None)
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self._ctx if self.url.startswith("https") else None) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                info = json.loads(raw) if raw else {}
            except ValueError:
                info = {}
            msg = info.get("message") or info.get("msg") or info.get("error_description") or f"Serverfehler ({e.code})"
            raise ApiFehler(msg, e.code, info.get("code") or info.get("error_code")) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            raise OfflineFehler(f"Server nicht erreichbar ({getattr(e, 'reason', e)}).") from None

    # ------------------------------------------------------------ Anmeldung
    def _store(self, data: dict[str, Any]) -> dict[str, Any]:
        self.session = {
            "access_token": data["access_token"], "refresh_token": data["refresh_token"],
            "expires_at": data.get("expires_at") or int(time.time()) + int(data.get("expires_in", 3600)),
            "email": (data.get("user") or {}).get("email", ""),
        }
        if self.on_session:
            self.on_session(self.session)
        return self.session

    def login(self, email: str, password: str) -> dict[str, Any]:
        try:
            data = self._request("/auth/v1/token?grant_type=password", {"email": email.strip(), "password": password})
        except ApiFehler as e:
            if isinstance(e, OfflineFehler):
                raise
            if e.status in (400, 401):
                raise AnmeldungNoetig("E-Mail-Adresse oder Passwort ist falsch.", e.status) from None
            raise
        return self._store(data)

    def login_with_refresh_token(self, refresh_token: str) -> dict[str, Any]:
        try:
            data = self._request("/auth/v1/token?grant_type=refresh_token", {"refresh_token": refresh_token})
        except ApiFehler as e:
            if isinstance(e, OfflineFehler):
                raise
            self.session = None
            if self.on_session:
                self.on_session(None)
            raise AnmeldungNoetig("Die gespeicherte Anmeldung ist abgelaufen. Bitte erneut anmelden.", e.status) from None
        return self._store(data)

    def _token(self) -> str:
        if not self.session:
            raise AnmeldungNoetig("Bitte zuerst anmelden.")
        if self.session["expires_at"] - 60 < time.time():
            self.login_with_refresh_token(self.session["refresh_token"])
        return self.session["access_token"]

    def logout(self) -> None:
        if self.session:
            try:
                self._request("/auth/v1/logout", {}, self.session["access_token"])
            except ApiFehler:
                pass
        self.session = None
        if self.on_session:
            self.on_session(None)

    # ------------------------------------------------------------ RPC
    def rpc(self, fn: str, args: dict[str, Any] | None = None) -> Any:
        try:
            return self._request(f"/rest/v1/rpc/{fn}", args or {}, self._token())
        except ApiFehler as e:
            if e.status == 401 and not isinstance(e, AnmeldungNoetig):
                raise AnmeldungNoetig("Die Anmeldung ist abgelaufen. Bitte erneut anmelden.", 401) from None
            raise


def _jwt_role(token: str) -> str:
    """Liest (ohne Prüfung) die Rolle aus einem JWT – nur um versehentlich eingetragene geheime Schlüssel zu erkennen."""
    try:
        import base64
        part = token.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part)).get("role", "")
    except Exception:
        return ""
