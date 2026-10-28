class_name CombatSystem
extends RefCounted
## Kampfregeln: Jede angreifende Einheit tötet genau eine verteidigende Einheit.
## Sind keine Verteidiger mehr da, übernimmt die nächste Einheit das Gebiet.
## Gleiche Besitzer verstärken sich.


## Wendet n eintreffende Einheiten des Besitzers attacker auf das Gebiet an.
## Gibt {captured, previous_owner, attacker_losses, defender_losses} zurück.
static func apply_units(t: Territory, attacker: int, n: int) -> Dictionary:
	var result := {"captured": false, "previous_owner": t.owner,
		"attacker_losses": 0, "defender_losses": 0, "reinforced": 0}
	if n <= 0:
		return result
	if t.owner == attacker:
		t.troops += n
		result.reinforced = n
		return result
	var defenders := t.troops
	if n <= defenders:
		t.troops = defenders - n
		result.attacker_losses = n
		result.defender_losses = n
		return result
	# Alle Verteidiger fallen, die übrigen Angreifer übernehmen.
	result.attacker_losses = defenders
	result.defender_losses = defenders
	t.owner = attacker
	t.troops = n - defenders
	t.production_progress = 0.0
	result.captured = true
	return result
