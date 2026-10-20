/* =========================================================
   余烬回廊 · UI 工具包（屏幕管理 / 弹窗 / 气泡 / 组件）
   ========================================================= */
(function (G) {
  const U = G.U;

  const K = {
    current: null,
    screen: null,
    params: null,
    screens: {},

    /* ---------------- 屏幕管理 ---------------- */
    register: function (name, def) { K.screens[name] = def; },

    go: function (name, params) {
      const def = K.screens[name];
      if (!def) { console.warn('未注册的界面：' + name); return; }
      const root = document.getElementById('screen-root');
      const old = K.screen;
      K.closeAllTips();
      /* 旧界面的尺寸监听与动画回调一并清理，避免离屏界面继续绘制 */
      K.clearResize();
      if (K.screenStop) { try { K.screenStop(); } catch (e) { } K.screenStop = null; }
      if (old && old.parentNode) {
        old.classList.add('leaving');
        const kill = function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n); }; };
        old.addEventListener('animationend', kill(old), { once: true });
        setTimeout(kill(old), 320);
      }
      const node = U.el('div', 'screen screen-' + name);
      node.dataset.screen = name;
      root.appendChild(node);
      K.screen = node;
      K.current = name;
      K.params = params || {};
      try { def.mount(node, K.params); } catch (e) { console.error('界面挂载失败：' + name + ' ' + (e && e.stack || e)); }
      if (def.after && def.afterUnmount !== false) { }
      if (def.enter) def.enter(K.params);
      K.emitResize();
      K.bindTips(node);
      return node;
    },
    back: function () {
      const hist = K.history || (K.history = []);
      const prev = hist.pop();
      if (prev) { G.Audio.play('back'); K.go(prev.name, prev.params); }
    },
    pushHistory: function (name, params) {
      (K.history = K.history || []).push({ name: name, params: params });
    },
    clearHistory: function () { K.history = []; },
    emitResize: function () {
      const w = window.innerWidth, h = window.innerHeight;
      (K.resizeHandlers || []).forEach(function (fn) { try { fn(w, h); } catch (e) { } });
    },
    /** 注册尺寸变化回调，返回取消函数；离开界面时会被自动清理 */
    onResize: function (fn) {
      K.resizeHandlers = K.resizeHandlers || [];
      K.resizeHandlers.push(fn);
      return function () {
        const i = K.resizeHandlers.indexOf(fn);
        if (i >= 0) K.resizeHandlers.splice(i, 1);
      };
    },
    clearResize: function () { K.resizeHandlers = []; },
    /** 注册界面卸载时的清理回调 */
    onUnmount: function (fn) {
      const prev = K.screenStop;
      K.screenStop = function () { if (prev) { try { prev(); } catch (e) { } } try { fn(); } catch (e) { } };
    },

    /* ---------------- Toast ---------------- */
    toast: function (msg, kind, ms) {
      const layer = document.getElementById('toast-layer');
      if (!layer) return;
      const ic = kind === 'err' ? '⚠️' : (kind === 'warn' ? '❗' : '✦');
      const t = U.el('div', 'toast ' + (kind || ''), '<span class="ic">' + ic + '</span><span>' + msg + '</span>');
      layer.appendChild(t);
      setTimeout(function () {
        t.classList.add('out');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
      }, ms || 2200);
    },

    /* ---------------- 弹窗 ---------------- */
    modal: function (opt) {
      const layer = document.getElementById('modal-layer');
      U.clear(layer);
      const box = U.el('div', 'modal');
      box.innerHTML =
        '<h3>' + (opt.title || '提示') + '</h3>' +
        '<div class="modal-body">' + (opt.body || '') + '</div>' +
        '<div class="modal-foot"></div>';
      const foot = U.qs('.modal-foot', box);
      (opt.buttons || [{ label: '知道了' }]).forEach(function (b) {
        const btn = U.el('button', 'btn ' + (b.cls || 'ghost'), b.label);
        btn.onclick = function () {
          K.closeModal();
          if (b.onClick) b.onClick();
        };
        foot.appendChild(btn);
      });
      layer.appendChild(box);
      layer.classList.add('on');
      layer.onclick = function (e) { if (e.target === layer && opt.dismiss !== false) K.closeModal(); };
      G.Audio.play('ui_open');
      return box;
    },
    closeModal: function () {
      const layer = document.getElementById('modal-layer');
      if (!layer) return;
      layer.classList.remove('on');
      U.clear(layer);
    },
    confirm: function (title, body, onOk) {
      K.modal({
        title: title, body: body,
        buttons: [
          { label: '取消', cls: 'ghost' },
          { label: '确认', cls: 'primary', onClick: onOk }
        ]
      });
    },

    /* ---------------- Tooltip ---------------- */
    closeAllTips: function () {
      const layer = document.getElementById('tooltip-layer');
      if (layer) U.clear(layer);
    },
    showTip: function (html, x, y) {
      const layer = document.getElementById('tooltip-layer');
      if (!layer) return;
      U.clear(layer);
      const tip = U.el('div', 'tooltip', html);
      layer.appendChild(tip);
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let left = x + 16, top = y + 12;
      if (left + w > window.innerWidth - 12) left = x - w - 16;
      if (top + h > window.innerHeight - 12) top = Math.max(10, window.innerHeight - h - 12);
      tip.style.left = Math.max(10, left) + 'px';
      tip.style.top = Math.max(10, top) + 'px';
    },
    /** 绑定 data-tip 属性（HTML 内容） */
    bindTips: function (root) {
      U.qsa('[data-tip]', root || document).forEach(function (el) {
        if (el.__tipBound) return;
        el.__tipBound = true;
        el.addEventListener('mouseenter', function (ev) {
          K.showTip(el.getAttribute('data-tip'), ev.clientX, ev.clientY);
        });
        el.addEventListener('mousemove', function (ev) {
          const layer = document.getElementById('tooltip-layer');
          if (layer && layer.firstChild) K.showTip(el.getAttribute('data-tip'), ev.clientX, ev.clientY);
        });
        el.addEventListener('mouseleave', K.closeAllTips);
      });
    },

    /* ---------------- 通用组件 ---------------- */
    btn: function (label, cls, onClick) {
      const b = U.el('button', 'btn ' + (cls || 'ghost'), label);
      if (onClick) b.onclick = function (e) { G.Audio.play('click'); onClick(e, b); };
      return b;
    },
    iconBtn: function (icon, title, onClick) {
      const b = U.el('button', 'icon-btn', icon);
      b.title = title || '';
      b.onclick = function () { G.Audio.play('click'); if (onClick) onClick(); };
      return b;
    },
    tabs: function (items, activeId, onPick) {
      const wrap = U.el('div', 'tabs');
      items.forEach(function (it) {
        const t = U.el('div', 'tab' + (it.id === activeId ? ' on' : ''),
          it.icon ? it.icon + ' ' + it.label : it.label);
        if (it.n != null) t.appendChild(U.el('span', 'n', it.n));
        t.onclick = function () {
          if (it.id === activeId) return;
          G.Audio.play('click');
          onPick(it.id);
        };
        wrap.appendChild(t);
      });
      return wrap;
    },
    prog: function (cur, max, cls) {
      const p = U.clamp(max ? cur / max : 0, 0, 1) * 100;
      return '<div class="prog ' + (cls || '') + '"><i style="width:' + p + '%"></i></div>';
    },
    statLine: function (label, cur, max, fmt, color) {
      const p = U.clamp(max ? cur / max : 0, 0, 1) * 100;
      return '<div class="statline">' +
        '<span class="dim">' + label + '</span>' +
        '<span class="track"><i class="' + (color || '') + '" style="width:' + p + '%"></i></span>' +
        '<span class="val">' + (fmt || U.num)(cur) + '</span>' +
        '</div>';
    },
    kv: function (k, v) {
      return '<div class="kv-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    },

    /* ---------------- 槽位渲染 ---------------- */
    /** 装备/物品槽 */
    slotHTML: function (opt) {
      const q = opt.rarity || 0;
      const cls = ['slot', 'rq-' + q];
      if (opt.sm) cls.push('sm');
      if (opt.equipped) cls.push('equipped');
      let inner = opt.svg || '<span class="empty-hint">' + (opt.hint || '空') + '</span>';
      if (opt.count != null && opt.count > 1) inner += '<span class="cnt">' + opt.count + '</span>';
      if (opt.lvl) inner += '<span class="lvl">Lv.' + opt.lvl + '</span>';
      if (opt.mark) inner += '<span class="mark">' + opt.mark + '</span>';
      if (opt.equipped) inner += '<span class="eqdot"></span>';
      return '<div class="' + cls.join(' ') + '"' +
        (opt.attrs || '') +
        (opt.tip ? ' data-tip="' + U.esc(opt.tip) + '"' : '') +
        '>' + inner + '</div>';
    },

    /* 物品 tooltip 内容 */
    itemTip: function (item, count) {
      const q = item.rarity || 0;
      const kindName = { consume: '消耗品', material: '材料', currency: '货币', blueprint: '图纸' }[item.kind] || '物品';
      let h = '<h4 class="' + U.qClass(q) + '">' + item.name + (count > 1 ? ' ×' + count : '') + '</h4>';
      h += '<div class="row gap6" style="margin-bottom:6px"><span class="rarity-tag ' + U.qClass(q) + '">' + U.qName(q) + '</span><span class="mute tiny">' + kindName + '</span></div>';
      h += '<div class="dim">' + (item.desc || '') + '</div>';
      if (item.hp) h += K.kv('回复生命', '+' + item.hp);
      if (item.stam) h += K.kv('回复体力', '+' + item.stam);
      if (item.buff) h += K.kv('增益', item.buff.name + '（' + item.buff.dur + 's）');
      if (item.throw) h += K.kv('投掷伤害', item.throw.dmg || '—');
      if (item.revive) h += K.kv('效果', '死亡复活一次');
      if (item.price) h += K.kv('参考售价', item.price + ' 余烬币');
      if (item.flavor) h += '<div class="flavor">' + item.flavor + '</div>';
      return h;
    },

    /* 武器 tooltip 内容 */
    weaponTip: function (w) {
      const q = w.rarity || 0;
      const info = G.WTYPE_INFO[w.wtype] || { label: '武器' };
      let h = '<h4 class="' + U.qClass(q) + '">' + (w.instName || w.name) + '</h4>';
      h += '<div class="row gap6" style="margin-bottom:6px"><span class="rarity-tag ' + U.qClass(q) + '">' + U.qName(q) + '</span><span class="mute tiny">' + info.label + '</span><span class="mute tiny">Lv.' + (w.lvl || 1) + '</span></div>';
      h += K.kv('攻击力', '<span class="ember">' + w.atk + '</span>');
      h += K.kv('攻速', w.spd.toFixed(2) + ' 次/秒');
      h += K.kv('攻击距离', w.reach + ' px');
      h += K.kv('暴击率', Math.round(w.crit * 100) + '%');
      h += K.kv('重击倍率', '×' + w.heavy);
      if (w.passive) h += '<div class="flavor" style="font-style:normal;color:var(--cyan)">被动：' + w.passive + '</div>';
      if (w.desc) h += '<div class="dim" style="margin-top:6px">' + w.desc + '</div>';
      if (w.flavor) h += '<div class="flavor">' + w.flavor + '</div>';
      return h;
    },

    /* 衣物 tooltip 内容 */
    clothTip: function (c) {
      const q = c.rarity || 0;
      const slot = G.SLOTS.find(function (s) { return s.id === c.slot; });
      let h = '<h4 class="' + U.qClass(q) + '">' + c.name + '</h4>';
      h += '<div class="row gap6" style="margin-bottom:6px"><span class="rarity-tag ' + U.qClass(q) + '">' + U.qName(q) + '</span><span class="mute tiny">' + (slot ? slot.label : '') + '</span><span class="mute tiny">Lv.' + c.lvl + '</span></div>';
      if (c.def) h += K.kv('防御', '+' + c.def);
      if (c.hp) h += K.kv('生命上限', '+' + c.hp);
      if (c.stam) h += K.kv('体力上限', '+' + c.stam);
      if (c.spd) h += K.kv('移动速度', (c.spd > 0 ? '+' : '') + c.spd + '%');
      if (c.crit) h += K.kv('暴击率', '+' + c.crit + '%');
      if (c.desc) h += '<div class="dim" style="margin-top:6px">' + c.desc + '</div>';
      if (c.flavor) h += '<div class="flavor">' + c.flavor + '</div>';
      return h;
    },

    /* ---------------- 顶栏 ---------------- */
    topbar: function (opt) {
      const o = opt || {};
      const st = G.State.state;
      const bar = U.el('div', 'topbar');
      const brand = U.el('div', 'brand', '<span class="mini-mark">🔥</span><span>余烬回廊</span>');
      bar.appendChild(brand);

      if (o.crumb) {
        bar.appendChild(U.el('span', 'crumb mute small', '· ' + o.crumb));
      }
      if (o.backTo) {
        const b = K.btn('‹ 返回', 'sm ghost', function () {
          G.Audio.play('back');
          K.go(o.backTo, o.backParams);
        });
        bar.appendChild(b);
      }
      bar.appendChild(U.el('div', 'spacer'));

      const coin = U.el('div', 'cur-item', G.Icons.coin() + '<b class="gold">' + U.commas(st.wallet.i_ember || 0) + '</b>');
      coin.querySelector('svg').setAttribute('width', '18');
      coin.querySelector('svg').setAttribute('height', '18');
      bar.appendChild(coin);

      const relic = U.el('div', 'cur-item', G.Icons.relic() + '<b class="cyan">' + (st.wallet.i_relic || 0) + '</b>');
      relic.querySelector('svg').setAttribute('width', '18');
      relic.querySelector('svg').setAttribute('height', '18');
      bar.appendChild(relic);

      const chip = U.el('div', 'player-chip');
      chip.innerHTML = '<span class="pav"></span><span><span class="pn">' + U.esc(st.account.name) + '</span><br><span class="pl">Lv.' + st.account.lvl + ' · 战力 ' + U.commas(G.State.power()) + '</span></span>';
      chip.onclick = function () { G.Audio.play('click'); K.go('character', { from: o.backTo || 'lobby' }); };
      bar.appendChild(chip);

      bar.appendChild(K.iconBtn('🔊', '音效开关', function () {
        const on = G.Audio.toggle();
        G.State.state.settings.sfx = on;
        G.State.save();
        K.toast('音效已' + (on ? '开启' : '关闭'), 'ok');
      }));
      bar.appendChild(K.iconBtn('🚪', '返回登录', function () {
        K.confirm('返回登录界面', '当前进度会自动保存。确定要退出到登录界面吗？', function () {
          G.State.saveNow();
          G.Audio.play('back');
          K.clearHistory();
          K.go('login');
        });
      }));

      /* 头像小画布 */
      setTimeout(function () {
        const pav = U.qs('.pav', chip);
        if (!pav) return;
        const cv = U.el('canvas');
        pav.appendChild(cv);
        K.doll(cv, 3, null, false);
      }, 0);
      return bar;
    },

    /* ---------------- 角色预览画布（带动画） ---------------- */
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} scale 像素倍率
     * @param {string} action idle | pose
     * @param {boolean} animate
     * @param {number} maxH 可选：限制画布高度（像素倍率会自动下调以适配）
     */
    doll: function (canvas, scale, action, animate, maxH) {
      const F = G.Sprites.FRAME;
      let s = scale || 4;
      if (maxH) s = Math.max(1.5, Math.min(s, maxH / F.h));
      s = Math.max(1.5, Math.round(s * 2) / 2);      /* 允许 0.5 档，尺寸更稳定 */
      const w = Math.round(F.w * s), h = Math.round(F.h * s);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      const state = G.State.state;
      const look = G.getLook(state.account.look);
      const equip = G.Sprites.equipFromState();
      let raf = 0;
      const t0 = performance.now();
      let last = 0;

      function frame(now) {
        const t = (now - t0) / 1000;
        if (canvas.__dead || !canvas.isConnected) return;
        /* 60 FPS：每帧都重绘（原来限制 33ms = 30fps，动作会一顿一顿） */
        last = now;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        let act = action || 'idle', atkT = null;
        if (animate) {
          const p = (t % 2.6) / 2.6;
          if (p < 0.16) { act = 'attack'; atkT = p / 0.16; }
          else if (p > 0.62 && p < 0.75) act = 'run';
        }
        G.Sprites.preview(c, w, s, t, { look: look, equip: equip, action: act, atkT: atkT });
        if (animate) raf = requestAnimationFrame(frame);
      }
      /* 强制一次布局，再在下一帧绘制，避免刚插入 DOM 时的重排清空画布 */
      void canvas.getBoundingClientRect();
      raf = requestAnimationFrame(frame);
      canvas.__dead = false;
      function stop() {
        canvas.__dead = true;
        if (raf) cancelAnimationFrame(raf);
      }
      return stop;
    },

    /* ---------------- 面板容器 ---------------- */
    panel: function (title, cls, rightNode) {
      const p = U.el('div', 'panel ' + (cls || ''));
      if (title) {
        const head = U.el('div', 'panel-head', '<span class="bar"></span><h2>' + title + '</h2>');
        head.appendChild(U.el('div', 'spacer grow'));
        if (rightNode) head.appendChild(rightNode);
        p.appendChild(head);
      }
      return p;
    },
    panelBody: function (panel, cls) {
      const b = U.el('div', 'panel-body ' + (cls || ''));
      panel.appendChild(b);
      return b;
    }
  };

  /* 全局委托：点击 / 悬停音效 */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.btn,.tab,.slot,.menu-item,.lnav,.hotspot,.shop-card,.quest-card,.talent,.card,input,select')) {
      G.Audio.unlock();
    }
  }, true);
  document.addEventListener('mouseover', function (e) {
    const t = e.target;
    if (t && t.closest && t.closest('.btn,.tab,.menu-item,.lnav,.hotspot,.shop-card,.talent') && !t.__hovered) {
      t.__hovered = true;
      setTimeout(function () { t.__hovered = false; }, 60);
      G.Audio.play('hover');
    }
  }, true);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const layer = document.getElementById('modal-layer');
      if (layer && layer.classList.contains('on')) { K.closeModal(); return; }
      if (K.current && K.current !== 'login' && K.current !== 'home' && K.current !== 'game') K.back();
    }
  });
  window.addEventListener('resize', U.debounce(function () { K.emitResize(); }, 120));

  G.Screen = K;
  G.toast = function (m, k) { K.toast(m, k); };
})(window.G = window.G || {});
