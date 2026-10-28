extends SceneTree
## Lädt alle Skripte, damit Parse-Fehler gesammelt sichtbar werden.
## Aufruf: godot --headless --path . --script res://tools/check_scripts.gd

var _done := false


func _process(_delta: float) -> bool:
	if _done:
		return true
	_done = true
	_run()
	return false


func _run() -> void:
	var files: Array[String] = []
	_collect("res://scripts", files)
	_collect("res://tests", files)
	var bad := 0
	for f in files:
		var s: Script = load(f)
		if s == null or not s.can_instantiate():
			bad += 1
			print("FEHLER: ", f)
	print("%d Skripte geprüft, %d fehlerhaft" % [files.size(), bad])
	quit(1 if bad > 0 else 0)


func _collect(dir: String, out: Array[String]) -> void:
	var d := DirAccess.open(dir)
	if d == null:
		return
	for f in d.get_files():
		if f.ends_with(".gd"):
			out.append(dir + "/" + f)
	for sub in d.get_directories():
		_collect(dir + "/" + sub, out)
