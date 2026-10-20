extends Node3D
## =========================================================
## 精细体素角色（对齐参考图：斜俯视 45° 精致像素 RPG 风格）
##   密度：1 单位 = 1/24 m，角色总高 100 单位
##   关节：hips / torso / head / shoulder / elbow / hip / knee
##   造型：男剑士 / 男游侠 / 男法师 / 男骑士 / 女剑士 / 女游侠 / 女法师 / 女骑士
## =========================================================

const DSL := preload("res://voxel_dsl.gd")

var joints := {}                # 关节名 → Node3D（供动画与挂载武器用）

# ---------- 配色（取自参考图） ----------
const C_SKIN      := Color("#f0a878")
const C_SKIN_D    := Color("#c07850")
const C_HAIR      := Color("#6b3a1e")   # 棕色头发
const C_HAIR_D    := Color("#4a2612")
const C_ARMOR     := Color("#3a3a4a")   # 深蓝灰甲
const C_ARMOR_L   := Color("#4e4e62")
const C_ARMOR_D   := Color("#26262f")
const C_SLEEVE    := Color("#2b2b38")   # 袖子：比胸甲更深，用来和亮钢肩甲拉开层次
const C_LEATHER   := Color("#6b4a2c")   # 棕色皮革
const C_LEATHER_D := Color("#4a3220")
const C_STEEL     := Color("#8d97a5")   # 钢
const C_STEEL_L   := Color("#b6c0cc")
const C_GOLD      := Color("#e8b93c")   # 金色扣具
const C_CLOTH     := Color("#2f3540")   # 深色布
const C_BOOT      := Color("#5a3a24")
const C_PURPLE    := Color("#7a4fd0")
const C_PURPLE_D  := Color("#3f2f66")

# 总高 100：脚底 0 → 头顶 100（参考图：大方块头 + 宽肩 + 短腿）
const LEG_TOP := 40.0        # 髋顶（腿再加长一点）
const TORSO_H := 26.0        # 躯干高（40 → 66）
const NECK_H  := 4.0
const HEAD_H  := 17.0        # 头高（70 → 87）约占身高 20%
const HEAD_W  := 17.0        # 头宽
const HEAD_D  := 16.0

