"""Erzeugt den Tagesbericht als Markdown (Abschnitte A–E plus Anhang)."""

from __future__ import annotations

from datetime import datetime, time, timedelta

from .kalender import BERLIN, ET, WOCHENTAGE
from .setups import DAY, SWING, Setup


PHASEN = {"geschlossen": "Markt geschlossen", "vor_vorboerse": "vor Beginn der Vorbörse", "vorboerse": "Vorbörse",
          "regulaer": "regulärer Handel", "nachboerse": "Nachbörse", "nach_handelsschluss": "nach Handelsschluss"}


def _z(x, nachkomma: int = 2, einheit: str = "") -> str:
    if x is None or (isinstance(x, float) and x != x):
        return "–"
    s = f"{x:,.{nachkomma}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s}{einheit}"


def _pct(x, vorzeichen: bool = True) -> str:
    if x is None or (isinstance(x, float) and x != x):
        return "–"
    return _z(x, 2, " %") if not vorzeichen else ("+" if x > 0 else "") + _z(x, 2, " %")


def _zelle(text: str) -> str:
    return str(text).replace("|", "/").replace("\n", " ")


def _zeit(dt: datetime | None) -> str:
    if dt is None:
        return "–"
    return f"{dt.astimezone(ET):%d.%m. %H:%M} ET / {dt.astimezone(BERLIN):%H:%M} Berlin"


def kopf(lauf) -> list[str]:
    j = lauf.jetzt
    s = lauf.sitzung
    z = [f"# S&P-500-Tagesbericht – {WOCHENTAGE[lauf.handelstag.weekday()]}, {lauf.handelstag:%d.%m.%Y}", ""]
    z.append(f"**Erstellt:** {j.astimezone(BERLIN):%d.%m.%Y %H:%M} Uhr (Berlin) · {j.astimezone(ET):%H:%M} Uhr ET · "
             f"Marktphase: {PHASEN.get(lauf.phase, lauf.phase)}")
    if s.offen:
        z.append(f"**US-Handelszeiten heute (Berlin):** Vorbörse ab {s.vorboerse_et.astimezone(BERLIN):%H:%M} · "
                 f"Eröffnung {s.eroeffnung_et.astimezone(BERLIN):%H:%M} · Schluss {s.schluss_et.astimezone(BERLIN):%H:%M}"
                 + (f" (**{s.grund}**)" if s.verkuerzt else ""))
    if lauf.statistik.get("letzter_tag"):
        z.append(f"**Datenstand Tageskerzen:** Schluss {lauf.statistik['letzter_tag']:%d.%m.%Y}")
    z.append("")
    for h in lauf.hinweise:
        z.append(f"> ⚠️ {h}")
    if not lauf.cfg["validierung"]["strategien_validiert"]:
        z.append("> 🧪 **Validierungsstatus: NICHT validiert.** Die Regeln sind noch nicht durch Backtests und "
                 "Paper-Trading belegt. Alle Ideen sind höchstens WATCHLIST-Kandidaten für Paper-Trading.")
    z.append("> Keine Anlageberatung. Kein Trade ist risikofrei; Stops garantieren bei Kurslücken keinen Maximalverlust.")
    z.append("")
    return z


