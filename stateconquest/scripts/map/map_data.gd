class_name MapData
extends RefCounted
## Ergebnis der Kartenerzeugung: fertige Polygone, Mittelpunkte und Nachbarschaften.

var id: String = ""
var names: Dictionary = {}          ## {"de": "...", "en": "..."}
var bounds: Rect2 = Rect2(0, 0, 1000, 1400)
var landmasses: Array[PackedVector2Array] = []
## Jede Region: {key, name, polygons: Array[PackedVector2Array], center, area, neighbors, landmass}
var regions: Array[Dictionary] = []
var theme: Dictionary = {}


func region_count() -> int:
	return regions.size()


func average_area() -> float:
	if regions.is_empty():
		return 1.0
	var s := 0.0
	for r in regions:
		s += float(r.area)
	return s / regions.size()


func display_name(lang: String) -> String:
	if names.has(lang):
		return names[lang]
	if names.has("en"):
		return names["en"]
	return id
