extends SceneTree
## Debug-Werkzeug: erzeugt alle Karten und schreibt sie als SVG nach build/maps/.
## Aufruf: godot --headless --path . --script res://tools/dump_maps.gd

const COLORS := ["#8fb8e8", "#e89a8f", "#9bd3a8", "#f2d27a", "#c7b3e6", "#f0b37e", "#9fd8d8", "#e6a8c8"]


func _init() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://build/maps"))
	var ids: Array = MapGenerator.template_ids()
	ids.append("random_continent")
	ids.append("random_archipelago")
	ids.append("random_twin")
	for id in ids:
		var t0 := Time.get_ticks_msec()
		var data: MapData
		if str(id).begins_with("random_"):
			data = MapGenerator.random_map(24, 99, str(id).substr(7))
		else:
			data = MapGenerator.from_template(MapGenerator.load_template(id), 0, 7)
		var ms := Time.get_ticks_msec() - t0
		var pieces := 0
		for r in data.regions:
			pieces += r.polygons.size()
		print("%-22s %3d Regionen  %3d Teile  %4d ms  bounds %s" % [id, data.regions.size(), pieces, ms, data.bounds.size])
		_write_svg(data, "res://build/maps/%s.svg" % id)
	quit()


func _write_svg(data: MapData, path: String) -> void:
	var s := '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n' % [data.bounds.size.x, data.bounds.size.y, data.bounds.size.x, data.bounds.size.y]
	s += '<rect width="100%" height="100%" fill="#d8ebf3"/>\n'
	for lm in data.landmasses:
		s += '<polygon points="%s" fill="#e9e4d8" stroke="#b8c4cc" stroke-width="1"/>\n' % _pts(lm)
	for i in data.regions.size():
		var r: Dictionary = data.regions[i]
		for poly in r.polygons:
			s += '<polygon points="%s" fill="%s" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>\n' % [_pts(poly), COLORS[i % COLORS.size()]]
	for i in data.regions.size():
		var r: Dictionary = data.regions[i]
		for j in r.neighbors:
			if j > i:
				var c2: Vector2 = data.regions[j].center
				s += '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#0003" stroke-width="1"/>\n' % [r.center.x, r.center.y, c2.x, c2.y]
	for r in data.regions:
		s += '<circle cx="%.1f" cy="%.1f" r="14" fill="#2b3a4a"/>' % [r.center.x, r.center.y]
		s += '<text x="%.1f" y="%.1f" font-size="11" fill="#fff" text-anchor="middle" font-family="Arial">%s</text>\n' % [r.center.x, r.center.y + 4, str(r.key).substr(0, 5)]
	s += "</svg>\n"
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(s)
	f.close()


func _pts(poly: PackedVector2Array) -> String:
	var parts := PackedStringArray()
	for p in poly:
		parts.append("%.1f,%.1f" % [p.x, p.y])
	return " ".join(parts)
