extends TestCase
## Spielregeln: Produktion, Versand, Kampf, Besitzerwechsel, gleichzeitige Angriffe, Sieg/Niederlage.

const P := Faction.PLAYER
const R := Faction.RED
const G := Faction.GREEN
const N := Faction.NEUTRAL


func test_production_basic() -> void:
	var sim := make_sim([[P, 20, 0, 0, 1.0], [R, 5, 500, 0, 1.0]])
	run(sim, 10.0)
	eq(sim.territories[0].troops, 30, "20 Truppen + 1/s für 10 s")


func test_production_neutral_none() -> void:
	var sim := make_sim([[P, 5, 0, 0], [N, 10, 300, 0, 2.0]])
	run(sim, 8.0)
	eq(sim.territories[1].troops, 10, "Neutrale Gebiete produzieren nicht")


func test_production_framerate_independent() -> void:
	var a := make_sim([[P, 0, 0, 0, 1.7], [R, 0, 400, 0, 0.9]])
	var b := make_sim([[P, 0, 0, 0, 1.7], [R, 0, 400, 0, 0.9]])
	run(a, 12.0, 1.0 / 30.0)
	run(b, 12.0, 1.0 / 120.0)
	eq(a.territories[0].troops, b.territories[0].troops, "Produktion unabhängig von der Schrittweite (Spieler)")
	eq(a.territories[1].troops, b.territories[1].troops, "Produktion unabhängig von der Schrittweite (Rot)")


func test_production_capacity_and_multiplier() -> void:
	var sim := make_sim([[P, 40, 0, 0, 1.0, 45], [R, 0, 500, 0]])
	run(sim, 20.0)
	eq(sim.territories[0].troops, 45, "Produktion stoppt an der Kapazität")
	var sim2 := make_sim([[P, 0, 0, 0, 1.0], [R, 0, 500, 0]])
	sim2.factions[P].production_mult = 1.5
	run(sim2, 10.0)
	eq(sim2.territories[0].troops, 15, "Produktionsbonus 50 %")


func test_send_ratios() -> void:
	for pair in [[0.25, 10], [0.5, 20], [0.75, 30], [1.0, 40]]:
		var sim := make_sim([[P, 40, 0, 0], [N, 5, 300, 0]])
		var m := sim.send_troops(P, 0, 1, pair[0])
		check(m != null, "Versand mit %s möglich" % pair[0])
		eq(m.count, pair[1], "Versandmenge bei %d %%" % int(pair[0] * 100))
		eq(sim.territories[0].troops, 40 - pair[1], "Rest im Startgebiet")


func test_send_invalid() -> void:
	var sim := make_sim([[P, 40, 0, 0], [R, 5, 300, 0], [P, 0, 0, 300]])
	check(sim.send_troops(P, 1, 0, 0.5) == null, "Fremdes Gebiet kann nicht senden")
	check(sim.send_troops(P, 0, 0, 0.5) == null, "Nicht an sich selbst")
	check(sim.send_troops(P, 2, 0, 0.5) == null, "Gebiet ohne Truppen kann nicht senden")
	check(sim.send_troops(P, 0, 99, 0.5) == null, "Ungültiges Ziel")
	sim.restrict_neighbors = true
	sim.territories[0].neighbors = PackedInt32Array([2])
	check(sim.send_troops(P, 0, 1, 0.5) == null, "Nur Nachbarn erlaubt")
	check(sim.send_troops(P, 0, 2, 0.5) != null, "Nachbar ist erlaubt")


func test_movement_is_visible_and_takes_time() -> void:
	var sim := make_sim([[P, 40, 0, 0, 0.0], [P, 0, 400, 0, 0.0]])
	var m := sim.send_troops(P, 0, 1, 0.5)
	near(m.travel_time, 4.0, 0.001, "Reisezeit = Entfernung / Geschwindigkeit")
	run(sim, 1.0)
	eq(sim.territories[1].troops, 0, "Nach 1 s ist noch nichts angekommen (kein Teleport)")
	check(sim.units_in_transit(P) == 20, "Einheiten sind unterwegs")
	run(sim, 5.0)
	eq(sim.territories[1].troops, 20, "Alle Einheiten angekommen")
	eq(sim.movements.size(), 0, "Abgeschlossene Ströme werden entfernt")


func test_speed_multiplier() -> void:
	var sim := make_sim([[P, 40, 0, 0], [N, 1, 400, 0]])
	sim.factions[P].speed_mult = 2.0
	var m := sim.send_troops(P, 0, 1, 0.5)
	near(m.travel_time, 2.0, 0.001, "Tempobonus halbiert die Reisezeit")


