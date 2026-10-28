extends MenuScreen
## Einstellungen. Kann als eigener Bildschirm oder als Overlay (aus dem Pausenmenü) geöffnet werden.


func _ready() -> void:
	build_frame(I18n.t("settings"), false)
	var audio := card()
	add_toggle(audio, I18n.t("music"), "music", bool(SettingsManager.get_value("music", true)),
		func(on): SettingsManager.set_value("music", on))
	add_toggle(audio, I18n.t("sfx"), "sound", bool(SettingsManager.get_value("sfx", true)),
		func(on): SettingsManager.set_value("sfx", on))
	var vib := add_toggle(audio, I18n.t("vibration"), "vibrate", bool(SettingsManager.get_value("vibration", true)),
		func(on): SettingsManager.set_value("vibration", on))
	if not (OS.has_feature("android") or OS.has_feature("ios")):
		vib.tooltip_text = I18n.t("vibration_unsupported")

	var game := card()
	var speeds := SettingsManager.GAME_SPEEDS
	var labels: Array = []
	for s in speeds:
		labels.append(("%.2f" % s).rstrip("0").rstrip(".").replace(".", ",") + "×")
	add_segments(game, I18n.t("game_speed"), labels, maxi(0, speeds.find(SettingsManager.game_speed())),
		func(i): SettingsManager.set_value("game_speed", speeds[i]))
	add_segments(game, I18n.t("language"), ["Deutsch", "English"], 0 if I18n.lang == "de" else 1,
		func(i): _set_language(["de", "en"][i]))
	var pals := SettingsManager.PALETTES
	add_segments(game, I18n.t("palette"), [I18n.t("palette_standard"), I18n.t("palette_contrast")],
		maxi(0, pals.find(str(SettingsManager.get_value("palette", "standard")))),
		func(i): SettingsManager.set_value("palette", pals[i]))

	if not bool(params.get("overlay", false)):
		var danger := card()
		var reset := UITheme.button(I18n.t("reset_progress"), "danger", "restart")
		reset.pressed.connect(func():
			UIManager.confirm(I18n.t("reset_confirm"), func():
				SaveManager.reset_progress()
				UIManager.toast(I18n.t("reset_done"))
				UIManager.goto("main_menu"), I18n.t("reset_yes")))
		danger.add_child(reset)

	var about := UITheme.label(I18n.t("about_text", [ProjectSettings.get_setting("application/config/version", "1.0")]), 19, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(about)
	if bool(params.get("overlay", false)):
		# als Overlay über dem Spiel: Eingaben nicht durchreichen
		mouse_filter = Control.MOUSE_FILTER_STOP


func _set_language(l: String) -> void:
	SettingsManager.set_value("language", l)
	# Bildschirm neu aufbauen, damit alle Texte die neue Sprache zeigen
	if bool(params.get("overlay", false)):
		var p := get_parent()
		var s: Control = load("res://scripts/ui/settings_screen.gd").new()
		s.configure(params)
		s.set_anchors_preset(Control.PRESET_FULL_RECT)
		p.add_child(s)
		queue_free()
	else:
		UIManager.goto("settings")
