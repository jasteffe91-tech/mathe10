class_name TestCase
extends RefCounted
## Minimales Test-Framework: Methoden, die mit test_ beginnen, werden ausgeführt.

var failures: Array[String] = []
var checks := 0
var _current := ""


func check(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append("%s: %s" % [_current, msg])


func eq(a: Variant, b: Variant, msg: String) -> void:
	check(a == b, "%s (erwartet %s, ist %s)" % [msg, str(b), str(a)])


func near(a: float, b: float, eps: float, msg: String) -> void:
	check(absf(a - b) <= eps, "%s (erwartet %.4f ± %.4f, ist %.4f)" % [msg, b, eps, a])


# ---------------------------------------------------------------- Hilfen für Spieltests

## Kleine Testwelt mit frei platzierten, quadratischen Gebieten.
## Damit die Partie nicht sofort endet, kommt automatisch ein weit entferntes, unbeteiligtes
## Gebiet hinzu: ein Spielergebiet, falls der Spieler fehlt, sonst ein neutrales.
static func make_sim(spec: Array, add_idle: bool = true) -> Simulation:
	spec = spec.duplicate()
	if add_idle:
		var has_player := false
		var has_other := false
		for s in spec:
			if int(s[0]) == Faction.PLAYER:
				has_player = true
			else:
				has_other = true
		if not has_player:
			spec.append([Faction.PLAYER, 1, 5000, 5000, 0.0])
		elif not has_other:
			spec.append([Faction.NEUTRAL, 1, 5000, 5000, 0.0])
	var sim := Simulation.new()
	sim.base_speed = 100.0
	for s in spec:
		var t := Territory.new()
		t.owner = int(s[0])
		t.troops = int(s[1])
		t.center = Vector2(float(s[2]), float(s[3]))
		t.production_rate = float(s[4]) if s.size() > 4 else 1.0
		t.capacity = int(s[5]) if s.size() > 5 else 999
		var c := t.center
		var polys: Array[PackedVector2Array] = [PackedVector2Array([c + Vector2(-40, -40), c + Vector2(40, -40), c + Vector2(40, 40), c + Vector2(-40, 40)])]
		t.polygons = polys
		t.area = 6400.0
		sim.tm.add(t)
	for f in sim.factions:
		f.alive = f.id == Faction.NEUTRAL or sim.tm.count_owned(f.id) > 0
	return sim


static func run(sim: Simulation, seconds: float, dt: float = Simulation.FIXED_DT) -> void:
	var steps := int(round(seconds / dt))
	for i in steps:
		sim.step(dt)


static func total_units(sim: Simulation) -> int:
	var n := 0
	for t in sim.territories:
		n += t.troops
	for m in sim.movements:
		n += m.in_flight()
	return n
