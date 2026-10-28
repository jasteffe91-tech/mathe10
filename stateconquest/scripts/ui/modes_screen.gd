extends MenuScreen
## Zusätzliche Spielmodi: Endlos, freies Spiel, Sandbox.


func _ready() -> void:
	build_frame(I18n.t("game_modes"))
	_mode_card("infinity", I18n.t("endless"), I18n.t("endless_desc", [int(SaveManager.data.endless.get("best_round", 0))]),
		I18n.t("start"), func(): GameManager.start_endless(1))
	_mode_card("dice", I18n.t("free_play"), I18n.t("free_play_desc"), I18n.t("configure"),
		func(): UIManager.goto("free_play"))
	_mode_card("cube", I18n.t("sandbox"), I18n.t("sandbox_desc"), I18n.t("configure"),
		func(): UIManager.goto("sandbox"))


func _mode_card(icon: String, title_text: String, desc: String, btn: String, action: Callable) -> void:
	var v := card()
	var h := UITheme.hbox(18)
	h.add_child(UIIcon.new(icon, UITheme.ACCENT, 64))
	var info := UITheme.vbox(4)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_child(UITheme.label(title_text, 32, UITheme.TEXT, true))
	var d := UITheme.label(desc, 22, UITheme.MUTED)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(d)
	h.add_child(info)
	v.add_child(h)
	var b := UITheme.button(btn, "primary", "play")
	b.pressed.connect(action)
	v.add_child(b)
