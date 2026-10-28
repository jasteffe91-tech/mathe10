#!/usr/bin/env python3
"""Erzeugt die Kartenvorlagen in data/maps/*.json.

Die Umrisse sind eigene, grob vereinfachte Nachzeichnungen (Längen-/Breitengrad).
Jede Region ist ein Startpunkt; das Spiel zerlegt die Landmassen daraus per
Voronoi in unregelmäßige Gebiete. Aufruf:  python3 tools/build_maps.py
"""
import json
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "maps")

# ------------------------------------------------------------------ Hilfen


def pip(pt, poly):
    x, y = pt
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                inside = not inside
    return inside


def seg_intersect(a, b, c, d):
    def ccw(p, q, r):
        return (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0])
    d1, d2 = ccw(c, d, a), ccw(c, d, b)
    d3, d4 = ccw(a, b, c), ccw(a, b, d)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def self_intersections(poly):
    n = len(poly)
    bad = []
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            c, d = poly[j], poly[(j + 1) % n]
            if seg_intersect(a, b, c, d):
                bad.append((i, j))
    return bad


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        p = points[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == 0 and dy == 0:
            d = math.hypot(p[0] - a[0], p[1] - a[1])
        else:
            d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / math.hypot(dx, dy)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = rdp(points[: idx + 1], eps)
        right = rdp(points[idx:], eps)
        return left[:-1] + right
    return [a, b]


def simplify_ring(ring, eps):
    if eps <= 0:
        return ring
    # Ring an der westlichsten Stelle aufschneiden, vereinfachen, schließen
    out = rdp(ring + [ring[0]], eps)[:-1]
    return out if len(out) >= 4 else ring


def shift(points, dx=0.0, dy=0.0):
    return [[round(p[0] + dx, 3), round(p[1] + dy, 3)] for p in points]


def blob(cx, cy, rx, ry, rng, n=56, rough=0.18):
    amps = [rng.uniform(0, rough / (k - 1)) for k in range(2, 8)]
    phases = [rng.uniform(0, 2 * math.pi) for _ in range(2, 8)]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1.0 + sum(amps[k] * math.sin((k + 2) * a + phases[k]) for k in range(len(amps)))
        r = max(0.55, min(1.4, r))
        pts.append([round(cx + math.cos(a) * rx * r, 1), round(cy + math.sin(a) * ry * r, 1)])
    return pts


def poisson_regions(lands, counts, rng, prefix):
    regions = []
    for li, (land, count) in enumerate(zip(lands, counts)):
        xs = [p[0] for p in land]
        ys = [p[1] for p in land]
        area = abs(sum(land[i][0] * land[(i + 1) % len(land)][1] - land[(i + 1) % len(land)][0] * land[i][1] for i in range(len(land)))) / 2
        min_d = math.sqrt(area / count) * 0.8
        pts = []
        tries = 0
        while len(pts) < count:
            tries += 1
            if tries > 400:
                tries = 0
                min_d *= 0.92
            p = (rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys)))
            if not pip(p, land):
                continue
            # Abstand zur Küste
            near = min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in land)
            if near < min_d * 0.4:
                continue
            if all(math.hypot(p[0] - q[0], p[1] - q[1]) >= min_d for q in pts):
                pts.append(p)
        for p in pts:
            regions.append({"id": "%s%d" % (prefix, len(regions) + 1), "name": "", "pos": [round(p[0], 1), round(p[1], 1)]})
    return regions


# ------------------------------------------------------------------ Umrisse (lon, lat)

GERMANY = [
    (7.0, 53.6), (8.0, 53.7), (8.6, 53.9), (8.9, 54.3), (8.6, 54.9), (9.4, 54.85), (10.0, 54.7),
    (10.9, 54.4), (11.0, 54.0), (12.1, 54.2), (13.0, 54.45), (13.6, 54.6), (14.2, 53.9), (14.4, 53.3),
    (14.1, 52.8), (14.6, 52.5), (14.7, 51.8), (15.0, 51.1), (14.3, 50.9), (13.3, 50.6), (12.3, 50.2),
    (12.5, 49.7), (13.5, 48.9), (13.8, 48.6), (13.0, 48.2), (12.8, 47.7), (13.0, 47.5), (11.0, 47.4),
    (10.2, 47.3), (9.6, 47.5), (8.6, 47.65), (7.6, 47.6), (7.6, 48.3), (8.2, 48.97), (6.4, 49.2),
    (6.1, 49.5), (6.4, 50.3), (6.0, 50.8), (6.1, 51.4), (5.95, 51.8), (6.8, 52.0), (7.0, 52.4),
    (7.1, 53.0),
]
GERMANY_REGIONS = [
    ("sh", "Schleswig-Holstein", 9.7, 54.25), ("hh", "Hamburg", 10.0, 53.55), ("ni", "Niedersachsen", 9.2, 52.7),
    ("hb", "Bremen", 8.3, 53.3), ("mv", "Mecklenburg-Vorpommern", 12.6, 53.75), ("be", "Berlin", 13.4, 52.5),
    ("bb", "Brandenburg", 13.9, 51.95), ("st", "Sachsen-Anhalt", 11.7, 52.0), ("sn", "Sachsen", 13.2, 51.05),
    ("th", "Thüringen", 11.0, 50.85), ("he", "Hessen", 9.0, 50.6), ("nw", "Nordrhein-Westfalen", 7.5, 51.5),
    ("rp", "Rheinland-Pfalz", 7.3, 49.95), ("sl", "Saarland", 6.95, 49.4), ("bw", "Baden-Württemberg", 9.0, 48.6),
    ("by", "Bayern", 11.6, 48.9),
]

