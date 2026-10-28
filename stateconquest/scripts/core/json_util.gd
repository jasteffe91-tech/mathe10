class_name JsonUtil
extends RefCounted
## Kleine Hilfsfunktionen zum Lesen und Schreiben von JSON-Dateien.


static func load_file(path: String, fallback: Variant = {}) -> Variant:
	if not FileAccess.file_exists(path):
		push_warning("JSON fehlt: %s" % path)
		return fallback
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return fallback
	var text := f.get_as_text()
	f.close()
	var json := JSON.new()
	if json.parse(text) != OK:
		push_error("JSON-Fehler in %s (Zeile %d): %s" % [path, json.get_error_line(), json.get_error_message()])
		return fallback
	return json.data


## Schreibt atomar: erst in eine Temp-Datei, dann umbenennen.
static func save_file(path: String, data: Variant) -> bool:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("Kann nicht schreiben: %s" % tmp)
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	return DirAccess.rename_absolute(tmp, path) == OK


## Tiefe Zusammenführung: Werte aus override überschreiben base, fehlende bleiben erhalten.
static func merge(base: Dictionary, override: Dictionary) -> Dictionary:
	var out := base.duplicate(true)
	for k in override:
		if out.has(k) and out[k] is Dictionary and override[k] is Dictionary:
			out[k] = merge(out[k], override[k])
		else:
			out[k] = override[k]
	return out
