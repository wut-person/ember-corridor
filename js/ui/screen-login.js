/* =========================================================
   余烬回廊 · 界面 1：登录界面
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  const SERVERS = ['CN-01 · 灰烬', 'CN-02 · 熔核', 'ASIA-07 · 虚空', 'EU-03 · 破晓', '单机 · 本地回廊'];

  K.register('login', {
    mount: function (node) {
      const saved = G.State.state;

      /* ---------- 背景层 ---------- */
      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);
      U.emberField(bg, 34, { cyan: true, big: true });

      /* ---------- 主体 ---------- */
      const wrap = U.el('div', 'login-wrap');

      /* 左侧：LOGO 与世界观 */
      const hero = U.el('div', 'login-hero');
      hero.innerHTML =
        '<div class="logo-line"><div class="logo-mark">🔥</div>' +
        '<div><div class="logo-text">余烬回廊</div>' +
        '<div class="logo-sub">EMBER CORRIDOR</div></div></div>' +
        '<div class="logo-desc">' +
        '回廊每隔一百年燃起一次。它把无数世界的地板、矿道与熔炉拼在一起，' +
        '用一层层的房间筛选还愿意往前走的人。<br>' +
        '你是一名驯火者——带着一把会随你成长的武器，从第一层开始，' +
        '清空房间、拾取余烬、把守门者留在身后。' +
        '</div>' +
        '<div class="logo-tags">' +
        '<span class="tag-chip">横版 · 平台动作</span>' +
        '<span class="tag-chip">Roguelike · 逐层推进</span>' +
        '<span class="tag-chip">武器 16 种 · 词条随机</span>' +
        '<span class="tag-chip">衣物外观实时换装</span>' +
        '</div>';
      wrap.appendChild(hero);

      /* 右侧：登录面板 */
      const panel = U.el('div', 'panel glow login-panel');
      panel.innerHTML = '<h3>进入回廊</h3><div class="hint">输入代号，选择外貌，开始你的第一次远征。</div>';

      const form = U.el('div', 'login-form');

      /* 代号 */
      const nameBox = U.el('div');
      nameBox.innerHTML = '<label class="field-label">驯火者代号</label>';
      const nameInput = U.el('input', 'input');
      nameInput.type = 'text';
      nameInput.maxLength = 12;
      nameInput.placeholder = '例如：灰烬行者';
      nameInput.value = saved.account.online ? saved.account.name : '';
      nameBox.appendChild(nameInput);
      form.appendChild(nameBox);

      /* 服务器 */
      const srvBox = U.el('div');
      srvBox.innerHTML = '<label class="field-label">回廊入口</label>';
      const srvSel = U.el('select', 'input');
      SERVERS.forEach(function (s) {
        const o = U.el('option', null, s);
        o.value = s;
        srvSel.appendChild(o);
      });
      srvSel.value = saved.account.server || SERVERS[0];
      srvBox.appendChild(srvSel);
      form.appendChild(srvBox);

      /* 外貌 */
      const avBox = U.el('div');
      avBox.innerHTML = '<label class="field-label">初始外貌（可在大厅试衣镜更换）</label>';
      const avRow = U.el('div', 'avatar-row');
      let picked = saved.account.look || G.LOOKS[0].id;
      G.LOOKS.forEach(function (lk) {
        const b = U.el('div', 'av-pick' + (lk.id === picked ? ' on' : ''));
        b.title = lk.name;
        const cv = U.el('canvas');
        b.appendChild(cv);
        b.onclick = function () {
          picked = lk.id;
          U.qsa('.av-pick', avRow).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          G.Audio.play('click');
        };
        avRow.appendChild(b);
        /* 小头像：画出该外观的头部特写 */
        requestAnimationFrame(function () { drawAvatarChip(cv, lk); });
      });
      avBox.appendChild(avRow);
      form.appendChild(avBox);

      /* 记住我 */
      const footRow = U.el('div', 'remember');
      const cb = U.el('input');
      cb.type = 'checkbox';
      cb.checked = true;
      footRow.appendChild(cb);
      footRow.appendChild(U.el('span', null, '记住本机进度（自动存档）'));
      form.appendChild(footRow);

      /* 按钮 */
      const btnRow = U.el('div', 'row gap8');
      const enter = K.btn('⚔️ 开始远征', 'primary block', function () {
        doLogin(false);
      });
      enter.style.flex = '1';
      btnRow.appendChild(enter);
      form.appendChild(btnRow);

      const hasSave = !!(saved.account && saved.account.lvl > 1);
      if (hasSave) {
        const quick = K.btn('↩ 继续上次进度（Lv.' + saved.account.lvl + ' · ' + U.esc(saved.account.name) + '）', 'cyan block', function () {
          doLogin(true);
        });
        form.appendChild(quick);
      }

      const bottom = U.el('div', 'login-foot',
        '<span>v0.1 原型 · 纯前端单机</span><span>F11 全屏 · Esc 返回</span>');
      panel.appendChild(form);
      panel.appendChild(bottom);

      const note = U.el('div', 'login-side-note',
        '<b class="cyan">操作预览：</b><br>' +
        '移动 <b>A / D</b>　跳跃 <b>空格</b>（可二段跳）　冲刺 <b>Shift</b><br>' +
        '攻击 <b>鼠标左键</b>　重击 <b>右键</b>　战技 <b>Q</b>　道具 <b>F</b><br>' +
        '暂停 <b>Esc</b> · 切换武器 <b>1~3</b>');
      panel.appendChild(note);
      wrap.appendChild(panel);
      node.appendChild(wrap);

      /* ---------- 登录逻辑 ---------- */
      function doLogin(quick) {
        const name = quick ? saved.account.name : (nameInput.value || '').trim();
        if (!quick && name.length < 1) {
          K.toast('请输入驯火者代号', 'err');
          nameInput.focus();
          return;
        }
        const st = G.State.state;
        st.account.name = name;
        st.account.server = srvSel.value;
        st.account.look = picked;
        st.account.online = true;
        st.account.createdAt = st.account.createdAt || Date.now();
        G.State.saveNow();
        G.Audio.play('login');
        K.clearHistory();
        /* 首次进入给一把初始武器 */
        if (!G.State.state.ownedWeapons.length) {
          const w = JSON.parse(JSON.stringify(G.Weapons.get('w_ember_blade')));
          w.uid = U.uid('w');
          w.instName = w.name;
          G.State.addWeapon(w);
          G.State.equipWeapon(w.uid);
          const c = JSON.parse(JSON.stringify(G.Clothing.get('b_leather_vest')));
          c.uid = U.uid('c');
          G.State.addClothing(c);
          G.State.equipCloth(c.uid);
        } else if (!G.State.state.equipped.weapon) {
          G.State.equipWeapon(G.State.state.ownedWeapons[0].uid);
        }
        K.go('home');
      }

      enter.onclick = function () { G.Audio.play('click'); doLogin(false); };
      nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(false); });
      setTimeout(function () { if (!nameInput.value) nameInput.focus(); }, 300);
    }
  });

  /* 外观头像小图：直接复用游戏内的角色渲染，保证与战斗中的形象一致 */
  function drawAvatarChip(canvas, lk) {
    G.Sprites.drawFaceChip(canvas, lk, 1.5);
  }
})(window.G = window.G || {});
