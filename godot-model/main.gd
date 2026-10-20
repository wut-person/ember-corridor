extends Node2D
## ============================================================
## 余烬回廊 · 2D 矢量骨骼角色（Godot 4）
## 全部几何由 GDScript 程序化生成：Polygon2D 分层 + Skeleton2D 骨骼绑定，
## 动作由代码插值驱动（待机 / 奔跑 / 跳跃 / 三段连招 / 受击 / 下蹲）。
## 坐标系：建模空间以「脚底中心」为原点，向上为负（-Y），1 单位 = 1 像素，
##        角色总高约 62 单位（含发髻），与 2D 游戏的像素小人同一比例尺。
## ============================================================

const S := 5.9                      ## 建模空间 → 屏幕像素的缩放（62 单位 × 5.6 ≈ 347 px 高）
const CENTER_X := 1010.0            ## 角色所在的屏幕 x（画面右侧，左侧留给信息面板）
const GROUND_Y := 812.0             ## 地面在屏幕上的 y 坐标
const SHOT_DIR := "D:/new games/godot-model/shots"

# ---------------------------------------------------------------
# 外观数据（对应游戏 js/data/clothing.js 的 G.LOOKS 前两套）
# ---------------------------------------------------------------
static func look_swordswoman() -> Dictionary:
	return {
		"id": "lk_a", "name": "余烬剑姬", "title": "初火 · 剑姬", "build": "slim",
		"desc": "棕发齐肩的轻装女剑士：铁灰胸甲、斜跨皮带、金扣腰带、腰间短剑、深棕短披风。",
		"skin": "#f9b58c", "hair": "#52250f", "eye": "#ffd9c4",
		"hair_style": "bob",
		"chest": "#555d6a", "chest_dark": "#3f4652", "under": "#7d8794",
		"strap": "#8a5a2c", "belt": "#6b4a2c", "buckle": "#f6c667",
		"bottom": "#3a4152", "legplate": "#46536a", "boots": "#2f3542", "boots_trim": "#4a5464",
		"bracer": "#5c6675", "skin_shadow": "#d99572",
		"cape": "#6d4526", "cape_dark": "#54341c",
		"beard": false, "hip_weapon": true, "back_bow": false,
	}

static func look_ranger() -> Dictionary:
	return {
		"id": "lk_b", "name": "铁壁游侠", "title": "铁壁 · 游侠", "build": "broad",
		"desc": "发髻络腮胡的重装男游侠：宽兜帽斗篷包肩、铁灰胸甲双皮带、深蓝裤棕靴，背负长弓。",
		"skin": "#f1a778", "hair": "#38241a", "eye": "#ffe0bd",
		"hair_style": "bun",
		"chest": "#3b414d", "chest_dark": "#2c313b", "under": "#5a6472",
		"strap": "#5a311b", "belt": "#4f3520", "buckle": "#c9a24a",
		"bottom": "#28323b", "legplate": "#3a4550", "boots": "#4a3220", "boots_trim": "#6b4a2c",
		"bracer": "#6b4a2c", "skin_shadow": "#cf8a5e",
		"cape": "#6b3a1e", "cape_dark": "#4f2a13",
		"beard": true, "hip_weapon": false, "back_bow": true,
	}

