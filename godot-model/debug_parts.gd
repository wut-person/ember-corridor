extends Node2D
## 调试视图：把角色的每个部件按其真实包围盒画成描边 + 名称，
## 用来检查「哪个多边形落在哪里」，避免盲调顶点。
## 运行： godot --path godot-model -- --debugview

const S := 9.0
const CX := 660.0
const GY := 800.0
const OUT := "D:/new games/godot-model/shots/debug-parts.png"

func _ready() -> void:
	_bg()
	var src: Node = load("res://main.gd").new()
	# 直接复用 main.gd 的几何数据（静态函数），不实例化整棵树
	var L: Dictionary = src.call("look_swordswoman")
	_draw_parts(L, Color(0.55, 0.75, 1.0))
	await get_tree().process_frame
	await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_png(OUT)
	print("DEBUG_SHOT ", OUT)
	get_tree().quit()

func _bg() -> void:
	var bg := ColorRect.new()
	bg.color = Color("#0b0e17")
	bg.size = Vector2(1440, 900)
	bg.z_index = -100
	add_child(bg)
	var line := Line2D.new()
	line.points = PackedVector2Array([Vector2(0, GY), Vector2(1440, GY)])
	line.width = 1.0
	line.default_color = Color(0.4, 0.5, 0.65, 0.8)
	line.z_index = -50
	add_child(line)

func _draw_parts(L: Dictionary, tint: Color) -> void:
	var parts: Array = load("res://main.gd").call("build_parts", L)
	var bounds := {}
	# 先统计每个骨骼的部件包围盒（建模空间）
	for p in parts:
		var b: String = p.b
		if not bounds.has(b):
			bounds[b] = {"min": Vector2(1e9, 1e9), "max": Vector2(-1e9, -1e9)}
		for v in p.v:
			var mn: Vector2 = bounds[b]["min"]
			var mx: Vector2 = bounds[b]["max"]
			bounds[b]["min"] = Vector2(minf(mn.x, v.x), minf(mn.y, v.y))
			bounds[b]["max"] = Vector2(maxf(mx.x, v.x), maxf(mx.y, v.y))

	# 画部件多边形（半透明填充 + 描边）
	var idx := 0
	for p in parts:
		var poly := Polygon2D.new()
		var pts := PackedVector2Array()
		for v in p.v:
			pts.append(Vector2(v.x, v.y))
		poly.polygon = pts
		var c := Color(p.c)
		poly.color = Color(c.r, c.g, c.b, 0.42)
		poly.position = Vector2(CX, GY)
		poly.scale = Vector2(S, S)
		add_child(poly)

		var outline := Line2D.new()
		var op := PackedVector2Array()
		for v in p.v:
			op.append(Vector2(CX + v.x * S, GY + v.y * S))
		op.append(Vector2(CX + p.v[0].x * S, GY + p.v[0].y * S))
		outline.points = op
		outline.width = 1.0
		outline.default_color = Color(1, 1, 1, 0.35)
		add_child(outline)
		idx += 1

	# 画骨骼位置标记
	var defs: Array = load("res://main.gd").call("bone_defs")
	for d in defs:
		var m := Polygon2D.new()
		var pts := PackedVector2Array()
		var px: float = CX + d.x * S
		var py: float = GY + d.y * S
		pts.append(Vector2(px - 6, py)); pts.append(Vector2(px + 6, py))
		pts.append(Vector2(px, py - 6)); pts.append(Vector2(px, py + 6))
		m.polygon = pts
		m.color = Color(1, 0.85, 0.2, 0.95)
		add_child(m)
		var lbl := Label.new()
		lbl.text = d.n
		lbl.position = Vector2(px + 10, py - 8)
		lbl.add_theme_font_size_override("font_size", 12)
		lbl.add_theme_color_override("font_color", Color("#ffd479"))
		add_child(lbl)

	# 左侧列出部件数
	var info := Label.new()
	info.text = "部件 %d 个 · 骨骼 %d 个 · S=%.1f" % [idx, defs.size(), S]
	info.position = Vector2(40, 30)
	info.add_theme_font_size_override("font_size", 22)
	info.add_theme_color_override("font_color", Color("#e9eef7"))
	add_child(info)
