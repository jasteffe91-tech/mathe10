class_name MapGenerator
extends RefCounted
## Erzeugt spielbare Karten.
## Eine Kartenvorlage besteht aus Landmassen (Umrisse) und Regions-Startpunkten.
## Daraus entstehen per Voronoi-Zerlegung je Landmasse unregelmäßige Gebiete,
## deren gemeinsame Grenzen mit deterministischem Rauschen "verwackelt" werden,
## damit sie an Länder- oder Bundeslandgrenzen erinnern.
## Dieselbe Pipeline erzeugt auch Zufallskarten für Endlos- und freies Spiel.

const TARGET_W := 1000.0
const TARGET_H := 1400.0
const PADDING := 40.0
const JITTER_STEP := 14.0
const JITTER_AMP := 10.0
const COAST_STEP := 11.0
const COAST_AMP := 3.5
const MAPS_DIR := "res://data/maps/"


# ================================================================ Vorlagen

static func load_template(map_id: String) -> Dictionary:
	var data: Variant = JsonUtil.load_file(MAPS_DIR + map_id + ".json", {})
	return data if data is Dictionary else {}


## Liste aller Karten-IDs aus data/maps/index.json.
static func template_ids() -> Array:
	var idx: Variant = JsonUtil.load_file(MAPS_DIR + "index.json", {})
	if idx is Dictionary:
		return idx.get("maps", [])
	return []


static func template_region_count(map_id: String) -> int:
	return load_template(map_id).get("regions", []).size()


## Baut eine Karte aus einer Vorlage. region_count <= 0 bedeutet alle Regionen.
static func from_template(tpl: Dictionary, region_count: int = 0, rng_seed: int = 1) -> MapData:
	var proj: Dictionary = tpl.get("projection", {})
	var lands: Array[PackedVector2Array] = []
	for lm in tpl.get("landmasses", []):
		var pts := PackedVector2Array()
		for p in lm:
			pts.append(_project(Vector2(p[0], p[1]), proj))
		if pts.size() >= 3:
			lands.append(pts)
	var all_seeds := PackedVector2Array()
	var all_metas: Array = []
	for r in tpl.get("regions", []):
		all_seeds.append(_project(Vector2(r.pos[0], r.pos[1]), proj))
		all_metas.append({"key": str(r.get("id", "")), "name": str(r.get("name", ""))})
	var chosen := select_regions(all_seeds, region_count, rng_seed)
	var seeds := PackedVector2Array()
	var metas: Array = []
	for i in chosen:
		seeds.append(all_seeds[i])
		metas.append(all_metas[i])
	var fit := _fit_transform(lands)
	for i in lands.size():
		lands[i] = fit.xform * lands[i]
	for i in seeds.size():
		seeds[i] = fit.xform * seeds[i]
	var data := build(lands, seeds, metas, rng_seed, fit.bounds)
	data.id = str(tpl.get("id", ""))
	var nm: Variant = tpl.get("name", {})
	data.names = nm if nm is Dictionary else {"de": str(nm), "en": str(nm)}
	data.theme = tpl.get("theme", {})
	return data


static func _project(p: Vector2, proj: Dictionary) -> Vector2:
	if str(proj.get("type", "xy")) == "lonlat":
		var lat0 := deg_to_rad(float(proj.get("lat0", 45.0)))
		var xs := float(proj.get("x_scale", 1.0))
		var ys := float(proj.get("y_scale", 1.0))
		return Vector2(p.x * cos(lat0) * xs, -p.y * ys)
	return p