func build(id: String, cfg_in: Dictionary) -> Node3D:
	# main.gd 的配置把配色放在 d 子字典里，这里合并成一层，方便后面统一 cfg.get()
	var cfg := {}
	for k in cfg_in.keys():
		cfg[k] = cfg_in[k]
	if cfg_in.has("d") and cfg_in["d"] is Dictionary:
		for k in cfg_in["d"].keys():
			cfg[k] = cfg_in["d"][k]

	var d := DSL.new()
	add_child(d)
	var root: Node3D = d.begin(id)
	d.at(root)

	var female: bool = cfg.get("female", false)
	var cls: String = cfg.get("cls", "blade")
	var skin: Color = cfg.get("skin", C_SKIN)
	var hair: Color = cfg.get("hair", C_HAIR)
	# 配色优先用配置里的 chest / chestLight，回退到默认
	var armor: Color = cfg.get("armor", cfg.get("chest", C_ARMOR))
	var armorL: Color = cfg.get("armorL", cfg.get("chestLight", C_ARMOR_L))
	var pants: Color = cfg.get("pants", C_CLOTH)
	var bootTone: Color = cfg.get("boots", C_BOOT)
	var beltTone: Color = cfg.get("belt", C_LEATHER)
	var buckleTone: Color = cfg.get("buckle", C_GOLD)
	var strapTone: Color = cfg.get("strap", cfg.get("bracer", C_LEATHER))
	var pauldronTone: Color = cfg.get("pauldronTone", C_STEEL)
	var sleeveTone: Color = cfg.get("sleeve", C_SLEEVE)

	var TW := 20.0 if female else 24.0          # 躯干宽（参考图很宽）
	var TD := 13.0 if female else 15.0          # 躯干厚
	var AW := 6.6 if female else 7.6            # 手臂粗
	var LW := 7.4 if female else 8.6            # 腿粗
	var hipX := (female and 6.0) or 7.2
	var robe: bool = cfg.get("robe", false)     # 法师长袍
	var skirt: bool = female                    # 女角色短裙
	var longBoots: bool = female                # 女角色大腿靴
	var midriff: bool = female                  # 女角色露腰


	# ================= 髋 =================
	var hips: Node3D = d.joint("hips", root, Vector3(0, LEG_TOP, 0))
	joints["hips"] = hips

	# ---- 腿（大腿 / 小腿 / 靴）----
	for side in [-1, 1]:
		d.mir(side < 0)
		var hip: Node3D = d.joint("hip_%d" % side, hips, Vector3(hipX, 0, 0))
		joints["hip_%d" % side] = hip
		d.at(hip)
		# 大腿：布裤 + 侧甲
		d.limb("thigh", Vector3(0, -7.0, 0), LW, 14.0, pants)
		d.plate("thigh_armor", Vector3(0, -8.0, LW * 0.5 - 1.0), Vector3(LW * 0.75, 6.5, 1.6),
			cfg.get("thighArmor", armor))
		var knee: Node3D = d.joint("knee_%d" % side, hip, Vector3(0, -14.0, 0))
		joints["knee_%d" % side] = knee
		d.at(knee)
		# 小腿 + 护膝
		d.limb("shin", Vector3(0, -7.0, 0), LW * 0.92, 14.0, pants)
		d.box("knee_pad", Vector3(0, -1.8, LW * 0.46), Vector3(LW * 0.7, 4.6, 1.8), cfg.get("kneeTone", C_STEEL), true)
		# 靴子：靴筒 + 靴口翻边 + 鞋面 + 鞋底
		if longBoots:
			# 大腿靴：从膝上一路包到脚踝，参考图女角色都是这种
			d.limb("thigh_boot", Vector3(0, -4.0, 0), LW + 1.2, 9.0, bootTone)
			d.plate("thigh_boot_plate", Vector3(0, -5.2, LW * 0.5 + 0.2), Vector3(LW * 0.72, 5.4, 1.6),
				cfg.get("thighArmor", armor))
		d.box("boot", Vector3(0, -18.6, 1.0), Vector3(LW + 1.4, 9.6, LW + 3.4), bootTone)
		d.box("boot_cuff", Vector3(0, -14.2, 0.6), Vector3(LW + 2.4, 2.8, LW + 2.6), beltTone)
		d.box("boot_cuff_hi", Vector3(0, -12.9, 0.6), Vector3(LW + 2.4, 1.0, LW + 2.6), beltTone.lightened(0.2))
		d.box("boot_toe", Vector3(0, -22.6, 3.2), Vector3(LW + 0.8, 3.6, 3.0), bootTone.darkened(0.12))
		d.box("sole", Vector3(0, -25.2, 1.4), Vector3(LW + 1.8, 1.4, LW + 4.2), beltTone.darkened(0.3))
		d.trim("boot_strap", Vector3(0, -16.8, 1.2), Vector3(LW + 2.6, 1.6, LW + 3.0), buckleTone.darkened(0.25))
		d.mir(false)

	# ================= 躯干 =================
	var torso: Node3D = d.joint("torso", hips, Vector3.ZERO)
	joints["torso"] = torso
	d.at(torso)

	# ---- 髋部 / 腰 ----
	d.plate("waist", Vector3(0, 3.0, 0), Vector3(TW - 1.5, 6.0, TD - 0.6), pants)
	# 腰带（棕色宽皮带 + 金扣 + 侧挂袋）
	d.box("belt", Vector3(0, 7.0, 0), Vector3(TW + 0.6, 4.4, TD + 0.9), beltTone)
	d.box("belt_hi", Vector3(0, 8.8, 0), Vector3(TW + 0.6, 1.2, TD + 0.9), beltTone.lightened(0.24))
	d.box("buckle", Vector3(0, 7.0, TD * 0.5 + 1.0), Vector3(5.0, 3.4, 1.6), buckleTone, true)
	d.trim("buckle_in", Vector3(0, 7.0, TD * 0.5 + 1.9), Vector3(2.2, 1.6, 0.8), buckleTone.darkened(0.3))
	d.box("pouch", Vector3(TW * 0.42, 4.2, TD * 0.4), Vector3(4.6, 5.0, 3.2), beltTone.darkened(0.22))
	d.trim("pouch_flap", Vector3(TW * 0.42, 6.2, TD * 0.4 + 0.4), Vector3(5.0, 1.4, 3.4), beltTone)
	d.trim("pouch_buckle", Vector3(TW * 0.42, 5.4, TD * 0.4 + 1.8), Vector3(2.0, 1.8, 0.8), buckleTone)

	# ---- 胸甲 / 上身 ----
	var ch := 15.0
	if female:
		# 女：束胸 + 露腰
		d.plate("corset", Vector3(0, 14.0, 0), Vector3(TW, 10.0, TD), armor)
		d.box("corset_top", Vector3(0, 19.4, 0), Vector3(TW + 0.8, 2.0, TD + 0.8), armorL)
		# V 形吊带
		d.rot_box("strap_vl", Vector3(-3.4, 20.0, TD * 0.5 + 0.4), Vector3(11.0, 2.4, 1.2), strapTone, Vector3(0, 0, 38))
		d.rot_box("strap_vr", Vector3(3.4, 20.0, TD * 0.5 + 0.4), Vector3(11.0, 2.4, 1.2), strapTone, Vector3(0, 0, -38))
		d.trim("clasp_mid", Vector3(0, 15.6, TD * 0.5 + 1.0), Vector3(2.6, 2.6, 1.2), buckleTone)
		d.trim("clasp_low", Vector3(0, 11.8, TD * 0.5 + 1.0), Vector3(2.6, 2.2, 1.2), buckleTone)
		# 露腰
		d.plate("midriff", Vector3(0, 7.6, 0), Vector3(TW - 2.4, 4.0, TD - 1.4), skin)
	else:
		# 男：整块深色胸甲 + 分层甲片
		d.plate("chest", Vector3(0, 15.5, 0), Vector3(TW, 17.0, TD), armor)
		# 胸甲横向分层（参考图有明显横向甲板）
		for i in 3:
			d.trim("chest_seam%d" % i, Vector3(0, 9.6 + i * 5.0, TD * 0.5 + 0.3),
				Vector3(TW - 1.6, 1.2, 0.8), armor.darkened(0.3))
		# 中央浅色胸片
		d.plate("chest_plate", Vector3(0, 17.0, TD * 0.5 + 0.5), Vector3(TW * 0.52, 10.0, 1.6), armorL)
		d.trim("chest_plate_hi", Vector3(0, 21.4, TD * 0.5 + 1.4), Vector3(TW * 0.46, 1.0, 0.7), armorL.lightened(0.2))
		# 交叉皮带（参考图最醒目的元素）
		d.rot_box("strap_a", Vector3(0, 19.0, TD * 0.5 + 1.2), Vector3(TW * 1.28, 3.0, 1.4), strapTone, Vector3(0, 0, 40))
		d.rot_box("strap_b", Vector3(0, 19.0, TD * 0.5 + 1.2), Vector3(TW * 1.28, 3.0, 1.4), strapTone, Vector3(0, 0, -40))
		d.trim("strap_hi", Vector3(0, 19.0, TD * 0.5 + 2.0), Vector3(TW * 1.1, 0.8, 0.6), strapTone.lightened(0.3))
		# 肩带扣
		d.trim("strap_clasp_l", Vector3(-5.4, 16.6, TD * 0.5 + 1.6), Vector3(2.2, 2.2, 1.0), buckleTone)
		d.trim("strap_clasp_r", Vector3(5.4, 16.6, TD * 0.5 + 1.6), Vector3(2.2, 2.2, 1.0), buckleTone)
		# 金色胸饰
		d.trim("chest_gem", Vector3(0, 22.6, TD * 0.5 + 1.2), Vector3(3.0, 2.4, 1.2), buckleTone)
		d.trim("chest_gem_c", Vector3(0, 22.6, TD * 0.5 + 1.9), Vector3(1.4, 1.2, 0.8), buckleTone.lightened(0.4))

	# ---- 肩甲（参考图：多层钢甲 + 高光边）----
	for side in [-1, 1]:
		d.mir(side < 0)
		var pw := 6.4 if not female else 5.4
		d.plate("pauldron", Vector3(TW * 0.5 + pw * 0.62, 24.8, 0), Vector3(pw, 6.0, TD + 2.2), pauldronTone, true)
		d.plate("pauldron2", Vector3(TW * 0.5 + pw * 0.70, 20.2, 0), Vector3(pw * 0.78, 4.0, TD + 1.4), pauldronTone.darkened(0.14), true)
		d.trim("pauldron_rim", Vector3(TW * 0.5 + pw * 0.62, 27.2, TD * 0.5 + 1.4),
			Vector3(pw * 0.86, 1.4, 1.0), pauldronTone.lightened(0.22))
		d.trim("pauldron_bolt", Vector3(TW * 0.5 + pw * 0.62, 24.8, TD * 0.5 + 2.0), Vector3(1.6, 1.6, 1.0), buckleTone)
		d.mir(false)

	# ---- 手臂（上臂 / 前臂 / 护腕 / 手）----
	for side in [-1, 1]:
		d.mir(side < 0)
		var sh: Node3D = d.joint("shoulder_%d" % side, torso, Vector3(TW * 0.5 + AW * 0.62, 23.4, 0))
		joints["shoulder_%d" % side] = sh
		d.at(sh)
		d.limb("upper", Vector3(0, -5.4, 0), AW, 11.0, sleeveTone)
		# 上臂绑带
		d.trim("upper_band", Vector3(0, -9.0, 0), Vector3(AW + 1.0, 1.8, AW + 1.0), beltTone)
		var el: Node3D = d.joint("elbow_%d" % side, sh, Vector3(0, -11.0, 0))
		joints["elbow_%d" % side] = el
		d.at(el)
		d.limb("fore", Vector3(0, -4.6, 0), AW * 0.94, 9.4, skin)
		# 护腕（棕色皮革 + 金铆钉）
		d.box("bracer", Vector3(0, -4.6, 0), Vector3(AW + 1.4, 7.0, AW + 1.4), cfg.get("bracer", C_LEATHER))
		d.box("bracer_hi", Vector3(0, -1.4, 0), Vector3(AW + 1.6, 1.2, AW + 1.6), cfg.get("bracer", C_LEATHER).lightened(0.26))
		d.trim("bracer_bolt", Vector3(AW * 0.6, -4.6, AW * 0.5), Vector3(1.4, 2.4, 1.0), buckleTone)
		d.trim("bracer_strap", Vector3(0, -6.8, 0), Vector3(AW + 1.6, 1.0, AW + 1.6), cfg.get("bracer", C_LEATHER).darkened(0.3))
		# 手
		d.box("hand", Vector3(0, -10.6, 0.4), Vector3(AW * 0.92, 4.2, AW * 0.8), skin)
		d.mir(false)

	# ---- 脖子 + 头 ----
	var neck: Node3D = d.joint("neck", torso, Vector3(0, TORSO_H, 0))
	joints["neck"] = neck
	d.at(neck)
	d.box("neck", Vector3(0, 1.6, 0), Vector3(6.4, 3.4, 6.4), skin.darkened(0.12))
	# 法师高领 / 骑士颈护会在头部构件里补
	var head: Node3D = d.joint("head", neck, Vector3(0, NECK_H, 0))
	joints["head"] = head
	d.at(head)
	_build_head(d, cfg, head, skin, hair, female, cls)

	# ---- 手持物 ----
	# ---- 职业专属部件 ----
	if cfg.get("robe", false):
		_build_robe(d, cfg, torso, TW, TD, armor, armorL, buckleTone, beltTone, pants)
	if cfg.get("cape", false):
		_build_cape(d, cfg, torso, TW, TD)
	if cfg.get("wideHat", false):
		_build_wide_hat(d, cfg, head, hair)
	if cfg.get("halo", false):
		_build_halo(d, cfg, head)
	if cfg.get("staff", false):
		_build_staff(d, cfg)
	elif cfg.get("bow", false):
		_build_bow(d, cfg)
	else:
		_build_sword(d, cfg, cls)
	if cfg.get("shield", false):
		_build_shield(d, cfg)
	d.mir(false)

	d.mir(false)
	remove_child(d)
	d.queue_free()
	return root