EU_WEST_NORTH = [  # Gibraltar -> Frankreich -> Benelux -> Dänemark -> Ostsee -> Skandinavien -> Murmansk
    (-5.6, 36.0), (-6.3, 36.8), (-7.4, 37.2), (-8.9, 37.0), (-8.8, 38.5), (-9.5, 38.8), (-8.9, 40.0),
    (-8.8, 41.9), (-9.3, 43.0), (-8.0, 43.7), (-5.0, 43.5), (-1.8, 43.4), (-1.2, 44.6), (-1.1, 46.2),
    (-2.2, 47.2), (-4.7, 48.0), (-4.5, 48.6), (-1.6, 48.7), (-1.3, 49.7), (0.2, 49.5), (1.6, 50.2),
    (2.5, 51.1), (3.6, 51.4), (4.5, 52.3), (4.8, 53.0), (6.9, 53.4), (8.6, 53.9), (8.6, 55.0),
    (8.1, 56.5), (8.6, 57.1), (10.6, 57.7), (10.3, 56.5), (10.6, 55.6), (9.9, 54.9), (10.9, 54.3),
    (12.1, 54.2), (14.2, 53.9), (16.5, 54.5), (18.6, 54.7), (19.9, 54.9), (21.1, 55.7), (21.0, 56.8),
    (23.5, 57.0), (24.3, 57.2), (23.6, 58.5), (23.5, 59.2), (28.0, 59.5), (29.5, 60.1), (27.0, 60.5),
    (25.0, 60.2), (22.0, 60.0), (21.4, 61.0), (21.6, 63.0), (24.5, 64.8), (25.4, 65.4), (22.0, 65.8),
    (21.0, 64.5), (19.0, 63.5), (17.5, 62.4), (17.1, 60.7), (18.8, 59.8), (18.0, 59.3), (16.6, 57.0),
    (16.2, 56.2), (14.3, 55.5), (12.9, 55.4), (12.6, 56.2), (11.9, 57.7), (11.2, 59.0), (10.5, 59.5),
    (8.0, 58.1), (5.6, 58.9), (5.0, 60.5), (5.2, 62.0), (7.0, 62.8), (10.0, 63.8), (12.5, 66.0),
    (14.5, 68.0), (18.0, 69.6), (24.0, 71.0), (28.5, 70.8), (31.0, 70.0), (33.0, 69.3),
]
EU_EAST_EDGE = [(40.0, 67.5), (42.0, 60.0), (42.0, 52.0), (40.0, 47.5)]
EU_BLACKSEA_NORTH = [  # Rostow -> Krim -> Odessa -> Bosporus (europäische Seite)
    (39.0, 47.2), (37.5, 47.0), (35.4, 46.4), (36.5, 45.3), (34.0, 44.5), (33.5, 44.6), (32.6, 45.4),
    (33.6, 46.1), (32.0, 46.5), (30.7, 46.5), (29.7, 45.2), (28.6, 43.9), (28.0, 42.0), (28.9, 41.15),
]
EU_SOUTH = [  # Ägäis -> Griechenland -> Adria -> Italien -> Riviera -> Spanien -> Gibraltar
    (26.0, 40.6), (24.0, 40.8), (22.9, 40.6), (23.5, 39.0), (24.0, 38.0), (22.6, 36.5), (21.5, 37.0),
    (21.1, 38.3), (20.2, 39.6), (19.4, 40.4), (19.5, 41.8), (18.5, 42.5), (16.0, 43.5), (15.0, 44.5),
    (13.7, 45.1), (13.5, 45.7), (12.3, 45.4), (12.4, 44.2), (13.6, 43.5), (14.2, 42.4), (16.1, 41.9),
    (17.0, 40.9), (18.5, 40.1), (17.2, 40.4), (16.6, 39.0), (16.0, 38.0), (15.6, 38.3), (15.6, 40.1),
    (14.3, 40.8), (12.5, 41.7), (11.0, 42.5), (10.3, 43.5), (8.8, 44.4), (7.5, 43.8), (6.0, 43.1),
    (4.6, 43.4), (3.0, 43.0), (3.2, 42.0), (0.8, 41.0), (-0.3, 39.5), (0.2, 38.8), (-0.7, 37.6),
    (-2.1, 36.7), (-4.4, 36.7),
]
UK = [(-5.7, 50.1), (-3.0, 50.7), (1.4, 51.2), (1.7, 52.6), (0.3, 53.5), (-0.2, 54.2), (-1.5, 55.0),
      (-2.0, 55.8), (-2.6, 56.3), (-1.8, 57.6), (-3.0, 58.6), (-5.0, 58.6), (-6.2, 57.5), (-5.6, 56.4),
      (-4.9, 55.0), (-3.0, 54.9), (-3.4, 54.4), (-3.0, 53.4), (-4.6, 53.3), (-4.1, 52.3), (-5.2, 51.8),
      (-3.2, 51.4), (-4.2, 51.2)]
IRELAND = [(-6.0, 52.2), (-6.1, 53.9), (-5.5, 54.6), (-7.3, 55.3), (-8.4, 54.6), (-10.0, 54.2),
           (-9.8, 53.4), (-10.2, 51.8), (-9.0, 51.5), (-6.4, 52.1)]
SICILY = [(12.4, 37.8), (13.4, 38.2), (15.6, 38.3), (15.1, 36.7), (14.0, 37.0)]
SARDINIA = [(8.4, 39.0), (9.6, 39.1), (9.8, 40.9), (9.2, 41.3), (8.2, 40.9)]

