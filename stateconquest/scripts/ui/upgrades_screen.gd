extends MenuScreen
## Upgrade-Menü: Münzen ausgeben für dauerhafte Verbesserungen.

var _cards: Dictionary = {}


func _ready() -> void:
	build_frame(I18n.t("upgrades"))
	var hint := UITheme.label(I18n.t("upgrades_hint"), 22, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(hint)
	for d in UpgradeManager.defs():
		_build_card(d)
	UpgradeManager.upgraded.connect(_on_upgraded)


func _build_card(d: Dictionary) -> void:
	var id := str(d.id)
	var v := card()
	var h := UITheme.hbox(18)
	v.add_child(h)
	var icon_bg := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color("#eaf2fd")
	box.set_corner_radius_all(40)
	box.set_content_margin_all(14)
	icon_bg.add_theme_stylebox_override("panel", box)
	icon_bg.add_child(UIIcon.new(str(d.get("icon", "up")), UITheme.ACCENT, 52))
	icon_bg.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	h.add_child(icon_bg)
	var info := UITheme.vbox(4)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_child(UITheme.label(I18n.t("upg_" + id), 28, UITheme.TEXT, true))
	var desc := UITheme.label(I18n.t("upg_" + id + "_desc"), 21, UITheme.MUTED)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(desc)
	var lvl := UITheme.label("", 22, UITheme.ACCENT_DARK, true)
	info.add_child(lvl)
	var eff := UITheme.label("", 22, UITheme.TEXT, true)
	eff.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(eff)
	h.add_child(info)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, 14)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color("#e3e9f1")
	bg.set_corner_radius_all(7)
	var fg := StyleBoxFlat.new()
	fg.bg_color = UITheme.ACCENT
	fg.set_corner_radius_all(7)
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fg)
	v.add_child(bar)
	var buy := UITheme.button("", "gold", "coin", 76)
	buy.pressed.connect(_buy.bind(id))
	v.add_child(buy)
	_cards[id] = {"level": lvl, "effect": eff, "bar": bar, "buy": buy, "panel": v.get_parent()}
	_refresh(id)


func _refresh(id: String) -> void:
	var c: Dictionary = _cards[id]
	var l := UpgradeManager.level(id)
	var mx := UpgradeManager.max_level(id)
	c.level.text = I18n.t("level_of", [l, mx])
	c.bar.max_value = mx
	c.bar.value = l
	var now := UpgradeManager.effect_text(id, l)
	if l >= mx:
		c.effect.text = I18n.t("upg_now", [now])
		c.buy.text = I18n.t("maxed")
		c.buy.disabled = true
		var ic: Variant = c.buy.get_meta("icon", null)
		if ic != null:
			ic.visible = false
	else:
		c.effect.text = I18n.t("upg_now_next", [now, UpgradeManager.effect_text(id, l + 1)])
		var cost := UpgradeManager.next_cost(id)
		c.buy.text = UITheme.format_int(cost)
		c.buy.disabled = not UpgradeManager.can_buy(id)


func _buy(id: String) -> void:
	if UpgradeManager.buy(id):
		AudioManager.play("upgrade", 0.0)
		SettingsManager.vibrate(20)
		var p: Control = _cards[id].panel
		p.pivot_offset = p.size * 0.5
		var tw := p.create_tween()
		tw.tween_property(p, "scale", Vector2(1.03, 1.03), 0.08)
		tw.tween_property(p, "scale", Vector2.ONE, 0.15)
	else:
		UIManager.toast(I18n.t("not_enough_coins"))


func _on_upgraded(_id: String) -> void:
	refresh_coins()
	for id in _cards:
		_refresh(id)