func test_no_duplication() -> void:
	var sim := make_sim([[P, 50, 0, 0, 0.0], [P, 10, 300, 0, 0.0], [P, 7, 0, 300, 0.0]])
	var before := total_units(sim)
	sim.send_troops(P, 0, 1, 0.75)
	sim.send_troops(P, 1, 2, 1.0)
	sim.send_troops(P, 2, 0, 0.5)
	for i in 200:
		sim.step(Simulation.FIXED_DT)
		eq(total_units(sim), before, "Truppen bleiben ohne Kampf und Produktion erhalten")
		if failures.size() > 0:
			break


func test_combat_example_from_spec() -> void:
	# A: 50 blau, B: 30 rot, 40 von A nach B -> A 10, B 10 blau
	var sim := make_sim([[P, 50, 0, 0, 0.0], [R, 30, 200, 0, 0.0], [N, 1, 5000, 5000, 0.0]])
	var m := sim.send_count(P, 0, 1, 40)
	check(m != null, "Versand von 40 möglich")
	eq(sim.territories[0].troops, 10, "A behält 10")
	run(sim, 5.0)
	eq(sim.territories[1].owner, P, "B wurde erobert")
	eq(sim.territories[1].troops, 10, "10 Überlebende bilden die Garnison")
	eq(sim.factions[P].territories_captured, 1, "Eroberung gezählt")
	eq(sim.factions[R].units_lost, 30, "Rot verliert 30")
	eq(sim.factions[P].units_lost, 30, "Blau verliert 30 Angreifer")


func test_combat_tie_and_reinforce() -> void:
	var t := Territory.new()
	t.owner = R
	t.troops = 5
	var r := CombatSystem.apply_units(t, P, 5)
	eq(t.troops, 0, "Gleichstand: 0 Verteidiger")
	eq(t.owner, R, "Gleichstand: Besitzer bleibt")
	check(not r.captured, "Keine Eroberung bei Gleichstand")
	r = CombatSystem.apply_units(t, P, 1)
	check(r.captured, "Nächste Einheit erobert")
	eq(t.troops, 1, "Eine Einheit als Garnison")
	CombatSystem.apply_units(t, P, 4)
	eq(t.troops, 5, "Verstärkung addiert")
	CombatSystem.apply_units(t, R, 0)
	eq(t.troops, 5, "Null Einheiten ändern nichts")


func test_no_negative_troops() -> void:
	var sim := make_sim([[P, 100, 0, 0, 0.0], [R, 3, 200, 0, 0.0], [G, 2, 200, 200, 0.0], [N, 1, 5000, 5000, 0.0]])
	sim.send_troops(P, 0, 1, 1.0)
	for i in 300:
		sim.step(Simulation.FIXED_DT)
		for t in sim.territories:
			check(t.troops >= 0, "Truppenzahl nie negativ")
	eq(sim.territories[1].troops, 97, "Überschuss bleibt erhalten")


func test_owner_change_during_movement() -> void:
	# Rot schickt zu einem neutralen Gebiet, Grün erobert es vorher -> Rot kämpft gegen Grün
	var sim := make_sim([[R, 30, 0, 0, 0.0], [N, 5, 400, 0, 0.0], [G, 30, 450, 0, 0.0]])
	var mr := sim.send_count(R, 0, 1, 20)
	sim.send_count(G, 2, 1, 15)
	check(mr != null, "Roter Strom gestartet")
	run(sim, 2.0)
	eq(sim.territories[1].owner, G, "Grün erobert zuerst (kürzerer Weg)")
	eq(sim.territories[1].troops, 10, "Grün: 15 - 5")
	run(sim, 5.0)
	eq(sim.territories[1].owner, R, "Rot trifft später auf Grün und gewinnt")
	eq(sim.territories[1].troops, 10, "Rot: 20 - 10")


func test_source_lost_while_streaming() -> void:
	var sim := make_sim([[P, 30, 0, 0, 0.0], [N, 1, 600, 0, 0.0], [R, 50, 80, 0, 0.0]])
	sim.send_count(P, 0, 1, 30)
	sim.send_count(R, 2, 0, 10)
	run(sim, 2.0)
	eq(sim.territories[0].owner, R, "Startgebiet fällt während des Stroms")
	run(sim, 10.0)
	eq(sim.territories[1].owner, P, "Bereits gesendete Einheiten gehören weiter dem Spieler")
	eq(sim.territories[1].troops, 29, "30 - 1 Verteidiger")