## Wählt per Farthest-Point-Sampling gut verteilte Regionen aus.
static func select_regions(seeds: PackedVector2Array, count: int, rng_seed: int) -> PackedInt32Array:
	var n := seeds.size()
	var out := PackedInt32Array()
	if count <= 0 or count >= n:
		for i in n:
			out.append(i)
		return out
	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed
	var min_d := PackedFloat32Array()
	min_d.resize(n)
	min_d.fill(INF)
	var current := rng.randi_range(0, n - 1)
	while out.size() < count:
		out.append(current)
		min_d[current] = -1.0
		var best := -1
		var best_d := -1.0
		for i in n:
			if min_d[i] < 0.0:
				continue
			var d := seeds[i].distance_to(seeds[current])
			if d < min_d[i]:
				min_d[i] = d
			# leichte Zufallsstreuung, damit Level mit gleicher Vorlage verschieden aussehen
			var score := min_d[i] * rng.randf_range(0.85, 1.0)
			if score > best_d:
				best_d = score
				best = i
		if best < 0:
			break
		current = best
	out.sort()
	return out


static func _fit_transform(lands: Array[PackedVector2Array]) -> Dictionary:
	var r := Rect2()
	var first := true
	for lm in lands:
		for p in lm:
			if first:
				r = Rect2(p, Vector2.ZERO)
				first = false
			else:
				r = r.expand(p)
	var w := maxf(r.size.x, 1.0)
	var h := maxf(r.size.y, 1.0)
	var s := minf((TARGET_W - 2.0 * PADDING) / w, (TARGET_H - 2.0 * PADDING) / h)
	var xf := Transform2D(Vector2(s, 0), Vector2(0, s), Vector2(PADDING - r.position.x * s, PADDING - r.position.y * s))
	return {"xform": xf, "bounds": Rect2(0, 0, w * s + 2.0 * PADDING, h * s + 2.0 * PADDING)}


# ================================================================ Zufallskarten

## Erzeugt eine Zufallskarte. style: "continent", "twin", "archipelago" oder "" (zufällig).
static func random_map(region_count: int, rng_seed: int, style: String = "") -> MapData:
	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed
	region_count = maxi(region_count, 3)
	if style == "":
		var styles := ["continent", "continent", "twin"]
		if region_count >= 9:
			styles.append("archipelago")
		style = styles[rng.randi_range(0, styles.size() - 1)]
	var lands: Array[PackedVector2Array] = []
	match style:
		"twin":
			lands.append(_blob(Vector2(500, 360), Vector2(420, 300), rng))
			lands.append(_blob(Vector2(500, 1040), Vector2(420, 300), rng))
		"archipelago":
			@warning_ignore("integer_division")
			var k := clampi(region_count / 5, 3, 6)
			var centers: Array[Vector2] = []
			var radii: Array[float] = []
			var tries := 0
			while centers.size() < k and tries < 2000:
				tries += 1
				var rad := rng.randf_range(150.0, 260.0)
				var c := Vector2(rng.randf_range(rad, 1000.0 - rad), rng.randf_range(rad, 1400.0 - rad))
				var ok := true
				for i in centers.size():
					if c.distance_to(centers[i]) < (rad + radii[i]) * 1.08:
						ok = false
						break
				if ok:
					centers.append(c)
					radii.append(rad)
			for i in centers.size():
				lands.append(_blob(centers[i], Vector2(radii[i], radii[i] * rng.randf_range(0.8, 1.2)), rng))
		_:
			lands.append(_blob(Vector2(500, 700), Vector2(440, 640), rng))
	var fit := _fit_transform(lands)
	for i in lands.size():
		lands[i] = fit.xform * lands[i]
	# Regionen anteilig zur Fläche auf die Inseln verteilen
	var areas: Array[float] = []
	var total := 0.0
	for lm in lands:
		var a := polygon_area(lm)
		areas.append(a)
		total += a
	var counts: Array[int] = []
	var assigned := 0
	for i in lands.size():
		var c := maxi(1, int(round(region_count * areas[i] / total)))
		counts.append(c)
		assigned += c
	while assigned > region_count:
		var big := counts.find(counts.max())
		if counts[big] <= 1:
			break
		counts[big] -= 1
		assigned -= 1
	while assigned < region_count:
		var best := 0
		for i in lands.size():
			if areas[i] / counts[i] > areas[best] / counts[best]:
				best = i
		counts[best] += 1
		assigned += 1
	var seeds := PackedVector2Array()
	var metas: Array = []
	for i in lands.size():
		var pts := _poisson_in_polygon(lands[i], counts[i], rng)
		for p in pts:
			seeds.append(p)
			metas.append({"key": "r%d" % metas.size(), "name": ""})
	var data := build(lands, seeds, metas, rng_seed, fit.bounds)
	data.id = "random_" + style
	data.names = {"de": "Zufallskarte", "en": "Random map"}
	return data