# ---------------------------------------------------------------
# 几何数据：每个部件 = 建模空间顶点 + 所属骨骼
# ---------------------------------------------------------------
static func build_parts(L: Dictionary) -> Array:
	var broad: bool = L.build == "broad"
	var w: float = 7.6 if broad else 6.6            ## 肩半宽
	var uw: float = 5.6 if broad else 4.6           ## 腰半宽
	var lw: float = 2.6 if broad else 2.3           ## 腿半宽
	var parts: Array = []

	# ================= 头（y -66 ~ -54，高 12）=================
	parts.append({"n": "head", "b": "head", "c": L.skin, "v": [
		Vector2(-3.168, -55.68), Vector2(3.168, -55.68), Vector2(3.456, -60), Vector2(3.312, -62.88),
		Vector2(2.016, -64.32), Vector2(-2.016, -64.32), Vector2(-3.312, -62.88), Vector2(-3.456, -60)]})
	parts.append({"n": "jaw", "b": "head", "c": L.skin_shadow, "v": [
		Vector2(-3.024, -56.832), Vector2(3.024, -56.832), Vector2(3.024, -55.68), Vector2(-3.024, -55.68)]})
	parts.append({"n": "eye_l", "b": "head", "c": "#120e0c", "v": [
		Vector2(-2.304, -61.44), Vector2(-0.936, -61.44), Vector2(-0.936, -60), Vector2(-2.304, -60)]})
	parts.append({"n": "eye_r", "b": "head", "c": "#120e0c", "v": [
		Vector2(0.936, -61.44), Vector2(2.304, -61.44), Vector2(2.304, -60), Vector2(0.936, -60)]})
	parts.append({"n": "glint_l", "b": "head", "c": L.eye, "v": [
		Vector2(-2.232, -61.368), Vector2(-1.44, -61.368), Vector2(-1.44, -60.576), Vector2(-2.232, -60.576)]})
	parts.append({"n": "glint_r", "b": "head", "c": L.eye, "v": [
		Vector2(1.008, -61.368), Vector2(1.8, -61.368), Vector2(1.8, -60.576), Vector2(1.008, -60.576)]})
	parts.append({"n": "brow_l", "b": "head", "c": L.hair, "v": [
		Vector2(-2.376, -62.376), Vector2(-0.792, -62.016), Vector2(-0.792, -61.512), Vector2(-2.376, -61.872)]})
	parts.append({"n": "brow_r", "b": "head", "c": L.hair, "v": [
		Vector2(0.792, -62.016), Vector2(2.376, -62.376), Vector2(2.376, -61.872), Vector2(0.792, -61.512)]})
	parts.append({"n": "nose", "b": "head", "c": L.skin_shadow, "v": [
		Vector2(-0.36, -59.712), Vector2(0.72, -59.784), Vector2(0.792, -58.56), Vector2(-0.288, -58.416)]})
	parts.append({"n": "mouth", "b": "head", "c": "#b8593f", "v": [
		Vector2(-0.792, -57.696), Vector2(0.792, -57.696), Vector2(0.792, -57.192), Vector2(-0.792, -57.192)]})

	if L.hair_style == "bob":
		parts.append({"n": "hair_top", "b": "head", "c": L.hair, "v": [
			Vector2(-4.032, -65.76), Vector2(4.032, -65.76), Vector2(4.032, -61.44), Vector2(3.744, -55.392),
			Vector2(2.304, -55.104), Vector2(2.016, -58.848), Vector2(-1.584, -59.28), Vector2(-3.456, -57.12),
			Vector2(-3.744, -55.392), Vector2(-4.032, -61.44)]})
		parts.append({"n": "hair_bang", "b": "head", "c": "#2f1408", "v": [
			Vector2(-3.744, -64.752), Vector2(2.592, -65.184), Vector2(-0.648, -61.872), Vector2(-3.744, -62.304)]})
		parts.append({"n": "hair_side", "b": "head", "c": "#3f1c0b", "v": [
			Vector2(3.312, -61.872), Vector2(4.032, -61.44), Vector2(3.744, -55.392), Vector2(3.024, -55.248)]})
	else:
		parts.append({"n": "hair_cap", "b": "head", "c": L.hair, "v": [
			Vector2(-4.032, -65.472), Vector2(4.032, -65.472), Vector2(3.6, -61.44), Vector2(3.384, -58.56),
			Vector2(-3.384, -58.56), Vector2(-3.6, -61.44)]})
		parts.append({"n": "bun_stem", "b": "head", "c": L.hair, "v": [
			Vector2(-1.584, -67.2), Vector2(1.584, -67.2), Vector2(1.296, -65.184), Vector2(-1.296, -65.184)]})
		parts.append({"n": "bun_top", "b": "head", "c": L.hair, "v": [
			Vector2(-2.592, -69.216), Vector2(2.592, -69.216), Vector2(2.16, -66.912), Vector2(-2.16, -66.912)]})
		parts.append({"n": "sideburn_l", "b": "head", "c": L.hair, "v": [
			Vector2(-3.456, -60), Vector2(-2.448, -60), Vector2(-2.448, -55.968), Vector2(-3.456, -56.256)]})
		parts.append({"n": "sideburn_r", "b": "head", "c": L.hair, "v": [
			Vector2(2.448, -60), Vector2(3.456, -60), Vector2(3.456, -56.256), Vector2(2.448, -55.968)]})

	if L.beard:
		var bd := "#2f1d12"
		parts.append({"n": "beard", "b": "head", "c": bd, "v": [
			Vector2(-2.736, -60), Vector2(2.736, -60), Vector2(3.024, -57.552), Vector2(1.224, -54.816),
			Vector2(-1.224, -54.816), Vector2(-3.024, -57.552)]})
		parts.append({"n": "mustache", "b": "head", "c": bd, "v": [
			Vector2(-2.448, -59.28), Vector2(2.448, -59.28), Vector2(2.16, -58.56), Vector2(-2.16, -58.56)]})

	# ================= 躯干（y -65 ~ -42）=================
	parts.append({"n": "torso", "b": "torso", "c": L.chest, "v": [
		Vector2(-w, -63.6), Vector2(w, -63.6), Vector2(w - 1.4, -54.96), Vector2(-w + 1.4, -54.96)]})
	parts.append({"n": "torso_low", "b": "torso", "c": L.chest, "v": [
		Vector2(-w + 1.4, -54.96), Vector2(w - 1.4, -54.96), Vector2(uw, -43), Vector2(-uw, -43)]})
	parts.append({"n": "chest_light", "b": "torso", "c": "#8b95a3", "v": [
		Vector2(-w + 1.0, -62.88), Vector2(w - 1.6, -62.88), Vector2(w - 2.6, -55.392), Vector2(-w + 2.4, -55.392)]})
	parts.append({"n": "collar", "b": "torso", "c": L.chest_dark, "v": [
		Vector2(-2.16, -64.032), Vector2(2.16, -64.032), Vector2(1.368, -61.584), Vector2(-1.368, -61.584)]})
	parts.append({"n": "waist_cloth", "b": "torso", "c": L.under, "v": [
		Vector2(-uw, -44.6), Vector2(uw, -44.6), Vector2(uw - 0.6, -42), Vector2(-uw + 0.6, -42)]})
	parts.append({"n": "strap_a", "b": "torso", "c": L.strap, "v": [
		Vector2(-w - 0.4, -62.16), Vector2(w + 0.4, -61.584), Vector2(w + 0.4, -60.576), Vector2(-w - 0.4, -61.152)]})
	parts.append({"n": "strap_b", "b": "torso", "c": L.strap, "v": [
		Vector2(-w + 0.6, -54.528), Vector2(w - 0.6, -55.248), Vector2(w - 0.6, -54.24), Vector2(-w + 0.6, -51)]})
	parts.append({"n": "strap_c", "b": "torso", "c": L.strap, "v": [
		Vector2(-w + 1.6, -63.168), Vector2(-w + 3.8, -63.024), Vector2(w - 3.2, -54.24), Vector2(w - 5.4, -54.384)]})
	parts.append({"n": "strap_d", "b": "torso", "c": L.strap, "v": [
		Vector2(w - 3.8, -63.024), Vector2(w - 1.6, -63.168), Vector2(-w + 5.4, -54.384), Vector2(-w + 3.2, -54.24)]})

	# ================= 腰 / 髋（y -43 ~ -32）=================
	parts.append({"n": "hips", "b": "hips", "c": L.bottom, "v": [
		Vector2(-uw - 0.6, -43), Vector2(uw + 0.6, -43), Vector2(uw + 0.2, -35),
		Vector2(uw - 0.2, -32), Vector2(-uw + 0.2, -32), Vector2(-uw - 0.2, -35)]})
	parts.append({"n": "belt", "b": "hips", "c": L.belt, "v": [
		Vector2(-uw - 0.8, -42), Vector2(uw + 0.8, -42), Vector2(uw + 0.6, -38.8), Vector2(-uw - 0.6, -38.8)]})
	parts.append({"n": "buckle", "b": "hips", "c": L.buckle, "v": [
		Vector2(-2.1, -41.8), Vector2(2.1, -41.8), Vector2(1.7, -39), Vector2(-1.7, -39)]})
	parts.append({"n": "buckle_hi", "b": "hips", "c": "#fff2c8", "v": [
		Vector2(-0.8, -41.3), Vector2(0.6, -41.3), Vector2(0.5, -40), Vector2(-0.7, -40)]})

	# ================= 披风 / 斗篷 =================
	if broad:
		parts.append({"n": "cloak_collar", "b": "torso", "c": L.cape, "v": [
			Vector2(-6.48, -66.48), Vector2(6.48, -66.48), Vector2(5.76, -62.88), Vector2(-5.76, -62.88)]})
		parts.append({"n": "cloak_flap_l", "b": "torso", "c": L.cape_dark, "v": [
			Vector2(-6.336, -64.608), Vector2(-4.752, -64.896), Vector2(-6.2, -44), Vector2(-8.2, -43)]})
		parts.append({"n": "cloak_flap_r", "b": "torso", "c": L.cape_dark, "v": [
			Vector2(4.752, -64.896), Vector2(6.336, -64.608), Vector2(8.2, -43), Vector2(6.2, -44)]})
		parts.append({"n": "cloak_hem", "b": "hips", "c": L.cape, "v": [
			Vector2(-9.2, -43), Vector2(9.2, -43), Vector2(7.8, -33), Vector2(2.8, -31),
			Vector2(-2, -34), Vector2(-7, -32)]})
	else:
		parts.append({"n": "cape_collar", "b": "torso", "c": L.cape, "v": [
			Vector2(-6.192, -64.752), Vector2(6.192, -64.752), Vector2(5.472, -61.44), Vector2(-5.472, -61.44)]})
		parts.append({"n": "cape_clasp", "b": "torso", "c": L.buckle, "v": [
			Vector2(-1.296, -64.176), Vector2(1.296, -64.176), Vector2(1.008, -62.304), Vector2(-1.008, -62.304)]})
		parts.append({"n": "cape_hem", "b": "hips", "c": L.cape, "v": [
			Vector2(-9, -31), Vector2(6.4, -30.6), Vector2(5.2, -21), Vector2(-3.8, -22.2),
			Vector2(-8.6, -20)]})

	# ================= 手臂（肩 -64 → 手 -38）=================
	parts.append({"n": "pauldron_b", "b": "arm_b", "c": L.chest_dark, "v": [
		Vector2(-2.736, -65.472), Vector2(2.736, -65.472), Vector2(2.448, -61.44), Vector2(-2.448, -61.44)]})
	parts.append({"n": "arm_b", "b": "arm_b", "c": L.bracer, "v": [
		Vector2(-1.512, -62.16), Vector2(1.512, -62.16), Vector2(2.1, -50), Vector2(-2.1, -50)]})
	parts.append({"n": "bracer_b", "b": "arm_b", "c": "#8d97a5", "v": [
		Vector2(-2.2, -50.2), Vector2(2.2, -50.2), Vector2(2.1, -44.6), Vector2(-2.1, -44.6)]})
	parts.append({"n": "hand_b", "b": "arm_b", "c": L.skin, "v": [
		Vector2(-2.1, -44.8), Vector2(2.1, -44.8), Vector2(1.9, -40.6), Vector2(-1.9, -40.6)]})

	parts.append({"n": "pauldron_f", "b": "arm_f", "c": L.chest_dark, "v": [
		Vector2(-2.88, -65.76), Vector2(2.736, -65.76), Vector2(2.448, -61.728), Vector2(-2.592, -61.728)]})
	parts.append({"n": "arm_f", "b": "arm_f", "c": L.bracer, "v": [
		Vector2(-1.584, -62.448), Vector2(1.584, -62.448), Vector2(2.2, -49.6), Vector2(-2.2, -49.6)]})
	parts.append({"n": "bracer_f", "b": "arm_f", "c": "#8d97a5", "v": [
		Vector2(-2.3, -49.8), Vector2(2.3, -49.8), Vector2(2.2, -44), Vector2(-2.2, -44)]})
	parts.append({"n": "hand_f", "b": "arm_f", "c": L.skin, "v": [
		Vector2(-2.3, -44.2), Vector2(2.3, -44.2), Vector2(2, -39.8), Vector2(-2, -39.8)]})

	# ================= 腿（y -32 ~ 0）=================
	for side in ["leg_b", "leg_f"]:
		var dark: bool = side == "leg_b"
		var leg_col: String = L.bottom if not dark else shade(L.bottom, -0.06)
		var shoe: String = L.boots if not dark else shade(L.boots, -0.05)
		parts.append({"n": side + "_thigh", "b": side, "c": leg_col, "v": [
			Vector2(-lw, -32.4), Vector2(lw, -32.4), Vector2(lw - 0.2, -18), Vector2(-lw + 0.2, -18)]})
		parts.append({"n": side + "_shin", "b": side + "_shin", "c": shade(leg_col, -0.05), "v": [
			Vector2(-lw + 0.2, -18), Vector2(lw - 0.2, -18), Vector2(lw - 0.3, -9), Vector2(-lw + 0.3, -9)]})
		parts.append({"n": side + "_boot", "b": side + "_shin", "c": shoe, "v": [
			Vector2(-lw - 0.4, -11), Vector2(lw + 0.4, -11), Vector2(lw + 1.0, -1.2), Vector2(-lw - 1.0, -1.2)]})
		parts.append({"n": side + "_sole", "b": side + "_shin", "c": "#171b24", "v": [
			Vector2(-lw - 1.0, -1.2), Vector2(lw + 1.0, -1.2), Vector2(lw + 1.0, 0), Vector2(-lw - 1.0, 0)]})
		parts.append({"n": side + "_trim", "b": side + "_shin", "c": L.boots_trim, "v": [
			Vector2(-lw - 0.3, -13), Vector2(lw + 0.3, -13), Vector2(lw + 0.4, -11), Vector2(-lw - 0.4, -11)]})
		parts.append({"n": side + "_plate", "b": side, "c": L.legplate, "v": [
			Vector2(-lw - 0.5, -27), Vector2(lw + 0.5, -27), Vector2(lw + 0.2, -20.6), Vector2(-lw - 0.2, -20.6)]})

	return parts

## 颜色明暗调整（与游戏 shade() 同算法）
static func shade(hex: String, amt: float) -> String:
	var col := Color(hex)
	col.r = clampf(col.r + amt, 0.0, 1.0)
	col.g = clampf(col.g + amt, 0.0, 1.0)
	col.b = clampf(col.b + amt, 0.0, 1.0)
	return "#" + col.to_html(false)

# ---------------------------------------------------------------
# 骨骼定义（建模空间坐标）
# ---------------------------------------------------------------
static func bone_defs() -> Array:
	return [
		{"n": "hips", "p": "", "x": 0.0, "y": -32.0},
		{"n": "torso", "p": "hips", "x": 0.0, "y": -65.0},
		{"n": "arm_b", "p": "torso", "x": -6.8, "y": -65.0},
		{"n": "arm_f", "p": "torso", "x": 6.8, "y": -65.0},
		{"n": "head", "p": "torso", "x": 0.0, "y": -64.3},
		{"n": "leg_b", "p": "hips", "x": -2.6, "y": -32.4},
		{"n": "leg_f", "p": "hips", "x": 2.6, "y": -32.4},
		{"n": "leg_b_shin", "p": "leg_b", "x": 0.0, "y": -14.0},
		{"n": "leg_f_shin", "p": "leg_f", "x": 0.0, "y": -14.0},
	]