EUROPE_REGIONS = [
    ("pt", "Portugal", -8.0, 39.6), ("es", "Spanien", -3.7, 40.2), ("es_s", "Andalusien", -4.6, 37.6),
    ("fr", "Frankreich", 2.3, 47.0), ("fr_s", "Südfrankreich", 2.0, 44.2), ("gb", "England", -1.5, 52.6),
    ("sco", "Schottland", -4.2, 57.0), ("ie", "Irland", -8.0, 53.2), ("bnl", "Benelux", 5.0, 51.2),
    ("de", "Deutschland", 10.0, 51.0), ("dk", "Dänemark", 9.3, 56.0), ("no", "Norwegen", 8.8, 61.3),
    ("no_n", "Nordnorwegen", 15.5, 67.5), ("se", "Schweden", 15.0, 62.0), ("se_s", "Südschweden", 14.5, 57.5),
    ("fi", "Finnland", 26.0, 62.8), ("pl", "Polen", 19.4, 52.0), ("cz", "Tschechien", 15.4, 49.8),
    ("ch", "Schweiz", 8.2, 46.8), ("at", "Österreich", 14.5, 47.5), ("it_n", "Norditalien", 10.5, 45.3),
    ("it", "Italien", 12.8, 42.6), ("it_s", "Süditalien", 16.2, 39.8), ("sic", "Sizilien", 14.2, 37.5),
    ("sar", "Sardinien", 9.0, 40.0), ("hu", "Ungarn", 19.2, 47.2), ("ro", "Rumänien", 25.0, 45.8),
    ("rs", "Serbien", 20.8, 43.8), ("hr", "Kroatien", 17.0, 44.6), ("gr", "Griechenland", 22.0, 39.5),
    ("bg", "Bulgarien", 25.2, 42.7), ("ua", "Ukraine", 31.0, 49.0), ("by", "Belarus", 28.0, 53.5),
    ("balt", "Baltikum", 24.5, 56.5), ("ru", "Westrussland", 37.0, 56.0), ("kar", "Karelien", 33.5, 64.0),
    ("ru_s", "Südrussland", 38.5, 50.5),
]

ASIA_MAIN = [  # Nordküste Sibirien -> Pazifik -> Südostasien -> Indien -> Arabien -> Levante -> Anatolien
    (66.0, 69.0), (70.0, 73.0), (73.0, 72.5), (80.0, 73.5), (90.0, 75.5), (100.0, 77.0), (104.0, 77.5),
    (113.0, 73.5), (125.0, 73.5), (130.0, 71.0), (140.0, 72.5), (150.0, 71.5), (160.0, 69.5), (170.0, 70.0),
    (179.5, 68.8), (179.5, 65.0), (178.0, 62.5), (170.0, 60.0), (163.5, 59.5), (163.0, 57.0), (160.0, 53.0),
    (156.5, 51.0), (156.0, 57.0), (160.0, 61.5), (151.0, 59.5), (143.0, 59.3), (137.0, 54.5), (141.5, 53.0),
    (141.0, 48.5), (138.0, 46.0), (132.5, 43.0), (129.5, 41.0), (128.0, 38.6), (129.4, 36.0), (129.3, 35.2),
    (126.5, 34.5), (126.2, 37.0), (125.0, 37.8), (124.5, 40.0), (121.5, 39.0), (121.8, 40.8), (119.0, 39.2),
    (117.8, 38.9), (119.0, 37.2), (122.5, 37.2), (120.3, 36.0), (119.2, 34.5), (120.9, 32.0), (121.9, 30.8),
    (121.5, 28.5), (119.6, 25.5), (116.5, 23.0), (114.2, 22.3), (110.5, 21.0), (108.0, 21.5), (106.6, 20.5),
    (105.8, 19.0), (107.0, 17.0), (108.8, 15.3), (109.3, 12.5), (107.0, 10.5), (105.0, 8.6), (104.8, 10.4),
    (103.0, 11.0), (101.0, 12.7), (100.5, 13.5), (99.2, 10.5), (100.4, 7.2), (101.5, 6.5), (103.4, 4.0),
    (104.2, 1.4), (103.5, 1.3), (101.3, 2.9), (100.3, 5.4), (98.3, 8.0), (98.6, 10.5), (97.7, 16.5),
    (96.0, 16.8), (94.3, 16.0), (94.3, 18.8), (92.4, 20.7), (91.8, 22.4), (90.5, 22.0), (88.5, 21.7),
    (86.9, 21.0), (85.0, 19.5), (82.3, 16.6), (80.2, 13.0), (79.8, 10.3), (77.5, 8.1), (76.3, 9.9),
    (74.8, 12.9), (73.5, 16.0), (72.8, 19.0), (72.6, 21.5), (70.0, 20.8), (69.0, 22.4), (67.0, 24.8),
    (62.0, 25.2), (57.5, 25.7), (56.3, 27.1), (52.5, 27.4), (50.5, 29.2), (48.5, 30.0), (48.0, 29.4),
    (49.6, 27.0), (50.6, 25.0), (51.5, 24.2), (54.4, 24.4), (56.2, 25.7), (56.4, 26.3), (56.4, 24.5),
    (58.5, 23.6), (59.8, 22.4), (57.8, 19.0), (55.0, 17.0), (52.2, 15.6), (48.8, 14.0), (45.0, 12.8),
    (43.4, 12.7), (42.7, 15.5), (41.2, 19.0), (39.2, 21.5), (37.2, 24.5), (35.2, 28.0), (34.9, 29.5),
    (34.3, 27.9), (32.9, 29.8), (32.8, 31.1), (34.5, 31.6), (35.0, 33.0), (35.8, 35.0), (36.0, 36.6),
    (34.6, 36.8), (32.5, 36.1), (30.6, 36.8), (28.5, 36.6), (27.3, 37.8), (26.3, 39.0), (26.5, 40.3),
    (29.1, 41.0),
]
ASIA_BLACKSEA_SOUTH = [(31.5, 41.2), (35.0, 42.0), (37.0, 41.2), (41.5, 41.5)]
ASIA_WEST_EDGE = [(45.0, 46.0), (52.0, 47.0), (58.0, 51.0), (60.0, 58.0), (62.0, 66.0)]
CAUCASUS_COAST = [(40.0, 43.4), (37.5, 44.8), (38.3, 46.6)]
ARCTIC_RUSSIA = [(41.0, 67.0), (44.0, 68.4), (53.0, 68.6), (60.0, 69.5)]
JAPAN = [(130.0, 33.5), (130.2, 31.3), (131.6, 31.5), (132.0, 33.0), (133.0, 33.0), (135.0, 33.5),
         (136.8, 34.3), (138.8, 34.6), (140.0, 35.0), (140.9, 36.9), (141.5, 38.4), (142.0, 39.5),
         (141.4, 41.4), (140.0, 40.5), (139.8, 39.0), (138.5, 37.8), (136.8, 37.3), (135.5, 35.6),
         (132.5, 35.5), (131.0, 34.4)]
