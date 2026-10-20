extends Node3D
## =========================================================
## 余烬回廊 · 体素 3D 角色生成 + 多朝向渲染
## 8 个角色（4 职业 × 2 性别），每个角色 8 个朝向 × 2 个待机帧
## 输出：transparent PNG，统一锚点（脚底中心），供 HTML5 游戏使用
## 用法：
##   godot --headless --script main.gd            # 只跑自检
##   godot -- --render --out=D:/path              # 渲染精灵图
## =========================================================

const U := 0.0625          # 旧版体素：1 单位 = 0.0625 m
const FINE_U := 1.0 / 24.0     # 精细体素：1 单位 = 1/24 m（角色总高 100 单位）
const FINE_H := 100.0          # 精细角色总高（单位）
const FineChar := preload("res://fine_character.gd")
var useFine := false           # --fine 打开精细角色
const OUT_SIZE := 128      # 输出画布尺寸（精细模式自动升到 192）
const SUPERSAMPLE := 4     # 超采样倍数（渲染大图再缩小，边缘更干净）

# ---------------- 调色板（对齐参考图） ----------------
const PAL_IRON := Color("#8d97a5")
const PAL_LEATHER := Color("#6b4526")
const PAL_DARKLEATHER := Color("#3b2f22")
const PAL_GOLD := Color("#e8b93c")
const PAL_BROWN_HAIR := Color("#6b3a1e")
const PAL_DARKHAIR := Color("#3a2416")
const PAL_PURPLE := Color("#7a4fd0")
const PAL_PURPLE_DARK := Color("#3f2f66")
const PAL_PURPLE_LIGHT := Color("#a06cff")
const PAL_SKIN_M := Color("#e0a878")
const PAL_SKIN_F := Color("#e8b48c")
const PAL_STEEL_DARK := Color("#4a5464")

var _root: Node3D
var _joints := {}
var _out_dir := ""

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var do_render := false
	for a in args:
		if a.begins_with("--out="):
			_out_dir = a.substr(6)
		if a == "--render":
			do_render = true
		if a == "--fine":
			useFine = true
	if _out_dir == "":
		_out_dir = OS.get_executable_path().get_base_dir().path_join("sheets")
	print("[voxel] 输出目录：", _out_dir)
	if do_render:
		await render_all()
	else:
		self_check()
	get_tree().quit()

