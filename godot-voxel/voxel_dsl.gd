extends Node3D
## =========================================================
## 精致像素体素角色构建器（对齐参考图风格）
##   密度：1 单位 = 1/24 m，角色总高 100 单位（比旧版 55 单位细近 2 倍）
##   光照：硬边明暗 + 右侧冷色轮廓光 + 顶光（无环境光泡洗）
##   相机：斜俯视 45°
## 提供镜像、成对、多材质的小工具，方便快速堆细节
## =========================================================

const U := 1.0 / 24.0          # 1 体素单位的世界尺寸（米）

var _root: Node3D
var _cur: Node3D                # 当前挂载节点
var _mirror := false            # 镜像模式：x 取负

# ---------------- 基础 ----------------
func begin(id: String) -> Node3D:
	_root = Node3D.new()
	_root.name = id
	_cur = _root
	_mirror = false
	return _root

func at(node: Node3D) -> Node3D:
	_cur = node
	return node

func joint(name: String, parent: Node3D, pos: Vector3) -> Node3D:
	var n := Node3D.new()
	n.name = name
	n.position = pos * U
	parent.add_child(n)
	return n

func mir(on: bool) -> void:
	_mirror = on

func _pos(p: Vector3) -> Vector3:
	return Vector3(-p.x if _mirror else p.x, p.y, p.z) * U

func _size(s: Vector3) -> Vector3:
	return Vector3(absf(s.x), absf(s.y), absf(s.z)) * U

# ---------------- 盒子 ----------------
func box(name: String, pos: Vector3, size: Vector3, col: Color, metal := false, emit := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	var m := BoxMesh.new()
	m.size = _size(size)
	mi.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	if metal:
		mat.metallic = 0.8
		mat.roughness = 0.3
		mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	else:
		mat.roughness = 1.0
		mat.metallic = 0.0
		mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	if emit:
		mat.emission_enabled = true
		mat.emission = col
		mat.emission_energy_multiplier = 2.4
	mi.material_override = mat
	mi.position = _pos(pos)
	_cur.add_child(mi)
	return mi

## 成对（左右各一个，自动镜像 x）
func pair(name: String, pos: Vector3, size: Vector3, col: Color, metal := false) -> void:
	mir(false); box(name + "_l", pos, size, col, metal)
	mir(true);  box(name + "_r", pos, size, col, metal)
	mir(false)

## 带旋转的盒子（用于斜置皮带 / 剑刃）
func rot_box(name: String, pos: Vector3, size: Vector3, col: Color, rot_deg: Vector3, metal := false) -> MeshInstance3D:
	var mi := box(name, pos, size, col, metal)
	mi.rotation_degrees = Vector3(rot_deg.x, rot_deg.y + (180.0 if _mirror else 0.0), rot_deg.z)
	return mi

## 细长条（铆钉 / 缝线 / 镶边）
func trim(name: String, pos: Vector3, size: Vector3, col: Color) -> MeshInstance3D:
	return box(name, pos, size, col)

## 一条贴面的明暗过渡：底 + 顶部高光 + 底部暗边
func plate(name: String, pos: Vector3, size: Vector3, col: Color, metal := false) -> void:
	box(name, pos, size, col, metal)
	box(name + "_hi", Vector3(pos.x, pos.y + size.y * 0.5 - 0.6, pos.z), Vector3(size.x, 1.2, size.z), col.lightened(0.22))
	box(name + "_lo", Vector3(pos.x, pos.y - size.y * 0.5 + 0.5, pos.z), Vector3(size.x, 1.0, size.z), col.darkened(0.24))

## 柱体（用方柱近似圆角，参考图里手臂 / 腿都是带倒角的柱）
func limb(name: String, pos: Vector3, w: float, h: float, col: Color, metal := false) -> void:
	# 主柱 + 四角削角（用略小的方块叠出倒角感）
	box(name, pos, Vector3(w, h, w), col, metal)
	box(name + "_c1", Vector3(pos.x + w * 0.5, pos.y, pos.z), Vector3(w * 0.22, h * 0.98, w * 0.72), col.lightened(0.1))
	box(name + "_c2", Vector3(pos.x - w * 0.5, pos.y, pos.z), Vector3(w * 0.22, h * 0.98, w * 0.72), col.darkened(0.14))
	box(name + "_c3", Vector3(pos.x, pos.y, pos.z + w * 0.5), Vector3(w * 0.72, h * 0.98, w * 0.22), col.lightened(0.04))
	box(name + "_c4", Vector3(pos.x, pos.y, pos.z - w * 0.5), Vector3(w * 0.72, h * 0.98, w * 0.22), col.darkened(0.1))