func test_simultaneous_attacks_ordered() -> void:
	# Beide Fraktionen gleich weit entfernt, gleichzeitig gesendet: deterministisch und vollständig
	var results: Array = []
	for rep in 3:
		var sim := make_sim([[R, 20, -300, 0, 0.0], [N, 10, 0, 0, 0.0], [G, 20, 300, 0, 0.0]])
		var before := total_units(sim)
		sim.send_count(R, 0, 1, 20)
		sim.send_count(G, 2, 1, 20)
		run(sim, 6.0)
		var t := sim.territories[1]
		results.append([t.owner, t.troops])
		eq(total_units(sim), before - 2 * sim.kills, "Jede Kampfbegegnung kostet genau zwei Einheiten")
		check(t.troops >= 0, "keine negativen Werte")
	eq(results[0], results[1], "Gleichzeitige Angriffe sind deterministisch")
	eq(results[1], results[2], "Gleichzeitige Angriffe sind deterministisch (2)")
	# 10 neutral + 40 Angreifer: insgesamt 50 - 2*kills
	check(results[0][1] <= 10, "Rest aus dem Dreikampf ist plausibel")


func test_arrivals_processed_in_time_order() -> void:
	# Rot kommt zuerst an (nah), Grün später (fern): Grün kämpft gegen das rote Gebiet
	var sim := make_sim([[R, 12, -100, 0, 0.0], [N, 10, 0, 0, 0.0], [G, 30, 900, 0, 0.0]])
	sim.send_count(R, 0, 1, 12)
	sim.send_count(G, 2, 1, 30)
	run(sim, 2.5)
	eq(sim.territories[1].owner, R, "Rot hat zuerst erobert")
	eq(sim.territories[1].troops, 2, "Rot: 12 - 10")
	run(sim, 10.0)
	eq(sim.territories[1].owner, G, "Grün übernimmt danach")
	eq(sim.territories[1].troops, 28, "Grün: 30 - 2")


func test_victory_requires_no_enemy_troops() -> void:
	var sim := make_sim([[P, 50, 0, 0, 0.0], [R, 20, 200, 0, 0.0]], false)
	sim.factions[R].speed_mult = 0.2
	sim.send_count(R, 1, 0, 5)
	sim.send_count(P, 0, 1, 30)
	run(sim, 3.5)
	eq(sim.territories[1].owner, P, "Spieler besitzt alles")
	eq(sim.state, Simulation.State.RUNNING, "Feindliche Truppen noch unterwegs: kein Sieg")
	run(sim, 8.0)
	eq(sim.state, Simulation.State.WON, "Sieg, sobald keine Feinde mehr unterwegs sind")
	eq(sim.territories[0].troops, 15, "Späte rote Einheiten wurden noch abgewehrt")
	check(sim.end_time > 0.0, "Endzeit gesetzt")


func test_victory_needs_neutrals_captured() -> void:
	var sim := make_sim([[P, 50, 0, 0, 0.0], [N, 5, 300, 0, 0.0]], false)
	run(sim, 1.0)
	eq(sim.state, Simulation.State.RUNNING, "Neutrale Gebiete verhindern den Sieg")
	sim.send_troops(P, 0, 1, 0.5)
	run(sim, 5.0)
	eq(sim.state, Simulation.State.WON, "Nach Eroberung des neutralen Gebiets gewonnen")


func test_defeat_conditions() -> void:
	var sim := make_sim([[P, 10, 0, 0, 0.0], [R, 60, 300, 0, 0.0], [N, 50, 0, 900, 0.0]], false)
	sim.send_count(P, 0, 2, 10)
	sim.send_count(R, 1, 0, 30)
	run(sim, 3.5)
	eq(sim.territories[0].owner, R, "Letztes Gebiet verloren")
	eq(sim.state, Simulation.State.RUNNING, "Eigene Truppen noch unterwegs: noch keine Niederlage")
	run(sim, 8.0)
	eq(sim.state, Simulation.State.LOST, "Niederlage ohne Gebiete und ohne Truppen")
	var cmd := sim.send_troops(R, 1, 2, 0.5)
	check(cmd == null, "Nach Spielende keine Befehle mehr")


func test_pause_stops_simulation() -> void:
	var sim := make_sim([[P, 10, 0, 0], [R, 10, 300, 0]])
	var t0 := sim.time
	# "Pause" heißt: die Ansicht ruft step() nicht auf. Die Simulation darf von sich aus nichts tun.
	eq(sim.territories[0].troops, 10, "Ohne Schritt keine Produktion")
	eq(sim.time, t0, "Ohne Schritt keine Zeit")
