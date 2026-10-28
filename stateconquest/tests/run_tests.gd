extends Node
## Führt alle Tests in res://tests/test_*.gd aus.
## Aufruf: godot --headless --path . res://tests/test_runner.tscn


func _ready() -> void:
	await get_tree().process_frame
	var files: Array[String] = []
	var d := DirAccess.open("res://tests")
	for f in d.get_files():
		if f.begins_with("test_") and f.ends_with(".gd") and f != "test_case.gd":
			files.append("res://tests/" + f)
	files.sort()
	var total_checks := 0
	var total_fail := 0
	var total_tests := 0
	var t0 := Time.get_ticks_msec()
	for path in files:
		var script: GDScript = load(path)
		var inst: TestCase = script.new()
		print("== ", path.get_file())
		for m in inst.get_method_list():
			var test_name: String = m.name
			if not test_name.begins_with("test_"):
				continue
			total_tests += 1
			inst._current = test_name
			var before := inst.failures.size()
			if inst.has_method("before"):
				inst.before()
			var tt := Time.get_ticks_msec()
			inst.call(test_name)
			if inst.has_method("after"):
				inst.after()
			var ok := inst.failures.size() == before
			print("  %s %s (%d ms)" % ["OK  " if ok else "FAIL", test_name, Time.get_ticks_msec() - tt])
			for i in range(before, inst.failures.size()):
				print("       - ", inst.failures[i])
		total_checks += inst.checks
		total_fail += inst.failures.size()
	print("")
	print("%d Tests, %d Prüfungen, %d Fehler, %d ms" % [total_tests, total_checks, total_fail, Time.get_ticks_msec() - t0])
	get_tree().quit(1 if total_fail > 0 else 0)
