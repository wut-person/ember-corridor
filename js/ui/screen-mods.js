/* =========================================================
   余烬回廊 · 细分系统：铁砧（强化 / 天赋 / 商店 / 场景互动）
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  /* ---------------- 词条池 ---------------- */
  const AFFIXES = [
    { id: 'af_atk', name: '锋锐', cost: 2, mat: 'i_ember_dust', desc: '攻击力 +12%', apply: function (w) { w.atk = Math.round(w.atk * 1.12); } },
    { id: 'af_spd', name: '轻盈', cost: 3, mat: 'i_ember_dust', desc: '攻速 +10%', apply: function (w) { w.spd = Math.round(w.spd * 1.10 * 100) / 100; } },
    { id: 'af_crit', name: '锐眼', cost: 3, mat: 'i_core_fragment', desc: '暴击率 +6%', apply: function (w) { w.crit = Math.round((w.crit + 0.06) * 100) / 100; } },
    { id: 'af_reach', name: '延展', cost: 2, mat: 'i_ember_dust', desc: '攻击距离 +14%', apply: function (w) { w.reach = Math.round(w.reach * 1.14); } },
    { id: 'af_vamp', name: '汲血', cost: 4, mat: 'i_void_shard', desc: '命中回复 2% 生命', apply: function (w) { w.vamp = (w.vamp || 0) + 0.02; } },
    { id: 'af_void', name: '虚空', cost: 6, mat: 'i_void_shard', desc: '攻击附带虚空爆裂（小范围伤害）', apply: function (w) { w.voidHit = true; } }
  ];

  K.register('mods', {
    mount: function (node, params) {
      const st = G.State.state;
      let tab = (params && params.tab) || 'forge';

      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);
      node.appendChild(K.topbar({ crumb: '营地 · 铁砧', backTo: 'lobby', backParams: { type: 'hub' } }));

      const wrap = U.el('div', 'sub-wrap');
      const head = U.el('div', 'sub-head');
      head.innerHTML = '<span style="width:4px;height:22px;border-radius:3px;background:linear-gradient(180deg,var(--ember),var(--ember-2));display:inline-block"></span>' +
        '<h2>铁砧</h2><span class="crumb">武器强化 · 词条镶嵌 · 天赋 · 补给商店 · 场景互动</span>';
      const headRight = U.el('div', 'row gap8');
      head.appendChild(U.el('div', 'spacer grow'));
      headRight.innerHTML = '<span class="cur-item">' + G.Icons.coin() + '<b class="gold">' + U.commas(st.wallet.i_ember || 0) + '</b></span>' +
        '<span class="cur-item">' + G.Icons.relic() + '<b class="cyan">' + (st.wallet.i_relic || 0) + '</b></span>';
      U.qsa('svg', headRight).forEach(function (s) { s.setAttribute('width', '18'); s.setAttribute('height', '18'); });
      head.appendChild(headRight);
      wrap.appendChild(head);

      const tabCard = U.el('div', 'panel');
      tabCard.style.padding = '12px 14px';
      const tabHost = U.el('div');
      tabCard.appendChild(tabHost);
      wrap.appendChild(tabCard);

      const body = U.el('div', 'sub-body');
      body.style.gridTemplateColumns = '1fr 360px';
      wrap.appendChild(body);

      const mainCol = U.el('div', 'col gap12 col-scroll');
      const sideCol = U.el('div', 'col gap12 col-scroll');
      body.appendChild(mainCol);
      body.appendChild(sideCol);

      node.appendChild(wrap);

      const TABS = [
        { id: 'forge', label: '⚒️ 武器强化' },
        { id: 'affix', label: '💠 词条镶嵌' },
        { id: 'talent', label: '🌟 天赋改造' },
        { id: 'shop', label: '🏪 补给商店' },
        { id: 'scene', label: '🏛️ 场景互动' }
      ];


      function renderTabs() {
        U.clear(tabHost);
        tabHost.appendChild(K.tabs(TABS, tab, function (id) {
          tab = id;
          renderTabs();
          renderMain();
          renderSide();
        }));
      }

      /* ---------------- 主区 ---------------- */
      function selectedWeapon() { return G.State.weapon() || st.ownedWeapons[0] || null; }

      function renderMain() {
        U.clear(mainCol);
        if (tab === 'forge') renderForge();
        else if (tab === 'affix') renderAffix();
        else if (tab === 'talent') renderTalent();
        else if (tab === 'shop') renderShop();
        else renderScene();
      }

      /* --- 武器强化 --- */
      function renderForge() {
        const w = selectedWeapon();
        const card = K.panel('武器强化台', 'glow');
        const b = K.panelBody(card);
        if (!w) {
          b.innerHTML = '<div class="empty-tip">你还没有武器</div>';
          mainCol.appendChild(card);
          return;
        }
        const lvl = w.plus || 0;
        const costCoin = Math.round(60 + lvl * 45 + w.atk * 3);
        const costScrap = 2 + lvl;
        const costDust = lvl >= 3 ? Math.floor(lvl / 2) : 0;
        const rate = Math.max(0.45, 1 - lvl * 0.07);

        b.innerHTML =
          '<div class="row gap16" style="align-items:flex-start">' +
          '<div class="dhic rq-' + w.rarity + '" style="width:96px;height:96px;border-radius:16px;display:grid;place-items:center;background:rgba(0,0,0,.4);border:1px solid var(--line);flex:none">' + G.Icons.weapon(w) + '</div>' +
          '<div class="grow">' +
          '<div class="bold ' + U.qClass(w.rarity) + '" style="font-size:17px">' + (w.instName || w.name) + (lvl ? ' <span class="gold">+' + lvl + '</span>' : '') + '</div>' +
          '<div class="tiny mute" style="margin:4px 0 12px">' + ((G.WTYPE_INFO[w.wtype] || {}).label) + ' · ' + U.qName(w.rarity) + ' · 基础攻击 ' + w.atk + '</div>' +
          K.statLine('攻击力', w.atk, U.STAT_MAX.atk, function (v) { return Math.round(v); }) +
          K.statLine('攻速', w.spd, U.STAT_MAX.spd, function (v) { return v.toFixed(2); }, 'cy') +
          K.statLine('暴击', w.crit * 100, 30, function (v) { return Math.round(v) + '%'; }, 'vi') +
          '</div></div>' +
          '<div style="margin-top:18px;padding-top:14px;border-top:1px dashed var(--line)">' +
          K.kv('强化等级', '<span class="gold">+' + lvl + '</span>') +
          K.kv('下一次加成', '攻击力 +' + Math.round(w.atk * 0.08 + 2) + ' · 暴击 +1%') +
          K.kv('成功率', Math.round(rate * 100) + '%') +
          K.kv('材料消耗', costScrap + ' 废旧金属' + (costDust ? ' · ' + costDust + ' 余烬粉' : '') + ' · ' + U.commas(costCoin) + ' 余烬币') +
          '</div>';

        const row = U.el('div', 'row gap8');
        row.style.marginTop = '16px';
        row.appendChild(K.btn('强化一次', 'primary', function () {
          attemptForge(w, costCoin, costScrap, costDust, rate);
        }));
        row.appendChild(K.btn('连续强化 ×5', 'cyan', function () {
          for (let i = 0; i < 5; i++) {
            const l = w.plus || 0;
            const ok = attemptForge(w, Math.round(60 + l * 45 + w.atk * 3), 2 + l, l >= 3 ? Math.floor(l / 2) : 0, Math.max(0.45, 1 - l * 0.07), true);
            if (!ok) break;
          }
          renderMain(); renderSide();
        }));
        b.appendChild(row);
        b.appendChild(U.el('div', 'lock-tip', '<span>💡 强化失败不会降低等级，只消耗材料</span>'));
        mainCol.appendChild(card);

        /* 强化记录 / 其它武器 */
        const listCard = K.panel('全部武器');
        const lb = K.panelBody(listCard);
        const grid = U.el('div', 'grid-bag');
        st.ownedWeapons.forEach(function (x) {
          const on = st.equipped.weapon === x.uid;
          const s = U.el('div', 'slot rq-' + x.rarity + (on ? ' equipped' : ''));
          s.innerHTML = G.Icons.weapon(x) + ((x.plus || 0) ? '<span class="lvl">+' + x.plus + '</span>' : '') + (on ? '<span class="eqdot"></span>' : '');
          s.setAttribute('data-tip', K.weaponTip(x));
          s.onclick = function () {
            G.State.equipWeapon(x.uid);
            K.toast('已切换到 ' + (x.instName || x.name), 'ok');
            renderMain(); renderSide();
          };
          grid.appendChild(s);
        });
        lb.appendChild(grid);
        mainCol.appendChild(listCard);
      }

      function attemptForge(w, coin, scrap, dust, rate, silent) {
        if (!G.State.spendCoins(coin)) { if (!silent) K.toast('余烬币不足（需要 ' + U.commas(coin) + '）', 'err'); return false; }
        if (!G.State.removeItem('i_scrap', scrap)) {
          G.State.addCoins(coin);
          if (!silent) K.toast('废旧金属不足（需要 ' + scrap + '）', 'err');
          return false;
        }
        if (dust && !G.State.removeItem('i_ember_dust', dust)) {
          G.State.addCoins(coin); G.State.addItem('i_scrap', scrap);
          if (!silent) K.toast('余烬粉不足（需要 ' + dust + '）', 'err');
          return false;
        }
        const ok = Math.random() < rate;
        if (ok) {
          w.plus = (w.plus || 0) + 1;
          w.atk = Math.round(w.atk * 1.08 + 2);
          w.crit = Math.min(0.6, Math.round((w.crit + 0.01) * 100) / 100);
          w.instName = w.prefix ? w.prefix + w.name : w.name;
          G.Audio.play('levelup');
          K.toast('强化成功！' + w.name + ' 现在 +' + w.plus, 'ok');
        } else {
          G.Audio.play('hurt');
          K.toast('强化失败……材料化为灰烬', 'warn');
        }
        G.State.emit('equip');
        G.State.save();
        if (!silent) { renderMain(); renderSide(); }
        return true;
      }

      /* --- 词条镶嵌 --- */
      function renderAffix() {
        const w = selectedWeapon();
        const card = K.panel('词条镶嵌', 'glow');
        const b = K.panelBody(card);
        if (!w) { b.innerHTML = '<div class="empty-tip">你还没有武器</div>'; mainCol.appendChild(card); return; }
        const used = w.affixes || [];
        b.innerHTML =
          '<div class="row gap12" style="margin-bottom:14px">' +
          '<div style="width:56px;height:56px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.35);border:1px solid var(--line)" class="rq-' + w.rarity + '">' + G.Icons.weapon(w) + '</div>' +
          '<div><div class="bold ' + U.qClass(w.rarity) + '">' + (w.instName || w.name) + '</div>' +
          '<div class="tiny mute">已镶嵌 ' + used.length + ' / 3 个词条</div></div></div>';

        if (used.length) {
          const rowx = U.el('div', 'row gap6');
          rowx.style.flexWrap = 'wrap';
          rowx.style.marginBottom = '12px';
          used.forEach(function (a) {
            rowx.appendChild(U.el('span', 'sbadge', '💠 ' + a.name + ' · ' + a.desc));
          });
          b.appendChild(rowx);
        }

        AFFIXES.forEach(function (af) {
          const have = G.State.countItem(af.mat);
          const full = used.length >= 3;
          const dup = used.some(function (x) { return x.id === af.id; });
          const row = U.el('div', 'interact-row' + (full || dup ? ' disabled' : ''));
          row.innerHTML =
            '<div class="ir-ic">💠</div>' +
            '<div class="ir-tx"><div class="ir-t">' + af.name + '</div><div class="ir-d">' + af.desc + '</div></div>' +
            '<div class="col gap4" style="align-items:flex-end">' +
            '<span class="tiny ' + (have >= af.cost ? 'green' : 'red') + '">' + G.Items.name(af.mat) + ' ' + have + '/' + af.cost + '</span>' +
            (dup ? '<span class="tiny mute">已镶嵌</span>' : (full ? '<span class="tiny mute">槽位已满</span>' : '')) +
            '</div>';
          if (!full && !dup) {
            const btn = K.btn('镶嵌', 'xs primary', function (e) {
              e.stopPropagation();
              if (!G.State.removeItem(af.mat, af.cost)) { K.toast('材料不足', 'err'); return; }
              af.apply(w);
              w.affixes = w.affixes || [];
              w.affixes.push({ id: af.id, name: af.name, desc: af.desc });
              G.Audio.play('levelup');
              K.toast('镶嵌成功：' + af.name, 'ok');
              G.State.save();
              renderMain(); renderSide();
            });
            row.appendChild(btn);
          }
          b.appendChild(row);
        });
        mainCol.appendChild(card);
      }

      /* --- 天赋 --- */
      function renderTalent() {
        const card = K.panel('天赋改造', 'glow');
        const b = K.panelBody(card);
        b.innerHTML = '<div class="mute small" style="margin-bottom:12px">天赋永久生效，消耗余烬币提升。</div>';
        const col = U.el('div', 'talent-col');
        G.State.TALENTS.forEach(function (t) {
          const lv = G.State.talentLvl(t.id);
          const maxed = lv >= t.max;
          const cost = G.State.talentCost(t.id);
          const row = U.el('div', 'talent' + (maxed ? ' maxed' : ''));
          row.innerHTML =
            '<div class="tl-ic">' + t.icon + '</div>' +
            '<div class="tl-tx"><div class="tl-t">' + t.name + '<span class="pips">' +
            Array.apply(null, Array(t.max)).map(function (_, i) { return '<i class="' + (i < lv ? 'on' : '') + '"></i>'; }).join('') +
            '</span></div>' +
            '<div class="tl-d">' + t.desc + '　当前 Lv.' + lv + ' / ' + t.max + '</div></div>' +
            '<div class="col gap4" style="align-items:flex-end;justify-content:center">' +
            (maxed ? '<span class="tiny gold">已满级</span>' : '<span class="tiny ' + (G.State.coins() >= cost ? 'gold' : 'red') + '">' + U.commas(cost) + ' 币</span>') +
            (maxed ? '' : '<span class="tiny mute">点击升级</span>') +
            '</div>';
          if (!maxed) row.onclick = function () { G.State.upgradeTalent(t.id); renderMain(); renderSide(); };
          col.appendChild(row);
        });
        b.appendChild(col);
        mainCol.appendChild(card);
      }

      /* --- 商店 --- */
      function renderShop() {
        const sp = G.State.shopStock();
        const card = K.panel('补给商店', 'glow');
        const h = U.qs('.panel-head', card);
        h.appendChild(K.btn('🔄 刷新（120 币）', 'xs ghost', function () {
          G.State.refreshShop();
          renderMain(); renderSide();
        }));
        const b = K.panelBody(card);
        b.innerHTML = '<div class="mute small" style="margin-bottom:12px">库存每日自动刷新一次，也可以花余烬币立即刷新。</div>';
        const grid = U.el('div', 'shop-grid');
        sp.stock.forEach(function (it, i) {
          const sold = sp.sold[i];
          const data = it.kind === 'item' ? G.Items.get(it.id) : it.data;
          const price = Math.round(it.price * (it.kind === 'item' ? (it.stock > 3 ? 1 : 1.6) : 1.4));
          const cardEl = U.el('div', 'shop-card rq-' + (data.rarity || 0) + (sold ? ' sold' : ''));
          cardEl.innerHTML =
            '<div class="sc-ic">' + (it.kind === 'item' ? G.Icons.item(data) : (it.kind === 'weapon' ? G.Icons.weapon(data) : G.Icons.cloth(data))) + '</div>' +
            '<div class="sc-n ' + U.qClass(data.rarity) + '">' + data.name + '</div>' +
            '<div class="sc-t">' + (it.kind === 'item' ? ({ consume: '消耗品', material: '材料', blueprint: '图纸', currency: '货币' }[data.kind] || '物品') : (it.kind === 'weapon' ? ((G.WTYPE_INFO[data.wtype] || {}).label) + ' · 攻击 ' + data.atk : (G.SLOTS.find(function (s) { return s.id === data.slot; }) || {}).label + ' · 防御 ' + data.def)) + '</div>' +
            '<div class="sc-buy"><span class="price">' + G.Icons.coin() + price + '</span>' +
            '<span class="tiny ' + (sold ? 'mute' : 'cyan') + '">' + (sold ? '已售罄' : '购买') + '</span></div>';
          U.qs('svg', cardEl).setAttribute('width', '15');
          cardEl.setAttribute('data-tip', it.kind === 'item' ? K.itemTip(data) : (it.kind === 'weapon' ? K.weaponTip(data) : K.clothTip(data)));
          if (!sold) {
            cardEl.onclick = function () {
              G.State.buyShop(i);
              renderMain(); renderSide();
            };
          }
          grid.appendChild(cardEl);
        });
        b.appendChild(grid);
        mainCol.appendChild(card);
      }

      /* --- 场景互动 --- */
      function renderScene() {
        const card = K.panel('营地互动点', 'glow');
        const b = K.panelBody(card);
        b.innerHTML = '<div class="mute small" style="margin-bottom:12px">营地里每一个发光图标都是一个可交互的场景物件。</div>';
        const list = U.el('div', 'interact-list');
        G.HUB_SPOTS.forEach(function (sp) {
          const row = U.el('div', 'interact-row');
          row.style.cursor = 'pointer';
          const reward = { fire: '恢复状态并选择篝火增益', board: '接取 / 交付任务', forge: '强化武器与天赋', chest: '整理背包与装备', mirror: '更换衣物与外貌', gate: '进入关卡选择' }[sp.id] || '';
          row.innerHTML =
            '<div class="ir-ic">' + sp.icon + '</div>' +
            '<div class="ir-tx"><div class="ir-t">' + sp.name + '</div><div class="ir-d">' + sp.desc + '　<span class="cyan">' + reward + '</span></div></div>' +
            '<span class="mute tiny">前往 ›</span>';
          row.onclick = function () {
            G.Audio.play('ui_open');
            if (sp.action === 'rest') { K.toast('你在篝火旁休息了一会儿，状态已恢复。', 'ok'); return; }
            if (sp.screen === 'stages') { K.go('lobby', { type: 'stages' }); return; }
            if (sp.screen === 'mods') { K.toast('你已经站在铁砧前了', 'warn'); return; }
            K.pushHistory('mods', { tab: tab });
            K.go(sp.screen);
          };
          list.appendChild(row);
        });
        b.appendChild(list);
        mainCol.appendChild(card);

        const lootCard = K.panel('材料库存');
        const lb = K.panelBody(lootCard);
        const mats = G.State.bagList('all').filter(function (p) { return p.item.kind !== 'consume'; });
        if (!mats.length) lb.innerHTML = '<div class="mute small">没有材料，去远征掉落一些吧。</div>';
        mats.forEach(function (p) {
          const row = U.el('div', 'interact-row rq-' + p.item.rarity);
          row.innerHTML = '<div class="ir-ic" style="padding:3px">' + G.Icons.item(p.item) + '</div>' +
            '<div class="ir-tx"><div class="ir-t">' + p.item.name + '</div><div class="ir-d">' + (p.item.desc || '').slice(0, 20) + '</div></div>' +
            '<span class="badge">' + p.count + '</span>';
          row.setAttribute('data-tip', K.itemTip(p.item, p.count));
          lb.appendChild(row);
        });
        mainCol.appendChild(lootCard);
      }

      /* ---------------- 侧栏：当前状态 ---------------- */
      function renderSide() {
        U.clear(sideCol);
        const t = G.State.totals();
        const w = G.State.weapon();

        const pCard = K.panel('当前配置', 'glow');
        const pb = K.panelBody(pCard);
        pb.innerHTML =
          '<div class="row gap12" style="margin-bottom:12px">' +
          '<div style="width:56px;height:56px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.35);border:1px solid var(--line)" class="rq-' + (w ? w.rarity : 0) + '">' + (w ? G.Icons.weapon(w) : '—') + '</div>' +
          '<div><div class="bold ' + (w ? U.qClass(w.rarity) : '') + '">' + (w ? (w.instName || w.name) : '空手') + (w && w.plus ? ' <span class="gold">+' + w.plus + '</span>' : '') + '</div>' +
          '<div class="tiny mute">' + (w ? (G.WTYPE_INFO[w.wtype] || {}).label : '') + '</div></div></div>' +
          K.kv('攻击力', '<span class="ember">' + t.atk + '</span>') +
          K.kv('生命 / 体力', t.maxHp + ' / ' + t.stamina) +
          K.kv('防御 / 暴击', t.def + ' / ' + Math.round(t.crit * 100) + '%') +
          K.kv('战力评估', '<span class="gold">' + U.commas(G.State.power()) + '</span>');
        sideCol.appendChild(pCard);

        const matCard = K.panel('强化材料');
        const mb = K.panelBody(matCard);
        ['i_scrap', 'i_ember_dust', 'i_core_fragment', 'i_void_shard', 'i_relic'].forEach(function (id) {
          const it = G.Items.get(id);
          const c = G.State.countItem(id);
          mb.appendChild(U.el('div', 'kv-row',
            '<span class="k rq-' + it.rarity + '">' + it.name + '</span><span class="v ' + (c ? '' : 'mute') + '">' + c + '</span>'));
        });
        sideCol.appendChild(matCard);

        const tipCard = K.panel('工匠笔记');
        const tb = K.panelBody(tipCard);
        tb.innerHTML =
          '<div class="small dim" style="line-height:2">' +
          '· 强化优先堆攻击力，收益最直接<br>' +
          '· 暴击流请搭配「拳套 / 双斧」与锐眼词条<br>' +
          '· 汲血 + 镰刀可以在深层活得久一些<br>' +
          '· 天赋「余烬护体」到 4 级共减伤 16%' +
          '</div>';
        sideCol.appendChild(tipCard);
      }

      renderTabs();
      renderMain();
      renderSide();
      K.bindTips(node);
      G.State.on('bag', function () { });
    }
  });
})(window.G = window.G || {});