static func _blob(c: Vector2, radius: Vector2, rng: RandomNumberGenerator, n: int = 60) -> PackedVector2Array:
	var amps: Array[float] = []
	var phases: Array[float] = []
	for k in range(2, 7):
		amps.append(rng.randf_range(0.0, 0.22 / float(k - 1)))
		phases.append(rng.randf_range(0.0, TAU))
	var pts := PackedVector2Array()
	for i in n:
		var a := TAU * float(i) / float(n)
		var r := 1.0
		for k in amps.size():
			r += amps[k] * sin(float(k + 2) * a + phases[k])
		r = clampf(r, 0.55, 1.35)
		pts.append(c + Vector2(cos(a) * radius.x, sin(a) * radius.y) * r)
	return pts


static func _poisson_in_polygon(poly: PackedVector2Array, count: int, rng: RandomNumberGenerator) -> PackedVector2Array:
	var r := _poly_bounds(poly)
	var area := polygon_area(poly)
	var min_d := sqrt(area / maxf(count, 1)) * 0.85
	var pts := PackedVector2Array()
	var tries := 0
	while pts.size() < count:
		tries += 1
		if tries > 300:
			tries = 0
			min_d *= 0.9
		var p := Vector2(rng.randf_range(r.position.x, r.end.x), rng.randf_range(r.position.y, r.end.y))
		if not Geometry2D.is_point_in_polygon(p, poly):
			continue
		if _distance_to_boundary(p, poly) < min_d * 0.35:
			continue
		var ok := true
		for q in pts:
			if q.distance_to(p) < min_d:
				ok = false
				break
		if ok:
			pts.append(p)
	return pts


# ================================================================ Aufbau

## Zerlegt die Landmassen anhand der Startpunkte in Regionen.
static func build(lands: Array[PackedVector2Array], seeds: PackedVector2Array, metas: Array, rng_seed: int, bounds: Rect2) -> MapData:
	var data := MapData.new()
	data.bounds = bounds
	var rough: Array[PackedVector2Array] = []
	for i in lands.size():
		rough.append(_valid_land(lands[i], rng_seed + i * 7919))
	data.landmasses = rough

	# Startpunkte den Landmassen zuordnen
	var land_of := PackedInt32Array()
	for s in seeds:
		var li := -1
		for k in rough.size():
			if Geometry2D.is_point_in_polygon(s, rough[k]):
				li = k
				break
		if li < 0:
			var best_d := INF
			for k in rough.size():
				var d := _distance_to_boundary(s, rough[k])
				if d < best_d:
					best_d = d
					li = k
		land_of.append(li)

	var bbox := bounds.grow(400.0)
	var pieces_of: Array = []
	for i in seeds.size():
		var cell := _voronoi_cell(i, seeds, land_of, bbox)
		var jittered := _jitter_cell(cell[0], cell[1], i, seeds, rng_seed)
		var pieces := _clip(jittered, rough[land_of[i]])
		if pieces.is_empty():
			pieces = _clip(cell[0], rough[land_of[i]])
		pieces_of.append(pieces)

	# Hauptstück bestimmen; abgetrennte Splitter dem angrenzenden Nachbarn zuschlagen
	var main: Array[PackedVector2Array] = []
	var extra: Array = []
	for i in seeds.size():
		var pieces: Array = pieces_of[i]
		var mi := -1
		var best_a := -1.0
		for k in pieces.size():
			if Geometry2D.is_point_in_polygon(seeds[i], pieces[k]):
				mi = k
				break
		if mi < 0:
			for k in pieces.size():
				var a := polygon_area(pieces[k])
				if a > best_a:
					best_a = a
					mi = k
		var ex: Array[PackedVector2Array] = []
		if mi >= 0:
			main.append(pieces[mi])
			for k in pieces.size():
				if k != mi:
					ex.append(pieces[k])
		else:
			main.append(PackedVector2Array())
		extra.append(ex)
	var polys_of: Array = []
	for i in seeds.size():
		var arr: Array[PackedVector2Array] = []
		polys_of.append(arr)
	for i in seeds.size():
		for piece in extra[i]:
			if polygon_area(piece) < 2.0:
				continue
			var c := polygon_centroid(piece)
			var order := _nearest_seeds(c, seeds, land_of, land_of[i], i)
			var placed := false
			for cand in order.slice(0, 4):
				if main[cand].size() >= 3 and _touches(piece, main[cand]):
					var merged := _outer_only(Geometry2D.merge_polygons(main[cand], piece))
					if merged.size() == 1:
						main[cand] = merged[0]
					else:
						polys_of[cand].append(piece)
					placed = true
					break
			if not placed:
				polys_of[i].append(piece)

	# Regionen zusammenstellen (leere verwerfen)
	var index_map := PackedInt32Array()
	index_map.resize(seeds.size())
	index_map.fill(-1)
	for i in seeds.size():
		if main[i].size() < 3 or polygon_area(main[i]) < 50.0:
			continue
		var polys: Array[PackedVector2Array] = []
		for poly in [main[i]] + polys_of[i]:
			if Geometry2D.triangulate_polygon(poly).is_empty():
				poly = clean_polygon(poly)
			if poly.size() >= 3:
				polys.append(poly)
		if polys.is_empty():
			continue
		var area := 0.0
		for p in polys:
			area += polygon_area(p)
		index_map[i] = data.regions.size()
		data.regions.append({
			"key": metas[i].key, "name": metas[i].name, "polygons": polys,
			"center": _label_point(main[i], seeds[i]), "area": area,
			"neighbors": PackedInt32Array(), "landmass": land_of[i]})
	_compute_neighbors(data)
	return data