# =========================================================
# 盒子工具
# =========================================================
func _box(parent: Node3D, name: String, pos: Vector3, size: Vector3, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	var m := BoxMesh.new()
	m.size = size * U
	mi.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.roughness = 0.85
	mat.metallic = 0.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mi.material_override = mat
	mi.position = pos * U
	parent.add_child(mi)
	return mi

func _metal(parent: Node3D, name: String, pos: Vector3, size: Vector3, col: Color) -> MeshInstance3D:
	var mi := _box(parent, name, pos, size, col)
	var mat: StandardMaterial3D = mi.material_override
	mat.metallic = 0.75
	mat.roughness = 0.34
	return mi

func _glow(parent: Node3D, name: String, pos: Vector3, size: Vector3, col: Color) -> MeshInstance3D:
	var mi := _box(parent, name, pos, size, col)
	var mat: StandardMaterial3D = mi.material_override
	mat.emission_enabled = true
	mat.emission = col
	mat.emission_energy_multiplier = 2.2
	mat.albedo_color = col
	return mi

# =========================================================
# 体素人物骨架（比例与参考图一致：大头、方块身、短腿）
# =========================================================
func build_character(id: String, cfg: Dictionary) -> Node3D:
	# 精细角色走另一套构建器（100 单位高、硬边光照、45° 斜俯视）
	if useFine:
		var fc := FineChar.new()
		add_child(fc)
		var r: Node3D = fc.build(id, cfg)
		_joints = fc.joints
		remove_child(fc)
		fc.queue_free()
		r.set_meta("total_height", FINE_H)
		return r
	var root := Node3D.new()
	root.name = id
	_joints.clear()

	var female: bool = cfg.get("female", false)
	var broad: bool = cfg.get("broad", true)
	var skin: Color = cfg.get("skin", PAL_SKIN_M)
	var hair: Color = cfg.get("hair", PAL_BROWN_HAIR)
	var cls: String = cfg.get("cls", "blade")
	var d: Dictionary = cfg.get("d", {})

	# 尺寸（体素单位，1 单位 = 0.0625m）
	var HW := 12.0 if broad else 10.0          # 头宽
	var HH := 14.0 if broad else 13.0          # 头高
	var HD := 8.0                               # 头厚
	var TW := 14.0 if broad else 11.0          # 躯干宽
	var TH := 20.0 if broad else 18.0          # 躯干高
	var TD := 7.0 if broad else 6.0
	var AW := 4.0 if broad else 3.0            # 手臂宽
	var AH := 18.0                              # 手臂长
	var LW := 5.0 if broad else 4.0            # 腿宽
	var LH := 17.0                              # 腿长

	# 站立总高：脚 2 + 腿 17 + 躯干 20 + 颈 2 + 头 14 = 55
	var legTop := 2.0 + LH                     # 19
	var torsoTop := legTop + TH                 # 39
	var neckTop := torsoTop + 2.0               # 41
	var headTop := neckTop + HH                 # 55
	var total := headTop

	# ---- 髋（整体上下移动用） ----
	var hips := Node3D.new()
	hips.name = "hips"
	hips.position = Vector3(0, legTop * U, 0)
	root.add_child(hips)
	_joints["hips"] = hips

	# ---- 腿（左/右，各自分段：大腿 / 小腿 / 靴） ----
	var thighLen := LH * 0.45
	var shinLen := LH * 0.33
	var bootLen := LH * 0.22
	for side in [-1, 1]:
		var hip := Node3D.new()
		hip.name = "hip_%s" % ("l" if side < 0 else "r")
		hip.position = Vector3(side * (LW * 0.58) * U, 0, 0)
		hips.add_child(hip)
		_joints["hip_%d" % side] = hip

		var pants: Color = d.get("pants", PAL_DARKLEATHER)
		var boots: Color = d.get("boots", PAL_DARKLEATHER)

		# 大腿（含短裙覆盖在躯干那边画）
		_box(hip, "thigh", Vector3(0, -thighLen * 0.5, 0), Vector3(LW, thighLen, LW), pants)
		var knee := Node3D.new()
		knee.name = "knee"
		knee.position = Vector3(0, -thighLen * U, 0)
		hip.add_child(knee)
		_joints["knee_%d" % side] = knee
		# 小腿
		_box(knee, "shin", Vector3(0, -shinLen * 0.5, 0), Vector3(LW, shinLen, LW), pants)
		# 靴子（比小腿粗一点）
		var bootH := bootLen + 2.0
		_box(knee, "boot", Vector3(0, -(shinLen + bootH * 0.5) + 0.5, 0),
			Vector3(LW + 1.0, bootH, LW + 1.5), boots)

	# ---- 躯干（hips 已抬到髋顶，这里不再重复偏移！部件坐标 0 = 髋顶） ----
	var torso := Node3D.new()
	torso.name = "torso"
	torso.position = Vector3.ZERO
	hips.add_child(torso)

	var chest: Color = d.get("chest", PAL_IRON)
	var belt: Color = d.get("belt", PAL_LEATHER)
	var buckle: Color = d.get("buckle", PAL_GOLD)
	var skirt: Color = d.get("skirt", PAL_DARKLEATHER)

	if female:
		# ---- 女性：短裙 + 露腰 + 束胸 ----
		var skirtH := 5.0
		_box(torso, "skirt", Vector3(0, skirtH * 0.5, 0), Vector3(TW + 1.5, skirtH, TD + 1.5), skirt)
		_box(torso, "belt", Vector3(0, skirtH + 0.6, 0), Vector3(TW + 1.8, 2.0, TD + 1.8), belt)
		_box(torso, "buckle", Vector3(0, skirtH + 0.6, TD * 0.5 + 1.0), Vector3(3.5, 2.4, 1.0), buckle)
		# 露腰：短裙顶 → 束胸底之间是皮肤
		var waistB := skirtH + 1.8
		var corsetB := waistB + 5.0
		_box(torso, "waist", Vector3(0, (waistB + corsetB) * 0.5, 0),
			Vector3(TW - 1.0, corsetB - waistB, TD - 0.6), skin)
		# 束胸：从 corsetB 到肩顶
		var corsetH := TH - corsetB
		_box(torso, "corset", Vector3(0, corsetB + corsetH * 0.5, 0), Vector3(TW, corsetH, TD), chest)
		_box(torso, "corset_trim", Vector3(0, corsetB + corsetH - 0.7, 0),
			Vector3(TW + 0.6, 1.4, TD + 0.6), d.get("chestLight", PAL_IRON))
		# 金扣（两枚，竖排）
		_box(torso, "clasp1", Vector3(0, corsetB + corsetH * 0.34, TD * 0.5 + 0.6), Vector3(2.4, 2.0, 0.8), buckle)
		_box(torso, "clasp2", Vector3(0, corsetB + corsetH * 0.70, TD * 0.5 + 0.6), Vector3(2.4, 2.0, 0.8), buckle)
	else:
		# ---- 男性：整块胸甲（下缘留出腰带位置） ----
		var chestB := 4.6
		var chestH := TH - chestB
		_box(torso, "chest", Vector3(0, chestB + chestH * 0.5, 0), Vector3(TW, chestH, TD), chest)
		_box(torso, "belt", Vector3(0, 2.2, 0), Vector3(TW + 1.0, 3.2, TD + 1.0), belt)
		_box(torso, "buckle", Vector3(0, 2.2, TD * 0.5 + 0.7), Vector3(3.6, 2.6, 1.0), buckle)
		# 交叉皮带（两条斜置薄盒，横跨胸口）
		var st: Color = d.get("strap", PAL_LEATHER)
		for sx in [-1, 1]:
			var band := _box(torso, "strap_%d" % sx,
				Vector3(0, chestB + chestH * 0.52, TD * 0.5 + 0.35),
				Vector3(TW * 1.3, 2.0, 0.7), st)
			band.rotation_degrees = Vector3(0, 0, sx * 42.0)

	# ---- 肩甲 ----
	if d.get("pauldron", true):
		for side in [-1, 1]:
			var pw := 5.0 if broad else 4.2
			_metal(torso, "pauldron_%d" % side,
				Vector3(side * (TW * 0.5 + pw * 0.32), TH - 2.0, 0),
				Vector3(pw, 4.4, TD + 1.2), d.get("pauldronTone", PAL_IRON))

	# ---- 手臂（左/右，上臂 + 前臂 + 手） ----
	var upper := AH * 0.5
	var fore := AH * 0.36
	var hand := AH * 0.14
	for side in [-1, 1]:
		var sh := Node3D.new()
		sh.name = "shoulder_%s" % ("l" if side < 0 else "r")
		sh.position = Vector3(side * (TW * 0.5 + AW * 0.5) * U, (TH - 2.0) * U, 0)
		torso.add_child(sh)
		_joints["shoulder_%d" % side] = sh
		var sleeve: Color = d.get("sleeve", chest)
		_box(sh, "upper", Vector3(0, -upper * 0.5, 0), Vector3(AW, upper, AW), sleeve)
		var el := Node3D.new()
		el.name = "elbow"
		el.position = Vector3(0, -upper * U, 0)
		sh.add_child(el)
		_joints["elbow_%d" % side] = el
		_box(el, "fore", Vector3(0, -fore * 0.5, 0), Vector3(AW + 0.5, fore, AW + 0.5),
			d.get("bracer", PAL_DARKLEATHER))
		_box(el, "hand", Vector3(0, -(fore + hand * 0.5), 0), Vector3(AW + 0.4, hand, AW + 0.4), skin)

	# ---- 脖子 + 头（neck 挂在手肘用的 torso 下，torso 已在髋顶，所以这里只需 +TH） ----
	var neck := Node3D.new()
	neck.name = "neck"
	neck.position = Vector3(0, TH * U, 0)
	torso.add_child(neck)
	_box(neck, "neck", Vector3(0, 1.0, 0), Vector3(4.0, 2.4, 4.0), skin)

	var head := Node3D.new()
	head.name = "head"
	head.position = Vector3(0, 2.0 * U, 0)
	neck.add_child(head)
	_joints["head"] = head

	var helm: bool = d.get("fullHelm", false)
	if helm:
		_build_full_helm(head, HW, HH, HD, d)
	else:
		_box(head, "skull", Vector3(0, HH * 0.5, 0), Vector3(HW, HH, HD), skin)
		_build_face(head, HW, HH, HD, cfg, d)
		_build_hair(head, HW, HH, HD, hair, cfg, d)
		if d.get("wideHat", false):
			_build_wide_hat(head, HW, HH, HD, d)
	if d.get("halo", false):
		_build_halo(head, HH, d)

	# ---- 手持物（剑 / 弓 / 法杖 / 盾） ----
	if d.get("staff", false):
		var hand_r0: Node3D = _joints.get("elbow_1")
		if hand_r0:
			_build_staff(hand_r0, fore + hand, d)
	elif d.get("bow", false):
		var hand_r1: Node3D = _joints.get("elbow_1")
		if hand_r1:
			_build_bow(hand_r1, fore + hand, d, cls)
	else:
		# 剑士 / 骑士：右手握剑；骑士另加左手塔盾
		var hand_r2: Node3D = _joints.get("elbow_1")
		if hand_r2:
			_build_sword(hand_r2, fore + hand, d, cls)
	if d.get("shield", false):
		var hand_l: Node3D = _joints.get("elbow_-1")
		if hand_l:
			_build_shield(hand_l, fore + hand, d)

	root.set_meta("total_height", total)
	return root

# ---------------- 长剑（剑士 / 骑士） ----------------
func _build_sword(hand: Node3D, handLen: float, d: Dictionary, cls: String) -> void:
	var bladeCol: Color = d.get("bladeTone", Color("#c9d3e0"))
	var grip: Color = d.get("gripTone", Color("#4a3222"))
	var guard: Color = d.get("guardTone", d.get("buckle", PAL_GOLD))
	var long := cls == "knight"
	var bl := 26.0 if long else 23.0            # 剑身长
	var bw := 2.6 if long else 2.2
	var sw := Node3D.new()
	sw.name = "sword"
	sw.position = Vector3(0, -handLen * U, 0)
	hand.add_child(sw)
	# 握把（在手下方一点，让剑从手里长出来）
	_box(sw, "grip", Vector3(0, 1.0, 0), Vector3(2.0, 4.0, 2.0), grip)
	# 护手（横向）
	_metal(sw, "guard", Vector3(0, 3.4, 0), Vector3(8.2 if long else 7.0, 1.6, 2.4), guard)
	# 剑身（细长，向上）
	_metal(sw, "blade", Vector3(0, 3.4 + bl * 0.5, 0), Vector3(bw, bl, 1.4), bladeCol)
	# 剑脊高光
	_box(sw, "ridge", Vector3(0, 3.4 + bl * 0.5, 0.75), Vector3(bw * 0.34, bl * 0.96, 0.3), bladeCol.lightened(0.3))
	# 剑尖
	_metal(sw, "tip", Vector3(0, 3.4 + bl + 1.4, 0), Vector3(bw * 0.7, 3.0, 1.0), bladeCol)
	# 柄头
	_box(sw, "pommel", Vector3(0, -1.6, 0), Vector3(3.0, 1.8, 3.0), guard.darkened(0.1))

# ---------------- 长弓（游侠） ----------------
func _build_bow(hand: Node3D, handLen: float, d: Dictionary, cls: String) -> void:
	var wood: Color = d.get("bowTone", Color("#5a3a20"))
	var strCol: Color = d.get("stringTone", Color("#d8d2c4"))
	var bw := Node3D.new()
	bw.name = "bow"
	bw.position = Vector3(0, -handLen * U, 0)
	hand.add_child(bw)
	# 弓臂（上 / 中 / 下 三段近似弧）
	_box(bw, "limb_mid", Vector3(0, 8.0, 0), Vector3(1.8, 12.0, 2.6), wood)
	_box(bw, "limb_up", Vector3(0, 16.5, 1.4), Vector3(1.6, 8.0, 2.2), wood.lightened(0.08))
	_box(bw, "limb_dn", Vector3(0, -0.5, 1.4), Vector3(1.6, 8.0, 2.2), wood.lightened(0.08))
	_box(bw, "tip_up", Vector3(0, 21.4, 2.6), Vector3(1.4, 2.4, 1.6), wood.darkened(0.12))
	_box(bw, "tip_dn", Vector3(0, -5.4, 2.6), Vector3(1.4, 2.4, 1.6), wood.darkened(0.12))
	# 弓弦
	_box(bw, "string", Vector3(0, 8.0, 3.2), Vector3(0.5, 26.0, 0.5), strCol)
	# 握把
	_box(bw, "grip", Vector3(0, 8.0, -0.8), Vector3(2.8, 5.0, 2.0), wood.darkened(0.2))

# ---------------- 脸部（体素五官，贴在头正面） ----------------
func _build_face(head: Node3D, HW: float, HH: float, HD: float, cfg: Dictionary, d: Dictionary) -> void:
	var z := HD * 0.5 + 0.05
	var skin: Color = cfg.get("skin", PAL_SKIN_M)
	var eye: Color = cfg.get("eye", Color("#f2eee8"))
	var hcol: Color = cfg.get("hair", PAL_BROWN_HAIR)
	var brow := hcol.darkened(0.35)
	var white := Color("#efe8dc")
	var pupil := Color("#1a120e")

	var eyeY := HH * 0.62
	var eyeGap := HW * 0.22
	# 眉毛
	for sx in [-1, 1]:
		_box(head, "brow_%d" % sx, Vector3(sx * eyeGap, eyeY + 2.0, z),
			Vector3(HW * 0.3, 1.0, 0.5), brow)
	# 眼白 + 瞳孔 + 高光
	for sx in [-1, 1]:
		_box(head, "eye_%d" % sx, Vector3(sx * eyeGap, eyeY, z),
			Vector3(HW * 0.26, 1.8, 0.5), white)
		var pc := eye if d.get("glowingEyes", false) else pupil
		var pm := _box(head, "pupil_%d" % sx, Vector3(sx * eyeGap, eyeY, z + 0.15),
			Vector3(HW * 0.15, 1.2, 0.4), pc)
		if d.get("glowingEyes", false):
			var mat: StandardMaterial3D = pm.material_override
			mat.emission_enabled = true
			mat.emission = pc
			mat.emission_energy_multiplier = 2.6
		_box(head, "glint_%d" % sx, Vector3(sx * eyeGap - 0.5, eyeY + 0.4, z + 0.3),
			Vector3(0.5, 0.5, 0.3), Color.WHITE)
	# 鼻子
	_box(head, "nose", Vector3(0, eyeY - 2.4, z + 0.4), Vector3(1.8, 2.4, 1.2), skin.darkened(0.06))
	# 嘴 / 胡须
	if d.get("beard", false):
		var bd: Color = d.get("beardTone", hcol.darkened(0.2))
		# 络腮：两侧竖条 + 下巴横条
		for sx in [-1, 1]:
			_box(head, "beard_side_%d" % sx, Vector3(sx * (HW * 0.5 - 0.9), HH * 0.34, z - 0.1),
				Vector3(1.8, HH * 0.5, 0.9), bd)
		_box(head, "beard_chin", Vector3(0, HH * 0.14, z - 0.1), Vector3(HW - 1.6, HH * 0.3, 0.9), bd)
		# 八字须
		for sx in [-1, 1]:
			_box(head, "mustache_%d" % sx, Vector3(sx * 1.6, eyeY - 4.0, z + 0.3),
				Vector3(2.2, 0.9, 0.9), bd.lightened(0.12))
	else:
		_box(head, "mouth", Vector3(0, eyeY - 4.4, z + 0.2), Vector3(2.6, 0.8, 0.6),
			skin.darkened(0.3))
	# 腮红
	if cfg.get("female", false):
		for sx in [-1, 1]:
			_box(head, "blush_%d" % sx, Vector3(sx * (HW * 0.34), eyeY - 2.6, z - 0.05),
				Vector3(1.6, 1.2, 0.4), Color("#c8705a", 0.5))

# ---------------- 头发 ----------------
func _build_hair(head: Node3D, HW: float, HH: float, HD: float, hair: Color, cfg: Dictionary, d: Dictionary) -> void:
	var style: String = cfg.get("hairStyle", "short")
	var lt := hair.lightened(0.18)
	# 颅顶
	_box(head, "hair_top", Vector3(0, HH + 1.0, 0), Vector3(HW + 1.0, 2.6, HD + 1.0), hair)
	_box(head, "hair_cap", Vector3(0, HH - 1.6, 0), Vector3(HW + 0.8, 4.0, HD + 0.8), hair)
	# 后脑（厚度方向加一层）
	_box(head, "hair_back", Vector3(0, HH * 0.5, -(HD * 0.5 + 0.5)), Vector3(HW + 0.6, HH * 0.9, 1.2), hair.darkened(0.12))
	if style == "long":
		# 长发：两侧 + 后背
		for sx in [-1, 1]:
			_box(head, "hair_side_%d" % sx, Vector3(sx * (HW * 0.5 + 0.7), HH * 0.34, 0),
				Vector3(1.8, HH * 1.1, HD + 0.4), hair)
			_box(head, "hair_tip_%d" % sx, Vector3(sx * (HW * 0.5 + 0.7), -HH * 0.24, 0),
				Vector3(2.2, 3.0, HD + 0.8), hair.darkened(0.1))
		_box(head, "hair_down", Vector3(0, -HH * 0.1, -(HD * 0.5 + 1.0)), Vector3(HW + 1.6, HH * 1.1, 1.6), hair.darkened(0.08))
	elif style == "bun":
		_box(head, "hair_bun", Vector3(0, HH + 3.4, 0), Vector3(6.0, 4.0, 6.0), hair)
		_box(head, "hair_bun_top", Vector3(0, HH + 5.8, 0), Vector3(4.0, 2.0, 4.0), lt)
	else:
		# 短发：两侧短鬓角
		for sx in [-1, 1]:
			_box(head, "hair_short_%d" % sx, Vector3(sx * (HW * 0.5 + 0.4), HH * 0.72, 0),
				Vector3(1.2, 3.6, HD + 0.4), hair)

# ---------------- 宽檐帽 ----------------
func _build_wide_hat(head: Node3D, HW: float, HH: float, HD: float, d: Dictionary) -> void:
	var c: Color = d.get("hatTone", Color("#4a3320"))
	# 帽檐
	_box(head, "hat_brim", Vector3(0, HH + 2.4, 0), Vector3(HW + 8.0, 1.4, HD + 8.0), c)
	# 帽冠（三段收窄）
	_box(head, "hat_crown1", Vector3(0, HH + 5.0, 0), Vector3(HW - 2.0, 4.0, HD - 1.0), c.lightened(0.1))
	_box(head, "hat_crown2", Vector3(0, HH + 8.0, 0), Vector3(HW - 4.0, 3.0, HD - 2.6), c.lightened(0.16))
	# 帽带
	_box(head, "hat_band", Vector3(0, HH + 3.2, 0), Vector3(HW - 1.6, 1.2, HD - 0.6),
		d.get("buckle", PAL_GOLD))

# ---------------- 全罩头盔 ----------------
func _build_full_helm(head: Node3D, HW: float, HH: float, HD: float, d: Dictionary) -> void:
	var t: Color = d.get("helmTone", PAL_IRON)
	var dk := t.darkened(0.28)
	var lt := t.lightened(0.2)
	# 盔体
	_box(head, "helm", Vector3(0, HH * 0.5, 0), Vector3(HW + 1.6, HH + 1.0, HD + 1.4), t)
	# 高顶
	_box(head, "helm_top", Vector3(0, HH + 2.6, 0), Vector3(HW - 1.0, 3.6, HD - 0.6), t)
	_box(head, "helm_peak", Vector3(0, HH + 5.2, 0), Vector3(HW - 4.0, 2.2, HD - 3.0), t.lightened(0.08))
	# 顶脊
	_box(head, "helm_ridge", Vector3(0, HH + 3.0, 0), Vector3(1.8, 8.0, HD + 1.6), lt)
	# 面缝
	_box(head, "helm_slit", Vector3(0, HH * 0.62, HD * 0.5 + 0.9), Vector3(HW - 1.0, 2.4, 0.8), Color("#0c0f13"))
	for sx in [-1, 1]:
		_box(head, "helm_eye_%d" % sx, Vector3(sx * 2.4, HH * 0.62, HD * 0.5 + 1.05),
			Vector3(2.6, 1.4, 0.5), Color("#414c59"))
	# 呼吸孔
	for sx in [-1, 1]:
		_box(head, "helm_vent_%d" % sx, Vector3(sx * 1.2, HH * 0.3, HD * 0.5 + 0.9),
			Vector3(0.8, 1.4, 0.6), dk)
	# 颈护
	_box(head, "helm_neck", Vector3(0, -1.2, 0), Vector3(HW + 2.4, 2.6, HD + 2.0), t.darkened(0.1))

# ---------------- 光环 ----------------
func _build_halo(head: Node3D, HH: float, d: Dictionary) -> void:
	var col: Color = d.get("haloTone", PAL_PURPLE_LIGHT)
	var ring := Node3D.new()
	ring.name = "halo"
	ring.position = Vector3(0, (HH + 6.5) * U, 0)
	head.add_child(ring)
	# 用 12 段小盒围成一个环
	var seg := 12
	var rad := 7.0
	for i in seg:
		var a := TAU * float(i) / float(seg)
		var mi := _glow(ring, "halo_%d" % i,
			Vector3(cos(a) * rad, 0, sin(a) * rad),
			Vector3(2.4, 0.9, 1.0), col)
		mi.rotation = Vector3(0, -a, 0)

# ---------------- 法杖 ----------------
func _build_staff(hand: Node3D, handLen: float, d: Dictionary) -> void:
	var wood: Color = d.get("staffTone", Color("#3a2a1a"))
	var gem: Color = d.get("gem", PAL_PURPLE_LIGHT)
	var staff := Node3D.new()
	staff.name = "staff"
	staff.position = Vector3(0, -handLen * U, 0)
	hand.add_child(staff)
	# 杖身
	_box(staff, "shaft", Vector3(0, -6.0, 0), Vector3(2.2, 34.0, 2.2), wood)
	# 握把缠绕
	for i in 4:
		_box(staff, "wrap_%d" % i, Vector3(0, -2.0 - i * 2.6, 0), Vector3(2.8, 1.2, 2.8), wood.lightened(0.22))
	# 托架
	_box(staff, "mount", Vector3(0, 12.6, 0), Vector3(4.6, 3.0, 4.6), wood.lightened(0.14))
	# 水晶（八面体用两个盒近似 + 发光）
	_glow(staff, "gem", Vector3(0, 16.4, 0), Vector3(3.4, 6.0, 3.4), gem)
	_glow(staff, "gem_top", Vector3(0, 20.0, 0), Vector3(1.8, 2.4, 1.8), gem.lightened(0.2))

# ---------------- 塔盾 ----------------
func _build_shield(hand: Node3D, handLen: float, d: Dictionary) -> void:
	var face: Color = d.get("shieldTone", PAL_IRON)
	var trim: Color = d.get("buckle", PAL_GOLD)
	var sh := Node3D.new()
	sh.name = "shield"
	sh.position = Vector3(0, -handLen * U, 0)
	hand.add_child(sh)
	# 盾面
	_metal(sh, "face", Vector3(-1.6, -2.0, 0.4), Vector3(1.6, 22.0, 12.0), face)
	# 上宽下尖
	_box(sh, "tip", Vector3(-1.6, -14.6, 0.4), Vector3(1.6, 4.0, 8.0), face.darkened(0.1))
	# 金边
	for zz in [-1, 1]:
		_box(sh, "trim_z%d" % zz, Vector3(-1.6, -2.0, zz * 5.6), Vector3(1.8, 22.0, 1.2), trim)
	_box(sh, "trim_top", Vector3(-1.6, 8.6, 0.4), Vector3(1.8, 1.4, 12.0), trim)
	_box(sh, "trim_bot", Vector3(-1.6, -12.4, 0.4), Vector3(1.8, 1.4, 10.0), trim.darkened(0.1))
	# 徽记
	_box(sh, "emblem_v", Vector3(-1.1, -2.0, 0.4), Vector3(0.8, 9.0, 1.6), trim)
	_box(sh, "emblem_h", Vector3(-1.1, 1.0, 0.4), Vector3(0.8, 1.6, 6.4), trim)

# =========================================================
# 8 个角色的配置
# =========================================================
func character_configs() -> Array:
	var arr := []
	# ---- 男 · 剑士 ----
	arr.append({
		"id": "lk_a", "cls": "blade", "female": false, "broad": true, "hairStyle": "short",
		"skin": PAL_SKIN_M, "hair": PAL_BROWN_HAIR, "eye": Color("#d8c8b8"),
		"d": {
			"chest": Color("#5b636f"), "chestLight": Color("#77808d"), "pants": Color("#2f3540"),
			"boots": Color("#2a1c14"), "belt": Color("#4a3222"), "buckle": PAL_GOLD,
			"strap": Color("#8a6a3a"), "bracer": Color("#3a3f48"), "pauldron": true,
			"pauldronTone": Color("#77808d"), "sleeve": Color("#5b636f")
		}
	})
	# ---- 男 · 游侠 ----
	arr.append({
		"id": "lk_b", "cls": "ranger", "female": false, "broad": true, "hairStyle": "short",
		"skin": Color("#d99a68"), "hair": PAL_DARKHAIR, "eye": Color("#f0d8b8"),
		"d": {
			"beard": true, "beardTone": Color("#241609"),
			"wideHat": true, "hatTone": Color("#4a3320"), "hatBand": Color("#2a1c10"),
			"cape": true, "capeTone": Color("#5a3a20"), "armor": PAL_DARKLEATHER, "armorL": Color("#5a4732"),
			"chest": PAL_DARKLEATHER, "chestLight": Color("#5a4732"), "pants": Color("#3a3226"),
			"boots": Color("#3a2a1c"), "belt": Color("#4a3222"), "buckle": Color("#c9a24a"),
			"strap": PAL_LEATHER, "bracer": Color("#4a3320"), "pauldron": true,
			"pauldronTone": Color("#5a4732"), "sleeve": PAL_DARKLEATHER
		}
	})
	# ---- 男 · 法师 ----
	arr.append({
		"id": "lk_c", "cls": "mage", "female": false, "broad": true, "hairStyle": "short",
		"skin": Color("#e0b090"), "hair": Color("#5a3a24"), "eye": PAL_PURPLE_LIGHT,
		"d": {
			"beard": true, "beardTone": Color("#3a2418"),
			"halo": true, "staff": true, "glowingEyes": true,
			"robe": true, "robeTone": PAL_PURPLE_DARK, "robeLight": Color("#5f4a9a"),
			"robeButton": Color("#d84fd0"), "robeLong": false,
			"armor": PAL_PURPLE_DARK, "armorL": Color("#5f4a9a"),
			"gem": PAL_PURPLE_LIGHT, "haloTone": PAL_PURPLE_LIGHT,
			"chest": PAL_PURPLE_DARK, "chestLight": Color("#5f4a9a"), "pants": Color("#4a3474"),
			"boots": Color("#2f2246"), "belt": Color("#3a2a4a"), "buckle": Color("#d9a84a"),
			"strap": Color("#8a5fd0"), "bracer": Color("#3a2a5a"), "pauldron": true,
			"pauldronTone": Color("#5f4a9a"), "sleeve": PAL_PURPLE_DARK
		}
	})
	# ---- 男 · 骑士 ----
	arr.append({
		"id": "lk_d", "cls": "knight", "female": false, "broad": true, "hairStyle": "short",
		"skin": Color("#d9a878"), "hair": Color("#6b5230"), "eye": Color("#ffd479"),
		"d": {
			"fullHelm": true, "helmTone": Color("#8a94a2"), "helmCrest": true, "shield": true, "shieldEmblem": true,
			"chest": Color("#5f6875"), "chestLight": Color("#8a94a2"), "pants": Color("#565e6b"),
			"boots": Color("#3a4048"), "belt": Color("#4a4030"), "buckle": PAL_GOLD,
			"strap": Color("#6b5a3a"), "bracer": Color("#5a6270"), "pauldron": true,
			"pauldronTone": Color("#8a94a2"), "sleeve": Color("#5f6875"),
			"shieldTone": Color("#8a94a2")
		}
	})
	# ---- 女 · 剑士 ----
	arr.append({
		"id": "lk_a_f", "cls": "blade", "female": true, "broad": false, "hairStyle": "long",
		"skin": PAL_SKIN_F, "hair": Color("#5a2a6e"), "eye": Color("#8a5a38"),
		"d": {
			"chest": Color("#3a4150"), "chestLight": Color("#5a6474"), "pants": Color("#2a3038"),
			"boots": Color("#5a3a24"), "belt": Color("#3a2a1c"), "buckle": PAL_GOLD,
			"strap": Color("#4a3020"), "bracer": Color("#2f3540"), "skirt": Color("#2a3038"),
			"pauldron": true, "pauldronTone": Color("#5a6474"), "sleeve": Color("#3a4150")
		}
	})
	# ---- 女 · 游侠 ----
	arr.append({
		"id": "lk_b_f", "cls": "ranger", "female": true, "broad": false, "hairStyle": "long",
		"skin": PAL_SKIN_F, "hair": Color("#6a3a9a"), "eye": Color("#f0d8b8"), "hairOrn": Color("#e8c14a"),
		"d": {
			"chest": Color("#4a3a2a"), "chestLight": Color("#6b5236"), "pants": Color("#5a4030"),
			"boots": Color("#5a3a24"), "belt": Color("#4a3222"), "buckle": Color("#c9a24a"),
			"strap": PAL_LEATHER, "bracer": Color("#4a3320"), "skirt": Color("#4a3a2a"),
			"cape": true, "capeTone": Color("#4a3320"),
			"pauldron": true, "pauldronTone": Color("#6b5236"), "sleeve": Color("#4a3a2a")
		}
	})
	# ---- 女 · 法师 ----
	arr.append({
		"id": "lk_c_f", "cls": "mage", "female": true, "broad": false, "hairStyle": "long",
		"skin": PAL_SKIN_F, "hair": Color("#6b3f9e"), "eye": Color("#d9a8ff"), "hairOrn": Color("#e8c14a"),
		"d": {
			"halo": true, "staff": true, "glowingEyes": true,
			"robe": true, "robeTone": PAL_PURPLE_DARK, "robeLight": Color("#5f4a9a"),
			"robeButton": Color("#d84fd0"), "robeLong": true,
			"gem": PAL_PURPLE_LIGHT, "haloTone": PAL_PURPLE_LIGHT, "armor": PAL_PURPLE_DARK, "armorL": Color("#5f4a9a"),
			"chest": PAL_PURPLE_DARK, "chestLight": Color("#5f4a9a"), "pants": Color("#3f2f66"),
			"boots": Color("#4a3474"), "belt": Color("#3a2a4a"), "buckle": Color("#d9a84a"),
			"strap": Color("#8a5fd0"), "bracer": Color("#3a2a5a"), "skirt": PAL_PURPLE_DARK,
			"pauldron": true, "pauldronTone": Color("#5f4a9a"), "sleeve": PAL_PURPLE_DARK
		}
	})
	# ---- 女 · 骑士 ----
	arr.append({
		"id": "lk_d_f", "cls": "knight", "female": true, "broad": false, "hairStyle": "long",
		"skin": PAL_SKIN_F, "hair": Color("#5a2a6e"), "eye": Color("#ffd479"),
		"d": {
			"shield": true, "shieldTone": Color("#8a94a2"), "shieldEmblem": true,
			"chest": Color("#5f6875"), "chestLight": Color("#8a94a2"), "pants": Color("#3f4652"),
			"boots": Color("#5a6270"), "belt": Color("#4a4030"), "buckle": PAL_GOLD,
			"strap": Color("#6b5a3a"), "bracer": Color("#5a6270"), "skirt": Color("#3f4652"),
			"pauldron": true, "pauldronTone": Color("#8a94a2"), "sleeve": Color("#5f6875")
		}
	})
	return arr

# =========================================================
# 自检
# =========================================================
func self_check() -> void:
	print("========== 体素角色自检 ==========")
	var cfgs := character_configs()
	print("角色数量：", cfgs.size())
	var ids := {}
	var ok := true
	for c in cfgs:
		if ids.has(c["id"]):
			print("  [错误] 重复 id：", c["id"])
			ok = false
		ids[c["id"]] = true
		var node := build_character(c["id"], c)
		if node == null:
			print("  [错误] 构建失败：", c["id"])
			ok = false
			continue
		var meshes := _count_meshes(node)
		var total: float = node.get_meta("total_height", 0.0)
		print("  %-8s 职业=%-7s 性别=%s 盒子=%-4d 站立高=%d 体素" % [
			c["id"], c["cls"], ("女" if c["female"] else "男"), meshes, int(total)
		])
		node.queue_free()
	# 配对检查
	for c in cfgs:
		var pair := ""
		for o in cfgs:
			if o["cls"] == c["cls"] and o["female"] != c["female"]:
				pair = o["id"]
		if pair == "":
			print("  [错误] 职业缺配对：", c["cls"])
			ok = false
	print("结论：", "全部通过" if ok else "存在问题")

func _count_meshes(n: Node) -> int:
	var c := 0
	if n is MeshInstance3D:
		c += 1
	for ch in n.get_children():
		c += _count_meshes(ch)
	return c

# =========================================================
# 渲染
# =========================================================
func _setup_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.background_canvas_max_layer = 0
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.92, 0.94, 1.0)
	# 精细模式降低环境光，让主光与轮廓光形成明确体积（参考图的硬边明暗）
	env.ambient_light_energy = 0.62 if useFine else 1.75
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR   # 不做 filmic 压暗
	env.ssao_enabled = false
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var fine := useFine
	var key := DirectionalLight3D.new()
	# 参考图的光：主光从前上偏右打，形成明确明暗面
	key.rotation_degrees = Vector3(-42 if fine else -28, -52 if fine else -118, 0)
	key.light_energy = 1.25 if fine else 0.85
	key.light_color = Color(1.0, 0.98, 0.94)
	key.shadow_enabled = false                          # 关阴影，避免自遮挡把躯干压黑
	add_child(key)

	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-20, 58, 0)         # 补光：前上右
	fill.light_energy = 0.55
	fill.light_color = Color(0.82, 0.88, 1.0)
	fill.shadow_enabled = false
	add_child(fill)

	var rim := DirectionalLight3D.new()
	# 轮廓光：来自右后方，冷蓝色（参考图角色右侧那道亮边）
	rim.rotation_degrees = Vector3(-18, 128, 0)
	rim.light_energy = 0.85 if fine else 0.35
	rim.light_color = Color(0.55, 0.75, 1.0)
	rim.shadow_enabled = false
	add_child(rim)

