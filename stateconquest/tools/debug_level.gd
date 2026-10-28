extends Node
## Debug: simuliert ein Kampagnenlevel ohne Spielereingaben und protokolliert den Verlauf.
## Aufruf: godot --headless --path . res://tools/debug_level.tscn -- 60


func _ready() -> void:
	var n := 60
	for a in OS.get_cmdline_user_args():
		n = int(a)
	var setup := LevelManager.campaign_setup(n)
	var s := GameSession.create(setup, Config.game, Config.ai)
	print("Level %d: %s, Regionen %d" % [n, setup.map, s.sim.territories.size()])
	for f in s.active_factions():
		var owned := s.sim.tm.owned_by(f)
		var ids := []
		for t in owned:
			ids.append("%s(%d)" % [t.key, t.troops])
		print("  Fraktion %d: %s" % [f, ", ".join(ids)])
	for sec in 30:
		for k in 30:
			s.step(Simulation.FIXED_DT)
		for e in s.sim.drain_events():
			if e.type in ["capture", "eliminated"]:
				print("  t=%5.1f %s" % [s.sim.time, str(e).replace("\"", "")])
	get_tree().quit()
