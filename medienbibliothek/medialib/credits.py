"""Bildnachweise und Medienverzeichnisse (TASL: Titel, Autor, Quelle, Lizenz).

Wichtig: ShareAlike- und NonCommercial-Bedingungen werden durch einen
Bildnachweis NICHT erfüllt – dafür prüft `medienverzeichnis` zusätzlich das
Einsatzprofil und listet Verstöße auf.
"""

from __future__ import annotations

import html as _html

from medialib import licenses


def _esc_latex(s: str) -> str:
    rep = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
           "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}"}
    return "".join(rep.get(c, c) for c in s or "")


def _teile(it: dict, bearbeitung: str | None = None) -> dict:
    liz = licenses.get(it.get("lizenz") or "unbekannt")
    titel = it.get("originaltitel") or it.get("titel") or it["id"]
    urheber = (it.get("credit_vorgabe") or "").strip() or (it.get("urheber") or "").strip() or "unbekannt"
    if it.get("herkunft") == "commons" and it.get("credit_vorgabe") and it.get("urheber") and it["urheber"] not in it["credit_vorgabe"]:
        urheber = it["credit_vorgabe"]
    return {
        "titel": titel,
        "urheber": urheber,
        "quelle": it.get("quelle") or "",
        "quelle_url": it.get("quelle_url") or "",
        "lizenz": liz,
        "lizenz_url": it.get("lizenz_url") or liz.url,
        "bearbeitung": bearbeitung,
        "eigen": liz.id == "Eigenproduktion",
        "datum": (it.get("importiert_am") or "")[:10],
    }


def bildnachweis(it: dict, fmt: str = "text", bearbeitung: str | None = None) -> str:
    """Erzeugt einen Bildnachweis.

    fmt: text | markdown | html | latex
    bearbeitung: Beschreibung der eigenen Änderung (z. B. "zugeschnitten, beschriftet").
    """
    t = _teile(it, bearbeitung)
    liz = t["lizenz"]
    if t["eigen"]:
        base = f"Eigene Grafik „{t['titel']}“ (erstellt {t['datum']} mit Claude, KI-gestützt)"
        if fmt == "html":
            return _html.escape(base)
        if fmt == "latex":
            return _esc_latex(base)
        return base

    def link(text, url):
        if not url:
            return {"html": _html.escape(text), "latex": _esc_latex(text)}.get(fmt, text)
        if fmt == "markdown":
            return f"[{text}]({url})"
        if fmt == "html":
            return f'<a href="{_html.escape(url)}">{_html.escape(text)}</a>'
        if fmt == "latex":
            return rf"\href{{{url}}}{{{_esc_latex(text)}}}"
        return f"{text} ({url})"

    def esc(s):
        return {"html": _html.escape(s), "latex": _esc_latex(s)}.get(fmt, s)

    q_open, q_close = ("„", "“")
    if liz.id == "PD-USGov":
        if "nasa" not in t["urheber"].lower() and it.get("herkunft") == "nasa":
            t["urheber"] = f"NASA/{t['urheber']}"
        teile = [f"Bild: {esc(t['urheber'])}", f"{q_open}{esc(t['titel'])}{q_close}",
                 link(t["quelle"], t["quelle_url"]), "gemeinfrei (" + link("NASA Media Usage Guidelines", t["lizenz_url"]) + ")"]
    elif liz.gemeinfrei:
        teile = [f"{q_open}{esc(t['titel'])}{q_close}", esc(t["urheber"]), link(t["quelle"], t["quelle_url"]),
                 link(liz.name, t["lizenz_url"])]
    else:
        teile = [f"{q_open}{esc(t['titel'])}{q_close} von {esc(t['urheber'])}", link(t["quelle"], t["quelle_url"]),
                 "Lizenz: " + link(liz.name, t["lizenz_url"])]
    if bearbeitung:
        teile.append(f"bearbeitet: {esc(bearbeitung)}")
    if liz.nc:
        teile.append(esc("nur nichtkommerzielle Nutzung"))
    return ", ".join(p for p in teile if p)


def medienverzeichnis(items: list[dict], fmt: str = "markdown", profil: str | None = None,
                      bearbeitungen: dict | None = None, ueberschrift: str = "Bildnachweise") -> tuple[str, list]:
    """Erzeugt ein Medienverzeichnis und prüft alle Medien gegen das Einsatzprofil.

    Gibt (text, verstoesse) zurück. verstoesse = [(id, [gruende])].
    """
    profil = profil or licenses.standardprofil()
    bearbeitungen = bearbeitungen or {}
    verstoesse = []
    zeilen = []
    hinweise_sa = []
    for n, it in enumerate(items, 1):
        bearb = bearbeitungen.get(it["id"])
        pr = licenses.pruefe_nutzung(it, profil, bearbeitung=bool(bearb))
        if not pr.erlaubt:
            verstoesse.append((it["id"], pr.gruende))
        nach = bildnachweis(it, fmt, bearb)
        if fmt == "markdown":
            zeilen.append(f"{n}. Abb. {n}: {nach}")
        elif fmt == "html":
            zeilen.append(f"<li>Abb. {n}: {nach}</li>")
        elif fmt == "latex":
            zeilen.append(rf"\item Abb. {n}: {nach}")
        else:
            zeilen.append(f"Abb. {n}: {nach}")
        liz = licenses.get(it.get("lizenz") or "unbekannt")
        if liz.sa and bearb:
            hinweise_sa.append(f"Abb. {n} ist bearbeitet und steht unter {liz.name}: die bearbeitete Abbildung unter derselben Lizenz weitergeben.")
    if fmt == "html":
        text = f"<h2>{_html.escape(ueberschrift)}</h2>\n<ol>\n" + "\n".join(zeilen) + "\n</ol>"
    elif fmt == "latex":
        text = rf"\section*{{{_esc_latex(ueberschrift)}}}" + "\n\\begin{enumerate}\n" + "\n".join(zeilen) + "\n\\end{enumerate}"
    elif fmt == "markdown":
        text = f"## {ueberschrift}\n\n" + "\n".join(zeilen)
    else:
        text = f"{ueberschrift}\n" + "\n".join(zeilen)
    if hinweise_sa:
        text += "\n\n" + "\n".join(hinweise_sa)
    return text, verstoesse