func render_all() -> void:
	_setup_world()
	DirAccess.make_dir_recursive_absolute(_out_dir)

	var out_size := 192 if useFine else OUT_SIZE
	var vp := SubViewport.new()
	vp.size = Vector2i(out_size * SUPERSAMPLE, out_size * SUPERSAMPLE)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	add_child(vp)

	# 取景：透视相机 + 明确 FOV 与距离，保证模型完整入画
	var total_h: float = (FINE_H + 12.0) * FINE_U if useFine else 4.25
	var fov := 18.0
	var fit := total_h * 1.10                      # 覆盖高度 + 上下留白
	var dist := (fit * 0.5) / tan(deg_to_rad(fov * 0.5))
	# 精细模式：斜俯视（俯角 22°，既能看到头顶又不至于显得"斜躺"）
	var pitch := 22.0 if useFine else 0.0
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	cam.fov = fov
	cam.near = 0.05
	cam.far = 80.0
	cam.position = Vector3(0, total_h * 0.5 + sin(deg_to_rad(pitch)) * dist, cos(deg_to_rad(pitch)) * dist)
	cam.rotation_degrees = Vector3(-pitch, 0, 0)
	cam.current = true
	vp.add_child(cam)
	print("[voxel] 取景：模型高 %.3fm  FOV %.1f°  距离 %.3fm" % [total_h, fov, dist])

	var pivot := Node3D.new()
	vp.add_child(pivot)

	var total := 0
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = a.substr(7)
	for cfg in character_configs():
		if only != "" and cfg["id"] != only:
			continue
		var model := build_character(cfg["id"], cfg)
		pivot.add_child(model)
		for dir_i in 8:
			var yaw := float(dir_i) * 45.0
			pivot.rotation_degrees = Vector3(0, yaw, 0)
			for anim in ANIM_ORDER:
				for pose in _anim_frames(anim):
					_apply_pose(model, pose)
					await _wait_frames(2)
					var img := vp.get_texture().get_image()
					img.resize(out_size, out_size, Image.INTERPOLATE_LANCZOS)
					var fname := "%s_d%d_%s.png" % [cfg["id"], dir_i, pose["name"]]
					var err := img.save_png(_out_dir.path_join(fname))
					if err != OK:
						print("  [错误] 写文件失败：", fname, " err=", err)
					else:
						total += 1
		pivot.remove_child(model)
		model.queue_free()
		print("  已渲染 %s（8 朝向 × %d 帧 = %d 张）" % [cfg["id"], _total_frames(), 8 * _total_frames()])
	print("渲染完成：共 %d 张 → %s" % [total, _out_dir])

