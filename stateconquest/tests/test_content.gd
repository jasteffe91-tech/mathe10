extends TestCase
## Karten, Level und KI.


func test_all_templates_generate() -> void:
	var ids := MapGenerator.template_ids()
	check(ids.size() >= 10, "Mindestens 10 Karten")
	for id in ids:
		var tpl := MapGenerator.load_template(id)
		var data := MapGenerator.from_template(tpl, 0, 3)
		eq(data.regions.size(), tpl.regions.size(), "%s: alle Regionen erzeugt" % id)
		_check_map(data, id)


func test_random_maps_generate() -> void:
	for style in ["continent", "twin", "archipelago"]:
		for n in [6, 18, 36]:
			var data := MapGenerator.random_map(n, n * 31 + 7, style)
			check(data.regions.size() >= n - 1, "Zufallskarte %s/%d: genug Regionen (%d)" % [style, n, data.regions.size()])
			_check_map(data, "random_%s_%d" % [style, n])


func _check_map(data: MapData, id: String) -> void:
	var n := data.regions.size()
	for r in data.regions:
		check(not r.polygons.is_empty(), "%s/%s: Polygon vorhanden" % [id, r.key])
		for p in r.polygons:
			check(not Geometry2D.triangulate_polygon(p).is_empty(), "%s/%s: Polygon gültig" % [id, r.key])
		check(r.area > 0.0, "%s/%s: Fläche > 0" % [id, r.key])
	for lm in data.landmasses:
		check(not Geometry2D.triangulate_polygon(lm).is_empty(), "%s: Landmasse gültig" % id)
	# Nachbarschaftsgraph zusammenhängend
	var seen := {0: true}
	var stack := [0]
	while not stack.is_empty():
		var v: int = stack.pop_back()
		for w in data.regions[v].neighbors:
			if not seen.has(w):
				seen[w] = true
				stack.append(w)
	eq(seen.size(), n, "%s: Nachbarschaftsgraph zusammenhängend" % id)


func test_campaign_has_100_valid_levels() -> void:
	eq(LevelManager.count(), 100, "100 Kampagnenlevel")
	var t0 := Time.get_ticks_msec()
	for n in range(1, LevelManager.count() + 1):
		var setup := LevelManager.campaign_setup(n)
		check(not setup.is_empty(), "Level %d vorhanden" % n)
		var s := GameSession.create(setup, Config.game, Config.ai)
		var sim := s.sim
		check(sim.tm.count_owned(Faction.PLAYER) >= 1, "Level %d: Spieler hat ein Startgebiet" % n)
		for e in setup.enemies:
			check(sim.tm.count_owned(int(e.faction)) >= 1, "Level %d: Gegner %d hat ein Startgebiet" % [n, e.faction])
		check(sim.tm.count_owned(Faction.NEUTRAL) >= 1 or setup.enemies.size() > 0, "Level %d: es gibt etwas zu erobern" % n)
		for t in sim.territories:
			check(t.troops >= 1, "Level %d: Gebiet %s hat Truppen" % [n, t.key])
			for p in t.polygons:
				check(not Geometry2D.triangulate_polygon(p).is_empty(), "Level %d: Polygon %s gültig" % [n, t.key])
		for lm in s.map.landmasses:
			check(not Geometry2D.triangulate_polygon(lm).is_empty(), "Level %d: Landmasse gültig" % n)
	var ms := Time.get_ticks_msec() - t0
	print("    100 Level in %d ms aufgebaut" % ms)
	check(ms < 60000, "Levelaufbau schnell genug")


func test_difficulty_curve() -> void:
	var first := LevelManager.get_level(1)
	var last := LevelManager.get_level(100)
	check(int(first.map.regions) < int(last.map.regions), "Spätere Level sind größer")
	check(first.enemies.size() <= last.enemies.size(), "Spätere Level haben mehr Gegner")
	var diffs := AIController.DIFFICULTIES
	var seen := {}
	for n in range(1, 101):
		for e in LevelManager.get_level(n).enemies:
			seen[e.ai] = true
	for d in diffs:
		check(seen.has(d), "Schwierigkeit %s kommt in der Kampagne vor" % d)


## Unit-Erhaltung in einer echten KI-Partie: Truppen entstehen nur durch Produktion und
## verschwinden nur paarweise im Kampf.
func test_ai_match_invariants() -> void:
	for diff in AIController.DIFFICULTIES:
		var setup := {"map": {"random": true, "regions": 14}, "seed": 77,
			"enemies": [{"faction": 2, "ai": diff}, {"faction": 3, "ai": diff}], "start_troops": 20,
			"neutral_troops": [3, 10]}
		var s := GameSession.create(setup, Config.game, Config.ai)
		s.ais.append(AIController.new(s.sim, Faction.PLAYER, diff, Config.ai[diff], 5))
		var produced_before := 0
		var total0 := total_units(s.sim)
		var steps := 0
		while s.sim.is_running() and steps < 30 * 240:
			s.step(Simulation.FIXED_DT)
			steps += 1
		var produced := 0
		for f in s.sim.factions:
			produced += f.units_produced
		eq(total_units(s.sim), total0 + produced - produced_before - 2 * s.sim.kills, "%s: Truppenbilanz stimmt" % diff)
		for t in s.sim.territories:
			check(t.troops >= 0, "%s: keine negativen Truppen" % diff)
		var decisions := 0
		for ai in s.ais:
			decisions += ai.decisions
		check(decisions > 3, "%s: KI handelt (%d Befehle)" % [diff, decisions])


## Stärkere KI gewinnt gegen schwächere deutlich öfter.
func test_ai_strength_ordering() -> void:
	var pairs := [["hard", "easy"], ["very_hard", "medium"]]
	for pr in pairs:
		var wins := 0
		var games := 6
		for g in games:
			var setup := {"map": {"random": true, "regions": 12, "style": "continent"}, "seed": 1000 + g * 17,
				"player_start_mode": "random", "enemies": [{"faction": 2, "ai": pr[1]}], "start_troops": 20,
				"neutral_troops": [3, 10]}
			var s := GameSession.create(setup, Config.game, Config.ai)
			s.ais.append(AIController.new(s.sim, Faction.PLAYER, pr[0], Config.ai[pr[0]], 900 + g))
			var steps := 0
			while s.sim.is_running() and steps < 30 * 400:
				s.step(Simulation.FIXED_DT)
				steps += 1
			var strong := s.sim.strength(Faction.PLAYER)
			var weak := s.sim.strength(Faction.RED)
			if s.sim.state == Simulation.State.WON or (s.sim.is_running() and strong > weak):
				wins += 1
		print("    %s gegen %s: %d von %d gewonnen" % [pr[0], pr[1], wins, games])
		check(wins >= 4, "%s schlägt %s meistens" % [pr[0], pr[1]])


func test_ai_uses_player_send_ratios() -> void:
	var sim := TestCase.make_sim([[Faction.RED, 37, 0, 0], [Faction.NEUTRAL, 3, 200, 0], [Faction.PLAYER, 5, 900, 900]])
	var ai := AIController.new(sim, Faction.RED, "medium", Config.ai.medium, 3)
	ai.think()
	for m in sim.movements:
		var allowed := []
		for r in Config.send_ratios():
			allowed.append(int(floor(37 * float(r) + 0.000001)))
		check(allowed.has(m.count), "KI sendet nur erlaubte Mengen (%d)" % m.count)
