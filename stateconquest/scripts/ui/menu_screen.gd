class_name MenuScreen
extends Control
## Basis für Menübildschirme: Hintergrund, Kopfzeile mit Zurück-Knopf, Titel und Münzen,
## scrollbarer Inhalt sowie wiederverwendbare Bedienelemente.

var content: VBoxContainer
var scroll: ScrollContainer
var params: Dictionary = {}
var _coin_label: Label


func configure(p: Dictionary) -> void:
	params = p


func build_frame(title_text: String, show_coins: bool = true, use_scroll: bool = true) -> void:
	add_child(UITheme.background())
	var outer := UITheme.vbox(14)
	var m := UITheme.margin(outer, 22, 22, 22, 16)
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(m)
	var head := UITheme.hbox(14)
	var back := UITheme.icon_button("back", "secondary", 74)
	back.pressed.connect(on_back)
	head.add_child(back)
	var t := UITheme.title(title_text, 40)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	if show_coins:
		var pill := UITheme.coin_pill(SaveManager.coins())
		_coin_label = pill.find_child("Amount", true, false)
		head.add_child(pill)
	else:
		var spacer := Control.new()
		spacer.custom_minimum_size = Vector2(74, 0)
		head.add_child(spacer)
	outer.add_child(head)
	content = UITheme.vbox(16)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if use_scroll:
		scroll = ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		var pad := UITheme.margin(content, 4, 6, 4, 24)
		pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		scroll.add_child(pad)
		outer.add_child(scroll)
	else:
		content.size_flags_vertical = Control.SIZE_EXPAND_FILL
		outer.add_child(content)


func refresh_coins() -> void:
	if _coin_label != null:
		_coin_label.text = UITheme.format_int(SaveManager.coins())


func on_back() -> void:
	if bool(params.get("overlay", false)):
		queue_free()
	else:
		UIManager.goto("main_menu")


# ---------------------------------------------------------------- Bausteine

func card() -> VBoxContainer:
	var p := UITheme.panel()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := UITheme.vbox(12)
	p.add_child(v)
	content.add_child(p)
	return v


func section(text: String) -> void:
	var l := UITheme.label(text, 24, UITheme.MUTED, true)
	content.add_child(UITheme.margin(l, 8, 8, 0, 0))


## Zeile mit Beschriftung und Stufenwahl ◀ Wert ▶.
func add_stepper(parent: Container, text: String, labels: Array, index: int, on_change: Callable) -> Label:
	var row := UITheme.hbox(10)
	var l := UITheme.label(text, 25, UITheme.TEXT, true)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.add_child(l)
	var minus := UITheme.icon_button("back", "secondary", 62)
	var plus := UITheme.icon_button("next", "secondary", 62)
	var val := UITheme.label(str(labels[clampi(index, 0, labels.size() - 1)]), 25, UITheme.ACCENT_DARK, true, HORIZONTAL_ALIGNMENT_CENTER)
	val.custom_minimum_size = Vector2(170, 0)
	val.clip_text = true
	var state := {"i": clampi(index, 0, labels.size() - 1)}
	var update := func(delta: int):
		state.i = clampi(state.i + delta, 0, labels.size() - 1)
		val.text = str(labels[state.i])
		on_change.call(state.i)
	minus.pressed.connect(update.bind(-1))
	plus.pressed.connect(update.bind(1))
	row.add_child(minus)
	row.add_child(val)
	row.add_child(plus)
	parent.add_child(row)
	return val


## Zeile mit Beschriftung, optionalem Icon und Ein/Aus-Schalter.
func add_toggle(parent: Container, text: String, icon: String, on: bool, on_change: Callable) -> Button:
	var row := UITheme.hbox(14)
	if icon != "":
		row.add_child(UIIcon.new(icon, UITheme.ACCENT, 40))
	var l := UITheme.label(text, 26, UITheme.TEXT, true)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(l)
	var b := UITheme.button("", "good" if on else "secondary", "", 64)
	b.custom_minimum_size = Vector2(150, 64)
	var state := {"on": on}
	var refresh := func():
		b.text = I18n.t("on") if state.on else I18n.t("off")
		var c := UITheme.GOOD if state.on else Color("#dfe5ee")
		b.add_theme_stylebox_override("normal", UITheme.button_box(c))
		b.add_theme_stylebox_override("hover", UITheme.button_box(c.lightened(0.05)))
		b.add_theme_stylebox_override("pressed", UITheme.button_box(c.darkened(0.1), true))
		for k in ["font_color", "font_hover_color", "font_pressed_color"]:
			b.add_theme_color_override(k, Color.WHITE if state.on else UITheme.MUTED)
	refresh.call()
	b.pressed.connect(func():
		state.on = not state.on
		refresh.call()
		on_change.call(state.on))
	row.add_child(b)
	parent.add_child(row)
	return b


## Segmentauswahl (z. B. Spielgeschwindigkeit, Sprache).
func add_segments(parent: Container, text: String, labels: Array, index: int, on_change: Callable) -> void:
	var v := UITheme.vbox(8)
	v.add_child(UITheme.label(text, 26, UITheme.TEXT, true))
	var h := UITheme.hbox(8)
	var buttons: Array[Button] = []
	var style := func(sel: int):
		for i in buttons.size():
			var active := i == sel
			var c := UITheme.ACCENT if active else Color("#e8eef5")
			buttons[i].add_theme_stylebox_override("normal", UITheme.button_box(c, false, 18))
			buttons[i].add_theme_stylebox_override("hover", UITheme.button_box(c.lightened(0.05), false, 18))
			buttons[i].add_theme_stylebox_override("pressed", UITheme.button_box(c.darkened(0.1), true, 18))
			for k in ["font_color", "font_hover_color", "font_pressed_color"]:
				buttons[i].add_theme_color_override(k, Color.WHITE if active else UITheme.TEXT)
	for i in labels.size():
		var b := UITheme.button(str(labels[i]), "secondary", "", 64)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 24)
		b.pressed.connect(func():
			style.call(i)
			on_change.call(i))
		buttons.append(b)
		h.add_child(b)
	style.call(index)
	v.add_child(h)
	parent.add_child(v)
