class_name TroopMovement
extends RefCounted
## Ein Truppenstrom von einem Gebiet zu einem anderen.
## Die Einheiten werden beim Versand vom Startgebiet abgezogen und verlassen es
## danach nacheinander im Abstand emit_interval. Jede Einheit braucht travel_time
## bis zum Ziel. Ankunftszeiten sind damit geschlossen berechenbar und unabhängig
## von der Bildrate.

var id: int = 0
var owner: int = 0
var source: int = -1
var target: int = -1
var from_pos: Vector2
var to_pos: Vector2
var count: int = 0
var arrived: int = 0
var start_time: float = 0.0
var emit_interval: float = 0.1
var travel_time: float = 1.0


func arrival_time(index: int) -> float:
	return start_time + index * emit_interval + travel_time


func emit_time(index: int) -> float:
	return start_time + index * emit_interval


func in_flight() -> int:
	return count - arrived


func is_done() -> bool:
	return arrived >= count


func last_arrival_time() -> float:
	return arrival_time(count - 1)


## Fortschritt (0..1) der Einheit index zum Zeitpunkt now, < 0 falls noch nicht losgelaufen.
func unit_progress(index: int, now: float) -> float:
	var t := now - emit_time(index)
	if t < 0.0:
		return -1.0
	return clampf(t / travel_time, 0.0, 1.0)
