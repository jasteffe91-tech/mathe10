class_name AIController
extends RefCounted
## Gegner-KI für eine Fraktion. Sie sieht denselben Spielzustand wie der Spieler
## (Truppenzahlen und sichtbare Truppenströme) und handelt ausschließlich über
## Simulation.send_troops mit denselben Versandmengen wie der Spieler.
## Das Verhalten wird über Profile in data/config/ai.json gesteuert.

const DIFFICULTIES := ["easy", "medium", "hard", "very_hard"]

var sim: Simulation
var faction: int
var difficulty: String
var p: Dictionary
var rng := RandomNumberGenerator.new()
var send_ratios: Array = [0.25, 0.5, 0.75, 1.0]

var _next_think: float = 0.0
var _next_consolidate: float = 0.0
var _last_seen_movement: int = 0
var decisions: int = 0   ## Anzahl ausgeführter Befehle (für Tests/Statistik)
var _inc_cache: Dictionary = {}


func _init(p_sim: Simulation, p_faction: int, p_difficulty: String, profile: Dictionary, rng_seed: int) -> void:
	sim = p_sim
	faction = p_faction
	difficulty = p_difficulty
	p = profile
	rng.seed = rng_seed
	_next_think = sim.time + _range("first_think", 2.0)
	_next_consolidate = sim.time + 6.0


func _range(key: String, fallback: float) -> float:
	var v: Variant = p.get(key, [fallback, fallback])
	if v is Array and v.size() >= 2:
		return rng.randf_range(float(v[0]), float(v[1]))
	return float(v)


## Wird nach jedem Simulationsschritt aufgerufen. allow_think = false verschiebt eine fällige
## Entscheidung um einen Schritt (verteilt die Rechenlast mehrerer KIs). Gibt true zurück, wenn gedacht wurde.
func update(allow_think: bool = true) -> bool:
	if not sim.is_running() or not sim.factions[faction].alive:
		return false
	if bool(p.get("react_to_sends", false)):
		_watch_movements()
	if sim.time >= _next_think and allow_think:
		_next_think = sim.time + _range("think_interval", 2.0)
		think()
		return true
	return false


## Neue gegnerische Ströme lösen bei starken Profilen eine schnellere Reaktion aus.
func _watch_movements() -> void:
	var react := false
	for m in sim.movements:
		if m.id <= _last_seen_movement:
			continue
		_last_seen_movement = maxi(_last_seen_movement, m.id)
		if m.owner == faction:
			continue
		var tgt := sim.tm.territories[m.target]
		var src := sim.tm.territories[m.source]
		# Angriff auf uns oder ein großer Abzug, der den Absender schwächt
		if tgt.owner == faction or (src.owner != faction and m.count >= 8):
			react = true
	if react:
		var at := sim.time + float(p.get("reaction_delay", 0.5))
		if at < _next_think:
			_next_think = at


func think() -> void:
	_inc_cache.clear()
	var mine := sim.tm.owned_by(faction)
	if mine.is_empty():
		return
	if rng.randf() < float(p.get("defend_chance", 0.5)):
		_defend(mine)
	if rng.randf() < float(p.get("mistake_chance", 0.0)):
		_mistake(mine)
		return
	var tried := {}
	for i in int(p.get("max_attacks", 1)):
		var plan := _best_attack(mine, tried)
		if plan.is_empty():
			break
		tried[plan.target] = true
		_execute(plan)
	if bool(p.get("consolidate", false)) and sim.time >= _next_consolidate:
		_next_consolidate = sim.time + 4.0
		_consolidate(mine)


# ---------------------------------------------------------------- Bewertung

## Feindliche und eigene Einheiten auf dem Weg zu einem Gebiet (pro Denkvorgang zwischengespeichert).
func _incoming_split(tid: int) -> Dictionary:
	if _inc_cache.has(tid):
		return _inc_cache[tid]
	var hostile := 0
	var friendly := 0
	var first_hostile := INF
	for m in sim.movements:
		if m.target != tid:
			continue
		if m.owner == faction:
			friendly += m.in_flight()
		else:
			hostile += m.in_flight()
			first_hostile = minf(first_hostile, m.arrival_time(m.arrived))
	var res := {"hostile": hostile, "friendly": friendly, "first_hostile": first_hostile}
	_inc_cache[tid] = res
	return res


## Truppen, die ein eigenes Gebiet behalten sollte.
func _reserve(t: Territory) -> int:
	var r := int(ceil(t.troops * float(p.get("reserve", 0.1))))
	if difficulty != "easy":
		var inc := _incoming_split(t.id)
		r += maxi(0, inc.hostile - inc.friendly)
	return r


## Erlaubte Versandmengen (wie beim Spieler: 25/50/75/100 %), aufsteigend.
func _options(t: Territory, reserve: int) -> Array:
	var out: Array = []
	for r in send_ratios:
		var c := int(floor(t.troops * float(r) + 0.000001))
		if c > 0 and t.troops - c >= reserve:
			out.append([float(r), c])
	return out


## Erwartete Verteidiger von x, wenn unsere Truppen nach eta Sekunden eintreffen.
## movs: bereits auf x gefilterte Ströme (sonst werden alle durchsucht).
func _defense_estimate(x: Territory, eta: float, movs: Variant = null) -> float:
	var d := float(x.troops)
	if x.owner != Faction.NEUTRAL:
		var rate := x.production_rate * sim.factions[x.owner].production_mult
		d = minf(d + rate * eta, maxf(float(x.capacity), d))
	var timing := bool(p.get("timing_aware", false))
	var list: Array = movs if movs != null else sim.movements
	for m in list:
		if m.target != x.id:
			continue
		if m.owner == faction:
			d -= m.in_flight()
		elif timing and m.arrival_time(m.arrived) < sim.time + eta:
			if m.owner == x.owner:
				d += m.in_flight()
			else:
				d -= m.in_flight() * 0.5
	return d


func _value(x: Territory, near: int) -> float:
	var v := 10.0 + x.production_rate * 6.0
	if x.owner == Faction.NEUTRAL:
		v += 4.0
	else:
		v += 3.0
		if bool(p.get("timing_aware", false)):
			# Frontgebiete, die viele eigene Gebiete bedrohen, zuerst ausschalten
			v += 2.0 * near
	if bool(p.get("lookahead", false)):
		# Mehrstufig denken: Gebiete, die den Weg zu schwachen Nachbarn öffnen, sind mehr wert
		for nb in x.neighbors:
			var n := sim.tm.territories[nb]
			if n.owner != faction:
				v += 3.0 / (1.0 + n.troops * 0.15)
	return v


func _best_attack(mine: Array[Territory], tried: Dictionary) -> Dictionary:
	var has_neutral := false
	for x in sim.territories:
		if x.owner == Faction.NEUTRAL:
			has_neutral = true
			break
	var margin_v: Variant = p.get("margin", [1, 3])
	var min_success := float(p.get("min_success", 1.0))
	var max_sources := int(p.get("max_sources", 1))
	# Vorberechnung je Denkvorgang: mögliche Quellen, Gesamttruppen, Ströme je Ziel
	var sources: Array[Territory] = []
	var reserve := {}
	var total_troops := 0
	for s in mine:
		if s.troops >= 2:
			sources.append(s)
			reserve[s.id] = _reserve(s)
			total_troops += s.troops
	if sources.is_empty():
		return {}
	var movs_by_target := {}
	for m in sim.movements:
		if not movs_by_target.has(m.target):
			movs_by_target[m.target] = []
		movs_by_target[m.target].append(m)
	var near_r2 := 260.0 * 260.0
	var best := {}
	var best_score := -INF
	for x in sim.territories:
		if x.owner == faction or tried.has(x.id) or x.troops >= total_troops:
			continue
		if x.owner != Faction.NEUTRAL and has_neutral and rng.randf() < float(p.get("neutral_preference", 0.0)):
			continue
		# die max_sources nächsten Quellen (Einfügesortierung, k ist klein)
		var nearest: Array = []
		var near := 0
		for s in sources:
			if sim.restrict_neighbors and not s.is_neighbor(x.id):
				continue
			var d2 := s.center.distance_squared_to(x.center)
			if d2 < near_r2:
				near += 1
			if nearest.size() < max_sources or d2 < nearest[nearest.size() - 1][0]:
				var pos := nearest.size()
				while pos > 0 and nearest[pos - 1][0] > d2:
					pos -= 1
				nearest.insert(pos, [d2, s])
				if nearest.size() > max_sources:
					nearest.pop_back()
		if nearest.is_empty():
			continue
		var movs: Array = movs_by_target.get(x.id, [])
		var margin := rng.randi_range(int(margin_v[0]), int(margin_v[1]))
		var eta := sim.travel_time(faction, nearest[0][1].id, x.id)
		var need := int(floor(_defense_estimate(x, eta, movs))) + 1 + margin
		if need <= 0 and margin >= 0:
			continue
		need = maxi(need, 1)
		var chosen: Array = []
		var total := 0
		for entry in nearest:
			var s: Territory = entry[1]
			var opts := _options(s, reserve[s.id])
			if opts.is_empty():
				continue
			var pick: Array = opts[opts.size() - 1]
			for o in opts:
				if o[1] >= need - total:
					pick = o
					break
			chosen.append([s.id, pick[0], pick[1]])
			total += int(pick[1])
			eta = maxf(eta, sim.travel_time(faction, s.id, x.id))
			if total >= need:
				break
		if chosen.is_empty():
			continue
		# Mit der längsten Laufzeit neu schätzen
		var need_final := int(floor(_defense_estimate(x, eta, movs))) + 1
		if min_success > 0.0 and float(total) < float(need_final) * min_success + 0.5:
			continue
		if min_success <= 0.0 and total < need_final + int(margin_v[0]):
			continue
		var score := _value(x, near) / (float(need_final) + 5.0) * 10.0 - eta * 0.6
		score += rng.randf_range(0.0, 1.5)
		if score > best_score:
			best_score = score
			best = {"target": x.id, "sources": chosen}
	return best