# =========================================================
# 头部：脸 + 头发（参考图：厚重刘海 + 鬓角 + 怒眉）
# =========================================================
func _build_head(d, cfg: Dictionary, head: Node3D, skin: Color, hair: Color, female: bool, cls: String) -> void:
	var helm: bool = cfg.get("fullHelm", false)
	var zf := HEAD_D * 0.5            # 正面 z
	if helm:
		_build_full_helm(d, cfg)
		return
	# 头骨
	d.box("skull", Vector3(0, HEAD_H * 0.5, 0), Vector3(HEAD_W, HEAD_H, HEAD_D), skin)
	# 侧面暗部（体积）
	d.box("skull_l", Vector3(-HEAD_W * 0.5, HEAD_H * 0.5, 0), Vector3(1.6, HEAD_H, HEAD_D), skin.darkened(0.16))
	d.box("skull_r", Vector3(HEAD_W * 0.5, HEAD_H * 0.5, 0), Vector3(1.6, HEAD_H, HEAD_D), skin.lightened(0.06))
	d.box("jaw", Vector3(0, 2.0, zf * 0.15), Vector3(HEAD_W - 3.0, 4.0, HEAD_D - 3.0), skin.darkened(0.1))
	# 下巴（参考图有明确方下巴）
	d.box("chin", Vector3(0, 0.6, zf * 0.3), Vector3(HEAD_W - 7.0, 2.6, HEAD_D - 6.0), skin)
	# 耳朵
	d.pair("ear", Vector3(HEAD_W * 0.5 + 0.8, HEAD_H * 0.48, 0), Vector3(2.6, 5.0, 4.0), skin.darkened(0.12))

	# ---- 五官 ----
	var eyeY := HEAD_H * 0.58
	var eyeX := HEAD_W * 0.24
	# 眉毛（怒眉：内低外高）
	for s in [-1, 1]:
		d.mir(s < 0)
		var b = d.rot_box("brow", Vector3(eyeX, eyeY + 3.6, zf + 0.4), Vector3(7.8, 2.2, 1.1),
			hair.darkened(0.42), Vector3(0, 0, -15))
		d.mir(false)
	# 眼白 + 瞳孔 + 高光
	for s in [-1, 1]:
		d.mir(s < 0)
		d.box("eye_w", Vector3(eyeX, eyeY, zf + 0.4), Vector3(6.0, 4.4, 1.0), Color("#efe8dc"))
		d.box("pupil", Vector3(eyeX + 0.8, eyeY, zf + 0.9), Vector3(3.2, 3.8, 1.0), Color("#1a1410"))
		d.box("glint", Vector3(eyeX - 0.6, eyeY + 1.2, zf + 1.4), Vector3(1.8, 1.8, 0.8), Color.WHITE)
		d.mir(false)
	# 鼻
	d.box("nose", Vector3(0, eyeY - 4.2, zf + 0.7), Vector3(3.8, 4.4, 2.4), skin.lightened(0.1))
	d.box("nose_sh", Vector3(0, eyeY - 6.6, zf + 0.6), Vector3(3.8, 1.2, 1.9), skin.darkened(0.24))
	# 嘴 / 胡须
	if cfg.get("beard", false):
		var bd: Color = cfg.get("beardTone", hair.darkened(0.22))
		d.pair("beard_side", Vector3(HEAD_W * 0.37, HEAD_H * 0.28, zf + 0.3), Vector3(4.4, 11.0, 2.4), bd)
		d.box("beard_chin", Vector3(0, HEAD_H * 0.10, zf + 0.3), Vector3(HEAD_W - 4.0, 7.0, 2.4), bd)
		d.box("mustache", Vector3(0, eyeY - 6.8, zf + 1.0), Vector3(8.4, 2.2, 1.8), bd.lightened(0.14))
	else:
		d.box("mouth", Vector3(0, eyeY - 8.4, zf + 0.7), Vector3(5.4, 1.6, 1.1), skin.darkened(0.36))
	if female:
		d.pair("blush", Vector3(HEAD_W * 0.35, eyeY - 4.6, zf + 0.15), Vector3(3.6, 2.8, 1.0), Color("#c8705a", 0.5))

	# ---- 发饰（参考图女角色的黄色小饰）----
	if cfg.has("hairOrn"):
		var orn: Color = cfg["hairOrn"]
		d.trim("hair_orn_a", Vector3(HEAD_W * 0.34, HEAD_H + 2.2, HEAD_D * 0.5 + 0.6), Vector3(3.2, 2.6, 1.4), orn)
		d.trim("hair_orn_b", Vector3(-HEAD_W * 0.3, HEAD_H + 3.4, HEAD_D * 0.5 + 0.4), Vector3(2.2, 1.8, 1.2), orn)
		d.trim("hair_orn_ring", Vector3(0, HEAD_H + 0.8, -HEAD_D * 0.5 - 2.2), Vector3(HEAD_W + 2.6, 1.6, 1.4), orn)

	# ---- 头发（参考图：厚刘海 + 两侧鬓角）----
	var hl := hair.lightened(0.16)
	if cfg.get("hairStyle", "short") == "long":
		d.box("hair_top", Vector3(0, HEAD_H + 2.0, -0.8), Vector3(HEAD_W + 2.2, 5.6, HEAD_D + 2.2), hair)
		d.box("hair_hi", Vector3(0, HEAD_H + 4.4, -0.8), Vector3(HEAD_W + 2.2, 1.8, HEAD_D + 2.2), hl)
		# 两侧长发（垂到肩）
		d.pair("hair_side", Vector3(HEAD_W * 0.5 + 1.0, HEAD_H * 0.26, -1.2), Vector3(4.4, HEAD_H * 1.5, HEAD_D + 1.4), hair)
		d.pair("hair_tip", Vector3(HEAD_W * 0.5 + 1.0, -HEAD_H * 0.62, -1.2), Vector3(5.4, 6.4, HEAD_D + 2.2), hair.darkened(0.12))
		# 后背发
		d.box("hair_back", Vector3(0, HEAD_H * 0.3, -HEAD_D * 0.5 - 1.8), Vector3(HEAD_W + 2.6, HEAD_H * 1.4, 3.4), hair.darkened(0.08))
		# 斜刘海
		d.rot_box("hair_fringe", Vector3(-1.4, HEAD_H - 2.6, zf + 0.8), Vector3(HEAD_W - 1.0, 8.0, 1.8), hair, Vector3(0, 0, -8))
	else:
		d.box("hair_top", Vector3(0, HEAD_H + 1.8, -0.6), Vector3(HEAD_W + 2.0, 5.0, HEAD_D + 2.0), hair)
		d.box("hair_hi", Vector3(0, HEAD_H + 4.0, -0.6), Vector3(HEAD_W + 2.0, 1.6, HEAD_D + 2.0), hl)
		d.box("hair_back", Vector3(0, HEAD_H * 0.5, -HEAD_D * 0.5 - 1.4), Vector3(HEAD_W + 1.4, HEAD_H * 0.86, 2.8), hair.darkened(0.1))
		# 刘海（前额一片，参考图很明显）
		d.box("hair_fringe", Vector3(0, HEAD_H - 2.2, zf + 0.7), Vector3(HEAD_W - 0.6, 6.4, 2.0), hair)
		d.trim("hair_fringe_hi", Vector3(0, HEAD_H + 0.2, zf + 1.4), Vector3(HEAD_W - 3.0, 1.4, 1.0), hl)
		# 鬓角
		d.pair("hair_sideburn", Vector3(HEAD_W * 0.5 - 0.6, HEAD_H * 0.42, zf - 2.2), Vector3(3.6, 10.0, 4.6), hair)
		# 头带（参考图有深色发带）
		d.box("hairband", Vector3(0, HEAD_H - 0.4, 0.5), Vector3(HEAD_W + 2.4, 2.6, HEAD_D + 2.4), hair.darkened(0.44))

