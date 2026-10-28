extends Node
## Misst die Rechenzeit pro Simulationsschritt in großen Leveln.
## Aufruf: godot --headless --path . res://tools/perf.tscn


func _ready() -> void:
	for n in [60, 80, 100]:
		var t0 := Time.get_ticks_usec()
		var setup := LevelManager.campaign_setup(n)
		var s := GameSession.create(setup, Config.game, Config.ai)
		var build_ms := (Time.get_ticks_usec() - t0) / 1000.0
		s.ais.append(AIController.new(s.sim, Faction.PLAYER, "very_hard", Config.ai.very_hard, 1))
		var worst := 0.0
		var total := 0.0
		var steps := 0
		var max_units := 0
		while s.sim.is_running() and steps < 30 * 240:
			var a := Time.get_ticks_usec()
			s.step(Simulation.FIXED_DT)
			var d := (Time.get_ticks_usec() - a) / 1000.0
			worst = maxf(worst, d)
			total += d
			steps += 1
			var u := 0
			for m in s.sim.movements:
				u += m.in_flight()
			max_units = maxi(max_units, u)
		print("Level %d: Aufbau %.0f ms, %d Schritte, Ø %.3f ms/Schritt, max %.2f ms, max. %d Einheiten unterwegs" % [n, build_ms, steps, total / steps, worst, max_units])
	get_tree().quit()