func _execute(plan: Dictionary) -> void:
	for s in plan.sources:
		var m := sim.send_troops(faction, int(s[0]), int(plan.target), float(s[1]))
		if m != null:
			decisions += 1


# ---------------------------------------------------------------- Verteidigung

func _defend(mine: Array[Territory]) -> void:
	var timing := bool(p.get("timing_aware", false))
	var max_helpers := 1 if difficulty == "easy" or difficulty == "medium" else 3
	for t in mine:
		_inc_cache.erase(t.id)
		var inc := _incoming_split(t.id)
		if inc.hostile == 0:
			continue
		var eta: float = inc.first_hostile - sim.time
		var expected := float(t.troops + inc.friendly - inc.hostile)
		if timing:
			expected += t.production_rate * sim.factions[faction].production_mult * maxf(eta, 0.0)
		if expected >= 1.0:
			continue
		var deficit := int(ceil(1.0 - expected)) + 2
		var helpers: Array = []
		for h in mine:
			if h.id != t.id and h.troops >= 4 and sim.can_send(faction, h.id, t.id):
				if timing and sim.travel_time(faction, h.id, t.id) > eta + 0.3:
					continue
				helpers.append(h)
		helpers.sort_custom(func(a, b): return a.center.distance_squared_to(t.center) < b.center.distance_squared_to(t.center))
		var sent_total := 0
		for h in helpers.slice(0, max_helpers):
			var opts := _options(h, _reserve(h))
			if opts.is_empty():
				continue
			var pick: Array = opts[opts.size() - 1]
			for o in opts:
				if o[1] >= deficit - sent_total:
					pick = o
					break
			if sim.send_troops(faction, h.id, t.id, pick[0]) != null:
				decisions += 1
				sent_total += int(pick[1])
			if sent_total >= deficit:
				break
		# Aussichtslos? Starke KI rettet die Truppen, statt sie zu verlieren.
		if sent_total < deficit and bool(p.get("evacuate", false)) and t.troops >= 6 and float(inc.hostile) > t.troops * 1.5:
			_evacuate(t, mine)


func _evacuate(t: Territory, mine: Array[Territory]) -> void:
	var best: Territory = null
	var best_d := INF
	for h in mine:
		if h.id == t.id or not sim.can_send(faction, t.id, h.id):
			continue
		if _incoming_split(h.id).hostile > 0:
			continue
		var d := h.center.distance_to(t.center)
		if d < best_d:
			best_d = d
			best = h
	if best != null and sim.send_troops(faction, t.id, best.id, 1.0) != null:
		decisions += 1


# ---------------------------------------------------------------- Sonstiges

## Volle Gebiete im Hinterland produzieren nicht weiter: ihre Truppen an die Front verlegen.
func _consolidate(mine: Array[Territory]) -> void:
	if mine.size() < 2:
		return
	var front: Array[Territory] = []
	var full: Array[Territory] = []
	for t in mine:
		var near_other := INF
		for x in sim.territories:
			if x.owner != faction:
				near_other = minf(near_other, x.center.distance_to(t.center))
		if near_other <= 300.0:
			front.append(t)
		elif t.troops >= int(t.capacity * 0.85) and _incoming_split(t.id).hostile == 0:
			full.append(t)
	if front.is_empty():
		return
	for b in full:
		var target: Territory = null
		var best_d := INF
		for f in front:
			if not sim.can_send(faction, b.id, f.id):
				continue
			var d := f.center.distance_to(b.center)
			if d < best_d:
				best_d = d
				target = f
		if target != null and sim.send_troops(faction, b.id, target.id, 0.5) != null:
			decisions += 1


func _mistake(mine: Array[Territory]) -> void:
	var s: Territory = mine[rng.randi_range(0, mine.size() - 1)]
	if s.troops < 4:
		return
	var targets: Array = []
	for x in sim.territories:
		if x.id != s.id and sim.can_send(faction, s.id, x.id):
			targets.append(x.id)
	if targets.is_empty():
		return
	var tgt: int = targets[rng.randi_range(0, targets.size() - 1)]
	if sim.send_troops(faction, s.id, tgt, [0.25, 0.5][rng.randi_range(0, 1)]) != null:
		decisions += 1
