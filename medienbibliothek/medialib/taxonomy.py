"""Fachsystematik: Laden, Begriffsindex und Query-Expansion."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache

from medialib.config import load_json

STOPWORDS = {
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines", "einem", "einen",
    "und", "oder", "mit", "von", "vom", "zu", "zum", "zur", "im", "in", "an", "am", "auf", "bei",
    "fuer", "für", "als", "aus", "nach", "ueber", "über", "unter", "zwischen", "durch",
    "the", "of", "and", "a", "an", "in", "on", "for", "with", "to", "by",
    "bild", "bilder", "grafik", "abbildung", "darstellung", "zeichnung", "image", "picture",
}


def fold(text: str) -> str:
    """Kleinbuchstaben, ß->ss, Umlaute/Akzente entfernt (wie FTS5 remove_diacritics)."""
    text = (text or "").lower().replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def tokens(text: str, drop_stop: bool = True) -> list[str]:
    toks = re.findall(r"[0-9a-z]+", fold(text))
    if drop_stop:
        toks = [t for t in toks if t not in STOPWORDS]
    return toks


@dataclass
class Knoten:
    id: str
    label: str
    synonyme: list
    englisch: list
    verwandt: list
    stufe: tuple
    fach: str
    parent: str | None
    kinder: list = field(default_factory=list)

    def begriffe(self) -> list[str]:
        return [self.label, *self.synonyme, *self.englisch]


@dataclass
class Treffer:
    thema: str
    score: float
    art: str  # "direkt" | "unterthema" | "verwandt"
    begriff: str


class Taxonomie:
    def __init__(self, data: dict):
        self.knoten: dict[str, Knoten] = {}
        for k in data["knoten"]:
            kid = k["id"]
            parent = kid.rsplit(".", 1)[0] if "." in kid else None
            fach = "mathematik" if kid.startswith("ma") else "physik"
            self.knoten[kid] = Knoten(
                id=kid, label=k["label"], synonyme=k.get("synonyme", []), englisch=k.get("englisch", []),
                verwandt=k.get("verwandt", []), stufe=tuple(k.get("stufe", [5, 13])), fach=fach, parent=parent,
            )
        for kn in self.knoten.values():
            if kn.parent and kn.parent in self.knoten:
                self.knoten[kn.parent].kinder.append(kn.id)
        # Begriffsindex: gefalteter Begriff -> [(thema, originalbegriff)]
        self.index: dict[str, list[tuple[str, str]]] = {}
        for kn in self.knoten.values():
            for b in kn.begriffe():
                key = " ".join(tokens(b, drop_stop=False))
                if key:
                    self.index.setdefault(key, []).append((kn.id, b))

    def get(self, kid: str) -> Knoten | None:
        return self.knoten.get(kid)

    def label(self, kid: str) -> str:
        kn = self.knoten.get(kid)
        return kn.label if kn else kid

    def pfad(self, kid: str) -> list[str]:
        out = []
        while kid:
            out.append(kid)
            kid = self.knoten[kid].parent if kid in self.knoten else None
        return list(reversed(out))

    def pfad_label(self, kid: str) -> str:
        return " › ".join(self.label(k) for k in self.pfad(kid) if "." in k or k in ("ma", "ph"))

    def nachfahren(self, kid: str) -> list[str]:
        out, stack = [], [kid]
        while stack:
            cur = stack.pop()
            for c in self.knoten.get(cur, Knoten(cur, "", [], [], [], (5, 13), "", None)).kinder:
                out.append(c)
                stack.append(c)
        return out

    def suchtext(self, kid: str) -> str:
        """Alle Begriffe eines Themas und seiner Vorfahren (für den Volltextindex)."""
        parts = []
        for k in self.pfad(kid):
            kn = self.knoten.get(k)
            if kn:
                parts.extend(kn.begriffe())
        return " ".join(parts)

    def erkenne(self, query: str) -> list[Treffer]:
        """Erkennt Themen in einer Suchanfrage und erweitert sie.

        Liefert direkte Treffer (Begriff der Anfrage = Begriff des Themas),
        Unterthemen (Nachfahren direkter Treffer) und verwandte Themen
        (schwächer gewichtet, ausdrücklich als 'verwandt' markiert).
        """
        qtok = tokens(query, drop_stop=False)
        qtok_ns = [t for t in qtok if t not in STOPWORDS]
        if not qtok_ns:
            return []
        qstr = " ".join(qtok)
        best: dict[str, Treffer] = {}

        def add(kid, score, art, begriff):
            cur = best.get(kid)
            if cur is None or score > cur.score:
                best[kid] = Treffer(kid, round(score, 3), art, begriff)

        n = len(qtok_ns)
        for key, refs in self.index.items():
            ktoks = key.split()
            if key == qstr or key == " ".join(qtok_ns):
                sc = 1.0
            elif _contains_seq(qtok, ktoks):
                # Begriff steckt als Phrase in der Anfrage
                cover = len([t for t in ktoks if t not in STOPWORDS]) / max(n, 1)
                sc = 0.55 + 0.4 * min(cover, 1.0)
            elif len(ktoks) == 1 and len(ktoks[0]) >= 5 and any(
                _stem_eq(ktoks[0], q) for q in qtok_ns
            ):
                cover = 1 / max(n, 1)
                sc = 0.45 + 0.35 * cover
            elif len(ktoks) > 1 and all(any(_stem_eq(k, q) for q in qtok_ns) for k in ktoks if k not in STOPWORDS):
                sc = 0.5 + 0.4 * min(len(ktoks) / max(n, 1), 1.0)
            else:
                continue
            for kid, b in refs:
                # sehr allgemeine Wurzelknoten (ma, ph) nur schwach
                add(kid, sc * (0.3 if "." not in kid else 1.0), "direkt", b)

        direkt = dict(best)
        for kid, tr in direkt.items():
            # Oberbegriff exakt genannt (z. B. "Wurfparabel") -> Unterthemen fast gleichwertig;
            # nur teilweise getroffen (z. B. "Funktion" in "quadratische Funktion") -> schwach.
            faktor = 0.9 if tr.score >= 0.95 else 0.55
            for nf in self.nachfahren(kid):
                add(nf, tr.score * faktor, "unterthema", tr.begriff)
            kn = self.knoten.get(kid)
            for v in (kn.verwandt if kn else []):
                if v in self.knoten:
                    add(v, tr.score * 0.35, "verwandt", tr.begriff)
        return sorted(best.values(), key=lambda t: -t.score)


def _stem_eq(a: str, b: str) -> bool:
    """Grobe Stammgleichheit für deutsche/englische Flexion (Parabel/Parabeln, Linse/Linsen)."""
    if a == b:
        return True
    if min(len(a), len(b)) < 5:
        return False
    sa, sb = _stem(a), _stem(b)
    return sa == sb or (len(sa) >= 6 and (sb.startswith(sa) or sa.startswith(sb)) and abs(len(sa) - len(sb)) <= 3)


def _stem(w: str) -> str:
    for suf in ("ungen", "ung", "en", "er", "es", "e", "n", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def _contains_seq(hay: list[str], needle: list[str]) -> bool:
    if not needle or len(needle) > len(hay):
        return False
    for i in range(len(hay) - len(needle) + 1):
        if all(_stem_eq(hay[i + j], needle[j]) if len(needle[j]) >= 5 else hay[i + j] == needle[j] for j in range(len(needle))):
            return True
    return False


@lru_cache(maxsize=1)
def load() -> Taxonomie:
    return Taxonomie(load_json("taxonomie.json"))