# =========================================================
# 12 个动作姿态（每个角色 × 8 朝向）
#   0 待机A  1 待机B  2 走路A  3 走路B  4 奔跑
#   5 普攻1  6 普攻2  7 普攻3  8 技能蓄力  9 技能释放
#   10 受击  11 下蹲
# =========================================================
# =========================================================
# 动画关键帧（每项 = 一个姿态参数字典）
#   bob 上下起伏 / hip 大腿摆动 / knee 屈膝 / sh 肩摆 / el 肘弯
#   spine 躯干前倾 / head 头部俯仰 / tilt 整体倾角 / wpn 握武器角
# =========================================================
const K_IDLE := [
	{ "bob": 0.0, "spine": 0.0, "head": 0.0, "sh": 3.0, "el": -7.0, "knee": 0.0, "wpn": -0.35 },
	{ "bob": -1.2, "spine": 1.5, "head": -1.5, "sh": 5.0, "el": -10.0, "knee": 1.5, "wpn": -0.30 },
]

const K_WALK := [
	{ "bob": -0.6, "hip": 26.0, "spine": 3.0, "head": -1.5, "sh": -24.0, "el": -22.0, "knee": 6.0, "tilt": 1.4, "wpn": -0.55 },
	{ "bob": -2.0, "hip": 15.0, "spine": 3.5, "head": -2.0, "sh": -14.0, "el": -28.0, "knee": 20.0, "tilt": 1.6, "wpn": -0.60 },
	{ "bob": -1.0, "hip": 2.0, "spine": 3.0, "head": -2.0, "sh": -2.0, "el": -24.0, "knee": 8.0, "tilt": 1.4, "wpn": -0.50 },
	{ "bob": 0.6, "hip": -16.0, "spine": 2.5, "head": -1.5, "sh": 16.0, "el": -18.0, "knee": 4.0, "tilt": 1.2, "wpn": -0.45 },
	{ "bob": -0.6, "hip": -26.0, "spine": 3.0, "head": -1.5, "sh": 24.0, "el": -22.0, "knee": 6.0, "tilt": 1.4, "wpn": -0.50 },
	{ "bob": -2.0, "hip": -15.0, "spine": 3.5, "head": -2.0, "sh": 14.0, "el": -28.0, "knee": 20.0, "tilt": 1.6, "wpn": -0.55 },
	{ "bob": -1.0, "hip": -2.0, "spine": 3.0, "head": -2.0, "sh": 2.0, "el": -24.0, "knee": 8.0, "tilt": 1.4, "wpn": -0.55 },
	{ "bob": 0.6, "hip": 16.0, "spine": 2.5, "head": -1.5, "sh": -16.0, "el": -18.0, "knee": 4.0, "tilt": 1.2, "wpn": -0.50 },
]

