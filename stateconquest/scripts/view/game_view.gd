class_name GameView
extends Control
## Darstellung und Eingabe einer Partie. Liest den Zustand der Simulation, zeichnet
## Karte, Truppenströme, Zahlen und Effekte und wandelt Touch-/Mausgesten in Befehle um.
## Die Simulation selbst läuft in festen Schritten (Simulation.FIXED_DT), unabhängig von der Bildrate.

signal captured(territory: int, from_owner: int, to_owner: int)
signal player_sent(count: int, sources: int)
signal game_finished(won: bool)
signal selection_changed(count: int)
signal zoom_changed(zoomed: bool)

const MAX_STEPS_PER_FRAME := 10
const TAP_SLOP := 16.0
const MAX_ZOOM := 3.5
const COLOR_FADE := 0.35

class DrawLayer extends Node2D:
	var fn: Callable
	func _draw() -> void:
		if fn.is_valid():
			fn.call(self)

class DrawControl extends Control:
	var fn: Callable
	func _draw() -> void:
		if fn.is_valid():
			fn.call(self)

var session: GameSession
var sim: Simulation
var interactive := true
var paused := false
var speed := 1.0
var send_ratio := 0.5
var demo := false
var margin_px := 14.0
## Freizuhaltende Ränder (links, oben, rechts, unten) für HUD-Elemente
var fit_margins := Vector4(14, 14, 14, 14)

var _acc := 0.0
var _world: Node2D
var _land: DrawLayer
var _borders: DrawLayer
var _troops: DrawLayer
var _fx: DrawLayer
var _overlay: DrawLayer
var _labels: DrawControl
var _polys: Array = []              ## je Gebiet: Array[Polygon2D]
var _disp_color: Array[Color] = []
var _from_color: Array[Color] = []
var _fade_t: PackedFloat32Array = PackedFloat32Array()
var _flash: PackedFloat32Array = PackedFloat32Array()
var _bump: PackedFloat32Array = PackedFloat32Array()
var _effects: Array = []
var _base_scale := 1.0
var _base_offset := Vector2.ZERO
var zoom := 1.0
var _pan := Vector2.ZERO
var _time_vis := 0.0
var _font: Font
var _game_over_sent := false

# Eingabe
var selection: Array[int] = []
var _dragging := false
var _drag_start := Vector2.ZERO
var _drag_pos := Vector2.ZERO
var _drag_moved := false
var _press_tid := -1
var _press_was_selected := false
var _hover := -1
var _last_added := -1
var _touches: Dictionary = {}
var _pinching := false
var _pan_drag := false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true
	_font = UITheme.font(true)
	resized.connect(_on_resized)


## Startet die Darstellung einer neuen Partie.
func start(p_session: GameSession, p_interactive: bool = true) -> void:
	for c in get_children():
		c.queue_free()
	session = p_session
	sim = session.sim
	interactive = p_interactive
	_acc = 0.0
	_effects.clear()
	selection.clear()
	_game_over_sent = false
	zoom = 1.0
	_pan = Vector2.ZERO
	_world = Node2D.new()
	add_child(_world)
	_land = _layer(_draw_land)
	var n := sim.territories.size()
	_polys.clear()
	_disp_color.clear()
	_from_color.clear()
	_fade_t.resize(n)
	_flash.resize(n)
	_bump.resize(n)
	_fade_t.fill(1.0)
	_flash.fill(0.0)
	_bump.fill(0.0)
	var terr_root := Node2D.new()
	_world.add_child(terr_root)
	for t in sim.territories:
		var arr: Array = []
		var col := Config.faction_color(t.owner)
		for poly in t.polygons:
			var p2 := Polygon2D.new()
			p2.polygon = poly
			p2.color = col
			p2.antialiased = true
			terr_root.add_child(p2)
			arr.append(p2)
		_polys.append(arr)
		_disp_color.append(col)
		_from_color.append(col)
	_borders = _layer(_draw_borders)
	_overlay = _layer(_draw_overlay)
	_troops = _layer(_draw_troops)
	_fx = _layer(_draw_fx)
	_labels = DrawControl.new()
	_labels.fn = _draw_labels
	_labels.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_labels.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_labels)
	_on_resized()


