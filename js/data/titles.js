/* =========================================================
   余烬回廊 · 称号与技能进化体系（数据层）
   规则：按键位置固定不变；技能效果 / 视觉 / 机制随称号等级进化；
        第 5 级起分化为「誓约骑士（近战）」与「秘法师（远程）」两条分支。
   每条技能线的第 5 / 6 行为双分支（近战 / 远程），由武器类型自动选取。
   ========================================================= */
(function (G) {
  /* 称号阶梯：索引 0 = 凡人 …… 索引 10 = 升神者 */
  G.TITLES = [
    { lvl: 1, name: '凡人', req: 0, desc: '刚踏进回廊的人，只会用最基础的三段斩。' },
    { lvl: 2, name: '勇武之士', req: 800, desc: '斩击更有力，第三击可以把轻敌击退。' },
    { lvl: 3, name: '启灵者', req: 2600, desc: '触到灵魂的边，攻击开始附带灵性伤害。' },
    { lvl: 4, name: '塑能学徒', req: 6000, desc: '学会把能量凝成剑刃与护盾。' },
    { lvl: 5, name: '誓约骑士 / 秘法师', req: 12000, split: true, desc: '正式分化：近战走誓约骑士，远程走秘法师。' },
    { lvl: 6, name: '冠冕超凡', req: 22000, desc: '技能开始改写战场规则。' },
    { lvl: 7, name: '灵墟行者', req: 38000, desc: '灵魂成为可用的资源。' },
    { lvl: 8, name: '道标领主', req: 62000, desc: '在地上刻下法则，让敌人替你承受代价。' },
    { lvl: 9, name: '灰芒半神', req: 98000, desc: '灰芒即是神性的一点残余。' },
    { lvl: 10, name: '升神者', req: 150000, desc: '你不再被回廊筛选，你开始筛选回廊。' }
  ];

  /** 按累计余烬换算称号索引（0~9） */
  G.titleIndexFor = function (embers) {
    const n = embers || 0;
    let idx = 0;
    for (let i = 0; i < G.TITLES.length; i++) if (n >= G.TITLES[i].req) idx = i;
    return idx;
  };
  /** 取称号对象 */
  G.titleFor = function (embers) { return G.TITLES[G.titleIndexFor(embers)]; };

  /* 技能线：t 为触发方式（lmb 普攻 / rmb 主技能 / q 副技能 / shift 闪避）
     melee 为 true 的条目用于近战武器，false 用于远程武器；非分支条目两者共用 */
  const LMB = [
    { name: '铁剑斩击', melee: true, dmg: 1.0, range: 1.0, vfx: 'plain', desc: '身前短距离三段斩，仅物理伤害。' },
    { name: '发力斩', melee: true, dmg: 1.15, range: 1.2, vfx: 'trail', shake: 2, desc: '斩击距离 +20%，第三击可击退轻型敌人。' },
    { name: '附灵斩', melee: true, dmg: 1.3, range: 1.2, vfx: 'soul', soul: true, desc: '斩击附带灵魂伤害，对亡灵类敌人增伤 30%。' },
    { name: '塑能剑刃', melee: true, dmg: 1.45, range: 1.25, vfx: 'arc', wave: { dmg: 0.4, speed: 420, len: 2 }, desc: '每段斩击附带短距离剑气，向前飞行 2 个身位。' },
    { name: '誓约圣斩', melee: true, dmg: 1.7, range: 1.35, vfx: 'holy', wave: { dmg: 0.6, speed: 480, len: 3 }, lifesteal: 0.03, desc: '剑气范围扩大，命中敌人回复少量生命值。' },
    { name: '领域斩击', melee: true, dmg: 1.9, range: 1.4, vfx: 'domain', wave: { dmg: 0.7, speed: 520, len: 3 }, field: { r: 120, dur: 3, slow: 0.5 }, desc: '斩击后地面残留领域，敌人减速。' },
    { name: '灵魂虚影斩', melee: true, dmg: 2.15, range: 1.45, vfx: 'ghost', soul: true, ghost: { dmg: 1.2 }, desc: '斩击释放灵魂虚影突进，造成二段伤害。' },
    { name: '法则斩击', melee: true, dmg: 2.4, range: 1.5, vfx: 'law', mark: { dur: 3, amp: 1.3 }, desc: '命中刻下法则印记，3 秒内敌人易伤。' },
    { name: '灰芒神裁', melee: true, dmg: 2.8, range: 1.6, vfx: 'gray', beam: { dmg: 1.4, len: 2 }, desc: '化为灰色光柱，贯穿身前所有敌人。' },
    { name: '新元之剑', melee: true, dmg: 3.4, range: 2.6, vfx: 'genesis', wave: { dmg: 2.2, speed: 900, len: 99, full: true }, execute: 0.15, desc: '全屏横向斩击波，巨额伤害并附带斩杀。' },

    { name: '奥术弹', melee: false, dmg: 1.0, range: 1.0, vfx: 'arcane', proj: { speed: 640, pierce: 1 }, desc: '普攻变为发射奥术弹，远程攻击，可穿透 1 个敌人。' },
    { name: '发力箭', melee: false, dmg: 1.15, range: 1.1, vfx: 'trail', proj: { speed: 700, pierce: 1 }, knock: 60, desc: '箭矢更强，命中可击退轻型敌人。' },
    { name: '附灵弹', melee: false, dmg: 1.3, range: 1.15, vfx: 'soul', soul: true, proj: { speed: 700, pierce: 1 }, desc: '弹体附带灵魂伤害。' },
    { name: '塑能弹幕', melee: false, dmg: 1.45, range: 1.2, vfx: 'arc', proj: { speed: 760, pierce: 1, burst: 2 }, desc: '每次攻击射出两枚塑能弹。' },
    { name: '秘法连弹', melee: false, dmg: 1.7, range: 1.3, vfx: 'holy', proj: { speed: 820, pierce: 2 }, lifesteal: 0.02, desc: '弹体穿透 2 个敌人，命中回复少量生命。' },
    { name: '奥术弹幕', melee: false, dmg: 1.9, range: 1.35, vfx: 'barrage', proj: { speed: 880, pierce: 1, burst: 3 }, desc: '连发 3 枚奥术弹。' },
    { name: '魂能弹', melee: false, dmg: 2.15, range: 1.4, vfx: 'ghost', soul: true, proj: { speed: 900, pierce: 2 }, desc: '弹体可穿透 2 个敌人，环绕灵魂光晕。' },
    { name: '律令弹', melee: false, dmg: 2.4, range: 1.45, vfx: 'law', proj: { speed: 940, pierce: 2 }, mark: { dur: 3, amp: 1.3 }, desc: '命中刻下印记，叠加增伤。' },
    { name: '神性射线', melee: false, dmg: 2.8, range: 1.5, vfx: 'gray', beam: { dmg: 1.6, len: 99 }, desc: '持续射线伤害，贯穿全场。' },
    { name: '创世光束', melee: false, dmg: 3.4, range: 2.2, vfx: 'genesis', beam: { dmg: 2.4, len: 99, full: true }, execute: 0.15, desc: '贯穿全屏光束，附带斩杀。' }
  ];

  const RMB = [
    { name: '猛力劈砍', melee: true, dmg: 1.5, range: 1.15, cd: 3.0, vfx: 'heavy', knock: 180, desc: '蓄力后重劈，造成 150% 普攻伤害并击退敌人。' },
    { name: '破甲斩', melee: true, dmg: 1.7, range: 1.15, cd: 3.2, vfx: 'break', knock: 180, debuff: { def: 0.3, dur: 3 }, desc: '重劈同时破坏防御，接下来 3 秒伤害提升。' },
    { name: '灵魂冲击波', melee: true, dmg: 1.6, range: 1.6, cd: 3.6, vfx: 'soulwave', knock: 320, desc: '向前释放灵魂冲击波，推开范围内所有敌人。' },
    { name: '魔力爆发', melee: true, dmg: 1.8, range: 1.7, cd: 4.0, vfx: 'novapurple', launch: 1, desc: '原地爆发魔力，对周围敌人造成伤害并击飞。' },
    { name: '圣盾反击', melee: true, dmg: 2.2, range: 1.3, cd: 4.5, vfx: 'shield', block: 0.5, desc: '举盾 0.5 秒，格挡攻击后触发反击，造成双倍伤害。' },
    { name: '圣誓裁决', melee: true, dmg: 2.6, range: 1.8, cd: 6.5, vfx: 'verdict', stun: 1.2, desc: '向前冲出并重击地面，范围眩晕。' },
    { name: '魂火斩', melee: true, dmg: 2.8, range: 1.6, cd: 7.0, vfx: 'soulfire', soul: true, homing: true, desc: '释放追踪魂火，自动追击敌人。' },
    { name: '法则镇压', melee: true, dmg: 3.0, range: 1.9, cd: 8.0, vfx: 'lawfield', root: 2.0, amp: 1.3, desc: '范围内敌人定身 2 秒并受到伤害加深。' },
    { name: '灰芒审判', melee: true, dmg: 3.6, range: 2.0, cd: 9.0, vfx: 'graybeam', beam: { dmg: 2.0, len: 3, dur: 1.2 }, desc: '天降灰色光柱，持续造成高额伤害。' },
    { name: '神罚之剑', melee: true, dmg: 5.0, range: 2.4, cd: 11.0, vfx: 'divine', execute: 0.2, desc: '召唤巨型光剑劈下，大范围秒杀小怪，对首领巨额伤害。' },

    { name: '秘法火球', melee: false, dmg: 1.5, range: 1.3, cd: 3.4, vfx: 'fireball', aoe: 70, desc: '蓄力发射火球，命中爆炸造成范围伤害。' },
    { name: '穿甲箭', melee: false, dmg: 1.7, range: 1.35, cd: 3.6, vfx: 'break', pierce: 3, debuff: { def: 0.3, dur: 3 }, desc: '穿透多个目标的破甲箭。' },
    { name: '灵魂洪流', melee: false, dmg: 1.6, range: 1.5, cd: 4.0, vfx: 'soulwave', soul: true, wave: true, desc: '向前释放灵魂洪流，推开敌人。' },
    { name: '奥术新星', melee: false, dmg: 1.8, range: 1.7, cd: 4.2, vfx: 'novapurple', launch: 1, desc: '以自身为中心爆发奥术新星并击飞。' },
    { name: '秘法屏障', melee: false, dmg: 1.9, range: 1.4, cd: 5.0, vfx: 'shield', block: 0.6, barrier: true, desc: '展开秘法屏障，格挡后反噬伤害。' },
    { name: '陨石术', melee: false, dmg: 2.6, range: 1.8, cd: 7.0, vfx: 'meteor', aoe: 110, desc: '召唤陨石砸落，命中范围造成火焰伤害。' },
    { name: '灵魂风暴', melee: false, dmg: 2.8, range: 1.8, cd: 7.5, vfx: 'storm', soul: true, field: { r: 150, dur: 3.5, tick: 0.4 }, desc: '范围灵魂风暴持续伤害。' },
    { name: '律令牢笼', melee: false, dmg: 3.0, range: 1.9, cd: 8.5, vfx: 'lawfield', root: 2.4, amp: 1.35, desc: '魔法牢笼禁锢范围内敌人。' },
    { name: '神性陨落', melee: false, dmg: 3.6, range: 2.0, cd: 9.5, vfx: 'graybeam', beam: { dmg: 2.2, len: 3, dur: 1.2 }, desc: '多段神性冲击从天而降。' },
    { name: '创世烈焰', melee: false, dmg: 5.0, range: 2.6, cd: 12.0, vfx: 'genesis', aoe: 150, execute: 0.2, desc: '降下创世烈焰，大范围秒杀小怪。' }
  ];

  const QK = [
    { name: '应急包扎', cd: 16, heal: 0.18, vfx: 'green', desc: '瞬间回复少量生命值。' },
    { name: '战斗怒吼', cd: 18, vfx: 'red', buff: { atk: 0.2, dur: 3 }, fear: 1.0, desc: '提升自身攻击力 3 秒，周围敌人被震慑。' },
    { name: '灵魂视野', cd: 20, vfx: 'blue', reveal: 5, desc: '5 秒内显示隐藏敌人、陷阱与灵魂碎片。' },
    { name: '魔力护盾', cd: 18, vfx: 'purple', shield: 1, desc: '生成护盾，吸收一次伤害后破碎。' },
    { name: '圣疗术', cd: 24, heal: 0.3, vfx: 'gold', aoeHeal: true, desc: '大范围回复自身与周围友军生命。' },
    { name: '领域庇护', cd: 26, vfx: 'golddomain', dr: 0.5, dur: 5, desc: '展开领域，自身减伤 50%。' },
    { name: '灵魂替身', cd: 26, vfx: 'ghost', decoy: 3, stealth: 2, desc: '留下替身吸引火力，自身进入短暂隐身。' },
    { name: '召唤畸变仆从', cd: 30, vfx: 'summon', minions: 2, desc: '召唤 2 只仆从协助作战。' },
    { name: '神性化身', cd: 34, vfx: 'grayform', buff: { atk: 0.5, dur: 6, range: 0.3 }, desc: '短暂变身，攻击力与范围大幅提升。' },
    { name: '新元结界', cd: 40, vfx: 'genesis', barrier: true, dur: 4, reflect: true, desc: '全屏结界，免疫伤害并反弹攻击。' },

    { name: '霜星爆', cd: 20, vfx: 'ice', freeze: 2, slow: 0.5, dmg: 0.8, desc: '原地爆发冰霜，减速并冻结敌人 2 秒。' },
    { name: '时空缓速', cd: 22, vfx: 'purple', slowField: 0.5, dur: 5, desc: '范围内敌人速度减半。' },
    { name: '魔法镜像', cd: 26, vfx: 'mirror', mirror: 3, desc: '镜像复制自身攻击。' },
    { name: '全知之眼', cd: 30, vfx: 'eye', revealAll: true, amp: 1.25, dur: 5, desc: '全图敌人暴露并易伤。' },
    { name: '时空重置', cd: 45, vfx: 'reset', resetCd: true, desc: '重置所有技能冷却。' }
  ];

  const SHIFT = [
    { name: '快步闪避', dmg: 0, dist: 1.0, invuln: 0.24, cd: 0.9, vfx: 'plain', desc: '短距离位移，0.24 秒无敌。' },
    { name: '冲撞闪避', dmg: 0.5, dist: 1.2, invuln: 0.24, cd: 0.9, vfx: 'impact', desc: '位移距离增加，撞到敌人造成小额伤害。' },
    { name: '灵魂突进', dmg: 0.8, dist: 1.2, invuln: 0.26, cd: 0.85, vfx: 'soul', soul: true, desc: '位移时留下灵魂残影，穿过敌人造成伤害。' },
    { name: '魔力闪现', dmg: 1.1, dist: 1.3, invuln: 0.26, cd: 0.85, vfx: 'novapurple', burst: true, desc: '位移结束爆发魔力冲击，击飞周围敌人。' },
    { name: '誓约冲锋', dmg: 1.0, dist: 1.4, invuln: 0.3, cd: 0.8, vfx: 'shield', projectileImmune: true, stun: 0.8, desc: '带盾突进，免疫飞行道具，撞到敌人眩晕。' },
    { name: '领域冲锋', dmg: 1.2, dist: 1.5, invuln: 0.3, cd: 0.8, vfx: 'domain', trailField: { r: 90, dur: 2, slow: 0.5 }, desc: '冲锋路径留下领域减速敌人。' },
    { name: '魂穿闪避', dmg: 1.3, dist: 1.5, invuln: 0.45, cd: 0.8, vfx: 'ghost', phase: true, desc: '可穿过敌人与障碍物，位移后无敌延长。' },
    { name: '法则突进', dmg: 1.5, dist: 1.6, invuln: 0.32, cd: 0.75, vfx: 'law', trailField: { r: 90, dur: 3, dmg: 0.5, tick: 0.5 }, desc: '路径留下法则领域，持续伤害经过的敌人。' },
    { name: '神行突进', dmg: 1.6, dist: 1.7, invuln: 0.34, cd: 0.7, vfx: 'gray', charges: 2, echo: 1.2, desc: '可连续突进 2 次，每次留下神性残影自动攻击。' },
    { name: '虚空神行', dmg: 2.0, dist: 2.6, invuln: 0.4, cd: 0.6, vfx: 'genesis', blink: true, burst: true, desc: '向准星方向闪烁，落地触发神性爆发。' },

    { name: '闪现跃迁', dmg: 1.4, dist: 2.2, invuln: 0.34, cd: 0.7, vfx: 'blink', blink: true, burst: true, desc: '瞬移更远距离，原地留下魔法爆炸。' },
    { name: '空间折跃', dmg: 1.6, dist: 2.4, invuln: 0.36, cd: 0.66, vfx: 'blink', blink: true, charges: 2, desc: '可连续闪现 2 次。' }
  ];

  const PASSIVE = [
    { name: '求生本能', desc: '生命值低于 20% 时，移动速度提升 20%。', k: 'lowHpSpd' },
    { name: '战斗直觉', desc: '普攻第三段伤害提升 30%。', k: 'finisher' },
    { name: '灵魂感知', desc: '自动吸附附近的灵魂碎片与金币。', k: 'magnet' },
    { name: '魔力亲和', desc: '所有技能冷却时间缩短 15%。', k: 'cdr' },
    { name: '圣誓守护', desc: '受到致命伤害时，保留 1 点生命并获得护盾。', k: 'lastStand' },
    { name: '领域感知', desc: '敌人靠近时自动预警。', k: 'warn' },
    { name: '灵魂不灭', desc: '每局首次死亡时原地复活，恢复 50% 生命。', k: 'revive' },
    { name: '法则压制', desc: '自身周围敌人攻击力降低 20%。', k: 'suppress' },
    { name: '神性威压', desc: '普通敌人靠近自动减速。', k: 'awe' },
    { name: '新元法则', desc: '所有伤害附带真实伤害，无视防御。', k: 'trueDmg' }
  ];

  /**
   * 取某个按键在当前称号下应使用的技能
   * @param {string} slot lmb | rmb | q | shift
   * @param {number} idx  称号索引 0~9
   * @param {boolean} ranged 是否远程武器
   */
  G.skillFor = function (slot, idx, ranged) {
    const pool = { lmb: LMB, rmb: RMB, q: QK, shift: SHIFT }[slot];
    if (!pool) return null;
    const i = Math.max(0, Math.min(idx || 0, G.TITLES.length - 1));
    if (slot === 'lmb' || slot === 'rmb') return pool[ranged ? 10 + i : i];
    if (slot === 'shift') {
      if (!ranged || i < 5) return pool[i];
      /* 远程分支只有 2 个进阶条目（索引 10、11），更高称号沿用最高档 */
      return pool[Math.min(10 + (i - 5), pool.length - 1)];
    }
    return pool[i];                       /* q 为两分支共用 */
  };

  G.passiveFor = function (idx) {
    const i = Math.max(0, Math.min(idx || 0, PASSIVE.length - 1));
    return PASSIVE[i];
  };
  G.PASSIVES = PASSIVE;
})(window.G = window.G || {});