const K_RUN := [
	{ "bob": -2.0, "hip": 48.0, "spine": 15.0, "head": -8.0, "sh": -52.0, "el": -46.0, "knee": 24.0, "tilt": 7.0, "wpn": -1.05 },
	{ "bob": -4.2, "hip": 30.0, "spine": 16.0, "head": -9.0, "sh": -32.0, "el": -54.0, "knee": 52.0, "tilt": 7.6, "wpn": -1.15 },
	{ "bob": -1.4, "hip": 4.0, "spine": 15.0, "head": -8.0, "sh": -4.0, "el": -50.0, "knee": 30.0, "tilt": 7.0, "wpn": -1.00 },
	{ "bob": -3.0, "hip": -30.0, "spine": 13.0, "head": -7.0, "sh": 30.0, "el": -40.0, "knee": 12.0, "tilt": 6.2, "wpn": -0.95 },
	{ "bob": -2.0, "hip": -48.0, "spine": 15.0, "head": -8.0, "sh": 52.0, "el": -46.0, "knee": 24.0, "tilt": 7.0, "wpn": -0.90 },
	{ "bob": -4.2, "hip": -30.0, "spine": 16.0, "head": -9.0, "sh": 32.0, "el": -54.0, "knee": 52.0, "tilt": 7.6, "wpn": -0.95 },
	{ "bob": -1.4, "hip": -4.0, "spine": 15.0, "head": -8.0, "sh": 4.0, "el": -50.0, "knee": 30.0, "tilt": 7.0, "wpn": -1.00 },
	{ "bob": -3.0, "hip": 30.0, "spine": 13.0, "head": -7.0, "sh": -30.0, "el": -40.0, "knee": 12.0, "tilt": 6.2, "wpn": -1.10 },
]

