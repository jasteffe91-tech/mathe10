class_name UITheme
extends RefCounted
## Gemeinsames Aussehen aller Menüs und Hilfsfunktionen zum Bauen von UI-Elementen.

const TEXT := Color("#24324a")
const MUTED := Color("#6b7a90")
const ACCENT := Color("#3a7de0")
const ACCENT_DARK := Color("#2a5fb0")
const GOLD := Color("#f0b429")
const GOOD := Color("#3fb56a")
const BAD := Color("#e0574c")
const PANEL := Color("#ffffff")
const BG := Color("#e4f0f6")
const BG2 := Color("#cfe5ef")

static var _theme: Theme
static var _bold: Font
static var _black: Font


static func font(black: bool = false) -> Font:
	if _bold == null:
		_bold = _load_font("res://assets/fonts/nunito_700.woff2")
		_black = _load_font("res://assets/fonts/nunito_900.woff2")
	return _black if black else _bold


static func _load_font(path: String) -> Font:
	if ResourceLoader.exists(path):
		var f: Variant = load(path)
		if f is Font:
			return f
	return ThemeDB.fallback_font


static func get_theme() -> Theme:
	if _theme != null:
		return _theme
	var t := Theme.new()
	t.default_font = font(false)
	t.default_font_size = 26
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_color", "Button", Color.WHITE)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_focus_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.7))
	t.set_font("font", "Button", font(true))
	t.set_font_size("font_size", "Button", 28)
	var base := button_box(ACCENT)
	t.set_stylebox("normal", "Button", base)
	t.set_stylebox("hover", "Button", button_box(ACCENT.lightened(0.08)))
	t.set_stylebox("pressed", "Button", button_box(ACCENT_DARK, true))
	t.set_stylebox("disabled", "Button", button_box(Color("#a9b4c4")))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	var panel := StyleBoxFlat.new()
	panel.bg_color = PANEL
	panel.set_corner_radius_all(28)
	panel.shadow_color = Color(0.1, 0.2, 0.35, 0.12)
	panel.shadow_size = 14
	panel.shadow_offset = Vector2(0, 6)
	panel.set_content_margin_all(24)
	t.set_stylebox("panel", "PanelContainer", panel)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.2, 0.3, 0.45, 0.25)
	sb.set_corner_radius_all(6)
	t.set_stylebox("scroll", "VScrollBar", sb)
	var grab := StyleBoxFlat.new()
	grab.bg_color = Color(0.2, 0.3, 0.45, 0.45)
	grab.set_corner_radius_all(6)
	grab.content_margin_left = 6
	grab.content_margin_right = 6
	t.set_stylebox("grabber", "VScrollBar", grab)
	t.set_stylebox("grabber_highlight", "VScrollBar", grab)
	t.set_stylebox("grabber_pressed", "VScrollBar", grab)
	_theme = t
	return t


static func button_box(c: Color, pressed: bool = false, radius: int = 22) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = c
	s.set_corner_radius_all(radius)
	s.border_width_bottom = 0 if pressed else 6
	s.border_color = c.darkened(0.25)
	s.content_margin_left = 24
	s.content_margin_right = 24
	s.content_margin_top = 12 + (6 if pressed else 0)
	s.content_margin_bottom = 12
	s.shadow_color = Color(0.1, 0.2, 0.35, 0.15)
	s.shadow_size = 0 if pressed else 6
	s.shadow_offset = Vector2(0, 3)
	return s


## Button mit optionalem Icon. kind: "primary", "secondary", "gold", "good", "danger", "ghost"
static func button(text: String, kind: String = "primary", icon: String = "", min_h: float = 84.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	b.focus_mode = Control.FOCUS_NONE
	var c := ACCENT
	var fc := Color.WHITE
	match kind:
		"secondary":
			c = Color.WHITE
			fc = TEXT
		"gold":
			c = GOLD
		"good":
			c = GOOD
		"danger":
			c = BAD
		"ghost":
			c = Color(1, 1, 1, 0.55)
			fc = TEXT
	b.add_theme_stylebox_override("normal", button_box(c))
	b.add_theme_stylebox_override("hover", button_box(c.lightened(0.06)))
	b.add_theme_stylebox_override("pressed", button_box(c.darkened(0.12), true))
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(k, fc)
	if icon != "":
		var ic := UIIcon.new(icon, fc, min_h * 0.42)
		ic.set_anchors_preset(Control.PRESET_CENTER_LEFT)
		ic.position = Vector2(22, -min_h * 0.21 - 3)
		b.add_child(ic)
		b.set_meta("icon", ic)
	b.pressed.connect(func(): AudioManager.play("click"))
	return b


## Runder Icon-Button (z. B. Pause, Zurück).
static func icon_button(icon: String, kind: String = "secondary", size: float = 76.0) -> Button:
	var b := button("", kind, "", size)
	b.custom_minimum_size = Vector2(size, size)
	var col: Color = ACCENT_DARK if kind in ["secondary", "ghost"] else Color.WHITE
	for st in ["normal", "hover", "pressed"]:
		var box: StyleBoxFlat = b.get_theme_stylebox(st)
		box.set_corner_radius_all(int(size / 2))
		box.content_margin_left = 0
		box.content_margin_right = 0
	var ic := UIIcon.new(icon, col, size * 0.4)
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	b.add_child(ic)
	return b


static func label(text: String, size: int = 26, color: Color = TEXT, black: bool = false, align: int = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if black:
		l.add_theme_font_override("font", font(true))
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


static func title(text: String, size: int = 44) -> Label:
	return label(text, size, TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)


static func panel() -> PanelContainer:
	return PanelContainer.new()


static func vbox(sep: int = 16) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v


static func hbox(sep: int = 16) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h


static func margin(c: Control, l: int, t: int, r: int, b: int) -> MarginContainer:
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_left", l)
	m.add_theme_constant_override("margin_top", t)
	m.add_theme_constant_override("margin_right", r)
	m.add_theme_constant_override("margin_bottom", b)
	m.add_child(c)
	return m


## Münzanzeige als Pille mit Icon.
static func coin_pill(amount: int) -> PanelContainer:
	var p := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(1, 1, 1, 0.9)
	box.set_corner_radius_all(30)
	box.content_margin_left = 14
	box.content_margin_right = 20
	box.content_margin_top = 6
	box.content_margin_bottom = 6
	p.add_theme_stylebox_override("panel", box)
	var h := hbox(8)
	h.add_child(UIIcon.new("coin", GOLD, 34))
	var l := label(format_int(amount), 28, TEXT, true)
	l.name = "Amount"
	h.add_child(l)
	p.add_child(h)
	return p


static func format_int(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "." + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out


static func format_time(seconds: float) -> String:
	var t := int(seconds)
	if t >= 3600:
		return "%d:%02d:%02d" % [t / 3600, (t / 60) % 60, t % 60]
	return "%d:%02d" % [t / 60, t % 60]


## Hintergrund mit sanftem Verlauf.
static func background() -> TextureRect:
	var g := Gradient.new()
	g.set_color(0, Color("#eaf4f9"))
	g.set_color(1, Color("#cfe4ee"))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0.3, 1)
	gt.width = 64
	gt.height = 128
	var tr := TextureRect.new()
	tr.texture = gt
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr
