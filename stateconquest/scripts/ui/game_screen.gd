extends Control
## Spielbildschirm: Spielfeld, HUD (Pause, Titel, Zeit, Kräfteverhältnis, Versandmenge),
## Tutorial-Hinweise, Pausenmenü und Ergebnisanzeige.

const TOP_H := 168.0
const BOTTOM_H := 150.0

var setup: Dictionary
var session: GameSession
var view: GameView
var _time_label: Label
var _strength: Control
var _ratio_buttons: Array[Button] = []
var _ratio_index := 1
var _fit_button: Button
var _pause_layer: Control
var _result_layer: Control
var _tutorial: Control
var _tutorial_kind := ""
var _tutorial_step := 0
var _hand: Control
var _hand_t := 0.0
var _finished := false
var _strength_values: Array = []
var _strength_timer := 0.0


func configure(params: Dictionary) -> void:
	setup = params.get("setup", {})


func _ready() -> void:
	session = GameSession.create(setup, Config.game, Config.ai)
	view = GameView.new()
	view.set_anchors_preset(Control.PRESET_FULL_RECT)
	view.fit_margins = Vector4(12, TOP_H, 12, BOTTOM_H)
	add_child(view)
	view.start(session, true)
	view.speed = SettingsManager.game_speed()
	_ratio_index = clampi(int(SettingsManager.get_value("send_ratio", Config.game.get("default_send_ratio", 1))), 0, 3)
	view.send_ratio = float(Config.send_ratios()[_ratio_index])
	view.game_finished.connect(_on_game_finished)
	view.captured.connect(_on_captured)
	view.player_sent.connect(_on_player_sent)
	view.selection_changed.connect(_on_selection_changed)
	view.zoom_changed.connect(func(z): _fit_button.visible = z)
	_build_top()
	_build_bottom()
	_build_tutorial()
	SettingsManager.changed.connect(_on_setting_changed)


func on_back() -> void:
	if _result_layer != null:
		UIManager.goto("main_menu")
	elif _pause_layer == null:
		_open_pause()
	else:
		_close_pause()


func _notification(what: int) -> void:
	# App im Hintergrund: automatisch pausieren
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		if view != null and not _finished and _pause_layer == null and is_inside_tree():
			_open_pause()


# ================================================================ HUD