def abschnitt_markt(lauf) -> list[str]:
    u = lauf.umfeld
    z = ["## A. Marktüberblick", "", f"**Marktumfeld (regelbasiert): {u.einstufung.upper()}** – " + "; ".join(u.gruende), ""]
    z += ["| Index | Schluss | Tag | Woche | Trend | Datum |", "|---|---:|---:|---:|---|---|"]
    for r in u.indizes:
        z.append(f"| {r['name']} | {_z(r['kurs'])} | {_pct(r['tag_pct'])} | {_pct(r['woche_pct'])} | {r['trend']} | {r['datum']:%d.%m.} |")
    z.append("")
    if u.futures:
        z += ["| Future (vorbörslich) | Stand | ggü. Kassaschluss Vortag | Zeit | aktuell? |", "|---|---:|---:|---|---|"]
        for f in u.futures:
            z.append(f"| {f['name']} | {_z(f['kurs'])} | {_pct(f['pct'])} | {_zeit(f['zeit'])} | "
                     f"{'ja' if f['aktuell'] else f'**nein** ({f['alter_min']:.0f} Min. alt)'} |")
        z.append("")
    if u.vix:
        v = u.vix
        z.append(f"**VIX:** {_z(v['wert'])} (Vortag {_z(v['vortag'])}, Stand {v['datum']:%d.%m.%Y}, Quelle: {v['quelle']})  ")
    if u.breite_sma50 is not None:
        z.append(f"**Marktbreite:** {_z(u.breite_sma50, 0)} % der S&P-500-Titel über SMA50, "
                 f"{_z(u.breite_sma200, 0)} % über SMA200  ")
    if u.sektoren:
        stark = ", ".join(f"{s['name']} {_pct(s['woche_pct'])}" for s in u.sektoren[:3])
        schwach = ", ".join(f"{s['name']} {_pct(s['woche_pct'])}" for s in u.sektoren[-3:])
        z.append(f"**Sektoren (5 Tage):** stärkste {stark} · schwächste {schwach}")
    z.append("")
    t = lauf.termine
    fomc = t.fomc_im_zeitraum(lauf.handelstag, lauf.handelstag + timedelta(days=14))
    z.append("**Termine & Makro:**")
    for a, b in fomc:
        z.append(f"- FOMC-Sitzung {a:%d.%m.}–{b:%d.%m.%Y}, Zinsentscheid {b:%d.%m.} 14:00 ET "
                 f"({datetime.combine(b, time(14, 0), ET).astimezone(BERLIN):%H:%M} Uhr Berlin) – "
                 "[Fed-Kalender](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)")
    z.append("- Wirtschaftsdaten-Kalender (CPI, Arbeitsmarkt, BIP …): **noch keine Datenquelle angebunden** (Phase 2).")
    makro = [m for m in lauf.nachrichten.meldungen if not m.tickers and (m.quellentyp == "primaer" or m.art == "Makro/Notenbank")][:6]
    for m in makro:
        z.append(f"- {_zeit(m.zeit_utc)} · [{_zelle(m.titel)}]({m.url}) ({m.quelle}, {m.status})")
    z.append("")
    return z


def _richtung(s: Setup) -> str:
    return {"long": "Long", "short": "Short"}[s.richtung]


def abschnitt_setups(lauf, aktiv: list[Setup]) -> list[str]:
    z = ["## B. Top-Setups", ""]
    if not aktiv:
        z += ["**Keine Setups mit ausreichender Datenlage und ausreichendem Chance-Risiko-Verhältnis.**", ""]
        return z
    z += ["| Rang | Ticker | Entscheidung | Richtung | Strategie | Einstieg | Stop / Risiko | Kursziel 1 / 2 | CRV nach Kosten | Qualität | Katalysator |",
          "|---:|---|---|---|---|---|---|---|---:|---|---|"]
    for i, s in enumerate(aktiv, 1):
        p = s.plan
        z.append(
            f"| {i} | **{s.ticker}** | {s.entscheidung} | {_richtung(s)} | {s.strategie}{' (vorläufig)' if s.vorlaeufig else ''} | "
            f"{_z(s.einstieg)} (Bedingung, s. C) | {_z(s.stop)} / {_z(p.verlust_am_stop_eur)} € | "
            f"{_z(s.ziel1)} / {_z(s.ziel2)} | {_z(p.crv_netto)} | {s.qualitaet} | {_zelle(s.katalysator)} |")
    z += ["", "_Kursziele sind Schätzungen. Qualität = erfüllte Regeln einer Checkliste, keine statistische "
          "Trefferwahrscheinlichkeit._", ""]
    return z


