extends Node
## Einfache Übersetzung über JSON-Wörterbücher in data/i18n (de, en).

signal language_changed

const LANGS := ["de", "en"]

var lang: String = "de"
var _dicts: Dictionary = {}


func _init() -> void:
	for l in LANGS:
		_dicts[l] = JsonUtil.load_file("res://data/i18n/%s.json" % l, {})


func set_language(l: String) -> void:
	if not LANGS.has(l) or l == lang:
		return
	lang = l
	TranslationServer.set_locale(l)
	language_changed.emit()


## Übersetzt key; args werden per %-Formatierung eingesetzt.
func t(key: String, args: Array = []) -> String:
	var d: Dictionary = _dicts.get(lang, {})
	var s: String = str(d.get(key, _dicts.get("de", {}).get(key, key)))
	if args.is_empty():
		return s
	return s % args


func has_key(key: String) -> bool:
	return _dicts.get(lang, {}).has(key)