static func bone_y(n: String) -> float:
	for d in bone_defs():
		if d.n == n:
			return d.y
	return 0.0

# ===============================================================
# 运行时
# ===============================================================
var root_scale: Node2D
var skeleton: Skeleton2D
var bones: Dictionary = {}
var meshes: Dictionary = {}
var look: Dictionary = {}
var look_index := 0
var anim_name := "idle"
var anim_time := 0.0
var anim_speed := 1.0
var ui_root: CanvasLayer
var info_label: Label
var name_label: Label
var anim_label_node: Label
var desc_label: Label
var shot_mode := false
var dragging := false
var weapon_nodes: Array = []
var weapon_rot := 30.0        ## 剑身相对手部的角度（-90 = 水平前指）

func _ready() -> void:
	shot_mode = OS.get_cmdline_user_args().has("--shots")
	_build_stage()
	ui_root = CanvasLayer.new()
	add_child(ui_root)
	_build_ui()
	_rebuild(look_swordswoman())
	if shot_mode:
		_run_shots()

# ---------------------------------------------------------------
# 场景
# ---------------------------------------------------------------
func _build_stage() -> void:
	var bg := ColorRect.new()
	bg.color = Color("#39404d")
	bg.size = Vector2(1920, 1080)
	bg.z_index = -100
	add_child(bg)

	var glow := Polygon2D.new()
	glow.polygon = PackedVector2Array([
		Vector2(CENTER_X - 760, 0), Vector2(CENTER_X + 760, 0),
		Vector2(CENTER_X + 470, GROUND_Y + 40), Vector2(CENTER_X - 470, GROUND_Y + 40)])
	glow.color = Color(0.30, 0.34, 0.42, 0.75)
	glow.z_index = -90
	add_child(glow)

	var floor_poly := Polygon2D.new()
	floor_poly.polygon = PackedVector2Array([
		Vector2(0, GROUND_Y), Vector2(1920, GROUND_Y),
		Vector2(1920, GROUND_Y + 260), Vector2(0, GROUND_Y + 260)])
	floor_poly.color = Color("#4a5262")
	floor_poly.z_index = -80
	add_child(floor_poly)

	var line := Line2D.new()
	line.points = PackedVector2Array([Vector2(0, GROUND_Y), Vector2(1920, GROUND_Y)])
	line.width = 2.0
	line.default_color = Color(0.72, 0.78, 0.88, 0.9)
	line.z_index = -70
	add_child(line)

	var sh := Polygon2D.new()
	var pts := PackedVector2Array()
	for i in range(24):
		var a := TAU * float(i) / 24.0
		pts.append(Vector2(cos(a) * 118.0, sin(a) * 26.0))
	sh.polygon = pts
	sh.color = Color(0, 0, 0, 0.30)
	sh.position = Vector2(CENTER_X, GROUND_Y + 6)
	sh.z_index = -60
	add_child(sh)

	var title := Label.new()
	title.text = "余烬回廊 · 角色 2D 矢量建模（Godot 4）"
	title.position = Vector2(52, 36)
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color("#e9eef7"))
	add_child(title)

	var hint := Label.new()
	hint.text = "鼠标拖拽 / ← → 旋转　·　1 / 2 切换外观　·　空格或 Q W E R T Y U I 切换动作"
	hint.position = Vector2(54, 76)
	hint.add_theme_font_size_override("font_size", 16)
	hint.add_theme_color_override("font_color", Color("#8b97a8"))
	add_child(hint)

# ---------------------------------------------------------------
# 组装角色
# ---------------------------------------------------------------
func _rebuild(L: Dictionary) -> void:
	look = L
	if root_scale:
		root_scale.queue_free()
	root_scale = Node2D.new()
	root_scale.name = "CharacterRoot"
	root_scale.scale = Vector2(S, S)
	root_scale.position = Vector2(CENTER_X, GROUND_Y)
	add_child(root_scale)

	skeleton = Skeleton2D.new()
	skeleton.name = "Skeleton2D"
	root_scale.add_child(skeleton)
	bones.clear()
	meshes.clear()

	# 第一步：算出每根骨骼在「建模空间」的绝对位置（逐级累加父骨骼的 x 与 y）
	var world := {}
	for d in bone_defs():
		var px: float = d.x
		var py: float = d.y
		if d.p != "":
			var pw: Array = world[d.p]
			px += float(pw[0])
			py += float(pw[1])
		world[d.n] = [px, py]

	# 第二步：建骨骼树，局部位置 = 自身绝对位置 - 父骨骼绝对位置（x、y 都要算）
	for d in bone_defs():
		var b := Bone2D.new()
		b.name = d.n
		var pw2: Array = world[d.p] if d.p != "" else [0.0, 0.0]
		var me: Array = world[d.n]
		b.position = Vector2(float(me[0]) - float(pw2[0]), float(me[1]) - float(pw2[1]))
		b.rotation = 0.0
		if d.p == "":
			skeleton.add_child(b)
		else:
			bones[d.p].add_child(b)
		bones[d.n] = b

	# 第三步：记录骨骼静置变换（rest），否则挂在骨骼上的 Polygon2D 会整体错位
	for d in bone_defs():
		var bone_ref: Bone2D = bones[d.n]
		bone_ref.rest = bone_ref.transform

	# 第四步：把部件顶点换算成「相对所属骨骼绝对位置」的局部坐标
	for p in build_parts(L):
		var poly := Polygon2D.new()
		poly.name = p.n
		poly.color = Color(p.c)
		poly.antialiased = true
		var bone: Bone2D = bones[p.b]
		var bw: Array = world[p.b]
		var pts := PackedVector2Array()
		for v in p.v:
			pts.append(Vector2(v.x - float(bw[0]), v.y - float(bw[1])))
		poly.polygon = pts
		bone.add_child(poly)
		meshes[p.n] = poly

	_add_weapon(L)

	# 截图模式下把整个角色（含头顶与脚下）放进画面
	if shot_mode and root_scale:
		root_scale.scale = Vector2(5.9, 5.9)
		root_scale.position = Vector2(1010, 792)

## 手持长剑 + 腰间短剑 + 背负长弓
func _add_weapon(L: Dictionary) -> void:
	var hand: Bone2D = bones["arm_f"]
	var hx := 0.0
	var hy := -42.0

	var grip := Polygon2D.new()
	grip.name = "blade_grip"
	grip.color = Color("#43301c")
	grip.antialiased = true
	grip.polygon = PackedVector2Array([
		Vector2(hx - 1.0, hy - 6.0), Vector2(hx + 1.0, hy - 6.0),
		Vector2(hx + 1.0, hy + 0.4), Vector2(hx - 1.0, hy + 0.4)])
	hand.add_child(grip)
	weapon_nodes = [grip]

	var guard := Polygon2D.new()
	guard.name = "blade_guard"
	guard.color = Color("#f6c667")
	guard.antialiased = true
	guard.polygon = PackedVector2Array([
		Vector2(hx - 2.6, hy + 0.4), Vector2(hx + 2.6, hy + 0.4),
		Vector2(hx + 2.6, hy + 2.0), Vector2(hx - 2.6, hy + 2.0)])
	hand.add_child(guard)
	weapon_nodes.append(guard)

	var blade := Polygon2D.new()
	blade.name = "blade"
	blade.color = Color("#dfe8f5")
	blade.antialiased = true
	blade.polygon = PackedVector2Array([
		Vector2(hx - 0.8, hy + 2.0), Vector2(hx + 0.8, hy + 2.0),
		Vector2(hx + 0.8, hy + 24.0), Vector2(hx + 0.4, hy + 27.0),
		Vector2(hx - 0.4, hy + 27.0), Vector2(hx - 0.8, hy + 24.0)])
	hand.add_child(blade)
	weapon_nodes.append(blade)

	var edge := Polygon2D.new()
	edge.name = "blade_hi"
	edge.color = Color(1, 1, 1, 0.7)
	edge.antialiased = true
	edge.polygon = PackedVector2Array([
		Vector2(hx - 0.7, hy + 3.0), Vector2(hx - 0.3, hy + 3.0),
		Vector2(hx - 0.3, hy + 24.5), Vector2(hx - 0.6, hy + 26.0)])
	hand.add_child(edge)
	weapon_nodes.append(edge)

	if L.hip_weapon:
		var hip: Bone2D = bones["hips"]
		var hs := Polygon2D.new()
		hs.name = "hip_sword"
		hs.color = Color("#c9d3e0")
		hs.antialiased = true
		hs.polygon = PackedVector2Array([
			Vector2(-5.4, -33.6), Vector2(-3.4, -33.2), Vector2(-3.0, -20.0), Vector2(-5.2, -20.4)])
		hip.add_child(hs)
		var hg := Polygon2D.new()
		hg.name = "hip_guard"
		hg.color = Color("#f6c667")
		hg.antialiased = true
		hg.polygon = PackedVector2Array([
			Vector2(-7.0, -35.6), Vector2(-2.4, -35.0), Vector2(-2.6, -33.4), Vector2(-6.8, -34.0)])
		hip.add_child(hg)

	if L.back_bow:
		var torso: Bone2D = bones["torso"]
		var bow := Line2D.new()
		bow.name = "back_bow"
		var pts := PackedVector2Array()
		for i in range(13):
			var bt: float = float(i) / 12.0
			var rel_y: float = lerpf(5.0, -13.0, bt)      ## 相对 torso 骨骼的 y
			var bend: float = sin(bt * PI) * -4.4
			pts.append(Vector2(-6.6 + bend, rel_y))
		bow.points = pts
		bow.width = 1.6
		bow.default_color = Color("#6b4526")
		bow.antialiased = true
		torso.add_child(bow)

		var strn := Line2D.new()
		strn.name = "bow_string"
		strn.points = PackedVector2Array([Vector2(-6.6, 5.0), Vector2(-6.6, -13.0)])
		strn.width = 0.8
		strn.default_color = Color(0.9, 0.93, 0.97, 0.6)
		strn.antialiased = true
		torso.add_child(strn)

# ---------------------------------------------------------------
# 动作驱动
# ---------------------------------------------------------------
func anim_list() -> Array:
	return ["idle", "run", "jump", "combo1", "combo2", "combo3", "hurt", "crouch"]

func anim_label(n: String) -> String:
	match n:
		"idle": return "待机"
		"run": return "奔跑"
		"jump": return "跳跃"
		"combo1": return "连招①平斩"
		"combo2": return "连招②上挑"
		"combo3": return "连招③下劈"
		"hurt": return "受击"
		"crouch": return "下蹲"
	return n

func _process(delta: float) -> void:
	anim_time += delta * anim_speed
	_drive_bones(anim_time)
	_apply_weapon_rot()
	_update_ui()

func _ease(t: float, dur: float) -> float:
	var x := fposmod(t, dur) / dur
	return (-cos(x * PI) + 1.0) * 0.5

## 设置骨骼旋转（注意：不能叫 _set，会与 Object._set 内建方法签名冲突）
func _rot(n: String, rot_deg: float) -> void:
	if bones.has(n):
		bones[n].rotation_degrees = rot_deg

