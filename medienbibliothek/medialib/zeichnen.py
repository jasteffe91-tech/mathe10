"""Präzise SVG-Grafiken für den Unterricht (Eigenproduktionen).

- Schaltpläne mit Schaltzeichen nach DIN EN 60617 (Lampe: Kreis mit Kreuz,
  Widerstand: Rechteck, Spannungsquelle: langer/kurzer Strich, Messgeräte: Kreis mit A/V).
- Koordinatensysteme und Funktionsgraphen mit exakt berechneten Kurven.

Nur Standardbibliothek. Ergebnisse sind schwarz-weiß-druckbar (Farbe nur als Zusatz).
Neue Grafiken mit `media add DATEI --eigen …` in die Bibliothek aufnehmen.
"""

from __future__ import annotations

import math
from xml.sax.saxutils import escape

STROKE = 2.2
FONT = "DejaVu Sans, Arial, Helvetica, sans-serif"


class SVG:
    def __init__(self, w: int, h: int, titel: str = "", beschreibung: str = ""):
        self.w, self.h = w, h
        self.parts: list[str] = []
        self.titel, self.beschreibung = titel, beschreibung

    def add(self, s: str) -> None:
        self.parts.append(s)

    def line(self, x1, y1, x2, y2, w=STROKE, color="#000", dash=None, cap="round"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"{d}/>')

    def circle(self, cx, cy, r, fill="#fff", w=STROKE, color="#000"):
        self.add(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}" stroke="{color}" stroke-width="{w}"/>')

    def dot(self, cx, cy, r=4, color="#000"):
        self.add(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r}" fill="{color}"/>')

    def rect(self, x, y, w, h, fill="#fff", sw=STROKE, color="#000"):
        self.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" stroke="{color}" stroke-width="{sw}"/>')

    def text(self, x, y, s, size=16, anchor="middle", weight="normal", color="#000", italic=False, baseline="middle", halo=True):
        st = ' font-style="italic"' if italic else ""
        hl = ' paint-order="stroke" stroke="#fff" stroke-width="4" stroke-linejoin="round"' if halo else ""
        self.add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{FONT}" font-size="{size}" text-anchor="{anchor}" '
                 f'dominant-baseline="{baseline}" font-weight="{weight}" fill="{color}"{st}{hl}>{escape(s)}</text>')

    def path(self, d, w=STROKE, color="#000", fill="none", dash=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{w}" stroke-linejoin="round"{ds}/>')

    def arrow(self, x1, y1, x2, y2, w=STROKE, color="#000", head=10):
        self.line(x1, y1, x2, y2, w, color)
        ang = math.atan2(y2 - y1, x2 - x1)
        a1 = (x2 - head * math.cos(ang - 0.4), y2 - head * math.sin(ang - 0.4))
        a2 = (x2 - head * math.cos(ang + 0.4), y2 - head * math.sin(ang + 0.4))
        self.add(f'<path d="M{x2:.2f},{y2:.2f} L{a1[0]:.2f},{a1[1]:.2f} L{a2[0]:.2f},{a2[1]:.2f} Z" fill="{color}"/>')

    def render(self) -> str:
        meta = ""
        if self.titel:
            meta += f"<title>{escape(self.titel)}</title>"
        if self.beschreibung:
            meta += f"<desc>{escape(self.beschreibung)}</desc>"
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                f'{meta}<rect width="100%" height="100%" fill="#fff"/>' + "".join(self.parts) + "</svg>\n")


# ------------------------------------------------------------------ Schaltzeichen
def _seg(svg: SVG, x1, y1, x2, y2, body: float):
    """Zeichnet Zuleitungen bis zum Bauteilkörper; gibt Mittelpunkt und Richtung zurück."""
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    horiz = abs(y2 - y1) < 1e-6
    if horiz:
        sgn = 1 if x2 > x1 else -1
        svg.line(x1, y1, mx - sgn * body / 2, my)
        svg.line(mx + sgn * body / 2, my, x2, y2)
    else:
        sgn = 1 if y2 > y1 else -1
        svg.line(x1, y1, mx, my - sgn * body / 2)
        svg.line(mx, my + sgn * body / 2, x2, y2)
    return mx, my, horiz