func _layer(fn: Callable) -> DrawLayer:
	var l := DrawLayer.new()
	l.fn = fn
	_world.add_child(l)
	return l


func refresh_palette() -> void:
	if sim == null:
		return
	for t in sim.territories:
		_disp_color[t.id] = Config.faction_color(t.owner)
		_fade_t[t.id] = 1.0
		for p2 in _polys[t.id]:
			p2.color = _disp_color[t.id]


# ================================================================ Transformation

func _on_resized() -> void:
	if session == null:
		return
	var b := session.map.bounds
	var tl := Vector2(fit_margins.x, fit_margins.y)
	var avail := size - tl - Vector2(fit_margins.z, fit_margins.w)
	if avail.x <= 0 or avail.y <= 0:
		return
	_base_scale = minf(avail.x / b.size.x, avail.y / b.size.y)
	_base_offset = tl + (avail - b.size * _base_scale) * 0.5 - b.position * _base_scale
	_apply_transform()


func _apply_transform() -> void:
	if _world == null:
		return
	_clamp_pan()
	var s := _base_scale * zoom
	_world.transform = Transform2D(0.0, Vector2(s, s), 0.0, _base_offset * zoom + _pan)
	_land.queue_redraw()
	_borders.queue_redraw()


func _clamp_pan() -> void:
	var b := session.map.bounds
	var s := _base_scale * zoom
	for axis in 2:
		var lo := _base_offset[axis] * zoom + _pan[axis] + b.position[axis] * s
		var ext := b.size[axis] * s
		if zoom <= 1.001:
			_pan[axis] = _base_offset[axis] * (1.0 - zoom)
		elif ext <= size[axis]:
			_pan[axis] = (size[axis] - ext) * 0.5 - _base_offset[axis] * zoom - b.position[axis] * s
		else:
			var slack := 40.0
			if lo > slack:
				_pan[axis] -= lo - slack
			elif lo + ext < size[axis] - slack:
				_pan[axis] += (size[axis] - slack) - (lo + ext)


func map_to_screen(p: Vector2) -> Vector2:
	return _world.transform * p


func screen_to_map(p: Vector2) -> Vector2:
	return _world.transform.affine_inverse() * p


func _px() -> float:
	return 1.0 / (_base_scale * zoom)


func reset_zoom() -> void:
	zoom = 1.0
	_pan = Vector2.ZERO
	_apply_transform()
	zoom_changed.emit(false)


# ================================================================ Ablauf

func _process(delta: float) -> void:
	if sim == null:
		return
	if not paused:
		_acc += delta * speed
		var steps := 0
		while _acc >= Simulation.FIXED_DT and steps < MAX_STEPS_PER_FRAME:
			session.step(Simulation.FIXED_DT)
			_acc -= Simulation.FIXED_DT
			steps += 1
		if steps == MAX_STEPS_PER_FRAME:
			_acc = 0.0
		_handle_events()
		_time_vis += delta
	_update_colors(delta)
	_prune_selection()
	_troops.queue_redraw()
	_fx.queue_redraw()
	_overlay.queue_redraw()
	_labels.queue_redraw()


func _render_time() -> float:
	return sim.time + (0.0 if paused else _acc)


func _handle_events() -> void:
	for e in sim.drain_events():
		match e.type:
			"capture":
				var tid: int = e.territory
				_from_color[tid] = _disp_color[tid]
				_fade_t[tid] = 0.0
				_flash[tid] = 1.0
				_bump[tid] = 1.0
				var c := Config.faction_color(e.to, true)
				_add_effect("ring", sim.territories[tid].center, c, 0.6)
				_add_effect("burst", sim.territories[tid].center, c, 0.7)
				if not demo:
					if e.to == Faction.PLAYER:
						AudioManager.play("capture")
						SettingsManager.vibrate(25)
					elif e.from == Faction.PLAYER:
						AudioManager.play("lost")
						SettingsManager.vibrate(60)
				captured.emit(tid, e.from, e.to)
			"hit":
				_bump[e.territory] = maxf(_bump[e.territory], 0.5)
				if randf() < 0.35:
					_add_effect("spark", sim.territories[e.territory].center, Config.faction_color(e.owner, true), 0.25)
			"reinforce":
				_bump[e.territory] = maxf(_bump[e.territory], 0.35)
			"send":
				var m: TroopMovement = e.movement
				_add_effect("pulse", m.from_pos, Config.faction_color(m.owner, true), 0.35)
			"game_over":
				if not _game_over_sent:
					_game_over_sent = true
					selection.clear()
					_dragging = false
					game_finished.emit(e.won)


func _update_colors(delta: float) -> void:
	for t in sim.territories:
		var i := t.id
		var target := Config.faction_color(t.owner)
		if _fade_t[i] < 1.0:
			_fade_t[i] = minf(1.0, _fade_t[i] + delta / COLOR_FADE)
			var k := ease(_fade_t[i], -2.0)
			var c := _from_color[i].lerp(target, k)
			if _flash[i] > 0.0:
				c = c.lerp(Color.WHITE, _flash[i] * 0.45)
			_set_color(i, c)
		elif _disp_color[i] != target:
			_from_color[i] = _disp_color[i]
			_fade_t[i] = 0.0
		_flash[i] = maxf(0.0, _flash[i] - delta * 2.5)
		_bump[i] = maxf(0.0, _bump[i] - delta * 4.0)


func _set_color(i: int, c: Color) -> void:
	_disp_color[i] = c
	for p2 in _polys[i]:
		p2.color = c


func _add_effect(kind: String, pos: Vector2, col: Color, dur: float) -> void:
	if _effects.size() > 160:
		return
	var e := {"kind": kind, "pos": pos, "color": col, "t0": _time_vis, "dur": dur}
	if kind == "burst":
		var parts: Array = []
		for k in 16:
			var a := randf() * TAU
			parts.append(Vector2(cos(a), sin(a)) * randf_range(40.0, 110.0))
		e.parts = parts
	_effects.append(e)


## Ausgewählte Gebiete verlieren, die dem Spieler nicht mehr gehören.
func _prune_selection() -> void:
	if selection.is_empty():
		return
	var keep: Array[int] = []
	for tid in selection:
		if sim.territories[tid].owner == Faction.PLAYER:
			keep.append(tid)
	if keep.size() != selection.size():
		selection = keep
		selection_changed.emit(selection.size())


# ================================================================ Zeichnen

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Config.color("sea", "#d4e9f2"))
	# dezente Wellenlinien
	var wave_col := Color(1, 1, 1, 0.18)
	var step := 46.0
	var y := fmod(-_pan.y, step) - step
	while y < size.y + step:
		var pts := PackedVector2Array()
		var x := -20.0
		while x <= size.x + 20.0:
			pts.append(Vector2(x, y + sin(x * 0.03 + y * 0.1) * 4.0))
			x += 24.0
		draw_polyline(pts, wave_col, 2.0, true)
		y += step


func _draw_land(ci: CanvasItem) -> void:
	var px := _px()
	var shadow := Config.color("sea_dark", "#bcd9e6")
	for lm in session.map.landmasses:
		var off := PackedVector2Array()
		for p in lm:
			off.append(p + Vector2(0, 6.0 * px))
		ci.draw_colored_polygon(off, shadow)
	var decor := Config.color("decor_land", "#e6e2d8")
	for lm in session.map.landmasses:
		ci.draw_colored_polygon(lm, decor)


func _draw_borders(ci: CanvasItem) -> void:
	var px := _px()
	var border := Config.color("border", "#ffffff")
	var w := 2.6 * px
	for t in sim.territories:
		for poly in t.polygons:
			var closed := poly.duplicate()
			closed.append(poly[0])
			ci.draw_polyline(closed, border, w, true)
	var coast := Config.color("sea_dark", "#bcd9e6").darkened(0.12)
	for lm in session.map.landmasses:
		var closed := lm.duplicate()
		closed.append(lm[0])
		ci.draw_polyline(closed, Color(coast, 0.55), 1.6 * px, true)


