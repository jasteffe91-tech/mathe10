extends Node
## Speichert den gesamten Fortschritt lokal in user://save.json (mit Sicherungskopie).

signal saved

const PATH := "user://save.json"
const BACKUP := "user://save.bak.json"
const VERSION := 1

var data: Dictionary = {}
var path: String = PATH          ## für Tests umstellbar
var backup_path: String = BACKUP


func _init() -> void:
	load_game()


static func defaults() -> Dictionary:
	return {
		"version": VERSION,
		"coins": 0,
		"progress": {"unlocked": 1, "current": 1, "levels": {}},
		"upgrades": {},
		"settings": {"music": true, "sfx": true, "vibration": true, "game_speed": 1.0,
			"language": "", "palette": "standard", "send_ratio": 1},
		"stats": {"games": 0, "wins": 0, "losses": 0, "territories_captured": 0, "units_sent": 0,
			"units_lost": 0, "play_time": 0.0, "coins_earned": 0, "levels_completed": 0},
		"endless": {"best_round": 0},
		"free_play": {},
		"sandbox": {},
	}


func load_game() -> void:
	var loaded: Variant = null
	for p in [path, backup_path]:
		if FileAccess.file_exists(p):
			loaded = JsonUtil.load_file(p, null)
			if loaded is Dictionary:
				break
	if loaded is Dictionary:
		data = JsonUtil.merge(defaults(), _sanitize(loaded))
	else:
		data = defaults()


## Repariert offensichtlich ungültige Werte aus alten oder beschädigten Spielständen.
func _sanitize(d: Dictionary) -> Dictionary:
	if d.has("coins"):
		d.coins = maxi(0, int(d.coins))
	if d.has("progress") and d.progress is Dictionary:
		d.progress.unlocked = clampi(int(d.progress.get("unlocked", 1)), 1, 100000)
		if not d.progress.get("levels", {}) is Dictionary:
			d.progress.levels = {}
	if d.has("upgrades") and d.upgrades is Dictionary:
		for k in d.upgrades.keys():
			d.upgrades[k] = maxi(0, int(d.upgrades[k]))
	return d


func save() -> bool:
	data.version = VERSION
	if FileAccess.file_exists(path):
		DirAccess.copy_absolute(ProjectSettings.globalize_path(path), ProjectSettings.globalize_path(backup_path))
	var ok := JsonUtil.save_file(path, data)
	saved.emit()
	return ok


## Setzt Fortschritt, Münzen, Upgrades und Statistik zurück. Einstellungen bleiben.
func reset_progress() -> void:
	var settings: Dictionary = data.get("settings", {}).duplicate(true)
	data = defaults()
	data.settings = JsonUtil.merge(data.settings, settings)
	save()


# ---------------------------------------------------------------- Bequeme Zugriffe

func coins() -> int:
	return int(data.coins)


func add_coins(n: int) -> void:
	data.coins = maxi(0, int(data.coins) + n)
	if n > 0:
		data.stats.coins_earned = int(data.stats.coins_earned) + n


func spend_coins(n: int) -> bool:
	if n < 0 or int(data.coins) < n:
		return false
	data.coins = int(data.coins) - n
	return true


func level_record(level_id: int) -> Dictionary:
	return data.progress.levels.get(str(level_id), {})


func unlocked_level() -> int:
	return int(data.progress.unlocked)


func stat_add(key: String, v: float) -> void:
	data.stats[key] = data.stats.get(key, 0) + v
