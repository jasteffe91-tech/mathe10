extends Node
## Datengetriebenes Levelsystem: Kampagne aus data/levels/campaign.json sowie
## erzeugte Level für Endlosmodus, freies Spiel und Sandbox.

const FACTION_ORDER := [Faction.RED, Faction.GREEN, Faction.YELLOW]
const SIZE_REGIONS := [8, 14, 22, 32]

var levels: Array = []


func _ready() -> void:
	reload()


func reload() -> void:
	var d: Variant = JsonUtil.load_file("res://data/levels/campaign.json", {"levels": []})
	levels = d.get("levels", []) if d is Dictionary else []
	levels.sort_custom(func(a, b): return int(a.id) < int(b.id))


func count() -> int:
	return levels.size()


func get_level(n: int) -> Dictionary:
	for l in levels:
		if int(l.id) == n:
			return l
	return {}


func campaign_setup(n: int) -> Dictionary:
	var s: Dictionary = get_level(n).duplicate(true)
	if s.is_empty():
		return {}
	s.mode = "campaign"
	s.level_id = n
	s.player_mods = UpgradeManager.player_mods()
	return s


## Endlosmodus: Zufallskarten, Runde für Runde größer und schwerer.
func endless_setup(round_no: int, run_seed: int) -> Dictionary:
	var ec: Dictionary = Config.game.get("endless", {})
	var regions := mini(int(ec.get("base_regions", 8)) + int(ec.get("regions_per_round", 2)) * (round_no - 1), int(ec.get("max_regions", 36)))
	var n_enemies := clampi(1 + (round_no - 1) / 3, 1, 3)
	var top := "easy"
	if round_no >= 10:
		top = "very_hard"
	elif round_no >= 6:
		top = "hard"
	elif round_no >= 3:
		top = "medium"
	var diffs := AIController.DIFFICULTIES
	var enemies: Array = []
	for i in n_enemies:
		var di := maxi(0, diffs.find(top) - (i if i < 2 else 1))
		enemies.append({"faction": FACTION_ORDER[i], "ai": diffs[di], "starts": 1})
	var seed := run_seed * 101 + round_no * 7
	return {
		"mode": "endless", "round": round_no, "run_seed": run_seed,
		"map": {"random": true, "regions": regions, "style": ""},
		"seed": seed, "player_start_mode": ["edge", "random", "center"][round_no % 3],
		"enemies": enemies, "start_troops": 20, "enemy_start_troops": 20 + round_no,
		"neutral_troops": [4 + round_no / 2, 12 + round_no], "bonus_slots": 1 + round_no / 4,
		"production_mult": minf(1.0 + 0.04 * round_no, 1.5), "speed_mult": 1.0,
		"par_time": int(20 + regions * 5.0), "player_mods": UpgradeManager.player_mods(),
	}


## Freies Spiel und Sandbox teilen sich die Optionen.
## opts: size (0-3), map ("random" | Vorlagen-ID), enemies (1-3), difficulty,
## start_troops, production (Faktor), speed (Faktor), restrict (bool)
## Sandbox zusätzlich: upgrades {id: stufe}, neutral_min, neutral_max, player_starts, enemy_starts
func custom_setup(opts: Dictionary, sandbox: bool) -> Dictionary:
	var size := clampi(int(opts.get("size", 1)), 0, SIZE_REGIONS.size() - 1)
	var regions: int = SIZE_REGIONS[size]
	var map_id := str(opts.get("map", "random"))
	var map: Dictionary
	if map_id == "random" or map_id == "":
		map = {"random": true, "regions": regions, "style": str(opts.get("style", ""))}
	else:
		map = {"template": map_id, "regions": mini(regions, MapGenerator.template_region_count(map_id))}
		if bool(opts.get("all_regions", false)):
			map.regions = 0
	var enemies: Array = []
	for i in clampi(int(opts.get("enemies", 1)), 0, 3):
		enemies.append({"faction": FACTION_ORDER[i], "ai": str(opts.get("difficulty", "medium")),
			"starts": int(opts.get("enemy_starts", 1))})
	var start := int(opts.get("start_troops", 20))
	var seed := int(opts.get("seed", 0))
	if seed == 0:
		seed = randi() % 1000000 + 1
	var mods: Dictionary = UpgradeManager.player_mods(opts.get("upgrades", {})) if sandbox else UpgradeManager.player_mods()
	return {
		"mode": "sandbox" if sandbox else "free",
		"map": map, "seed": seed, "player_start_mode": str(opts.get("start_mode", "edge")),
		"player_starts": int(opts.get("player_starts", 1)), "enemies": enemies,
		"start_troops": start, "enemy_start_troops": int(opts.get("enemy_start_troops", start)),
		"neutral_troops": [int(opts.get("neutral_min", 4)), int(opts.get("neutral_max", 14))],
		"bonus_slots": 5 if sandbox else 2,
		"production_mult": float(opts.get("production", 1.0)),
		"speed_mult": float(opts.get("speed", 1.0)),
		"restrict_neighbors": bool(opts.get("restrict", false)),
		"par_time": int(20 + regions * 5.0), "player_mods": mods, "options": opts,
	}


func stars_for(time: float, par: float) -> int:
	var sc: Dictionary = Config.game.get("stars", {})
	if time <= par * float(sc.get("three_star_par_factor", 1.0)):
		return 3
	if time <= par * float(sc.get("two_star_par_factor", 1.6)):
		return 2
	return 1


func setup_title(s: Dictionary) -> String:
	match str(s.get("mode", "")):
		"campaign":
			return I18n.t("level_n", [int(s.level_id)])
		"endless":
			return I18n.t("endless_round", [int(s.round)])
		"free":
			return I18n.t("free_play")
		"sandbox":
			return I18n.t("sandbox")
	return ""


func map_name(s: Dictionary) -> String:
	var m: Dictionary = s.get("map", {})
	if bool(m.get("random", false)):
		return I18n.t("random_map")
	var tpl := MapGenerator.load_template(str(m.get("template", "")))
	var names: Dictionary = tpl.get("name", {})
	return str(names.get(I18n.lang, names.get("de", "")))