# =========================================================
# 全罩头盔（骑士）
# =========================================================
func _build_full_helm(d, cfg: Dictionary) -> void:
	var t: Color = cfg.get("helmTone", C_STEEL)
	d.box("helm", Vector3(0, HEAD_H * 0.5 + 1.2, 0), Vector3(HEAD_W + 3.2, HEAD_H + 2.4, HEAD_D + 2.8), t)
	d.box("helm_hi", Vector3(0, HEAD_H + 1.2, 0), Vector3(HEAD_W + 1.4, 2.0, HEAD_D + 1.4), t.lightened(0.24))
	d.box("helm_top", Vector3(0, HEAD_H + 4.0, 0), Vector3(HEAD_W - 1.4, 5.0, HEAD_D - 1.4), t)
	d.box("helm_peak", Vector3(0, HEAD_H + 7.6, 0), Vector3(HEAD_W - 7.0, 3.2, HEAD_D - 5.0), t.lightened(0.1))
	d.box("helm_ridge", Vector3(0, HEAD_H + 2.4, 0), Vector3(3.4, 15.0, HEAD_D + 3.4), t.lightened(0.28))
	# 面缝
	d.box("helm_slit", Vector3(0, HEAD_H * 0.60, HEAD_D * 0.5 + 1.8), Vector3(HEAD_W - 1.4, 4.6, 1.6), Color("#0c0f13"))
	d.pair("helm_eye", Vector3(4.4, HEAD_H * 0.60, HEAD_D * 0.5 + 2.2), Vector3(5.4, 2.6, 1.0), Color("#414c59"))
	d.pair("helm_vent", Vector3(2.2, HEAD_H * 0.24, HEAD_D * 0.5 + 1.8), Vector3(1.6, 3.0, 1.4), t.darkened(0.36))
	# 盔饰（参考图：头顶一道立起的羽冠）
	if cfg.get("helmCrest", false):
		var crest: Color = cfg.get("crestTone", Color("#c94f5a"))
		for i in 5:
			var h := 3.0 + i * 1.2
			d.box("crest%d" % i, Vector3(0, HEAD_H + 6.0 + i * 1.6, -HEAD_D * 0.5 + i * 1.4),
				Vector3(2.0, h, 3.0), crest.darkened(i * 0.05))
	# 颈护
	d.box("helm_neck", Vector3(0, -2.4, 0), Vector3(HEAD_W + 4.6, 4.6, HEAD_D + 3.8), t.darkened(0.12))
	d.box("helm_neck_hi", Vector3(0, -0.4, 0), Vector3(HEAD_W + 4.6, 1.4, HEAD_D + 3.8), t.lightened(0.2))