HOKKAIDO = [(140.0, 41.5), (141.2, 41.8), (143.2, 42.0), (145.5, 43.3), (144.5, 44.0), (141.8, 45.5),
            (141.5, 43.2), (140.0, 42.8)]
SUMATRA = [(95.3, 5.6), (97.8, 5.2), (100.4, 2.2), (103.8, -1.0), (106.0, -3.2), (105.8, -5.8),
           (104.5, -5.9), (102.3, -4.0), (100.3, -1.0), (98.6, 1.7)]
BORNEO = [(109.0, 1.6), (109.6, -1.0), (110.3, -3.0), (114.5, -3.8), (116.5, -2.5), (117.5, 0.5),
          (118.8, 1.0), (119.2, 5.3), (117.0, 7.0), (115.5, 5.5), (113.0, 3.2), (111.0, 1.8)]
SRI_LANKA = [(79.8, 9.8), (81.9, 7.5), (81.4, 6.1), (80.1, 6.0), (79.8, 8.0)]
LUZON = [(120.0, 18.5), (122.2, 18.5), (122.0, 16.0), (124.0, 13.0), (122.5, 13.0), (120.5, 14.5), (120.0, 16.3)]

ASIA_REGIONS = [
    ("tr", "Türkei", 34.0, 39.0), ("lev", "Levante", 36.6, 33.0), ("iq", "Irak", 43.5, 33.0),
    ("sa", "Arabien", 44.0, 24.5), ("arab_s", "Südarabien", 50.0, 18.0), ("ir", "Iran", 54.0, 32.5),
    ("cau", "Kaukasus", 46.0, 42.5), ("kz", "Kasachstan", 67.0, 48.0), ("uz", "Zentralasien", 62.0, 39.5),
    ("af", "Afghanistan", 66.0, 34.0), ("pk", "Pakistan", 69.5, 29.5), ("in_n", "Nordindien", 79.0, 26.0),
    ("in_s", "Südindien", 77.5, 16.0), ("bd", "Bengalen", 88.0, 24.0), ("sib_w", "Westsibirien", 73.0, 60.0),
    ("sib_m", "Mittelsibirien", 98.0, 63.0), ("sib_o", "Ostsibirien", 125.0, 64.0), ("fe", "Fernost", 152.0, 64.0),
    ("kam", "Kamtschatka", 160.0, 57.0), ("mn", "Mongolei", 103.0, 46.5), ("xj", "Xinjiang", 84.0, 41.5),
    ("tib", "Tibet", 88.0, 32.0), ("cn_n", "Nordchina", 113.0, 38.0), ("cn_s", "Südchina", 112.0, 26.0),
    ("man", "Mandschurei", 126.0, 46.0), ("kr", "Korea", 127.5, 37.0), ("mm", "Myanmar", 96.0, 21.5),
    ("th", "Indochina", 102.5, 16.0), ("vn", "Vietnam", 107.0, 13.5), ("my", "Malaya", 102.0, 4.0),
    ("sum", "Sumatra", 101.5, -0.5), ("bor", "Borneo", 114.0, 0.5), ("ph", "Philippinen", 121.2, 16.0),
    ("jp_w", "Westjapan", 133.0, 34.6), ("jp_o", "Ostjapan", 139.6, 37.4), ("hok", "Hokkaido", 142.8, 43.4),
    ("lk", "Sri Lanka", 80.7, 7.8), ("ural", "Ural", 62.5, 57.0),
]

NORTH_AMERICA = [
    (-165.0, 60.5), (-168.0, 65.5), (-163.0, 67.0), (-166.0, 68.8), (-156.0, 71.3), (-141.0, 69.7),
    (-129.0, 70.0), (-115.0, 68.8), (-108.0, 68.0), (-95.0, 68.5), (-90.0, 68.5), (-90.0, 64.0),
    (-94.0, 59.0), (-92.0, 57.0), (-85.0, 55.2), (-82.0, 52.5), (-79.0, 51.5), (-78.0, 55.0), (-77.0, 58.0),
    (-78.0, 62.5), (-73.0, 61.0), (-70.0, 59.0), (-65.0, 60.3), (-61.5, 56.0), (-60.0, 55.0), (-56.0, 52.0),
    (-57.0, 51.4), (-60.0, 50.2), (-66.0, 50.2), (-64.5, 49.0), (-64.0, 48.0), (-65.0, 47.0), (-61.0, 45.5),
    (-66.0, 43.8), (-70.0, 43.5), (-70.5, 41.7), (-74.0, 40.6), (-75.0, 39.0), (-76.0, 37.0), (-75.5, 35.2),
    (-79.0, 33.5), (-81.0, 31.5), (-80.0, 26.5), (-80.4, 25.2), (-81.8, 26.5), (-82.8, 28.5), (-84.0, 30.0),
    (-88.0, 30.3), (-89.5, 29.2), (-94.0, 29.6), (-97.3, 27.5), (-97.5, 24.0), (-97.3, 21.5), (-96.0, 19.2),
    (-94.0, 18.2), (-91.0, 18.6), (-90.4, 21.0), (-87.5, 21.5), (-88.0, 18.5), (-88.3, 16.0), (-85.0, 16.0),
    (-83.3, 15.0), (-83.7, 11.0), (-82.0, 9.0), (-79.5, 9.5), (-77.4, 8.6), (-78.0, 7.2), (-80.4, 7.3),
    (-83.0, 8.3), (-85.7, 10.0), (-87.5, 13.0), (-91.4, 13.9), (-94.5, 16.1), (-96.5, 15.7), (-100.0, 17.0),
    (-104.5, 19.2), (-105.6, 20.5), (-106.4, 23.2), (-109.0, 25.8), (-111.0, 27.9), (-112.8, 30.5),
    (-114.8, 31.8), (-113.0, 29.0), (-112.0, 27.0), (-110.4, 24.2), (-109.5, 23.0), (-112.0, 24.8),
    (-114.1, 27.7), (-115.9, 30.4), (-117.1, 32.5), (-118.5, 34.0), (-120.6, 34.6), (-122.5, 37.7),
    (-124.2, 40.4), (-124.0, 46.2), (-124.7, 48.4), (-123.0, 49.0), (-125.5, 50.5), (-128.0, 52.0),
    (-130.5, 54.5), (-133.0, 57.0), (-137.0, 58.5), (-140.0, 59.8), (-146.0, 60.5), (-151.0, 59.5),
    (-154.0, 57.5), (-158.0, 56.5), (-162.0, 55.0), (-160.5, 58.5),
]
GREENLAND = [(-73.0, 78.0), (-60.0, 82.0), (-30.0, 83.5), (-20.0, 81.0), (-18.0, 76.0), (-22.0, 70.0),
             (-32.0, 68.0), (-40.0, 65.0), (-43.0, 60.0), (-48.0, 61.0), (-52.0, 64.5), (-54.0, 67.0),
             (-56.0, 71.0), (-66.0, 76.0)]
