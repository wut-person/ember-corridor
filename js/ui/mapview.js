/* =========================================================
   余烬回廊 · 大地图（M 键）—— 可自由缩放与拖动
   预渲染的整张世界缩略图 + 变换绘制，支持：
     滚轮缩放（以光标为锚点）/ 拖拽平移 / 双击回到玩家 / 点击定位
   ========================================================= */
(function (G) {
  const U = G.U;

  const MapView = {
    isOpen: false,

    /**
     * @param {object} o { thumb, world, player, getMobs }
     */
    open: function (o) {
      const self = this;
      this.thumb = o.thumb;
      this.world = o.world;
      this.player = o.player;
      this.getMobs = o.getMobs || function () { return []; };
      this.THUMB_PX = o.thumb.width / o.world.size;          /* 缩略图每格像素 */
      this.WORLD_PX = o.world.size * this.THUMB_PX;          /* 缩略图总像素 */

      /* 默认缩放：让整张地图大约占满视口的 72% */
      const fit = Math.min(window.innerWidth * 0.72 / this.WORLD_PX,
                           window.innerHeight * 0.66 / this.WORLD_PX);
      this.zoom = U.clamp(fit * 1.35, 0.06, 3);
      this.cx = this.world.size / 2;                          /* 视图中心（格坐标） */
      this.cy = this.world.size / 2;
      this.drag = null;
      this.time = 0;

      this.build();
      this.isOpen = true;
      this.loop();
      return this;
    },

    build: function () {
      const self = this;
      const root = U.el('div', 'map-overlay');
      root.innerHTML =
        '<div class="map-head">' +
        '  <div class="map-title">回廊世界地图 <span class="map-sub">滚轮缩放 · 拖拽平移 · 双击定位 · M / Esc 关闭</span></div>' +
        '  <div class="map-stat" id="map-stat"></div>' +
        '</div>' +
        '<div class="map-tools">' +
        '  <button class="map-btn" data-act="in">＋</button>' +
        '  <button class="map-btn" data-act="out">－</button>' +
        '  <button class="map-btn" data-act="fit">全局</button>' +
        '  <button class="map-btn" data-act="player">回到我</button>' +
        '</div>' +
        '<canvas class="map-canvas" id="map-canvas"></canvas>' +
        '<div class="map-legend">' +
        '  <i style="background:#2f6d92"></i>深水 <i style="background:#5b9ab5"></i>浅水 ' +
        '  <i style="background:#dcc78d"></i>沙滩 <i style="background:#5f9e4a"></i>草地 ' +
        '  <i style="background:#71b057"></i>草甸 <i style="background:#417c3c"></i>森林 ' +
        '  <i style="background:#8a8f8c"></i>岩地 <i style="background:#e2e9f0"></i>雪地' +
        '</div>';
      document.body.appendChild(root);
      this.root = root;
      this.cv = U.qs('#map-canvas', root);
      this.ctx = this.cv.getContext('2d');
      this.statEl = U.qs('#map-stat', root);

      U.qsa('.map-btn', root).forEach(function (b) {
        b.onclick = function () {
          const act = b.dataset.act;
          if (act === 'in') self.setZoom(self.zoom * 1.35);
          else if (act === 'out') self.setZoom(self.zoom / 1.35);
          else if (act === 'fit') self.fitAll();
          else if (act === 'player') self.gotoPlayer(true);
        };
      });

      /* 滚轮缩放（以光标为锚点） */
      this._wheel = function (e) {
        e.preventDefault();
        const r = self.cv.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const before = self.screenToTile(mx, my);
        const k = e.deltaY < 0 ? 1.22 : 1 / 1.22;
        self.setZoom(self.zoom * k);
        const after = self.screenToTile(mx, my);
        /* 保持光标下的地点不动 */
        self.cx += before.x - after.x;
        self.cy += before.y - after.y;
      };
      this.cv.addEventListener('wheel', this._wheel, { passive: false });

      /* 拖拽平移 + 双击定位 */
      this._down = function (e) {
        self.drag = { x: e.clientX, y: e.clientY, cx: self.cx, cy: self.cy, moved: false };
      };
      this._move = function (e) {
        if (!self.drag) return;
        const dx = e.clientX - self.drag.x, dy = e.clientY - self.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) self.drag.moved = true;
        self.cx = self.drag.cx - dx / (self.THUMB_PX * self.zoom);
        self.cy = self.drag.cy - dy / (self.THUMB_PX * self.zoom);
      };
      this._up = function () { self.drag = null; };
      this._dbl = function (e) {
        const r = self.cv.getBoundingClientRect();
        const t = self.screenToTile(e.clientX - r.left, e.clientY - r.top);
        self.cx = t.x; self.cy = t.y;
        self.setZoom(self.zoom * 1.6);
      };
      this.cv.addEventListener('mousedown', this._down);
      window.addEventListener('mousemove', this._move);
      window.addEventListener('mouseup', this._up);
      this.cv.addEventListener('dblclick', this._dbl);
    },

    close: function () {
      this.isOpen = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._wheel && this.cv) this.cv.removeEventListener('wheel', this._wheel);
      if (this._down && this.cv) {
        this.cv.removeEventListener('mousedown', this._down);
        this.cv.removeEventListener('dblclick', this._dbl);
      }
      window.removeEventListener('mousemove', this._move);
      window.removeEventListener('mouseup', this._up);
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    },

    /* ---------------- 视图控制 ---------------- */
    setZoom: function (z) {
      this.zoom = U.clamp(z, 0.05, 4);
    },
    fitAll: function () {
      const fit = Math.min(window.innerWidth * 0.78 / this.WORLD_PX,
                           window.innerHeight * 0.72 / this.WORLD_PX);
      this.setZoom(fit);
      this.cx = this.world.size / 2;
      this.cy = this.world.size / 2;
    },
    gotoPlayer: function (zoomIn) {
      this.cx = this.player.x / G.WORLD.TILE;
      this.cy = this.player.y / G.WORLD.TILE;
      if (zoomIn) this.setZoom(Math.max(this.zoom, 0.5));
    },
    /** 屏幕像素 -> 格坐标 */
    screenToTile: function (sx, sy) {
      const W = this.W, H = this.H;
      const k = this.THUMB_PX * this.zoom;
      const ox = W / 2 - this.cx * k;
      const oy = H / 2 - this.cy * k;
      return { x: (sx - ox) / k, y: (sy - oy) / k };
    },

    /* ---------------- 循环 ---------------- */
    loop: function () {
      const self = this;
      const step = function () {
        if (!self.isOpen) return;
        self.time += 1 / 60;
        self.draw();
        self._raf = requestAnimationFrame(step);
      };
      step();
    },

    draw: function () {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = Math.max(320, Math.round(r.width));
      this.H = Math.max(240, Math.round(r.height));
      if (this.cv.width !== Math.round(this.W * dpr)) {
        this.cv.width = Math.round(this.W * dpr);
        this.cv.height = Math.round(this.H * dpr);
      }
      const c = this.ctx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = this.zoom < 1;          /* 缩小时平滑，放大时锐利 */

      c.fillStyle = '#070a10';
      c.fillRect(0, 0, this.W, this.H);

      const k = this.THUMB_PX * this.zoom;
      const ox = this.W / 2 - this.cx * k;
      const oy = this.H / 2 - this.cy * k;

      /* 地形底图 */
      c.save();
      c.translate(ox, oy);
      c.scale(k / this.THUMB_PX, k / this.THUMB_PX);
      c.drawImage(this.thumb, 0, 0);
      c.restore();

      /* 世界边界 */
      const wpx = this.world.size * k;
      c.strokeStyle = 'rgba(140,170,200,.5)';
      c.lineWidth = 1.5;
      c.strokeRect(ox, oy, wpx, wpx);

      /* 视野矩形（当前游戏视口覆盖范围） */
      const gv = G.__world;
      if (gv) {
        const vx = (gv.cam.x / G.WORLD.TILE) * k + ox;
        const vy = (gv.cam.y / G.WORLD.TILE) * k + oy;
        const vw = (gv.W / gv.zoom / G.WORLD.TILE) * k;
        const vh = (gv.H / gv.zoom / G.WORLD.TILE) * k;
        c.strokeStyle = 'rgba(255,255,255,.5)';
        c.lineWidth = 1;
        c.strokeRect(vx, vy, vw, vh);
      }

      /* 敌人标记 */
      c.fillStyle = 'rgba(255,107,107,.9)';
      this.getMobs().forEach(function (m) {
        const x = (m.x / G.WORLD.TILE) * k + ox;
        const y = (m.y / G.WORLD.TILE) * k + oy;
        if (x < -10 || y < -10 || x > this.W + 10 || y > this.H + 10) return;
        c.fillRect(x - 1.5, y - 1.5, 3, 3);
      }, this);

      /* 玩家标记（脉冲光圈 + 箭头） */
      const px = (this.player.x / G.WORLD.TILE) * k + ox;
      const py = (this.player.y / G.WORLD.TILE) * k + oy;
      const pulse = 1 + Math.sin(this.time * 3) * 0.25;
      c.save();
      c.strokeStyle = '#ffd479';
      c.lineWidth = 2;
      c.beginPath(); c.arc(px, py, 9 * pulse, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffd479';
      c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(px, py, 1.6, 0, Math.PI * 2); c.fill();
      c.restore();

      /* 比例尺 */
      this.drawScale(c, k);
      this.drawCoords(c, ox, oy, k);
    },

    drawScale: function (c, k) {
      /* 选一个整齐的格数，让比例尺在 80~200px 之间 */
      let unit = 10;
      while (unit * k < 80) unit *= 2;
      while (unit * k > 200) unit /= 2;
      const len = unit * k;
      const x = 24, y = this.H - 34;
      c.save();
      c.strokeStyle = 'rgba(233,238,247,.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y); c.lineTo(x + len, y);
      c.moveTo(x, y - 5); c.lineTo(x, y + 5);
      c.moveTo(x + len, y - 5); c.lineTo(x + len, y + 5);
      c.stroke();
      c.fillStyle = 'rgba(233,238,247,.85)';
      c.font = '12px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center';
      c.fillText(unit + ' 格', x + len / 2, y - 10);
      c.restore();
    },

    drawCoords: function (c, ox, oy, k) {
      const t = this.screenToTile(this.W / 2, this.H / 2);
      const gx = U.clamp(Math.floor(t.x), 0, this.world.size - 1);
      const gy = U.clamp(Math.floor(t.y), 0, this.world.size - 1);
      const info = G.tInfo(G.tileAt(this.world, gx, gy));
      if (this.statEl) {
        this.statEl.textContent = '中心 ' + gx + ', ' + gy + '（' + info.name + '）　·　缩放 ' +
          (this.zoom * 100).toFixed(0) + '%　·　世界 ' + this.world.size + '×' + this.world.size + ' 格';
      }
      /* 中心十字 */
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(this.W / 2 - 8, this.H / 2); c.lineTo(this.W / 2 + 8, this.H / 2);
      c.moveTo(this.W / 2, this.H / 2 - 8); c.lineTo(this.W / 2, this.H / 2 + 8);
      c.stroke();
      c.restore();
    },

    /** 键盘：方向键平移 */
    key: function (code) {
      const step = 24 / (this.THUMB_PX * this.zoom);
      if (code === 'left') this.cx -= step;
      else if (code === 'right') this.cx += step;
      else if (code === 'up') this.cy -= step;
      else if (code === 'down') this.cy += step;
      else if (code === 'in') this.setZoom(this.zoom * 1.2);
      else if (code === 'out') this.setZoom(this.zoom / 1.2);
    },
  };

  G.MapView = MapView;
})(window.G = window.G || {});
