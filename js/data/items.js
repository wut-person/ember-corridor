/* =========================================================
   余烬回廊 · 数据层：物品 / 消耗品 / 材料 / 货币
   ========================================================= */
(function (G) {
  /* kind: consume 消耗品 | material 材料 | currency 货币 | blueprint 图纸 */
  const I = [
    { id: 'i_ember', kind: 'currency', rarity: 2, name: '余烬币', icon: 'coin', price: 1, stack: 99999,
      desc: '回廊里通用的硬通货，由冷却的余烬压铸而成。', flavor: '“钱不会烧手，但会烧心。”' },
    { id: 'i_relic', kind: 'currency', rarity: 4, name: '回廊遗物', icon: 'relic', price: 300, stack: 999,
      desc: '从深层带回的碎片，可在铁砧处兑换稀有词条。', flavor: '“它是回廊的记忆。”' },

    { id: 'i_potion_s', kind: 'consume', rarity: 0, name: '小回复药剂', icon: 'potion_red', price: 40, stack: 99,
      hp: 45, cd: 4, desc: '立即回复 45 点生命值。战斗中按 F 使用。', flavor: '“苦，但有用。”' },
    { id: 'i_potion_l', kind: 'consume', rarity: 2, name: '浓缩回复剂', icon: 'potion_red_big', price: 130, stack: 99,
      hp: 140, cd: 6, desc: '立即回复 140 点生命值，并清除流血。', flavor: '“一口下去，能听见伤口合上的声音。”' },
    { id: 'i_stamina_draught', kind: 'consume', rarity: 1, name: '疾行药水', icon: 'potion_blue', price: 90, stack: 99,
      stam: 60, cd: 5, desc: '立即回复 60 点体力。', flavor: '“呼吸顺了，刀就快了。”' },
    { id: 'i_ember_flask', kind: 'consume', rarity: 3, name: '余烬烈酒', icon: 'potion_orange', price: 180, stack: 99,
      buff: { id: 'bf_rage', name: '余烬之怒', dur: 14, atk: 0.25, spd: 0.15 },
      desc: '14 秒内攻击力 +25%、攻速 +15%，但防御 -10%。', flavor: '“喝下去，火就从喉咙烧到指尖。”' },
    { id: 'i_iron_skin', kind: 'consume', rarity: 2, name: '石肤药剂', icon: 'potion_green', price: 150, stack: 99,
      buff: { id: 'bf_iron', name: '石肤', dur: 16, dr: 0.35 },
      desc: '16 秒内受到伤害降低 35%。', flavor: '“皮肤会记得石头的倔强。”' },
    { id: 'i_throw_bomb', kind: 'consume', rarity: 2, name: '爆燃瓶', icon: 'bomb', price: 70, stack: 99,
      throw: { dmg: 70, radius: 82 },
      desc: '按 F 投掷：落点造成 70 点范围火焰伤害。', flavor: '“扔出去，别回头。”' },
    { id: 'i_smoke_bomb', kind: 'consume', rarity: 1, name: '烟幕弹', icon: 'smoke', price: 60, stack: 99,
      throw: { dmg: 0, radius: 110, smoke: 3.5 },
      desc: '投掷后生成 3.5 秒烟幕，其中敌人命中率大幅下降。', flavor: '“看不见，就打不中。”' },
    { id: 'i_revive_dust', kind: 'consume', rarity: 5, name: '不灭灰烬', icon: 'ash', price: 900, stack: 5,
      revive: true,
      desc: '被动：死亡时自动复活并回复 50% 生命（每次远征限一次）。', flavor: '“你烧过一次，所以你不怕火。”' },
    { id: 'i_key_rift', kind: 'consume', rarity: 3, name: '裂隙钥匙', icon: 'key', price: 260, stack: 9,
      desc: '开启回廊中的密室，内部必然包含一件稀有以上装备。', flavor: '“门后面是什么，钥匙也不知道。”' },

    { id: 'i_scrap', kind: 'material', rarity: 0, name: '废旧金属', icon: 'scrap', price: 8, stack: 999,
      desc: '强化装备的基础材料，从敌人残骸上拆下。', flavor: '' },
    { id: 'i_ember_dust', kind: 'material', rarity: 1, name: '余烬粉', icon: 'dust', price: 26, stack: 999,
      desc: '强化武器所需的粉末，可提升攻击力词条。', flavor: '' },
    { id: 'i_core_fragment', kind: 'material', rarity: 3, name: '熔核碎片', icon: 'core', price: 120, stack: 999,
      desc: '高阶强化材料，精英敌人掉落。', flavor: '' },
    { id: 'i_void_shard', kind: 'material', rarity: 4, name: '虚空结晶', icon: 'shard', price: 320, stack: 999,
      desc: '来自第四层以下的结晶，可在铁砧处附加虚空词条。', flavor: '' },

    { id: 'i_bp_whirl', kind: 'blueprint', rarity: 3, name: '图纸：回旋斩', icon: 'scroll', price: 420, stack: 9,
      skill: 'sk_whirl', desc: '解锁武器的第二个战技槽位（回旋斩）。', flavor: '' },
    { id: 'i_bp_rain', kind: 'blueprint', rarity: 3, name: '图纸：箭雨', icon: 'scroll', price: 420, stack: 9,
      skill: 'sk_rain', desc: '解锁远程武器的范围战技（箭雨）。', flavor: '' },

    /* --- 生物产物 / 采集物（第 1、2 部分新增） --- */
    { id: 'i_meat_raw', kind: 'material', rarity: 0, name: '生肉', icon: 'meat', price: 12, stack: 999,
      food: 12, desc: '从牲畜身上取得的生肉，可食用（回复少量体力），也能在篝火处烹饪。',
      flavor: '“生的也能吃，只是不太体面。”' },
    { id: 'i_fish_raw', kind: 'material', rarity: 0, name: '生鱼', icon: 'fish', price: 14, stack: 999,
      food: 10, desc: '浅水里捕到的鱼，生吃回复体力，烤过更好。', flavor: '“水里来的，总带点凉气。”' },
    { id: 'i_cloth', kind: 'material', rarity: 1, name: '毛料', icon: 'cloth', price: 22, stack: 999,
      desc: '从绵羊身上剪下的毛料，可用于缝制与强化衣物。', flavor: '' },
    { id: 'i_feather', kind: 'material', rarity: 0, name: '羽毛', icon: 'feather', price: 8, stack: 999,
      desc: '轻而韧的羽毛，是箭矢与轻甲衬垫的材料。', flavor: '' },
    { id: 'i_wood', kind: 'material', rarity: 0, name: '木头', icon: 'wood', price: 6, stack: 999,
      desc: '砍伐树木得到的木材，建造与制作的基础材料。', flavor: '' },
    { id: 'i_sand', kind: 'material', rarity: 0, name: '沙子', icon: 'sand', price: 4, stack: 999,
      desc: '从沙滩挖起的细沙，可烧制玻璃、填埋坑洼。', flavor: '' },
    { id: 'i_water', kind: 'material', rarity: 0, name: '水袋', icon: 'water', price: 5, stack: 999,
      drink: 14, desc: '装进皮袋的清水，饮用回复体力，也能浇灌作物。', flavor: '' },
    { id: 'i_stone', kind: 'material', rarity: 0, name: '石块', icon: 'stone', price: 7, stack: 999,
      desc: '敲碎岩地得到的石块，建造与制作材料。', flavor: '' },
    /* ---------- 按参考图新增生物对应的掉落物 ---------- */
    { id: 'i_horn', kind: 'material', rarity: 2, name: '鹿角', icon: 'horn', price: 46, stack: 999,
      desc: '完整的鹿角，可做弓臂与饰品，也有炼金用途。', flavor: '' },
    { id: 'i_tusk', kind: 'material', rarity: 2, name: '野猪獠牙', icon: 'tusk', price: 52, stack: 999,
      desc: '坚硬弯曲的獠牙，是打造匕首与护符的好材料。', flavor: '' },
    { id: 'i_slime_gel', kind: 'material', rarity: 1, name: '黏液凝胶', icon: 'gel', price: 22, stack: 999,
      desc: '半透明的弹性凝胶，黏合力极强，可制作药剂与胶水。', flavor: '' },
    { id: 'i_leaf_sprout', kind: 'material', rarity: 1, name: '嫩叶幼芽', icon: 'sprout', price: 26, stack: 999,
      desc: '带着晨露的嫩芽，据说种下去能长出一小片绿荫。', flavor: '' }
  ];

  const byId = {};
  I.forEach(function (i) { byId[i.id] = i; });

  /* 掉落权重表：普通怪 / 精英 / 首领 */
  G.DROP_TABLES = {
    normal: [
      { id: 'i_scrap', w: 34, min: 1, max: 3 },
      { id: 'i_ember', w: 30, min: 6, max: 18 },
      { id: 'i_ember_dust', w: 12, min: 1, max: 2 },
      { id: 'i_potion_s', w: 12, min: 1, max: 1 },
      { id: 'i_stamina_draught', w: 5, min: 1, max: 1 },
      { id: 'i_throw_bomb', w: 4, min: 1, max: 1 },
      { id: 'i_core_fragment', w: 2, min: 1, max: 1 },
      { id: 'i_void_shard', w: 1, min: 1, max: 1 }
    ],
    elite: [
      { id: 'i_ember', w: 26, min: 40, max: 90 },
      { id: 'i_core_fragment', w: 22, min: 1, max: 3 },
      { id: 'i_potion_l', w: 14, min: 1, max: 2 },
      { id: 'i_ember_dust', w: 12, min: 3, max: 6 },
      { id: 'i_ember_flask', w: 10, min: 1, max: 1 },
      { id: 'i_key_rift', w: 8, min: 1, max: 1 },
      { id: 'i_void_shard', w: 6, min: 1, max: 2 },
      { id: 'i_relic', w: 2, min: 1, max: 1 }
    ],
    boss: [
      { id: 'i_ember', w: 24, min: 180, max: 320 },
      { id: 'i_relic', w: 18, min: 2, max: 5 },
      { id: 'i_void_shard', w: 18, min: 2, max: 4 },
      { id: 'i_core_fragment', w: 14, min: 3, max: 6 },
      { id: 'i_potion_l', w: 10, min: 3, max: 5 },
      { id: 'i_iron_skin', w: 8, min: 1, max: 2 },
      { id: 'i_revive_dust', w: 4, min: 1, max: 1 },
      { id: 'i_bp_whirl', w: 4, min: 1, max: 1 }
    ]
  };

  G.Items = {
    list: I,
    get: function (id) { return byId[id] || null; },
    name: function (id) { const it = byId[id]; return it ? it.name : id; },
    /** 按权重抽取掉落 */
    rollDrop: function (tableId, luck) {
      const table = G.DROP_TABLES[tableId] || G.DROP_TABLES.normal;
      const lk = 1 + (luck || 0);
      let total = 0;
      for (let i = 0; i < table.length; i++) total += (table[i].w + (table[i].id === 'i_ember' ? 0 : lk * 1.2));
      let r = Math.random() * total;
      for (let i = 0; i < table.length; i++) {
        const w = table[i].w + (table[i].id === 'i_ember' ? 0 : lk * 1.2);
        r -= w;
        if (r <= 0) {
          const e = table[i];
          const n = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
          return { id: e.id, count: n };
        }
      }
      return { id: 'i_ember', count: 5 };
    },
    /** 商店库存（按玩家等级生成） */
    shopStock: function (lvl) {
      const out = [];
      const picks = [
        'i_potion_s', 'i_potion_l', 'i_stamina_draught', 'i_throw_bomb', 'i_smoke_bomb',
        'i_iron_skin', 'i_ember_flask', 'i_key_rift', 'i_revive_dust', 'i_bp_whirl', 'i_bp_rain'
      ];
      picks.forEach(function (id) {
        const it = byId[id];
        if (!it) return;
        out.push({ kind: 'item', id: id, price: it.price, stock: it.kind === 'blueprint' ? 1 : 8 });
      });
      // 随机 3 件武器 + 3 件衣物
      for (let i = 0; i < 3; i++) {
        const w = G.Weapons.roll(lvl, 'shop');
        out.push({ kind: 'weapon', data: w, price: Math.round(120 + w.atk * 12 + w.rarity * 90), stock: 1 });
      }
      const slots = ['head', 'body', 'legs', 'cloak'];
      for (let i = 0; i < 3; i++) {
        const c = G.Clothing.roll(slots[Math.floor(Math.random() * slots.length)], lvl);
        out.push({ kind: 'cloth', data: c, price: Math.round(90 + (c.def + (c.hp || 0) / 2) * 6 + c.rarity * 80), stock: 1 });
      }
      return out;
    }
  };
})(window.G = window.G || {});
