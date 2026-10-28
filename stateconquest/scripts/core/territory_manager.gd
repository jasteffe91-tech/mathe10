class_name TerritoryManager
extends RefCounted
## Verwaltet alle Gebiete einer Partie: Produktion, Abfragen, Distanzen.

var territories: Array[Territory] = []
var neutral_production: float = 0.0


func add(t: Territory) -> void:
	t.id = territories.size()
	territories.append(t)


func get_territory(id: int) -> Territory:
	if id < 0 or id >= territories.size():
		return null
	return territories[id]


func size() -> int:
	return territories.size()


## Produktion für dt Sekunden. Gibt die Zahl der neu produzierten Einheiten je Fraktion zurück.
func produce(dt: float, factions: Array) -> PackedInt32Array:
	var produced := PackedInt32Array()
	produced.resize(Faction.COUNT)
	for t in territories:
		var rate := 0.0
		if t.owner == Faction.NEUTRAL:
			rate = t.production_rate * neutral_production
		else:
			rate = t.production_rate * (factions[t.owner] as Faction).production_mult
		if rate <= 0.0 or t.troops >= t.capacity:
			t.production_progress = 0.0
			continue
		t.production_progress += rate * dt
		# kleines Epsilon gleicht Rundungsfehler beim Aufsummieren fester Zeitschritte aus
		if t.production_progress >= 1.0 - 0.000001:
			var whole := int(t.production_progress + 0.000001)
			whole = mini(whole, t.capacity - t.troops)
			t.troops += whole
			t.production_progress = maxf(0.0, t.production_progress - float(whole))
			if t.troops >= t.capacity:
				t.production_progress = 0.0
			produced[t.owner] += whole
	return produced


func owned_by(owner: int) -> Array[Territory]:
	var out: Array[Territory] = []
	for t in territories:
		if t.owner == owner:
			out.append(t)
	return out


func count_owned(owner: int) -> int:
	var n := 0
	for t in territories:
		if t.owner == owner:
			n += 1
	return n


func troops_owned(owner: int) -> int:
	var n := 0
	for t in territories:
		if t.owner == owner:
			n += t.troops
	return n


func distance(a: int, b: int) -> float:
	return territories[a].center.distance_to(territories[b].center)


## Gebiet unter einem Punkt (Kartenkoordinaten), sonst das nächste innerhalb max_dist, sonst -1.
func territory_at(p: Vector2, max_dist: float = 0.0) -> int:
	for t in territories:
		for poly in t.polygons:
			if Geometry2D.is_point_in_polygon(p, poly):
				return t.id
	if max_dist <= 0.0:
		return -1
	var best := -1
	var best_d := max_dist
	for t in territories:
		var d := t.center.distance_to(p)
		if d < best_d:
			best_d = d
			best = t.id
	return best