func _draw_overlay(ci: CanvasItem) -> void:
	var px := _px()
	var pulse := 0.5 + 0.5 * sin(_time_vis * 6.0)
	for tid in selection:
		var t := sim.territories[tid]
		for poly in t.polygons:
			var closed := poly.duplicate()
			closed.append(poly[0])
			ci.draw_polyline(closed, Color(1, 1, 1, 0.65 + 0.35 * pulse), (5.0 + 2.0 * pulse) * px, true)
	if not selection.is_empty() and _hover_valid():
		var ht := sim.territories[_hover]
		var hc := Config.faction_color(Faction.PLAYER, true) if ht.owner == Faction.PLAYER else Color("#2b3445")
		for poly in ht.polygons:
			var closed := poly.duplicate()
			closed.append(poly[0])
			ci.draw_polyline(closed, Color(hc, 0.8), 4.0 * px, true)
	# Zielpfeile beim Ziehen
	if _dragging and not selection.is_empty() and _drag_moved:
		var target_pos := screen_to_map(_drag_pos)
		if _hover_valid():
			target_pos = sim.territories[_hover].center
		var col := Config.faction_color(Faction.PLAYER, true)
		for tid in selection:
			if tid == _hover:
				continue
			_draw_arrow(ci, sim.territories[tid].center, target_pos, col, px)


func _hover_valid() -> bool:
	if _hover < 0:
		return false
	if selection.size() == 1 and selection[0] == _hover:
		return false
	return true


func _draw_arrow(ci: CanvasItem, a: Vector2, b: Vector2, col: Color, px: float) -> void:
	var d := b - a
	var dist := d.length()
	if dist < 30.0 * px:
		return
	var dir := d / dist
	var nrm := dir.orthogonal()
	var w := 6.0 * px
	var dash := 16.0 * px
	var gap := 10.0 * px
	var start := 20.0 * px
	var stop := dist - 18.0 * px
	var phase := fmod(_time_vis * 50.0 * px, dash + gap)
	var s := start + phase - (dash + gap)
	while s < stop:
		var s0 := maxf(s, start)
		var s1 := minf(s + dash, stop)
		if s1 > s0:
			ci.draw_line(a + dir * s0, a + dir * s1, Color(col, 0.75), w, true)
		s += dash + gap
	var tip := a + dir * (dist - 4.0 * px)
	var hs := 18.0 * px
	ci.draw_colored_polygon(PackedVector2Array([tip, tip - dir * hs + nrm * hs * 0.6, tip - dir * hs - nrm * hs * 0.6]), Color(col, 0.9))


func _draw_troops(ci: CanvasItem) -> void:
	var px := _px()
	var now := _render_time()
	var r := clampf(4.6 * px, 3.5, 9.0)
	var lane := r * 1.25
	for m in sim.movements:
		var col := Config.faction_color(m.owner, true)
		var rim := col.darkened(0.35)
		var dir := (m.to_pos - m.from_pos).normalized()
		var nrm := dir.orthogonal()
		for i in range(m.arrived, m.count):
			var prog := m.unit_progress(i, now)
			if prog < 0.0:
				break
			var lane_off := float((i % 3) - 1) * lane
			# Einheiten fächern sich nach dem Start auf und laufen am Ziel wieder zusammen
			var spread := minf(prog * 6.0, 1.0) * minf((1.0 - prog) * 6.0, 1.0)
			var pos := m.from_pos.lerp(m.to_pos, prog) + nrm * lane_off * spread
			ci.draw_circle(pos, r * 1.18, rim)
			ci.draw_circle(pos, r, col)


