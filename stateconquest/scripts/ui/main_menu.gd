extends Control
## Hauptmenü mit einer live laufenden KI-Demo-Partie im Hintergrund.

var _demo: GameView
var _demo_session: GameSession
var _restart_timer := -1.0


func _ready() -> void:
	_start_demo()
	var shade := ColorRect.new()
	shade.color = Color(0.92, 0.96, 0.98, 0.68)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	var root := UITheme.vbox(18)
	var m := UITheme.margin(root, 40, 40, 40, 40)
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(m)

	var top := UITheme.hbox(10)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	top.add_child(UITheme.coin_pill(SaveManager.coins()))
	root.add_child(top)

	var fill1 := Control.new()
	fill1.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(fill1)
	root.add_child(_logo())
	var tag := UITheme.label(I18n.t("tagline"), 24, UITheme.MUTED, true, HORIZONTAL_ALIGNMENT_CENTER)
	tag.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(tag)
	var fill2 := Control.new()
	fill2.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fill2.size_flags_stretch_ratio = 0.7
	root.add_child(fill2)

	var buttons := UITheme.vbox(16)
	var cur := clampi(int(SaveManager.data.progress.get("current", 1)), 1, mini(SaveManager.unlocked_level(), LevelManager.count()))
	var play := UITheme.button(I18n.t("play_level", [cur]), "good", "play", 104)
	play.add_theme_font_size_override("font_size", 36)
	play.pressed.connect(func(): GameManager.continue_campaign())
	buttons.add_child(play)
	var levels := UITheme.button(I18n.t("level_select"), "primary", "map")
	levels.pressed.connect(func(): UIManager.goto("level_select"))
	buttons.add_child(levels)
	var modes := UITheme.button(I18n.t("game_modes"), "primary", "infinity")
	modes.pressed.connect(func(): UIManager.goto("modes"))
	buttons.add_child(modes)
	var row := UITheme.hbox(16)
	var upg := UITheme.button(I18n.t("upgrades"), "gold", "up")
	upg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	upg.pressed.connect(func(): UIManager.goto("upgrades"))
	row.add_child(upg)
	var stats := UITheme.icon_button("chart", "secondary", 84)
	stats.tooltip_text = I18n.t("statistics")
	stats.pressed.connect(func(): UIManager.goto("stats"))
	row.add_child(stats)
	var settings := UITheme.icon_button("gear", "secondary", 84)
	settings.tooltip_text = I18n.t("settings")
	settings.pressed.connect(func(): UIManager.goto("settings"))
	row.add_child(settings)
	buttons.add_child(row)
	var bc := CenterContainer.new()
	buttons.custom_minimum_size = Vector2(minf(560, get_viewport_rect().size.x - 80), 0)
	bc.add_child(buttons)
	root.add_child(bc)
	var foot := UITheme.label(I18n.t("no_ads_note"), 18, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	root.add_child(foot)


func _logo() -> Control:
	var v := UITheme.vbox(0)
	var l1 := UITheme.label("STATE", 92, Config.faction_color(Faction.PLAYER, true), true, HORIZONTAL_ALIGNMENT_CENTER)
	var l2 := UITheme.label("CONQUEST", 62, Config.faction_color(Faction.RED, true), true, HORIZONTAL_ALIGNMENT_CENTER)
	for l in [l1, l2]:
		l.add_theme_color_override("font_outline_color", Color.WHITE)
		l.add_theme_constant_override("outline_size", 16)
	l2.add_theme_constant_override("line_spacing", -10)
	v.add_child(l1)
	v.add_child(l2)
	return v


func _start_demo() -> void:
	var setup := {
		"mode": "demo", "map": {"random": true, "regions": 18, "style": ""},
		"seed": randi() % 100000 + 1, "player_start_mode": "random",
		"enemies": [{"faction": 2, "ai": "medium"}, {"faction": 3, "ai": "medium"}, {"faction": 4, "ai": "medium"}],
		"start_troops": 25, "enemy_start_troops": 25, "neutral_troops": [3, 10], "production_mult": 1.4,
	}
	_demo_session = GameSession.create(setup, Config.game, Config.ai)
	_demo_session.ais.append(AIController.new(_demo_session.sim, Faction.PLAYER, "medium", Config.ai.get("medium", {}), 99))
	if _demo == null:
		_demo = GameView.new()
		_demo.set_anchors_preset(Control.PRESET_FULL_RECT)
		_demo.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_demo.demo = true
		add_child(_demo)
		move_child(_demo, 0)
		_demo.game_finished.connect(func(_w): _restart_timer = 2.0)
	_demo.start(_demo_session, false)
	_demo.speed = 1.3


func _process(delta: float) -> void:
	if _restart_timer > 0.0:
		_restart_timer -= delta
		if _restart_timer <= 0.0:
			_start_demo()
	elif _demo_session != null and _demo_session.sim.time > 150.0:
		_restart_timer = 0.01
