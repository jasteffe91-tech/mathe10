"""Lizenznormalisierung, Kategorien und Einsatzprofil-Prüfung.

Konservative Logik: Was nicht eindeutig erkannt wird, landet in Kategorie C
("unbekannt") und wird von keinem Materialprofil zugelassen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from medialib.config import load_json

# Einschränkungs-Kennungen (Feld `einschraenkungen`)
EINSCHRAENKUNG_TEXT = {
    "personenrechte": "Erkennbare Person(en): Persönlichkeitsrechte beachten (keine kommerzielle/werbliche Nutzung, nicht herabwürdigend).",
    "marke": "Enthält Marken/Logos: nur beschreibend nutzen, keine Billigung durch den Markeninhaber suggerieren.",
    "nasa-logo": "NASA-Logos/Insignien sind ausgenommen; keine Billigung durch NASA suggerieren.",
    "kunstwerk": "Abgebildetes Kunstwerk: eigene Rechte des Kunstwerks prüfen.",
    "musik": "Enthält ggf. lizenzierte Musik: nur ohne Tonspur verwenden.",
    "us-pd": "Gemeinfreiheit beruht auf US-Recht (Werk der US-Bundesregierung); außerhalb der USA nicht abschließend geklärt.",
    "drittinhalte": "Enthält Material Dritter: Einzelrechte prüfen.",
    "us-schaltzeichen": "Schaltzeichen nach US-Norm (ANSI), nicht DIN EN 60617 – im deutschen Unterricht ggf. ungeeignet.",
}


@dataclass
class Lizenz:
    id: str
    name: str
    url: str
    kategorie: str
    namensnennung: bool
    sa: bool
    nc: bool
    nd: bool
    gemeinfrei: bool = False
    hinweis: str = ""


def _table() -> dict:
    return load_json("lizenzen.json")["lizenzen"]


_CC_ID_RE = re.compile(r"^CC-(BY(?:-NC)?(?:-SA|-ND)?)-(\d\.\d)$")


def _synth_cc(lizenz_id: str) -> dict | None:
    """Leitet Merkmale einer CC-Lizenz-ID ab, die nicht in der Tabelle steht."""
    m = _CC_ID_RE.match(lizenz_id or "")
    if not m:
        return None
    kind, ver = m.group(1), m.group(2)
    nc, nd, sa = "NC" in kind, "ND" in kind, "SA" in kind
    return {
        "name": f"CC {kind} {ver}",
        "url": f"https://creativecommons.org/licenses/{kind.lower()}/{ver}/deed.de",
        "kategorie": "B" if (nc or nd) else "A",
        "namensnennung": True, "sa": sa, "nc": nc, "nd": nd,
    }


def get(lizenz_id: str) -> Lizenz:
    tab = _table()
    data = tab.get(lizenz_id) or _synth_cc(lizenz_id)
    if data is None:
        data = tab["unbekannt"]
        lizenz_id = "unbekannt"
    return Lizenz(
        id=lizenz_id,
        name=data["name"],
        url=data.get("url", ""),
        kategorie=data["kategorie"],
        namensnennung=bool(data.get("namensnennung")),
        sa=bool(data.get("sa")),
        nc=bool(data.get("nc")),
        nd=bool(data.get("nd")),
        gemeinfrei=bool(data.get("gemeinfrei")),
        hinweis=data.get("hinweis", ""),
    )


_CC_RE = re.compile(
    r"\bcc[\s_-]*(by(?:[\s_-]*nc)?(?:[\s_-]*(?:sa|nd))?)[\s_-]*(\d(?:\.\d)?)?(?:[\s_-]*([a-z]{2,3}))?\b",
    re.I,
)


def normalize(short_name: str | None, url: str | None = None, extra: str | None = None) -> tuple[str, str]:
    """Normalisiert eine Lizenzangabe.

    Gibt (lizenz_id, detail) zurück. detail enthält z. B. Portierungen
    ("de", "igo") oder die Begründung einer Gemeinfreiheit.
    """
    s = (short_name or "").strip()
    u = (url or "").strip().lower()
    low = s.lower()
    detail = ""

    if not s and not u:
        return "unbekannt", ""

    if "publicdomain/zero" in u or low in ("cc0", "cc0 1.0", "cc-zero", "cc zero") or low.startswith("cc0"):
        return "CC0-1.0", ""
    if "publicdomain/mark" in u or low in ("pdm", "public domain mark", "public domain mark 1.0"):
        return "PDM-1.0", ""
    if low in ("public domain", "pd", "gemeinfrei", "domaine public", "dominio público") or low.startswith("public domain") or low.startswith("pd-"):
        if extra and re.search(r"pd-usgov|pd-nasa|nasa", extra, re.I):
            return "PD-USGov", extra
        return "PD", extra or s

    m = _CC_RE.search(s) or _CC_RE.search(u.replace("/", " "))
    if not m and "creativecommons.org/licenses/" in u:
        parts = u.split("creativecommons.org/licenses/")[1].strip("/").split("/")
        if len(parts) >= 2:
            m2 = f"cc {parts[0]} {parts[1]}" + (f" {parts[2]}" if len(parts) > 2 and len(parts[2]) in (2, 3) else "")
            m = _CC_RE.search(m2)
    if m:
        kind = re.sub(r"[\s_-]+", "-", m.group(1).upper())
        version = m.group(2) or ""
        port = (m.group(3) or "").lower()
        if version and "." not in version:
            version = version + ".0"
        if not version:
            return "unbekannt", f"CC-Lizenz ohne Version: {s}"
        lid = f"CC-{kind}-{version}"
        if port and port not in ("deed", "legalcode"):
            detail = f"Portierung: {port}"
        if lid not in _table() and _synth_cc(lid) is None:
            return "unbekannt", f"Nicht erkannte CC-Angabe: {s}"
        return lid, detail

    if "gfdl" in low or "gnu free documentation" in low:
        return "GFDL", s
    if low in ("mit", "mit license", "mit-lizenz"):
        return "MIT", ""
    if "free art" in low or low.startswith("fal"):
        return "FAL-1.3", s
    if low in ("eigenproduktion", "eigen"):
        return "Eigenproduktion", ""
    return "unbekannt", s


@dataclass
class Pruefung:
    erlaubt: bool
    gruende: list = field(default_factory=list)
    hinweise: list = field(default_factory=list)


def profil(name: str) -> dict:
    profs = load_json("profile.json")["profile"]
    if name not in profs:
        raise ValueError(f"Unbekanntes Profil '{name}'. Verfügbar: {', '.join(profs)}")
    return profs[name]


def standardprofil() -> str:
    return load_json("profile.json").get("standardprofil", "offen")


def pruefe_nutzung(item: dict, profilname: str, bearbeitung: bool = False, mit_nd: bool = False) -> Pruefung:
    """Prüft, ob ein Medium im Einsatzprofil zulässig ist.

    bearbeitung=True: das Medium soll verändert werden (Zuschneiden,
    Beschriften, Umfärben ...). ND-Lizenzen sind dann immer ausgeschlossen.
    """
    p = profil(profilname)
    liz = get(item.get("lizenz") or "unbekannt")
    kat = item.get("lizenz_kategorie") or liz.kategorie
    status = item.get("lizenz_status") or "ungeprueft"
    speicherung = item.get("speicherung") or "kandidat"
    pr = Pruefung(erlaubt=True)

    if kat not in p["kategorien"]:
        pr.erlaubt = False
        pr.gruende.append(f"Lizenzkategorie {kat} ({liz.name}) ist im Profil '{profilname}' nicht zugelassen")
    if p.get("nur_verifiziert", True) and status not in ("verifiziert", "eigen"):
        pr.erlaubt = False
        pr.gruende.append(f"Lizenzstatus '{status}' – nicht verifiziert")
    if liz.nc and not p.get("nc_erlaubt", False):
        pr.erlaubt = False
        pr.gruende.append("NonCommercial-Bedingung (NC) – nicht für offene/kommerzielle Veröffentlichung")
    if liz.nd and (bearbeitung or not (p.get("nd_erlaubt", False) or mit_nd)):
        pr.erlaubt = False
        pr.gruende.append("NoDerivatives-Bedingung (ND) – keine Bearbeitung; standardmäßig von automatischer Gestaltung ausgeschlossen")
    if speicherung not in p.get("speicherung", []):
        pr.erlaubt = False
        pr.gruende.append(f"Speicherart '{speicherung}' im Profil '{profilname}' nicht vorgesehen")

    # Hinweise (keine Ausschlussgründe)
    if liz.namensnennung:
        pr.hinweise.append("Namensnennung erforderlich (Bildnachweis mit `media credit` erzeugen)")
    if liz.sa:
        pr.hinweise.append(
            "ShareAlike: Unverändert eingebunden genügt der Bildnachweis; eine BEARBEITETE Fassung des Bildes muss unter "
            f"{liz.name} (oder kompatibel) weitergegeben werden"
        )
    if liz.nc and pr.erlaubt:
        pr.hinweise.append("Nur nichtkommerzielle Nutzung; Material nicht als OER kennzeichnen")
    if kat == "B" and pr.erlaubt:
        pr.hinweise.append("Kategorie B: kostenlos, aber eingeschränkt – Bedingungen des Anbieters beachten")
    if kat == "E":
        pr.hinweise.append("Eigenproduktion: keine Drittrechte bekannt; Lizenz für Veröffentlichung selbst festlegen")
    if speicherung == "extern":
        pr.hinweise.append("Externe Ressource: nur verlinken bzw. beim Anbieter abrufen, keine Kopie weitergeben")
    for e in item.get("einschraenkungen") or []:
        if e in EINSCHRAENKUNG_TEXT:
            pr.hinweise.append(EINSCHRAENKUNG_TEXT[e])
    if liz.hinweis and liz.id not in ("Eigenproduktion",):
        pr.hinweise.append(liz.hinweis)
    return pr


def kurzlabel(item: dict) -> str:
    liz = get(item.get("lizenz") or "unbekannt")
    kat = item.get("lizenz_kategorie") or liz.kategorie
    return f"{liz.name} [Kat. {kat}]"