# =========================================================
# 长剑（剑士 / 骑士）
# =========================================================
func _build_sword(d, cfg: Dictionary, cls: String) -> void:
	var hand: Node3D = joints.get("elbow_1")
	if hand == null:
		return
	d.at(hand)
	var blade: Color = cfg.get("bladeTone", C_STEEL_L)
	var long := cls == "knight"
	var bl := 46.0 if long else 42.0
	# 握把
	d.box("grip", Vector3(0, -11.0, 0), Vector3(3.0, 8.0, 3.0), C_LEATHER_D)
	for i in 4:
		d.trim("wrap%d" % i, Vector3(0, -8.4 - i * 1.6, 0), Vector3(3.4, 0.8, 3.4), C_LEATHER)
	# 柄头
	d.box("pommel", Vector3(0, -15.6, 0), Vector3(4.4, 2.6, 4.4), C_GOLD, true)
	# 护手（横向 + 两端上翘）
	d.box("guard", Vector3(0, -6.4, 0), Vector3(14.0 if long else 12.0, 2.4, 3.6), C_STEEL, true)
	d.box("guard_hi", Vector3(0, -5.2, 0), Vector3(14.0 if long else 12.0, 1.0, 3.6), C_STEEL_L)
	d.pair("guard_tip", Vector3(6.6 if long else 5.6, -6.4, 0), Vector3(2.0, 3.4, 2.6), C_GOLD, true)
	# 剑身（细长，带中脊高光）
	d.box("blade", Vector3(0, -6.4 + bl * 0.5, 0), Vector3(4.4, bl, 2.2), blade, true)
	d.trim("blade_ridge", Vector3(0, -6.4 + bl * 0.5, 1.2), Vector3(1.4, bl * 0.96, 0.6), Color("#ffffff"))
	d.trim("blade_edge_l", Vector3(-2.1, -6.4 + bl * 0.5, 0), Vector3(0.6, bl * 0.98, 2.2), C_STEEL)
	d.trim("blade_edge_r", Vector3(2.1, -6.4 + bl * 0.5, 0), Vector3(0.6, bl * 0.98, 2.2), C_STEEL.darkened(0.2))
	# 剑尖
	d.box("blade_tip", Vector3(0, -6.4 + bl + 2.0, 0), Vector3(3.0, 4.0, 1.6), blade.lightened(0.1), true)
	# 武器构建结束，后续调用会重新 d.at(...) 切回需要的节点