func _drive_bones(t: float) -> void:
	var hips: Bone2D = bones["hips"]
	match anim_name:
		"idle":
			var sway: float = sin(t * 1.6) * 0.8
			hips.position = Vector2(0, -32.0 + sin(t * 1.6) * 0.35)
			hips.rotation_degrees = sway * 0.25
			_rot("torso", -sway * 1.4)
			_rot("head", sway * 0.9 - 1.0)
			_rot("arm_f", 58.0 + sin(t * 1.6 + 0.4) * 2.0)
			weapon_rot = 30.0
			_rot("arm_b", 6.0 - sin(t * 1.6) * 2.0)
			_rot("leg_f", 0.0); _rot("leg_b", 0.0)
			_rot("leg_f_shin", 0.0); _rot("leg_b_shin", 0.0)
		"run":
			var p: float = t * 7.0
			var lift: float = absf(sin(p)) * 1.2
			hips.position = Vector2(0, -32.0 - lift)
			hips.rotation_degrees = sin(p) * 3.0
			_rot("torso", -7.0 - sin(p) * 2.0)
			_rot("head", 5.0)
			_rot("leg_f", sin(p) * 36.0)
			_rot("leg_b", sin(p + PI) * 36.0)
			_rot("leg_f_shin", -maxf(0.0, -sin(p)) * 50.0 - 4.0)
			_rot("leg_b_shin", -maxf(0.0, -sin(p + PI)) * 50.0 - 4.0)
			_rot("arm_f", 26.0 + sin(p + PI) * 30.0)
			weapon_rot = 15.0
			_rot("arm_b", -22.0 + sin(p) * 30.0)
		"jump":
			var up: float = sin(t * 3.4)
			hips.position = Vector2(0, -32.0 - absf(up) * 3.0)
			_rot("torso", -4.0)
			_rot("head", 2.0)
			_rot("leg_f", -22.0 + up * 6.0)
			_rot("leg_b", 14.0 - up * 6.0)
			_rot("leg_f_shin", -34.0)
			_rot("leg_b_shin", -50.0)
			_rot("arm_f", -34.0 + up * 6.0)
			weapon_rot = 5.0
			_rot("arm_b", 30.0 - up * 6.0)
		"combo1":
			var k := _ease(t, 0.42)
			hips.position = Vector2(0, -32.0)
			hips.rotation_degrees = -6.0 * k
			_rot("torso", 10.0 * k - 2.0)
			_rot("head", -6.0 * k)
			_rot("arm_f", lerpf(-58.0, 62.0, k))
			weapon_rot = 35.0
			_rot("arm_b", lerpf(20.0, -26.0, k))
			_rot("leg_f", 12.0 * k); _rot("leg_b", -10.0 * k)
		"combo2":
			var k2 := _ease(t, 0.46)
			hips.position = Vector2(0, -32.0 + 2.4 * (1.0 - k2))
			_rot("torso", lerpf(12.0, -14.0, k2))
			_rot("head", lerpf(8.0, -12.0, k2))
			_rot("arm_f", lerpf(78.0, -104.0, k2))
			weapon_rot = 40.0
			_rot("arm_b", lerpf(-16.0, 22.0, k2))
			_rot("leg_f", -8.0 * k2); _rot("leg_b", 14.0 * k2)
		"combo3":
			var k3 := _ease(t, 0.52)
			hips.position = Vector2(0, -32.0)
			hips.rotation_degrees = 8.0 * k3
			_rot("torso", lerpf(-20.0, 26.0, k3))
			_rot("head", lerpf(-10.0, 16.0, k3))
			_rot("arm_f", lerpf(-118.0, 74.0, k3))
			weapon_rot = 22.0
			_rot("arm_b", lerpf(26.0, -18.0, k3))
			_rot("leg_f", lerpf(-16.0, 20.0, k3))
			_rot("leg_b", lerpf(18.0, -14.0, k3))
			_rot("leg_f_shin", -12.0 * k3)
		"hurt":
			var k4 := _ease(t, 0.5)
			hips.position = Vector2(-2.6 * k4, -32.0)
			_rot("torso", -16.0 * k4)
			_rot("head", -14.0 * k4)
			_rot("arm_f", -18.0 * k4)
			weapon_rot = 5.0
			_rot("arm_b", 24.0 * k4)
			_rot("leg_f", -12.0 * k4); _rot("leg_b", 10.0 * k4)
		"crouch":
			hips.position = Vector2(0, -32.0 + 11.0)
			_rot("torso", -14.0)
			_rot("head", 8.0)
			_rot("leg_f", 26.0); _rot("leg_b", -18.0)
			_rot("leg_f_shin", -52.0); _rot("leg_b_shin", -44.0)
			_rot("arm_f", 18.0); _rot("arm_b", -12.0)
			weapon_rot = 28.0

## 武器角度：悬在手上，但单独旋转到自然握持方向
func _apply_weapon_rot() -> void:
	for n in weapon_nodes:
		if is_instance_valid(n):
			n.rotation_degrees = weapon_rot

func set_anim(n: String) -> void:
	anim_name = n
	anim_time = 0.0

# ---------------------------------------------------------------
# 输入
# ---------------------------------------------------------------
func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		dragging = event.pressed
	elif event is InputEventMouseMotion and dragging:
		_rotate_view(event.relative.x * 0.35)
	elif event is InputEventKey and event.pressed and not event.echo:
		_handle_key(event.keycode)

