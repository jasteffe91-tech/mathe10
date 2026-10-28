extends Node
## Spielt Soundeffekte (kleiner Player-Pool) und die Hintergrundmusik.
## Alle Klänge sind selbst erzeugt (tools/make_sounds.py).

const SFX := ["send", "capture", "lost", "click", "select", "victory", "defeat", "upgrade"]
const POOL := 6

var _streams: Dictionary = {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0
var _music: AudioStreamPlayer
var _last_play: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for s in SFX:
		var path := "res://assets/audio/%s.wav" % s
		if ResourceLoader.exists(path):
			_streams[s] = load(path)
	for i in POOL:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	_music = AudioStreamPlayer.new()
	_music.volume_db = -9.0
	add_child(_music)
	if ResourceLoader.exists("res://assets/audio/music.wav"):
		_music.stream = load("res://assets/audio/music.wav")
		_music.finished.connect(_on_music_finished)
	SettingsManager.changed.connect(_on_setting)
	update_music()


## Spielt einen Effekt; gleiche Effekte werden kurz gedrosselt, damit es nicht knattert.
func play(name: String, pitch_jitter: float = 0.05, volume_db: float = 0.0) -> void:
	if not bool(SettingsManager.get_value("sfx", true)) or not _streams.has(name):
		return
	var now := Time.get_ticks_msec()
	if now - int(_last_play.get(name, -1000)) < 45:
		return
	_last_play[name] = now
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _streams[name]
	p.pitch_scale = 1.0 + randf_range(-pitch_jitter, pitch_jitter)
	p.volume_db = volume_db
	p.play()


func update_music() -> void:
	if _music.stream == null:
		return
	var on := bool(SettingsManager.get_value("music", true))
	if on and not _music.playing:
		_music.play()
	elif not on and _music.playing:
		_music.stop()


func _on_music_finished() -> void:
	if bool(SettingsManager.get_value("music", true)):
		_music.play()


func _on_setting(key: String) -> void:
	if key == "music":
		update_music()
