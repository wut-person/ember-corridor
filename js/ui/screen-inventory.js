/* =========================================================
   余烬回廊 · 细分系统 2：背包 / 武器使用与样式介绍
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  const TABS = [
    { id: 'all', label: '全部' },
    { id: 'weapon', label: '武器' },
    { id: 'cloth', label: '衣物' },
    { id: 'consume', label: '消耗品' },
    { id: 'material', label: '材料' },
    { id: 'blueprint', label: '图纸' }
  ];

  K.register('inventory', {
    mount: function (node, params) {
      const st = G.State.state;
      let tab = (params && params.tab) || 'all';
      let sel = null;              // { type:'weapon'|'cloth'|'item', data }

      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);
      node.appendChild(K.topbar({ crumb: '补给箱 · 背包与武器', backTo: 'lobby', backParams: { type: 'hub' } }));

      const wrap = U.el('div', 'sub-wrap');
      const head = U.el('div', 'sub-head');
      head.innerHTML = '<span style="width:4px;height:22px;border-radius:3px;background:linear-gradient(180deg,var(--ember),var(--ember-2));display:inline-block"></span>' +
        '<h2>背包</h2><span class="crumb">左键选中查看详情 · 悬停查看属性</span>';
      wrap.appendChild(head);

      const body = U.el('div', 'sub-body bag-grid');
      wrap.appendChild(body);

      /* ---------------- 左：工具栏 + 网格 ---------------- */
      const main = U.el('div', 'bag-main');
      const toolbar = U.el('div', 'bag-toolbar panel');
      toolbar.style.padding = '12px 14px';
      const tabHost = U.el('div');
      toolbar.appendChild(tabHost);
      toolbar.appendChild(U.el('div', 'spacer grow'));
      const coinRow = U.el('div', 'row gap8');
      coinRow.innerHTML =
        '<span class="cur-item">' + G.Icons.coin() + '<b class="gold">' + U.commas(st.wallet.i_ember || 0) + '</b></span>' +
        '<span class="cur-item">' + G.Icons.relic() + '<b class="cyan">' + (st.wallet.i_relic || 0) + '</b></span>';
      U.qsa('svg', coinRow).forEach(function (s) { s.setAttribute('width', '18'); s.setAttribute('height', '18'); });
      toolbar.appendChild(coinRow);
      main.appendChild(toolbar);

      const scroll = U.el('div', 'bag-scroll panel');
      scroll.style.padding = '16px';
      main.appendChild(scroll);
      body.appendChild(main);

      /* ---------------- 右：详情面板 ---------------- */
      const detail = U.el('div', 'detail-panel panel glow');
      body.appendChild(detail);

      node.appendChild(wrap);

      /* ---------------- 渲染 ---------------- */
      function renderTabs() {
        U.clear(tabHost);
        const counts = {
          all: st.ownedWeapons.length + st.ownedClothing.length + G.State.bagList('all').length,
          weapon: st.ownedWeapons.length,
          cloth: st.ownedClothing.length,
          consume: G.State.bagList('consume').length,
          material: G.State.bagList('material').length,
          blueprint: G.State.bagList('blueprint').length
        };
        tabHost.appendChild(K.tabs(TABS.map(function (t) {
          return { id: t.id, label: t.label, n: counts[t.id] };
        }), tab, function (id) {
          tab = id;
          sel = null;
          renderTabs();
          renderGrid();
          renderDetail();
        }));
      }

      function slotNode(opt, onClick) {
        const d = U.el('div', 'slot rq-' + (opt.rarity || 0) + (opt.equipped ? ' equipped' : '') + (opt.selected ? ' on' : ''));
        d.innerHTML = opt.svg + (opt.count > 1 ? '<span class="cnt">' + opt.count + '</span>' : '') +
          (opt.equipped ? '<span class="eqdot"></span>' : '') +
          (opt.badge ? '<span class="mark">' + opt.badge + '</span>' : '');
        if (opt.tip) d.setAttribute('data-tip', opt.tip);
        d.onclick = function () { G.Audio.play('click'); onClick(); };
        return d;
      }

      function renderGrid() {
        U.clear(scroll);
        const grid = U.el('div', 'grid-bag');

        /* 武器 */
        if (tab === 'all' || tab === 'weapon') {
          if (tab === 'all' && (st.ownedWeapons.length || st.ownedClothing.length)) {
            grid.appendChild(sectionLabel('武器'));
          }
          st.ownedWeapons.forEach(function (w) {
            const on = st.equipped.weapon === w.uid;
            grid.appendChild(slotNode({
              svg: G.Icons.weapon(w), rarity: w.rarity, equipped: on,
              selected: sel && sel.type === 'weapon' && sel.data.uid === w.uid,
              tip: K.weaponTip(w)
            }, function () { sel = { type: 'weapon', data: w }; renderGrid(); renderDetail(); }));
          });
          if (tab === 'weapon' && !st.ownedWeapons.length) {
            scroll.appendChild(U.el('div', 'empty-tip', '还没有武器<br><span class="tiny">远征掉落或在商店购买</span>'));
            return;
          }
        }

        /* 衣物 */
        if (tab === 'all' || tab === 'cloth') {
          if (tab === 'all') grid.appendChild(sectionLabel('衣物'));
          st.ownedClothing.forEach(function (c) {
            const on = st.equipped[c.slot] === c.uid;
            grid.appendChild(slotNode({
              svg: G.Icons.cloth(c), rarity: c.rarity, equipped: on,
              selected: sel && sel.type === 'cloth' && sel.data.uid === c.uid,
              tip: K.clothTip(c)
            }, function () { sel = { type: 'cloth', data: c }; renderGrid(); renderDetail(); }));
          });
          if (tab === 'cloth' && !st.ownedClothing.length) {
            scroll.appendChild(U.el('div', 'empty-tip', '还没有衣物'));
            return;
          }
        }

        /* 物品 */
        if (tab === 'all' || tab === 'consume' || tab === 'material' || tab === 'blueprint') {
          if (tab === 'all') grid.appendChild(sectionLabel('物品与材料'));
          const list = G.State.bagList(tab === 'all' ? 'all' : tab);
          list.forEach(function (p) {
            grid.appendChild(slotNode({
              svg: G.Icons.item(p.item), rarity: p.item.rarity, count: p.count,
              selected: sel && sel.type === 'item' && sel.data.id === p.item.id,
              tip: K.itemTip(p.item, p.count),
              badge: p.item.kind === 'blueprint' ? '图' : ''
            }, function () { sel = { type: 'item', data: p.item, count: p.count }; renderGrid(); renderDetail(); }));
          });
          if (!list.length && tab !== 'all') {
            scroll.appendChild(U.el('div', 'empty-tip', '这一类还没有物品'));
            return;
          }
        }

        if (!grid.children.length) {
          scroll.appendChild(U.el('div', 'empty-tip', '背包是空的<br><span class="tiny">去远征一趟吧</span>'));
        } else {
          scroll.appendChild(grid);
        }
      }

      function sectionLabel(txt) {
        const d = U.el('div', 'small bold dim');
        d.style.cssText = 'grid-column:1/-1;letter-spacing:.16em;margin:6px 0 2px;';
        d.textContent = '· ' + txt;
        return d;
      }

      function renderDetail() {
        U.clear(detail);
        if (!sel) {
          detail.innerHTML = '<div class="empty-tip" style="padding:70px 20px">' +
            '← 从左侧选择一件物品<br><span class="tiny">武器会显示招式、数值与使用说明</span></div>';
          /* 默认展示当前武器简介 */
          const w = G.State.weapon();
          if (w) {
            const box = U.el('div', 'panel-body');
            box.innerHTML = '<div class="tiny mute" style="letter-spacing:.16em;margin-bottom:8px">当前装备的武器</div>' +
              '<div class="row gap12"><div style="width:64px;height:64px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.35);border:1px solid var(--line)" class="rq-' + w.rarity + '">' + G.Icons.weapon(w) + '</div>' +
              '<div><div class="bold ' + U.qClass(w.rarity) + '">' + (w.instName || w.name) + '</div>' +
              '<div class="tiny mute">' + ((G.WTYPE_INFO[w.wtype] || {}).label || '') + ' · 攻击 ' + w.atk + ' · 攻速 ' + w.spd.toFixed(2) + '</div></div></div>';
            detail.appendChild(box);
          }
          return;
        }

        const d = sel.data;
        const q = d.rarity || 0;
        const isW = sel.type === 'weapon', isC = sel.type === 'cloth';
        const equipped = isW ? st.equipped.weapon === d.uid : (isC ? st.equipped[d.slot] === d.uid : false);

        const heroBox = U.el('div', 'detail-hero rq-' + q);
        const info = isW ? (G.WTYPE_INFO[d.wtype] || { label: '武器' }) : null;
        heroBox.innerHTML =
          '<div class="dhic">' + (isW ? G.Icons.weapon(d) : (isC ? G.Icons.cloth(d) : G.Icons.item(d))) + '</div>' +
          '<div style="min-width:0">' +
          '<div class="detail-title ' + U.qClass(q) + '">' + (isW ? (d.instName || d.name) : d.name) + (sel.count > 1 ? ' ×' + sel.count : '') + '</div>' +
          '<div class="detail-meta">' +
          '<span class="rarity-tag ' + U.qClass(q) + '">' + U.qName(q) + '</span>' +
          (isW ? '<span class="tiny dim">' + info.label + '</span><span class="tiny dim">Lv.' + d.lvl + '</span>' : '') +
          (isC ? '<span class="tiny dim">' + (G.SLOTS.find(function (s) { return s.id === d.slot; }) || {}).label + '</span><span class="tiny dim">Lv.' + d.lvl + '</span>' : '') +
          (!isW && !isC ? '<span class="tiny dim">' + ({ consume: '消耗品', material: '材料', blueprint: '图纸', currency: '货币' }[d.kind] || '物品') + '</span>' : '') +
          (equipped ? '<span class="tiny green">● 已装备</span>' : '') +
          '</div></div>';
        detail.appendChild(heroBox);

        const bodyBox = U.el('div', 'detail-body');

        /* ---- 武器：数值 + 招式 + 使用说明 ---- */
        if (isW) {
          const cmp = G.State.weapon();
          function delta(key, val, better) {
            if (!cmp || cmp.uid === d.uid) return '';
            const diff = val - cmp[key];
            if (Math.abs(diff) < 0.001) return '';
            const good = better ? diff > 0 : diff < 0;
            return ' <span class="' + (good ? 'green' : 'red') + ' tiny">(' + (diff > 0 ? '+' : '') + (key === 'crit' ? Math.round(diff * 100) + '%' : U.num(diff)) + ')</span>';
          }
          bodyBox.innerHTML =
            '<div style="margin-bottom:14px">' +
            K.statLine('攻击力', d.atk, U.STAT_MAX.atk, function (v) { return Math.round(v); }) + delta('atk', d.atk, true) +
            K.statLine('攻速', d.spd, U.STAT_MAX.spd, function (v) { return v.toFixed(2); }, 'cy') +
            K.statLine('距离', d.reach, U.STAT_MAX.reach, function (v) { return Math.round(v); }) +
            K.statLine('暴击', d.crit * 100, 30, function (v) { return Math.round(v) + '%'; }, 'vi') +
            '</div>' +
            '<div class="kv-row"><span class="k">当前装备对比</span><span class="v ' + (cmp ? U.qClass(cmp.rarity) : 'mute') + '">' + (cmp ? (cmp.instName || cmp.name) : '未装备') + '</span></div>' +
            '<div class="kv-row"><span class="k">重击倍率</span><span class="v">×' + d.heavy + '</span></div>' +
            '<div class="kv-row"><span class="k">体力消耗 / 次</span><span class="v">' + d.stamina + '</span></div>' +
            '<div class="kv-row"><span class="k">攻击范围判定</span><span class="v">' + (d.reach > 300 ? '远程投射物' : (d.reach > 80 ? '长距横扫' : '近身扇形')) + '</span></div>' +
            (d.proj ? '<div class="kv-row"><span class="k">投射物</span><span class="v">速度 ' + d.proj.speed + ' · 尺寸 ' + d.proj.size + (d.proj.pierce > 1 ? ' · 穿透 ' + d.proj.pierce : '') + '</span></div>' : '') +
            '<div class="kv-row"><span class="k">标签</span><span class="v">' + (d.tags || []).map(function (t) { return '<span class="sbadge">' + t + '</span>'; }).join(' ') + '</span></div>';

          /* 被动 + 战技 */
          const bx = U.el('div');
          bx.style.marginTop = '16px';
          bx.innerHTML =
            '<div class="small bold cyan" style="letter-spacing:.12em;margin-bottom:6px">被动效果</div>' +
            '<div class="card" style="padding:10px 12px"><div class="small dim" style="line-height:1.9">' + (d.passive || '无') + '</div></div>' +
            '<div class="small bold gold" style="letter-spacing:.12em;margin:16px 0 6px">战技 · ' + d.skill.name + '</div>' +
            '<div class="card row gap12" style="padding:12px">' +
            '<div style="width:52px;height:52px;flex:none;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:rgba(0,0,0,.35)">' + G.Icons.skill(d.skill.id) + '</div>' +
            '<div style="min-width:0"><div class="small bold">' + d.skill.name + '　<span class="tiny mute">体力 ' + d.skill.cost + ' · 冷却 ' + d.skill.cd + 's</span></div>' +
            '<div class="tiny dim" style="margin-top:4px;line-height:1.8">' + d.skill.desc + '</div></div></div>' +
            '<div class="small bold" style="letter-spacing:.12em;margin:16px 0 6px">使用方法</div>' +
            '<div class="small dim" style="line-height:2">' +
            '<kbd class="sbadge">鼠标左键</kbd> 普通攻击（可长按连击）<br>' +
            '<kbd class="sbadge">鼠标右键</kbd> 重击（' + d.heavy + ' 倍伤害，消耗更多体力）<br>' +
            '<kbd class="sbadge">Q</kbd> 释放战技「' + d.skill.name + '」<br>' +
            '<kbd class="sbadge">鼠标位置</kbd> 决定朝向与攻击方向' +
            '</div>' +
            '<div class="small bold" style="letter-spacing:.12em;margin:16px 0 6px">武器简介</div>' +
            '<div class="small dim" style="line-height:1.9">' + d.desc + '</div>' +
            (d.flavor ? '<div class="flavor small" style="margin-top:10px;color:var(--txt-mute);font-style:italic">' + d.flavor + '</div>' : '');
          bodyBox.appendChild(bx);

          const btnRow = U.el('div', 'row gap8');
          btnRow.style.marginTop = '18px';
          if (equipped) btnRow.appendChild(K.btn('● 已装备', 'sm ghost disabled', function () { }));
          else btnRow.appendChild(K.btn('装备此武器', 'sm primary', function () {
            G.State.equipWeapon(d.uid);
            K.toast('已装备 ' + (d.instName || d.name), 'ok');
            renderGrid(); renderDetail();
          }));
          btnRow.appendChild(K.btn('出售（+' + Math.round(60 + d.atk * 6 + d.rarity * 70) + ' 币）', 'sm danger', function () {
            K.confirm('出售武器', '确定出售「' + (d.instName || d.name) + '」？该操作不可撤销。', function () {
              const p = G.State.sellWeapon(d.uid);
              sel = null;
              K.toast('已出售，获得 ' + p + ' 余烬币', 'ok');
              renderTabs(); renderGrid(); renderDetail();
            });
          }));
          bodyBox.appendChild(btnRow);
        }

        /* ---- 衣物 ---- */
        if (isC) {
          bodyBox.innerHTML =
            '<div class="small bold" style="letter-spacing:.12em;margin-bottom:8px">属性加成</div>' +
            '<div style="margin-bottom:14px">' +
            K.statLine('防御', d.def || 0, U.STAT_MAX.def, function (v) { return '+' + Math.round(v); }, 'cy') +
            K.statLine('生命', d.hp || 0, U.STAT_MAX.hp, function (v) { return '+' + Math.round(v); }) +
            K.statLine('体力', d.stam || 0, U.STAT_MAX.stam, function (v) { return '+' + Math.round(v); }) +
            K.statLine('移速', (d.spd || 0) + 12, 24, function (v) { return (v - 12 > 0 ? '+' : '') + (v - 12) + '%'; }, 'vi') +
            K.statLine('暴击', d.crit || 0, 15, function (v) { return '+' + v + '%'; }) +
            '</div>' +
            '<div class="small bold" style="letter-spacing:.12em;margin:10px 0 6px">说明</div>' +
            '<div class="small dim" style="line-height:1.9">' + d.desc + '</div>' +
            (d.flavor ? '<div class="flavor small" style="margin-top:10px;color:var(--txt-mute);font-style:italic">' + d.flavor + '</div>' : '') +
            '<div class="small bold" style="letter-spacing:.12em;margin:16px 0 6px">外观</div>' +
            '<div class="small dim">装备后角色的' + (G.SLOTS.find(function (s) { return s.id === d.slot; }) || {}).label + '会变成主色 <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:' + ((d.look && d.look.tone) || '#888') + ';vertical-align:-2px"></span> ' + ((d.look && d.look.tone) || '#888') + '</div>';
          const btnRow = U.el('div', 'row gap8');
          btnRow.style.marginTop = '18px';
          if (equipped) btnRow.appendChild(K.btn('● 已装备', 'sm ghost disabled', function () { }));
          else btnRow.appendChild(K.btn('穿上', 'sm primary', function () {
            G.State.equipCloth(d.uid);
            K.toast('已装备 ' + d.name, 'ok');
            renderGrid(); renderDetail();
          }));
          btnRow.appendChild(K.btn('出售（+' + Math.round(50 + (d.def + (d.hp || 0) / 2) * 4 + d.rarity * 60) + ' 币）', 'sm danger', function () {
            K.confirm('出售衣物', '确定出售「' + d.name + '」？', function () {
              const p = G.State.sellClothing(d.uid);
              sel = null;
              K.toast('已出售，获得 ' + p + ' 余烬币', 'ok');
              renderTabs(); renderGrid(); renderDetail();
            });
          }));
          bodyBox.appendChild(btnRow);
        }

        /* ---- 物品 ---- */
        if (!isW && !isC) {
          bodyBox.innerHTML =
            '<div class="small bold" style="letter-spacing:.12em;margin-bottom:8px">物品说明</div>' +
            '<div class="small dim" style="line-height:1.95">' + (d.desc || '') + '</div>' +
            (d.flavor ? '<div class="flavor small" style="margin-top:10px;color:var(--txt-mute);font-style:italic">' + d.flavor + '</div>' : '') +
            '<div style="margin-top:14px">' +
            (d.hp ? K.kv('恢复生命', '+' + d.hp) : '') +
            (d.stam ? K.kv('恢复体力', '+' + d.stam) : '') +
            (d.buff ? K.kv('增益效果', d.buff.name + '（' + d.buff.dur + ' 秒）') : '') +
            (d.throw ? K.kv('投掷效果', '伤害 ' + (d.throw.dmg || 0) + ' · 半径 ' + d.throw.radius) : '') +
            (d.revive ? K.kv('特殊', '死亡时自动复活（每次远征一次）') : '') +
            K.kv('持有数量', (sel.count || 0)) +
            (d.price ? K.kv('参考售价', d.price + ' 余烬币') : '') +
            '</div>';
          if (d.kind === 'consume') {
            bodyBox.appendChild(U.el('div', 'lock-tip', '<span>💡 远征中按 <b>F</b> 使用消耗品；1/2 键切换携带的道具</span>'));
          }
          if (d.kind === 'material') {
            bodyBox.appendChild(U.el('div', 'lock-tip', '<span>💡 在铁砧处用于强化武器与附加词条</span>'));
          }
          if (d.kind === 'blueprint') {
            bodyBox.appendChild(U.el('div', 'lock-tip', '<span>💡 图纸用于解锁武器的第二战技槽位</span>'));
          }
        }

        detail.appendChild(bodyBox);
        K.bindTips(detail);
      }

      renderTabs();
      renderGrid();
      renderDetail();
      K.bindTips(scroll);
    }
  });
})(window.G = window.G || {});
