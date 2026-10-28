class_name UIIcon
extends Control
## Vektor-Icons, direkt gezeichnet (keine Bilddateien, keine Schriftsymbole nötig).

var kind: String = "star"
var color: Color = Color.WHITE
var color2: Color = Color(0, 0, 0, 0)


func _init(p_kind: String = "star", p_color: Color = Color.WHITE, p_size: float = 32.0) -> void:
	kind = p_kind
	color = p_color
	custom_minimum_size = Vector2(p_size, p_size)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_kind(k: String, c: Color = color) -> void:
	kind = k
	color = c
	queue_redraw()


func _draw() -> void:
	var s := minf(size.x, size.y)
	var o := (size - Vector2(s, s)) * 0.5
	draw_icon(self, kind, Rect2(o, Vector2(s, s)), color, color2)


static func star_points(c: Vector2, r_out: float, r_in: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 10:
		var a := -PI / 2.0 + i * PI / 5.0
		var r := r_out if i % 2 == 0 else r_in
		pts.append(c + Vector2(cos(a), sin(a)) * r)
	return pts


## Zeichnet ein Icon in ein beliebiges CanvasItem.
static func draw_icon(ci: CanvasItem, k: String, r: Rect2, col: Color, col2: Color = Color(0, 0, 0, 0)) -> void:
	var c := r.get_center()
	var s := r.size.x
	var w := maxf(2.0, s * 0.1)
	match k:
		"star":
			ci.draw_colored_polygon(star_points(c, s * 0.5, s * 0.22), col)
		"star_empty":
			var pts := star_points(c, s * 0.5, s * 0.22)
			ci.draw_colored_polygon(pts, Color(col, 0.25))
		"coin":
			ci.draw_circle(c, s * 0.48, col.darkened(0.25))
			ci.draw_circle(c, s * 0.4, col)
			ci.draw_rect(Rect2(c - Vector2(s * 0.06, s * 0.2), Vector2(s * 0.12, s * 0.4)), col.darkened(0.3))
		"lock":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.3, -s * 0.05), Vector2(s * 0.6, s * 0.45)), col)
			ci.draw_arc(c + Vector2(0, -s * 0.08), s * 0.2, PI, TAU, 16, col, w)
		"pause":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.28, -s * 0.32), Vector2(s * 0.2, s * 0.64)), col)
			ci.draw_rect(Rect2(c + Vector2(s * 0.08, -s * 0.32), Vector2(s * 0.2, s * 0.64)), col)
		"play":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.25, -s * 0.35), c + Vector2(s * 0.38, 0), c + Vector2(-s * 0.25, s * 0.35)]), col)
		"back":
			ci.draw_polyline(PackedVector2Array([c + Vector2(s * 0.15, -s * 0.32), c + Vector2(-s * 0.18, 0), c + Vector2(s * 0.15, s * 0.32)]), col, w * 1.3, true)
		"next":
			ci.draw_polyline(PackedVector2Array([c + Vector2(-s * 0.15, -s * 0.32), c + Vector2(s * 0.18, 0), c + Vector2(-s * 0.15, s * 0.32)]), col, w * 1.3, true)
		"restart":
			ci.draw_arc(c, s * 0.32, -PI * 0.35, PI * 1.45, 24, col, w * 1.2, true)
			var tip := c + Vector2(cos(-PI * 0.35), sin(-PI * 0.35)) * s * 0.32
			ci.draw_colored_polygon(PackedVector2Array([tip + Vector2(-s * 0.18, -s * 0.06), tip + Vector2(s * 0.1, -s * 0.16), tip + Vector2(s * 0.04, s * 0.14)]), col)
		"home":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s * 0.4), c + Vector2(s * 0.42, -s * 0.02), c + Vector2(-s * 0.42, -s * 0.02)]), col)
			ci.draw_rect(Rect2(c + Vector2(-s * 0.28, -s * 0.05), Vector2(s * 0.56, s * 0.42)), col)
		"gear":
			for i in 8:
				var a := i * TAU / 8.0
				ci.draw_line(c, c + Vector2(cos(a), sin(a)) * s * 0.46, col, s * 0.16)
			ci.draw_circle(c, s * 0.32, col)
			ci.draw_circle(c, s * 0.13, col2 if col2.a > 0 else Color(1, 1, 1, 0.9))
		"chart":
			for i in 3:
				var h: float = [0.35, 0.6, 0.8][i] * s
				ci.draw_rect(Rect2(r.position + Vector2(s * (0.12 + i * 0.28), s * 0.9 - h), Vector2(s * 0.2, h)), col)
		"up":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s * 0.42), c + Vector2(s * 0.38, s * 0.02), c + Vector2(s * 0.14, s * 0.02), c + Vector2(s * 0.14, s * 0.4), c + Vector2(-s * 0.14, s * 0.4), c + Vector2(-s * 0.14, s * 0.02), c + Vector2(-s * 0.38, s * 0.02)]), col)
		"troops":
			for p in [Vector2(-0.24, 0.2), Vector2(0.24, 0.2), Vector2(0, -0.2)]:
				ci.draw_circle(c + p * s, s * 0.18, col)
		"factory":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.42, -s * 0.05), Vector2(s * 0.84, s * 0.42)), col)
			ci.draw_rect(Rect2(c + Vector2(s * 0.12, -s * 0.42), Vector2(s * 0.18, s * 0.4)), col)
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.42, -s * 0.05), c + Vector2(-s * 0.16, -s * 0.25), c + Vector2(-s * 0.16, -s * 0.05)]), col)
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.16, -s * 0.05), c + Vector2(s * 0.12, -s * 0.25), c + Vector2(s * 0.12, -s * 0.05)]), col)
		"speed":
			for i in 2:
				var x := (i * 0.32 - 0.24) * s
				ci.draw_polyline(PackedVector2Array([c + Vector2(x - s * 0.12, -s * 0.32), c + Vector2(x + s * 0.18, 0), c + Vector2(x - s * 0.12, s * 0.32)]), col, w * 1.3, true)
		"flag":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.32, -s * 0.42), Vector2(s * 0.09, s * 0.84)), col)
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.24, -s * 0.42), c + Vector2(s * 0.38, -s * 0.22), c + Vector2(-s * 0.24, s * 0.02)]), col)
		"infinity":
			ci.draw_arc(c + Vector2(-s * 0.2, 0), s * 0.18, 0, TAU, 20, col, w, true)
			ci.draw_arc(c + Vector2(s * 0.2, 0), s * 0.18, 0, TAU, 20, col, w, true)
		"dice":
			ci.draw_rect(Rect2(c - Vector2(s * 0.38, s * 0.38), Vector2(s * 0.76, s * 0.76)), col)
			for p in [Vector2(-0.18, -0.18), Vector2(0.18, 0.18), Vector2(0, 0), Vector2(0.18, -0.18), Vector2(-0.18, 0.18)]:
				ci.draw_circle(c + p * s, s * 0.07, col2 if col2.a > 0 else Color.WHITE)
		"cube":
			var top := PackedVector2Array([c + Vector2(0, -s * 0.42), c + Vector2(s * 0.38, -s * 0.2), c + Vector2(0, 0), c + Vector2(-s * 0.38, -s * 0.2)])
			ci.draw_colored_polygon(top, col.lightened(0.25))
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.38, -s * 0.2), c, c + Vector2(0, s * 0.42), c + Vector2(-s * 0.38, s * 0.2)]), col)
			ci.draw_colored_polygon(PackedVector2Array([c, c + Vector2(s * 0.38, -s * 0.2), c + Vector2(s * 0.38, s * 0.2), c + Vector2(0, s * 0.42)]), col.darkened(0.2))
		"map":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.42, -s * 0.3), c + Vector2(-s * 0.14, -s * 0.4), c + Vector2(s * 0.14, -s * 0.3), c + Vector2(s * 0.42, -s * 0.4), c + Vector2(s * 0.42, s * 0.3), c + Vector2(s * 0.14, s * 0.4), c + Vector2(-s * 0.14, s * 0.3), c + Vector2(-s * 0.42, s * 0.4)]), col)
		"check":
			ci.draw_polyline(PackedVector2Array([c + Vector2(-s * 0.32, 0), c + Vector2(-s * 0.08, s * 0.25), c + Vector2(s * 0.34, -s * 0.28)]), col, w * 1.5, true)
		"cross":
			ci.draw_line(c - Vector2(s * 0.3, s * 0.3), c + Vector2(s * 0.3, s * 0.3), col, w * 1.4, true)
			ci.draw_line(c + Vector2(-s * 0.3, s * 0.3), c + Vector2(s * 0.3, -s * 0.3), col, w * 1.4, true)
		"trophy":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.3, -s * 0.4), c + Vector2(s * 0.3, -s * 0.4), c + Vector2(s * 0.22, -s * 0.02), c + Vector2(0, s * 0.1), c + Vector2(-s * 0.22, -s * 0.02)]), col)
			ci.draw_rect(Rect2(c + Vector2(-s * 0.06, s * 0.08), Vector2(s * 0.12, s * 0.2)), col)
			ci.draw_rect(Rect2(c + Vector2(-s * 0.24, s * 0.28), Vector2(s * 0.48, s * 0.12)), col)
		"sound":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.4, -s * 0.12), c + Vector2(-s * 0.2, -s * 0.12), c + Vector2(s * 0.05, -s * 0.36), c + Vector2(s * 0.05, s * 0.36), c + Vector2(-s * 0.2, s * 0.12), c + Vector2(-s * 0.4, s * 0.12)]), col)
			ci.draw_arc(c + Vector2(s * 0.05, 0), s * 0.22, -0.9, 0.9, 10, col, w, true)
			ci.draw_arc(c + Vector2(s * 0.05, 0), s * 0.38, -0.9, 0.9, 12, col, w, true)
		"music":
			ci.draw_circle(c + Vector2(-s * 0.2, s * 0.25), s * 0.13, col)
			ci.draw_circle(c + Vector2(s * 0.22, s * 0.15), s * 0.13, col)
			ci.draw_line(c + Vector2(-s * 0.08, s * 0.25), c + Vector2(-s * 0.08, -s * 0.35), col, w)
			ci.draw_line(c + Vector2(s * 0.34, s * 0.15), c + Vector2(s * 0.34, -s * 0.42), col, w)
			ci.draw_line(c + Vector2(-s * 0.08, -s * 0.35), c + Vector2(s * 0.34, -s * 0.42), col, w * 1.6)
		"vibrate":
			ci.draw_rect(Rect2(c - Vector2(s * 0.17, s * 0.32), Vector2(s * 0.34, s * 0.64)), col)
			ci.draw_line(c + Vector2(-s * 0.32, -s * 0.15), c + Vector2(-s * 0.32, s * 0.15), col, w)
			ci.draw_line(c + Vector2(s * 0.32, -s * 0.15), c + Vector2(s * 0.32, s * 0.15), col, w)
		_:
			ci.draw_circle(c, s * 0.4, col)
