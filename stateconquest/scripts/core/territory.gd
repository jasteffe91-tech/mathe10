class_name Territory
extends RefCounted
## Ein eroberbares Gebiet. Reine Spieldaten, keine Darstellung.

var id: int = 0                      ## Index in Simulation.territories
var key: String = ""                 ## ID aus der Kartendatei
var display_name: String = ""
var owner: int = Faction.NEUTRAL
var troops: int = 0
var production_rate: float = 1.0     ## Truppen pro Sekunde vor Fraktions-Multiplikator
var capacity: int = 60               ## Ab hier produziert das Gebiet nicht weiter
var production_progress: float = 0.0
var center: Vector2 = Vector2.ZERO   ## Position der Truppenanzeige
var polygons: Array[PackedVector2Array] = []
var area: float = 0.0
var neighbors: PackedInt32Array = PackedInt32Array()
var landmass: int = 0


func is_neighbor(other_id: int) -> bool:
	return neighbors.has(other_id)


func to_dict() -> Dictionary:
	return {"id": id, "key": key, "owner": owner, "troops": troops,
		"production_rate": production_rate, "capacity": capacity}