# =========================================================
# 长弓（游侠）
# =========================================================
func _build_bow(d, cfg: Dictionary) -> void:
	var hand: Node3D = joints.get("elbow_1")
	if hand == null:
		return
	d.at(hand)
	var wood: Color = cfg.get("bowTone", C_LEATHER)
	d.box("bow_grip", Vector3(0, -10.0, 0), Vector3(4.0, 7.0, 4.0), wood.darkened(0.2))
	d.box("bow_mid", Vector3(0, -10.0, 3.0), Vector3(3.0, 20.0, 3.4), wood)
	d.box("bow_up", Vector3(0, 8.0, 5.4), Vector3(2.6, 20.0, 3.0), wood.lightened(0.1))
	d.box("bow_dn", Vector3(0, -28.0, 5.4), Vector3(2.6, 20.0, 3.0), wood.lightened(0.1))
	d.box("bow_tipu", Vector3(0, 19.0, 6.6), Vector3(2.2, 3.0, 2.2), wood.darkened(0.3))
	d.box("bow_tipd", Vector3(0, -39.0, 6.6), Vector3(2.2, 3.0, 2.2), wood.darkened(0.3))
	d.trim("bow_string", Vector3(0, -10.0, 7.2), Vector3(0.7, 58.0, 0.7), Color("#e8e2d4"))
	# 武器构建结束，后续调用会重新 d.at(...) 切回需要的节点

