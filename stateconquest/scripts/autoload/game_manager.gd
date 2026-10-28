extends Node
## Steuert den Ablauf zwischen Menüs und Partien und verbucht Ergebnisse
## (Münzen, Sterne, Bestzeiten, Freischaltungen, Statistik).

var current_setup: Dictionary = {}
var last_result: Dictionary = {}


func start(setup: Dictionary) -> void:
	if setup.is_empty():
		return
	current_setup = setup
	UIManager.goto("game", {"setup": setup})


func start_campaign(n: int) -> void:
	n = clampi(n, 1, LevelManager.count())
	start(LevelManager.campaign_setup(n))


func continue_campaign() -> void:
	var n := clampi(int(SaveManager.data.progress.get("current", 1)), 1, mini(SaveManager.unlocked_level(), LevelManager.count()))
	start_campaign(n)


func start_endless(round_no: int = 1, run_seed: int = 0) -> void:
	if run_seed == 0:
		run_seed = randi() % 100000 + 1
	start(LevelManager.endless_setup(round_no, run_seed))


func restart() -> void:
	var s := current_setup.duplicate(true)
	match str(s.get("mode", "")):
		"campaign":
			s = LevelManager.campaign_setup(int(s.level_id))
		"endless":
			s = LevelManager.endless_setup(int(s.round), int(s.run_seed))
		"free", "sandbox":
			s.player_mods = UpgradeManager.player_mods(s.get("options", {}).get("upgrades", {})) if s.mode == "sandbox" else UpgradeManager.player_mods()
	start(s)


## Startet das logisch nächste Spiel nach einem Sieg.
func next() -> void:
	match str(current_setup.get("mode", "")):
		"campaign":
			var n := int(current_setup.level_id) + 1
			if n > LevelManager.count():
				UIManager.goto("level_select")
			else:
				start_campaign(n)
		"endless":
			start_endless(int(current_setup.round) + 1, int(current_setup.run_seed))
		_:
			var s := current_setup.duplicate(true)
			s.seed = randi() % 1000000 + 1
			start(s)


## result: {won, time, captured, lost, sent, regions}
## Gibt die Belohnung zurück: {coins, stars, first_clear, new_best, unlocked, best_round}
func finish(result: Dictionary) -> Dictionary:
	last_result = result
	var mode := str(current_setup.get("mode", ""))
	var rc: Dictionary = Config.game.get("rewards", {})
	var reward := {"coins": 0, "stars": 0, "first_clear": false, "new_best": false, "unlocked": 0}
	var won := bool(result.get("won", false))
	var mult := UpgradeManager.coin_multiplier()
	var coins := 0.0
	match mode:
		"campaign":
			var n := int(current_setup.level_id)
			var rec: Dictionary = SaveManager.level_record(n).duplicate()
			if won:
				var stars := LevelManager.stars_for(float(result.time), float(current_setup.get("par_time", 120)))
				var first := not bool(rec.get("completed", false))
				coins = float(rc.get("campaign_base", 30)) + float(rc.get("campaign_per_level", 3)) * n + float(rc.get("per_star", 12)) * stars
				if not first:
					coins *= float(rc.get("replay_factor", 0.4))
				reward.stars = stars
				reward.first_clear = first
				if first or float(result.time) < float(rec.get("best_time", INF)):
					reward.new_best = not first
					rec.best_time = snappedf(float(result.time), 0.1)
				rec.stars = maxi(int(rec.get("stars", 0)), stars)
				rec.completed = true
				SaveManager.data.progress.levels[str(n)] = rec
				if first:
					SaveManager.stat_add("levels_completed", 1)
				var next_level := mini(n + 1, LevelManager.count())
				if next_level > SaveManager.unlocked_level():
					SaveManager.data.progress.unlocked = next_level
					reward.unlocked = next_level
				SaveManager.data.progress.current = next_level
			else:
				coins = float(rc.get("defeat_per_capture", 2)) * int(result.get("captured", 0))
				SaveManager.data.progress.current = n
		"endless":
			var r := int(current_setup.round)
			if won:
				coins = float(rc.get("endless_base", 25)) + float(rc.get("endless_per_round", 10)) * r
				if r > int(SaveManager.data.endless.get("best_round", 0)):
					SaveManager.data.endless.best_round = r
					reward.new_best = true
			else:
				coins = float(rc.get("defeat_per_capture", 2)) * int(result.get("captured", 0))
			reward.best_round = int(SaveManager.data.endless.get("best_round", 0))
		"free":
			if won:
				coins = float(rc.get("free_play_base", 20)) + float(rc.get("free_play_per_region", 2)) * int(result.get("regions", 0))
		"sandbox":
			coins = 0.0
	reward.coins = int(round(coins * mult)) if mode != "sandbox" else 0
	if mode != "sandbox":
		SaveManager.add_coins(reward.coins)
		var st: Dictionary = SaveManager.data.stats
		st.games = int(st.games) + 1
		if won:
			st.wins = int(st.wins) + 1
		else:
			st.losses = int(st.losses) + 1
		st.territories_captured = int(st.territories_captured) + int(result.get("captured", 0))
		st.units_sent = int(st.units_sent) + int(result.get("sent", 0))
		st.units_lost = int(st.units_lost) + int(result.get("lost", 0))
		st.play_time = float(st.play_time) + float(result.get("time", 0.0))
	SaveManager.save()
	return reward


func is_last_level() -> bool:
	return str(current_setup.get("mode", "")) == "campaign" and int(current_setup.level_id) >= LevelManager.count()
