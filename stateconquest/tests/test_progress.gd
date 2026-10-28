extends TestCase
## Upgrades, Münzen, Belohnungen, Speichern und Laden.

const TEST_SAVE := "user://test_save.json"
const TEST_BAK := "user://test_save.bak.json"

var _orig_data: Dictionary
var _orig_path: String
var _orig_bak: String


func before() -> void:
	_orig_data = SaveManager.data.duplicate(true)
	_orig_path = SaveManager.path
	_orig_bak = SaveManager.backup_path
	SaveManager.path = TEST_SAVE
	SaveManager.backup_path = TEST_BAK
	for p in [TEST_SAVE, TEST_BAK]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)
	SaveManager.data = SaveManager.defaults()


func after() -> void:
	for p in [TEST_SAVE, TEST_BAK]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)
	SaveManager.path = _orig_path
	SaveManager.backup_path = _orig_bak
	SaveManager.data = _orig_data


func test_upgrade_definitions() -> void:
	var ids := []
	for d in UpgradeManager.defs():
		ids.append(d.id)
		check(int(d.get("max_level", 0)) >= 20, "%s hat mindestens 20 Stufen" % d.id)
		var last := 0
		for l in range(1, int(d.max_level) + 1):
			var c := UpgradeManager.cost_for(d.id, l)
			check(c > last, "%s: Kosten steigen (Stufe %d)" % [d.id, l])
			last = c
	for need in ["start_troops", "production", "speed", "start_territories", "coin_bonus"]:
		check(ids.has(need), "Upgrade %s vorhanden" % need)


func test_buy_upgrade() -> void:
	SaveManager.data.coins = 0
	check(not UpgradeManager.buy("production"), "Ohne Münzen kein Kauf")
	var c1 := UpgradeManager.next_cost("production")
	SaveManager.data.coins = c1 + 5
	check(UpgradeManager.buy("production"), "Kauf mit genug Münzen")
	eq(UpgradeManager.level("production"), 1, "Stufe 1")
	eq(SaveManager.coins(), 5, "Münzen abgezogen")
	check(UpgradeManager.next_cost("production") > c1, "Nächste Stufe teurer")
	SaveManager.data.upgrades["speed"] = UpgradeManager.max_level("speed")
	SaveManager.data.coins = 10000000
	check(not UpgradeManager.buy("speed"), "Maximalstufe kann nicht überschritten werden")
	eq(UpgradeManager.next_cost("speed"), -1, "Keine Kosten über dem Maximum")


func test_upgrade_effects_in_game() -> void:
	SaveManager.data.upgrades = {"start_troops": 5, "production": 10, "speed": 4, "start_territories": 6, "coin_bonus": 2}
	var mods := UpgradeManager.player_mods()
	eq(int(mods.start_troops), 10, "5 Stufen Starttruppen = +10")
	near(float(mods.production), 0.30, 0.0001, "10 Stufen Produktion = +30 %")
	near(float(mods.speed), 0.10, 0.0001, "4 Stufen Tempo = +10 %")
	eq(int(mods.extra_territories), 2, "Stufe 6 = 2 Zusatzgebiete")
	near(UpgradeManager.coin_multiplier(), 1.10, 0.0001, "Münzbonus +10 %")
	var setup := {"map": {"template": "germany", "regions": 10}, "seed": 5,
		"enemies": [{"faction": 2, "ai": "easy"}], "start_troops": 20, "enemy_start_troops": 20,
		"bonus_slots": 1, "player_mods": mods}
	var s := GameSession.create(setup, Config.game, Config.ai)
	var owned := s.sim.tm.owned_by(Faction.PLAYER)
	eq(owned.size(), 2, "Ein Bonus-Startgebiet (Level erlaubt 1)")
	var main_troops := 0
	for t in owned:
		main_troops = maxi(main_troops, t.troops)
	eq(main_troops, 30, "Hauptgebiet: 20 + 10 Starttruppen")
	near(s.sim.factions[Faction.PLAYER].production_mult, 1.3, 0.0001, "Produktionsbonus aktiv")
	near(s.sim.factions[Faction.PLAYER].speed_mult, 1.1, 0.0001, "Tempobonus aktiv")
	near(s.sim.factions[Faction.RED].production_mult, 1.0, 0.0001, "KI ohne Bonus (kein Schummeln)")