const K_ATK1 := [
	{ "bob": -0.6, "hip": 6.0, "spine": 3.0, "head": 1.0, "sh": -78.0, "el": -20.0, "knee": 4.0, "tilt": 3.0, "wpn": -1.55 },
	{ "bob": -1.6, "hip": 10.0, "spine": 6.0, "head": 0.0, "sh": -108.0, "el": -24.0, "knee": 7.0, "tilt": 6.0, "wpn": -2.05 },
	{ "bob": -1.0, "hip": 6.0, "spine": 2.0, "head": -1.0, "sh": -46.0, "el": -18.0, "knee": 5.0, "tilt": 2.0, "wpn": -1.70 },
]

const K_ATK2 := [
	{ "bob": -0.4, "hip": -4.0, "spine": 1.0, "head": 0.5, "sh": -20.0, "el": -14.0, "knee": 3.0, "tilt": -1.0, "wpn": -1.60 },
	{ "bob": -0.8, "hip": -8.0, "spine": -3.0, "head": 0.0, "sh": 12.0, "el": -8.0, "knee": 5.0, "tilt": -4.0, "wpn": -1.35 },
	{ "bob": -0.5, "hip": -2.0, "spine": 1.0, "head": -0.5, "sh": -6.0, "el": -12.0, "knee": 4.0, "tilt": -1.5, "wpn": -1.50 },
]