func _draw_fx(ci: CanvasItem) -> void:
	var px := _px()
	var keep: Array = []
	for e in _effects:
		var t: float = (_time_vis - e.t0) / e.dur
		if t >= 1.0:
			continue
		keep.append(e)
		var col: Color = e.color
		match e.kind:
			"ring":
				ci.draw_arc(e.pos, (16.0 + 70.0 * ease(t, 0.4)) * px, 0, TAU, 40, Color(col, 1.0 - t), (6.0 * (1.0 - t) + 1.0) * px, true)
			"pulse":
				ci.draw_arc(e.pos, (14.0 + 26.0 * t) * px, 0, TAU, 28, Color(col, 0.8 * (1.0 - t)), 3.0 * px, true)
			"spark":
				ci.draw_circle(e.pos + Vector2(randf_range(-10, 10), randf_range(-10, 10)) * px, (7.0 * (1.0 - t)) * px, Color(Color.WHITE, 0.8 * (1.0 - t)))
			"burst":
				for v in e.parts:
					var p: Vector2 = e.pos + v * px * ease(t, 0.35)
					ci.draw_circle(p, (5.0 * (1.0 - t) + 1.0) * px, Color(col, 1.0 - t))
	_effects = keep


func _draw_labels(ci: CanvasItem) -> void:
	var s := _base_scale * zoom
	for t in sim.territories:
		var p := map_to_screen(t.center)
		var base_r := clampf(sqrt(t.area) * s * 0.2, 14.0, 23.0)
		var txt := str(t.troops)
		var digits := txt.length()
		var r := base_r + maxf(0, digits - 2) * 3.0
		r *= 1.0 + _bump[t.id] * 0.12
		var dark := Config.faction_color(t.owner, true)
		ci.draw_circle(p + Vector2(0, 2.5), r + 2.5, Color(0, 0, 0, 0.12))
		ci.draw_circle(p, r + 2.5, Color.WHITE)
		ci.draw_circle(p, r, dark)
		# Füllstand der Kapazität als feiner Ring
		if t.owner != Faction.NEUTRAL and t.capacity > 0:
			var fill := clampf(float(t.troops) / t.capacity, 0.0, 1.0)
			if fill >= 1.0:
				ci.draw_arc(p, r - 2.5, 0, TAU, 32, Color(1, 1, 1, 0.55), 2.0, true)
			else:
				ci.draw_arc(p, r - 2.5, -PI / 2, -PI / 2 + TAU * fill, 32, Color(1, 1, 1, 0.35), 2.0, true)
		var fs := int(r * (1.05 if digits <= 2 else 0.9))
		var tw := _font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var asc := _font.get_ascent(fs)
		var desc := _font.get_descent(fs)
		ci.draw_string(_font, p + Vector2(-tw * 0.5, (asc - desc) * 0.5 - 1.0), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)


# ================================================================ Eingabe

func _gui_input(event: InputEvent) -> void:
	if sim == null:
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			_touches[event.index] = event.position
		else:
			_touches.erase(event.index)
		if _touches.size() >= 2:
			_begin_pinch()
		elif _touches.is_empty():
			_pinching = false
		accept_event()
		return
	if event is InputEventScreenDrag:
		if _touches.has(event.index):
			var before: Dictionary = _touches.duplicate()
			_touches[event.index] = event.position
			if _pinching and _touches.size() >= 2:
				_pinch_update(before)
		accept_event()
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom_at(zoom * 1.15, mb.position)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom_at(zoom / 1.15, mb.position)
		elif mb.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			_pan_drag = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if _pinching:
				return
			if mb.pressed:
				_on_press(mb.position)
			else:
				_on_release(mb.position)
		accept_event()
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _pan_drag:
			_pan += mm.relative
			_apply_transform()
		elif not _pinching:
			_on_motion(mm.position)
		accept_event()


func _pick(screen_pos: Vector2) -> int:
	var tol := 34.0 * _px()
	return sim.tm.territory_at(screen_to_map(screen_pos), tol)


func _on_press(pos: Vector2) -> void:
	if not interactive or paused or not sim.is_running():
		return
	var tid := _pick(pos)
	_drag_start = pos
	_drag_pos = pos
	_drag_moved = false
	_press_tid = tid
	_hover = tid
	if tid < 0:
		if not selection.is_empty():
			selection.clear()
			selection_changed.emit(0)
		return
	var t := sim.territories[tid]
	if t.owner == Faction.PLAYER:
		# Bei vorhandener Tipp-Auswahl ist Tippen auf ein weiteres eigenes Gebiet ein Ziel
		# (Verstärkung); Ziehen davon fügt es als weitere Quelle hinzu (siehe _on_motion).
		_press_was_selected = selection.has(tid)
		_dragging = true
		if selection.is_empty():
			selection.append(tid)
			_last_added = tid
			AudioManager.play("select")
			selection_changed.emit(selection.size())
	elif not selection.is_empty():
		# Tipp-Modus: Ziel antippen
		_send_to(tid)
	else:
		_dragging = false


