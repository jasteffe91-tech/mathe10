extends Node
## Dauerhafte Verbesserungen, bezahlt mit erspielten Münzen.
## Werte und Kosten stehen in data/config/upgrades.json.

signal upgraded(id: String)


func defs() -> Array:
	return Config.upgrades.get("upgrades", [])


func get_def(id: String) -> Dictionary:
	for d in defs():
		if d.id == id:
			return d
	return {}


func level(id: String) -> int:
	return int(SaveManager.data.upgrades.get(id, 0))


func max_level(id: String) -> int:
	return int(get_def(id).get("max_level", 20))


## Kosten, um von Stufe lvl-1 auf Stufe lvl zu kommen.
func cost_for(id: String, lvl: int) -> int:
	var d := get_def(id)
	var c := float(d.get("cost_base", 50)) * pow(float(d.get("cost_growth", 1.15)), lvl - 1)
	return int(round(c / 5.0)) * 5


func next_cost(id: String) -> int:
	var l := level(id)
	if l >= max_level(id):
		return -1
	return cost_for(id, l + 1)


func can_buy(id: String) -> bool:
	var c := next_cost(id)
	return c >= 0 and SaveManager.coins() >= c


func buy(id: String) -> bool:
	if not can_buy(id):
		return false
	var c := next_cost(id)
	if not SaveManager.spend_coins(c):
		return false
	SaveManager.data.upgrades[id] = level(id) + 1
	SaveManager.save()
	upgraded.emit(id)
	return true


## Zahlenwert eines Upgrades auf Stufe lvl.
func value(id: String, lvl: int) -> float:
	var d := get_def(id)
	if d.has("values"):
		var vals: Array = d["values"]
		return float(vals[clampi(lvl, 0, vals.size() - 1)]) if not vals.is_empty() else 0.0
	return float(d.get("value_per_level", 0.0)) * lvl


func extra_territories(lvl: int) -> int:
	if lvl <= 0:
		return 0
	var every := int(get_def("start_territories").get("territories_every", 5))
	@warning_ignore("integer_division")
	return 1 + (lvl - 1) / maxi(every, 1)


func bonus_garrison(lvl: int) -> int:
	return int(get_def("start_territories").get("garrison_per_level", 1)) * lvl


func coin_multiplier(lvl: int = -1) -> float:
	if lvl < 0:
		lvl = level("coin_bonus")
	return 1.0 + value("coin_bonus", lvl)


## Modifikatoren des Spielers für GameSession. overrides: {id: stufe} (Sandbox).
func player_mods(overrides: Dictionary = {}) -> Dictionary:
	var lv := func(id: String) -> int: return int(overrides.get(id, level(id)))
	return {
		"start_troops": int(value("start_troops", lv.call("start_troops"))),
		"production": value("production", lv.call("production")),
		"speed": value("speed", lv.call("speed")),
		"extra_territories": extra_territories(lv.call("start_territories")),
		"bonus_garrison": bonus_garrison(lv.call("start_territories")),
	}


## Kurzbeschreibung des Effekts auf Stufe lvl, z. B. "+12 %".
func effect_text(id: String, lvl: int) -> String:
	match id:
		"start_troops":
			return I18n.t("upg_eff_troops", [int(value(id, lvl))])
		"start_territories":
			return I18n.t("upg_eff_territories", [extra_territories(lvl), bonus_garrison(lvl)])
		_:
			return I18n.t("upg_eff_percent", [int(round(value(id, lvl) * 100.0))])
