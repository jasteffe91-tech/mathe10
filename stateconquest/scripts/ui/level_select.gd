extends MenuScreen
## Levelauswahl: alle 100 Level mit Sternen und Bestzeit; gesperrte Level mit Schloss.

const COLS := 4


func _ready() -> void:
	build_frame(I18n.t("level_select"))
	var total_stars := 0
	for k in SaveManager.data.progress.levels:
		total_stars += int(SaveManager.data.progress.levels[k].get("stars", 0))
	var info := UITheme.hbox(10)
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	info.add_child(UIIcon.new("star", UITheme.GOLD, 36))
	info.add_child(UITheme.label("%d / %d" % [total_stars, LevelManager.count() * 3], 28, UITheme.TEXT, true))
	content.add_child(info)
	var grid := GridContainer.new()
	grid.columns = COLS
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(grid)
	var unlocked := SaveManager.unlocked_level()
	var current: Control = null
	for n in range(1, LevelManager.count() + 1):
		var tile := _tile(n, n <= unlocked)
		grid.add_child(tile)
		if n == mini(unlocked, LevelManager.count()):
			current = tile
	if current != null:
		await get_tree().process_frame
		await get_tree().process_frame
		scroll.ensure_control_visible(current)


func _tile(n: int, open: bool) -> Control:
	var rec := SaveManager.level_record(n)
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 150)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var lvl := LevelManager.get_level(n)
	var top := 0
	for e in lvl.get("enemies", []):
		top = maxi(top, AIController.DIFFICULTIES.find(str(e.ai)))
	var colors := [Color("#5cc77d"), Color("#5b9cf0"), Color("#f0a04b"), Color("#e0574c")]
	var col: Color = colors[top] if open else Color("#c3ccd8")
	if open and bool(rec.get("completed", false)):
		col = col.lightened(0.15)
	b.add_theme_stylebox_override("normal", UITheme.button_box(col, false, 24))
	b.add_theme_stylebox_override("hover", UITheme.button_box(col.lightened(0.06), false, 24))
	b.add_theme_stylebox_override("pressed", UITheme.button_box(col.darkened(0.1), true, 24))
	b.add_theme_stylebox_override("disabled", UITheme.button_box(col, false, 24))
	var v := UITheme.vbox(2)
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(v)
	if open:
		var num := UITheme.label(str(n), 40, Color.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER)
		num.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(num)
		var stars := HBoxContainer.new()
		stars.alignment = BoxContainer.ALIGNMENT_CENTER
		stars.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var got := int(rec.get("stars", 0))
		for i in 3:
			stars.add_child(UIIcon.new("star" if i < got else "star_empty", Color("#ffe27a") if i < got else Color.WHITE, 26))
		v.add_child(stars)
		var bt: Variant = rec.get("best_time", null)
		var tl := UITheme.label(UITheme.format_time(float(bt)) if bt != null else " ", 18, Color(1, 1, 1, 0.9), true, HORIZONTAL_ALIGNMENT_CENTER)
		tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(tl)
		b.pressed.connect(func():
			AudioManager.play("click")
			GameManager.start_campaign(n))
	else:
		b.disabled = true
		var lock := UIIcon.new("lock", Color(1, 1, 1, 0.9), 44)
		v.add_child(lock)
		var num := UITheme.label(str(n), 22, Color(1, 1, 1, 0.9), true, HORIZONTAL_ALIGNMENT_CENTER)
		num.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(num)
	return b