CUBA = [(-85.0, 21.9), (-82.5, 23.1), (-80.0, 23.1), (-77.5, 21.8), (-74.2, 20.2), (-77.5, 19.9), (-80.5, 21.8)]
NEWFOUNDLAND = [(-59.3, 47.6), (-55.5, 51.5), (-53.0, 49.5), (-52.7, 47.5), (-55.5, 46.8)]
NA_REGIONS = [
    ("ak", "Alaska", -152.0, 64.0), ("yt", "Yukon", -136.0, 64.0), ("nt", "Nordwest-Territorien", -118.0, 65.0),
    ("nu", "Nunavut", -97.0, 64.5), ("bc", "British Columbia", -124.0, 54.5), ("ab", "Alberta", -114.5, 55.0),
    ("sk", "Saskatchewan", -106.0, 54.0), ("mb", "Manitoba", -97.5, 55.0), ("on", "Ontario", -86.0, 50.0),
    ("qc", "Québec", -72.0, 52.0), ("atl", "Atlantik-Kanada", -65.5, 46.5), ("nl", "Neufundland", -56.0, 49.0),
    ("gl", "Grönland", -42.0, 72.0), ("pnw", "Pazifischer Nordwesten", -120.0, 45.5), ("ca", "Kalifornien", -119.5, 37.0),
    ("sw", "Südwesten", -111.0, 34.0), ("mt", "Rocky Mountains", -108.0, 42.5), ("pl", "Great Plains", -99.0, 41.0),
    ("tx", "Texas", -99.0, 31.5), ("mw", "Mittlerer Westen", -89.0, 42.0), ("so", "Der Süden", -87.0, 33.5),
    ("fl", "Florida", -82.0, 28.5), ("ne", "Nordosten", -75.0, 42.5), ("ma", "Mittelatlantik", -79.0, 37.5),
    ("mx_n", "Nordmexiko", -105.0, 27.0), ("mx_s", "Südmexiko", -99.0, 19.0), ("cam", "Mittelamerika", -87.0, 14.5),
    ("pa", "Panama", -81.5, 9.0), ("cu", "Kuba", -79.0, 21.8),
]

SOUTH_AMERICA = [
    (-77.3, 8.6), (-75.5, 10.5), (-72.0, 12.3), (-71.5, 10.8), (-68.0, 10.5), (-64.0, 10.7), (-61.5, 10.5),
    (-60.7, 8.5), (-57.0, 6.0), (-54.0, 5.7), (-51.5, 4.2), (-50.0, 1.8), (-49.2, -0.5), (-48.0, -1.2),
    (-44.5, -2.5), (-41.0, -2.9), (-38.5, -3.7), (-35.2, -5.5), (-34.8, -8.0), (-37.0, -11.0), (-39.0, -14.0),
    (-39.2, -17.5), (-40.9, -21.8), (-43.2, -23.0), (-46.4, -24.0), (-48.6, -26.5), (-48.8, -28.5),
    (-51.0, -31.0), (-52.5, -33.5), (-54.9, -34.9), (-57.4, -35.8), (-56.7, -36.4), (-57.8, -38.2),
    (-62.3, -38.8), (-62.8, -40.8), (-65.0, -41.0), (-64.5, -42.5), (-65.5, -45.0), (-67.5, -46.5),
    (-65.8, -47.8), (-68.5, -50.2), (-68.4, -52.4), (-65.5, -54.6), (-68.0, -55.1), (-71.0, -55.0),
    (-74.5, -52.5), (-75.5, -48.0), (-74.5, -44.0), (-73.8, -41.5), (-73.6, -37.5), (-71.6, -33.0),
    (-71.4, -30.0), (-70.6, -23.5), (-70.3, -18.4), (-71.4, -17.4), (-76.2, -14.0), (-77.1, -12.0),
    (-79.0, -8.5), (-81.2, -5.8), (-80.9, -2.2), (-80.0, 0.0), (-78.9, 1.5), (-77.6, 4.0), (-77.4, 6.6),
]
SA_REGIONS = [
    ("co", "Kolumbien", -73.5, 4.5), ("ve", "Venezuela", -66.0, 7.5), ("gy", "Guayana", -57.5, 4.0),
    ("ec", "Ecuador", -78.3, -1.5), ("pe", "Peru", -75.0, -9.5), ("bo", "Bolivien", -64.7, -16.7),
    ("am", "Amazonas", -63.0, -4.0), ("pa", "Pará", -52.0, -4.0), ("nor", "Nordostbrasilien", -40.0, -8.0),
    ("ce", "Zentralbrasilien", -50.0, -14.0), ("se", "Südostbrasilien", -45.5, -20.5), ("sul", "Südbrasilien", -52.0, -27.5),
    ("py", "Paraguay", -58.0, -23.5), ("uy", "Uruguay", -56.0, -32.8), ("ar_n", "Nordargentinien", -64.0, -27.0),
    ("pam", "Pampa", -63.0, -35.5), ("pat", "Patagonien", -68.5, -44.0), ("fue", "Feuerland", -70.0, -51.5),
    ("cl", "Chile", -69.6, -23.0),
]