func _on_motion(pos: Vector2) -> void:
	if not _dragging:
		return
	_drag_pos = pos
	if not _drag_moved and pos.distance_to(_drag_start) > TAP_SLOP:
		_drag_moved = true
		if _press_tid >= 0 and not selection.has(_press_tid) and sim.territories[_press_tid].owner == Faction.PLAYER:
			selection.append(_press_tid)
			_last_added = _press_tid
			selection_changed.emit(selection.size())
	var tid := _pick(pos)
	_hover = tid
	# Über weitere eigene Gebiete wischen: sie werden zu zusätzlichen Quellen
	if _drag_moved and tid >= 0 and sim.territories[tid].owner == Faction.PLAYER and not selection.has(tid):
		selection.append(tid)
		_last_added = tid
		AudioManager.play("select", 0.1, -4.0)
		selection_changed.emit(selection.size())


func _on_release(pos: Vector2) -> void:
	if not _dragging:
		return
	_dragging = false
	var tid := _pick(pos)
	_hover = -1
	if not _drag_moved:
		# Tippen
		if tid >= 0 and tid == _press_tid:
			if _press_was_selected:
				if selection.size() == 1:
					selection.clear()
					selection_changed.emit(0)
				else:
					_send_to(tid)
			elif selection.size() >= 1 and not selection.has(tid):
				_send_to(tid)
		return
	if tid < 0:
		selection.clear()
		selection_changed.emit(0)
		return
	if selection.has(tid):
		if tid == _last_added and selection.size() > 1:
			selection.erase(tid)
			_send_to(tid)
		else:
			# zurück auf eine Quelle gezogen: Auswahl bleibt für Tipp-Ziel bestehen
			pass
		return
	_send_to(tid)


func _send_to(target: int) -> void:
	var sources: Array = []
	for s in selection:
		if s != target:
			sources.append(s)
	selection.clear()
	selection_changed.emit(0)
	if sources.is_empty():
		return
	var moves := sim.send_from_many(Faction.PLAYER, sources, target, send_ratio)
	var total := 0
	for m in moves:
		total += m.count
	if total > 0:
		AudioManager.play("send")
		SettingsManager.vibrate(15)
		player_sent.emit(total, moves.size())


func cancel_input() -> void:
	_dragging = false
	_hover = -1
	selection.clear()
	selection_changed.emit(0)


func _begin_pinch() -> void:
	if not _pinching:
		_pinching = true
		cancel_input()


func _pinch_update(before: Dictionary) -> void:
	var keys := _touches.keys()
	var a0: Vector2 = before.get(keys[0], _touches[keys[0]])
	var b0: Vector2 = before.get(keys[1], _touches[keys[1]])
	var a1: Vector2 = _touches[keys[0]]
	var b1: Vector2 = _touches[keys[1]]
	var d0 := a0.distance_to(b0)
	var d1 := a1.distance_to(b1)
	var mid0 := (a0 + b0) * 0.5
	var mid1 := (a1 + b1) * 0.5
	_pan += mid1 - mid0
	if d0 > 1.0:
		_zoom_at(zoom * d1 / d0, mid1)
	else:
		_apply_transform()


## Zoomt so, dass der Kartenpunkt unter pivot an derselben Bildschirmstelle bleibt.
func _zoom_at(z: float, pivot: Vector2) -> void:
	z = clampf(z, 1.0, MAX_ZOOM)
	var map_pt := screen_to_map(pivot)
	zoom = z
	var s := _base_scale * zoom
	# pivot = map_pt * s + _base_offset * zoom + _pan
	_pan = pivot - map_pt * s - _base_offset * zoom
	_apply_transform()
	zoom_changed.emit(zoom > 1.01)
