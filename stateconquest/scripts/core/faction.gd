class_name Faction
extends RefCounted
## Eine Partei (Spieler, KI oder neutral) mit ihren Multiplikatoren und Statistiken.

const NEUTRAL := 0
const PLAYER := 1
const RED := 2
const GREEN := 3
const YELLOW := 4
const COUNT := 5

const COLOR_KEYS := ["neutral", "blue", "red", "green", "yellow"]

var id: int = NEUTRAL
var is_human: bool = false
var ai_difficulty: String = ""
var production_mult: float = 1.0
var speed_mult: float = 1.0
var alive: bool = true

# Statistik der laufenden Partie
var units_produced: int = 0
var units_sent: int = 0
var units_lost: int = 0
var territories_captured: int = 0
var territories_lost: int = 0


func _init(p_id: int = NEUTRAL) -> void:
	id = p_id