# =========================================================
# 法杖（法师）
# =========================================================
func _build_staff(d, cfg: Dictionary) -> void:
	var hand: Node3D = joints.get("elbow_1")
	if hand == null:
		return
	d.at(hand)
	var wood: Color = Color("#3a2a1a")
	var gem: Color = cfg.get("gem", Color("#c07cff"))
	d.box("staff_shaft", Vector3(0, -10.0, 0), Vector3(4.0, 64.0, 4.0), wood)
	d.box("staff_hi", Vector3(-1.4, -10.0, 0), Vector3(1.0, 62.0, 3.0), wood.lightened(0.2))
	for i in 5:
		d.trim("staff_wrap%d" % i, Vector3(0, -16.0 + i * 3.0, 0), Vector3(4.8, 2.0, 4.8), wood.lightened(0.26))
	d.box("staff_mount", Vector3(0, 24.0, 0), Vector3(8.0, 4.4, 8.0), wood.lightened(0.16))
	d.box("gem", Vector3(0, 32.0, 0), Vector3(7.0, 12.0, 7.0), gem, false, true)
	d.box("gem_top", Vector3(0, 40.0, 0), Vector3(3.6, 5.0, 3.6), gem.lightened(0.24), false, true)
	# 武器构建结束，后续调用会重新 d.at(...) 切回需要的节点

# =========================================================
# 塔盾（骑士）
# =========================================================
func _build_shield(d, cfg: Dictionary) -> void:
	var hand: Node3D = joints.get("elbow_-1")
	if hand == null:
		return
	d.at(hand)
	var face: Color = cfg.get("shieldTone", C_STEEL)
	d.box("shield_face", Vector3(-3.0, -8.0, 0), Vector3(2.6, 34.0, 22.0), face, true)
	d.box("shield_tip", Vector3(-3.0, -27.0, 0), Vector3(2.6, 8.0, 14.0), face.darkened(0.14), true)
	d.trim("shield_hi", Vector3(-4.4, -8.0, 0), Vector3(0.8, 30.0, 18.0), face.lightened(0.18))
	d.pair("shield_rim", Vector3(-3.0, -8.0, 10.4), Vector3(3.0, 34.0, 1.8), C_GOLD, true)
	d.box("shield_rim_t", Vector3(-3.0, 9.4, 0), Vector3(3.0, 1.8, 22.0), C_GOLD, true)
	d.box("shield_rim_b", Vector3(-3.0, -24.6, 0), Vector3(3.0, 1.8, 16.0), C_GOLD, true)
	var emb: Color = cfg.get("emblemTone", C_GOLD)
	d.trim("emblem_v", Vector3(-4.6, -8.0, 0), Vector3(1.0, 16.0, 3.0), emb)
	d.trim("emblem_h", Vector3(-4.6, -3.0, 0), Vector3(1.0, 3.0, 11.0), emb)
	if cfg.get("shieldEmblem", false):
		# 向下箭头（参考图盾牌正中的纹章）
		d.trim("emblem_shaft", Vector3(-4.8, -12.0, 0), Vector3(1.0, 8.0, 3.0), emb)
		d.trim("emblem_head", Vector3(-4.8, -16.6, 0), Vector3(1.0, 2.4, 7.0), emb)
		d.trim("emblem_head2", Vector3(-4.8, -18.4, 0), Vector3(1.0, 2.0, 4.4), emb)
		# 盾面暗色底（衬托金纹）
		d.box("emblem_bg", Vector3(-1.9, -10.0, 0), Vector3(1.2, 20.0, 13.0), Color("#2a2a3a"))
	# 武器构建结束，后续调用会重新 d.at(...) 切回需要的节点

# =========================================================
# 法师长袍（参考图：深紫长外套，下摆开衩，胸前金扣排）
# =========================================================
func _build_robe(d, cfg: Dictionary, torso: Node3D, TW: float, TD: float,
		armor: Color, armorL: Color, buckle: Color, belt: Color, pants: Color) -> void:
	d.at(torso)
	var robe = cfg.get("robeTone", armor)
	var robeL = cfg.get("robeLight", armorL)
	var long: bool = cfg.get("robeLong", false)     # 女法师是长袍，男法师是大衣
	var hem := 30.0 if long else 22.0
	# 下摆：前后两片 + 两侧开衩（用四片拼，中间留缝）
	for s2 in [-1, 1]:
		d.mir(s2 < 0)
		d.box("robe_side", Vector3(TW * 0.52, 2.0 - hem * 0.5, 0), Vector3(3.0, hem, TD + 1.4), robe.darkened(0.1))
		d.mir(false)
	d.box("robe_front", Vector3(0, 2.0 - hem * 0.5, TD * 0.5 + 0.6), Vector3(TW * 0.86, hem, 2.2), robe)
	d.box("robe_back", Vector3(0, 2.0 - hem * 0.5, -TD * 0.5 - 0.8), Vector3(TW * 0.94, hem, 2.6), robe.darkened(0.14))
	# 下摆底边的浅色镶边
	d.trim("robe_hem_f", Vector3(0, 2.0 - hem + 0.8, TD * 0.5 + 0.6), Vector3(TW * 0.86, 1.6, 2.4), robeL)
	d.trim("robe_hem_b", Vector3(0, 2.0 - hem + 0.8, -TD * 0.5 - 0.8), Vector3(TW * 0.94, 1.6, 2.8), robeL.darkened(0.14))
	# 正面一排金扣
	for i in 5:
		d.trim("robe_button%d" % i, Vector3(0, 21.0 - i * 5.0, TD * 0.5 + 1.9), Vector3(2.6, 2.6, 1.4),
			cfg.get("robeButton", Color("#d84fd0")))
	# 领口（高领）
	d.box("robe_collar", Vector3(0, 25.4, 0), Vector3(TW * 0.72, 4.2, TD * 0.9), armorL)
	d.box("robe_collar_hi", Vector3(0, 27.2, 0), Vector3(TW * 0.72, 1.4, TD * 0.9), armorL.lightened(0.24))
	# 腰间束带
	d.box("robe_sash", Vector3(0, 6.6, 0), Vector3(TW + 1.0, 3.4, TD + 1.4), belt)
	d.box("robe_sash_buckle", Vector3(0, 6.6, TD * 0.5 + 1.6), Vector3(4.4, 2.8, 1.6), buckle, true)