def setup_detail(i: int, s: Setup, lauf) -> list[str]:
    p = s.plan
    eurusd, fx_tag, fx_q = lauf.eurusd
    z = [f"### {i}. {s.ticker} – {s.name} · {s.strategie} · {_richtung(s)} · {s.entscheidung}", ""]
    z += [
        f"1. **Unternehmen / Börsenplatz:** {s.name} ({s.ticker}), US-Primärbörse (NYSE/Nasdaq), Sektor: {s.sektor or 'unbekannt'}",
        f"2. **Datenstand:** {lauf.jetzt.astimezone(BERLIN):%d.%m.%Y %H:%M} Berlin; Kurs: {s.kurs_zeit}",
        f"3. **Strategie:** {s.strategie} – Muster: {s.muster}",
        f"4. **Richtung / Instrument:** {_richtung(s)} in der Aktie (kein Hebel, kein Derivat)",
        f"5. **Aktueller Kurs:** {_z(s.kurs)} USD ({s.kurs_zeit})",
        f"6. **Einstieg:** {s.einstieg_bedingung}",
        "7. **Notwendige Bestätigung:** " + "; ".join(s.bestaetigung),
        f"8. **Stop / Invalidierung:** {_z(s.stop)} USD – {s.invalidierung}",
        f"9. **Kursziele (Schätzung):** Ziel 1 {_z(s.ziel1)} USD ({s.ziel_herleitung}); "
        + (f"Ziel 2 {_z(s.ziel2)} USD (3 R)" if s.ziel2 else "Ziel 2 entfällt (Ziel 1 liegt bereits jenseits von 3 R)"),
        f"10. **Chance-Risiko nach Kosten:** {_z(p.crv_netto)} : 1 (brutto {_z(p.crv_brutto)} : 1)",
        f"11. **Positionsgröße:** {p.stueck} Aktien ≈ {_z(p.positionswert_eur)} € · **max. Verlust am Stop ≈ "
        f"{_z(p.verlust_am_stop_eur)} €** (Budget {_z(p.risiko_budget_eur)} €)"
        + (" · _vorläufig, nach Eröffnung neu berechnen_" if s.vorlaeufig else ""),
        f"12. **Kosten:** Rundreise bis Ziel 1 ≈ {_z(p.kosten_rundreise_eur)} € (Gebühren, halber Spread, Slippage, "
        f"FX; Wechselkurs {_z(eurusd, 4)} USD/EUR, {fx_q} {fx_tag:%d.%m.})",
    ]
    if s.strategie == SWING and s.atr:
        gap = p.verlust_am_stop_eur + p.stueck * s.atr / eurusd
        z.append(f"    - Übernacht-/Wochenendrisiko: Eröffnet der Kurs 1 ATR jenseits des Stops, beträgt der Verlust ≈ {_z(gap)} €.")
    for h in p.hinweise:
        z.append(f"    - {h}")
    z.append("13. **Begründung:**")
    z += [f"    - Technik: {b}" for b in s.begruendung]
    z.append("    - Kriterien: " + "; ".join(f"{'❔' if ok is None else '✅' if ok else '❌'} {n}" for n, ok in s.kriterien)
             + " (❔ = ungeprüft, Daten fehlen)")
    if s.meldungen:
        for m in s.meldungen[:4]:
            best = f", bestätigt durch {', '.join(m.bestaetigt_durch)}" if m.bestaetigt_durch else ""
            z.append(f"    - Nachricht ({m.status}{best}): [{_zelle(m.titel)}]({m.url}) – {m.quelle}, {_zeit(m.zeit_utc)}; "
                     f"Art: {m.art}; Tendenz: {m.tendenz}; Horizont: {m.horizont}; Vertrauen: {m.vertrauen}")
    else:
        z.append("    - Fundamental/Nachrichten: keine aktuelle Meldung gefunden. Fundamentaldaten (Umsatz, Margen, "
                 "Revisionen) sind im Prototyp noch nicht angebunden.")
    z.append("14. **Gegenargumente / Alternativszenario:** " + "; ".join(s.gegenargumente or ["–"]))
    z.append("15. **Ereignisrisiken:** " + "; ".join(s.ereignisrisiken or ["keine bekannten"]))
    z.append("16. **Setup verfällt, wenn:** " + "; ".join(s.verfall))
    z.append("")
    return z


