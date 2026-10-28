extends MenuScreen
## Gesamtstatistik über alle Partien.


func _ready() -> void:
	build_frame(I18n.t("statistics"))
	var st: Dictionary = SaveManager.data.stats
	var stars := 0
	for k in SaveManager.data.progress.levels:
		stars += int(SaveManager.data.progress.levels[k].get("stars", 0))
	var games := int(st.get("games", 0))
	var wins := int(st.get("wins", 0))
	var rate := "–" if games == 0 else "%d %%" % int(round(100.0 * wins / games))
	var rows := [
		["trophy", I18n.t("stat_levels"), "%d / %d" % [int(st.get("levels_completed", 0)), LevelManager.count()]],
		["star", I18n.t("stat_stars"), "%d / %d" % [stars, LevelManager.count() * 3]],
		["play", I18n.t("stat_games"), UITheme.format_int(games)],
		["check", I18n.t("stat_wins"), "%s (%s)" % [UITheme.format_int(wins), rate]],
		["cross", I18n.t("stat_losses"), UITheme.format_int(int(st.get("losses", 0)))],
		["flag", I18n.t("stat_captured"), UITheme.format_int(int(st.get("territories_captured", 0)))],
		["troops", I18n.t("stat_sent"), UITheme.format_int(int(st.get("units_sent", 0)))],
		["troops", I18n.t("stat_lost"), UITheme.format_int(int(st.get("units_lost", 0)))],
		["speed", I18n.t("stat_time"), UITheme.format_time(float(st.get("play_time", 0.0)))],
		["coin", I18n.t("stat_coins"), UITheme.format_int(int(st.get("coins_earned", 0)))],
		["infinity", I18n.t("stat_endless"), str(int(SaveManager.data.endless.get("best_round", 0)))],
	]
	var v := card()
	for r in rows:
		var h := UITheme.hbox(16)
		h.add_child(UIIcon.new(r[0], UITheme.GOLD if r[0] in ["coin", "star", "trophy"] else UITheme.ACCENT, 38))
		var l := UITheme.label(r[1], 25, UITheme.TEXT)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		h.add_child(UITheme.label(r[2], 26, UITheme.TEXT, true, HORIZONTAL_ALIGNMENT_RIGHT))
		v.add_child(h)
