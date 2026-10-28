class_name GameSession
extends RefCounted
## Baut aus einer Level-Beschreibung (setup) eine laufende Partie:
## Karte erzeugen, Simulation anlegen, Startgebiete verteilen, KI-Gegner erstellen.
##
## setup-Felder (alle optional außer map):
##   map: {"template": "europe", "regions": 20} oder {"random": true, "regions": 20, "style": ""}
##   seed, player_start_mode ("edge" | "center" | "random"), player_starts,
##   enemies: [{"faction": 2, "ai": "medium", "starts": 1}],
##   start_troops, enemy_start_troops, neutral_troops: [min, max],
##   bonus_slots, production_mult, speed_mult, restrict_neighbors,
##   player_mods: {production, speed, start_troops, extra_territories, bonus_garrison}

var setup: Dictionary
var map: MapData
var sim: Simulation
var ais: Array[AIController] = []
var player_start: int = -1
var size_factor: PackedFloat32Array = PackedFloat32Array()


static func create(p_setup: Dictionary, game_cfg: Dictionary, ai_cfg: Dictionary) -> GameSession:
	var s := GameSession.new()
	s.setup = p_setup
	s.map = s._make_map()
	s._make_sim(game_cfg)
	s._assign_starts(game_cfg)
	s._make_ais(ai_cfg)
	return s


## Ein fester Simulationsschritt inklusive KI.
func step(dt: float) -> void:
	sim.step(dt)
	for ai in ais:
		ai.update()


func _make_map() -> MapData:
	var m: Dictionary = setup.get("map", {})
	var seed := int(setup.get("seed", 1))
	if bool(m.get("random", false)):
		return MapGenerator.random_map(int(m.get("regions", 12)), seed, str(m.get("style", "")))
	var tpl := MapGenerator.load_template(str(m.get("template", "germany")))
	return MapGenerator.from_template(tpl, int(m.get("regions", 0)), seed)


func _make_sim(cfg: Dictionary) -> void:
	sim = Simulation.new()
	var tc: Dictionary = cfg.get("territory", {})
	var tr: Dictionary = cfg.get("troops", {})
	var mods: Dictionary = setup.get("player_mods", {})
	sim.base_speed = float(tr.get("base_speed", 95.0)) * float(setup.get("speed_mult", 1.0))
	sim.emit_interval_max = float(tr.get("emit_interval_max", 0.085))
	sim.stream_max_duration = float(tr.get("stream_max_duration", 1.1))
	sim.min_travel_time = float(tr.get("min_travel_time", 0.35))
	sim.restrict_neighbors = bool(setup.get("restrict_neighbors", false))
	sim.tm.neutral_production = float(tc.get("neutral_production", 0.0))
	var prod_mult := float(setup.get("production_mult", 1.0))
	for f in sim.factions:
		f.production_mult = prod_mult
	var player := sim.factions[Faction.PLAYER]
	player.production_mult = prod_mult * (1.0 + float(mods.get("production", 0.0)))
	player.speed_mult = 1.0 + float(mods.get("speed", 0.0))

	var avg := map.average_area()
	var smin := float(tc.get("production_size_min", 0.75))
	var smax := float(tc.get("production_size_max", 1.45))
	var base_prod := float(tc.get("base_production", 1.0))
	var base_cap := float(tc.get("base_capacity", 45))
	var cap_size := float(tc.get("capacity_per_size", 30))
	for r in map.regions:
		var t := Territory.new()
		t.key = r.key
		t.display_name = r.name
		t.polygons = r.polygons
		t.center = r.center
		t.area = r.area
		t.neighbors = r.neighbors
		t.landmass = r.landmass
		var sf := clampf(sqrt(r.area / avg), smin, smax)
		size_factor.append(sf)
		t.production_rate = base_prod * sf
		t.capacity = int(round(base_cap + cap_size * (sf - smin) / maxf(smax - smin, 0.01)))
		sim.tm.add(t)


