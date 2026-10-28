extends Node
## Lädt alle Konfigurationsdateien aus data/config einmal beim Start.

var game: Dictionary = {}
var upgrades: Dictionary = {}
var ai: Dictionary = {}
var colors: Dictionary = {}
var palette_name: String = "standard"


func _init() -> void:
	reload()


func reload() -> void:
	game = JsonUtil.load_file("res://data/config/game.json", {})
	upgrades = JsonUtil.load_file("res://data/config/upgrades.json", {"upgrades": []})
	ai = JsonUtil.load_file("res://data/config/ai.json", {})
	colors = JsonUtil.load_file("res://data/config/colors.json", {})


func send_ratios() -> Array:
	return game.get("send_ratios", [0.25, 0.5, 0.75, 1.0])


func color(key: String, fallback: String = "#ff00ff") -> Color:
	return Color.from_string(str(colors.get(key, fallback)), Color.MAGENTA)


func faction_color(fid: int, dark: bool = false) -> Color:
	var pals: Dictionary = colors.get("palettes", {})
	var pal: Dictionary = pals.get(palette_name, pals.get("standard", {}))
	var entry: Dictionary = pal.get(Faction.COLOR_KEYS[clampi(fid, 0, Faction.COUNT - 1)], {})
	return Color.from_string(str(entry.get("dark" if dark else "fill", "#888888")), Color.GRAY)