const K_ATK3 := [
	{ "bob": -2.6, "hip": 30.0, "spine": 18.0, "head": -7.0, "sh": 84.0, "el": -18.0, "knee": 16.0, "tilt": 11.0, "wpn": -2.62 },
	{ "bob": -2.4, "hip": 26.0, "spine": 16.0, "head": -6.0, "sh": 72.0, "el": -16.0, "knee": 14.0, "tilt": 10.0, "wpn": -2.42 },
	{ "bob": -1.4, "hip": 16.0, "spine": 10.0, "head": -3.0, "sh": 40.0, "el": -22.0, "knee": 9.0, "tilt": 6.0, "wpn": -2.05 },
]

const K_SKILL := [
	{ "bob": 0.6, "spine": -8.0, "head": -6.0, "sh": -118.0, "el": -26.0, "knee": 1.0, "tilt": -2.0, "wpn": -2.35 },
	{ "bob": 0.4, "spine": -11.0, "head": -8.0, "sh": -152.0, "el": -30.0, "knee": 2.0, "tilt": -3.0, "wpn": -2.75 },
	{ "bob": -1.6, "spine": 2.0, "head": -6.0, "sh": -86.0, "el": -18.0, "knee": 5.0, "tilt": 2.0, "wpn": -2.15 },
	{ "bob": -2.6, "hip": 8.0, "spine": 12.0, "head": -4.0, "sh": -18.0, "el": -10.0, "knee": 9.0, "tilt": 8.0, "wpn": -1.55 },
]

