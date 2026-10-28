#!/usr/bin/env python3
"""Erzeugt data/levels/campaign.json mit 100 Leveln.

Die Level sind reine Daten: Karte (Vorlage + Regionsanzahl), Gegner, Startbedingungen.
Neue Level können direkt in der JSON-Datei ergänzt werden; dieses Skript ist nur
eine bequeme Art, die Schwierigkeitskurve zu erzeugen.  Aufruf:
    python3 tools/build_campaign.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "levels", "campaign.json")
MAPS = os.path.join(ROOT, "data", "maps")

ROTATION = ["germany", "australia", "south_america", "fantasy_archipelago", "africa", "europe",
            "north_america", "fantasy_crescent", "asia", "world"]
DIFF_FACTOR = {"easy": 1.0, "medium": 1.12, "hard": 1.28, "very_hard": 1.4}
TUTORIAL = {1: "drag", 2: "tap", 3: "multi", 4: "ratio", 6: "zoom"}


def max_regions(map_id):
    with open(os.path.join(MAPS, map_id + ".json"), encoding="utf-8") as f:
        return len(json.load(f)["regions"])


def lerp(a, b, t):
    return a + (b - a) * t


def level(n, usage):
    """Schwierigkeitskurve für Level n (1..100)."""
    tpl = ROTATION[(n - 1) % len(ROTATION)]
    cap = max_regions(tpl)
    enemies = []
    start_mode = "edge"
    prod = 1.0
    speed = 1.0
    neutral = [4, 12]
    player_starts = 1
    enemy_starts = 1
    bonus = 0
    start_troops = 20
    enemy_troops = 20
    restrict = False

    if n <= 10:
        # Einführung: kleine Karten, einfache Gegner
        regions = 5 + (n - 1) * 5 // 9
        if n == 1:
            enemies = []
        elif n < 10:
            enemies = ["easy"]
        else:
            enemies = ["easy", "easy"]
        neutral = [3, 8 + n // 2]
        enemy_troops = 12 + n
    elif n <= 25:
        t = (n - 11) / 14
        regions = round(lerp(10, 18, t))
        enemies = ["easy", "medium"] if n % 3 == 0 else (["medium"] if n % 3 == 1 else ["easy", "easy"])
        if n >= 20:
            enemies = ["medium", "medium"] if n % 2 == 0 else ["easy", "medium"]
        prod = round(lerp(1.1, 1.3, t), 2)
        start_mode = "center" if n % 4 == 0 else "edge"
        neutral = [5, 14]
        enemy_troops = 20
        bonus = 1 if n in (12, 18, 24) else 0
    elif n <= 50:
        t = (n - 26) / 24
        regions = round(lerp(16, 26, t))
        k = n % 4
        if k == 0:
            enemies = ["medium", "medium", "hard"]
        elif k == 1:
            enemies = ["medium", "hard"]
        elif k == 2:
            enemies = ["hard", "easy", "medium"]
        else:
            enemies = ["medium", "medium"]
        if n >= 40:
            enemies = [("hard" if d == "medium" else d) for d in enemies]
        prod = 1.3
        start_mode = ["edge", "center", "random"][n % 3]
        neutral = [6, 18] if n % 5 else [12, 25]
        enemy_starts = 2 if n % 6 == 0 else 1
        enemy_troops = 22
        bonus = 1 if n % 6 == 0 else (2 if n in (35, 45) else 0)
        restrict = n in (33, 47)
    else:
        t = (n - 51) / 49
        regions = round(lerp(22, 40, t)) if n <= 95 else 50
        k = n % 5
        if k == 0:
            enemies = ["very_hard", "hard", "hard"]
        elif k == 1:
            enemies = ["hard", "hard", "medium"]
        elif k == 2:
            enemies = ["hard", "very_hard"]
        elif k == 3:
            enemies = ["hard", "hard", "hard"]
        else:
            enemies = ["very_hard", "hard", "medium"]
        if n >= 80:
            enemies = [("very_hard" if d == "hard" else ("hard" if d == "medium" else d)) for d in enemies]
        prod = round(lerp(1.3, 1.5, t), 2)
        speed = round(lerp(1.0, 1.15, t), 2)
        start_mode = ["edge", "center", "random", "edge"][n % 4]
        neutral = [8, 20] if n % 4 else [14, 30]
        enemy_starts = 2 if n % 3 == 0 else 1
        player_starts = 2 if n % 7 == 0 else 1
        enemy_troops = 24
        bonus = 1 + (n - 51) // 15
        if n % 5 == 0:
            bonus += 1
        restrict = n % 10 == 7

    if n > 10:
        # nur Vorlagen, die genug Regionen haben (große Level brauchen große Karten)
        fitting = [m for m in ROTATION if max_regions(m) >= regions]
        if not fitting:
            fitting = ["world"]
        # die am seltensten genutzte passende Karte, damit sich die Vorlagen abwechseln
        tpl = min(fitting, key=lambda m: (usage.get(m, 0), (ROTATION.index(m) - n) % len(ROTATION)))
        cap = max_regions(tpl)
    regions = max(4, min(regions, cap))
    usage[tpl] = usage.get(tpl, 0) + 1
    total_starts = player_starts + len(enemies) * enemy_starts
    if total_starts + 2 > regions:
        enemy_starts = 1
    factions = [2, 3, 4]
    diff = max([DIFF_FACTOR[d] for d in enemies], default=0.9)
    par = int(round((15 + regions * 4.5) * (1 + 0.1 * len(enemies)) * diff / 5.0)) * 5
    entry = {
        "id": n,
        "map": {"template": tpl, "regions": regions},
        "seed": n * 7919 + 13,
        "player_start_mode": start_mode,
        "player_starts": player_starts,
        "enemies": [{"faction": factions[i], "ai": d, "starts": enemy_starts} for i, d in enumerate(enemies)],
        "start_troops": start_troops,
        "enemy_start_troops": enemy_troops,
        "neutral_troops": neutral,
        "bonus_slots": bonus,
        "production_mult": prod,
        "speed_mult": speed,
        "restrict_neighbors": restrict,
        "par_time": par,
    }
    if n in TUTORIAL:
        entry["tutorial"] = TUTORIAL[n]
    return entry


def main():
    usage = {}
    levels = [level(n, usage) for n in range(1, 101)]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write('{\n"_info": "Kampagne. Felder siehe README (Abschnitt Level hinzufügen).",\n"levels": [\n')
        f.write(",\n".join(json.dumps(l, ensure_ascii=False) for l in levels))
        f.write("\n]\n}\n")
    for l in levels[::10] + [levels[-1]]:
        print(l["id"], l["map"], [e["ai"] for e in l["enemies"]], "par", l["par_time"], "bonus", l["bonus_slots"])


if __name__ == "__main__":
    main()
