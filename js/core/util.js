/* =========================================================
   余烬回廊 · 核心工具
   ========================================================= */
(function (G) {
  const U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rnd = function (a, b) { return a + Math.random() * (b - a); };
  U.rndInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.uid = function (p) { return (p || 'u') + Math.random().toString(36).slice(2, 9); };
  U.dist = function (x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  U.aabb = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };
  U.num = function (n) { return (Math.round(n * 10) / 10).toString(); };
  U.pct = function (n) { return Math.round(n * 100) + '%'; };
  U.commas = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* 千分位 + 万/亿 简写 */
  U.shortNum = function (n) {
    n = Math.round(n);
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(n);
  };

  /* 防抖 */
  U.debounce = function (fn, ms) {
    let t = 0;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 120);
    };
  };

  /* ---------- 元素构造 ---------- */
  U.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.frag = function () { return document.createDocumentFragment(); };
  U.qs = function (sel, root) { return (root || document).querySelector(sel); };
  U.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

  /* 简易 HTML 转义 */
  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- 稀有度 ---------- */
  U.qName = function (q) { return (G.QNAME && G.QNAME[q]) || '普通'; };
  U.qClass = function (q) { return 'q' + (q || 0); };
  U.rqClass = function (q) { return 'rq-' + (q || 0); };

  /* ---------- 属性条最大值（用于百分比显示） ---------- */
  U.STAT_MAX = { atk: 60, spd: 3.6, reach: 140, crit: 0.3, def: 45, hp: 260, stam: 140 };

  /* ---------- Canvas 初始化（含 HiDPI） ---------- */
  U.fitCanvas = function (canvas, w, h, dpr) {
    const r = dpr || Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * r);
    canvas.height = Math.round(h * r);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  };

  /* ---------- 余烬粒子背景 ---------- */
  U.emberField = function (host, count, opts) {
    const o = opts || {};
    const n = count || 26;
    for (let i = 0; i < n; i++) {
      const d = U.el('i', 'ember-dot');
      const size = U.rnd(2, o.big ? 5 : 3.4);
      d.style.left = U.rnd(0, 100) + '%';
      d.style.width = size + 'px';
      d.style.height = size + 'px';
      d.style.animationDuration = U.rnd(7, 15) + 's';
      d.style.animationDelay = (-U.rnd(0, 12)) + 's';
      d.style.setProperty('--dx', U.rnd(-70, 70) + 'px');
      if (o.cyan && Math.random() < 0.35) {
        d.style.background = '#4fd7ff';
        d.style.boxShadow = '0 0 10px 2px rgba(79,215,255,.55)';
      }
      host.appendChild(d);
    }
  };

  /* ---------- 简易插值动画 ---------- */
  U.animate = function (from, to, dur, onStep, onDone, ease) {
    const t0 = performance.now();
    const e = ease || function (t) { return 1 - Math.pow(1 - t, 3); };
    function frame(now) {
      let t = U.clamp((now - t0) / dur, 0, 1);
      onStep(from + (to - from) * e(t), t);
      if (t < 1) requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    requestAnimationFrame(frame);
  };

  G.U = U;
})(window.G = window.G || {});
