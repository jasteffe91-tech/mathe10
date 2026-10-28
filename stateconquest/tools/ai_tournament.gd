extends Node
## Balancing-Werkzeug: lässt KI-Stufen gegeneinander antreten.
## Aufruf: godot --headless --path . res://tools/ai_tournament.tscn -- [spiele]


func _ready() -> void:
	var games := 20
	var pairs: Array = []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("pairs="):
			for pr in a.substr(6).split(","):
				pairs.append(pr.split(":"))
		else:
			games = int(a)
	var diffs := AIController.DIFFICULTIES
	if pairs.is_empty():
		for i in diffs.size():
			for j in range(i + 1, diffs.size()):
				pairs.append([diffs[j], diffs[i]])
	for pr in pairs:
		if true:
			var strong: String = pr[0]
			var weak: String = pr[1]
			var wins := 0
			var draws := 0
			var t := 0.0
			for g in games:
				var setup := {"map": {"random": true, "regions": 10 + (g % 4) * 4}, "seed": 5000 + g * 37,
					"player_start_mode": "random", "enemies": [{"faction": 2, "ai": weak}], "start_troops": 20,
					"neutral_troops": [3, 12]}
				var s := GameSession.create(setup, Config.game, Config.ai)
				s.ais.append(AIController.new(s.sim, Faction.PLAYER, strong, Config.ai[strong], 700 + g))
				var steps := 0
				while s.sim.is_running() and steps < 30 * 420:
					s.step(Simulation.FIXED_DT)
					steps += 1
				t += s.sim.time
				if s.sim.state == Simulation.State.WON:
					wins += 1
				elif s.sim.is_running():
					draws += 1
					if s.sim.strength(Faction.PLAYER) > s.sim.strength(Faction.RED):
						wins += 1
			print("%-10s vs %-10s  %2d/%d Siege (%d offen), Ø %.0f s" % [strong, weak, wins, games, draws, t / games])
	get_tree().quit()
