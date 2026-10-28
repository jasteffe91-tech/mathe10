extends Control
## Einstiegspunkt: hängt den UIManager ein und öffnet das Hauptmenü.


func _ready() -> void:
	UIManager.attach(self)
	get_tree().root.min_size = Vector2i(360, 640)
	var args := OS.get_cmdline_user_args()
	# Für automatisierte Screenshots: -- --screen=game --level=5
	var screen := "main_menu"
	var level := 0
	for a in args:
		if a.begins_with("--screen="):
			screen = a.substr(9)
		elif a.begins_with("--level="):
			level = int(a.substr(8))
	if level > 0:
		GameManager.start_campaign(level)
	else:
		UIManager.goto(screen)


func _notification(what: int) -> void:
	# Android-Zurück-Taste bzw. Fenster schließen: Fortschritt ist ohnehin gespeichert.
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if UIManager.current_name == "main_menu":
			get_tree().quit()
		elif UIManager.current != null and UIManager.current.has_method("on_back"):
			UIManager.current.on_back()
		else:
			UIManager.goto("main_menu")
