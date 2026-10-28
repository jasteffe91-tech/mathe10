class_name Simulation
extends RefCounted
## Deterministische Spielsimulation. Läuft in festen Zeitschritten und kennt keine
## Darstellung. Die Ansicht liest den Zustand und holt Ereignisse über drain_events().

enum State { RUNNING, WON, LOST }

const FIXED_DT := 1.0 / 30.0

var tm := TerritoryManager.new()
var factions: Array[Faction] = []
var movements: Array[TroopMovement] = []
var time: float = 0.0
var state: int = State.RUNNING
var human: int = Faction.PLAYER
var end_time: float = -1.0
var kills: int = 0   ## Anzahl Kampfbegegnungen (je eine Angreifer- und eine Verteidigereinheit fällt)

# Regeln (werden aus der Konfiguration gesetzt)
var base_speed: float = 100.0          ## Karteneinheiten pro Sekunde
var emit_interval_max: float = 0.09    ## Abstand zwischen zwei Einheiten eines Stroms
var stream_max_duration: float = 1.2   ## Ein Strom verlässt das Gebiet in höchstens dieser Zeit
var min_travel_time: float = 0.35
var restrict_neighbors: bool = false

var _events: Array[Dictionary] = []
var _next_movement_id: int = 1


func _init() -> void:
	for i in Faction.COUNT:
		factions.append(Faction.new(i))
	factions[Faction.PLAYER].is_human = true


var territories: Array[Territory]:
	get:
		return tm.territories


# ---------------------------------------------------------------- Zeitschritt

func step(dt: float) -> void:
	if state != State.RUNNING:
		return
	time += dt
	var produced := tm.produce(dt, factions)
	for i in Faction.COUNT:
		factions[i].units_produced += produced[i]
	_process_arrivals()
	_update_alive()
	_check_end()


## Verarbeitet alle bis jetzt eingetroffenen Einheiten in zeitlicher Reihenfolge.
## Gleichzeitige Ankünfte werden nach Strom-ID geordnet, damit das Ergebnis eindeutig ist.
func _process_arrivals() -> void:
	var due: Array = []
	for m in movements:
		var i := m.arrived
		while i < m.count and m.arrival_time(i) <= time:
			due.append([m.arrival_time(i), m.id, m])
			i += 1
	if due.is_empty():
		return
	if due.size() > 1:
		due.sort_custom(func(a, b): return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1]))
	var hits := {}
	for e in due:
		var m: TroopMovement = e[2]
		m.arrived += 1
		_apply_arrival(m, hits)
	for key in hits:
		_events.append(hits[key])
	var still: Array[TroopMovement] = []
	for m in movements:
		if not m.is_done():
			still.append(m)
	movements = still


func _apply_arrival(m: TroopMovement, hits: Dictionary) -> void:
	var t := tm.territories[m.target]
	var res := CombatSystem.apply_units(t, m.owner, 1)
	var att := factions[m.owner]
	kills += res.attacker_losses
	att.units_lost += res.attacker_losses
	if res.previous_owner != Faction.NEUTRAL and res.previous_owner != m.owner:
		factions[res.previous_owner].units_lost += res.defender_losses
	if res.captured:
		att.territories_captured += 1
		if res.previous_owner != Faction.NEUTRAL:
			factions[res.previous_owner].territories_lost += 1
		_events.append({"type": "capture", "territory": t.id,
			"from": res.previous_owner, "to": m.owner, "time": time})
	else:
		var key := "%d:%d" % [t.id, m.owner]
		if not hits.has(key):
			hits[key] = {"type": "reinforce" if res.reinforced > 0 else "hit",
				"territory": t.id, "owner": m.owner, "count": 0}
		hits[key].count += 1


func _update_alive() -> void:
	for f in factions:
		if f.id == Faction.NEUTRAL or not f.alive:
			continue
		if tm.count_owned(f.id) == 0 and units_in_transit(f.id) == 0:
			f.alive = false
			_events.append({"type": "eliminated", "faction": f.id})


func _check_end() -> void:
	if not factions[human].alive:
		_finish(State.LOST)
		return
	if tm.count_owned(human) < tm.size():
		return
	for m in movements:
		if m.owner != human:
			return
	_finish(State.WON)


func _finish(s: int) -> void:
	state = s
	end_time = time
	_events.append({"type": "game_over", "won": s == State.WON})


# ---------------------------------------------------------------- Befehle

func can_send(owner: int, source: int, target: int) -> bool:
	if state != State.RUNNING:
		return false
	var src := tm.get_territory(source)
	var dst := tm.get_territory(target)
	if src == null or dst == null or source == target:
		return false
	if src.owner != owner or src.troops <= 0:
		return false
	if restrict_neighbors and not src.is_neighbor(target):
		return false
	return true


## Schickt den Anteil ratio (0..1] der Truppen von source nach target.
func send_troops(owner: int, source: int, target: int, ratio: float) -> TroopMovement:
	if not can_send(owner, source, target):
		return null
	var count := int(floor(tm.territories[source].troops * clampf(ratio, 0.0, 1.0) + 0.000001))
	return send_count(owner, source, target, count)


func send_from_many(owner: int, sources: Array, target: int, ratio: float) -> Array[TroopMovement]:
	var out: Array[TroopMovement] = []
	for s in sources:
		var m := send_troops(owner, s, target, ratio)
		if m != null:
			out.append(m)
	return out


## Schickt genau count Einheiten (höchstens die vorhandenen).
func send_count(owner: int, source: int, target: int, count: int) -> TroopMovement:
	if not can_send(owner, source, target):
		return null
	var src := tm.territories[source]
	var dst := tm.territories[target]
	count = mini(count, src.troops)
	if count <= 0:
		return null
	src.troops -= count
	var m := TroopMovement.new()
	m.id = _next_movement_id
	_next_movement_id += 1
	m.owner = owner
	m.source = source
	m.target = target
	m.from_pos = src.center
	m.to_pos = dst.center
	m.count = count
	m.start_time = time
	m.travel_time = travel_time(owner, source, target)
	m.emit_interval = minf(emit_interval_max, stream_max_duration / float(count))
	movements.append(m)
	factions[owner].units_sent += count
	_events.append({"type": "send", "movement": m})
	return m


# ---------------------------------------------------------------- Abfragen

func speed_of(owner: int) -> float:
	return base_speed * factions[owner].speed_mult


func travel_time(owner: int, source: int, target: int) -> float:
	return maxf(min_travel_time, tm.distance(source, target) / speed_of(owner))


func units_in_transit(owner: int) -> int:
	var n := 0
	for m in movements:
		if m.owner == owner:
			n += m.in_flight()
	return n


## Gesamtstärke = Truppen in Gebieten + unterwegs.
func strength(owner: int) -> int:
	return tm.troops_owned(owner) + units_in_transit(owner)


## Einheiten, die zu target unterwegs sind, nach Besitzer.
func incoming(target: int) -> Dictionary:
	var out := {}
	for m in movements:
		if m.target == target:
			out[m.owner] = out.get(m.owner, 0) + m.in_flight()
	return out


func drain_events() -> Array[Dictionary]:
	var e := _events
	_events = []
	return e


func is_running() -> bool:
	return state == State.RUNNING