static func _nearest_seeds(p: Vector2, seeds: PackedVector2Array, land_of: PackedInt32Array, land: int, exclude: int) -> Array:
	var idx: Array = []
	for j in seeds.size():
		if j != exclude and land_of[j] == land:
			idx.append(j)
	idx.sort_custom(func(a, b): return seeds[a].distance_squared_to(p) < seeds[b].distance_squared_to(p))
	return idx


## Voronoi-Zelle von Punkt i als konvexes Polygon. tags[k] nennt den Nachbarpunkt,
## dessen Mittelsenkrechte die Kante pts[k] -> pts[k+1] erzeugt hat (-1 = Rahmen).
static func _voronoi_cell(i: int, seeds: PackedVector2Array, land_of: PackedInt32Array, bbox: Rect2) -> Array:
	var pts := PackedVector2Array([bbox.position, Vector2(bbox.end.x, bbox.position.y), bbox.end, Vector2(bbox.position.x, bbox.end.y)])
	var tags := PackedInt32Array([-1, -1, -1, -1])
	var si := seeds[i]
	var order: Array = []
	for j in seeds.size():
		if j != i and land_of[j] == land_of[i]:
			order.append(j)
	order.sort_custom(func(a, b): return seeds[a].distance_squared_to(si) < seeds[b].distance_squared_to(si))
	for j in order:
		var sj := seeds[j]
		if si.distance_squared_to(sj) < 0.0001:
			continue
		var mid := (si + sj) * 0.5
		var nrm := sj - si
		var any_out := false
		for p in pts:
			if (p - mid).dot(nrm) > 0.0:
				any_out = true
				break
		if not any_out:
			continue
		var res := _clip_half_plane(pts, tags, mid, nrm, j)
		pts = res[0]
		tags = res[1]
		if pts.size() < 3:
			break
	return [pts, tags]


