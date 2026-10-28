extends Node
## Wechselt zwischen den Bildschirmen (mit kurzer Überblendung) und zeigt Hinweise an.

const SCREENS := {
	"main_menu": "res://scripts/ui/main_menu.gd",
	"level_select": "res://scripts/ui/level_select.gd",
	"upgrades": "res://scripts/ui/upgrades_screen.gd",
	"settings": "res://scripts/ui/settings_screen.gd",
	"stats": "res://scripts/ui/stats_screen.gd",
	"modes": "res://scripts/ui/modes_screen.gd",
	"free_play": "res://scripts/ui/custom_game_screen.gd",
	"sandbox": "res://scripts/ui/custom_game_screen.gd",
	"game": "res://scripts/ui/game_screen.gd",
}

var root: Control
var current: Control
var current_name: String = ""
var _fade: ColorRect
var _busy := false


## Wird von der Hauptszene aufgerufen.
func attach(p_root: Control) -> void:
	root = p_root
	root.theme = UITheme.get_theme()
	_fade = ColorRect.new()
	_fade.color = Color(0.89, 0.94, 0.97, 0.0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.z_index = 100
	root.add_child(_fade)


func goto(screen_name: String, params: Dictionary = {}) -> void:
	if root == null or not SCREENS.has(screen_name):
		push_error("Unbekannter Bildschirm: %s" % screen_name)
		return
	if _busy:
		return
	_busy = true
	_fade.mouse_filter = Control.MOUSE_FILTER_STOP
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 1.0, 0.12 if current != null else 0.0)
	await tw.finished
	if current != null:
		current.queue_free()
	var scr: Control = load(SCREENS[screen_name]).new()
	scr.name = screen_name.capitalize().replace(" ", "")
	scr.set_anchors_preset(Control.PRESET_FULL_RECT)
	if scr.has_method("configure"):
		params["screen"] = screen_name
		scr.configure(params)
	root.add_child(scr)
	root.move_child(_fade, root.get_child_count() - 1)
	current = scr
	current_name = screen_name
	var tw2 := create_tween()
	tw2.tween_property(_fade, "color:a", 0.0, 0.18)
	await tw2.finished
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_busy = false


## Kurze Einblendung am unteren Rand.
func toast(text: String, seconds: float = 1.8) -> void:
	if root == null:
		return
	var p := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.14, 0.2, 0.3, 0.92)
	box.set_corner_radius_all(24)
	box.set_content_margin_all(18)
	p.add_theme_stylebox_override("panel", box)
	var l := UITheme.label(text, 24, Color.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	p.add_child(l)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.anchor_left = 0.08
	p.anchor_right = 0.92
	p.anchor_top = 0.8
	p.anchor_bottom = 0.8
	p.z_index = 90
	root.add_child(p)
	p.modulate.a = 0.0
	var tw := p.create_tween()
	tw.tween_property(p, "modulate:a", 1.0, 0.15)
	tw.tween_interval(seconds)
	tw.tween_property(p, "modulate:a", 0.0, 0.3)
	tw.tween_callback(p.queue_free)


## Ja/Nein-Abfrage als Overlay. on_yes wird bei Bestätigung aufgerufen.
func confirm(text: String, on_yes: Callable, yes_text: String = "", danger: bool = true) -> void:
	var layer := Control.new()
	layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.z_index = 80
	var dim := ColorRect.new()
	dim.color = Color(0.1, 0.15, 0.25, 0.5)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := UITheme.panel()
	panel.custom_minimum_size = Vector2(560, 0)
	var v := UITheme.vbox(22)
	var l := UITheme.label(text, 28, UITheme.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(500, 0)
	v.add_child(l)
	var h := UITheme.hbox(16)
	var no := UITheme.button(I18n.t("cancel"), "secondary")
	no.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var yes := UITheme.button(yes_text if yes_text != "" else I18n.t("yes"), "danger" if danger else "primary")
	yes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(no)
	h.add_child(yes)
	v.add_child(h)
	panel.add_child(v)
	center.add_child(panel)
	root.add_child(layer)
	no.pressed.connect(layer.queue_free)
	yes.pressed.connect(func():
		layer.queue_free()
		on_yes.call())
