extends Node2D
## 量化诊断：打印每个部件（及其骨骼）的计算世界位置 vs 期望位置，找出错位来源。
## 运行： godot --path godot-model --rendering-driver d3d12 res://diag.tscn

func _ready() -> void:
	var script: GDScript = load("res://main.gd")
	var L: Dictionary = script.call("look_swordswoman")
	var defs: Array = script.call("bone_defs")
	print("=== 骨骼链（建模坐标 -> 期望屏幕坐标，S=4.6, CX=1010, GY=756）===")
	var S := 4.6
	var CX := 1010.0
	var GY := 756.0
	var bone_world := {}
	for d in defs:
		var px := 0.0
		var py := 0.0
		if d.p == "":
			px = d.x
			py = d.y
		else:
			var pw: Array = bone_world[d.p]
			px = pw[0] + d.x
			py = pw[1] + d.y
		bone_world[d.n] = [px, py]
		print("%-12s 建模(%.1f, %.1f)  期望屏幕(%.1f, %.1f)" % [d.n, px, py, CX + px * S, GY + py * S])

	print("=== 各部件纵向范围（建模坐标）===")
	var parts: Array = script.call("build_parts", L)
	var by_bone := {}
	for p in parts:
		var ymin := 1e9
		var ymax := -1e9
		for v in p.v:
			ymin = minf(ymin, v.y)
			ymax = maxf(ymax, v.y)
		if not by_bone.has(p.b):
			by_bone[p.b] = []
		by_bone[p.b].append("%s[%.0f..%.0f]" % [p.n, ymin, ymax])
	for k in by_bone.keys():
		print("  ", k, " -> ", ", ".join(by_bone[k]))

	get_tree().quit()
