/* =========================================================
   余烬回廊 · 数据层：敌人 / 精英词缀 / 首领
   ========================================================= */
(function (G) {
  /* kind: melee 近战 / charger 冲锋 / ranged 远程 / flyer 飞行 / boss 首领
     hp/atk 基础值，实际按关卡难度系数放大 */
  const E = [
    { id: 'e_slime_ash', name: '灰烬黏块', kind: 'melee', hp: 34, atk: 7, spd: 34, size: 16, color: '#7a6a55',
      behavior: '缓慢靠近后跳扑', weak: '怕火', drops: 'normal' },
    { id: 'e_rust_hound', name: '锈齿猎犬', kind: 'charger', hp: 46, atk: 11, spd: 92, size: 17, color: '#8a5a3a',
      behavior: '短距离蓄力后高速冲撞', weak: '冲锋后有硬直', drops: 'normal' },
    { id: 'e_scrap_sentry', name: '废铁哨兵', kind: 'ranged', hp: 52, atk: 9, spd: 22, size: 19, color: '#8d97a5',
      behavior: '保持距离发射铁钉', weak: '近身后很脆弱', drops: 'normal' },
    { id: 'e_ember_bat', name: '余烬蝠', kind: 'flyer', hp: 28, atk: 8, spd: 78, size: 14, color: '#c05a2a',
      behavior: '波浪飞行并俯冲', weak: '生命值低', drops: 'normal' },
    { id: 'e_slag_brute', name: '熔渣壮汉', kind: 'melee', hp: 110, atk: 16, spd: 30, size: 25, color: '#9a4a22',
      behavior: '高举双臂砸地产生冲击波', weak: '动作前摇很长', drops: 'normal' },
    { id: 'e_void_stalker', name: '虚空潜行者', kind: 'charger', hp: 96, atk: 19, spd: 104, size: 21, color: '#6b46c0',
      behavior: '短暂消失后从背后突袭', weak: '显形瞬间最脆', drops: 'normal', undead: true },
    { id: 'e_rune_turret', name: '符文炮台', kind: 'ranged', hp: 88, atk: 14, spd: 0, size: 22, color: '#3f7f9a',
      behavior: '固定位置发射符文光束', weak: '不会移动', drops: 'normal' },
    { id: 'e_warden_lesser', name: '回廊守卫·残影', kind: 'melee', hp: 150, atk: 22, spd: 52, size: 24, color: '#b08040',
      behavior: '三连挥砍并突进', weak: '连击后有停顿', drops: 'elite', undead: true },
    { id: 'e_furnace_keeper', name: '熔炉守门者', kind: 'boss', hp: 1400, atk: 30, spd: 42, size: 46, color: '#d4562a',
      behavior: '阶段一：锤击与熔岩喷发；阶段二：召唤熔渣仆从', weak: '胸口熔核', drops: 'boss' },
    { id: 'e_void_sovereign', name: '虚空主宰', kind: 'boss', hp: 2200, atk: 36, spd: 48, size: 50, color: '#8a5cff',
      behavior: '瞬移、虚空爆裂、召唤潜行者', weak: '施法时无法移动', drops: 'boss' },
    { id: 'e_dawn_echo', name: '破晓之回声', kind: 'boss', hp: 3200, atk: 44, spd: 56, size: 52, color: '#ffcf8a',
      behavior: '复制玩家武器招式，双阶段切换', weak: '它复制的是昨天的你', drops: 'boss', undead: true },
    /* ---------- 大世界 & 遗迹：按参考图新增的攻击生物 ---------- */
    { id: 'e_dark_wolf', name: '幽影狼', kind: 'charger', hp: 58, atk: 13, spd: 100, size: 19, color: '#232028',
      sprite: 'wolf', behavior: '压低身子潜行接近，然后爆发冲刺撕咬', weak: '冲锋落空后有硬直', drops: 'normal' },
    { id: 'e_vine_horror', name: '藤蔓魔', kind: 'melee', hp: 130, atk: 17, spd: 34, size: 27, color: '#4a7a2a',
      sprite: 'vine', behavior: '藤鞭横扫，胸口火核会喷出孢子', weak: '胸口火核是弱点', drops: 'normal' },
    { id: 'e_tomb_skeleton', name: '墓碑骷髅', kind: 'melee', hp: 74, atk: 15, spd: 44, size: 21, color: '#ded4c0',
      sprite: 'skeleton', behavior: '抡起墓碑砸击，被打散后会重组一次', weak: '骨骼脆弱，怕钝击', drops: 'normal', undead: true }
  ];

  const byId = {};
  E.forEach(function (e) { byId[e.id] = e; });

  /* 精英词缀：附加属性与视觉描边 */
  G.ELITE_AFFIX = [
    { id: 'af_armored', name: '铁甲', hp: 1.5, atk: 1.0, spd: 0.95, color: '#9fb0c4', desc: '生命 +50%，移速略降' },
    { id: 'af_swift', name: '迅捷', hp: 1.05, atk: 1.0, spd: 1.5, color: '#5fe08a', desc: '移速 +50%' },
    { id: 'af_burning', name: '灼热', hp: 1.15, atk: 1.35, spd: 1.0, color: '#ff8a3c', desc: '攻击 +35%，附带灼烧' },
    { id: 'af_void', name: '虚空', hp: 1.3, atk: 1.2, spd: 1.1, color: '#a06cff', desc: '全属性提升，死亡时爆裂' },
    { id: 'af_giant', name: '巨躯', hp: 1.9, atk: 1.25, spd: 0.8, color: '#f6c667', desc: '生命 +90%，体积变大' }
  ];

  G.Enemies = {
    list: E,
    get: function (id) { return byId[id] || null; },
    /** 按层数挑选敌人池 */
    poolFor: function (diff) {
      if (diff <= 1) return ['e_slime_ash', 'e_rust_hound', 'e_ember_bat'];
      if (diff === 2) return ['e_slime_ash', 'e_rust_hound', 'e_scrap_sentry', 'e_ember_bat', 'e_slag_brute'];
      if (diff === 3) return ['e_rust_hound', 'e_scrap_sentry', 'e_slag_brute', 'e_ember_bat', 'e_warden_lesser'];
      if (diff === 4) return ['e_scrap_sentry', 'e_slag_brute', 'e_void_stalker', 'e_rune_turret', 'e_warden_lesser'];
      return ['e_void_stalker', 'e_rune_turret', 'e_warden_lesser', 'e_slag_brute', 'e_scrap_sentry'];
    },
    bossFor: function (diff) {
      if (diff <= 2) return 'e_furnace_keeper';
      if (diff <= 4) return 'e_void_sovereign';
      return 'e_dawn_echo';
    }
  };
})(window.G = window.G || {});
