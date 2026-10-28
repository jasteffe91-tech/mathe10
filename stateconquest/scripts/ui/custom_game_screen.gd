extends MenuScreen
## Einstellungen für freies Spiel und Sandbox. Die Sandbox beeinflusst die Kampagne nicht
## und erlaubt beliebige Upgrade-Stufen (unbegrenzte Spielwährung).

const PERCENTS := [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
const TROOPS := [5, 10, 15, 20, 30, 40, 60, 80]
const NEUTRALS := [[0, 3], [4, 14], [10, 25], [20, 45]]

var sandbox := false
var opts: Dictionary = {}


func _ready() -> void:
	sandbox = str(params.get("screen", "")) == "sandbox"
	var store_key := "sandbox" if sandbox else "free_play"
	opts = {"size": 1, "map": "random", "enemies": 2, "difficulty": "medium", "start_troops": 20,
		"production": 1.0, "speed": 1.0, "restrict": false, "neutral_min": 4, "neutral_max": 14,
		"player_starts": 1, "enemy_starts": 1, "enemy_start_troops": 20, "upgrades": {}}
	opts = JsonUtil.merge(opts, SaveManager.data.get(store_key, {}))
	build_frame(I18n.t("sandbox") if sandbox else I18n.t("free_play"), not sandbox)
	if sandbox:
		var note := UITheme.label(I18n.t("sandbox_note"), 22, UITheme.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
		note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		content.add_child(note)

	var map_card := card()
	var map_ids: Array = ["random"]
	map_ids.append_array(MapGenerator.template_ids())
	var map_labels: Array = []
	for id in map_ids:
		if id == "random":
			map_labels.append(I18n.t("random_map"))
		else:
			var n: Dictionary = MapGenerator.load_template(id).get("name", {})
			map_labels.append(str(n.get(I18n.lang, n.get("de", id))))
	add_stepper(map_card, I18n.t("opt_map"), map_labels, maxi(0, map_ids.find(opts.map)), func(i): opts.map = map_ids[i])
	add_stepper(map_card, I18n.t("opt_size"), [I18n.t("size_small"), I18n.t("size_medium"), I18n.t("size_large"), I18n.t("size_huge")],
		int(opts.size), func(i): opts.size = i)
	add_toggle(map_card, I18n.t("opt_restrict"), "", bool(opts.restrict), func(on): opts.restrict = on)

	var foe := card()
	var enemy_min := 0 if sandbox else 1
	var enemy_labels: Array = []
	for i in range(enemy_min, 4):
		enemy_labels.append(str(i))
	add_stepper(foe, I18n.t("opt_enemies"), enemy_labels, int(opts.enemies) - enemy_min, func(i): opts.enemies = i + enemy_min)
	var diffs := AIController.DIFFICULTIES
	var diff_labels: Array = []
	for d in diffs:
		diff_labels.append(I18n.t("diff_" + d))
	add_stepper(foe, I18n.t("opt_difficulty"), diff_labels, maxi(0, diffs.find(opts.difficulty)), func(i): opts.difficulty = diffs[i])

	var rules := card()
	add_stepper(rules, I18n.t("opt_start_troops"), TROOPS, _nearest(TROOPS, opts.start_troops), func(i): opts.start_troops = TROOPS[i])
	var pct: Array = []
	for p in PERCENTS:
		pct.append("%d %%" % int(p * 100))
	add_stepper(rules, I18n.t("opt_production"), pct, _nearest(PERCENTS, opts.production), func(i): opts.production = PERCENTS[i])
	add_stepper(rules, I18n.t("opt_speed"), pct, _nearest(PERCENTS, opts.speed), func(i): opts.speed = PERCENTS[i])

	if sandbox:
		var sb := card()
		var nl: Array = []
		for n in NEUTRALS:
			nl.append("%d–%d" % n)
		var ni := 1
		for i in NEUTRALS.size():
			if NEUTRALS[i][0] == int(opts.neutral_min):
				ni = i
		add_stepper(sb, I18n.t("opt_neutral"), nl, ni, func(i):
			opts.neutral_min = NEUTRALS[i][0]
			opts.neutral_max = NEUTRALS[i][1])
		add_stepper(sb, I18n.t("opt_player_starts"), [1, 2, 3, 4, 5], int(opts.player_starts) - 1, func(i): opts.player_starts = i + 1)
		add_stepper(sb, I18n.t("opt_enemy_starts"), [1, 2, 3], int(opts.enemy_starts) - 1, func(i): opts.enemy_starts = i + 1)
		add_stepper(sb, I18n.t("opt_enemy_troops"), TROOPS, _nearest(TROOPS, opts.enemy_start_troops), func(i): opts.enemy_start_troops = TROOPS[i])
		section(I18n.t("sandbox_upgrades"))
		var up := card()
		for d in UpgradeManager.defs():
			var id := str(d.id)
			var mx := int(d.get("max_level", 20))
			var lv: Array = []
			for k in mx + 1:
				lv.append(str(k))
			var cur := int(opts.upgrades.get(id, 0))
			add_stepper(up, I18n.t("upg_" + id), lv, cur, func(i): opts.upgrades[id] = i)
	var start := UITheme.button(I18n.t("start"), "good", "play", 96)
	start.pressed.connect(_start)
	content.add_child(start)


func _nearest(arr: Array, v: Variant) -> int:
	var best := 0
	for i in arr.size():
		if absf(float(arr[i]) - float(v)) < absf(float(arr[best]) - float(v)):
			best = i
	return best


func _start() -> void:
	SaveManager.data["sandbox" if sandbox else "free_play"] = opts.duplicate(true)
	SaveManager.save()
	var o := opts.duplicate(true)
	o.seed = 0
	GameManager.start(LevelManager.custom_setup(o, sandbox))


func on_back() -> void:
	UIManager.goto("modes")
