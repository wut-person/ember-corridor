/* =========================================================
   余烬回廊 · 数据层：任务系统
   kind: main 主线 / side 支线 / daily 日常 / bounty 悬赏
   target.type: kill 击杀 / elite 精英 / boss 首领 / room 清房 / stage 通层 / collect 收集 / useWeapon 使用武器
   ========================================================= */
(function (G) {
  const Q = [
    /* ---------------- 主线 ---------------- */
    {
      id: 'q_m1', kind: 'main', name: '回廊的第一道门', icon: '🚪', lvlReq: 1,
      desc: '深入灰烬矿道，清空任意一个房间，证明你还能站着回来。',
      target: { type: 'room', count: 1 }, reward: { exp: 120, ember: 200, items: [{ id: 'i_potion_s', count: 3 }] },
      chapter: '第一章 · 初火', repeat: false
    },
    {
      id: 'q_m2', kind: 'main', name: '锈齿的威胁', icon: '🐕', lvlReq: 3,
      desc: '锈齿猎犬成群猎食，先解决掉 6 只，让通道安静下来。',
      target: { type: 'kill', enemy: 'e_rust_hound', count: 6 }, reward: { exp: 200, ember: 320, items: [{ id: 'i_ember_dust', count: 4 }] },
      chapter: '第一章 · 初火', repeat: false
    },
    {
      id: 'q_m3', kind: 'main', name: '熔炉的守门者', icon: '🔥', lvlReq: 8,
      desc: '第三层尽头，熔炉守门者在等你。击败它，拿走它胸口的熔核。',
      target: { type: 'boss', count: 1 }, reward: { exp: 460, ember: 800, items: [{ id: 'i_core_fragment', count: 5 }, { id: 'i_potion_l', count: 3 }] },
      chapter: '第二章 · 熔核', repeat: false
    },
    {
      id: 'q_m4', kind: 'main', name: '折叠的走廊', icon: '🌀', lvlReq: 13,
      desc: '在虚空回廊中击败 8 只虚空潜行者，它们的突袭方式会教你怎么闪避。',
      target: { type: 'kill', enemy: 'e_void_stalker', count: 8 }, reward: { exp: 620, ember: 1100, items: [{ id: 'i_void_shard', count: 3 }] },
      chapter: '第三章 · 虚空', repeat: false
    },
    {
      id: 'q_m5', kind: 'main', name: '破晓之前', icon: '🌅', lvlReq: 19,
      desc: '抵达第五层并击败破晓之回声，结束这段回廊。',
      target: { type: 'boss', count: 2 }, reward: { exp: 1200, ember: 2400, items: [{ id: 'i_revive_dust', count: 1 }, { id: 'i_relic', count: 3 }] },
      chapter: '终章 · 破晓', repeat: false
    },

    /* ---------------- 支线 ---------------- */
    {
      id: 'q_s1', kind: 'side', name: '废料回收', icon: '🔩', lvlReq: 1,
      desc: '铁砧的工匠需要废旧金属。带回 12 份。',
      target: { type: 'collect', item: 'i_scrap', count: 12 }, reward: { exp: 150, ember: 260, items: [{ id: 'i_scrap', count: 6 }] },
      chapter: '铁匠的委托', repeat: true, collectItem: 'i_scrap'
    },
    {
      id: 'q_s2', kind: 'side', name: '猎犬克星', icon: '🦴', lvlReq: 4,
      desc: '在任意层数击杀 10 只锈齿猎犬，工匠会给你更好的磨刀石。',
      target: { type: 'kill', enemy: 'e_rust_hound', count: 10 }, reward: { exp: 220, ember: 300, items: [{ id: 'i_ember_dust', count: 5 }] },
      chapter: '铁匠的委托', repeat: true
    },
    {
      id: 'q_s3', kind: 'side', name: '拳头的尊严', icon: '🥊', lvlReq: 10,
      desc: '使用「拳套」类武器击杀 12 名敌人，证明速度也是一种重量。',
      target: { type: 'useWeapon', wtype: 'gauntlet', count: 12 }, reward: { exp: 300, ember: 420, items: [{ id: 'i_iron_skin', count: 2 }] },
      chapter: '武技试炼', repeat: true
    },
    {
      id: 'q_s4', kind: 'side', name: '远程压制', icon: '🏹', lvlReq: 6,
      desc: '使用「弓」或「弩」类武器击杀 15 名敌人。',
      target: { type: 'useWeapon', wtype: 'range', count: 15 }, reward: { exp: 320, ember: 460, items: [{ id: 'i_ember_flask', count: 2 }] },
      chapter: '武技试炼', repeat: true
    },
    {
      id: 'q_s5', kind: 'side', name: '精英标本', icon: '💀', lvlReq: 7,
      desc: '击杀 5 名精英敌人，收集它们身上的词缀残片。',
      target: { type: 'elite', count: 5 }, reward: { exp: 360, ember: 520, items: [{ id: 'i_core_fragment', count: 3 }, { id: 'i_key_rift', count: 1 }] },
      chapter: '猎人笔记', repeat: true
    },
    {
      id: 'q_s6', kind: 'side', name: '清理锈蚀水道', icon: '🚿', lvlReq: 5,
      desc: '通关第二层一次，把水道里的机械残骸全部砸停。',
      target: { type: 'stageClear', stage: 'st2', count: 1 }, reward: { exp: 340, ember: 500, items: [{ id: 'i_potion_l', count: 2 }] },
      chapter: '巡逻任务', repeat: true
    },

    /* ---------------- 悬赏 ---------------- */
    {
      id: 'q_b1', kind: 'bounty', name: '悬赏：熔渣壮汉', icon: '🪨', lvlReq: 6,
      desc: '熔渣壮汉的砸地会波及整片平台。击杀 6 只，赏金翻倍。',
      target: { type: 'kill', enemy: 'e_slag_brute', count: 6 }, reward: { exp: 420, ember: 700, items: [{ id: 'i_relic', count: 1 }] },
      chapter: '赏金榜', repeat: true
    },
    {
      id: 'q_b2', kind: 'bounty', name: '悬赏：符文炮台', icon: '🔫', lvlReq: 9,
      desc: '拆掉 8 座符文炮台，让回廊安静一点。',
      target: { type: 'kill', enemy: 'e_rune_turret', count: 8 }, reward: { exp: 480, ember: 820, items: [{ id: 'i_void_shard', count: 2 }] },
      chapter: '赏金榜', repeat: true
    },
    {
      id: 'q_b3', kind: 'bounty', name: '悬赏：清场', icon: '🧹', lvlReq: 2,
      desc: '清空 15 个房间。简单，但没人愿意做。',
      target: { type: 'room', count: 15 }, reward: { exp: 380, ember: 900, items: [{ id: 'i_potion_s', count: 5 }] },
      chapter: '赏金榜', repeat: true
    },
    {
      id: 'q_b4', kind: 'bounty', name: '悬赏：首领猎杀', icon: '👑', lvlReq: 12,
      desc: '击败任意首领 3 次。赏金榜上最高的那一栏。',
      target: { type: 'boss', count: 3 }, reward: { exp: 900, ember: 1800, items: [{ id: 'i_relic', count: 2 }, { id: 'i_revive_dust', count: 1 }] },
      chapter: '赏金榜', repeat: true
    },

    /* ---------------- 日常 ---------------- */
    {
      id: 'q_d1', kind: 'daily', name: '每日：远征', icon: '⏱️', lvlReq: 1,
      desc: '完成 3 次远征（无论成败）。',
      target: { type: 'run', count: 3 }, reward: { exp: 260, ember: 600, items: [{ id: 'i_potion_s', count: 4 }] },
      chapter: '每日委托', repeat: true, daily: true
    },
    {
      id: 'q_d2', kind: 'daily', name: '每日：收割', icon: '⚔️', lvlReq: 1,
      desc: '今日累计击杀 40 名敌人。',
      target: { type: 'killAny', count: 40 }, reward: { exp: 300, ember: 700, items: [{ id: 'i_ember_dust', count: 6 }] },
      chapter: '每日委托', repeat: true, daily: true
    },
    {
      id: 'q_d3', kind: 'daily', name: '每日：精英清理', icon: '✨', lvlReq: 5,
      desc: '今日击杀 3 名精英敌人。',
      target: { type: 'elite', count: 3 }, reward: { exp: 320, ember: 800, items: [{ id: 'i_core_fragment', count: 2 }] },
      chapter: '每日委托', repeat: true, daily: true
    },
    {
      id: 'q_d4', kind: 'daily', name: '每日：层数推进', icon: '📈', lvlReq: 3,
      desc: '今日通关任意关卡 2 次。',
      target: { type: 'stageClear', count: 2 }, reward: { exp: 420, ember: 1000, items: [{ id: 'i_key_rift', count: 1 }] },
      chapter: '每日委托', repeat: true, daily: true
    }
  ];

  const byId = {};
  Q.forEach(function (q) { byId[q.id] = q; });

  G.QuestKindName = { main: '主线', side: '支线', bounty: '悬赏', daily: '日常' };

  G.Quests = {
    list: Q,
    get: function (id) { return byId[id] || null; },
    byKind: function (kind) { return Q.filter(function (q) { return q.kind === kind; }); },
    kindIcon: { main: '📖', side: '🧭', bounty: '🎯', daily: '📅' },
    kindColor: { main: '#ff8a3c', side: '#5fe08a', bounty: '#c07cff', daily: '#4fd7ff' },
    /** 计算任务当前进度（基于全局统计 stats 与背包） */
    progress: function (q, stats, bag) {
      const t = q.target;
      const s = stats || {};
      switch (t.type) {
        case 'kill': return s.killBy && s.killBy[t.enemy] ? s.killBy[t.enemy] : 0;
        case 'killAny': return s.kills || 0;
        case 'elite': return s.elites || 0;
        case 'boss': return s.bosses || 0;
        case 'room': return s.rooms || 0;
        case 'run': return s.runs || 0;
        case 'stageClear': return (s.stageClears && t.stage) ? (s.stageClears[t.stage] || 0) : (s.stageClears ? Object.keys(s.stageClears).reduce(function (a, k) { return a + s.stageClears[k]; }, 0) : 0);
        case 'collect': return bag ? (bag[q.collectItem] || 0) : 0;
        case 'useWeapon': {
          if (!s.weaponKills) return 0;
          if (t.wtype === 'range') return (s.weaponKills.bow || 0) + (s.weaponKills.crossbow || 0) + (s.weaponKills.staff || 0);
          return s.weaponKills[t.wtype] || 0;
        }
        default: return 0;
      }
    },
    /** 任务是否达到完成条件 */
    isDone: function (q, stats, bag) { return G.Quests.progress(q, stats, bag) >= q.target.count; },
    /** 当前可接取的任务（等级达标） */
    available: function (lvl) {
      return Q.filter(function (q) { return (q.lvlReq || 1) <= (lvl || 1); });
    }
  };
})(window.G = window.G || {});