const K_HURT := [
	{ "bob": -1.0, "hip": -10.0, "spine": -20.0, "head": 13.0, "sh": 26.0, "el": -44.0, "knee": 11.0, "tilt": -12.0, "wpn": 0.35 },
]

const K_CROUCH := [
	{ "bob": -7.0, "hip": -16.0, "spine": 26.0, "head": -9.0, "sh": 22.0, "el": -62.0, "knee": 52.0, "tilt": 0.0, "wpn": -0.85 },
]

# 动画名 → 关键帧列表（帧名 = a00 / a01 …，对应游戏里的帧号）
const ANIMS := {
	"idle": K_IDLE,
	"walk": K_WALK,
	"run": K_RUN,
	"atk1": K_ATK1,
	"atk2": K_ATK2,
	"atk3": K_ATK3,
	"skill": K_SKILL,
	"hurt": K_HURT,
	"crouch": K_CROUCH,
}

# 导出顺序（游戏按帧号取图，所以每个动画帧号从 0 开始连续）
const ANIM_ORDER := ["idle", "walk", "run", "atk1", "atk2", "atk3", "skill", "hurt", "crouch"]

func _anim_frames(anim: String) -> Array:
	var keys: Array = ANIMS[anim]
	var out := []
	for i in keys.size():
		var f: Dictionary = keys[i].duplicate()
		f["name"] = "%s_%02d" % [anim, i]
		out.append(f)
	return out

func _total_frames() -> int:
	var n := 0
	for a in ANIM_ORDER:
		n += (ANIMS[a] as Array).size()
	return n

func _apply_pose(model: Node3D, p: Dictionary) -> void:
	# 精细角色总高 100 单位，旧版 55 —— 位移量按比例换算
	var sc := (FINE_H / 55.0) if useFine else 1.0
	var unit := FINE_U / U if useFine else 1.0
	var hips: Node3D = _joints.get("hips")
	if hips:
		hips.position.y = ((2.0 + 17.0) * sc) * U + float(p.get("bob", 0.0)) * sc * U
	var spine: Node3D = _joints.get("torso")
	if spine:
		spine.rotation_degrees = Vector3(float(p.get("spine", 0.0)), 0, 0)
	var head: Node3D = _joints.get("head")
	if head:
		head.rotation_degrees = Vector3(float(p.get("head", 0.0)), 0, 0)
	var tilt := float(p.get("tilt", 0.0))
	var hipA := float(p.get("hip", 0.0))
	var knee := float(p.get("knee", 0.0))
	var shA := float(p.get("sh", 0.0))
	var elA := float(p.get("el", 0.0))
	for side in [-1, 1]:
		var hipj: Node3D = _joints.get("hip_%d" % side)
		if hipj:
			hipj.rotation_degrees = Vector3(-hipA * float(side), 0, 0)
		var kn: Node3D = _joints.get("knee_%d" % side)
		if kn:
			kn.rotation_degrees = Vector3(max(0.0, knee * float(side)), 0, 0)
		var sh: Node3D = _joints.get("shoulder_%d" % side)
		if sh:
			sh.rotation_degrees = Vector3(-shA * float(side) - tilt, 0, float(side) * 3.0)
		var el: Node3D = _joints.get("elbow_%d" % side)
		if el:
			el.rotation_degrees = Vector3(elA, 0, 0)
	# 武器额外摆动（右手臂：肩 + 前臂 + 武器角）
	var wpn = p.get("wpn", null)
	if wpn != null:
		var hand: Node3D = _joints.get("elbow_1")
		if hand:
			hand.rotation_degrees = Vector3(-shA * -1.0 - tilt + float(wpn) * 57.3, 0, 0)

func _wait_frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame
