/* =========================================================
   余烬回廊 · 数据层：大世界可破坏资源（木头 / 沙子 / 水 / 石块）
   ========================================================= */
(function (G) {
  /* 资源定义
     hits   需要打几下才破坏
     drops  掉落（每次破坏结算一次，amount 为 [最少, 最多]）
     need   是否需要工具（当前版本不限制，仅做数据保留）
     shake  受击抖动幅度 */
  G.RESOURCES = {
    tree:  { id: 'tree',  name: '树木',   hits: 3, shake: 2.2,
             drops: [{ id: 'i_wood', min: 2, max: 4 }, { id: 'i_feather', min: 0, max: 1 }],
             verb: '砍伐' },
    pine:  { id: 'pine',  name: '松树',   hits: 3, shake: 2.2,
             drops: [{ id: 'i_wood', min: 2, max: 5 }],
             verb: '砍伐' },
    bush:  { id: 'bush',  name: '灌木',   hits: 2, shake: 1.6,
             drops: [{ id: 'i_wood', min: 1, max: 2 }, { id: 'i_cloth', min: 0, max: 1 }],
             verb: '采集' },
    rock:  { id: 'rock',  name: '岩石',   hits: 4, shake: 1.8,
             drops: [{ id: 'i_stone', min: 2, max: 4 }, { id: 'i_scrap', min: 0, max: 1 }],
             verb: '开采' },
    /* 地形类资源：不是 prop，直接按 tile 采集（可无限采，但每次有冷却） */
    sand:  { id: 'sand',  name: '沙地',   hits: 2, shake: 1.2, tile: true,
             drops: [{ id: 'i_sand', min: 1, max: 3 }],
             verb: '挖掘' },
    water: { id: 'water', name: '水源',   hits: 2, shake: 0.8, tile: true,
             drops: [{ id: 'i_water', min: 1, max: 2 }],
             verb: '取水' }
  };

  /* 地形名 → 可采集的资源 id（只有沙地 / 浅水 / 深水可直接采） */
  G.resourceForTerrain = function (terName) {
    if (terName === '沙滩') return 'sand';
    if (terName === '浅水' || terName === '深水') return 'water';
    return null;
  };

  /* 一次破坏结算掉落，返回 [{id, count}] */
  G.rollResourceDrops = function (resId) {
    const r = G.RESOURCES[resId];
    if (!r) return [];
    const out = [];
    r.drops.forEach(function (d) {
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) out.push({ id: d.id, count: n });
    });
    return out;
  };
})(window.G = window.G || {});
