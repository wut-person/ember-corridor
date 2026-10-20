/* =========================================================
   余烬回廊 · 数据层：大世界生物（中立 / 善良 / 无攻击）
   ========================================================= */
(function (G) {
  /* 性情（temper）：
       neutral  中立 —— 不主动攻击，被打会还手或逃跑
       friendly 善良 —— 亲近玩家，靠近会跟随（可喂食）
       passive  无攻击 —— 完全无攻击性，见人就跑（鱼只会游开）
       guardian 友善援护 —— 会主动攻击「攻击生物」，保护玩家
                  （参考图里的叶精灵、蓝史莱姆属于这一类） */
  G.TEMPER = {
    neutral:  { key: 'neutral',  label: '中立',   color: '#c9d3e0', mark: '·' },
    friendly: { key: 'friendly', label: '善良',   color: '#5fe08a', mark: '♥' },
    passive:  { key: 'passive',  label: '无攻击', color: '#7fd7ff', mark: '~' },
    guardian: { key: 'guardian', label: '友善援护', color: '#ffd479', mark: '✦' }
  };

  /* 物种：每个都是不同种类，size/hp/spd 与外观参数各不相同
     habitat: land 陆地 / water 水中
     drops:   被击败后掉落（体贴的设计：善良生物掉食物，不掉高级装备） */
  const S = [
    {
      id: 'cr_pig', name: '猪', temper: 'neutral', habitat: 'land',
      hp: 40, spd: 16, size: 20, body: '#e8a0a8', body2: '#f2b8c0', dark: '#c07c88',
      ear: '#d98a96', snout: '#f2a0ac', foot: '#8a5a60',
      drops: [{ id: 'i_meat_raw', w: 3 }, { id: 'i_ember_dust', w: 1 }],
      desc: '圆滚滚的粉猪，拱土找食，被惹到会用鼻子顶人。'
    },
    {
      id: 'cr_cow', name: '牛', temper: 'neutral', habitat: 'land',
      hp: 70, spd: 13, size: 24, body: '#f0ece4', body2: '#ffffff', dark: '#3a332e',
      ear: '#e8dcd0', snout: '#e8a898', foot: '#4a4038', horn: '#d8ccb8',
      drops: [{ id: 'i_meat_raw', w: 4 }, { id: 'i_ember', w: 1 }],
      desc: '黑白花牛，安静地吃草，护崽时会低头冲撞。'
    },
    {
      id: 'cr_sheep', name: '羊', temper: 'friendly', habitat: 'land',
      hp: 45, spd: 15, size: 21, body: '#f6f2ea', body2: '#ffffff', dark: '#8a8478',
      ear: '#e4dcd0', snout: '#d8c8b8', foot: '#5a5048',
      drops: [{ id: 'i_cloth', w: 3 }, { id: 'i_meat_raw', w: 1 }],
      desc: '毛蓬蓬的绵羊，性格温顺，会跟着你走一段路。'
    },
    {
      id: 'cr_chicken', name: '鸡', temper: 'passive', habitat: 'land',
      hp: 18, spd: 24, size: 14, body: '#f6f0e0', body2: '#ffffff', dark: '#d8b840',
      ear: '#e8c850', snout: '#f0a030', foot: '#e8a838', comb: '#d94b3a',
      drops: [{ id: 'i_meat_raw', w: 1 }, { id: 'i_feather', w: 3 }],
      desc: '小跑着啄食的母鸡，一有动静就扑棱着翅膀跑开。'
    },
    {
      id: 'cr_fish', name: '鱼', temper: 'passive', habitat: 'water',
      hp: 12, spd: 30, size: 13, body: '#5fa8d8', body2: '#8fd0f0', dark: '#2f6f9a',
      ear: '#4f90c0', snout: '#c8e8f8', foot: '#3f80b0', fin: '#7fc8e8', tail: '#4f98c8',
      drops: [{ id: 'i_fish_raw', w: 2 }],
      desc: '浅水里游动的鱼，见到人影就摆尾钻进深水。'
    },
    /* ---------- 按参考图新增：善良生物（玩家可攻击） ---------- */
    {
      id: 'cr_deer', name: '梅花鹿', temper: 'friendly', habitat: 'land',
      hp: 55, spd: 34, size: 26, body: '#b06a38', body2: '#c87a44', dark: '#7a4522',
      ear: '#8a5028', snout: '#3a2818', foot: '#4a2e18', horn: '#c9b48a', spot: '#f4ece0',
      drops: [{ id: 'i_meat_raw', w: 3 }, { id: 'i_cloth', w: 2 }, { id: 'i_horn', w: 1 }],
      desc: '带白色斑点的梅花鹿，警觉但温顺，会远远地望着你。'
    },
    {
      id: 'cr_boar', name: '野猪', temper: 'neutral', habitat: 'land',
      hp: 85, spd: 22, size: 25, body: '#4a3828', body2: '#5e4834', dark: '#2a1e14',
      ear: '#3a2c1e', snout: '#c07a78', foot: '#2a1e14', tusk: '#f0e8d0', bristle: '#6e5440',
      drops: [{ id: 'i_meat_raw', w: 5 }, { id: 'i_tusk', w: 1 }, { id: 'i_scrap', w: 1 }],
      desc: '鬃毛竖立的野猪，低头用獠牙拱地找食，被惹到会直接冲过来。'
    },
    {
      id: 'cr_frog', name: '青蛙', temper: 'passive', habitat: 'water',
      hp: 16, spd: 26, size: 15, body: '#6ec03a', body2: '#8ed84f', dark: '#3f7a22',
      ear: '#5aa832', snout: '#d8e8a8', foot: '#4a8a28', eye: '#e8a020',
      drops: [{ id: 'i_meat_raw', w: 1 }, { id: 'i_slime_gel', w: 2 }],
      desc: '蹲在湿泥上的绿青蛙，鼓着大眼睛，一靠近就扑通跳进水里。'
    },
    /* ---------- 按参考图新增：中立·友善援护（会打攻击生物） ---------- */
    {
      id: 'cr_leafkin', name: '叶精灵', temper: 'guardian', habitat: 'land',
      hp: 60, spd: 30, size: 20, body: '#5aa832', body2: '#7ac84a', dark: '#2f6a1a',
      ear: '#4a9a2a', snout: '#8ed84f', foot: '#4a3a22', staff: '#7a5a32',
      atk: 12, reach: 30, atkCd: 1.0, ranged: false, glow: '#d8ff8a',
      drops: [{ id: 'i_leaf_sprout', w: 2 }, { id: 'i_cloth', w: 1 }],
      desc: '披着叶片斗篷的小小精灵，举着木杖。看到攻击生物会主动上前帮忙。'
    },
    {
      id: 'cr_slime_buddy', name: '行囊史莱姆', temper: 'guardian', habitat: 'land',
      hp: 80, spd: 24, size: 19, body: '#5fb8e8', body2: '#8fd8f8', dark: '#2f7aa8',
      ear: '#4aa8d8', snout: '#c8ecff', foot: '#3f90c0', hat: '#c08840', pack: '#8a6a3a',
      atk: 10, reach: 26, atkCd: 1.2, ranged: true, glow: '#bfe8ff',
      drops: [{ id: 'i_slime_gel', w: 3 }, { id: 'i_water', w: 2 }],
      desc: '戴着帽子、背着行囊的蓝色史莱姆，会朝攻击生物吐出水弹帮你。'
    }
  ];

  /* 名字池：每个个体从池里取一个名字，显得有身份 */
  G.CREATURE_NAMES = [
    '小白', '大黄', '团子', '阿花', '点点', '黑豆', '雪球', '斑斑', '咕咕', '圆圆',
    '毛球', '棉花', '豆芽', '小灰', '奶酪', '布丁', '阿黄', '小满', '花卷', '芝麻',
    '胖虎', '银铃', '麦芽', '土豆', '年糕', '阿灰', '小鹿', '糖糖', '露露', '闪电'
  ];

  /* 按地形决定可生成的物种 */
  G.creatureForTerrain = function (terName, salt) {
    const land = ['草地', '草甸', '森林', '沙滩', '岩地'];
    const water = ['浅水', '深水'];
    let pool = null;
    if (water.indexOf(terName) >= 0) pool = S.filter(function (s) { return s.habitat === 'water'; });
    else if (land.indexOf(terName) >= 0) pool = S.filter(function (s) { return s.habitat === 'land'; });
    if (!pool || !pool.length) return null;
    /* 森林里鸡多一点，草甸上牛羊多一点 —— 用 salt 做稳定权重 */
    let pick = pool[(salt >>> 0) % pool.length];
    if (terName === '草地' || terName === '草甸') {
      const grassy = pool.filter(function (s) { return s.id !== 'cr_chicken'; });
      if (grassy.length) pick = grassy[(salt >>> 0) % grassy.length];
    }
    return pick;
  };

  G.Creature = {
    list: S,
    byId: function (id) {
      for (let i = 0; i < S.length; i++) if (S[i].id === id) return S[i];
      return S[0];
    }
  };
})(window.G = window.G || {});