static func _clip_half_plane(pts: PackedVector2Array, tags: PackedInt32Array, mid: Vector2, nrm: Vector2, tag: int) -> Array:
	var out_p := PackedVector2Array()
	var out_t := PackedInt32Array()
	var n := pts.size()
	for k in n:
		var p := pts[k]
		var q := pts[(k + 1) % n]
		var fp := (p - mid).dot(nrm)
		var fq := (q - mid).dot(nrm)
		var in_p := fp <= 0.0
		var in_q := fq <= 0.0
		if in_p:
			out_p.append(p)
			out_t.append(tags[k])
			if not in_q:
				out_p.append(p.lerp(q, fp / (fp - fq)))
				out_t.append(tag)
		elif in_q:
			out_p.append(p.lerp(q, fp / (fp - fq)))
			out_t.append(tags[k])
	return [out_p, out_t]


## Verwackelt die Kanten einer Zelle. Die Verschiebung hängt nur vom Punktpaar und der
## absoluten Position entlang der Mittelsenkrechten ab, daher erzeugen beide Nachbarn
## exakt dieselbe Grenzlinie.
static func _jitter_cell(pts: PackedVector2Array, tags: PackedInt32Array, i: int, seeds: PackedVector2Array, rng_seed: int) -> PackedVector2Array:
	var out := PackedVector2Array()
	var n := pts.size()
	for k in n:
		var p := pts[k]
		var q := pts[(k + 1) % n]
		out.append(p)
		var j := tags[k]
		if j < 0:
			continue
		var a := mini(i, j)
		var b := maxi(i, j)
		var dir := (seeds[b] - seeds[a]).normalized()
		var u := Vector2(-dir.y, dir.x)
		var sp := p.dot(u)
		var sq := q.dot(u)
		var lo := minf(sp, sq)
		var hi := maxf(sp, sq)
		var length := hi - lo
		if length < JITTER_STEP * 1.5:
			continue
		var amp := minf(JITTER_AMP, length * 0.12)
		var h := _hash3(a, b, rng_seed)
		var ph1 := float(h & 1023) / 1024.0 * TAU
		var ph2 := float((h >> 10) & 1023) / 1024.0 * TAU
		var f1 := 0.035 + float((h >> 20) & 63) / 64.0 * 0.03
		var f2 := 0.09 + float((h >> 26) & 31) / 32.0 * 0.05
		var k0 := int(ceil(lo / JITTER_STEP))
		var k1 := int(floor(hi / JITTER_STEP))
		var ks: Array = range(k0, k1 + 1)
		if sp > sq:
			ks.reverse()
		for kk in ks:
			var s := float(kk) * JITTER_STEP
			var dist_end := minf(s - lo, hi - s)
			if dist_end < JITTER_STEP * 0.5:
				continue
			var taper := clampf(dist_end / 30.0, 0.0, 1.0)
			var t := (s - sp) / (sq - sp)
			var off := (sin(s * f1 + ph1) * 0.65 + sin(s * f2 + ph2) * 0.35) * amp * taper
			out.append(p.lerp(q, t) + dir * off)
	return out


static func _hash3(a: int, b: int, c: int) -> int:
	var h := (a * 73856093) ^ (b * 19349663) ^ (c * 83492791)
	h = (h ^ (h >> 13)) * 1274126177
	return absi(h ^ (h >> 16)) & 0x7fffffff


## Aufgeraute Küste, die garantiert triangulierbar ist (sonst Rückfall auf den Originalumriss).
static func _valid_land(poly: PackedVector2Array, rng_seed: int) -> PackedVector2Array:
	var r := _roughen(poly, rng_seed)
	if not Geometry2D.triangulate_polygon(r).is_empty():
		return r
	if not Geometry2D.triangulate_polygon(poly).is_empty():
		return poly
	return clean_polygon(poly)


## Bereinigt ein (evtl. selbstschneidendes) Polygon und liefert das größte gültige Teilstück.
static func clean_polygon(poly: PackedVector2Array) -> PackedVector2Array:
	var best := poly
	var best_a := -1.0
	for p in Geometry2D.offset_polygon(poly, 0.05):
		var a := polygon_area(p)
		if a > best_a and not Geometry2D.triangulate_polygon(p).is_empty():
			best_a = a
			best = p
	return best


