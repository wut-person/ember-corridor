/* =========================================================
   余烬回廊 · 数据层：衣物 / 角色外观 / 场景互动
   ========================================================= */
(function (G) {
  /* 装备槽位 */
  G.SLOTS = [
    { id: 'head', label: '头盔', icon: '🪖' },
    { id: 'body', label: '胸甲', icon: '🛡️' },
    { id: 'legs', label: '腿甲', icon: '🦿' },
    { id: 'cloak', label: '披风', icon: '🧣' }
  ];

  /* 衣物属性：def 防御 / hp 生命 / stam 体力 / spd 移速% / crit 暴击% */
  const C = [
    /* --- 头盔 --- */
    { id: 'h_cloth_hood', slot: 'head', name: '粗布兜帽', rarity: 0, lvl: 1, def: 3, hp: 8, stam: 4, spd: 1, crit: 0,
      look: { hat: 'hood', tone: '#6b6152' }, desc: '矿工常戴的粗布兜帽，只能挡住落灰。', flavor: '“新人都以为戴上它就安全了。”' },
    { id: 'h_iron_helm', slot: 'head', name: '铁卫头盔', rarity: 1, lvl: 4, def: 9, hp: 18, stam: 0, spd: -1, crit: 0,
      look: { hat: 'helm', tone: '#8d97a5' }, desc: '标准制式头盔，面罩上有两道横缝。', flavor: '“铁的承诺，比人的可靠。”' },
    { id: 'h_ranger_hood', slot: 'head', name: '游侠兜帽', rarity: 2, lvl: 8, def: 6, hp: 12, stam: 8, spd: 3, crit: 3,
      look: { hat: 'hood', tone: '#3f6b5a' }, desc: '浸过树脂的深绿兜帽，静音且不反光。', flavor: '“看不见的敌人，才是好敌人。”' },
    { id: 'h_dawn_crown', slot: 'head', name: '破晓冠冕', rarity: 4, lvl: 18, def: 14, hp: 34, stam: 10, spd: 2, crit: 6,
      look: { hat: 'crown', tone: '#f6c667' }, desc: '金环上嵌着三块会自己发亮的碎晶。', flavor: '“戴上它，你就是别人的清晨。”' },

    /* --- 胸甲 --- */
    { id: 'b_leather_vest', slot: 'body', name: '皮革背心', rarity: 0, lvl: 1, def: 5, hp: 14, stam: 5, spd: 2, crit: 1,
      look: { tone: '#7a5230' }, desc: '硝制过的厚皮背心，能挡住第一刀的浅伤。', flavor: '“便宜、耐穿、会开裂。”' },
    { id: 'b_iron_plate', slot: 'body', name: '铁鳞胸甲', rarity: 1, lvl: 5, def: 16, hp: 30, stam: -2, spd: -2, crit: 0,
      look: { tone: '#98a3b0' }, desc: '层层叠压的铁鳞，正面几乎无死角。', flavor: '“重量是它唯一的缺点。”' },
    { id: 'b_ember_mail', slot: 'body', name: '余烬链甲', rarity: 2, lvl: 9, def: 22, hp: 44, stam: 6, spd: 0, crit: 2,
      look: { tone: '#8a4a26' }, desc: '环扣间穿过余烬丝，受击时溅出火星。', flavor: '“被烧过的铁，比冷水淬过的更听话。”' },
    { id: 'b_shadow_coat', slot: 'body', name: '影行外套', rarity: 3, lvl: 14, def: 20, hp: 52, stam: 12, spd: 6, crit: 8,
      look: { tone: '#3b3350' }, desc: '内衬是吸光的黑绒，移动时几乎没有声响。', flavor: '“影子不会替你挡刀，但会替你藏住动作。”' },
    { id: 'b_void_carapace', slot: 'body', name: '虚空甲壳', rarity: 4, lvl: 20, def: 38, hp: 96, stam: 16, spd: -1, crit: 5,
      look: { tone: '#5b3fa0' }, desc: '从虚空生物身上剥离的甲壳，会缓慢自我修复。', flavor: '“穿它的人偶尔会梦见回廊的尽头。”' },

    /* --- 腿甲 --- */
    { id: 'l_cloth_pants', slot: 'legs', name: '粗布长裤', rarity: 0, lvl: 1, def: 3, hp: 8, stam: 6, spd: 2, crit: 0,
      look: { tone: '#4a5568' }, desc: '绑腿式长裤，行动方便。', flavor: '“跑得快，就不用挡。”' },
    { id: 'l_iron_greaves', slot: 'legs', name: '铁靴护腿', rarity: 1, lvl: 5, def: 11, hp: 20, stam: 2, spd: -2, crit: 0,
      look: { tone: '#8d97a5' }, desc: '厚铁片护住胫骨，踢击时也很有力。', flavor: '“站稳，才有下一刀。”' },
    { id: 'l_swift_leggings', slot: 'legs', name: '疾风护腿', rarity: 2, lvl: 10, def: 9, hp: 18, stam: 14, spd: 8, crit: 3,
      look: { tone: '#2f6f8f' }, desc: '内嵌风纹的轻甲护腿，落地缓冲极佳。', flavor: '“风是走出来的。”' },
    { id: 'l_titan_greaves', slot: 'legs', name: '泰坦重靴', rarity: 3, lvl: 16, def: 26, hp: 58, stam: 6, spd: -3, crit: 4,
      look: { tone: '#6d5a3a' }, desc: '沉得像锚的护腿，踩在地上会留下凹痕。', flavor: '“它让你不会被推走，也让你不会被追上。”' },

    /* --- 披风 --- */
    { id: 'c_linen_cape', slot: 'cloak', name: '亚麻短披', rarity: 0, lvl: 1, def: 2, hp: 6, stam: 3, spd: 1, crit: 0,
      look: { tone: '#8c6b4f' }, desc: '一块洗得发白的亚麻布。', flavor: '“披风的作用，一半是保暖，一半是体面。”' },
    { id: 'c_ember_cloak', slot: 'cloak', name: '余烬披风', rarity: 2, lvl: 9, def: 8, hp: 24, stam: 6, spd: 2, crit: 4,
      look: { tone: '#b8451c' }, desc: '边缘永远在燃烧却烧不坏的披风。', flavor: '“火认识自己的主人。”' },
    { id: 'c_storm_shroud', slot: 'cloak', name: '风雷罩袍', rarity: 3, lvl: 15, def: 12, hp: 30, stam: 12, spd: 5, crit: 6,
      look: { tone: '#3a6fa0' }, desc: '布料里织着雷纹，移动时噼啪作响。', flavor: '“别在雨天穿它出门。”' },
    { id: 'c_void_veil', slot: 'cloak', name: '虚空帷幔', rarity: 5, lvl: 22, def: 18, hp: 48, stam: 18, spd: 6, crit: 10,
      look: { tone: '#7b4fd0' }, desc: '披风内侧是一片深邃的星野，看久了会头晕。', flavor: '“你披着的，是一小块什么都没有。”' }
  ];

  const cById = {};
  C.forEach(function (c) { cById[c.id] = c; });

  /* 角色外观预设（登录 / 角色页可切换）
     8 个角色 = 4 职业 × 2 性别，逐一对齐两张参考图：
       男性版（第一张）：剑士 / 游侠 / 法师 / 骑士
       女性版（第二张）：露腰束胸 + 短裙 + 大腿靴 + 长发
     gender: m / f ；cls: 职业（用于配对切换性别） */
  const SHARED_FEAT = { pauldron: 1, chestSeam: 1 };

  /* 女性版公共配色（四人共用一套深色调，靠 accent / 职业色区分） */
  const F_SKIN = '#e8b48c';

  G.LOOKS = [
    /* ================= 男 · 剑士 ================= */
    {
      id: 'lk_a', name: '余烬剑士', gender: 'm', cls: 'blade',
      build: 'broad', hairStyle: 'short',
      skin: '#e8b083', hair: '#6b3a1e', eye: '#d8c8b8',
      base: '#5a6270', cloth: '#7a5230', accent: '#8d97a5',
      title: '初火 · 剑士', quote: '“我只需要一次机会，和一把还能用的剑。”',
      detail: {
        beard: 0, cape: 0, capeTone: '#5a3a22', capeTrim: '#7a5230', hood: false,
        chestTop: '#5b636f', chestTopLight: '#77808d', chestPlate: '#4a5568',
        strap: '#8a6a3a', strapLight: '#a8843f',
        bracers: '#3a3f48', bracersLight: '#565c66',
        belt: '#4a3222', beltBuckle: '#e8b93c',
        bottom: '#2f3540', boots: '#2a1c14', bootsTrim: '#4a3226',
        thighArmor: '#4a5464', hipWeapon: false, bow: false,
        feat: Object.assign({ angry: 1 }, SHARED_FEAT)
      }
    },
    /* ================= 男 · 游侠 ================= */
    {
      id: 'lk_b', name: '铁壁游侠', gender: 'm', cls: 'ranger',
      build: 'broad', hairStyle: 'short',
      skin: '#d99a68', hair: '#3a2416', eye: '#f0d8b8',
      base: '#4a3a2a', cloth: '#6b4526', accent: '#c9a24a',
      title: '铁壁 · 游侠', quote: '“风会带走脚印，也会带走尸体。”',
      detail: {
        beard: 1, beardTone: '#241609', cape: 2, capeTone: '#5a3a20', capeTrim: '#7a4f28', hood: false,
        chestTop: '#3b2f22', chestTopLight: '#5a4732', chestPlate: '#3b2f22',
        strap: '#6b4526', strapLight: '#8a5c33',
        bracers: '#4a3320', bracersLight: '#6b4a2c',
        belt: '#4a3222', beltBuckle: '#c9a24a',
        bottom: '#3a3226', boots: '#3a2a1c', bootsTrim: '#5a4030',
        thighArmor: '#4a3a28', hipWeapon: false, bow: true,
        feat: Object.assign({ wideHat: 1 }, SHARED_FEAT)
      }
    },
    /* ================= 男 · 法师 ================= */
    {
      id: 'lk_c', name: '虚空秘术', gender: 'm', cls: 'mage',
      build: 'broad', hairStyle: 'short',
      skin: '#e0b090', hair: '#5a3a24', eye: '#d9a8ff',
      base: '#3a2a5a', cloth: '#5a3f96', accent: '#a06cff',
      title: '虚空 · 秘术', quote: '“法典翻到最后一页时，回廊就该结束了。”',
      detail: {
        beard: 1, beardTone: '#3a2418', cape: 0, capeTone: '#4a3a7a', capeTrim: '#6b4faa', hood: false,
        chestTop: '#3f2f66', chestTopLight: '#5f4a9a', chestPlate: '#3f2f66',
        strap: '#8a5fd0', strapLight: '#a87ce8',
        bracers: '#3a2a5a', bracersLight: '#5a3f96',
        belt: '#3a2a4a', beltBuckle: '#d9a84a',
        bottom: '#4a3474', boots: '#2f2246', bootsTrim: '#6b4faa',
        thighArmor: '#4a3474', hipWeapon: false, bow: false,
        feat: { halo: 1, staff: 1, glowingEyes: 1, pauldron: 1, chestSeam: 1 }
      }
    },
    /* ================= 男 · 骑士 ================= */
    {
      id: 'lk_d', name: '金穗骑士', gender: 'm', cls: 'knight',
      build: 'broad', hairStyle: 'short',
      skin: '#d9a878', hair: '#6b5230', eye: '#ffd479',
      base: '#5a6270', cloth: '#8a7a52', accent: '#f6c667',
      title: '黎明 · 骑士', quote: '“天亮之前，我站在这儿。”',
      detail: {
        beard: 1, beardTone: '#4a3a28', cape: 0, capeTone: '#5a5a62', capeTrim: '#8a8a92', hood: false,
        chestTop: '#5f6875', chestTopLight: '#8a94a2', chestPlate: '#5f6875',
        strap: '#6b5a3a', strapLight: '#8a7a52',
        bracers: '#5a6270', bracersLight: '#8a94a2',
        belt: '#4a4030', beltBuckle: '#f6c667',
        bottom: '#565e6b', boots: '#3a4048', bootsTrim: '#6a7280',
        thighArmor: '#6a7482', hipWeapon: false, bow: false,
        feat: Object.assign({ fullHelm: 1, shield: 1, angry: 1 }, SHARED_FEAT)
      }
    },

    /* ================= 女 · 剑士 ================= */
    {
      id: 'lk_a_f', name: '余烬剑姬', gender: 'f', cls: 'blade',
      height: 1.08, build: 'slim', hairStyle: 'long', female: 1,
      skin: F_SKIN, hair: '#5a2f16', eye: '#8a5a38',
      base: '#3a4150', cloth: '#6b4a30', accent: '#8d97a5',
      title: '初火 · 剑姬', quote: '“我只需要一次机会，和一把还能用的剑。”',
      detail: {
        beard: 0, cape: 0, capeTone: '#5a3a22', capeTrim: '#7a5230', hood: false,
        chestTop: '#3a4150', chestTopLight: '#5a6474', chestPlate: '#3a4150',
        strap: '#4a3020', strapLight: '#6b4a30',
        bracers: '#2f3540', bracersLight: '#4a5464',
        belt: '#3a2a1c', beltBuckle: '#e8b93c',
        bottom: '#2a3038', boots: '#5a3a24', bootsTrim: '#7a5230',
        thighArmor: '#3a4150', hipWeapon: true, bow: false,
        feat: { bareMidriff: 1, corset: 1, miniSkirt: 1, thighBoots: 1, longBoots: 1, pauldron: 1, chestSeam: 0 }
      }
    },
    /* ================= 女 · 游侠 ================= */
    {
      id: 'lk_b_f', name: '铁壁游侠（女）', gender: 'f', cls: 'ranger',
      height: 1.08, build: 'slim', hairStyle: 'long', female: 1,
      skin: F_SKIN, hair: '#3a2416', eye: '#f0d8b8',
      base: '#4a3a2a', cloth: '#6b4526', accent: '#c9a24a',
      title: '铁壁 · 游侠', quote: '“风会带走脚印，也会带走尸体。”',
      detail: {
        beard: 0, cape: 2, capeTone: '#5a3a20', capeTrim: '#7a4f28', hood: false,
        chestTop: '#4a3a2a', chestTopLight: '#6b5236', chestPlate: '#4a3a2a',
        strap: '#6b4526', strapLight: '#8a5c33',
        bracers: '#4a3320', bracersLight: '#6b4a2c',
        belt: '#4a3222', beltBuckle: '#c9a24a',
        bottom: '#5a4030', boots: '#5a3a24', bootsTrim: '#7a5230',
        thighArmor: '#4a3a28', hipWeapon: false, bow: true,
        feat: { bareMidriff: 1, corset: 1, miniSkirt: 1, thighBoots: 1, longBoots: 1, pauldron: 1, chestSeam: 0 }
      }
    },
    /* ================= 女 · 法师 ================= */
    {
      id: 'lk_c_f', name: '虚空秘术（女）', gender: 'f', cls: 'mage',
      height: 1.08, build: 'slim', hairStyle: 'long', female: 1,
      skin: F_SKIN, hair: '#7a4fd0', eye: '#d9a8ff',
      base: '#3a2a5a', cloth: '#5a3f96', accent: '#a06cff',
      title: '虚空 · 秘术', quote: '“法典翻到最后一页时，回廊就该结束了。”',
      detail: {
        beard: 0, cape: 0, capeTone: '#4a3a7a', capeTrim: '#6b4faa', hood: false,
        chestTop: '#3f2f66', chestTopLight: '#5f4a9a', chestPlate: '#3f2f66',
        strap: '#8a5fd0', strapLight: '#a87ce8',
        bracers: '#3a2a5a', bracersLight: '#5a3f96',
        belt: '#3a2a4a', beltBuckle: '#d9a84a',
        bottom: '#3f2f66', boots: '#4a3474', bootsTrim: '#7a5fc0',
        thighArmor: '#3f2f66', hipWeapon: false, bow: false,
        feat: { halo: 1, staff: 1, glowingEyes: 1, bareMidriff: 1, corset: 1, miniSkirt: 1,
                thighBoots: 1, longBoots: 1, pauldron: 1, chestSeam: 0 }
      }
    },
    /* ================= 女 · 骑士 ================= */
    {
      id: 'lk_d_f', name: '金穗骑士（女）', gender: 'f', cls: 'knight',
      height: 1.08, build: 'slim', hairStyle: 'long', female: 1,
      skin: F_SKIN, hair: '#6b5230', eye: '#ffd479',
      base: '#5a6270', cloth: '#8a7a52', accent: '#f6c667',
      title: '黎明 · 骑士', quote: '“天亮之前，我站在这儿。”',
      detail: {
        beard: 0, cape: 0, capeTone: '#5a5a62', capeTrim: '#8a8a92', hood: false,
        chestTop: '#5f6875', chestTopLight: '#8a94a2', chestPlate: '#5f6875',
        strap: '#6b5a3a', strapLight: '#8a7a52',
        bracers: '#5a6270', bracersLight: '#8a94a2',
        belt: '#4a4030', beltBuckle: '#f6c667',
        bottom: '#3f4652', boots: '#5a6270', bootsTrim: '#8a94a2',
        thighArmor: '#5f6875', hipWeapon: false, bow: false,
        feat: { shield: 1, bareMidriff: 1, corset: 1, miniSkirt: 1, thighBoots: 1,
                longBoots: 1, pauldron: 1, chestSeam: 0 }
      }
    }
  ];
  G.getLook = function (id) {
    for (let i = 0; i < G.LOOKS.length; i++) if (G.LOOKS[i].id === id) return G.LOOKS[i];
    return G.LOOKS[0];
  };
  /* 取同一职业的另一个性别（性别切换按钮用） */
  G.pairLook = function (id) {
    const cur = G.getLook(id);
    for (let i = 0; i < G.LOOKS.length; i++) {
      const l = G.LOOKS[i];
      if (l.cls === cur.cls && l.gender !== cur.gender) return l;
    }
    return cur;
  };
  /* 按性别筛选外观 */
  G.looksOf = function (gender) {
    if (!gender || gender === 'all') return G.LOOKS.slice();
    return G.LOOKS.filter(function (l) { return l.gender === gender; });
  };

  /* ============ 场景互动 ============ */
  /* 大厅（营地）互动点 */
  G.HUB_SPOTS = [
    { id: 'board', icon: '📜', name: '任务板', desc: '接取 / 追踪任务，领取奖励', screen: 'quests', x: 16, y: 62 },
    { id: 'forge', icon: '⚒️', name: '铁砧', desc: '强化武器与防具、镶嵌词条', screen: 'mods', x: 40, y: 70 },
    { id: 'chest', icon: '🎒', name: '补给箱', desc: '打开背包，更换装备与武器', screen: 'inventory', x: 63, y: 66 },
    { id: 'mirror', icon: '🪞', name: '试衣镜', desc: '查看角色属性与衣物外观', screen: 'character', x: 82, y: 73 },
    { id: 'fire', icon: '🔥', name: '篝火', desc: '恢复状态，查看本次远征的增益', action: 'rest', x: 35, y: 80 },
    { id: 'gate', icon: '🚪', name: '回廊之门', desc: '进入关卡选择，开始远征', screen: 'stages', x: 27, y: 55 }
  ];

  /* 关卡（远征层数） */
  G.STAGES = [
    { id: 'st1', name: '第一层 · 灰烬矿道', sub: 'EMBER SHAFT', diff: 1, rooms: 3, lvlReq: 1, boss: false,
      desc: '被遗弃的矿道，岩壁上还残留着冷却的余烬。适合热身。',
      mods: ['敌人数量较少', '无环境危害'] },
    { id: 'st2', name: '第二层 · 锈蚀水道', sub: 'RUSTED FLUME', diff: 2, rooms: 4, lvlReq: 4, boss: false,
      desc: '铁锈色的水流漫过脚踝，机械残骸仍在无意义地运转。',
      mods: ['出现远程敌人', '地面偶有蒸汽喷口'] },
    { id: 'st3', name: '第三层 · 熔核熔炉', sub: 'CORE FURNACE', diff: 3, rooms: 4, lvlReq: 8, boss: true,
      desc: '整层都在燃烧，熔岩沟把平台切成孤岛。守门者在此。',
      mods: ['熔岩地形伤害', '精英敌人 +1', '层尾首领'] },
    { id: 'st4', name: '第四层 · 虚空回廊', sub: 'VOID CORRIDOR', diff: 4, rooms: 5, lvlReq: 13, boss: true,
      desc: '空间在这里折叠，走廊尽头能看见自己的背影。',
      mods: ['敌人获得虚空护盾', '重力异常', '层尾首领'] },
    { id: 'st5', name: '第五层 · 破晓之顶', sub: 'DAWN APEX', diff: 5, rooms: 5, lvlReq: 19, boss: true,
      desc: '回廊的最后一层，也是第一缕火升起的地方。',
      mods: ['全程精英', '双首领', '掉落传说装备'] }
  ];

  /* 营地增益（篝火） */
  G.REST_BUFFS = [
    { id: 'rb_hp', name: '温热的汤', desc: '本次远征最大生命 +15%', icon: '🍲' },
    { id: 'rb_crit', name: '磨刀石', desc: '本次远征暴击率 +8%', icon: '🪨' },
    { id: 'rb_spd', name: '轻装诀窍', desc: '本次远征移速 +12%', icon: '👟' }
  ];

  G.Clothing = {
    list: C,
    get: function (id) { return cById[id] || null; },
    bySlot: function (slot) { return C.filter(function (c) { return c.slot === slot; }); },
    roll: function (slot, playerLvl) {
      const pool = C.filter(function (c) { return c.slot === slot && c.lvl <= (playerLvl || 1) + 5; });
      const src = pool.length ? pool : G.Clothing.bySlot(slot);
      return JSON.parse(JSON.stringify(src[Math.floor(Math.random() * src.length)]));
    }
  };
})(window.G = window.G || {});
