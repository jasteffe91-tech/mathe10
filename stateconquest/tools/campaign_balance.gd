extends Node
## Balancing: ein KI-Bot spielt jedes Kampagnenlevel anstelle des Spielers.
## Upgrade-Stufen werden mit level/5 angenommen (typischer Fortschritt).
## Aufruf: godot --headless --path . res://tools/campaign_balance.tscn -- [bot-stufe] [von] [bis]


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var bot := "hard" if args.size() < 1 else args[0]
	var from := 1 if args.size() < 2 else int(args[1])
	var to := LevelManager.count() if args.size() < 3 else int(args[2])
	var wins := 0
	var under_par := 0
	for n in range(from, to + 1):
		var setup := LevelManager.campaign_setup(n)
		var lv := n / 5
		setup.player_mods = UpgradeManager.player_mods({"start_troops": lv, "production": lv, "speed": lv, "start_territories": lv, "coin_bonus": lv})
		var s := GameSession.create(setup, Config.game, Config.ai)
		s.ais.append(AIController.new(s.sim, Faction.PLAYER, bot, Config.ai[bot], n))
		var steps := 0
		while s.sim.is_running() and steps < 30 * 900:
			s.step(Simulation.FIXED_DT)
			steps += 1
		var res := "SIEG" if s.sim.state == Simulation.State.WON else ("NIEDERLAGE" if s.sim.state == Simulation.State.LOST else "OFFEN")
		if res == "SIEG":
			wins += 1
			if s.sim.time <= float(setup.par_time):
				under_par += 1
		var diffs := []
		for e in setup.enemies:
			diffs.append(e.ai)
		print("L%3d %-20s %2d Reg %-30s %-10s %5.0f s (Par %d)" % [n, setup.map.template, s.sim.territories.size(), ",".join(diffs), res, s.sim.time, setup.par_time])
	print("Bot %s: %d/%d gewonnen, %d unter Par" % [bot, wins, to - from + 1, under_par])
	get_tree().quit()