AFRICA = [
    (-5.9, 35.8), (-2.0, 35.1), (3.0, 36.8), (10.2, 37.2), (11.1, 35.2), (10.1, 33.8), (11.5, 33.1),
    (15.3, 32.3), (19.5, 30.3), (20.1, 32.1), (23.0, 32.6), (25.2, 31.6), (29.9, 31.2), (32.3, 31.3),
    (32.5, 29.9), (34.0, 27.8), (35.5, 24.0), (37.2, 21.0), (38.5, 18.0), (39.7, 15.5), (43.3, 12.6),
    (43.1, 11.6), (44.5, 10.4), (48.0, 11.2), (51.2, 11.8), (51.0, 10.4), (49.0, 6.5), (47.0, 4.0),
    (43.0, 0.0), (42.2, -0.5), (40.5, -2.5), (39.3, -6.8), (40.4, -10.5), (40.6, -15.0), (36.9, -17.9),
    (35.0, -20.0), (35.5, -23.8), (32.9, -25.9), (32.4, -28.8), (30.0, -31.3), (27.5, -33.4), (25.6, -34.0),
    (20.0, -34.8), (18.4, -34.2), (18.0, -32.0), (16.5, -28.6), (15.0, -26.0), (14.5, -22.9), (12.0, -18.5),
    (11.8, -17.3), (12.4, -13.5), (13.2, -8.8), (12.2, -6.0), (11.8, -4.5), (9.4, 0.3), (9.7, 2.5),
    (9.5, 4.0), (8.4, 4.6), (6.0, 4.3), (3.4, 6.4), (1.2, 6.1), (-1.0, 5.1), (-3.0, 5.0), (-7.5, 4.4),
    (-9.4, 5.4), (-11.5, 6.9), (-13.3, 8.5), (-15.0, 10.8), (-16.7, 12.5), (-17.5, 14.7), (-16.5, 16.5),
    (-16.0, 19.5), (-17.0, 21.0), (-15.0, 24.5), (-13.0, 27.6), (-9.6, 30.4), (-9.3, 32.5), (-6.8, 34.0),
]
MADAGASCAR = [(49.3, -12.0), (50.4, -15.5), (49.4, -18.5), (47.9, -23.0), (47.0, -25.0), (45.2, -25.5),
              (43.7, -23.0), (44.0, -20.0), (44.5, -16.5), (46.5, -15.6), (48.0, -13.4)]
AFRICA_REGIONS = [
    ("ma", "Marokko", -6.5, 32.0), ("mr", "Mauretanien", -11.0, 21.5), ("dz", "Algerien", 2.5, 28.5),
    ("tn", "Tunesien", 9.3, 33.8), ("ly", "Libyen", 17.5, 27.0), ("eg", "Ägypten", 29.5, 26.5),
    ("sd", "Sudan", 30.0, 15.5), ("et", "Äthiopien", 39.5, 9.0), ("so", "Somalia", 46.0, 6.5),
    ("ml", "Mali", -3.0, 17.5), ("ne", "Niger", 9.0, 17.5), ("td", "Tschad", 18.5, 15.5),
    ("sn", "Senegambia", -12.5, 12.0), ("ci", "Guineaküste", -3.5, 8.0), ("ng", "Nigeria", 8.0, 9.5),
    ("cf", "Zentralafrika", 21.0, 6.5), ("cm", "Kamerun", 12.5, 5.0), ("cg", "Kongo", 13.0, -1.0),
    ("cd", "Kongobecken", 23.5, -3.0), ("ke", "Kenia", 37.8, 0.5), ("tz", "Tansania", 34.8, -6.5),
    ("ao", "Angola", 17.5, -12.0), ("zm", "Sambia", 27.5, -14.0), ("mz", "Mosambik", 35.0, -16.5),
    ("na", "Namibia", 17.5, -22.0), ("bw", "Botswana", 26.0, -21.0), ("za", "Südafrika", 24.5, -29.5),
    ("mg", "Madagaskar", 46.8, -19.0),
]

AUSTRALIA = [
    (114.1, -21.8), (116.7, -20.6), (121.0, -19.5), (122.2, -17.9), (124.5, -16.4), (126.0, -14.0),
    (128.0, -15.0), (129.6, -14.9), (130.0, -12.6), (130.8, -12.4), (132.5, -11.5), (136.8, -12.2),
    (135.9, -13.6), (135.5, -15.0), (139.5, -17.5), (141.5, -15.5), (141.6, -12.5), (142.5, -10.7),
    (143.5, -14.0), (145.3, -15.5), (146.0, -18.5), (149.0, -21.0), (150.8, -23.5), (153.1, -25.6),
    (153.6, -28.6), (152.9, -31.5), (151.3, -33.8), (150.1, -36.5), (149.9, -37.6), (147.8, -37.9),
    (146.4, -39.1), (144.9, -37.9), (143.5, -38.8), (141.0, -38.0), (140.0, -37.5), (139.6, -35.8),
    (138.5, -35.6), (138.0, -34.3), (137.6, -35.0), (137.9, -33.0), (136.0, -34.7), (135.1, -34.6),
    (134.0, -32.8), (131.0, -31.5), (126.0, -32.3), (123.5, -33.9), (119.8, -34.0), (117.9, -35.1),
    (115.1, -34.3), (115.7, -32.0), (114.9, -29.0), (113.5, -26.5), (113.7, -24.0),
]
TASMANIA = [(144.6, -40.7), (148.3, -40.9), (148.0, -42.5), (146.9, -43.6), (145.2, -42.2)]
NZ_NORTH = [(172.7, -34.4), (174.5, -35.8), (175.8, -36.8), (178.5, -37.7), (177.9, -39.2), (176.8, -40.0),
            (174.8, -41.4), (174.6, -39.6), (173.8, -39.2), (174.6, -37.5)]
NZ_SOUTH = [(172.7, -40.5), (174.3, -41.7), (173.3, -43.5), (172.8, -43.8), (171.2, -44.3), (170.7, -45.9),
            (169.0, -46.6), (166.5, -46.0), (166.7, -45.2), (168.3, -44.0), (170.5, -42.9), (171.9, -41.7)]
