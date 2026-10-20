/* =========================================================
   余烬回廊 · 细分系统 1：任务角色（角色 / 衣物 / 外观 / 属性）
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  K.register('character', {
    mount: function (node, params) {
      const st = G.State.state;
      let activeSlot = (params && params.slot) || 'head';
      let wearing = false;

      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);

      node.appendChild(K.topbar({ crumb: '试衣镜 · 角色与衣物', backTo: 'lobby', backParams: { type: 'hub' } }));

      const wrap = U.el('div', 'sub-wrap');
      const head = U.el('div', 'sub-head');
      head.innerHTML = '<span class="bar" style="width:4px;height:22px;border-radius:3px;background:linear-gradient(180deg,var(--ember),var(--ember-2));display:inline-block"></span>' +
        '<h2>角色与衣物</h2><span class="crumb">换装会实时改变战斗中的像素外观</span>';
      wrap.appendChild(head);

      const body = U.el('div', 'sub-body char-grid');
      wrap.appendChild(body);

      /* ---------------- 左：槽位 + 外观 ---------------- */
      const colL = U.el('div', 'col gap12 col-scroll');

      const slotCard = K.panel('装备槽位');
      const slb = K.panelBody(slotCard);
      const slotList = U.el('div', 'interact-list');
      G.SLOTS.forEach(function (sl) {
        const c = G.State.clothAt(sl.id);
        const row = U.el('div', 'interact-row rq-' + (c ? c.rarity : 0));
        row.style.cursor = 'pointer';
        row.style.borderColor = sl.id === activeSlot ? 'rgba(255,138,60,.6)' : '';
        row.innerHTML =
          '<div class="ir-ic">' + (c ? G.Icons.cloth(c) : sl.icon) + '</div>' +
          '<div class="ir-tx"><div class="ir-t">' + sl.label + '</div>' +
          '<div class="ir-d ' + (c ? U.qClass(c.rarity) : '') + '">' + (c ? c.name : '未装备') + '</div></div>';
        if (c) row.setAttribute('data-tip', K.clothTip(c));
        row.onclick = function () {
          activeSlot = sl.id;
          G.Audio.play('click');
          renderWardrobe();
        };
        slotList.appendChild(row);
      });
      slb.appendChild(slotList);
      colL.appendChild(slotCard);

      /* ---------------- 左：外观选择（性别筛选 + 角色网格 + 旋转预览） ---------------- */
      const lookCard = K.panel('人物选择');
      const lkb = K.panelBody(lookCard);

      /* 性别切换 */
      let genderFilter = (G.getLook(st.account.look).gender) || 'm';
      const sexRow = U.el('div', 'sex-row');
      const sexBtns = {};
      [['m', '♂ 男'], ['f', '♀ 女'], ['all', '全部']].forEach(function (pair) {
        const b = U.el('div', 'sex-btn' + (genderFilter === pair[0] ? ' on' : ''), pair[1]);
        b.onclick = function () {
          genderFilter = pair[0];
          Object.keys(sexBtns).forEach(function (k) { sexBtns[k].classList.toggle('on', k === genderFilter); });
          G.Audio.play('click');
          renderPicks();
        };
        sexBtns[pair[0]] = b;
        sexRow.appendChild(b);
      });
      lkb.appendChild(sexRow);

      /* 角色网格 */
      const lookGrid = U.el('div', 'look-grid');
      lkb.appendChild(lookGrid);

      /* 选中的角色信息 */
      const lookInfo = U.el('div', 'look-info');
      lkb.appendChild(lookInfo);

      function renderPicks() {
        lookGrid.innerHTML = '';
        const list = G.looksOf(genderFilter);
        list.forEach(function (lk) {
          const b = U.el('div', 'look-card' + (lk.id === st.account.look ? ' on' : ''));
          b.title = lk.name + ' · ' + lk.title;
          const cv = U.el('canvas');
          b.appendChild(cv);
          const tag = U.el('div', 'look-tag', (lk.gender === 'f' ? '♀' : '♂') + ' ' + lk.name);
          b.appendChild(tag);
          b.onclick = function () {
            pickLook(lk, b);
          };
          lookGrid.appendChild(b);
          requestAnimationFrame(function () { drawChip(cv, lk); });
        });
        syncInfo();
      }

      function syncInfo() {
        const cur = G.getLook(st.account.look);
        lookInfo.innerHTML =
          '<div class="li-name">' + U.esc(cur.name) + '</div>' +
          '<div class="li-title">' + U.esc(cur.title) + '</div>' +
          '<div class="li-quote">' + U.esc(cur.quote || '') + '</div>' +
          '<div class="li-tip">点击卡片选择 · 选中的角色会在右侧立绘中旋转展示</div>';
      }

      /* 选择：更新存档 → 播放旋转动画 → 刷新 */
      function pickLook(lk, cardEl) {
        const same = lk.id === st.account.look;
        st.account.look = lk.id;
        G.State.save();
        G.Audio.play('click');
        Array.prototype.forEach.call(lookGrid.children, function (el) { el.classList.remove('on'); });
        if (cardEl) cardEl.classList.add('on');
        syncInfo();
        K.toast((same ? '当前人物：' : '已选择人物：') + lk.name, 'ok');
        startSpin();
      }

      lkb.appendChild(U.el('div', 'lock-tip', '<span>人物决定肤色 / 发色 / 瞳色与造型，衣物决定身体配色</span>'));
      colL.appendChild(lookCard);
      body.appendChild(colL);

      /* ---------------- 中：大立绘（人物选择时旋转展示） ---------------- */
      const colM = U.el('div', 'col gap12');
      const stageCard = U.el('div', 'avatar-big panel');
      const cv = U.el('canvas');
      cv.dataset.role = 'char-doll';
      stageCard.appendChild(cv);
      const spinBadge = U.el('div', 'spin-badge', '旋转展示中…');
      spinBadge.style.display = 'none';
      stageCard.appendChild(spinBadge);
      const actions = U.el('div', 'avatar-actions');
      const poseBtn = K.btn('▶ 播放动作', 'sm ghost', function () { wearing = !wearing; poseBtn.innerHTML = wearing ? '⏸ 停止动作' : '▶ 播放动作'; redraw(); });
      actions.appendChild(poseBtn);
      actions.appendChild(K.btn('🔁 转一圈', 'sm ghost', function () { startSpin(); }));
      actions.appendChild(K.btn('🎒 打开背包', 'sm ghost', function () { K.pushHistory('character', { slot: activeSlot }); K.go('inventory'); }));
      stageCard.appendChild(actions);
      colM.appendChild(stageCard);

      /* 属性面板 */
      const statCard = K.panel('属性总览', 'glow');
      const stb = K.panelBody(statCard);
      colM.appendChild(statCard);
      body.appendChild(colM);

      /* ---------------- 右：衣柜 ---------------- */
      const colR = U.el('div', 'col gap12 col-scroll');
      const wardCard = K.panel('衣柜');
      const wh = U.qs('.panel-head', wardCard);
      const slotTag = U.el('span', 'tiny dim');
      wh.appendChild(slotTag);
      const wb = K.panelBody(wardCard);
      colR.appendChild(wardCard);

      /* 天赋入口提示 */
      const tCard = K.panel('改造与天赋');
      const tb = K.panelBody(tCard);
      tb.innerHTML = '<div class="mute small" style="line-height:1.9">衣柜里只显示已拥有的衣物。<br>更多衣物可通过远征掉落、商店购买获得。</div>';
      tb.appendChild(K.btn('⚒️ 前往铁砧（天赋 / 强化）', 'sm primary block', function () {
        K.pushHistory('character', { slot: activeSlot });
        K.go('mods');
      }));
      colR.appendChild(tCard);
      body.appendChild(colR);
      node.appendChild(wrap);

      /* ---------------- 渲染函数 ---------------- */
      let stopDoll = null;
      let spinRaf = null;

      /* 旋转展示：正面 → 侧面 → 背面 → 侧面 → 正面，共约 1.5 秒。
         用「横向压缩 + 背视帧」模拟 3D 转身（像素画的常规做法）。 */
      let spinStart = 0;
      function startSpin() {
        if (spinRaf) { cancelAnimationFrame(spinRaf); spinRaf = null; }
        if (wearing) { poseBtn.click(); }              /* 旋转展示时先停下动作动画 */
        spinStart = performance.now();
        spinBadge.style.display = '';
        const DUR = 1500;
        const step = function (now) {
          const p = Math.min(1, (now - spinStart) / DUR);
          drawSpinFrame(p);
          if (p < 1) {
            spinRaf = requestAnimationFrame(step);
          } else {
            spinRaf = null;
            spinBadge.style.display = 'none';
            redraw();                                   /* 回到静态立绘 */
          }
        };
        spinRaf = requestAnimationFrame(step);
      }

      function drawSpinFrame(p) {
        const F = G.Sprites.FRAME;
        const cssW = cv.clientWidth || 260, cssH = cv.clientHeight || 380;
        const c = cv.getContext('2d');
        const dpr = cv.width ? cv.width / cssW : 1;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, cssW, cssH);
        /* 地面投影 */
        const gy = cssH - 26;
        c.globalAlpha = 0.3; c.fillStyle = '#000';
        c.beginPath(); c.ellipse(cssW / 2, gy + 2, 26, 7, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        const look = G.getLook(st.account.look);
        /* 一圈：角度 = p * 2π
           - 背视：|角度| 落在后半圈时切到背视帧
           - 横向压缩：|cos| 映射到 0.55~1，侧面时略窄但不至于变成一条线 */
        const ang = p * Math.PI * 2;
        const ca = Math.cos(ang);
        const backView = ca < 0;
        const squash = 0.55 + 0.45 * Math.abs(ca);
        const s = Math.min(cssW / (F.w + 26), cssH / (F.h + 30));
        const ph = performance.now() / 260;
        c.save();
        c.translate(cssW / 2, gy);
        G.Sprites.hero(c, {
          x: 0, y: 0, s: s, ph: ph, moving: false, action: 'idle', atkT: null, aim: 0,
          look: look, equip: G.Sprites.equipFromState ? G.Sprites.equipFromState() : {},
          backView: backView, squashX: squash, flip: false
        });
        c.restore();
      }

      function renderStats() {
        const t = G.State.totals();
        const slotInfo = G.SLOTS.find(function (s) { return s.id === activeSlot; });
        stb.innerHTML =
          '<div class="grid-bag" style="grid-template-columns:1fr;gap:8px">' +
          K.statLine('攻击力', t.atk, U.STAT_MAX.atk, function (v) { return Math.round(v); }) +
          K.statLine('攻速', t.spdW, U.STAT_MAX.spd, function (v) { return v.toFixed(2); }, 'cy') +
          K.statLine('攻击距离', t.reach, U.STAT_MAX.reach, function (v) { return Math.round(v); }) +
          K.statLine('暴击率', t.crit * 100, U.STAT_MAX.crit * 100, function (v) { return Math.round(v) + '%'; }, 'vi') +
          K.statLine('防御', t.def, U.STAT_MAX.def, function (v) { return Math.round(v); }, 'cy') +
          K.statLine('生命上限', t.maxHp, U.STAT_MAX.hp + 200, function (v) { return Math.round(v); }) +
          K.statLine('体力上限', t.stamina, U.STAT_MAX.stam, function (v) { return Math.round(v); }) +
          '</div>' +
          '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)">' +
          '<div class="kv-row"><span class="k">战力评估</span><span class="v ember">' + U.commas(G.State.power()) + '</span></div>' +
          '<div class="kv-row"><span class="k">移动速度加成</span><span class="v">' + (t.spd > 0 ? '+' : '') + Math.round(t.spd * 100) + '%</span></div>' +
          '<div class="kv-row"><span class="k">当前武器类型</span><span class="v">' + ((G.WTYPE_INFO[t.wtype] || {}).label || '空手') + '</span></div>' +
          '<div class="kv-row"><span class="k">正在查看</span><span class="v cyan">' + slotInfo.label + '</span></div>' +
          '</div>';
      }

      function renderWardrobe() {
        const slotInfo = G.SLOTS.find(function (s) { return s.id === activeSlot; });
        slotTag.textContent = slotInfo.label + ' · ' + st.ownedClothing.filter(function (c) { return c.slot === activeSlot; }).length + ' 件';
        U.clear(wb);
        /* 槽位当前装备行 */
        const cur = G.State.clothAt(activeSlot);
        const curRow = U.el('div', 'interact-row rq-' + (cur ? cur.rarity : 0));
        curRow.innerHTML = '<div class="ir-ic" style="padding:3px">' + (cur ? G.Icons.cloth(cur) : slotInfo.icon) + '</div>' +
          '<div class="ir-tx"><div class="ir-t">当前装备</div><div class="ir-d ' + (cur ? U.qClass(cur.rarity) : '') + '">' + (cur ? cur.name : '无') + '</div></div>' +
          (cur ? '<button class="btn xs ghost" id="unequip">卸下</button>' : '');
        wb.appendChild(curRow);
        if (cur) {
          curRow.setAttribute('data-tip', K.clothTip(cur));
          U.qs('#unequip', curRow).onclick = function () {
            G.State.unequipSlot(activeSlot);
            K.toast('已卸下 ' + cur.name, 'warn');
            renderAll();
          };
        }

        const grid = U.el('div', 'wardrobe-grid');
        grid.style.marginTop = '12px';
        const owned = st.ownedClothing.filter(function (c) { return c.slot === activeSlot; });
        if (!owned.length) {
          wb.appendChild(U.el('div', 'empty-tip', '这个部位还没有衣物<br><span class="tiny">去远征或商店获取</span>'));
        }
        owned.forEach(function (c) {
          const isOn = st.equipped[c.slot] === c.uid;
          const s = U.el('div', 'slot rq-' + c.rarity + (isOn ? ' equipped' : ''));
          s.innerHTML = G.Icons.cloth(c) + (isOn ? '<span class="eqdot"></span>' : '');
          s.setAttribute('data-tip', K.clothTip(c));
          s.onclick = function () {
            G.State.equipCloth(c.uid);
            K.toast('已装备 ' + c.name, 'ok');
            renderAll();
          };
          grid.appendChild(s);
        });
        wb.appendChild(grid);

        /* 未拥有的一览（灰显） */
        const all = G.Clothing.bySlot(activeSlot).filter(function (c) {
          return !st.ownedClothing.some(function (o) { return o.id === c.id && o.slot === c.slot; });
        });
        if (all.length) {
          wb.appendChild(U.el('div', 'tiny mute', '未收集（' + all.length + '）'));
          const g2 = U.el('div', 'wardrobe-grid');
          all.forEach(function (c) {
            const s = U.el('div', 'slot rq-0');
            s.style.opacity = '.38';
            s.innerHTML = G.Icons.cloth(c);
            s.setAttribute('data-tip', K.clothTip(c) + '<div class="flavor">未获得 · 可掉落或购买</div>');
            g2.appendChild(s);
          });
          wb.appendChild(g2);
        }
        renderStats();
      }

      function redraw() {
        if (stopDoll) stopDoll();
        stopDoll = null;
        const col = stageCard.parentNode;
        const rect = (col || stageCard).getBoundingClientRect();
        const avail = Math.max(240, (rect.height || 480) - 92);
        stopDoll = K.doll(cv, 7, null, wearing, avail);
      }

      function renderAll() { renderPicks(); renderWardrobe(); redraw(); }

      renderAll();
      K.onResize(U.debounce(redraw, 150));
      /* 离开界面时停止立绘动画 */
      K.onUnmount(function () {
        if (stopDoll) stopDoll();
        if (spinRaf) { cancelAnimationFrame(spinRaf); spinRaf = null; }
      });

      const obs = new MutationObserver(function () {
        if (!document.body.contains(node)) {
          if (stopDoll) stopDoll();
          obs.disconnect();
        }
      });
      obs.observe(document.getElementById('screen-root'), { childList: true });
    }
  });

  /* 外观头像小图：复用游戏内角色渲染 */
  function drawChip(canvas, lk) {
    G.Sprites.drawFaceChip(canvas, lk, 1.5);
  }
})(window.G = window.G || {});