func _build_top() -> void:
	var bar := Control.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.custom_minimum_size = Vector2(0, TOP_H)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)
	var m := UITheme.margin(UITheme.vbox(10), 18, 18, 18, 0)
	m.set_anchors_preset(Control.PRESET_TOP_WIDE)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(m)
	var v: VBoxContainer = m.get_child(0)
	var row := UITheme.hbox(14)
	v.add_child(row)
	var pause := UITheme.icon_button("pause", "secondary", 74)
	pause.pressed.connect(_open_pause)
	row.add_child(pause)
	var tv := UITheme.vbox(0)
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tv.add_child(UITheme.label(LevelManager.setup_title(setup), 32, UITheme.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER))
	var sub := LevelManager.map_name(setup)
	if str(setup.get("mode", "")) == "campaign":
		sub += " · " + _difficulty_text()
	tv.add_child(UITheme.label(sub, 20, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	row.add_child(tv)
	var tp := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(1, 1, 1, 0.85)
	box.set_corner_radius_all(37)
	box.content_margin_left = 18
	box.content_margin_right = 18
	tp.add_theme_stylebox_override("panel", box)
	tp.custom_minimum_size = Vector2(118, 74)
	_time_label = UITheme.label("0:00", 28, UITheme.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	tp.add_child(_time_label)
	row.add_child(tp)
	_strength = Control.new()
	_strength.custom_minimum_size = Vector2(0, 26)
	_strength.draw.connect(_draw_strength)
	_strength.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(_strength)


func _difficulty_text() -> String:
	var best := -1
	for e in setup.get("enemies", []):
		best = maxi(best, AIController.DIFFICULTIES.find(str(e.ai)))
	if best < 0:
		return I18n.t("diff_none")
	return I18n.t("diff_" + AIController.DIFFICULTIES[best])


func _build_bottom() -> void:
	var holder := Control.new()
	holder.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	holder.offset_top = -BOTTOM_H
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_child(center)
	var v := UITheme.vbox(6)
	center.add_child(v)
	v.add_child(UITheme.label(I18n.t("send_amount"), 20, UITheme.MUTED, true, HORIZONTAL_ALIGNMENT_CENTER))
	var pill := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(1, 1, 1, 0.9)
	box.set_corner_radius_all(40)
	box.set_content_margin_all(8)
	box.shadow_color = Color(0.1, 0.2, 0.35, 0.15)
	box.shadow_size = 8
	pill.add_theme_stylebox_override("panel", box)
	var h := UITheme.hbox(8)
	pill.add_child(h)
	v.add_child(pill)
	var ratios := Config.send_ratios()
	for i in ratios.size():
		var b := Button.new()
		b.text = "%d %%" % int(round(float(ratios[i]) * 100.0))
		b.custom_minimum_size = Vector2(132, 74)
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_override("font", UITheme.font(true))
		b.add_theme_font_size_override("font_size", 28)
		b.pressed.connect(_set_ratio.bind(i))
		h.add_child(b)
		_ratio_buttons.append(b)
	_style_ratio_buttons()
	_fit_button = UITheme.icon_button("map", "secondary", 70)
	_fit_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_fit_button.position = Vector2(-90, -BOTTOM_H - 84)
	_fit_button.visible = false
	_fit_button.pressed.connect(func(): view.reset_zoom())
	add_child(_fit_button)
	_fit_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_fit_button.offset_left = -88
	_fit_button.offset_right = -18
	_fit_button.offset_top = -BOTTOM_H - 82
	_fit_button.offset_bottom = -BOTTOM_H - 12


func _style_ratio_buttons() -> void:
	for i in _ratio_buttons.size():
		var b := _ratio_buttons[i]
		var active := i == _ratio_index
		var col: Color = Config.faction_color(Faction.PLAYER, true) if active else Color(0, 0, 0, 0)
		for st in ["normal", "hover", "pressed"]:
			var sb := StyleBoxFlat.new()
			sb.bg_color = col if active else (Color(0.2, 0.3, 0.45, 0.08) if st != "normal" else col)
			sb.set_corner_radius_all(34)
			b.add_theme_stylebox_override(st, sb)
		var fc := Color.WHITE if active else UITheme.TEXT
		for k in ["font_color", "font_hover_color", "font_pressed_color"]:
			b.add_theme_color_override(k, fc)


func _set_ratio(i: int) -> void:
	_ratio_index = i
	view.send_ratio = float(Config.send_ratios()[i])
	_style_ratio_buttons()
	AudioManager.play("click")
	SaveManager.data.settings.send_ratio = i
	if _tutorial_kind == "ratio":
		_tutorial_done()


func _process(delta: float) -> void:
	if view == null or session == null:
		return
	_time_label.text = UITheme.format_time(session.sim.time)
	_strength_timer -= delta
	if _strength_timer <= 0.0:
		_strength_timer = 0.2
		_strength_values.clear()
		for f in session.active_factions():
			_strength_values.append([f, session.sim.strength(f)])
		_strength.queue_redraw()
	if _hand != null and _hand.visible:
		_hand_t += delta
		_hand.queue_redraw()


func _draw_strength() -> void:
	var r := Rect2(Vector2.ZERO, _strength.size)
	var total := 0
	for v in _strength_values:
		total += int(v[1])
	_strength.draw_rect(r, Color(1, 1, 1, 0.6))
	if total <= 0:
		return
	var x := 0.0
	for v in _strength_values:
		var w: float = r.size.x * float(v[1]) / total
		if w <= 0.5:
			continue
		_strength.draw_rect(Rect2(x, 0, w, r.size.y), Config.faction_color(int(v[0]), true))
		x += w


# ================================================================ Tutorial

func _build_tutorial() -> void:
	_tutorial_kind = str(setup.get("tutorial", ""))
	if _tutorial_kind == "" or str(setup.get("mode", "")) != "campaign":
		return
	_tutorial = PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.14, 0.2, 0.3, 0.9)
	box.set_corner_radius_all(26)
	box.set_content_margin_all(18)
	_tutorial.add_theme_stylebox_override("panel", box)
	var l := UITheme.label(I18n.t("tut_" + _tutorial_kind), 24, Color.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.name = "Text"
	_tutorial.add_child(l)
	_tutorial.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tutorial.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_tutorial.offset_left = 30
	_tutorial.offset_right = -30
	_tutorial.offset_top = -BOTTOM_H - 120
	_tutorial.offset_bottom = -BOTTOM_H - 12
	add_child(_tutorial)
	if _tutorial_kind in ["drag", "tap"]:
		_hand = Control.new()
		_hand.set_anchors_preset(Control.PRESET_FULL_RECT)
		_hand.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_hand.draw.connect(_draw_hand)
		add_child(_hand)


func _tutorial_points() -> Array:
	var sim := session.sim
	var mine := sim.tm.owned_by(Faction.PLAYER)
	if mine.is_empty():
		return []
	var src: Territory = mine[0]
	var best: Territory = null
	var best_d := INF
	for t in sim.territories:
		if t.owner == Faction.NEUTRAL:
			var d := t.center.distance_to(src.center)
			if d < best_d and t.troops < src.troops:
				best_d = d
				best = t
	if best == null:
		return []
	return [view.map_to_screen(src.center), view.map_to_screen(best.center)]


func _draw_hand() -> void:
	var pts := _tutorial_points()
	if pts.is_empty():
		return
	var a: Vector2 = pts[0]
	var b: Vector2 = pts[1]
	var col := Color(1, 1, 1, 0.95)
	if _tutorial_kind == "drag":
		var t := fmod(_hand_t, 1.8) / 1.4
		if t <= 1.0:
			var p := a.lerp(b, ease(t, -1.8))
			_hand.draw_line(a, p, Color(1, 1, 1, 0.5), 6.0, true)
			_hand.draw_circle(p, 22.0, Color(0.15, 0.2, 0.3, 0.35))
			_hand.draw_circle(p, 16.0, col)
	else:
		var t := fmod(_hand_t, 2.0)
		var p := a if t < 1.0 else b
		var k := fmod(t, 1.0)
		_hand.draw_arc(p, 18.0 + 22.0 * k, 0, TAU, 32, Color(1, 1, 1, 1.0 - k), 4.0, true)
		_hand.draw_circle(p, 14.0, col)


func _on_player_sent(_count: int, sources: int) -> void:
	match _tutorial_kind:
		"drag", "tap":
			_tutorial_done()
		"multi":
			if sources >= 2:
				_tutorial_done()


func _on_selection_changed(_count: int) -> void:
	pass


func _tutorial_done() -> void:
	if _tutorial == null:
		return
	var t := _tutorial
	_tutorial = null
	_tutorial_kind = ""
	if _hand != null:
		_hand.queue_free()
		_hand = null
	var tw := t.create_tween()
	tw.tween_property(t, "modulate:a", 0.0, 0.4)
	tw.tween_callback(t.queue_free)


func _on_captured(_tid: int, _from: int, to: int) -> void:
	if to == Faction.PLAYER and _tutorial_kind == "zoom" and session.sim.time > 8.0:
		_tutorial_done()


# ================================================================ Pause

func _open_pause() -> void:
	if _pause_layer != null or _finished:
		return
	view.paused = true
	view.cancel_input()
	_pause_layer = _overlay()
	var v := _overlay_panel(_pause_layer, I18n.t("pause"))
	var resume := UITheme.button(I18n.t("resume"), "primary", "play")
	resume.pressed.connect(_close_pause)
	v.add_child(resume)
	var restart := UITheme.button(I18n.t("restart"), "secondary", "restart")
	restart.pressed.connect(func(): GameManager.restart())
	v.add_child(restart)
	var settings := UITheme.button(I18n.t("settings"), "secondary", "gear")
	settings.pressed.connect(_open_settings)
	v.add_child(settings)
	var menu := UITheme.button(I18n.t("main_menu"), "secondary", "home")
	menu.pressed.connect(func(): UIManager.goto("main_menu"))
	v.add_child(menu)


func _close_pause() -> void:
	if _pause_layer == null:
		return
	_pause_layer.queue_free()
	_pause_layer = null
	view.paused = false


func _open_settings() -> void:
	var s: Control = load("res://scripts/ui/settings_screen.gd").new()
	s.configure({"overlay": true})
	s.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(s)


func _on_setting_changed(key: String) -> void:
	match key:
		"game_speed":
			view.speed = SettingsManager.game_speed()
		"palette":
			view.refresh_palette()
			_style_ratio_buttons()


func _overlay() -> Control:
	var layer := Control.new()
	layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0.1, 0.15, 0.25, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(dim)
	add_child(layer)
	return layer


func _overlay_panel(layer: Control, title: String, min_w: float = 560.0) -> VBoxContainer:
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := UITheme.panel()
	panel.custom_minimum_size = Vector2(min_w, 0)
	center.add_child(panel)
	var v := UITheme.vbox(18)
	panel.add_child(v)
	if title != "":
		v.add_child(UITheme.title(title, 48))
	panel.pivot_offset = panel.size * 0.5
	panel.scale = Vector2(0.85, 0.85)
	panel.modulate.a = 0.0
	var tw := panel.create_tween().set_parallel()
	tw.tween_property(panel, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(panel, "modulate:a", 1.0, 0.15)
	panel.resized.connect(func(): panel.pivot_offset = panel.size * 0.5)
	return v


# ================================================================ Ergebnis

func _on_game_finished(won: bool) -> void:
	if _finished:
		return
	_finished = true
	_close_pause()
	if _tutorial != null:
		_tutorial_done()
	var sim := session.sim
	var pf := sim.factions[Faction.PLAYER]
	var result := {
		"won": won, "time": sim.end_time, "captured": pf.territories_captured,
		"lost": pf.units_lost, "sent": pf.units_sent, "regions": sim.territories.size(),
	}
	var reward := GameManager.finish(result)
	AudioManager.play("victory" if won else "defeat", 0.0)
	SettingsManager.vibrate(80 if won else 150)
	await get_tree().create_timer(0.9 if won else 0.6).timeout
	if not is_inside_tree():
		return
	_show_result(result, reward)


func _show_result(result: Dictionary, reward: Dictionary) -> void:
	var won := bool(result.won)
	_result_layer = _overlay()
	if won:
		var conf := Confetti.new()
		conf.set_anchors_preset(Control.PRESET_FULL_RECT)
		_result_layer.add_child(conf)
	var mode := str(setup.get("mode", ""))
	var title := I18n.t("victory") if won else I18n.t("defeat")
	var v := _overlay_panel(_result_layer, "", 600.0)
	var tl := UITheme.title(title, 64)
	tl.add_theme_color_override("font_color", UITheme.GOLD.darkened(0.1) if won else UITheme.BAD)
	v.add_child(tl)
	if won and mode == "campaign":
		var stars := HBoxContainer.new()
		stars.alignment = BoxContainer.ALIGNMENT_CENTER
		stars.add_theme_constant_override("separation", 12)
		v.add_child(stars)
		for i in 3:
			var st := UIIcon.new("star" if i < int(reward.stars) else "star_empty", UITheme.GOLD if i < int(reward.stars) else UITheme.MUTED, 76)
			st.pivot_offset = Vector2(38, 38)
			stars.add_child(st)
			if i < int(reward.stars):
				st.scale = Vector2.ZERO
				var tw := st.create_tween()
				tw.tween_interval(0.25 + i * 0.22)
				tw.tween_callback(func(): AudioManager.play("select", 0.0, -2.0))
				tw.tween_property(st, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	elif not won:
		var sub := UITheme.label(I18n.t("defeat_hint"), 24, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
		sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sub.custom_minimum_size = Vector2(520, 0)
		v.add_child(sub)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 30)
	grid.add_theme_constant_override("v_separation", 6)
	var rows := [[I18n.t("time"), UITheme.format_time(float(result.time))],
		[I18n.t("captured_regions"), str(result.captured)],
		[I18n.t("lost_units"), str(result.lost)]]
	if mode == "endless":
		rows.append([I18n.t("best_round"), str(reward.get("best_round", 0))])
	if mode == "campaign" and won:
		var rec := SaveManager.level_record(int(setup.level_id))
		rows.append([I18n.t("best_time"), UITheme.format_time(float(rec.get("best_time", result.time)))])
	for r in rows:
		grid.add_child(UITheme.label(r[0], 24, UITheme.MUTED))
		var val := UITheme.label(r[1], 26, UITheme.TEXT, true, HORIZONTAL_ALIGNMENT_RIGHT)
		val.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(val)
	var gc := CenterContainer.new()
	gc.add_child(grid)
	v.add_child(gc)
	if mode != "sandbox":
		var ch := HBoxContainer.new()
		ch.alignment = BoxContainer.ALIGNMENT_CENTER
		ch.add_theme_constant_override("separation", 10)
		ch.add_child(UIIcon.new("coin", UITheme.GOLD, 44))
		var cl := UITheme.label("+0", 40, UITheme.GOLD.darkened(0.2), true)
		ch.add_child(cl)
		v.add_child(ch)
		var target := int(reward.coins)
		var tw := cl.create_tween()
		tw.tween_interval(0.4)
		tw.tween_method(func(x: float): cl.text = "+" + UITheme.format_int(int(x)), 0.0, float(target), 0.8)
		if bool(reward.get("new_best", false)):
			v.add_child(UITheme.label(I18n.t("new_record"), 24, UITheme.GOOD, true, HORIZONTAL_ALIGNMENT_CENTER))
	else:
		v.add_child(UITheme.label(I18n.t("sandbox_no_progress"), 22, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(Control.new())
	if won:
		var next_text := I18n.t("next_level")
		if mode == "endless":
			next_text = I18n.t("next_round")
		elif mode != "campaign":
			next_text = I18n.t("new_map")
		if not GameManager.is_last_level():
			var nb := UITheme.button(next_text, "good", "next")
			nb.pressed.connect(func(): GameManager.next())
			v.add_child(nb)
		else:
			v.add_child(UITheme.label(I18n.t("campaign_complete"), 26, UITheme.GOOD, true, HORIZONTAL_ALIGNMENT_CENTER))
		var again := UITheme.button(I18n.t("play_again"), "secondary", "restart")
		again.pressed.connect(func(): GameManager.restart())
		v.add_child(again)
	else:
		var retry_text := I18n.t("new_run") if mode == "endless" else I18n.t("try_again")
		var rb := UITheme.button(retry_text, "primary", "restart")
		rb.pressed.connect(func():
			if mode == "endless":
				GameManager.start_endless(1)
			else:
				GameManager.restart())
		v.add_child(rb)
		if mode != "sandbox":
			var ub := UITheme.button(I18n.t("upgrades"), "gold", "up")
			ub.pressed.connect(func(): UIManager.goto("upgrades"))
			v.add_child(ub)
	var mb := UITheme.button(I18n.t("main_menu"), "ghost", "home", 70)
	mb.pressed.connect(func(): UIManager.goto("main_menu"))
	v.add_child(mb)


## Konfetti-Regen für die Siegesanzeige.
class Confetti extends Control:
	var parts: Array = []
	var t := 0.0
	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		var cols := [Color("#5b9cf0"), Color("#f5c84c"), Color("#5cc77d"), Color("#ee6b5f"), Color("#b58cf0"), Color.WHITE]
		for i in 90:
			parts.append({"x": randf(), "y": randf_range(-0.6, -0.02), "vy": randf_range(0.18, 0.38),
				"rot": randf() * TAU, "vr": randf_range(-6, 6), "c": cols[i % cols.size()], "w": randf_range(8, 16)})
	func _process(delta: float) -> void:
		t += delta
		for p in parts:
			p.y += p.vy * delta
			p.rot += p.vr * delta
		queue_redraw()
		if t > 5.0:
			queue_free()
	func _draw() -> void:
		var a := clampf((5.0 - t) / 1.0, 0.0, 1.0)
		for p in parts:
			var pos := Vector2(p.x * size.x + sin(t * 2.0 + p.rot) * 12.0, p.y * size.y)
			draw_set_transform(pos, p.rot, Vector2.ONE)
			draw_rect(Rect2(-p.w * 0.5, -p.w * 0.25, p.w, p.w * 0.5), Color(p.c, a))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