func _rotate_view(deg: float) -> void:
	if root_scale:
		root_scale.rotation_degrees += deg

func _handle_key(code: int) -> void:
	var list := anim_list()
	match code:
		KEY_LEFT: _rotate_view(-6.0)
		KEY_RIGHT: _rotate_view(6.0)
		KEY_1: _switch_look(0)
		KEY_2: _switch_look(1)
		KEY_SPACE: _cycle_anim()
		KEY_Q: set_anim(list[0])
		KEY_W: set_anim(list[1])
		KEY_E: set_anim(list[2])
		KEY_R: set_anim(list[3])
		KEY_T: set_anim(list[4])
		KEY_Y: set_anim(list[5])
		KEY_U: set_anim(list[6])
		KEY_I: set_anim(list[7])

func _cycle_anim() -> void:
	var list := anim_list()
	var i := list.find(anim_name)
	set_anim(list[(i + 1) % list.size()])

func _switch_look(i: int) -> void:
	look_index = i
	_rebuild(look_swordswoman() if i == 0 else look_ranger())
	anim_time = 0.0

# ---------------------------------------------------------------
# UI
# ---------------------------------------------------------------
func _build_ui() -> void:
	var panel := PanelContainer.new()
	panel.position = Vector2(52, 150)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.07, 0.11, 0.85)
	sb.border_color = Color(0.24, 0.28, 0.36, 0.9)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", sb)
	ui_root.add_child(panel)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	panel.add_child(vb)

	name_label = Label.new()
	name_label.add_theme_font_size_override("font_size", 26)
	name_label.add_theme_color_override("font_color", Color("#f6c667"))
	vb.add_child(name_label)

	anim_label_node = Label.new()
	anim_label_node.add_theme_font_size_override("font_size", 18)
	anim_label_node.add_theme_color_override("font_color", Color("#9eeaff"))
	vb.add_child(anim_label_node)

	desc_label = Label.new()
	desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc_label.custom_minimum_size = Vector2(520, 0)
	desc_label.add_theme_font_size_override("font_size", 15)
	desc_label.add_theme_color_override("font_color", Color("#c8d2e0"))
	vb.add_child(desc_label)

	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 6)
	hb.position = Vector2(52, 812)
	ui_root.add_child(hb)
	for a in anim_list():
		var b := Button.new()
		b.text = anim_label(a)
		b.add_theme_font_size_override("font_size", 15)
		b.pressed.connect(func(): set_anim(a))
		hb.add_child(b)

func _update_ui() -> void:
	if name_label:
		name_label.text = "%s　·　%s" % [look.get("name", ""), look.get("title", "")]
	if anim_label_node:
		var rot := root_scale.rotation_degrees if root_scale else 0.0
		anim_label_node.text = "动作：%s　·　朝向 %.0f°　·　部件 %d 个" % [anim_label(anim_name), rot, meshes.size()]
	if desc_label:
		desc_label.text = look.get("desc", "")

# ---------------------------------------------------------------
# 截图模式
# ---------------------------------------------------------------
func _run_shots() -> void:
	print("SHOTS_BEGIN")
	await _wait_frames(3)
	DirAccess.make_dir_recursive_absolute(SHOT_DIR)
	var plan := [
		{"look": 0, "anim": "idle", "rot": 0.0, "file": "01-swordswoman-idle"},
		{"look": 0, "anim": "run", "rot": 0.0, "file": "02-swordswoman-run"},
		{"look": 0, "anim": "combo1", "rot": 0.0, "file": "03-swordswoman-combo1"},
		{"look": 0, "anim": "combo3", "rot": 0.0, "file": "04-swordswoman-combo3"},
		{"look": 0, "anim": "idle", "rot": -28.0, "file": "05-swordswoman-turn"},
		{"look": 1, "anim": "idle", "rot": 0.0, "file": "06-ranger-idle"},
		{"look": 1, "anim": "run", "rot": 0.0, "file": "07-ranger-run"},
		{"look": 1, "anim": "combo2", "rot": 0.0, "file": "08-ranger-combo2"},
		{"look": 1, "anim": "crouch", "rot": 0.0, "file": "09-ranger-crouch"},
		{"look": 1, "anim": "idle", "rot": 24.0, "file": "10-ranger-turn"},
	]
	for item in plan:
		_switch_look(item.look)
		set_anim(item.anim)
		if root_scale:
			root_scale.rotation_degrees = item.rot
		anim_time = 0.22
		_drive_bones(anim_time)
		_apply_weapon_rot()
		await _wait_frames(2)
		var img: Image = get_viewport().get_texture().get_image()
		if img == null:
			print("SHOT_FAILED ", item.file)
			continue
		var path := "%s/%s.png" % [SHOT_DIR, item.file]
		var err := img.save_png(path)
		print("SHOT ", path, " err=", err, " size=", img.get_size())
	print("SHOTS_DONE total=", plan.size())
	get_tree().quit()

## 稳定等待若干帧（用 process_frame 计时，避免等待永不触发的信号）
func _wait_frames(n: int) -> void:
	for i in range(n):
		await get_tree().process_frame