## Küstenlinie verfeinern und leicht aufrauen.
static func _roughen(poly: PackedVector2Array, rng_seed: int) -> PackedVector2Array:
	var out := PackedVector2Array()
	var n := poly.size()
	var ph := float(rng_seed % 997) * 0.37
	for k in n:
		var p := poly[k]
		var q := poly[(k + 1) % n]
		out.append(p)
		var seg_len := p.distance_to(q)
		var steps := int(seg_len / COAST_STEP)
		if steps < 2:
			continue
		var nrm := (q - p).normalized().orthogonal()
		var amp := minf(COAST_AMP, seg_len * 0.08)
		for s in range(1, steps):
			var t := float(s) / float(steps)
			var base := p.lerp(q, t)
			var taper := sin(t * PI)
			var off := sin(base.x * 0.071 + ph) * cos(base.y * 0.063 - ph) * amp * taper
			out.append(base + nrm * off)
	return out


static func _clip(cell: PackedVector2Array, land: PackedVector2Array) -> Array[PackedVector2Array]:
	if cell.size() < 3:
		return []
	return _outer_only(Geometry2D.intersect_polygons(cell, land))


## Entfernt Löcher (entgegengesetzt orientierte Polygone) aus einem Clipping-Ergebnis.
static func _outer_only(polys: Array) -> Array[PackedVector2Array]:
	var out: Array[PackedVector2Array] = []
	if polys.is_empty():
		return out
	var largest := 0
	var largest_a := -1.0
	for k in polys.size():
		var a := polygon_area(polys[k])
		if a > largest_a:
			largest_a = a
			largest = k
	var outer_cw := Geometry2D.is_polygon_clockwise(polys[largest])
	for p in polys:
		if p.size() >= 3 and Geometry2D.is_polygon_clockwise(p) == outer_cw:
			out.append(p)
	return out


static func _touches(a: PackedVector2Array, b: PackedVector2Array) -> bool:
	var ra := _poly_bounds(a).grow(2.0)
	if not ra.intersects(_poly_bounds(b)):
		return false
	var nb := b.size()
	for p in a:
		if not ra.has_point(p):
			continue
		for k in nb:
			var c := Geometry2D.get_closest_point_to_segment(p, b[k], b[(k + 1) % nb])
			if c.distance_squared_to(p) < 2.25:
				return true
	return false


## Nachbarschaften über gemeinsame Grenzen; getrennte Inseln werden über die
## kürzeste Seeverbindung angebunden, damit der Graph zusammenhängt.
static func _compute_neighbors(data: MapData) -> void:
	var n := data.regions.size()
	var cell := 24.0
	var grid := {}
	for ri in n:
		for poly in data.regions[ri].polygons:
			var m: int = poly.size()
			for k in m:
				var a: Vector2 = poly[k]
				var b: Vector2 = poly[(k + 1) % m]
				var x0 := int(floor(minf(a.x, b.x) / cell))
				var x1 := int(floor(maxf(a.x, b.x) / cell))
				var y0 := int(floor(minf(a.y, b.y) / cell))
				var y1 := int(floor(maxf(a.y, b.y) / cell))
				for gx in range(x0, x1 + 1):
					for gy in range(y0, y1 + 1):
						var key := Vector2i(gx, gy)
						if not grid.has(key):
							grid[key] = []
						grid[key].append([ri, a, b])
	var adj: Array = []
	for i in n:
		adj.append({})
	for ri in n:
		for poly in data.regions[ri].polygons:
			for p in poly:
				var key := Vector2i(int(floor(p.x / cell)), int(floor(p.y / cell)))
				if not grid.has(key):
					continue
				for seg in grid[key]:
					var rj: int = seg[0]
					if rj == ri or adj[ri].has(rj):
						continue
					var c := Geometry2D.get_closest_point_to_segment(p, seg[1], seg[2])
					if c.distance_squared_to(p) < 4.0:
						adj[ri][rj] = true
						adj[rj][ri] = true
	# Zusammenhangskomponenten verbinden
	var comp := PackedInt32Array()
	comp.resize(n)
	comp.fill(-1)
	var comps := 0
	for s in n:
		if comp[s] >= 0:
			continue
		var stack := [s]
		comp[s] = comps
		while not stack.is_empty():
			var v: int = stack.pop_back()
			for w in adj[v]:
				if comp[w] < 0:
					comp[w] = comps
					stack.append(w)
		comps += 1
	while comps > 1:
		var best := [-1, -1]
		var best_d := INF
		for i in n:
			if comp[i] != 0:
				continue
			for j in n:
				if comp[j] == 0:
					continue
				var d: float = data.regions[i].center.distance_squared_to(data.regions[j].center)
				if d < best_d:
					best_d = d
					best = [i, j]
		var old: int = comp[best[1]]
		adj[best[0]][best[1]] = true
		adj[best[1]][best[0]] = true
		for k in n:
			if comp[k] == old:
				comp[k] = 0
		comps -= 1
	for i in n:
		var arr := PackedInt32Array()
		for j in adj[i]:
			arr.append(j)
		arr.sort()
		data.regions[i].neighbors = arr


## Gut lesbare Position für die Truppenzahl: der Startpunkt, falls er genug Abstand
## zur Grenze hat, sonst eine Näherung des Punktes mit größtem Randabstand.
static func _label_point(poly: PackedVector2Array, seed_pt: Vector2) -> Vector2:
	var simple := poly
	if poly.size() > 90:
		simple = PackedVector2Array()
		var step := int(ceil(poly.size() / 90.0))
		for k in range(0, poly.size(), step):
			simple.append(poly[k])
	var r := _poly_bounds(simple)
	var best := polygon_centroid(poly)
	var best_d := -1.0
	if Geometry2D.is_point_in_polygon(best, simple):
		best_d = _distance_to_boundary(best, simple)
	var g := 10
	for ix in g:
		for iy in g:
			var p := r.position + Vector2((ix + 0.5) / g * r.size.x, (iy + 0.5) / g * r.size.y)
			if not Geometry2D.is_point_in_polygon(p, simple):
				continue
			var d := _distance_to_boundary(p, simple)
			if d > best_d:
				best_d = d
				best = p
	var cell := r.size / g
	for ix in 5:
		for iy in 5:
			var p := best + Vector2((ix - 2) * cell.x * 0.25, (iy - 2) * cell.y * 0.25)
			if not Geometry2D.is_point_in_polygon(p, simple):
				continue
			var d := _distance_to_boundary(p, simple)
			if d > best_d:
				best_d = d
				best = p
	if Geometry2D.is_point_in_polygon(seed_pt, simple) and _distance_to_boundary(seed_pt, simple) >= best_d * 0.7:
		return seed_pt
	return best


# ================================================================ Geometrie

static func polygon_area(poly: PackedVector2Array) -> float:
	var a := 0.0
	var n := poly.size()
	for k in n:
		var p := poly[k]
		var q := poly[(k + 1) % n]
		a += p.x * q.y - q.x * p.y
	return absf(a) * 0.5


static func polygon_centroid(poly: PackedVector2Array) -> Vector2:
	var a := 0.0
	var c := Vector2.ZERO
	var n := poly.size()
	for k in n:
		var p := poly[k]
		var q := poly[(k + 1) % n]
		var cr := p.x * q.y - q.x * p.y
		a += cr
		c += (p + q) * cr
	if absf(a) < 0.000001:
		var s := Vector2.ZERO
		for p in poly:
			s += p
		return s / maxf(n, 1)
	return c / (3.0 * a)


static func _poly_bounds(poly: PackedVector2Array) -> Rect2:
	if poly.is_empty():
		return Rect2()
	var r := Rect2(poly[0], Vector2.ZERO)
	for p in poly:
		r = r.expand(p)
	return r


static func _distance_to_boundary(p: Vector2, poly: PackedVector2Array) -> float:
	var best := INF
	var n := poly.size()
	for k in n:
		var c := Geometry2D.get_closest_point_to_segment(p, poly[k], poly[(k + 1) % n])
		best = minf(best, c.distance_squared_to(p))
	return sqrt(best)