func test_campaign_reward_and_unlock() -> void:
	GameManager.current_setup = LevelManager.campaign_setup(1)
	var r := GameManager.finish({"won": true, "time": 10.0, "captured": 4, "lost": 3, "sent": 30, "regions": 5})
	eq(int(r.stars), 3, "Schnell gewonnen: 3 Sterne")
	check(int(r.coins) > 0, "Münzen erhalten")
	eq(SaveManager.coins(), int(r.coins), "Münzen gutgeschrieben")
	eq(SaveManager.unlocked_level(), 2, "Level 2 freigeschaltet")
	var r2 := GameManager.finish({"won": true, "time": 9.0, "captured": 4, "lost": 3, "sent": 30, "regions": 5})
	check(int(r2.coins) < int(r.coins), "Wiederholung gibt weniger Münzen")
	check(bool(r2.new_best), "Neue Bestzeit erkannt")
	near(float(SaveManager.level_record(1).best_time), 9.0, 0.01, "Bestzeit gespeichert")
	GameManager.current_setup = LevelManager.campaign_setup(2)
	var r3 := GameManager.finish({"won": false, "time": 30.0, "captured": 2, "lost": 20, "sent": 30, "regions": 5})
	eq(SaveManager.unlocked_level(), 2, "Niederlage schaltet nichts frei")
	check(int(r3.coins) >= 0, "Niederlage: höchstens Trostmünzen")
	eq(int(SaveManager.data.stats.games), 3, "Statistik zählt Partien")
	eq(int(SaveManager.data.stats.losses), 1, "Statistik zählt Niederlagen")


func test_sandbox_does_not_touch_progress() -> void:
	SaveManager.data.coins = 123
	GameManager.current_setup = LevelManager.custom_setup({"map": "random", "size": 0, "enemies": 1}, true)
	var r := GameManager.finish({"won": true, "time": 20.0, "captured": 7, "lost": 0, "sent": 10, "regions": 8})
	eq(int(r.coins), 0, "Sandbox: keine Münzen")
	eq(SaveManager.coins(), 123, "Sandbox: Münzen unverändert")
	eq(int(SaveManager.data.stats.games), 0, "Sandbox: keine Statistik")


func test_save_and_load() -> void:
	SaveManager.data.coins = 4321
	SaveManager.data.upgrades = {"speed": 3}
	SaveManager.data.progress.unlocked = 17
	SaveManager.data.progress.levels["5"] = {"stars": 2, "best_time": 77.5, "completed": true}
	SaveManager.data.settings.music = false
	check(SaveManager.save(), "Speichern erfolgreich")
	SaveManager.data = SaveManager.defaults()
	SaveManager.load_game()
	eq(SaveManager.coins(), 4321, "Münzen geladen")
	eq(UpgradeManager.level("speed"), 3, "Upgrade-Stufe geladen")
	eq(SaveManager.unlocked_level(), 17, "Freischaltung geladen")
	eq(int(SaveManager.level_record(5).stars), 2, "Sterne geladen")
	near(float(SaveManager.level_record(5).best_time), 77.5, 0.001, "Bestzeit geladen")
	eq(SaveManager.data.settings.music, false, "Einstellung geladen")


func test_corrupt_save_uses_backup() -> void:
	SaveManager.data.coins = 50
	SaveManager.save()
	SaveManager.data.coins = 60
	SaveManager.save()   # Sicherung enthält jetzt 50
	var f := FileAccess.open(TEST_SAVE, FileAccess.WRITE)
	f.store_string("{ kaputt")
	f.close()
	SaveManager.load_game()
	eq(SaveManager.coins(), 50, "Beschädigter Spielstand: Sicherungskopie wird geladen")


func test_reset_keeps_settings() -> void:
	SaveManager.data.coins = 999
	SaveManager.data.settings.language = "en"
	SaveManager.reset_progress()
	eq(SaveManager.coins(), 0, "Münzen zurückgesetzt")
	eq(SaveManager.data.settings.language, "en", "Einstellungen bleiben erhalten")
	eq(SaveManager.unlocked_level(), 1, "Fortschritt zurückgesetzt")