def lampe(svg: SVG, x1, y1, x2, y2, label="", r=15):
    mx, my, horiz = _seg(svg, x1, y1, x2, y2, 2 * r)
    svg.circle(mx, my, r)
    d = r / math.sqrt(2)
    svg.line(mx - d, my - d, mx + d, my + d)
    svg.line(mx - d, my + d, mx + d, my - d)
    if label:
        if horiz:
            svg.text(mx, my - r - 14, label, italic=True)
        else:
            svg.text(mx + r + 10, my, label, anchor="start", italic=True)


def widerstand(svg: SVG, x1, y1, x2, y2, label="", l=44, b=16):
    mx, my, horiz = _seg(svg, x1, y1, x2, y2, l)
    if horiz:
        svg.rect(mx - l / 2, my - b / 2, l, b)
        if label:
            svg.text(mx, my - b / 2 - 13, label, italic=True)
    else:
        svg.rect(mx - b / 2, my - l / 2, b, l)
        if label:
            svg.text(mx + b / 2 + 9, my, label, anchor="start", italic=True)


def messgeraet(svg: SVG, x1, y1, x2, y2, buchstabe="A", label="", r=15):
    mx, my, horiz = _seg(svg, x1, y1, x2, y2, 2 * r)
    svg.circle(mx, my, r)
    svg.text(mx, my + 1, buchstabe, size=17, weight="bold")
    if label:
        if horiz:
            svg.text(mx, my - r - 13, label, italic=True)
        else:
            svg.text(mx + r + 9, my, label, anchor="start", italic=True)


def spannungsquelle(svg: SVG, x1, y1, x2, y2, label="", plus_zuerst=True):
    """Gleichspannungsquelle: langer dünner Strich (+), kurzer dicker Strich (−)."""
    gap = 10
    mx, my, horiz = _seg(svg, x1, y1, x2, y2, gap)
    lang, kurz = 34, 18
    if horiz:
        a, b = (mx - gap / 2, mx + gap / 2) if plus_zuerst else (mx + gap / 2, mx - gap / 2)
        svg.line(a, my - lang / 2, a, my + lang / 2, w=STROKE)
        svg.line(b, my - kurz / 2, b, my + kurz / 2, w=STROKE * 2.6, cap="butt")
        svg.text(a - 9, my - lang / 2 - 4, "+", size=16)
        svg.text(b + 9, my - lang / 2 - 4, "−", size=18)
        if label:
            svg.text(mx, my + lang / 2 + 16, label, italic=True)
    else:
        a, b = (my - gap / 2, my + gap / 2) if plus_zuerst else (my + gap / 2, my - gap / 2)
        svg.line(mx - lang / 2, a, mx + lang / 2, a, w=STROKE)
        svg.line(mx - kurz / 2, b, mx + kurz / 2, b, w=STROKE * 2.6, cap="butt")
        svg.text(mx + lang / 2 + 9, a - 5, "+", size=16)
        svg.text(mx + kurz / 2 + 9, b + 8, "−", size=18)
        if label:
            svg.text(mx - lang / 2 - 10, my, label, anchor="end", italic=True, size=17)


def schalter(svg: SVG, x1, y1, x2, y2, label="", geschlossen=False, l=40):
    mx, my, horiz = _seg(svg, x1, y1, x2, y2, l)
    if horiz:
        sx, ex = mx - l / 2, mx + l / 2
        svg.dot(sx, my, 3)
        if geschlossen:
            svg.line(sx, my, ex, my)
        else:
            svg.line(sx, my, ex - 2, my - 18)
        svg.line(ex, my - 6, ex, my) if not geschlossen else None
        if label:
            svg.text(mx, my + 18, label, italic=True)
    else:
        sy, ey = my - l / 2, my + l / 2
        svg.dot(mx, sy, 3)
        svg.line(mx, sy, mx + (0 if geschlossen else 18), ey - (0 if geschlossen else 2))
        if label:
            svg.text(mx - 14, my, label, anchor="end", italic=True)


def wire(svg: SVG, *pts):
    d = "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts)
    svg.path(d)


# ------------------------------------------------------------------ Schaltpläne
def einfacher_stromkreis() -> SVG:
    s = SVG(420, 300, "Einfacher Stromkreis", "Schaltplan: Spannungsquelle, Schalter und Lampe in einem geschlossenen Stromkreis (Schaltzeichen nach DIN EN 60617).")
    L, R, T, B = 80, 340, 70, 230
    spannungsquelle(s, L, B, L, T, "U")
    schalter(s, L, T, R, T, "S")
    lampe(s, R, T, R, B, "L")
    wire(s, (R, B), (L, B))
    return s


