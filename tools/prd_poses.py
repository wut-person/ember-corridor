# -*- coding: utf-8 -*-
"""给 PRD 构建脚本的 11 章追加 11.6「十二个动作姿态」"""
import io

P = r"D:\new games\tools\build_prd.py"
s = io.open(P, encoding="utf-8").read()

if "11.6 十二个动作姿态" in s:
    print("11.6 已存在，跳过")
    raise SystemExit(0)

anchor = "# ---------------- 附录 ----------------"
assert anchor in s, "未找到附录锚点"

add = '''heading(doc, "11.6 十二个动作姿态", 2)
para(doc,
     "每个角色都有 12 个动作姿态 × 8 个朝向，共 96 张图；8 个角色合计 768 张。"
     "游戏侧由 sheetPickPose() 根据 action / moving / atkT / comboStep 自动选择姿态，"
     "逻辑层只需传状态，不必关心具体用哪张图。")
table(doc, ["序号", "姿态名", "中文", "触发条件"],
      [
          ["1", "idle_a", "待机 A", "静止时呼吸循环"],
          ["2", "idle_b", "待机 B", "静止时呼吸循环（与 A 交替）"],
          ["3", "walk_a", "走路 A", "移动中（左右腿前后交替）"],
          ["4", "walk_b", "走路 B", "移动中（与 A 交替）"],
          ["5", "run", "奔跑", "Shift 疾跑 / action 为 run"],
          ["6", "atk_1", "普攻一", "三段连招第 1 段（起手）"],
          ["7", "atk_2", "普攻二", "连招第 2 段（横挥）"],
          ["8", "atk_3", "普攻三", "连招第 3 段（下劈，伤害 ×1.35）"],
          ["9", "skill_a", "技能蓄力", "action 为 cast 的前半段（高举）"],
          ["10", "skill_b", "技能释放", "action 为 cast 的后半段（下压）"],
          ["11", "hurt", "受击", "hurtT 大于 0（后仰）"],
          ["12", "crouch", "下蹲", "按下 S（压低身体）"],
      ],
      widths=W([1.2, 2.2, 2.0, 7.6], font_size=8.5))
para(doc,
     "武器：剑士与骑士握长剑（骑士另有塔盾），游侠背长弓，法师持法杖（带发光紫水晶）。"
     "每个动作的手臂角度与握武器角度都单独调整，因此普攻可以看到明显的挥砍弧线。")

'''
s = s.replace(anchor, add + anchor, 1)
io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("PRD 已追加 11.6 十二个动作姿态")