def abschnitt_risiko(lauf, aktiv: list[Setup]) -> list[str]:
    r = lauf.risiko
    cfg = lauf.cfg
    z = ["## D. Risikoübersicht", ""]
    z += [
        f"- Handelskapital: {_z(r.kapital_eur)} € ({cfg['_herkunft']['kapital_eur']})",
        f"- Max. Risiko je Position: {_z(cfg['risiko']['risiko_je_trade_pct'], 2)} % = {_z(r.kapital_eur * cfg['risiko']['risiko_je_trade_pct'] / 100)} €",
        f"- Offene Positionen: Risiko {_z(r.offenes_risiko_eur)} € (Positionsdaten noch nicht angebunden – manuell gepflegt)",
        f"- Tagesverlustlimit {cfg['risiko']['tagesverlust_limit_pct']:g} % = {_z(r.tageslimit_eur)} € · heutiges Ergebnis "
        f"{_z(r.tagesergebnis_eur)} € · **Abstand zum Limit {_z(r.abstand_tageslimit_eur)} €**",
        f"- Summe des geplanten Risikos aller Watchlist-Ideen: {_z(sum(s.plan.verlust_am_stop_eur for s in aktiv))} € "
        f"(nicht alle gleichzeitig eröffnen; Gesamtlimit {_z(r.gesamtlimit_eur)} €)",
    ]
    if r.gesperrt:
        z.append("- ⛔ **Limit erreicht: Heute keine neuen Positionen.**")
    if lauf.korrelationen:
        z.append("- Hohe Korrelationen (60 Tage, Tagesrenditen): " +
                 ", ".join(f"{a}/{b} {_z(k)}" for a, b, k in lauf.korrelationen[:8]) +
                 " → zusammen wie **eine** Position behandeln.")
    else:
        z.append("- Keine Korrelationen über der Warnschwelle zwischen den Ideen.")
    ereignis = sorted({e for s in aktiv for e in s.ereignisrisiken})
    if ereignis:
        z.append("- Ereignisrisiken: " + "; ".join(ereignis))
    z.append("")
    return z


def abschnitt_entscheidung(lauf, aktiv: list[Setup]) -> list[str]:
    day = [s for s in aktiv if s.strategie == DAY]
    swing = [s for s in aktiv if s.strategie == SWING]
    beste = aktiv[0] if aktiv else None
    z = ["## E. Abschließende Entscheidung", ""]
    if beste:
        z.append(f"1. **Bestes Setup:** {beste.ticker} ({beste.strategie}, {_richtung(beste)}, {beste.qualitaet}) – "
                 f"Status {beste.entscheidung}: nur nach erfüllter Bestätigung, sonst kein Einstieg.")
    else:
        z.append("1. **Bestes Setup:** keines.")
    z.append("2. **Alternative:** " + (f"{aktiv[1].ticker} ({aktiv[1].strategie})" if len(aktiv) > 1 else "keine"))
    z.append("3. **Swing-Kandidaten:** " + (", ".join(s.ticker for s in swing) if swing else "keine"))
    offen = ["Strategien nicht validiert (Backtest/Paper-Trading ausstehend)"]
    if day:
        offen.append("Daytrading-Niveaus sind vorläufig und erst nach der Opening Range gültig")
    if lauf.datenfehler:
        offen.append(f"{len(lauf.datenfehler)} Datenhinweise (siehe Anhang)")
    z.append("4. **Offene Bedingungen / Warnungen:** " + "; ".join(offen))
    if lauf.risiko.gesperrt:
        fazit = "**Heute kein Trade** – Risikolimit erreicht."
    elif not aktiv:
        fazit = "**Heute erscheint kein Trade sinnvoll.** KEIN TRADE ist eine vollwertige Entscheidung."
    else:
        fazit = ("**Ein Trade ist heute nur bedingt sinnvoll:** ausschließlich als Paper-Trade und nur, wenn die "
                 "genannten Bestätigungen eintreten. Ohne Bestätigung: KEIN TRADE.")
    z.append(f"5. **Fazit:** {fazit}")
    z.append("")
    return z