def reihenschaltung_lampen() -> SVG:
    s = SVG(500, 300, "Reihenschaltung zweier Lampen", "Schaltplan: Spannungsquelle und zwei Lampen L1 und L2 hintereinander (in Reihe) geschaltet.")
    L, R, T, B = 80, 420, 70, 230
    spannungsquelle(s, L, B, L, T, "U")
    wire(s, (L, T), (150, T))
    lampe(s, 150, T, 250, T, "L₁")
    lampe(s, 250, T, 350, T, "L₂")
    wire(s, (350, T), (R, T), (R, B), (L, B))
    return s


def parallelschaltung_lampen() -> SVG:
    s = SVG(500, 320, "Parallelschaltung zweier Lampen", "Schaltplan: Spannungsquelle mit zwei parallel geschalteten Lampen L1 und L2; Verzweigungspunkte (Knoten) als Punkte markiert.")
    L, X1, X2, T, B = 80, 260, 400, 70, 250
    spannungsquelle(s, L, B, L, T, "U")
    wire(s, (L, T), (X2, T))
    wire(s, (L, B), (X2, B))
    lampe(s, X1, T, X1, B, "L₁")
    lampe(s, X2, T, X2, B, "L₂")
    s.dot(X1, T)
    s.dot(X1, B)
    return s


def parallelschaltung_lampen_messung() -> SVG:
    s = SVG(560, 340, "Parallelschaltung zweier Lampen mit Strommessung",
            "Schaltplan: Gesamtstrom I wird vor dem Verzweigungspunkt gemessen, die Teilströme I1 und I2 in den Zweigen mit L1 und L2 (Knotenregel I = I1 + I2).")
    L, X1, X2, T, B = 70, 300, 470, 70, 270
    spannungsquelle(s, L, B, L, T, "U")
    messgeraet(s, L, T, 220, T, "A", "I")
    wire(s, (220, T), (X2, T))
    wire(s, (L, B), (X2, B))
    messgeraet(s, X1, T, X1, 160, "A", "I₁")
    lampe(s, X1, 160, X1, B, "L₁")
    messgeraet(s, X2, T, X2, 160, "A", "I₂")
    lampe(s, X2, 160, X2, B, "L₂")
    s.dot(X1, T)
    s.dot(X1, B)
    return s


def reihenschaltung_widerstaende_spannung() -> SVG:
    s = SVG(560, 340, "Reihenschaltung zweier Widerstände mit Spannungsmessung",
            "Schaltplan: Zwei Widerstände R1 und R2 in Reihe; Spannungsmessgeräte messen die Teilspannungen U1 und U2 (Maschenregel U = U1 + U2), ein Strommessgerät den Strom I.")
    L, R, T, B = 70, 490, 110, 280
    spannungsquelle(s, L, B, L, T, "U")
    messgeraet(s, L, T, 170, T, "A", "")
    s.text(140, T + 30, "I", italic=True)
    widerstand(s, 170, T, 300, T, "")
    widerstand(s, 300, T, 430, T, "")
    s.text(235, T + 26, "R₁", italic=True)
    s.text(365, T + 26, "R₂", italic=True)
    wire(s, (430, T), (R, T), (R, B), (L, B))
    # Spannungsmessgeräte oberhalb, parallel zu R1 bzw. R2
    for xa, xb, lab in ((185, 285, "U₁"), (315, 415, "U₂")):
        wire(s, (xa, T), (xa, 50))
        wire(s, (xb, T), (xb, 50))
        messgeraet(s, xa, 50, xb, 50, "V", "")
        s.text((xa + xb) / 2, 22, lab, italic=True)
        s.dot(xa, T)
        s.dot(xb, T)
    return s


def parallelschaltung_widerstaende() -> SVG:
    s = SVG(520, 320, "Parallelschaltung zweier Widerstände", "Schaltplan: Zwei Widerstände R1 und R2 parallel an einer Spannungsquelle; an beiden liegt dieselbe Spannung U.")
    L, X1, X2, T, B = 80, 280, 430, 70, 250
    spannungsquelle(s, L, B, L, T, "U")
    wire(s, (L, T), (X2, T))
    wire(s, (L, B), (X2, B))
    widerstand(s, X1, T, X1, B, "R₁")
    widerstand(s, X2, T, X2, B, "R₂")
    s.dot(X1, T)
    s.dot(X1, B)
    return s


