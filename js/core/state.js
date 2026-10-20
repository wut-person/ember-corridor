/* =========================================================
   余烬回廊 · 存档与运行时状态
   ========================================================= */
(function (G) {
  const U = G.U;
  const KEY = 'ember_corridor_save_v1';

  function baseStats() {
    return {
      maxHp: 130, stamina: 100, crit: 0.05, def: 0, spd: 0,
      atkMul: 1, dr: 0, emberGain: 1, luck: 0
    };
  }

  function freshState() {
    return {
      v: 1,
      account: { name: '余烬行者', lvl: 1, exp: 0, look: 'lk_a', server: 'CN-01 · 灰烬', avatar: 0, createdAt: Date.now() },
      wallet: { i_ember: 500, i_relic: 0 },
      bag: { i_potion_s: 5, i_stamina_draught: 2 },
      equipped: { weapon: null, head: null, body: null, legs: null, cloak: null },
      ownedWeapons: [],
      ownedClothing: [],
      quests: {},              // id -> { state:'doing'|'done'|'claimed', prog:n }
      shop: null,              // { stock:[...], day:number }
      stats: {
        kills: 0, elites: 0, bosses: 0, rooms: 0, runs: 0, wins: 0,
        bestDepth: 0, playtime: 0, killBy: {}, weaponKills: {}, stageClears: {}
      },
      talents: {},             // 天赋等级
      buffs: {},               // 篝火增益
      settings: { sfx: true, autoTrack: true },
      lastRun: null,
      online: false,
      lastPlayed: Date.now()
    };
  }

  const S = {
    state: freshState(),
    listeners: {},

    /* ---------- 事件 ---------- */
    on: function (evt, fn) {
      (S.listeners[evt] = S.listeners[evt] || []).push(fn);
      return function () { S.off(evt, fn); };
    },
    off: function (evt, fn) {
      const a = S.listeners[evt];
      if (!a) return;
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    },
    emit: function (evt, payload) {
      const a = S.listeners[evt];
      if (a) a.slice().forEach(function (fn) { try { fn(payload); } catch (e) { console.warn(e); } });
    },

    /* ---------- 存档 ---------- */
    load: function () {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.account) {
            S.state = Object.assign(freshState(), d);
            S.state.account = Object.assign(freshState().account, d.account || {});
            S.state.stats = Object.assign(freshState().stats, d.stats || {});
            S.state.wallet = Object.assign({ i_ember: 0, i_relic: 0 }, d.wallet || {});
            S.state.bag = Object.assign({}, d.bag || {});
            S.state.equipped = Object.assign(freshState().equipped, d.equipped || {});
            S.state.settings = Object.assign({ sfx: true, autoTrack: true }, d.settings || {});
          }
        }
      } catch (e) { console.warn('读档失败，使用新档', e); }
      return S.state;
    },
    save: (function () {
      let t = 0;
      return function () {
        clearTimeout(t);
        t = setTimeout(function () { S.saveNow(); }, 250);
      };
    })(),
    saveNow: function () {
      try {
        S.state.lastPlayed = Date.now();
        localStorage.setItem(KEY, JSON.stringify(S.state));
      } catch (e) { console.warn('存档失败', e); }
    },
    reset: function () {
      S.state = freshState();
      try { localStorage.removeItem(KEY); } catch (e) { }
      S.emit('reset');
      S.saveNow();
    },

    /* ---------- 经验 / 等级 ---------- */
    expNeed: function (lvl) { return Math.round(90 * Math.pow(1.28, (lvl || 1) - 1)); },
    addExp: function (n) {
      const a = S.state.account;
      a.exp += n;
      let ups = 0;
      while (a.exp >= S.expNeed(a.lvl)) {
        a.exp -= S.expNeed(a.lvl);
        a.lvl++;
        ups++;
      }
      if (ups) { G.Audio.play('levelup'); S.emit('levelup', a.lvl); }
      S.emit('exp', n);
      S.save();
      return ups;
    },

    /* ---------- 资源 ---------- */
    coins: function () { return S.state.wallet.i_ember || 0; },
    addCoins: function (n) {
      S.state.wallet.i_ember = Math.max(0, (S.state.wallet.i_ember || 0) + n);
      S.emit('wallet'); S.save();
    },
    spendCoins: function (n) {
      if (S.coins() < n) return false;
      S.addCoins(-n); return true;
    },

    /* ---------- 背包 ---------- */
    addItem: function (id, count) {
      const it = G.Items.get(id);
      const c = count || 1;
      if (!it) return 0;
      if (it.kind === 'currency') {
        S.state.wallet[id] = (S.state.wallet[id] || 0) + c;
      } else {
        S.state.bag[id] = (S.state.bag[id] || 0) + c;
      }
      S.emit('bag', { id: id, count: c, add: true });
      S.save();
      return c;
    },
    removeItem: function (id, count) {
      const c = count || 1;
      const it = G.Items.get(id);
      const pool = (it && it.kind === 'currency') ? S.state.wallet : S.state.bag;
      const have = pool[id] || 0;
      if (have < c) return false;
      pool[id] = have - c;
      if (pool[id] <= 0) delete pool[id];
      S.emit('bag', { id: id, count: c, add: false });
      S.save();
      return true;
    },
    countItem: function (id) {
      const it = G.Items.get(id);
      if (it && it.kind === 'currency') return S.state.wallet[id] || 0;
      return S.state.bag[id] || 0;
    },
    /** 背包物品列表（含合并/排序） */
    bagList: function (filter) {
      const out = [];
      Object.keys(S.state.bag).forEach(function (id) {
        const it = G.Items.get(id);
        if (!it || S.state.bag[id] <= 0) return;
        if (filter && filter !== 'all' && it.kind !== filter) return;
        out.push({ item: it, count: S.state.bag[id] });
      });
      const order = { consume: 0, material: 1, blueprint: 2 };
      out.sort(function (a, b) {
        const d = (order[a.item.kind] || 9) - (order[b.item.kind] || 9);
        if (d !== 0) return d;
        return (b.item.rarity - a.item.rarity) || a.item.name.localeCompare(b.item.name);
      });
      return out;
    },

    /* ---------- 装备 / 武器 ---------- */
    addWeapon: function (w) {
      S.state.ownedWeapons.push(w);
      S.emit('equip'); S.save();
      return w;
    },
    addClothing: function (c) {
      S.state.ownedClothing.push(c);
      S.emit('equip'); S.save();
      return c;
    },
    weapon: function () {
      const uid = S.state.equipped.weapon;
      if (!uid) return null;
      for (let i = 0; i < S.state.ownedWeapons.length; i++) {
        if (S.state.ownedWeapons[i].uid === uid) return S.state.ownedWeapons[i];
      }
      return null;
    },
    equipWeapon: function (uid) {
      S.state.equipped.weapon = uid;
      G.Audio.play('click');
      S.emit('equip'); S.save();
    },
    equipCloth: function (uid) {
      let item = null;
      for (let i = 0; i < S.state.ownedClothing.length; i++) {
        const c = S.state.ownedClothing[i];
        if (c.uid === uid) { item = c; break; }
      }
      if (!item) return;
      S.state.equipped[item.slot] = uid;
      G.Audio.play('click');
      S.emit('equip'); S.save();
    },
    unequipSlot: function (slot) {
      S.state.equipped[slot] = null;
      S.emit('equip'); S.save();
    },
    /** 已装备衣物对象（按槽位） */
    clothAt: function (slot) {
      const uid = S.state.equipped[slot];
      if (!uid) return null;
      for (let i = 0; i < S.state.ownedClothing.length; i++) {
        if (S.state.ownedClothing[i].uid === uid) return S.state.ownedClothing[i];
      }
      return null;
    },
    /** 全部已装备衣物 */
    clothAll: function () {
      const out = {};
      G.SLOTS.forEach(function (s) { out[s.id] = S.clothAt(s.id); });
      return out;
    },
    sellWeapon: function (uid) {
      const i = S.state.ownedWeapons.findIndex(function (w) { return w.uid === uid; });
      if (i < 0) return 0;
      const w = S.state.ownedWeapons[i];
      const price = Math.round(60 + w.atk * 6 + w.rarity * 70);
      S.state.ownedWeapons.splice(i, 1);
      if (S.state.equipped.weapon === uid) S.state.equipped.weapon = null;
      S.addCoins(price);
      S.emit('equip'); S.save();
      return price;
    },
    sellClothing: function (uid) {
      const i = S.state.ownedClothing.findIndex(function (c) { return c.uid === uid; });
      if (i < 0) return 0;
      const c = S.state.ownedClothing[i];
      const price = Math.round(50 + (c.def + (c.hp || 0) / 2) * 4 + c.rarity * 60);
      S.state.ownedClothing.splice(i, 1);
      if (S.state.equipped[c.slot] === uid) S.state.equipped[c.slot] = null;
      S.addCoins(price);
      S.emit('equip'); S.save();
      return price;
    },

    /* ---------- 综合属性 ---------- */
    totals: function () {
      const t = baseStats();
      const a = S.state.account;
      t.maxHp += (a.lvl - 1) * 12;
      t.stamina += (a.lvl - 1) * 3;

      const cloth = S.clothAll();
      let def = 0;
      G.SLOTS.forEach(function (s) {
        const c = cloth[s.id];
        if (!c) return;
        def += c.def || 0;
        t.maxHp += c.hp || 0;
        t.stamina += c.stam || 0;
        t.spd += (c.spd || 0) / 100;
        t.crit += (c.crit || 0) / 100;
      });
      t.def = def + (a.lvl - 1) * 1.5;

      const w = S.weapon();
      t.weapon = w;
      t.atk = w ? w.atk : 8;
      t.spdW = w ? w.spd : 2.0;
      t.reach = w ? w.reach : 44;
      t.crit += (w ? w.crit : 0.05);
      t.wtype = w ? w.wtype : 'blade';

      /* 天赋 */
      const tal = S.state.talents || {};
      t.maxHp *= 1 + 0.05 * (tal.hp || 0);
      t.atk *= 1 + 0.06 * (tal.atk || 0);
      t.stamina *= 1 + 0.08 * (tal.stam || 0);
      t.spd += 0.05 * (tal.spd || 0);
      t.crit += 0.03 * (tal.crit || 0);
      t.dr += 0.04 * (tal.dr || 0);
      t.luck = (tal.luck || 0) * 0.5;

      /* 篝火增益 */
      const b = S.state.buffs || {};
      if (b.rb_hp) t.maxHp *= 1.15;
      if (b.rb_crit) t.crit += 0.08;
      if (b.rb_spd) t.spd += 0.12;

      t.maxHp = Math.round(t.maxHp);
      t.stamina = Math.round(t.stamina);
      t.def = Math.round(t.def);
      t.atk = Math.round(t.atk * t.atkMul);
      t.crit = Math.min(0.85, t.crit);
      t.spd = U.clamp(t.spd, -0.25, 1.2);
      return t;
    },

    /* 战力评估（界面上展示） */
    power: function () {
      const t = S.totals();
      return Math.round(t.atk * 3.2 + t.maxHp * 0.35 + t.def * 2.6 + t.crit * 260 + t.stamina * 0.4 + t.spd * 90);
    },

    /* ---------- 天赋 ---------- */
    TALENTS: [
      { id: 'hp', name: '强健体魄', icon: '❤️', max: 5, cost: 180, inc: 120, desc: '每级最大生命 +5%' },
      { id: 'atk', name: '凶暴本能', icon: '⚔️', max: 5, cost: 220, inc: 150, desc: '每级攻击力 +6%' },
      { id: 'stam', name: '耐力训练', icon: '🌀', max: 5, cost: 160, inc: 110, desc: '每级体力上限 +8%' },
      { id: 'spd', name: '轻身步法', icon: '👟', max: 4, cost: 240, inc: 160, desc: '每级移速 +5%' },
      { id: 'crit', name: '锐利直觉', icon: '🎯', max: 4, cost: 300, inc: 200, desc: '每级暴击率 +3%' },
      { id: 'dr', name: '余烬护体', icon: '🛡️', max: 4, cost: 280, inc: 190, desc: '每级受到伤害 -4%' },
      { id: 'luck', name: '拾荒幸运', icon: '🍀', max: 3, cost: 260, inc: 170, desc: '每级掉落品质提升' }
    ],
    talentLvl: function (id) { return (S.state.talents && S.state.talents[id]) || 0; },
    talentCost: function (id) {
      const meta = S.TALENTS.find(function (t) { return t.id === id; });
      if (!meta) return 0;
      return Math.round(meta.cost + meta.inc * S.talentLvl(id));
    },
    upgradeTalent: function (id) {
      const meta = S.TALENTS.find(function (t) { return t.id === id; });
      if (!meta) return false;
      const lv = S.talentLvl(id);
      if (lv >= meta.max) { G.toast('该天赋已满级', 'warn'); return false; }
      const cost = S.talentCost(id);
      if (!S.spendCoins(cost)) { G.toast('余烬币不足（需要 ' + cost + '）', 'err'); return false; }
      S.state.talents[id] = lv + 1;
      G.Audio.play('levelup');
      G.toast(meta.name + ' 提升至 Lv.' + (lv + 1), 'ok');
      S.emit('talents'); S.save();
      return true;
    },

    /* ---------- 任务 ---------- */
    questState: function (id) {
      return S.state.quests[id] || { state: 'doing', prog: 0 };
    },
    acceptQuest: function (id) {
      const q = G.Quests.get(id);
      if (!q) return false;
      const st = S.state.quests[id];
      if (st && st.state !== 'claimed') { G.toast('该任务已在追踪中', 'warn'); return false; }
      S.state.quests[id] = { state: 'doing', prog: 0, acceptedAt: Date.now() };
      G.Audio.play('quest');
      G.toast('已接取任务：' + q.name, 'ok');
      S.emit('quests'); S.save();
      return true;
    },
    /** 统计驱动的任务进度同步（进入界面 / 战斗结束后调用） */
    syncQuestProgress: function () {
      const stats = S.state.stats;
      const bag = S.state.bag;
      let changed = false, completed = [];
      G.Quests.list.forEach(function (q) {
        const cur = S.state.quests[q.id];
        if (!cur || cur.state === 'claimed') return;
        const p = Math.min(q.target.count, G.Quests.progress(q, stats, bag));
        if (p !== cur.prog) { cur.prog = p; changed = true; }
        if (p >= q.target.count && cur.state !== 'done') {
          cur.state = 'done';
          completed.push(q);
          changed = true;
        }
      });
      if (changed) {
        S.emit('quests');
        S.save();
      }
      completed.forEach(function (q) { G.Audio.play('quest'); G.toast('任务可交付：' + q.name, 'ok'); });
      return changed;
    },
    claimQuest: function (id) {
      const q = G.Quests.get(id);
      const st = S.state.quests[id];
      if (!q || !st) return false;
      if (st.state !== 'done') {
        const p = G.Quests.progress(q, S.state.stats, S.state.bag);
        if (p < q.target.count) { G.toast('任务尚未完成', 'warn'); return false; }
        st.state = 'done';
      }
      /* 发奖 */
      const r = q.reward || {};
      if (r.exp) S.addExp(r.exp);
      if (r.ember) S.addCoins(r.ember);
      (r.items || []).forEach(function (it) { S.addItem(it.id, it.count); });
      S.state.quests[id] = { state: 'claimed', prog: q.target.count, claimedAt: Date.now() };
      G.Audio.play('clear');
      const lines = [];
      if (r.exp) lines.push('经验 +' + r.exp);
      if (r.ember) lines.push('余烬币 +' + r.ember);
      (r.items || []).forEach(function (it) { lines.push(G.Items.name(it.id) + ' ×' + it.count); });
      G.toast('任务完成：' + q.name + '　' + lines.join('　'), 'ok');
      S.emit('quests'); S.save();
      return true;
    },
    /** 已追踪的任务（用于主界面卡片） */
    trackedQuests: function (max) {
      S.syncQuestProgress();
      const out = [];
      G.Quests.list.forEach(function (q) {
        const st = S.state.quests[q.id];
        if (!st || st.state === 'claimed') return;
        const p = G.Quests.progress(q, S.state.stats, S.state.bag);
        out.push({ q: q, cur: Math.min(p, q.target.count), done: p >= q.target.count, state: st.state });
      });
      out.sort(function (a, b) {
        if (a.done !== b.done) return a.done ? -1 : 1;
        return (b.cur / b.q.target.count) - (a.cur / a.q.target.count);
      });
      return out.slice(0, max || 3);
    },

    /* ---------- 商店 ---------- */
    shopStock: function () {
      const day = new Date().toDateString();
      const sp = S.state.shop;
      if (!sp || sp.day !== day) {
        S.state.shop = { day: day, stock: G.Items.shopStock(S.state.account.lvl), sold: {} };
        S.save();
      }
      return S.state.shop;
    },
    buyShop: function (idx) {
      const sp = S.shopStock();
      const it = sp.stock[idx];
      if (!it || sp.sold[idx]) return false;
      const price = Math.round(it.price * (it.kind === 'item' ? (it.stock > 3 ? 1 : 1.6) : 1.4));
      if (!S.spendCoins(price)) { G.toast('余烬币不足（需要 ' + price + '）', 'err'); return false; }
      if (it.kind === 'item') S.addItem(it.id, 1);
      else if (it.kind === 'weapon') { const w = JSON.parse(JSON.stringify(it.data)); w.uid = U.uid('w'); S.addWeapon(w); }
      else if (it.kind === 'cloth') { const c = JSON.parse(JSON.stringify(it.data)); c.uid = U.uid('c'); S.addClothing(c); }
      sp.sold[idx] = true;
      G.Audio.play('coin');
      G.toast('购买成功：' + (it.kind === 'item' ? G.Items.name(it.id) : it.data.name), 'ok');
      S.emit('shop'); S.save();
      return true;
    },
    refreshShop: function () {
      if (!S.spendCoins(120)) { G.toast('刷新需要 120 余烬币', 'err'); return false; }
      S.state.shop = { day: new Date().toDateString(), stock: G.Items.shopStock(S.state.account.lvl), sold: {} };
      G.Audio.play('ui_open');
      G.toast('商店库存已刷新', 'ok');
      S.emit('shop'); S.save();
      return true;
    },

    /* ---------- 篝火增益 ---------- */
    toggleBuff: function (id) {
      S.state.buffs = S.state.buffs || {};
      if (S.state.buffs[id]) delete S.state.buffs[id];
      else {
        const b = G.REST_BUFFS.find(function (x) { return x.id === id; });
        if (!b) return;
        /* 只能同时携带一个增益 */
        S.state.buffs = {};
        S.state.buffs[id] = true;
      }
      S.emit('buffs'); S.save();
    },

    /* ---------- 战斗统计埋点 ---------- */
    trackKill: function (enemyId, isElite, isBoss, wtype) {
      const st = S.state.stats;
      st.kills++;
      st.killBy[enemyId] = (st.killBy[enemyId] || 0) + 1;
      if (isElite) st.elites++;
      if (isBoss) st.bosses++;
      if (wtype) st.weaponKills[wtype] = (st.weaponKills[wtype] || 0) + 1;
      S.emit('stats');
    },
    trackRoom: function () { S.state.stats.rooms++; S.emit('stats'); },
    trackStageClear: function (stageId) {
      const st = S.state.stats;
      st.stageClears[stageId] = (st.stageClears[stageId] || 0) + 1;
      st.wins++;
      S.emit('stats');
    },
    trackRun: function () { S.state.stats.runs++; S.emit('stats'); },

    /* ---------- 场景解锁 ---------- */
    stageUnlocked: function (stage) {
      return S.state.account.lvl >= (stage.lvlReq || 1);
    }
  };

  S.baseStats = baseStats;
  S.freshState = freshState;
  S.KEY = KEY;
  G.State = S;
})(window.G = window.G || {});
