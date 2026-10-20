/* =========================================================
   余烬回廊 · 数据层：武器
   说明：atk 基础攻击 / spd 每秒攻击次数 / reach 攻速判定半径(px)
        crit 暴击率 / scale 伤害系数 / proj 是否发射投射物
        move 移速加成 / heavy 重击倍率 / stamina 每次挥击体力消耗
   ========================================================= */
(function (G) {
  G.QNAME = ['普通', '精良', '稀有', '史诗', '传说', '神话'];

  const W = [
    {
      id: 'w_ember_blade', name: '余烬短刃', wtype: 'blade', rarity: 0, lvl: 1,
      atk: 9, spd: 2.6, reach: 46, crit: 0.06, scale: 1, stamina: 5, heavy: 1.9,
      tags: ['近战', '轻盈'], passive: '连击时每次命中回复 1 点体力。',
      desc: '回廊入口处最常见的制式短刃，刃口被余烬烧出细密纹路。挥砍轻快，适合连续贴身输出。',
      flavor: '“第一把刀不会陪你走太久，但它会教你如何活下去。”',
      skill: { id: 'sk_dash_cut', name: '疾影斩', cost: 18, cd: 4.5, desc: '向前突进一段距离并斩击路径上的所有敌人。' }
    },
    {
      id: 'w_iron_falchion', name: '铁脊弯刀', wtype: 'blade', rarity: 1, lvl: 4,
      atk: 14, spd: 2.3, reach: 52, crit: 0.09, scale: 1.05, stamina: 6, heavy: 2.0,
      tags: ['近战', '斩击'], passive: '对流血中的目标伤害 +12%。',
      desc: '刀背厚重、弧线夸张，一次挥砍可以覆盖很大的横向范围，是清群的标准配置。',
      flavor: '“弯刀的弧度，是矿工们照着矿脉的走势打的。”',
      skill: { id: 'sk_whirl', name: '回旋斩', cost: 22, cd: 6, desc: '原地旋转攻击，对周围所有敌人造成两段伤害。' }
    },
    {
      id: 'w_ash_greatsword', name: '灰烬大剑', wtype: 'greatsword', rarity: 2, lvl: 8,
      atk: 27, spd: 1.25, reach: 74, crit: 0.05, scale: 1.25, stamina: 12, heavy: 2.35,
      tags: ['近战', '重击', '破甲'], passive: '重击命中使目标护甲降低 15%，持续 4 秒。',
      desc: '双手握持的宽刃巨剑，剑身中段嵌着一道冷却的余烬槽。挥速很慢，但每一击都带着碎骨的重量。',
      flavor: '“它不再是武器，而是一段会走路的地震。”',
      skill: { id: 'sk_quake', name: '崩地斩', cost: 26, cd: 7.5, desc: '重砸地面，产生冲击波击飞正前方的敌人。' }
    },
    {
      id: 'w_obsidian_cleaver', name: '黑曜断头台', wtype: 'greatsword', rarity: 3, lvl: 13,
      atk: 38, spd: 1.05, reach: 82, crit: 0.12, scale: 1.4, stamina: 15, heavy: 2.6,
      tags: ['近战', '处决'], passive: '对生命值低于 30% 的敌人伤害提升 45%。',
      desc: '黑曜石磨成的巨型刀身会吸收周围的光。它只在敌人的血快要流干时发出低沉的嗡鸣。',
      flavor: '“回廊第六层的守门人，就是被自己的武器砍下了头。”',
      skill: { id: 'sk_execute', name: '处决宣告', cost: 32, cd: 10, desc: '标记前方敌人，5 秒内对其造成的伤害提升 60%。' }
    },
    {
      id: 'w_rift_spear', name: '裂空长枪', wtype: 'spear', rarity: 2, lvl: 9,
      atk: 20, spd: 1.9, reach: 96, crit: 0.08, scale: 1.15, stamina: 8, heavy: 2.1,
      tags: ['近战', '长柄', '穿透'], passive: '突刺可以贯穿一条直线上的所有敌人。',
      desc: '枪杆由空心灰钢制成，刺出时会发出撕裂空气的哨音。攻击距离是它最大的防护。',
      flavor: '“先刺，再问。”',
      skill: { id: 'sk_thrust', name: '贯穿突刺', cost: 20, cd: 5.5, desc: '向准星方向高速突刺，贯穿路径上的全部敌人。' }
    },
    {
      id: 'w_storm_halberd', name: '风雷长戟', wtype: 'spear', rarity: 3, lvl: 14,
      atk: 31, spd: 1.65, reach: 104, crit: 0.1, scale: 1.3, stamina: 10, heavy: 2.3,
      tags: ['近战', '长柄', '雷'], passive: '命中时 20% 概率释放连锁闪电（弹射 2 次）。',
      desc: '戟首的雷石在挥动中不断放电，沉重的横扫能把整排敌人一起掀翻。',
      flavor: '“雷从天上来，也从戟尖来。”',
      skill: { id: 'sk_chain', name: '连锁雷击', cost: 30, cd: 9, desc: '召唤三道连锁闪电，在敌人之间弹射传导。' }
    },
    {
      id: 'w_ember_axe', name: '燃火双斧', wtype: 'axe', rarity: 1, lvl: 5,
      atk: 16, spd: 2.0, reach: 50, crit: 0.15, scale: 1.1, stamina: 7, heavy: 2.15,
      tags: ['近战', '双持', '暴击'], passive: '暴击时点燃目标，持续造成灼烧伤害。',
      desc: '一对灌满余烬油的短斧，斧刃常年是暗红色。攻速与爆发兼顾，代价是防御面偏薄。',
      flavor: '“双斧没有盾，进攻就是你的盾。”',
      skill: { id: 'sk_frenzy', name: '狂怒连斩', cost: 24, cd: 8, desc: '进入 4 秒狂怒：攻速 +60%，受到伤害 +15%。' }
    },
    {
      id: 'w_gravity_maul', name: '重力战锤', wtype: 'hammer', rarity: 4, lvl: 18,
      atk: 47, spd: 0.85, reach: 70, crit: 0.05, scale: 1.65, stamina: 18, heavy: 2.8,
      tags: ['近战', '范围', '眩晕'], passive: '每次命中积累 1 层重力，满 5 层触发范围眩晕。',
      desc: '锤头里封着一小块坍缩的星核，落下时空气会被压成可见的波纹。',
      flavor: '“它不是砸在敌人身上，是砸在敌人所在的那片空间上。”',
      skill: { id: 'sk_gravity_well', name: '重力奇点', cost: 36, cd: 12, desc: '在前方生成奇点，把敌人拉向中心并持续造成伤害。' }
    },
    {
      id: 'w_ember_bow', name: '猎风短弓', wtype: 'bow', rarity: 1, lvl: 3,
      atk: 12, spd: 1.4, reach: 620, crit: 0.12, scale: 1.0, proj: { speed: 620, size: 6, kind: 'arrow', pierce: 1 }, stamina: 6, heavy: 2.5,
      tags: ['远程', '穿刺'], passive: '距离目标越远，伤害越高（最多 +25%）。',
      desc: '轻质复合短弓，拉满需要一点力气，但射出的箭很直、很快。适合站在平台边缘输出。',
      flavor: '“回廊的风是斜的，所以箭要提前偏一点。”',
      skill: { id: 'sk_rain', name: '箭雨', cost: 22, cd: 7, desc: '朝天空射出一组箭矢，落向准星附近区域。' }
    },
    {
      id: 'w_ember_longbow', name: '余烬长弓', wtype: 'bow', rarity: 2, lvl: 10,
      atk: 22, spd: 1.1, reach: 760, crit: 0.18, scale: 1.2, proj: { speed: 760, size: 7, kind: 'arrow', pierce: 2 }, stamina: 8, heavy: 2.6,
      tags: ['远程', '穿透', '瞄准'], passive: '蓄力满时箭矢穿透 +2 并附加灼烧。',
      desc: '弓臂上盘着熄灭的余烬线，拉弦时整张弓会亮起一条金红的弧。穿透力惊人。',
      flavor: '“一箭，一线，一生。”',
      skill: { id: 'sk_pierce_shot', name: '破空贯射', cost: 26, cd: 8, desc: '射出一支巨型箭矢，贯穿全场敌人并造成击退。' }
    },
    {
      id: 'w_storm_crossbow', name: '风暴连弩', wtype: 'crossbow', rarity: 3, lvl: 15,
      atk: 17, spd: 3.4, reach: 660, crit: 0.1, scale: 1.0, proj: { speed: 820, size: 5, kind: 'bolt', pierce: 1, spread: 0.05 }, stamina: 4, heavy: 2.0,
      tags: ['远程', '连射', '弹幕'], passive: '连续命中同一目标 5 次后触发爆裂弹。',
      desc: '改装过的连发弩机，弹匣里压着淬了雷粉的短矢。按住攻击就是一场小型弹幕。',
      flavor: '“不用瞄准太久——弩机会替你补上剩下的。”',
      skill: { id: 'sk_barrage', name: '风暴弹幕', cost: 30, cd: 9, desc: '向准星方向倾泻 18 发雷矢，覆盖扇形区域。' }
    },
    {
      id: 'w_void_staff', name: '虚空法典杖', wtype: 'staff', rarity: 3, lvl: 16,
      atk: 26, spd: 1.2, reach: 560, crit: 0.08, scale: 1.25, proj: { speed: 420, size: 11, kind: 'orb', pierce: 1, aoe: 46 }, stamina: 9, heavy: 2.2,
      tags: ['远程', '法术', '范围'], passive: '法术命中产生 46 半径的虚空爆裂。',
      desc: '杖头悬浮着一页永远不会合上的法典，翻动时释放出紫色的虚空球。',
      flavor: '“知识是有重量的，尤其是被压缩过的知识。”',
      skill: { id: 'sk_void_nova', name: '虚空新星', cost: 34, cd: 10, desc: '以自身为中心爆发虚空冲击，击退并伤害周围敌人。' }
    },
    {
      id: 'w_flame_gauntlet', name: '熔核拳套', wtype: 'gauntlet', rarity: 2, lvl: 11,
      atk: 18, spd: 3.0, reach: 40, crit: 0.2, scale: 1.0, stamina: 4, heavy: 2.0,
      tags: ['近战', '极速', '暴击'], passive: '每第三次命中触发一次爆炸拳（范围伤害）。',
      desc: '拳面镶着三枚熔核，出拳时会在空气中留下短暂的焦痕。速度极快，判定很短。',
      flavor: '“拳头不需要理由，只需要距离。”',
      skill: { id: 'sk_flame_rush', name: '烈焰冲拳', cost: 20, cd: 6, desc: '连续三段冲拳，最后一段产生火焰爆裂。' }
    },
    {
      id: 'w_soul_scythe', name: '噬魂镰', wtype: 'scythe', rarity: 4, lvl: 19,
      atk: 34, spd: 1.4, reach: 88, crit: 0.16, scale: 1.45, stamina: 11, heavy: 2.4,
      tags: ['近战', '收割', '吸血'], passive: '击杀敌人回复 8% 最大生命值。',
      desc: '镰刃薄得近乎透明，被斩中的敌人会先失去颜色，再失去生命。',
      flavor: '“它收割的不是麦子。”',
      skill: { id: 'sk_reap', name: '魂之收割', cost: 30, cd: 9.5, desc: '大范围横扫，对每个命中目标回复 4% 生命。' }
    },
    {
      id: 'w_ember_whip', name: '余火长鞭', wtype: 'whip', rarity: 4, lvl: 20,
      atk: 29, spd: 1.75, reach: 128, crit: 0.14, scale: 1.35, stamina: 8, heavy: 2.25,
      tags: ['近战', '超长', '灼烧'], passive: '命中范围内所有敌人都会被点燃。',
      desc: '由凝固的火焰抽成丝再编结而成，挥动时留下一道持续燃烧的弧线。',
      flavor: '“鞭子是回廊教给驯火者的第一课。”',
      skill: { id: 'sk_flame_domain', name: '焚烬领域', cost: 38, cd: 13, desc: '在脚下生成持续 6 秒的燃烧领域，对区域内敌人持续造成伤害。' }
    },
    {
      id: 'w_dawn_edge', name: '破晓之刃', wtype: 'blade', rarity: 5, lvl: 25,
      atk: 52, spd: 2.4, reach: 62, crit: 0.25, scale: 1.55, stamina: 6, heavy: 2.5,
      tags: ['近战', '全能', '传说'], passive: '暴击时释放一次破晓斩击波（范围伤害），并回复 2% 生命。',
      desc: '据说是回廊燃起第一团火时被铸出的剑。剑身常亮，从不沾血，也从不冷却。',
      flavor: '“你握着的是回廊的第一缕早晨。”',
      skill: { id: 'sk_dawn_burst', name: '破晓爆发', cost: 40, cd: 14, desc: '向前方释放三道巨大光刃，贯穿并灼烧全场。' }
    }
  ];

  const byId = {};
  W.forEach(function (w) { byId[w.id] = w; });

  /* 武器类型说明（用于界面提示） */
  G.WTYPE_INFO = {
    blade: { label: '短刃 / 弯刀', tip: '攻速与机动兼顾，适合贴身连段。' },
    greatsword: { label: '大剑', tip: '慢速高伤，重击可破甲。' },
    spear: { label: '长柄', tip: '攻击距离最长，可贯穿直线。' },
    axe: { label: '双斧', tip: '高暴击、中等攻速，爆发强。' },
    hammer: { label: '战锤', tip: '极慢速、极高单次伤害，带眩晕。' },
    bow: { label: '弓', tip: '远程穿刺，蓄力可穿透多目标。' },
    crossbow: { label: '弩', tip: '远程连射，适合弹幕压制。' },
    staff: { label: '法杖', tip: '远程法术球，命中产生范围爆裂。' },
    gauntlet: { label: '拳套', tip: '判定最短、攻速最快，暴击流核心。' },
    scythe: { label: '镰', tip: '大范围收割，击杀回血。' },
    whip: { label: '长鞭', tip: '超长近战判定，附带灼烧。' }
  };

  G.Weapons = {
    list: W,
    get: function (id) { return byId[id] || null; },
    /** 依据等级与稀有度生成随机词条武器（肉鸽掉落用） */
    roll: function (playerLvl, bias) {
      const pool = W.filter(function (w) {
        const lv = playerLvl || 1;
        return Math.abs(w.lvl - lv) <= (bias === 'boss' ? 8 : 5) || w.rarity <= (bias === 'boss' ? 3 : 1);
      });
      const pick = (pool.length ? pool : W)[Math.floor(Math.random() * (pool.length ? pool.length : W.length))];
      const inst = JSON.parse(JSON.stringify(pick));
      inst.uid = 'w' + Math.random().toString(36).slice(2, 9);
      const scale = 1 + (Math.random() * 0.16 - 0.04);
      inst.atk = Math.max(1, Math.round(inst.atk * scale));
      inst.prefix = ['灼热的', '锋锐的', '古老的', '余烬的', '锈蚀的', '微光的', '被祝福的'][Math.floor(Math.random() * 7)];
      inst.instName = inst.prefix + inst.name;
      return inst;
    }
  };
})(window.G = window.G || {});
