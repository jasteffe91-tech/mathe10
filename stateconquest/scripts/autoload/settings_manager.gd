extends Node
## Einstellungen (Musik, Sound, Vibration, Spielgeschwindigkeit, Sprache, Farbpalette).
## Werte liegen im Spielstand und werden bei jeder Änderung sofort gespeichert.

signal changed(key: String)

const GAME_SPEEDS := [0.75, 1.0, 1.25, 1.5, 2.0]
const PALETTES := ["standard", "contrast"]


func _ready() -> void:
	var lang := str(get_value("language", ""))
	if lang == "":
		lang = "de" if OS.get_locale_language() == "de" else "en"
		SaveManager.data.settings.language = lang
	I18n.set_language(lang)
	Config.palette_name = str(get_value("palette", "standard"))


func get_value(key: String, fallback: Variant = null) -> Variant:
	return SaveManager.data.settings.get(key, fallback)


func set_value(key: String, value: Variant) -> void:
	SaveManager.data.settings[key] = value
	match key:
		"language":
			I18n.set_language(str(value))
		"palette":
			Config.palette_name = str(value)
	SaveManager.save()
	changed.emit(key)


func game_speed() -> float:
	return float(get_value("game_speed", 1.0))


func vibrate(ms: int = 30) -> void:
	if bool(get_value("vibration", true)) and (OS.has_feature("android") or OS.has_feature("ios")):
		Input.vibrate_handheld(ms)