# =========================================================
# 游侠披风（参考图：棕色披风，跑动时向后飘）
# =========================================================
func _build_cape(d, cfg: Dictionary, torso: Node3D, TW: float, TD: float) -> void:
	d.at(torso)
	var tone: Color = cfg.get("capeTone", Color("#5a3a20"))
	# 披风挂在肩后，分三层做自然下垂 + 底部渐窄
	d.box("cape_top", Vector3(0, 22.0, -TD * 0.5 - 2.2), Vector3(TW + 3.0, 6.0, 1.8), tone)
	d.box("cape_mid", Vector3(0, 14.0, -TD * 0.5 - 2.8), Vector3(TW + 2.4, 11.0, 1.6), tone.darkened(0.06))
	d.box("cape_low", Vector3(0, 4.0, -TD * 0.5 - 3.2), Vector3(TW + 1.4, 10.0, 1.6), tone.darkened(0.12))
	d.box("cape_tip", Vector3(0, -3.0, -TD * 0.5 - 3.4), Vector3(TW - 2.0, 5.0, 1.6), tone.darkened(0.2))
	d.trim("cape_hi", Vector3(0, 24.4, -TD * 0.5 - 1.4), Vector3(TW + 3.0, 1.6, 1.0), tone.lightened(0.2))
	# 披风扣（肩前两颗金扣）
	d.pair("cape_clasp", Vector3(TW * 0.3, 24.0, TD * 0.5 + 1.4), Vector3(2.6, 2.6, 1.2), cfg.get("buckle", C_GOLD))

# =========================================================
# 游侠宽檐帽（参考图：深棕宽檐 + 帽带）
# =========================================================
func _build_wide_hat(d, cfg: Dictionary, head: Node3D, hair: Color) -> void:
	d.at(head)
	var tone: Color = cfg.get("hatTone", Color("#4a3320"))
	var band: Color = cfg.get("hatBand", Color("#2a1c10"))
	# 帽檐（宽出一圈的扁盘）
	d.box("hat_brim", Vector3(0, HEAD_H - 0.6, 0), Vector3(HEAD_W + 11.0, 2.0, HEAD_D + 11.0), tone)
	d.box("hat_brim_hi", Vector3(0, HEAD_H + 0.3, 0), Vector3(HEAD_W + 11.0, 0.8, HEAD_D + 11.0), tone.lightened(0.2))
	d.box("hat_brim_lo", Vector3(0, HEAD_H - 1.5, 0), Vector3(HEAD_W + 10.0, 0.9, HEAD_D + 10.0), tone.darkened(0.28))
	# 帽冠（上窄下宽的梯形，用两层叠）
	d.box("hat_crown", Vector3(0, HEAD_H + 3.4, 0), Vector3(HEAD_W + 1.6, 5.6, HEAD_D + 1.6), tone)
	d.box("hat_crown2", Vector3(0, HEAD_H + 6.6, 0), Vector3(HEAD_W - 1.0, 3.0, HEAD_D - 1.0), tone.darkened(0.08))
	d.box("hat_top", Vector3(0, HEAD_H + 8.4, 0), Vector3(HEAD_W - 2.6, 1.6, HEAD_D - 2.6), tone.lightened(0.12))
	# 帽带 + 小扣
	d.box("hat_band", Vector3(0, HEAD_H + 1.4, 0), Vector3(HEAD_W + 3.0, 2.2, HEAD_D + 3.0), band)
	d.trim("hat_buckle", Vector3(HEAD_W * 0.5 - 1.0, HEAD_H + 1.4, HEAD_D * 0.5 + 1.0), Vector3(2.0, 2.0, 1.2), cfg.get("buckle", C_GOLD))

# =========================================================
# 法师光环（头顶悬浮的紫色环）
# =========================================================
func _build_halo(d, cfg: Dictionary, head: Node3D) -> void:
	d.at(head)
	var tone: Color = cfg.get("haloTone", Color("#c07cff"))
	# 用一圈小方块拼出光环（体素风格）
	var R := 13.0
	var n := 14
	for i in n:
		var a := TAU * float(i) / float(n)
		d.box("halo_%d" % i, Vector3(cos(a) * R, HEAD_H + 13.0, sin(a) * R), Vector3(2.2, 1.4, 2.2), tone, false, true)
	d.box("halo_gem", Vector3(0, HEAD_H + 13.0, -R), Vector3(3.4, 2.6, 3.4), tone.lightened(0.3), false, true)

# ---------- 工具：按名字找所有子节点 ----------
func _find_all(n: Node, name: String) -> Array:
	var out := []
	if n.name == name:
		out.append(n)
	for c in n.get_children():
		out += _find_all(c, name)
	return out