NEW_GUINEA = [(131.0, -1.4), (134.0, -1.0), (138.0, -1.6), (141.0, -2.6), (145.0, -4.5), (147.5, -6.0),
              (150.5, -10.5), (147.0, -10.0), (144.0, -7.8), (141.0, -9.1), (138.0, -8.4), (137.6, -5.0),
              (134.5, -3.8), (132.0, -2.8)]
AU_REGIONS = [
    ("kim", "Kimberley", 126.5, -17.5), ("pil", "Pilbara", 119.5, -22.5), ("gold", "Goldfields", 122.0, -29.0),
    ("per", "Südwesten", 116.6, -31.8), ("top", "Top End", 133.0, -14.5), ("cen", "Zentralaustralien", 133.0, -23.0),
    ("sa_n", "Outback", 135.0, -28.5), ("ade", "Adelaide", 139.0, -33.6), ("cy", "Kap York", 143.3, -15.5),
    ("qld", "Queensland", 144.0, -22.5), ("qld_s", "Südqueensland", 150.0, -26.5), ("nsw", "Neusüdwales", 146.5, -32.0),
    ("vic", "Victoria", 144.5, -37.0), ("tas", "Tasmanien", 146.6, -42.0), ("ng_w", "Westneuguinea", 137.5, -3.6),
    ("png", "Papua", 144.5, -6.5), ("nz_n", "Nordinsel", 175.5, -38.3), ("nz_s", "Südinsel", 170.8, -44.2),
]


# ------------------------------------------------------------------ Kartenaufbau

def lonlat_map(map_id, name_de, name_en, lands, regions, lat0, x_scale=1.0, y_scale=1.0, theme=None):
    return {
        "id": map_id,
        "name": {"de": name_de, "en": name_en},
        "projection": {"type": "lonlat", "lat0": lat0, "x_scale": x_scale, "y_scale": y_scale},
        "landmasses": [[[round(p[0], 3), round(p[1], 3)] for p in lm] for lm in lands],
        "regions": [{"id": r[0], "name": r[1], "pos": [r[2], r[3]]} for r in regions],
        "theme": theme or {},
    }


def eurasia():
    return EU_WEST_NORTH + ARCTIC_RUSSIA + ASIA_MAIN + ASIA_BLACKSEA_SOUTH + CAUCASUS_COAST + EU_BLACKSEA_NORTH + EU_SOUTH


def world_map():
    eps = 0.9
    am = 22.0  # Amerika nach Osten rücken (Atlantik schmaler)

    def s(ring, dx=0.0):
        e = eps
        out = simplify_ring([list(p) for p in ring], e)
        while self_intersections(out) and e > 0.05:
            e *= 0.6
            out = simplify_ring([list(p) for p in ring], e)
        return shift(out, dx)

    lands = [
        s(NORTH_AMERICA, am), s(GREENLAND, am), s(SOUTH_AMERICA, am), s(CUBA, am),
        s(eurasia()), s(AFRICA), s(MADAGASCAR), s(UK), s(JAPAN), s(SUMATRA), s(BORNEO),
        s(AUSTRALIA), s(NEW_GUINEA),
    ]
    regions = [
        ("ak", "Alaska", -152 + am, 64), ("ca_w", "Westkanada", -118 + am, 60), ("ca_o", "Ostkanada", -87 + am, 51),
        ("qc", "Québec", -70 + am, 52), ("us_w", "Westen der USA", -116 + am, 40), ("us_m", "Mittlerer Westen", -97 + am, 41),
        ("us_o", "Ostküste", -79 + am, 39), ("us_s", "Südstaaten", -90 + am, 32), ("mx", "Mexiko", -103 + am, 23),
        ("cam", "Mittelamerika", -87 + am, 14.5), ("gl", "Grönland", -42 + am, 73), ("cu", "Kuba", -79 + am, 21.8),
        ("co", "Kolumbien", -72 + am, 5), ("br_n", "Amazonien", -60 + am, -5), ("br_o", "Ostbrasilien", -44 + am, -11),
        ("br_s", "Südbrasilien", -51 + am, -24), ("pe", "Anden", -72 + am, -14), ("ar", "Argentinien", -65 + am, -36),
        ("gb", "Großbritannien", -2.5, 53.5), ("ib", "Iberien", -4, 40), ("fr", "Westeuropa", 2.5, 47),
        ("de", "Mitteleuropa", 13, 50.5), ("sca", "Skandinavien", 16, 63), ("it", "Südeuropa", 20, 42.5),
        ("ee", "Osteuropa", 30, 52), ("ru", "Russland", 45, 58), ("sib_w", "Westsibirien", 75, 62),
        ("sib_o", "Ostsibirien", 115, 63), ("fe", "Fernost", 150, 64), ("me", "Naher Osten", 40, 34),
        ("arab", "Arabien", 46, 23), ("ir", "Iran", 56, 31), ("kz", "Zentralasien", 68, 45),
        ("in", "Indien", 78, 22), ("cn_w", "Westchina", 88, 35), ("mn", "Mongolei", 104, 46),
        ("cn_o", "Ostchina", 113, 31), ("sea", "Südostasien", 101, 15), ("jp", "Japan", 137, 36.5),
        ("ind", "Indonesien", 113, 0), ("maf", "Nordwestafrika", 0, 27), ("eg", "Ägypten", 26, 26),
        ("waf", "Westafrika", -5, 12), ("caf", "Zentralafrika", 20, 2), ("eaf", "Ostafrika", 38, 3),
        ("saf", "Südliches Afrika", 24, -25), ("mg", "Madagaskar", 46.8, -19), ("au_w", "Westaustralien", 122, -25),
        ("au_o", "Ostaustralien", 142, -26), ("png", "Neuguinea", 141, -5),
    ]
    m = lonlat_map("world", "Weltkarte", "World", lands, regions, 35, 0.9, 1.45)
    return m