# ------------------------------------------------------------------ Koordinatensysteme
class Koordinatensystem:
    def __init__(self, svg: SVG, xmin, xmax, ymin, ymax, x0=50, y0=30, x1=None, y1=None, einheit=1):
        self.svg = svg
        self.xmin, self.xmax, self.ymin, self.ymax = xmin, xmax, ymin, ymax
        self.px0, self.py0 = x0, y0
        self.px1 = x1 if x1 is not None else svg.w - 30
        self.py1 = y1 if y1 is not None else svg.h - 40
        self.einheit = einheit

    def X(self, x):
        return self.px0 + (x - self.xmin) / (self.xmax - self.xmin) * (self.px1 - self.px0)

    def Y(self, y):
        return self.py1 - (y - self.ymin) / (self.ymax - self.ymin) * (self.py1 - self.py0)

    def zeichne(self, gitter=True, xlabel="x", ylabel="y"):
        s = self.svg
        if gitter:
            for gx in range(math.ceil(self.xmin), math.floor(self.xmax) + 1):
                s.line(self.X(gx), self.Y(self.ymin), self.X(gx), self.Y(self.ymax), w=0.8, color="#c8c8c8", cap="butt")
            for gy in range(math.ceil(self.ymin), math.floor(self.ymax) + 1):
                s.line(self.X(self.xmin), self.Y(gy), self.X(self.xmax), self.Y(gy), w=0.8, color="#c8c8c8", cap="butt")
        s.arrow(self.X(self.xmin), self.Y(0), self.X(self.xmax) + 12, self.Y(0), w=1.6)
        s.arrow(self.X(0), self.Y(self.ymin), self.X(0), self.Y(self.ymax) - 12, w=1.6)
        s.text(self.X(self.xmax) + 14, self.Y(0) - 14, xlabel, italic=True, size=18)
        s.text(self.X(0) + 16, self.Y(self.ymax) - 10, ylabel, italic=True, size=18)
        for gx in range(math.ceil(self.xmin), math.floor(self.xmax) + 1):
            if gx == 0 or gx == self.xmax:
                continue
            s.line(self.X(gx), self.Y(0) - 4, self.X(gx), self.Y(0) + 4, w=1.4)
            s.text(self.X(gx), self.Y(0) + 16, str(gx).replace("-", "−"), size=13)
        for gy in range(math.ceil(self.ymin), math.floor(self.ymax) + 1):
            if gy == 0 or gy == self.ymax:
                continue
            s.line(self.X(0) - 4, self.Y(gy), self.X(0) + 4, self.Y(gy), w=1.4)
            s.text(self.X(0) - 8, self.Y(gy), str(gy).replace("-", "−"), size=13, anchor="end")
        s.text(self.X(0) - 8, self.Y(0) + 14, "0", size=13, anchor="end")

    def graph(self, f, a=None, b=None, color="#1f4fbf", w=2.6, n=400, dash=None):
        a = self.xmin if a is None else a
        b = self.xmax if b is None else b
        pts, seg = [], []
        for i in range(n + 1):
            x = a + (b - a) * i / n
            try:
                y = f(x)
            except (ValueError, ZeroDivisionError):
                y = None
            if y is None or not (self.ymin - 0.5 <= y <= self.ymax + 0.5):
                if len(seg) > 1:
                    pts.append(seg)
                seg = []
                continue
            seg.append((self.X(x), self.Y(y)))
        if len(seg) > 1:
            pts.append(seg)
        for sg in pts:
            self.svg.path("M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in sg), w=w, color=color, dash=dash)


def normalparabel_und_verschoben() -> SVG:
    s = SVG(560, 520, "Normalparabel und verschobene Normalparabel",
            "Koordinatensystem mit der Normalparabel y = x² (Scheitelpunkt S(0|0)) und der verschobenen Normalparabel y = (x − 2)² − 1 mit Scheitelpunkt S(2|−1); gestrichelt die Symmetrieachse x = 2.")
    k = Koordinatensystem(s, -4, 5, -2, 7, x0=40, y0=30, x1=530, y1=490)
    k.zeichne()
    k.graph(lambda x: x * x, color="#000", w=2.6)
    k.graph(lambda x: (x - 2) ** 2 - 1, color="#1f4fbf", w=2.6, dash="9 5")
    s.line(k.X(2), k.Y(-2), k.X(2), k.Y(7), w=1.2, color="#1f4fbf", dash="3 4")
    s.dot(k.X(0), k.Y(0), 5)
    s.dot(k.X(2), k.Y(-1), 5, color="#1f4fbf")
    s.text(k.X(0) + 8, k.Y(0) + 34, "S(0|0)", anchor="start", size=14)
    s.text(k.X(2) + 12, k.Y(-1) + 4, "S(2|−1)", anchor="start", size=14, color="#1f4fbf")
    s.text(k.X(-2.55) - 4, k.Y(6.6), "y = x²", anchor="end", size=16, italic=True)
    s.text(k.X(4.75), k.Y(5.6), "y = (x − 2)² − 1", anchor="end", size=16, italic=True, color="#1f4fbf")
    return s


def steigungsdreieck() -> SVG:
    s = SVG(520, 460, "Steigungsdreieck einer linearen Funktion",
            "Graph der linearen Funktion y = 0,5x + 1 mit Steigungsdreieck: Δx = 2 nach rechts, Δy = 1 nach oben, also Steigung m = Δy/Δx = 0,5; y-Achsenabschnitt b = 1.")
    k = Koordinatensystem(s, -3, 6, -2, 5, x0=40, y0=30, x1=490, y1=430)
    k.zeichne()
    k.graph(lambda x: 0.5 * x + 1, color="#000", w=2.6)
    x1, x2 = 1, 3
    y1, y2 = 1.5, 2.5
    s.path(f"M{k.X(x1):.2f},{k.Y(y1):.2f} L{k.X(x2):.2f},{k.Y(y1):.2f} L{k.X(x2):.2f},{k.Y(y2):.2f}", w=2.4, color="#c0392b")
    s.text((k.X(x1) + k.X(x2)) / 2, k.Y(y1) + 18, "Δx = 2", size=15, color="#c0392b")
    s.text(k.X(x2) + 8, (k.Y(y1) + k.Y(y2)) / 2, "Δy = 1", size=15, anchor="start", color="#c0392b")
    s.dot(k.X(0), k.Y(1), 5)
    s.text(k.X(0) - 30, k.Y(1) - 16, "b = 1", size=14, anchor="end")
    s.text(k.X(5.8), k.Y(4.4), "y = 0,5x + 1", anchor="end", size=16, italic=True)
    s.text(k.X(5.8), k.Y(-1.2), "m = Δy : Δx = 1 : 2 = 0,5", anchor="end", size=15)
    return s


def schraeger_wurf(v0=14.0, alpha_deg=50.0, g=9.81) -> SVG:
    a = math.radians(alpha_deg)
    vx, vy = v0 * math.cos(a), v0 * math.sin(a)
    T = 2 * vy / g
    W = vx * T
    H = vy * vy / (2 * g)
    s = SVG(640, 400, "Schräger Wurf ohne Luftwiderstand",
            f"Bahnkurve (Wurfparabel) eines schräg geworfenen Körpers: Abwurfgeschwindigkeit v0 unter dem Winkel α mit den Komponenten v0x und v0y, Wurfhöhe h und Wurfweite w. Berechnet für v0 = {v0:g} m/s, α = {alpha_deg:g}°, g = 9,81 m/s².")
    k = Koordinatensystem(s, 0, W * 1.08, 0, H * 1.45, x0=60, y0=40, x1=610, y1=350)
    s.arrow(k.X(0), k.Y(0), k.X(W * 1.08) + 12, k.Y(0), w=1.6)
    s.arrow(k.X(0), k.Y(0), k.X(0), k.Y(H * 1.45) - 12, w=1.6)
    s.text(k.X(W * 1.08) + 6, k.Y(0) + 20, "x", italic=True, size=17)
    s.text(k.X(0) - 16, k.Y(H * 1.45) - 8, "y", italic=True, size=17)
    k.graph(lambda x: x * math.tan(a) - g * x * x / (2 * vx * vx), 0, W, color="#000", w=2.6)
    # Geschwindigkeitspfeil und Komponenten (Pfeillänge skaliert)
    sc = 0.32 * W / v0
    s.arrow(k.X(0), k.Y(0), k.X(vx * sc), k.Y(vy * sc), w=2.6, color="#c0392b")
    s.arrow(k.X(0), k.Y(0), k.X(vx * sc), k.Y(0), w=2, color="#1f4fbf")
    s.arrow(k.X(0), k.Y(0), k.X(0), k.Y(vy * sc), w=2, color="#1f4fbf")
    s.line(k.X(vx * sc), k.Y(0), k.X(vx * sc), k.Y(vy * sc), w=1, color="#1f4fbf", dash="4 4")
    s.line(k.X(0), k.Y(vy * sc), k.X(vx * sc), k.Y(vy * sc), w=1, color="#1f4fbf", dash="4 4")
    s.text(k.X(vx * sc) + 10, k.Y(vy * sc) - 10, "v₀", anchor="start", size=17, color="#c0392b", italic=True)
    s.text(k.X(vx * sc / 2), k.Y(0) + 20, "v₀ₓ", size=15, color="#1f4fbf", italic=True)
    s.text(k.X(0) - 10, k.Y(vy * sc / 2), "v₀ᵧ", size=15, anchor="end", color="#1f4fbf", italic=True)
    r = 46
    s.path(f"M{k.X(0) + r:.2f},{k.Y(0):.2f} A{r},{r} 0 0 0 {k.X(0) + r * math.cos(a):.2f},{k.Y(0) - r * math.sin(a):.2f}", w=1.5)
    s.text(k.X(0) + r + 12, k.Y(0) - 16, "α", size=16, italic=True)
    # Wurfhöhe und Wurfweite
    xs = W / 2
    s.line(k.X(xs), k.Y(0), k.X(xs), k.Y(H), w=1.3, dash="6 4")
    s.text(k.X(xs) + 8, k.Y(H / 2), "h", anchor="start", size=17, italic=True)
    s.dot(k.X(xs), k.Y(H), 4)
    yw = k.Y(0) + 32
    s.arrow(k.X(W / 2), yw, k.X(0), yw, w=1.3, head=8)
    s.arrow(k.X(W / 2), yw, k.X(W), yw, w=1.3, head=8)
    s.text(k.X(W / 2), yw + 14, "w", size=17, italic=True)
    s.dot(k.X(W), k.Y(0), 4)
    return s


GRAFIKEN = {
    "einfacher_stromkreis": (einfacher_stromkreis, "ph.elektrizitaet.stromkreis", [5, 8], "Stromkreis,Schaltplan,Schalter,Lampe,Spannungsquelle,DIN-Schaltzeichen", "simple circuit,circuit diagram,switch,lamp"),
    "reihenschaltung_lampen": (reihenschaltung_lampen, "ph.elektrizitaet.reihe_parallel", [6, 9], "Reihenschaltung,Serienschaltung,zwei Lampen,Schaltplan", "series circuit,two lamps"),
    "parallelschaltung_lampen": (parallelschaltung_lampen, "ph.elektrizitaet.reihe_parallel", [6, 9], "Parallelschaltung,zwei Lampen parallel,Verzweigung,Knoten,Schaltplan", "parallel circuit,two lamps in parallel"),
    "parallelschaltung_lampen_messung": (parallelschaltung_lampen_messung, "ph.elektrizitaet.reihe_parallel", [8, 10], "Parallelschaltung,Knotenregel,Teilströme,Strommessgerät,Amperemeter", "parallel circuit,Kirchhoff current law,ammeter"),
    "reihenschaltung_widerstaende_spannung": (reihenschaltung_widerstaende_spannung, "ph.elektrizitaet.reihe_parallel", [8, 10], "Reihenschaltung,Widerstände,Maschenregel,Teilspannungen,Spannungsmessgerät,Voltmeter", "series resistors,voltage divider,voltmeter,Kirchhoff voltage law"),
    "parallelschaltung_widerstaende": (parallelschaltung_widerstaende, "ph.elektrizitaet.reihe_parallel", [8, 10], "Parallelschaltung,Widerstände,Ersatzwiderstand,Schaltplan", "resistors in parallel"),
    "normalparabel_verschoben": (normalparabel_und_verschoben, "ma.funktionen.quadratisch", [9, 10], "Normalparabel,Scheitelpunkt,Scheitelpunktform,Verschiebung,Symmetrieachse,Parabel", "parabola,vertex form,translation"),
    "steigungsdreieck": (steigungsdreieck, "ma.funktionen.linear", [7, 9], "Steigungsdreieck,Steigung,lineare Funktion,y-Achsenabschnitt,Gerade", "slope triangle,linear function,gradient"),
    "schraeger_wurf": (schraeger_wurf, "ph.mechanik.wurf.schraeg", [10, 11], "schräger Wurf,schiefer Wurf,Wurfparabel,Wurfweite,Wurfhöhe,Geschwindigkeitskomponenten,Abwurfwinkel", "projectile motion,launch angle,range,maximum height,velocity components"),
}
