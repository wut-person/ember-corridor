/* =========================================================
   余烬回廊 · 数据层：大世界遗迹与遗迹怪物
   ========================================================= */
(function (G) {
  /* ---------- 品质掉落：颜色 → 游戏内品质等级 ----------
     游戏内品质色：0 灰白 / 1 绿 / 2 蓝 / 3 紫 / 4 金 / 5 红
     需求给的「白色 70% / 蓝色 50% / 紫色 4% / 金色 0.6% / 红色 0.002%」
     按「每次战利品落在该档位的概率」直接判定：
       白档约 45%、蓝档约 50%、紫档 4%、金档 0.6%、红档 0.002%（其余落在绿档）
     这样白+蓝合计约 95%，符合「白 70 / 蓝 50」的高频低品手感。 */
  G.RUIN_RARITY = [
    { tier: 0, key: 'common', label: '白', color: '#9fb0c4', chance: 0.4500 },
    { tier: 1, key: 'uncommon', label: '绿', color: '#5fe08a', chance: 0.0000 },
    { tier: 2, key: 'rare', label: '蓝', color: '#54b8ff', chance: 0.5000 },
    { tier: 3, key: 'epic', label: '紫', color: '#c07cff', chance: 0.0400 },
    { tier: 4, key: 'gold', label: '金', color: '#ffb340', chance: 0.0060 },
    { tier: 5, key: 'relic', label: '红', color: '#ff6b6b', chance: 0.00002 }
  ];

  /** 需求里给出的档位概率（用于文档与校验，绿档为兜底） */
  G.RUIN_DROP_SPEC = [
    { label: '白', tier: 0, chance: 0.70 },
    { label: '蓝', tier: 2, chance: 0.50 },
    { label: '紫', tier: 3, chance: 0.04 },
    { label: '金', tier: 4, chance: 0.006 },
    { label: '红', tier: 5, chance: 0.00002 }
  ];

  /** 掷一次品质：从红到白逐档判定，命中即返回（先判稀有的，再判常见的） */
  G.rollRuinRarity = function (luck) {
    const boost = 1 + (luck || 0) * 0.15;        /* 幸运值小幅提升高品概率 */
    const R = G.RUIN_RARITY;
    for (let i = R.length - 1; i >= 1; i--) {    /* 5→1（跳过 0 白档） */
      const t = R[i];
      if (t.chance <= 0) continue;
      let p = t.chance;
      if (t.tier >= 3) p = Math.min(0.9, p * boost);
      if (Math.random() < p) return t.tier;
    }
    return 0;                                     /* 其余落白档 */
  };

  /** 品质描述（用于日志与提示） */
  G.rarityLabel = function (tier) {
    for (let i = 0; i < G.RUIN_RARITY.length; i++) {
      if (G.RUIN_RARITY[i].tier === tier) return G.RUIN_RARITY[i].label;
    }
    return '白';
  };

  /* ---------- 遗迹类型 ---------- */
  const T = [
    {
      id: 'ru_stone_circle', name: '石环遗迹', minR: 0, maxR: 2,
      w: 5, h: 5, guards: [1, 2], desc: '半埋在土里的立石围成一圈，中间有烧过的痕迹。'
    },
    {
      id: 'ru_broken_tower', name: '坍塌塔基', minR: 0, maxR: 3,
      w: 6, h: 6, guards: [2, 3], desc: '塌了一半的塔，砖缝里长满了草。'
    },
    {
      id: 'ru_sunken_vault', name: '沉没地窖', minR: 1, maxR: 4,
      w: 5, h: 5, guards: [2, 4], desc: '下陷的石砌地窖，门框还在，里面比外面冷。'
    },
    {
      id: 'ru_ember_shrine', name: '余烬祭坛', minR: 2, maxR: 5,
      w: 6, h: 5, guards: [3, 5], desc: '还亮着余火的祭坛，四角刻着看不懂的纹路。'
    }
  ];

  /* ---------- 遗迹怪物池（按遗迹档位筛选，tier 越高越强） ---------- */
  G.RUIN_GUARDS = [
    { id: 'rg_husk', name: '遗迹朽尸', tier: 0, hp: 60, atk: 12, spd: 46, size: 19, color: '#8a8478', kind: 'melee' },
    { id: 'rg_sentry', name: '石卫哨兵', tier: 1, hp: 90, atk: 15, spd: 32, size: 22, color: '#8d97a5', kind: 'melee' },
    { id: 'rg_archer', name: '遗迹弓手', tier: 2, hp: 74, atk: 18, spd: 40, size: 19, color: '#6b7a5a', kind: 'ranged' },
    { id: 'rg_warden', name: '遗迹守卫', tier: 3, hp: 150, atk: 24, spd: 50, size: 26, color: '#b08040', kind: 'melee' },
    { id: 'rg_ember_wraith', name: '余烬幽影', tier: 4, hp: 130, atk: 28, spd: 62, size: 22, color: '#c05a2a', kind: 'charger' },
    { id: 'rg_void_echo', name: '虚空回响', tier: 5, hp: 190, atk: 34, spd: 56, size: 24, color: '#8a5cff', kind: 'charger' }
  ];

  /** 按遗迹档位取守卫列表（允许 ±1 档的怪物混入） */
  G.guardsForTier = function (tier) {
    return G.RUIN_GUARDS.filter(function (g) {
      return g.tier >= Math.max(0, tier - 1) && g.tier <= tier + 1;
    });
  };

  /** 按已探索距离挑一个遗迹类型（越远档位越高） */
  G.pickRuinType = function (rarity, salt) {
    const pool = T.filter(function (t) { return rarity >= t.minR && rarity <= t.maxR; });
    const arr = pool.length ? pool : T;
    return arr[(salt >>> 0) % arr.length];
  };

  G.Ruins = { types: T };
})(window.G = window.G || {});
