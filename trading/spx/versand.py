"""Versendet einen Bericht per E-Mail (SMTP-Zugang aus Umgebungsvariablen/Secrets)."""

from __future__ import annotations

import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path


def senden(pfad: Path) -> None:
    text = pfad.read_text(encoding="utf-8")
    msg = EmailMessage()
    msg["Subject"] = text.splitlines()[0].lstrip("# ").strip()
    msg["From"] = os.environ["SMTP_USER"]
    msg["To"] = os.environ["BERICHT_EMPFAENGER"]
    msg.set_content(text)
    msg.add_attachment(text.encode("utf-8"), maintype="text", subtype="markdown", filename=pfad.name)
    host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT") or 465)
    kontext = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=kontext, timeout=30) as s:
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORT"])
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as s:
            s.starttls(context=kontext)
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORT"])
            s.send_message(msg)


if __name__ == "__main__":
    senden(Path(sys.argv[1]))
    print("Bericht versendet.")