def fantasy_archipelago():
    rng = random.Random(4711)
    lands = [
        blob(270, 300, 210, 190, rng), blob(720, 260, 200, 160, rng), blob(520, 700, 230, 200, rng),
        blob(200, 1050, 170, 210, rng), blob(760, 1080, 200, 230, rng), blob(470, 1300, 120, 70, rng, 40),
    ]
    counts = [4, 4, 5, 4, 5, 1]
    regions = poisson_regions(lands, counts, rng, "da")
    names = ["Drachenhort", "Feuerklippe", "Schwefelbucht", "Aschental", "Nordwacht", "Möwenfels", "Sturmkap",
             "Eisenhafen", "Herz der Inseln", "Smaragdbucht", "Rubinküste", "Glutsee", "Leuchtturm", "Südkrone",
             "Nebelhain", "Rabenstein", "Perlhafen", "Muschelstrand", "Korallenring", "Schildkrötenruh",
             "Ankerplatz", "Letzte Zuflucht", "Funkenfels"]
    for i, r in enumerate(regions):
        r["name"] = names[i % len(names)]
    return {"id": "fantasy_archipelago", "name": {"de": "Drachenarchipel", "en": "Dragon Archipelago"},
            "projection": {"type": "xy"}, "landmasses": lands, "regions": regions,
            "theme": {"sea": "#cfe3f0"}}


def fantasy_crescent():
    rng = random.Random(1337)
    # Sichelförmiger Kontinent um eine große Bucht
    pts = []
    n = 64
    for i in range(n + 1):
        a = math.pi * 0.15 + (math.pi * 1.7) * i / n
        r = 560 + 40 * math.sin(a * 5 + 1.3) + 25 * math.sin(a * 9)
        pts.append([500 + math.cos(a) * r * 0.82, 700 + math.sin(a) * r * 1.1])
    inner = []
    for i in range(n + 1):
        a = math.pi * 1.85 - (math.pi * 1.7) * i / n
        r = 250 + 30 * math.sin(a * 4 + 0.4) + 18 * math.sin(a * 11)
        inner.append([560 + math.cos(a) * r * 0.9, 700 + math.sin(a) * r * 1.15])
    crescent = [[round(p[0], 1), round(p[1], 1)] for p in pts + inner]
    islands = [blob(640, 700, 95, 120, rng, 40), blob(910, 200, 70, 90, rng, 36), blob(880, 1260, 80, 70, rng, 36)]
    lands = [crescent] + islands
    regions = poisson_regions(lands, [21, 2, 1, 1], rng, "nr")
    names = ["Nebelmark", "Silberau", "Wolfsheide", "Kronland", "Moorwald", "Grauhafen", "Sternfeld", "Eschenhain",
             "Bernsteinküste", "Schattental", "Hohe Mark", "Lichtung", "Falkenstein", "Seenplatte", "Weidenland",
             "Goldfurt", "Dunkelforst", "Bärenhöhe", "Quellgrund", "Windmühlenland", "Fernmark", "Inselherz",
             "Mondinsel", "Nordfels", "Südinsel"]
    for i, r in enumerate(regions):
        r["name"] = names[i % len(names)]
    return {"id": "fantasy_crescent", "name": {"de": "Nebelreich", "en": "Misty Realm"},
            "projection": {"type": "xy"}, "landmasses": lands, "regions": regions,
            "theme": {"sea": "#d6e4ee"}}


def all_maps():
    return [
        lonlat_map("germany", "Deutschland", "Germany", [GERMANY], GERMANY_REGIONS, 51, 1.0, 1.0),
        lonlat_map("europe", "Europa", "Europe", [EU_WEST_NORTH + EU_EAST_EDGE + EU_BLACKSEA_NORTH + EU_SOUTH,
                   UK, IRELAND, SICILY, SARDINIA], EUROPE_REGIONS, 52, 1.0, 1.05),
        lonlat_map("north_america", "Nordamerika", "North America", [NORTH_AMERICA, GREENLAND, CUBA, NEWFOUNDLAND],
                   NA_REGIONS, 50, 1.0, 1.25),
        lonlat_map("south_america", "Südamerika", "South America", [SOUTH_AMERICA], SA_REGIONS, -20, 1.0, 1.0),
        lonlat_map("africa", "Afrika", "Africa", [AFRICA, MADAGASCAR], AFRICA_REGIONS, 5, 1.0, 1.15),
        lonlat_map("asia", "Asien", "Asia", [ASIA_MAIN + ASIA_BLACKSEA_SOUTH + ASIA_WEST_EDGE, JAPAN, HOKKAIDO,
                   SUMATRA, BORNEO, SRI_LANKA, LUZON], ASIA_REGIONS, 40, 1.0, 1.3),
        lonlat_map("australia", "Australien & Ozeanien", "Australia & Oceania",
                   [AUSTRALIA, TASMANIA, NZ_NORTH, NZ_SOUTH, NEW_GUINEA], AU_REGIONS, -25, 1.0, 1.25),
        world_map(),
        fantasy_archipelago(),
        fantasy_crescent(),
    ]


def check(m):
    ok = True
    lands = m["landmasses"]
    for i, lm in enumerate(lands):
        bad = self_intersections(lm)
        if bad:
            ok = False
            print("  ! %s: Landmasse %d schneidet sich selbst an %s" % (m["id"], i, bad[:4]))
    for r in m["regions"]:
        if not any(pip(r["pos"], lm) for lm in lands):
            ok = False
            print("  ! %s: Region %s (%s) liegt nicht an Land" % (m["id"], r["id"], r["name"]))
    return ok


def main():
    os.makedirs(OUT, exist_ok=True)
    ids = []
    all_ok = True
    for m in all_maps():
        all_ok &= check(m)
        with open(os.path.join(OUT, m["id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, separators=(",", ":"))
        ids.append(m["id"])
        print("%-22s %3d Regionen, %d Landmassen" % (m["id"], len(m["regions"]), len(m["landmasses"])))
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"maps": ids}, f, ensure_ascii=False, indent=1)
    print("OK" if all_ok else "WARNUNGEN – bitte prüfen")


if __name__ == "__main__":
    main()