def anhang(lauf, verworfen: list[Setup]) -> list[str]:
    z = ["## Anhang", "", "### Nachrichten (zugeordnet, dedupliziert)", ""]
    mit = [m for m in lauf.nachrichten.meldungen if m.tickers][:30]
    if mit:
        z += ["| Zeit (ET / Berlin) | Ticker | Meldung | Art | Status | Tendenz | Vertrauen | Quelle |", "|---|---|---|---|---|---|---|---|"]
        for m in mit:
            best = f" (+{len(m.bestaetigt_durch)})" if m.bestaetigt_durch else ""
            z.append(f"| {_zeit(m.zeit_utc)} | {', '.join(m.tickers)} | [{_zelle(m.titel[:90])}]({m.url}) | {m.art} | "
                     f"{m.status} | {m.tendenz} | {m.vertrauen} | {m.quelle}{best} |")
    else:
        z.append("Keine aktuellen, einem S&P-500-Titel zugeordneten Meldungen.")
    z += ["", "_Art, Tendenz und Horizont sind Schlagwort-Heuristiken (Interpretation, nicht Fakt). "
          "(+n) = von n weiteren Quellen gemeldet._", ""]
    if lauf.gaps:
        z += ["### Größte vorbörsliche Bewegungen", "", "| Ticker | Gap | vorbörslich | Zeit |", "|---|---:|---:|---|"]
        for g in lauf.gaps[:10]:
            z.append(f"| {g['ticker']} | {_pct(g['gap_pct'])} | {_z(g['vb_kurs'])} | {_zeit(g['zeit'])} |")
        z.append("")
    z += ["### Aussortiert", ""]
    for g, n in lauf.aussortiert.items():
        if n:
            z.append(f"- {g}: {n}")
    for s in verworfen[:12]:
        grund = s.plan.grund if s.plan and not s.plan.machbar else f"nur {s.erfuellt[0]}/{s.erfuellt[1]} Kriterien"
        z.append(f"  - {s.ticker} ({s.strategie}, {s.muster}): {grund}")
    z += ["", "### Ertragsziel – Realitätsprüfung", ""]
    zp = lauf.zielpruefung
    z += [
        f"- Ziel Ø {_z(zp.ziel_eur, 0)} €/Tag bei {_z(zp.kapital_eur, 0)} € Kapital = **{_z(zp.tagesrendite_pct)} % pro Tag** "
        f"(≈ {_z(zp.jahresrendite_einfach_pct, 0)} % p. a. ohne Zinseszins)",
        f"- Risiko je Trade {_z(zp.risiko_je_trade_eur)} € · erwarteter Ertrag je Trade {_z(zp.erwartung_je_trade_eur)} € "
        f"→ nötig ≈ {_z(zp.trades_pro_tag_noetig, 0)} Trades/Tag",
        f"- Kapitalbedarf für das Ziel mit 1 Trade/Tag: ≈ {_z(zp.kapital_noetig_1_trade_eur, 0)} €",
        f"- Tagesverlustlimit: {_z(zp.tageslimit_eur)} €",
        f"- **Bewertung:** {zp.bewertung}",
        f"- {zp.annahmen}",
        "",
        "### Datenqualität und Quellen", "",
    ]
    z += [f"- {q}" for q in lauf.quellen]
    st = lauf.statistik
    if st:
        z.append(f"- Universum {st.get('universum')} Titel, mit aktuellen Tagesdaten {st.get('mit_daten')}, liquide "
                 f"{st.get('liquide')}, Gap-Kandidaten {st.get('gap_kandidaten')}, Swing-Kandidaten "
                 f"{st.get('swing_kandidaten')}, vertieft {st.get('detail')}")
    for f in lauf.datenfehler:
        z.append(f"- ⚠️ {f}")
    z.append("")
    return z


def erstellen(lauf) -> str:
    z = kopf(lauf)
    if lauf.abbruch:
        z += ["## Kein Bericht", "", f"**{lauf.abbruch}**", "",
              "Es wird keine Analyse vorgetäuscht. Es gibt heute keine Handelsempfehlung.", ""]
        if lauf.datenfehler:
            z += ["### Datenhinweise", ""] + [f"- {f}" for f in lauf.datenfehler] + [""]
        return "\n".join(z)
    aktiv = [s for s in lauf.setups if s.entscheidung != "NO TRADE"]
    verworfen = [s for s in lauf.setups if s.entscheidung == "NO TRADE"]
    z += abschnitt_markt(lauf)
    z += abschnitt_setups(lauf, aktiv)
    z += ["## C. Begründung je Setup", ""]
    if aktiv:
        for i, s in enumerate(aktiv, 1):
            z += setup_detail(i, s, lauf)
    else:
        z += ["Keine Setups.", ""]
    z += abschnitt_risiko(lauf, aktiv)
    z += abschnitt_entscheidung(lauf, aktiv)
    z += anhang(lauf, verworfen)
    return "\n".join(z)