func _assign_starts(cfg: Dictionary) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(setup.get("seed", 1)) * 31 + 7
	var ts := sim.territories
	var n := ts.size()
	var centroid := Vector2.ZERO
	for t in ts:
		centroid += t.center
	centroid /= maxf(n, 1)

	# Startplätze: alle Parteien möglichst gleichmäßig über die Karte verteilen
	var enemies: Array = setup.get("enemies", [])
	var k := enemies.size() + 1
	var mode := str(setup.get("player_start_mode", "edge"))
	var spots: Array = []
	if mode == "center":
		var order: Array = range(n)
		order.sort_custom(func(a, b): return ts[a].center.distance_squared_to(centroid) < ts[b].center.distance_squared_to(centroid))
		spots = _spread_from([order[rng.randi_range(0, mini(1, n - 1))]], k, rng)
	else:
		var best_score := -1.0
		for attempt in 12:
			var cand := _spread_from([rng.randi_range(0, n - 1)], k, rng)
			var score := _min_pair_distance(cand)
			if score > best_score:
				best_score = score
				spots = cand
		if mode == "edge":
			spots.sort_custom(func(a, b): return ts[a].center.distance_squared_to(centroid) > ts[b].center.distance_squared_to(centroid))
		else:
			spots.shuffle()
	player_start = spots[0]
	var mains := {Faction.PLAYER: player_start}
	var taken := {player_start: Faction.PLAYER}
	for i in enemies.size():
		if i + 1 >= spots.size():
			break
		var fid := int(enemies[i].get("faction", 2))
		mains[fid] = spots[i + 1]
		taken[spots[i + 1]] = fid

	# Weitere Startgebiete reihum vergeben
	var want := {Faction.PLAYER: int(setup.get("player_starts", 1))}
	for e in enemies:
		want[int(e.get("faction", 2))] = int(e.get("starts", 1))
	var got := {}
	for f in mains:
		got[f] = 1
	var progress := true
	while progress:
		progress = false
		for f in mains:
			if got[f] >= want.get(f, 1):
				continue
			var extra := _nearest_free(mains[f], taken)
			if extra >= 0:
				taken[extra] = f
				got[f] += 1
				progress = true

	# Zusatz-Startgebiete durch Upgrade D (nur in vorgesehenen Leveln)
	var mods: Dictionary = setup.get("player_mods", {})
	var bonus := mini(int(setup.get("bonus_slots", 0)), int(mods.get("extra_territories", 0)))
	var bonus_ids := {}
	for i in bonus:
		var extra := _nearest_free(player_start, taken)
		if extra < 0:
			break
		taken[extra] = Faction.PLAYER
		bonus_ids[extra] = true

	# Truppen verteilen
	var start_troops := int(setup.get("start_troops", 20))
	var enemy_troops := int(setup.get("enemy_start_troops", start_troops))
	var nr: Array = setup.get("neutral_troops", [5, 15])
	var nfac := float(cfg.get("territory", {}).get("neutral_troops_size_factor", 0.5))
	for t in ts:
		if taken.has(t.id):
			t.owner = taken[t.id]
			if t.owner == Faction.PLAYER:
				if bonus_ids.has(t.id):
					t.troops = int(start_troops * 0.5) + int(mods.get("bonus_garrison", 0))
				else:
					t.troops = start_troops + int(mods.get("start_troops", 0))
			else:
				t.troops = enemy_troops
		else:
			t.owner = Faction.NEUTRAL
			var base := rng.randi_range(int(nr[0]), int(nr[1]))
			t.troops = maxi(1, int(round(base * (1.0 + (size_factor[t.id] - 1.0) * nfac))))
	for f in sim.factions:
		f.alive = f.id == Faction.NEUTRAL or sim.tm.count_owned(f.id) > 0


## Ergänzt start per Farthest-Point-Auswahl auf k Gebiete.
func _spread_from(start: Array, k: int, rng: RandomNumberGenerator) -> Array:
	var ts := sim.territories
	var chosen: Array = start.duplicate()
	while chosen.size() < mini(k, ts.size()):
		var best := -1
		var best_d := -1.0
		for t in ts:
			if chosen.has(t.id):
				continue
			var md := INF
			for c in chosen:
				md = minf(md, t.center.distance_to(ts[c].center))
			md *= rng.randf_range(0.92, 1.0)
			if md > best_d:
				best_d = md
				best = t.id
		chosen.append(best)
	return chosen


func _min_pair_distance(ids: Array) -> float:
	var ts := sim.territories
	var md := INF
	for i in ids.size():
		for j in range(i + 1, ids.size()):
			md = minf(md, ts[ids[i]].center.distance_to(ts[ids[j]].center))
	return md


func _nearest_free(from_id: int, taken: Dictionary) -> int:
	var ts := sim.territories
	var best := -1
	var best_d := INF
	for nb in ts[from_id].neighbors:
		if not taken.has(nb):
			var d := ts[nb].center.distance_to(ts[from_id].center)
			if d < best_d:
				best_d = d
				best = nb
	if best >= 0:
		return best
	for t in ts:
		if not taken.has(t.id):
			var d := t.center.distance_to(ts[from_id].center)
			if d < best_d:
				best_d = d
				best = t.id
	return best


func _make_ais(ai_cfg: Dictionary) -> void:
	var seed := int(setup.get("seed", 1))
	for e in setup.get("enemies", []):
		var fid := int(e.get("faction", 2))
		if not sim.factions[fid].alive:
			continue
		var diff := str(e.get("ai", "easy"))
		if not ai_cfg.has(diff):
			diff = "easy"
		sim.factions[fid].ai_difficulty = diff
		ais.append(AIController.new(sim, fid, diff, ai_cfg[diff], seed * 13 + fid))


## Fraktionen, die in dieser Partie mitspielen (ohne neutral).
func active_factions() -> Array[int]:
	var out: Array[int] = [Faction.PLAYER]
	for e in setup.get("enemies", []):
		out.append(int(e.get("faction", 2)))
	return out
