/* =========================================================
   余烬回廊 · 界面 3：游戏内大厅（营地）
   type: 'hub' 营地互动 | 'stages' 关卡选择
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  K.register('lobby', {
    mount: function (node, params) {
      const type = (params && params.type) || 'hub';
      const st = G.State.state;
      const look = G.getLook(st.account.look);
      const t = G.State.totals();

      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);

      node.appendChild(K.topbar({
        crumb: type === 'hub' ? '营地 · 大厅' : '回廊之门 · 关卡选择',
        backTo: type === 'hub' ? 'home' : 'lobby',
        backParams: type === 'hub' ? null : { type: 'hub' }
      }));

      const wrap = U.el('div', 'lobby-wrap');

      /* ---------------- 左栏：远征准备 ---------------- */
      const leftCol = U.el('div', 'side-col lobby-left');
      const prep = K.panel('远征准备', 'glow');
      const pb = K.panelBody(prep);
      const wpn = G.State.weapon();
      pb.innerHTML =
        '<div class="kv-row"><span class="k">驯火者</span><span class="v">' + U.esc(st.account.name) + ' Lv.' + st.account.lvl + '</span></div>' +
        '<div class="kv-row"><span class="k">当前武器</span><span class="v ' + U.qClass(wpn ? wpn.rarity : 0) + '">' + (wpn ? (wpn.instName || wpn.name) : '空手') + '</span></div>' +
        '<div class="kv-row"><span class="k">攻击力</span><span class="v ember">' + t.atk + '</span></div>' +
        '<div class="kv-row"><span class="k">生命上限</span><span class="v">' + t.maxHp + '</span></div>' +
        '<div class="kv-row"><span class="k">体力上限</span><span class="v">' + t.stamina + '</span></div>' +
        '<div class="kv-row"><span class="k">防御 / 暴击</span><span class="v">' + t.def + ' / ' + Math.round(t.crit * 100) + '%</span></div>';
      leftCol.appendChild(prep);

      /* 补给品 */
      const supply = K.panel('随身补给');
      const supb = K.panelBody(supply);
      const potions = G.State.bagList('consume').slice(0, 4);
      if (!potions.length) supb.innerHTML = '<div class="mute small">背包里没有消耗品</div>';
      potions.forEach(function (p) {
        const row = U.el('div', 'interact-row');
        row.innerHTML =
          '<div class="ir-ic" style="padding:3px">' + G.Icons.item(p.item) + '</div>' +
          '<div class="ir-tx"><div class="ir-t">' + p.item.name + '</div><div class="ir-d">' + (p.item.desc || '').slice(0, 18) + '</div></div>' +
          '<span class="badge">' + p.count + '</span>';
        row.setAttribute('data-tip', K.itemTip(p.item, p.count));
        supb.appendChild(row);
      });
      supb.appendChild(K.btn('打开背包', 'sm ghost block', function () { K.pushHistory('lobby', params); K.go('inventory'); }));
      leftCol.appendChild(supply);

      /* 篝火增益 */
      const buffCard = K.panel('篝火增益');
      const bf = K.panelBody(buffCard);
      bf.innerHTML = '<div class="mute tiny" style="margin-bottom:8px">每次远征只能携带一项</div>';
      G.REST_BUFFS.forEach(function (b) {
        const on = st.buffs && st.buffs[b.id];
        const row = U.el('div', 'interact-row' + (on ? '' : ' disabled'));
        row.style.cursor = 'pointer';
        row.style.borderColor = on ? 'rgba(255,138,60,.55)' : '';
        row.innerHTML = '<div class="ir-ic">' + b.icon + '</div><div class="ir-tx"><div class="ir-t">' + b.name + '</div><div class="ir-d">' + b.desc + '</div></div>' + (on ? '<span class="green">✓</span>' : '');
        row.onclick = function () {
          G.State.toggleBuff(b.id);
          G.Audio.play('pickup');
          K.toast(b.name + (st.buffs[b.id] ? ' 已激活' : ' 已取消'), 'ok');
          K.go('lobby', params);
        };
        bf.appendChild(row);
      });
      leftCol.appendChild(buffCard);
      wrap.appendChild(leftCol);

      /* ---------------- 中栏：场景舞台 ---------------- */
      const stageBox = U.el('div', 'stage-box panel');
      const cvWrap = U.el('div', 'stage-canvas-wrap');
      const cv = U.el('canvas');
      cvWrap.appendChild(cv);
      stageBox.appendChild(cvWrap);

      /* 互动热点 */
      const spotHost = U.el('div');
      spotHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      const spots = type === 'hub' ? G.HUB_SPOTS : [];
      spots.forEach(function (sp) {
        const locked = false;
        const d = U.el('div', 'hotspot' + (locked ? ' locked' : ''));
        d.style.left = sp.x + '%';
        d.style.top = sp.y + '%';
        d.style.pointerEvents = 'auto';
        d.innerHTML = '<div class="hs-ic">' + sp.icon + '</div><div class="hs-tx">' + sp.name + '</div>';
        d.onclick = function () {
          G.Audio.play('ui_open');
          if (sp.action === 'rest') {
            K.toast('篝火噼啪作响。你在火边坐了一会儿，状态已恢复。', 'ok');
            G.Audio.play('pickup');
            return;
          }
          if (sp.screen === 'stages') {
            K.go('lobby', { type: 'stages' });
            return;
          }
          if (sp.screen === 'quests') { K.pushHistory('lobby', params); K.go('quests'); return; }
          if (sp.screen === 'mods') { K.pushHistory('lobby', params); K.go('mods'); return; }
          if (sp.screen === 'inventory') { K.pushHistory('lobby', params); K.go('inventory'); return; }
          if (sp.screen === 'character') { K.pushHistory('lobby', params); K.go('character'); return; }
        };
        d.setAttribute('data-tip', '<h4>' + sp.icon + ' ' + sp.name + '</h4><div class="dim">' + sp.desc + '</div>');
        spotHost.appendChild(d);
      });
      cvWrap.appendChild(spotHost);

      /* 底部信息 */
      const overlay = U.el('div', 'stage-overlay');
      const info = U.el('div', 'grow');
      if (type === 'hub') {
        info.innerHTML =
          '<div class="stage-badges"><span class="sbadge hot">安全区</span><span class="sbadge">营地 · 第一层入口</span><span class="sbadge">可互动：' + G.HUB_SPOTS.length + ' 处</span></div>' +
          '<div class="stage-title">余烬营地</div>' +
          '<div class="stage-sub">点击场景中的发光图标，或使用右侧按钮进入对应系统。</div>';
      } else {
        info.innerHTML =
          '<div class="stage-badges"><span class="sbadge hot">关卡选择</span><span class="sbadge">共 ' + G.STAGES.length + ' 层</span><span class="sbadge">已解锁 ' + G.STAGES.filter(G.State.stageUnlocked).length + '</span></div>' +
          '<div class="stage-title">回廊之门</div>' +
          '<div class="stage-sub">选择要推进的层数。层数越高，掉落越好，精英越多。</div>';
      }
      overlay.appendChild(info);
      const btnRow = U.el('div', 'row gap8');
      if (type === 'hub') {
        const openBtn = K.btn('🌍 进入开放世界', 'primary', function () {
          G.Audio.play('ui_open');
          K.go('world', {});
        });
        btnRow.appendChild(openBtn);
      }
      const startBtn = K.btn(type === 'hub' ? '⚔️ 回廊远征（闯关）' : '« 返回营地', type === 'hub' ? '' : 'primary', function () {
        G.Audio.play('ui_open');
        K.go('lobby', { type: type === 'hub' ? 'stages' : 'hub' });
      });
      btnRow.appendChild(startBtn);
      overlay.appendChild(btnRow);
      cvWrap.appendChild(overlay);
      wrap.appendChild(stageBox);

      /* ---------------- 右栏：角色纸娃娃 + 系统导航 ---------------- */
      const rightCol = U.el('div', 'side-col lobby-right');

      const dollCard = K.panel('当前装扮', 'glow');
      const db = K.panelBody(dollCard);
      const dollWrap = U.el('div', 'doll-canvas-wrap');
      const dcv = U.el('canvas');
      dollWrap.appendChild(dcv);
      db.appendChild(dollWrap);

      const slots = U.el('div', 'interact-list');
      slots.style.marginTop = '10px';
      G.SLOTS.forEach(function (sl) {
        const c = G.State.clothAt(sl.id);
        const row = U.el('div', 'interact-row rq-' + (c ? c.rarity : 0));
        row.style.cursor = 'pointer';
        row.innerHTML =
          '<div class="ir-ic">' + (c ? G.Icons.cloth(c) : sl.icon) + '</div>' +
          '<div class="ir-tx"><div class="ir-t">' + sl.label + '</div>' +
          '<div class="ir-d ' + (c ? U.qClass(c.rarity) : '') + '">' + (c ? c.name : '未装备') + '</div></div>' +
          '<span class="mute tiny">更换 ›</span>';
        if (c) row.setAttribute('data-tip', K.clothTip(c));
        row.onclick = function () { G.Audio.play('click'); K.pushHistory('lobby', params); K.go('character', { slot: sl.id }); };
        slots.appendChild(row);
      });
      db.appendChild(slots);
      rightCol.appendChild(dollCard);

      const navCard = K.panel('大厅系统');
      const nb = K.panelBody(navCard);
      const nav = U.el('div', 'lobby-nav');
      const navItems = [
        { icon: '📜', t: '任务板', c: '主线 / 日常', go: 'quests' },
        { icon: '🎒', t: '背包', c: G.State.bagList('all').length + ' 类物品', go: 'inventory' },
        { icon: '🪞', t: '试衣镜', c: '角色与衣物', go: 'character' },
        { icon: '⚒️', t: '铁砧', c: '强化 / 天赋', go: 'mods' },
        { icon: '🗺️', t: '回廊之门', c: '开始远征', go: 'lobby-stages' }
      ];
      navItems.forEach(function (n) {
        const row = U.el('div', 'lnav',
          '<span class="li">' + n.icon + '</span><span class="lt">' + n.t + '</span><span class="lc">' + n.c + '</span>');
        row.onclick = function () {
          G.Audio.play('ui_open');
          if (n.go === 'lobby-stages') { K.go('lobby', { type: 'stages' }); return; }
          K.pushHistory('lobby', params);
          K.go(n.go);
        };
        nav.appendChild(row);
      });
      nb.appendChild(nav);
      rightCol.appendChild(navCard);
      wrap.appendChild(rightCol);

      node.appendChild(wrap);

      /* ---------------- 场景动画 ---------------- */
      const cvs = cv;
      let raf = 0, t0 = performance.now();
      const heroPos = { x: 0.5, y: 0.72 };
      let heroTarget = { x: 0.5, y: 0.72 };
      let facing = 1;
      let heroPh = 0;

      function resize() {
        const r = cvWrap.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cvs.width = Math.max(320, Math.round(r.width * dpr));
        cvs.height = Math.max(240, Math.round(r.height * dpr));
        cvs.style.width = '100%';
        cvs.style.height = '100%';
        const c = cvs.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.imageSmoothingEnabled = false;
        return { w: r.width, h: r.height };
      }
      let size = resize();

      /* 场景绘制 */
      function drawScene(c, w, h, t) {
        /* 天空 */
        const g = c.createLinearGradient(0, 0, 0, h);
        if (type === 'hub') { g.addColorStop(0, '#0a1018'); g.addColorStop(.6, '#0d1420'); g.addColorStop(1, '#070a10'); }
        else { g.addColorStop(0, '#0b1030'); g.addColorStop(.55, '#0a0f22'); g.addColorStop(1, '#05070c'); }
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);

        /* 远景剪影 */
        c.fillStyle = type === 'hub' ? 'rgba(20,28,42,.9)' : 'rgba(24,26,54,.9)';
        for (let i = 0; i < 7; i++) {
          const bw = w / 7;
          const bh = h * (0.24 + ((i * 37) % 11) / 46);
          c.fillRect(i * bw, h * 0.72 - bh, bw - 4, bh);
        }
        /* 余烬悬浮 */
        for (let i = 0; i < 22; i++) {
          const px = ((i * 97) % 100) / 100 * w;
          const py = h - (((t * 22 + i * 61) % (h * 0.9)));
          const a = 0.25 + 0.35 * Math.abs(Math.sin(t + i));
          c.fillStyle = i % 5 === 0 ? 'rgba(79,215,255,' + a + ')' : 'rgba(255,150,70,' + a + ')';
          c.fillRect(px, py, 2, 2);
        }
        /* 地面 */
        const groundY = h * 0.84;
        c.fillStyle = '#1a2231';
        c.fillRect(0, groundY, w, h - groundY);
        c.fillStyle = '#232d3f';
        c.fillRect(0, groundY, w, 5);
        for (let x = 0; x < w; x += 42) {
          c.fillStyle = 'rgba(255,255,255,.03)';
          c.fillRect(x, groundY + 10, 20, 3);
        }

        /* 二层平台 */
        c.fillStyle = '#222c3d';
        c.fillRect(w * 0.62, groundY - h * 0.2, w * 0.34, 10);
        c.fillStyle = '#2c3850';
        c.fillRect(w * 0.62, groundY - h * 0.2, w * 0.34, 3);

        if (type === 'hub') {
          /* 装饰：铁砧 / 木箱 / 任务板 / 试衣镜 / 宝箱 / 传送门 / 灯 */
          const baseY = groundY;
          G.Sprites.prop(c, 'gate', w * 0.27, baseY, t);
          G.Sprites.prop(c, 'board', w * 0.16, baseY, t);
          G.Sprites.prop(c, 'anvil', w * 0.40, baseY, t);
          G.Sprites.prop(c, 'chest', w * 0.63, baseY, t);
          G.Sprites.prop(c, 'mirror', w * 0.82, baseY, t);
          G.Sprites.prop(c, 'crate', w * 0.50, baseY, t);
          G.Sprites.prop(c, 'lantern', w * 0.08, baseY, t);
          G.Sprites.prop(c, 'lantern', w * 0.93, baseY, t);
          /* 篝火 */
          G.Sprites.flame(c, w * 0.35, baseY + 4, t, 1.15);
        } else {
          /* 关卡传送门：按层数排列 */
          G.STAGES.forEach(function (sg, i) {
            const x = w * (0.14 + i * 0.18);
            const unlocked = G.State.stageUnlocked(sg);
            c.save();
            c.globalAlpha = unlocked ? 1 : 0.42;
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + i);
            c.fillStyle = unlocked ? 'rgba(255,140,60,' + (0.10 + pulse * 0.08) + ')' : 'rgba(90,100,120,.12)';
            c.beginPath();
            c.ellipse(x, groundY - 62, 34, 58, 0, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = unlocked ? 'rgba(255,170,90,.75)' : 'rgba(120,130,150,.5)';
            c.lineWidth = 2;
            c.beginPath();
            c.ellipse(x, groundY - 62, 30, 54, 0, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = '#0a0e16';
            c.beginPath();
            c.ellipse(x, groundY - 62, 27, 51, 0, 0, Math.PI * 2);
            c.fill();
            /* 层数文字 */
            c.fillStyle = unlocked ? '#ffd7ad' : '#7c8798';
            c.font = 'bold 15px sans-serif';
            c.textAlign = 'center';
            c.fillText(String(i + 1), x, groundY - 56);
            c.font = '11px sans-serif';
            c.fillStyle = unlocked ? 'rgba(255,215,173,.75)' : 'rgba(124,135,152,.6)';
            c.fillText(unlocked ? sg.sub.split(' ')[0] : 'Lv.' + sg.lvlReq, x, groundY - 20);
            c.restore();
          });
        }

        /* 主角（站在营地地面上） */
        heroPh += 0.09;
        const hx = w * heroPos.x + Math.sin(t * 0.7) * 4;
        const hy = groundY + 6;
        const camScale = U.clamp(h / 800, 0.7, 1.4);
        G.Sprites.hero(c, {
          x: hx, y: hy, s: 3.2 * camScale, ph: heroPh, moving: Math.abs(Math.sin(t * 0.7)) > 0.4,
          action: 'idle', look: look, equip: G.Sprites.equipFromState(),
          wtype: wpn ? wpn.wtype : 'blade', reach: wpn ? wpn.reach : 46
        });
      }

      function loop(now) {
        const t = (now - t0) / 1000;
        const ctx = cvs.getContext('2d');
        const c = ctx;
        c.save();
        c.setTransform(cvs.width / size.w, 0, 0, cvs.height / size.h, 0, 0);
        c.clearRect(0, 0, size.w, size.h);
        drawScene(c, size.w, size.h, t);
        c.restore();
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      /* 热区点击移动主角 */
      cvWrap.addEventListener('click', function (e) {
        if (e.target.closest('.hotspot') || e.target.closest('.stage-overlay')) return;
        const r = cvWrap.getBoundingClientRect();
        heroTarget.x = U.clamp((e.clientX - r.left) / r.width, 0.06, 0.94);
      });

      /* 关卡列表（选择模式） */
      if (type === 'stages') {
        const listCard = K.panel('层数一览');
        const lb = K.panelBody(listCard);
        G.STAGES.forEach(function (sg) {
          const unlocked = G.State.stageUnlocked(sg);
          const cleared = (st.stats.stageClears[sg.id] || 0);
          const row = U.el('div', 'quest-card' + (unlocked ? '' : ' locked'));
          row.style.opacity = unlocked ? 1 : .55;
          row.innerHTML =
            '<div class="qc-ic">' + (sg.boss ? '👑' : '🚪') + '</div>' +
            '<div class="qc-tx"><div class="qc-t">' + sg.name + (cleared ? ' <span class="tiny green">已通关 ×' + cleared + '</span>' : '') + '</div>' +
            '<div class="qc-d">' + sg.desc + '</div>' +
            '<div class="row gap6">' + sg.mods.map(function (m) { return '<span class="sbadge">' + m + '</span>'; }).join('') + '</div></div>' +
            '<div class="doll-slots" style="justify-content:center">' +
            '<span class="tiny ' + (unlocked ? 'green' : 'red') + '">' + (unlocked ? '可进入' : '需要 Lv.' + sg.lvlReq) + '</span>' +
            '</div>';
          if (unlocked) {
            row.onclick = function () { K.pushHistory('lobby', params); K.go('game', { stageId: sg.id }); };
          }
          lb.appendChild(row);
        });
        rightCol.insertBefore(listCard, rightCol.firstChild);
      }

      /* 纸娃娃 */
      let stopDollAnim = null;
      function drawDoll() {
        if (stopDollAnim) stopDollAnim();
        const dh = Math.max(150, dollWrap.getBoundingClientRect().height || 206);
        stopDollAnim = K.doll(dcv, 3, null, true, dh - 12);
      }
      requestAnimationFrame(function () { drawDoll(); requestAnimationFrame(drawDoll); });
      K.onResize(U.debounce(drawDoll, 160));
      K.onUnmount(function () { if (stopDollAnim) stopDollAnim(); });

      /* 清理 */
      const stop = function () { if (raf) cancelAnimationFrame(raf); };
      K.onResize(function () { size = resize(); });
      node.__cleanup = stop;
      const obs = new MutationObserver(function () {
        if (!document.body.contains(node)) { stop(); obs.disconnect(); }
      });
      obs.observe(document.getElementById('screen-root'), { childList: true });
      window.addEventListener('beforeunload', function () { G.State.saveNow(); });
    }
  });
})(window.G = window.G || {});
