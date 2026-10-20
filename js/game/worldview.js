/* =========================================================
   余烬回廊 · 开放世界主循环（俯视角沙盒）
   - 相机跟随的大世界渲染（视口裁剪，只画可见格子）
   - 自由漫游、敌人遭遇、掉落与拾取、装备即时生效
   - M 键调用 G.MapView 打开可缩放大地图
   ========================================================= */
(function (G) {
  const U = G.U;
  const TILE = function () { return G.WORLD.TILE; };

  G.World = function (cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, wx: 0, wy: 0 };
    /* 旋转模式：WASD 直接决定人物朝向（可原地转身）；按 T 切换为跟随模式 */
    this.rotateMode = true;
    /* 背包浮层状态 */
    this.bagOpen = false;
    this.bagEl = null;
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.raf = null;
    this.shake = 0;
    this.zoom = 1.35;

    /* 世界数据：生成一次，全生命周期复用 */
    if (!G.__worldData) G.__worldData = G.generateWorld();
    this.world = G.__worldData;
    this.mapThumb = null;

    this.cam = { x: 0, y: 0 };

    const acc = G.State.state.account;
    const tot = G.State.totals();
    this.tot = tot;
    this.player = {
      x: this.world.spawn.x * TILE() + TILE() / 2,
      y: this.world.spawn.y * TILE() + TILE() / 2,
      vx: 0, vy: 0, face: 1, aim: 0, aimWant: 0,
      hp: tot.maxHp, maxHp: tot.maxHp,
      stamina: tot.stamina, maxStamina: tot.stamina,
      atkT: 0, atkDur: 1 / Math.max(0.6, tot.spdW), combo: 0, comboT: 0, comboStep: 0,
      hurtT: 0, invuln: 0, dodgeCd: 0, ph: 0, moving: false, regen: 0,
      atk: tot.atk, crit: tot.crit, dr: tot.dr, reach: Math.max(26, (tot.reach || 46) * 0.6),
      wtype: (tot.weapon && tot.weapon.wtype) || 'blade',
      lvl: acc.lvl,
      ember: 0, kills: 0, looted: 0, distance: 0, playTime: 0,
    };

    this.mobs = [];
    this.loot = [];
    this.creatures = [];           /* 中立 / 善良 / 无攻击生物 */
    this.propState = {};           /* prop 索引 → {hp, shakeT, gone, regrow} 采集状态 */
    this.ruinState = {};           /* 遗迹索引 → {spawned, cleared, guards:[]} */
    this.harvestT = 0;             /* 采集提示的刷新计时 */
    this.floats = [];
    this.fx = [];
    this.spawnT = 1.5;
    this.maxMobs = 14;

    /* 细雨氛围（与参考图一致） */
    this.rain = [];
    for (let i = 0; i < 300; i++) {
      this.rain.push({ x: Math.random() * 2000, y: Math.random() * 1200, s: U.rnd(7, 16), v: U.rnd(430, 640) });
    }

    this.resize();
    this.bindInput();
    this.centerCamera();
    G.__world = this;
  };

  G.World.prototype = {
    constructor: G.World,

    /* ---------------- 尺寸 ---------------- */
    resize: function () {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = Math.max(320, Math.round(r.width || 960));
      this.H = Math.max(240, Math.round(r.height || 540));
      this.cv.width = Math.round(this.W * dpr);
      this.cv.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
    },
    centerCamera: function () {
      this.cam.x = this.player.x - this.W / (2 * this.zoom);
      this.cam.y = this.player.y - this.H / (2 * this.zoom);
      this.clampCamera();
    },
    clampCamera: function () {
      const wpx = this.world.size * TILE();
      this.cam.x = U.clamp(this.cam.x, 0, Math.max(0, wpx - this.W / this.zoom));
      this.cam.y = U.clamp(this.cam.y, 0, Math.max(0, wpx - this.H / this.zoom));
    },

    /* ---------------- 输入 ---------------- */
    bindInput: function () {
      const self = this;
      this._kd = function (e) {
        const k = e.key.toLowerCase();
        self.keys[k] = true;
        if (k === 'escape') {
          if (self.bagOpen) { self.closeBag(); return; }
          if (self.map && self.map.isOpen) { self.map.close(); self.map = null; return; }
          self.paused = !self.paused; self.syncPause();
        }
        if (k === 'm' && !e.repeat) self.toggleMap();
        if (k === 't' && !e.repeat) self.toggleRotate();
        /* Tab：打开背包（阻止浏览器默认的焦点切换） */
        if (k === 'tab') {
          e.preventDefault();
          if (!e.repeat && !(self.map && self.map.isOpen)) self.toggleBag();
          return;
        }
        if (self.map && self.map.isOpen) {
          if (k === 'arrowleft' || k === 'a') self.map.key('left');
          if (k === 'arrowright' || k === 'd') self.map.key('right');
          if (k === 'arrowup' || k === 'w') self.map.key('up');
          if (k === 'arrowdown' || k === 's') self.map.key('down');
          if (k === '=' || k === '+') self.map.key('in');
          if (k === '-') self.map.key('out');
          e.preventDefault();
          return;
        }
        if (k === 'f' && !e.repeat) self.usePotion();
        if (k === 'e' && !e.repeat) self.interact();
      };
      this._ku = function (e) { self.keys[e.key.toLowerCase()] = false; };
      this._mm = function (e) {
        const r = self.cv.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
      };
      this._md = function (e) {
        if (self.paused || (self.map && self.map.isOpen)) return;
        if (e.button === 0) { self.mouse.down = true; self.attack(); }
        if (e.button === 2) self.dodge();
      };
      this._mu = function (e) { if (e.button === 0) self.mouse.down = false; };
      this._cm = function (e) { e.preventDefault(); };
      /* 滚轮：±45° 相对旋转（旋转模式下微调朝向） */
      this._wh = function (e) {
        if (!self.rotateMode || self.paused || (self.map && self.map.isOpen)) return;
        e.preventDefault();
        self.faceStep(e.deltaY > 0 ? 1 : -1);
      };
      window.addEventListener('keydown', this._kd);
      window.addEventListener('keyup', this._ku);
      this.cv.addEventListener('mousemove', this._mm);
      this.cv.addEventListener('mousedown', this._md);
      window.addEventListener('mouseup', this._mu);
      this.cv.addEventListener('contextmenu', this._cm);
      this.cv.addEventListener('wheel', this._wh, { passive: false });
      this._resizeH = function () { self.resize(); self.clampCamera(); };
      window.addEventListener('resize', this._resizeH);
    },
    unbindInput: function () {
      window.removeEventListener('keydown', this._kd);
      window.removeEventListener('keyup', this._ku);
      this.cv.removeEventListener('mousemove', this._mm);
      this.cv.removeEventListener('mousedown', this._md);
      window.removeEventListener('mouseup', this._mu);
      this.cv.removeEventListener('contextmenu', this._cm);
      this.cv.removeEventListener('wheel', this._wh);
      window.removeEventListener('resize', this._resizeH);
      if (this.map && this.map.isOpen) this.map.close();
      if (this.bagEl && this.bagEl.parentNode) this.bagEl.parentNode.removeChild(this.bagEl);
      this.bagEl = null;
      G.__world = null;
    },

    /* ---------------- 生命周期 ---------------- */
    start: function () {
      this.running = true;
      const self = this;
      let last = performance.now();
      const loop = function (now) {
        if (!self.running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const mapOpen = self.map && self.map.isOpen;
        /* 暂停 / 地图打开 / 背包浮层打开时都停住世界逻辑，只继续渲染 */
        if (!self.paused && !mapOpen && !self.bagOpen) self.update(dt);
        self.render();
        self.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },
    stop: function () {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.unbindInput();
    },

    /* ---------------- 更新 ---------------- */
    update: function (dt) {
      const p = this.player;
      this.time += dt;
      p.playTime += dt;

      let ax = 0, ay = 0;
      const k = this.keys;
      if (k['a'] || k['arrowleft']) ax -= 1;
      if (k['d'] || k['arrowright']) ax += 1;
      if (k['w'] || k['arrowup']) ay -= 1;
      if (k['s'] || k['arrowdown']) ay += 1;
      const len = Math.hypot(ax, ay) || 1;
      ax /= len; ay /= len;

      const gtx = Math.floor(p.x / TILE()), gty = Math.floor(p.y / TILE());
      const terrainMul = G.tileSpeed(this.world, gtx, gty);
      const sprinting = (k['shift'] || k['shiftleft']) && p.stamina > 1;
      const baseSpd = 124 * (1 + (this.tot.spd || 0)) * terrainMul * (sprinting ? 1.7 : 1);
      p.stamina = sprinting ? Math.max(0, p.stamina - dt * 16) : Math.min(p.maxStamina, p.stamina + dt * 11);

      p.vx += (ax * baseSpd - p.vx) * Math.min(1, dt * 11);
      p.vy += (ay * baseSpd - p.vy) * Math.min(1, dt * 11);
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (this.canStand(nx, p.y)) p.x = nx; else p.vx = 0;
      if (this.canStand(p.x, ny)) p.y = ny; else p.vy = 0;
      p.x = U.clamp(p.x, 8, this.world.size * TILE() - 8);
      p.y = U.clamp(p.y, 8, this.world.size * TILE() - 8);
      p.moving = Math.hypot(p.vx, p.vy) > 12;
      p.distance += Math.hypot(p.vx, p.vy) * dt;
      p.ph += dt * (p.moving ? 9 : 2.5);
      if (p.moving) p.face = p.vx >= 0 ? 1 : -1;

      ['atkT', 'comboT', 'hurtT', 'invuln', 'dodgeCd'].forEach(function (kk) {
        if (p[kk] > 0) p[kk] = Math.max(0, p[kk] - dt);
      });
      if (p.comboT <= 0) p.comboStep = 0;
      if (p.hp < p.maxHp) {
        p.regen += dt;
        if (p.regen > 1) { p.regen = 0; p.hp = Math.min(p.maxHp, p.hp + Math.max(1, p.maxHp * 0.012)); }
      }

      /* 相机跟随（带准星前瞻） */
      const lookX = (this.mouse.x - this.W / 2) * 0.1 / this.zoom;
      const lookY = (this.mouse.y - this.H / 2) * 0.1 / this.zoom;
      this.cam.x += (p.x - this.W / (2 * this.zoom) + lookX - this.cam.x) * Math.min(1, dt * 6.5);
      this.cam.y += (p.y - this.H / (2 * this.zoom) + lookY - this.cam.y) * Math.min(1, dt * 6.5);
      this.clampCamera();
      this.mouse.wx = this.cam.x + this.mouse.x / this.zoom;
      this.mouse.wy = this.cam.y + this.mouse.y / this.zoom;

      /* =========================================================
         朝向规则（旋转体系）
         - 旋转模式（默认开，按 T 切换）：WASD 直接决定 8 方向朝向 ——
           可以原地转身，按哪个方向键人物就转到哪个方向；
           q/e 可相对当前朝向左右各转 45°（微调）。
         - 跟随模式（关掉旋转后）：移动中跟移动方向，站定时朝鼠标。
         两种模式下，附近有敌人时都做软吸附（140° 前向弧，越近越优先），
         避免被侧后的敌人把朝向带偏导致正前方的攻击落空。
         ========================================================= */
      const kd = this.keys;
      /* 方向键向量（屏幕坐标：+x 右，+y 下） */
      const kx = (kd['d'] ? 1 : 0) - (kd['a'] ? 1 : 0);
      const ky = (kd['s'] ? 1 : 0) - (kd['w'] ? 1 : 0);
      const hasDirKey = (kx !== 0 || ky !== 0);
      if (this.rotateMode) {
        /* 绝对旋转：按方向键就转向那个方向（可原地转，不按方向键也能转） */
        if (hasDirKey) {
          const step = Math.round(Math.atan2(ky, kx) / (Math.PI / 4));
          p.aimWant = step * (Math.PI / 4);
        }
      } else if (p.moving) {
        p.aimWant = Math.atan2(p.vy, p.vx);
      } else {
        p.aimWant = Math.atan2(this.mouse.wy - p.y, this.mouse.wx - p.x);
      }

      /* 敌人软吸附：在 aimWant 的 140° 前向弧内找最优目标 */
      let want = p.aimWant;
      const snapRange = p.reach * 2.2;
      let best = null, bestScore = -1;
      for (let i = 0; i < this.mobs.length; i++) {
        const m = this.mobs[i];
        const dx = m.x - p.x, dy = m.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > snapRange + m.size) continue;
        let da = Math.atan2(dy, dx) - want;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > 1.22) continue;                 /* ±70°，共 140° 前向弧 */
        /* 评分：离得越近、越接近正前方，优先级越高 */
        const score = (1 - d / (snapRange + m.size)) * 2.2 + (1 - Math.abs(da) / 1.22);
        if (score > bestScore) { bestScore = score; best = m; }
      }
      if (best) want = Math.atan2(best.y - p.y, best.x - p.x);
      /* 关键：把最终目标写回 aimWant ——
         否则滚轮转的朝向会在下一帧被「无按键 → 保持 aimWant」重置回旧值 */
      p.aimWant = want;

      /* 平滑转向：旋转模式下转得更快（约 10 帧转满 180°），手感更跟手 */
      let diff = want - p.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpd = this.rotateMode ? 42 : 26;
      p.aim += diff * Math.min(1, dt * turnSpd);
      while (p.aim > Math.PI) p.aim -= Math.PI * 2;
      while (p.aim < -Math.PI) p.aim += Math.PI * 2;
      p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

      if (this.mouse.down && p.atkT <= 0 && !this.paused) this.attack();

      this.updateMobs(dt);
      /* 生物数量维持：少于 22 只就补，并且离玩家较远时才生成（避免眼前凭空出现） */
      while (this.creatures.length < 22) this.trySpawnCreature();
      this.updateCreatures(dt);
      this.updateResources(dt);
      this.updateRuins(dt);
      this.updateFx(dt);
      this.updateRain(dt);
      this.syncHud();
    },

    canStand: function (x, y) {
      return G.isWalkable(this.world, Math.floor(x / TILE()), Math.floor(y / TILE()));
    },

    /* ---------------- 敌人与掉落 ---------------- */
    updateMobs: function (dt) {
      const p = this.player, self = this;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.mobs.length < this.maxMobs) {
        this.spawnT = 1.0;
        this.trySpawnMob();
      }
      this.mobs.forEach(function (m) {
        const dx = p.x - m.x, dy = p.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        if (m.hitT > 0) m.hitT -= dt;
        if (m.hurtT > 0) m.hurtT -= dt;
        if (m.cd > 0) m.cd -= dt;
        if (d < 360 && d > 24) {
          const sp = m.spd * 46;
          m.x += dx / d * sp * dt;
          m.y += dy / d * sp * dt;
        }
        m.face = dx >= 0 ? 1 : -1;
        m.ph += dt * 6;
        if (d < 28 && m.cd <= 0) { m.cd = 1.1; self.hurtPlayer(m.atk); }
        if (d > 1600) m.dead = true;
      });
      /* 遗迹清空判定：必须在过滤之前做 —— 过滤后守卫对象已不在 mobs 里，
         虽然引用还在，但为了逻辑清晰与稳健，这里统一在移除前结算 */
      if (this.world.ruins) {
        for (let ri = 0; ri < this.world.ruins.length; ri++) {
          const rst = this.ruinState[ri];
          if (!rst || !rst.spawned || rst.cleared || !rst.guards.length) continue;
          let alive = 0;
          for (let gi = 0; gi < rst.guards.length; gi++) {
            const gm = rst.guards[gi];
            if (!gm.dead && this.mobs.indexOf(gm) >= 0) alive++;
          }
          if (!alive) {
            rst.cleared = true;
            const rr = this.world.ruins[ri];
            rr.cleared = true;
            this.ruinReward(rr, rr.x * TILE() + TILE() * rr.w / 2, rr.y * TILE() + TILE() * rr.h / 2);
          }
        }
      }
      this.mobs = this.mobs.filter(function (m) { return !m.dead; });

      this.loot.forEach(function (l) {
        l.t += dt;
        const d = U.dist(l.x, l.y, p.x, p.y);
        if (d < 52) {
          l.x += (p.x - l.x) * Math.min(1, dt * 4);
          l.y += (p.y - l.y) * Math.min(1, dt * 4);
        }
        if (d < 18) l.picked = true;
      });
      const got = this.loot.filter(function (l) { return l.picked; });
      got.forEach(function (l) { self.pickup(l); });
      this.loot = this.loot.filter(function (l) { return !l.picked; });
    },

    trySpawnMob: function () {
      const p = this.player;
      const defs = G.Enemies.list.filter(function (e) { return e.kind !== 'boss'; });
      if (!defs.length) return;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = U.rnd(430, 900);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!this.canStand(x, y)) continue;
        const t = G.tInfo(G.tileAt(this.world, Math.floor(x / TILE()), Math.floor(y / TILE())));
        const danger = (t.key === 'forest' || t.key === 'rock') ? 1 : 0;
        const lvl = 1 + Math.floor(p.distance / (TILE() * 180)) + danger;
        const base = U.pick(defs);
        const scale = 1 + lvl * 0.2;
        const m = {
          x: x, y: y, face: 1, ph: Math.random() * 6,
          def: base, etype: base.kind, color: base.color, size: base.size,
      sprite: base.sprite || null,
          hp: Math.round(base.hp * scale), maxHp: Math.round(base.hp * scale),
          atk: Math.round(base.atk * scale * 0.85),
          spd: base.spd / 60 + 0.55,
          cd: U.rnd(0.4, 1.4), hurtT: 0, hitT: 0, elite: false, lvl: lvl,
        };
        m.maxHp = m.hp;
        if (Math.random() < 0.07 + danger * 0.08) {
          const af = U.pick(G.ELITE_AFFIX);
          m.elite = true;
          m.affix = af;
          m.hp = m.maxHp = Math.round(m.hp * af.hp);
          m.atk = Math.round(m.atk * af.atk);
          if (af.id === 'af_giant') m.size = m.size * 1.35;
        }
        this.mobs.push(m);
        return;
      }
    },

    /* =========================================================
       生物（中立 / 善良 / 无攻击）
       - 环形撒点：陆生撒在可站立的陆地，鱼只撒在水里
       - 名字从名字池取，显示在头顶；善良生物跟随玩家
       ========================================================= */
    spawnCreature: function (x, y) {
      const size = this.world.size, tl = TILE();
      const tx = U.clamp(Math.floor(x / tl), 1, size - 2);
      const ty = U.clamp(Math.floor(y / tl), 1, size - 2);
      const t = G.tInfo(G.tileAt(this.world, tx, ty));
      const sp = G.creatureForTerrain(t.name, Math.floor(x * 31 + y * 17));
      if (!sp) return null;
      const isWater = sp.habitat === 'water';
      if (isWater !== (t.key === 'deep' || t.key === 'shallow')) return null;
      const def = sp;
      const c = {
        x: x, y: y, face: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6,
        species: def.id, def: def, name: def.name,
        /* 个体名：种类名 + 专属名字 */
        nick: U.pick(G.CREATURE_NAMES),
        temper: def.temper, habitat: def.habitat,
        body: def.body, body2: def.body2, dark: def.dark,
        snout: def.snout, ear: def.ear, comb: def.comb, fin: def.fin, tail: def.tail, foot: def.foot,
        /* 参考图新增生物的外观字段 */
        horn: def.horn, spot: def.spot, tusk: def.tusk, bristle: def.bristle,
        staff: def.staff, hat: def.hat, pack: def.pack, glow: def.glow, eye: def.eye,
        hp: def.hp, maxHp: def.hp, size: def.size, spd: def.spd / 60,
        moving: false, hurtT: 0, vx: 0, vy: 0, think: U.rnd(0.5, 2.5), dx: 0, dy: 0,
        tamed: 0, follow: 0,
        /* 友善援护（guardian）用的战斗状态 */
        target: null, scanT: 0, atkCd: 0, attackT: 0, announced: false,
        range: def.temper === 'guardian' ? 240 : 0
      };
      this.creatures.push(c);
      return c;
    },
    trySpawnCreature: function () {
      const p = this.player;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = U.rnd(120, 620);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        const size = this.world.size * TILE();
        if (x < 32 || y < 32 || x > size - 32 || y > size - 32) continue;
        if (this.spawnCreature(x, y)) return;
      }
    },
    updateCreatures: function (dt) {
      const p = this.player;
      const list = this.creatures;
      for (let i = list.length - 1; i >= 0; i--) {
        const cr = list[i];
        const dx = p.x - cr.x, dy = p.y - cr.y;
        const d = Math.hypot(dx, dy) || 1;
        /* 离太远就回收，同时补一个新的（保持世界里总有生物） */
        if (d > 1400) {
          list.splice(i, 1);
          this.spawnCreature(p.x + (Math.random() - 0.5) * 1200, p.y + (Math.random() - 0.5) * 1200);
          continue;
        }
        if (cr.hurtT > 0) cr.hurtT -= dt;
        if (cr.atkCd > 0) cr.atkCd -= dt;
        if (cr.fleeT > 0) cr.fleeT -= dt;
        cr.think -= dt;
        /* ---- 友善援护（叶精灵 / 行囊史莱姆）：主动攻击附近的攻击生物 ---- */
        if (cr.temper === 'guardian') {
          if (!cr.target || cr.target.dead || this.mobs.indexOf(cr.target) < 0) cr.target = null;
          /* 每 0.5 秒重新找一次目标（别每帧遍历） */
          cr.scanT = (cr.scanT || 0) - dt;
          if (!cr.target && cr.scanT <= 0) {
            cr.scanT = 0.5;
            let best = null, bd = cr.range || 220;
            for (let mi = 0; mi < this.mobs.length; mi++) {
              const mo = this.mobs[mi];
              if (mo.dead) continue;
              const md = Math.hypot(mo.x - cr.x, mo.y - cr.y);
              if (md < bd) { bd = md; best = mo; }
            }
            if (best) {
              cr.target = best;
              if (!cr.announced) {
                cr.announced = true;
                this.toast('「' + cr.name + ' · ' + cr.nick + '」赶来帮忙了', 'ok');
              }
            }
          }
          if (cr.target) {
            const tdx = cr.target.x - cr.x, tdy = cr.target.y - cr.y;
            const td = Math.hypot(tdx, tdy) || 1;
            const reach = cr.def.reach || 28;
            if (td > reach) {
              /* 追上去 */
              cr.dx = tdx / td; cr.dy = tdy / td;
              cr.moving = true;
            } else {
              /* 到射程内就攻击 */
              cr.dx = 0; cr.dy = 0; cr.moving = false;
              if (cr.atkCd <= 0) {
                cr.atkCd = cr.def.atkCd || 1.1;
                const dmg = Math.round((cr.def.atk || 10) * (1 + (p.lvl || 1) * 0.08));
                const crit = Math.random() < 0.15;
                this.hurtMob(cr.target, dmg, crit, tdx, tdy);
                cr.face = tdx > 0 ? 1 : -1;
                cr.attackT = 0.22;
                /* 史莱姆是远程：飞出一颗水弹 */
                if (cr.def.ranged) {
                  this.fx.push({ kind: 'bolt', x: cr.x, y: cr.y - 14, tx: cr.target.x, ty: cr.target.y - 10,
                    t: 0.18, max: 0.18, color: cr.def.glow || '#bfe8ff' });
                }
              }
            }
          }
        }
        if (cr.attackT > 0) cr.attackT -= dt;
        /* 行为决策 */
        if (cr.think <= 0) {
          cr.think = U.rnd(1.4, 3.6);
          if (cr.temper === 'friendly') {
            /* 善良：靠近玩家时会跟随一段路 */
            cr.follow = d < 150 ? U.rnd(2.0, 4.0) : 0;
          }
          if (cr.fleeT > 0) {
            /* 刚被打过：拼命跑开 */
            cr.dx = -dx / d; cr.dy = -dy / d;
          } else if (cr.follow > 0) {
            cr.follow -= dt;
            cr.dx = dx / d; cr.dy = dy / d;
          } else if (cr.habitat === 'water') {
            /* 鱼：随机游动，玩家靠太近就逃 */
            if (d < 90) { cr.dx = -dx / d; cr.dy = -dy / d; }
            else { const a = Math.random() * Math.PI * 2; cr.dx = Math.cos(a); cr.dy = Math.sin(a); }
          } else if (d < 70) {
            /* 陆地生物：玩家贴太近会走开一点（不惊慌） */
            cr.dx = -dx / d; cr.dy = -dy / d;
          } else if (cr.temper === 'passive' && d < 130) {
            /* 无攻击生物：见人就跑 */
            cr.dx = -dx / d; cr.dy = -dy / d;
          } else if (Math.random() < 0.45) {
            const a = Math.random() * Math.PI * 2;
            cr.dx = Math.cos(a); cr.dy = Math.sin(a);
          } else {
            cr.dx = 0; cr.dy = 0;
          }
        }
        /* 移动（陆地生物不能走进深水，鱼不能上岸） */
        cr.moving = (cr.dx !== 0 || cr.dy !== 0);
        if (cr.moving) {
          const mul = cr.follow > 0 ? 1.25 : 1;
          const nx = cr.x + cr.dx * cr.spd * 60 * mul * dt;
          const ny = cr.y + cr.dy * cr.spd * 60 * mul * dt;
          const tx = Math.floor(nx / TILE()), ty = Math.floor(ny / TILE());
          const t = G.tInfo(G.tileAt(this.world, tx, ty));
          const okWater = (t.key === 'shallow' || t.key === 'deep');
          const ok = cr.habitat === 'water' ? okWater : (G.isWalkable(this.world, tx, ty) && !okWater);
          if (ok) { cr.x = nx; cr.y = ny; }
          else { cr.dx = -cr.dx; cr.dy = -cr.dy; cr.think = U.rnd(0.4, 1.2); }
          if (cr.dx !== 0) cr.face = cr.dx > 0 ? 1 : -1;
          cr.ph += dt * 7;
        } else {
          cr.ph += dt * 1.2;
        }
      }
    },

    /* =========================================================
       采集：木头（树木 / 松树 / 灌木）、沙子（沙滩）、水（浅水 / 深水）、石块（岩石）
       - 用左键挥砍就能打资源：优先打「射程内 + 朝向锥形内最近的资源」
       - 资源有耐久（hits），打完掉落物品并直接进背包
       - 地形类资源（沙 / 水）不消失，但有短冷却；prop 类会消失并在一段时间后重生
       ========================================================= */
    /** 找一个可采集目标（prop 或地形），返回 {kind, prop, tx, ty, x, y, dist} 或 null */
    findHarvestTarget: function (reachMul) {
      const p = this.player;
      const reach = p.reach * (reachMul || 1) + 10;
      const ang = p.aim, spread = 1.15;
      const tl = TILE();
      let best = null, bestD = 1e9;
      /* a) prop 类：树木 / 松树 / 灌木 / 岩石 */
      const props = this.world.props;
      for (let i = 0; i < props.length; i++) {
        const st = this.propState[i];
        if (st && st.gone) continue;
        const pr = props[i];
        const kind = pr.kind;
        if (!G.RESOURCES[kind]) continue;
        const cx = pr.x * tl + tl / 2, cy = pr.y * tl + tl / 2;
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d > reach || d >= bestD) continue;
        let da = Math.atan2(cy - p.y, cx - p.x) - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > spread) continue;
        best = { kind: kind, prop: i, x: cx, y: cy, dist: d };
        bestD = d;
      }
      /* b) 地形类：脚下 / 面前一格是沙滩或水 */
      const ftx = Math.floor(p.x / tl), fty = Math.floor(p.y / tl);
      const ft = G.tInfo(G.tileAt(this.world, ftx, fty));
      const fres = G.resourceForTerrain(ft.name);
      if (fres && bestD > reach * 0.8) {
        best = { kind: fres, tile: { x: ftx, y: fty }, x: ftx * tl + tl / 2, y: fty * tl + tl / 2, dist: 0 };
      }
      return best;
    },
    /** 对目标造成一次采集伤害；破坏时掉落并入包 */
    harvest: function (target, dmgMul) {
      if (!target) return 0;
      const def = G.RESOURCES[target.kind];
      if (!def) return 0;
      const p = this.player;
      let hp;
      if (target.prop != null) {
        if (!this.propState[target.prop]) this.propState[target.prop] = { hp: def.hits, shakeT: 0, gone: false, regrow: 0 };
        const st = this.propState[target.prop];
        st.hp -= (dmgMul || 1);
        st.shakeT = 0.26;
        hp = st.hp;
      } else {
        /* 地形类：用一个短冷却表示「一铲一铲地挖」 */
        if (this.harvestT > 0) return 0;
        this.harvestT = 0.42;
        hp = 0;
      }
      G.Audio.play('hit');
      this.fx.push({ kind: 'hit', x: target.x, y: target.y - 6, t: 0.16, max: 0.16 });
      if (hp > 0) {
        this.floats.push({ x: target.x, y: target.y - 20, t: 0.6, text: def.verb, color: '#c9d3e0', size: 11 });
        return 0;
      }
      /* 破坏：结算掉落 */
      const drops = G.rollResourceDrops(target.kind);
      const self = this;
      drops.forEach(function (d) {
        self.loot.push({
          x: target.x + U.rnd(-8, 8), y: target.y + U.rnd(-4, 8),
          kind: 'item', id: d.id, count: d.count, t: 0, picked: false, rarity: 0
        });
      });
      const names = drops.map(function (d) {
        const it = G.Items.get(d.id);
        return (it ? it.name : d.id) + '×' + d.count;
      }).join('、');
      this.toast(def.verb + def.name + ' → ' + (names || '什么也没得到'), 'ok');
      this.fx.push({ kind: 'death', x: target.x, y: target.y - 8, t: 0.4, max: 0.4, color: '#8a6a42' });
      /* prop 类：标记消失并安排重生（约 45 秒） */
      if (target.prop != null) {
        const st = this.propState[target.prop];
        st.gone = true;
        st.regrow = 45;
      }
      p.harvested = (p.harvested || 0) + 1;
      return drops.length;
    },
    /** 资源状态推进：抖动衰减 + 重生计时 */
    updateResources: function (dt) {
      if (this.harvestT > 0) this.harvestT -= dt;
      const st = this.propState;
      for (const k in st) {
        const r = st[k];
        if (r.shakeT > 0) r.shakeT -= dt;
        if (r.gone) {
          r.regrow -= dt;
          if (r.regrow <= 0) { r.gone = false; r.hp = 1; }
        }
      }
    },

    /* =========================================================
       遗迹：接近时唤醒守卫，清空后掉落高品质武器 / 装备
       品质概率（与需求一致）：
         白 70% / 蓝 50% / 紫 4% / 金 0.6% / 红 0.002%
       （按「达到该品质及以上」逐级判定，绿档作为中间过渡 30%）
       ========================================================= */
    updateRuins: function (dt) {
      const p = this.player;
      if (!this.world.ruins) return;
      const self = this;
      for (let i = 0; i < this.world.ruins.length; i++) {
        const r = this.world.ruins[i];
        if (!this.ruinState[i]) this.ruinState[i] = { spawned: false, cleared: false, guards: [] };
        const st = this.ruinState[i];
        const tx = r.x * TILE() + TILE() * r.w / 2;
        const ty = r.y * TILE() + TILE() * r.h / 2;
        const d = Math.hypot(tx - p.x, ty - p.y);
        /* 接近 260px 时唤醒守卫 */
        if (!st.spawned && d < 260) {
          st.spawned = true;
          const pool = G.guardsForTier(r.tier);
          const n = 2 + Math.floor(Math.random() * 3) + Math.floor(r.tier / 2);
          for (let k = 0; k < n; k++) {
            const g = pool[(Math.random() * pool.length) | 0];
            const a = Math.random() * Math.PI * 2, rr = U.rnd(40, 110);
            const sx = tx + Math.cos(a) * rr, sy = ty + Math.sin(a) * rr;
            const scale = 1 + r.tier * 0.22;
            const m = {
              x: sx, y: sy, face: 1, ph: Math.random() * 6,
              def: g, etype: g.kind, color: g.color, size: g.size,
              hp: Math.round(g.hp * scale), maxHp: Math.round(g.hp * scale),
              atk: Math.round(g.atk * scale * 0.9), spd: g.spd / 60 + 0.5,
              cd: U.rnd(0.4, 1.4), hurtT: 0, hitT: 0, elite: r.tier >= 4, lvl: 1 + r.tier * 3,
              ruin: i, name: g.name
            };
            m.maxHp = m.hp;
            if (m.elite) {
              const af = U.pick(G.ELITE_AFFIX);
              m.affix = af;
              m.hp = m.maxHp = Math.round(m.hp * af.hp);
              m.atk = Math.round(m.atk * af.atk);
            }
            this.mobs.push(m);
            st.guards.push(m);
          }
          this.toast('闯入「' + r.name + '」· 守卫苏醒（' + n + ' 只）', 'warn');
          G.Audio.play('crit');
          this.shake = 6;
        }
        /* 清空判定改在 updateMobs 里（必须在守卫被移出 mobs 数组之前判定），
           这里只负责在还没结算时兜底检查一次 */
        if (st.spawned && !st.cleared && !st.guards.length) {
          st.cleared = true;
          r.cleared = true;
          self.ruinReward(r, tx, ty);
        }
      }
    },
    /** 遗迹奖励：按品质概率 roll 出武器 / 装备，掉在遗迹中心 */
    ruinReward: function (r, tx, ty) {
      const p = this.player;
      const luck = (p.luck || 0) + r.tier * 0.5;
      const out = [];
      const rolls = 1 + (r.tier >= 3 ? 1 : 0);       /* 高阶遗迹多一次机会 */
      for (let i = 0; i < rolls; i++) {
        const tier = G.rollRuinRarity(luck);
        const isWeapon = Math.random() < 0.62;
        if (isWeapon) {
          const pool = G.Weapons.list.filter(function (w) {
            return w.rarity === tier || (tier >= 4 && w.rarity >= 4);
          });
          const w = pool.length ? U.pick(pool) : U.pick(G.Weapons.list);
          if (w) out.push({ kind: 'weapon', id: w.id, count: 1, tier: tier });
        } else {
          const pool = G.Clothing.list.filter(function (c) {
            return c.rarity === tier || (tier >= 4 && c.rarity >= 4);
          });
          const c = pool.length ? U.pick(pool) : U.pick(G.Clothing.list);
          if (c) out.push({ kind: 'cloth', id: c.id, count: 1, tier: tier });
        }
        /* 紫以上额外给一份材料 */
        if (tier >= 3) out.push({ kind: 'item', id: U.pick(['i_core_fragment', 'i_void_shard', 'i_ember']), count: 1 + tier, tier: tier });
      }
      const self = this;
      out.forEach(function (d) {
        self.loot.push({
          x: tx + U.rnd(-22, 22), y: ty + U.rnd(-16, 22),
          kind: d.kind, id: d.id, count: d.count, t: 0, picked: false,
          rarity: d.tier != null ? d.tier : 0
        });
      });
      const top = out.reduce(function (a, b) { return Math.max(a, b.tier || 0); }, 0);
      this.toast('清空「' + r.name + '」· 获得 ' + out.length + ' 件战利品（最高品质 ' + G.rarityLabel(top) + '）', 'ok');
      G.Audio.play('kill');
      this.fx.push({ kind: 'death', x: tx, y: ty - 10, t: 0.6, max: 0.6, color: (G.RUIN_RARITY[top] || {}).color || '#ffd479' });
    },

    /* ---------------- 战斗 ---------------- */
    attack: function () {
      const p = this.player;
      if (p.atkT > 0 || p.hurtT > 0.1 || p.stamina < 4) return;
      p.stamina -= 4;
      p.comboStep = p.comboT > 0 ? (p.comboStep % 3) + 1 : 1;
      p.comboT = 0.85;
      p.atkDur = (1 / Math.max(0.6, this.tot.spdW)) * (p.comboStep === 3 ? 1.3 : 1);
      p.atkT = p.atkDur;
      G.Audio.play('swing');
      const reach = p.reach * (p.comboStep === 3 ? 1.3 : 1);
      const spread = p.comboStep === 3 ? 1.5 : 1.0;
      const self = this, ang = p.aim;
      let hits = 0;
      this.mobs.forEach(function (m) {
        const dx = m.x - p.x, dy = m.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > reach + m.size * 0.5) return;
        let da = Math.atan2(dy, dx) - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > spread) return;
        hits++;
        const crit = Math.random() < p.crit;
        const dmg = Math.round(p.atk * (p.comboStep === 3 ? 1.35 : 1) * (crit ? 1.6 : 1));
        self.hurtMob(m, dmg, crit, dx, dy);
      });
      /* 打生物（善良 / 中立 / 无攻击都可以被打，参考图里鹿、野猪、青蛙是给玩家猎的） */
      this.creatures.slice().forEach(function (cr) {
        if (cr.temper === 'guardian') return;                 /* 援护生物不挨玩家刀 */
        const dx = cr.x - p.x, dy = cr.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > reach + cr.size * 0.5) return;
        let da = Math.atan2(dy, dx) - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > spread) return;
        hits++;
        const crit = Math.random() < p.crit;
        const dmg = Math.round(p.atk * (p.comboStep === 3 ? 1.35 : 1) * (crit ? 1.6 : 1));
        self.hurtCreature(cr, dmg, crit, dx, dy);
      });
      /* 附近没有敌人也没打中生物时，把这一刀用来采集资源（木头 / 沙子 / 水 / 石块） */
      if (!hits) {
        const tgt = this.findHarvestTarget(p.comboStep === 3 ? 1.3 : 1);
        if (tgt) {
          this.harvest(tgt, p.comboStep === 3 ? 1.5 : 1);
          hits += 1;
        }
      }
      if (hits) {
        this.shake = 5;
        this.fx.push({ kind: 'slash', x: p.x, y: p.y, ang: ang, r: reach, t: 0.2, max: 0.2 });
      }
    },

    /** 生物受伤（善良 / 中立 / 无攻击生物被玩家攻击时走这条） */
    hurtCreature: function (cr, dmg, crit, dx, dy) {
      cr.hp -= dmg;
      cr.hurtT = 0.2;
      const d = Math.hypot(dx, dy) || 1;
      cr.x += dx / d * 5; cr.y += dy / d * 5;
      this.floats.push({ x: cr.x, y: cr.y - cr.size * 0.9, t: 0.8,
        text: (crit ? '✦' : '') + dmg, color: crit ? '#ffd479' : '#ffffff', size: crit ? 18 : 13 });
      this.fx.push({ kind: 'hit', x: cr.x, y: cr.y - cr.size * 0.4, t: 0.18, max: 0.18 });
      G.Audio.play(crit ? 'crit' : 'hit');
      /* 被打会跑开（善良生物掉好感，中立会还手一下） */
      cr.fleeT = 3.0;
      if (cr.hp <= 0) this.killCreature(cr);
    },
    /** 生物死亡：掉落物品 + 移除 */
    killCreature: function (cr) {
      cr.dead = true;
      this.player.creatureKills = (this.player.creatureKills || 0) + 1;
      this.fx.push({ kind: 'death', x: cr.x, y: cr.y - cr.size * 0.4, t: 0.5, max: 0.5, color: cr.dark });
      G.Audio.play('kill');
      const self = this;
      const drops = cr.def.drops || [];
      drops.forEach(function (d) {
        const n = Math.max(1, Math.round(d.w * (0.6 + Math.random() * 0.8)));
        self.loot.push({ x: cr.x + U.rnd(-9, 9), y: cr.y + U.rnd(-5, 9),
          kind: 'item', id: d.id, count: n, t: 0, picked: false, rarity: 0 });
      });
      const idx = this.creatures.indexOf(cr);
      if (idx >= 0) this.creatures.splice(idx, 1);
      /* 补一只，保持世界里生物数量 */
      this.trySpawnCreature();
    },

    hurtMob: function (m, dmg, crit, dx, dy) {
      m.hp -= dmg;
      m.hurtT = 0.18;
      m.hitT = 0.14;
      const d = Math.hypot(dx, dy) || 1;
      m.x += dx / d * 6; m.y += dy / d * 6;
      this.floats.push({ x: m.x, y: m.y - 22, t: 0.8, text: (crit ? '✦' : '') + dmg, color: crit ? '#ffd479' : '#ffffff', size: crit ? 18 : 13 });
      this.fx.push({ kind: 'hit', x: m.x, y: m.y - 10, t: 0.18, max: 0.18 });
      G.Audio.play(crit ? 'crit' : 'hit');
      if (m.hp <= 0) this.killMob(m);
    },

    killMob: function (m) {
      m.dead = true;
      this.player.kills++;
      this.fx.push({ kind: 'death', x: m.x, y: m.y - 8, t: 0.5, max: 0.5, color: m.color });
      G.Audio.play('kill');
      const mul = m.elite ? 2.2 : 1;
      const drops = [];
      const lvlCap = this.player.lvl + 5;
      const pool = G.Weapons.list.filter(function (w) { return (w.lvlReq || 1) <= lvlCap; });
      if (Math.random() < 0.17 * mul) {
        const w = U.pick(pool.length ? pool : G.Weapons.list);
        if (w) drops.push({ kind: 'weapon', id: w.id, count: 1 });
      }
      if (Math.random() < 0.13 * mul) {
        const cl = U.pick(G.Clothing.list);
        if (cl) drops.push({ kind: 'cloth', id: cl.id, count: 1 });
      }
      if (Math.random() < 0.5) drops.push({ kind: 'item', id: U.pick(['i_ember', 'i_scrap', 'i_ember_dust', 'i_potion_s']), count: 1 + ((Math.random() * 3) | 0) });
      if (m.elite && Math.random() < 0.55) drops.push({ kind: 'item', id: U.pick(['i_core_fragment', 'i_stamina_draught', 'i_potion_m']), count: 1 });
      const self = this;
      drops.forEach(function (d) {
        self.loot.push({
          x: m.x + U.rnd(-10, 10), y: m.y + U.rnd(-6, 10),
          kind: d.kind, id: d.id, count: d.count, t: 0, picked: false,
          rarity: self.rarityOf(d),
        });
      });
    },

    rarityOf: function (d) {
      try {
        if (d.kind === 'weapon') { const w = G.Weapons.get(d.id); return w ? w.rarity : 0; }
        if (d.kind === 'cloth') { const c = G.Clothing.get(d.id); return c ? c.rarity : 0; }
        const it = G.Items.get(d.id); return it ? it.rarity : 0;
      } catch (e) { return 0; }
    },

    pickup: function (l) {
      const p = this.player;
      try {
        G.State.addItem(l.id, l.count);
        if (l.kind === 'weapon') {
          const w = G.Weapons.get(l.id);
          this.toast('获得武器：' + (w ? w.name : l.id), 'ok');
        } else if (l.kind === 'cloth') {
          const cl = G.Clothing.get(l.id);
          this.toast('获得衣物：' + (cl ? cl.name : l.id), 'ok');
        } else {
          const it = G.Items.get(l.id);
          if (it && (it.kind === 'currency' || it.id === 'i_ember')) p.ember += l.count;
        }
      } catch (e) { /* 未知物品忽略 */ }
      p.looted += l.count;
      this.floats.push({ x: l.x, y: l.y - 16, t: 0.7, text: '+' + l.count, color: '#ffd479', size: 12 });
      G.Audio.play('pickup');
      if (G.State.saveSoon) G.State.saveSoon();
    },

    hurtPlayer: function (dmg) {
      const p = this.player;
      if (p.invuln > 0) return;
      const real = Math.max(1, Math.round(dmg * (1 - p.dr)));
      p.hp -= real;
      p.invuln = 0.5;
      p.hurtT = 0.25;
      this.shake = 8;
      this.floats.push({ x: p.x, y: p.y - 30, t: 0.8, text: '-' + real, color: '#ff6b6b', size: 14 });
      G.Audio.play('hurt');
      if (p.hp <= 0) this.respawn();
    },

    respawn: function () {
      const p = this.player;
      p.hp = Math.round(p.maxHp * 0.5);
      p.x = this.world.spawn.x * TILE() + TILE() / 2;
      p.y = this.world.spawn.y * TILE() + TILE() / 2;
      p.invuln = 2;
      this.mobs = [];
      this.creatures = [];
      this.propState = {};
      this.ruinState = {};
      for (let i = 0; i < 20; i++) this.trySpawnCreature();
      this.toast('你在营火旁醒来（生命恢复 50%）', 'warn');
      this.centerCamera();
    },

    dodge: function () {
      const p = this.player;
      if (p.dodgeCd > 0 || p.stamina < 10) return;
      p.stamina -= 10;
      p.dodgeCd = 0.7;
      p.invuln = Math.max(p.invuln, 0.32);
      const a = p.aim;
      const tx = p.x + Math.cos(a) * 36, ty = p.y + Math.sin(a) * 36;
      if (this.canStand(tx, ty)) { p.x = tx; p.y = ty; }
      this.fx.push({ kind: 'dash', x: p.x, y: p.y, t: 0.28, max: 0.28 });
      G.Audio.play('dash');
    },

    usePotion: function () {
      const p = this.player;
      const bag = G.State.state.items || {};
      const id = ['i_potion_s', 'i_potion_m', 'i_potion_l'].find(function (x) { return (bag[x] || 0) > 0; });
      if (!id) { this.toast('没有药剂', 'warn'); return; }
      const it = G.Items.get(id);
      G.State.removeItem(id, 1);
      const heal = Math.round(p.maxHp * ((it && it.heal) || 0.3));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floats.push({ x: p.x, y: p.y - 30, t: 0.9, text: '+' + heal, color: '#5fe08a', size: 15 });
      G.Audio.play('heal');
      this.toast('使用 ' + (it ? it.name : '药剂'), 'ok');
    },

    interact: function () {
      const p = this.player;
      let best = null, bd = 44;
      this.loot.forEach(function (l) {
        const d = U.dist(l.x, l.y, p.x, p.y);
        if (d < bd) { bd = d; best = l; }
      });
      if (best) {
        best.picked = true;
        this.pickup(best);
        this.loot = this.loot.filter(function (l) { return !l.picked; });
      } else this.toast('附近没有可拾取的东西', 'warn');
    },

    /* ---------------- 特效 / 天气 ---------------- */
    updateFx: function (dt) {
      this.fx.forEach(function (f) { f.t -= dt; });
      this.fx = this.fx.filter(function (f) { return f.t > 0; });
      this.floats.forEach(function (f) { f.t -= dt; f.y -= dt * 26; });
      this.floats = this.floats.filter(function (f) { return f.t > 0; });
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    },
    updateRain: function (dt) {
      const self = this;
      for (let i = 0; i < this.rain.length; i++) {
        const r = this.rain[i];
        r.y += r.v * dt;
        r.x -= r.v * 0.2 * dt;
        if (r.y > self.H + 30) { r.y = -20; r.x = Math.random() * (self.W + 400); }
      }
    },

    /* ---------------- 渲染 ---------------- */
    beginWorld: function (c) {
      c.save();
      c.scale(this.zoom, this.zoom);
      c.translate(-this.cam.x, -this.cam.y);
    },
    endWorld: function (c) { c.restore(); },

    render: function () {
      const c = this.ctx, W = this.W, H = this.H;
      c.save();
      if (this.shake) c.translate(U.rnd(-this.shake, this.shake) * 0.25, U.rnd(-this.shake, this.shake) * 0.25);
      c.fillStyle = '#1b2a3a';
      c.fillRect(-24, -24, W + 48, H + 48);
      this.drawTerrain(c);
      this.drawProps(c);
      this.drawLootLayer(c);
      this.drawRuins(c);
      this.drawCreatures(c);
      this.drawHarvestHint(c);
      this.drawMobs(c);
      this.drawPlayer(c);
      this.drawFx(c);
      this.drawFloats(c);
      c.restore();
      this.drawRain(c);
      this.drawVignette(c);
      this.drawStatusLine(c);
    },

    drawTerrain: function (c) {
      const T = TILE(), w = this.world, z = this.zoom;
      const x0 = Math.max(0, Math.floor(this.cam.x / T));
      const y0 = Math.max(0, Math.floor(this.cam.y / T));
      const x1 = Math.min(w.size - 1, Math.ceil((this.cam.x + this.W / z) / T));
      const y1 = Math.min(w.size - 1, Math.ceil((this.cam.y + this.H / z) / T));
      this.beginWorld(c);
      const ts = T + 0.7;
      for (let y = y0; y <= y1; y++) {
        const row = y * w.size;
        for (let x = x0; x <= x1; x++) {
          const t = G.tInfo(w.tiles[row + x]);
          c.fillStyle = (w.detail[row + x] & 1) ? t.color : (t.color2 || t.color);
          c.fillRect(x * T, y * T, ts, ts);
        }
      }
      /* 水陆交界的白浪 */
      c.fillStyle = 'rgba(255,255,255,.22)';
      for (let y = y0; y <= y1; y++) {
        const row = y * w.size;
        for (let x = x0; x <= x1; x++) {
          const id = w.tiles[row + x];
          if (id === 2 && x + 1 < w.size && w.tiles[row + x + 1] === 1) c.fillRect(x * T + T - 3, y * T + 2, 3, T - 4);
          if (id === 2 && y + 1 < w.size && w.tiles[row + w.size + x] === 1) c.fillRect(x * T + 2, y * T + T - 3, T - 4, 3);
        }
      }
      this.endWorld(c);
    },

    /** 遗迹绘制：石砌地面 + 残墙 + 中心标记（已清空的会变暗并升起余烬） */
    drawRuins: function (c) {
      if (!this.world.ruins) return;
      const T = TILE(), z = this.zoom;
      const pad = 120;
      const l = this.cam.x - pad, r2 = this.cam.x + this.W / z + pad;
      const t0 = this.cam.y - pad, b2 = this.cam.y + this.H / z + pad;
      this.beginWorld(c);
      for (let i = 0; i < this.world.ruins.length; i++) {
        const ru = this.world.ruins[i];
        const px = ru.x * T, py = ru.y * T;
        const w = ru.w * T, h = ru.h * T;
        if (px + w < l || px > r2 || py + h < t0 || py > b2) continue;
        const st = this.ruinState[i] || {};
        const cleared = !!ru.cleared;
        /* 地面：石砌方块 */
        for (let yy = 0; yy < ru.h; yy++) {
          for (let xx = 0; xx < ru.w; xx++) {
            const edge = (xx === 0 || yy === 0 || xx === ru.w - 1 || yy === ru.h - 1);
            if (!edge && (xx + yy) % 3 === 1) continue;       /* 内部留空，像废墟 */
            const gx = px + xx * T, gy = py + yy * T;
            c.fillStyle = cleared ? '#4a4a44' : '#6b6a60';
            c.fillRect(gx, gy, T, T);
            c.fillStyle = 'rgba(255,255,255,.06)';
            c.fillRect(gx, gy, T, 3);
            c.fillStyle = 'rgba(0,0,0,.18)';
            c.fillRect(gx, gy + T - 3, T, 3);
          }
        }
        /* 残墙：四角立柱 */
        const pillars = [[0, 0], [ru.w - 1, 0], [0, ru.h - 1], [ru.w - 1, ru.h - 1]];
        for (let k = 0; k < pillars.length; k++) {
          const gx = px + pillars[k][0] * T, gy = py + pillars[k][1] * T;
          c.fillStyle = cleared ? '#5a5a52' : '#8a887c';
          c.fillRect(gx - 3, gy - 26, T + 6, 30);
          c.fillStyle = 'rgba(255,255,255,.12)';
          c.fillRect(gx - 3, gy - 26, T + 6, 4);
          c.fillStyle = 'rgba(0,0,0,.25)';
          c.fillRect(gx - 3, gy + 1, T + 6, 3);
        }
        /* 中心标记：品质色光圈 */
        const ccx = px + w / 2, ccy = py + h / 2;
        const col = (G.RUIN_RARITY[Math.min(5, ru.tier)] || {}).color || '#ffd479';
        c.globalAlpha = cleared ? 0.28 : 0.55 + Math.sin(this.time * 2 + i) * 0.12;
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(ccx, ccy, 22, 11, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = cleared ? 0.1 : 0.18;
        c.fillStyle = col;
        c.beginPath(); c.ellipse(ccx, ccy, 22, 11, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        /* 名称与档位 */
        c.font = 'bold 11px sans-serif';
        c.textAlign = 'center';
        const label = ru.name + (cleared ? '（已清空）' : '');
        const tw = c.measureText(label).width;
        c.globalAlpha = 0.55;
        c.fillStyle = '#0b0d12';
        c.fillRect(ccx - tw / 2 - 5, py - 44, tw + 10, 15);
        c.globalAlpha = 1;
        c.fillStyle = cleared ? '#9aa4b4' : col;
        c.fillText(label, ccx, py - 33);
        c.font = '9px sans-serif';
        c.fillStyle = 'rgba(200,210,230,.75)';
        c.fillText('档位 ' + (ru.tier + 1) + ' / 6', ccx, py - 20);
      }
      this.endWorld(c);
    },

    drawProps: function (c) {
      const T = TILE(), w = this.world, z = this.zoom;
      const pad = 40;
      const l = this.cam.x - pad, r = this.cam.x + this.W / z + pad;
      const t0 = this.cam.y - pad, b = this.cam.y + this.H / z + pad;
      const list = [];
      for (let i = 0; i < w.props.length; i++) {
        /* 已被采集破坏的 prop 不画（等待重生） */
        const st0 = this.propState[i];
        if (st0 && st0.gone) continue;
        const p = w.props[i];
        const px = p.x * T + T / 2, py = p.y * T + T;
        if (px < l || px > r || py < t0 || py > b) continue;
        list.push({ p: p, px: px, py: py, idx: i });
      }
      list.sort(function (a, b2) { return a.py - b2.py; });
      this.beginWorld(c);
      const sway = Math.sin(this.time * 1.7) * 0.9;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        /* 受击抖动：被砍中的资源会左右晃一下 */
        const st = this.propState[it.idx];
        let ox = 0;
        if (st && st.shakeT > 0) {
          const k = U.clamp(st.shakeT / 0.26, 0, 1);
          const amp = (G.RESOURCES && G.RESOURCES[it.p.kind]) ? G.RESOURCES[it.p.kind].shake : 1.6;
          ox = Math.sin(st.shakeT * 60) * amp * k;
        }
        if (ox) {
          c.save();
          c.translate(ox, 0);
          this.drawProp(c, it.p, it.px, it.py, sway);
          c.restore();
        } else {
          this.drawProp(c, it.p, it.px, it.py, sway);
        }
      }
      this.endWorld(c);
    },

    drawProp: function (c, p, x, y, sway) {
      c.save();
      c.translate(x, y);
      c.globalAlpha = 0.2;
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(0, 0, (p.kind === 'tree' || p.kind === 'pine') ? 9 : 6, 3.2, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      if (p.kind === 'tree') {
        c.fillStyle = '#6b4a2a';
        c.fillRect(-2, -13, 4, 13);
        c.save();
        c.translate(sway * 0.6, 0);
        c.fillStyle = '#3f7a34';
        c.beginPath(); c.arc(0, -21, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4e8f3f';
        c.beginPath(); c.arc(-4, -24, 7, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(5, -20, 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#5da24a';
        c.beginPath(); c.arc(-1, -28, 4.6, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (p.kind === 'pine') {
        c.fillStyle = '#4a3a26';
        c.fillRect(-1.6, -9, 3.2, 9);
        c.fillStyle = '#2f6f4a';
        for (let i = 0; i < 3; i++) {
          const yy = -10 - i * 6;
          c.beginPath();
          c.moveTo(0, yy - 7); c.lineTo(7 - i, yy + 2); c.lineTo(-7 + i, yy + 2);
          c.closePath(); c.fill();
        }
      } else if (p.kind === 'bush') {
        c.fillStyle = '#3d7a35';
        c.beginPath(); c.arc(-3, -4, 5.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(4, -3, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4f9142';
        c.beginPath(); c.arc(0, -7, 5, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = '#8d9490';
        c.beginPath(); c.arc(0, -3, 4.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#a3a9a4';
        c.beginPath(); c.arc(-1, -5, 3, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    },

    /* 生物绘制：按 y 排序与场景一起做前后遮挡；头顶显示「种类 · 名字」与性情标记 */
    drawCreatures: function (c) {
      const self = this;
      const list = this.creatures.slice().sort(function (a, b) { return a.y - b.y; });
      this.beginWorld(c);
      for (let i = 0; i < list.length; i++) {
        const cr = list[i];
        c.save();
        c.translate(cr.x, cr.y);
        /* 影子 */
        c.globalAlpha = 0.22;
        c.fillStyle = '#000';
        c.beginPath(); c.ellipse(0, 0, cr.size * 0.5, cr.size * 0.18, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        /* 善良生物被跟随 / 被喂过：脚下加一圈暖光 */
        if (cr.temper === 'friendly' && cr.follow > 0) {
          c.globalAlpha = 0.3;
          c.strokeStyle = '#5fe08a'; c.lineWidth = 1.4;
          c.beginPath(); c.ellipse(0, 0, cr.size * 0.62, cr.size * 0.24, 0, 0, Math.PI * 2); c.stroke();
          c.globalAlpha = 1;
        }
        /* 生物本体 */
        c.save();
        if (cr.hurtT > 0) c.globalAlpha = 0.65;
        G.Sprites.creature(c, {
          x: 0, y: 0, s: Math.max(1.1, cr.size / 17),
          species: cr.species, body: cr.body, body2: cr.body2, dark: cr.dark,
          snout: cr.snout, ear: cr.ear, comb: cr.comb, fin: cr.fin, tail: cr.tail, foot: cr.foot,
          horn: cr.horn, spot: cr.spot, tusk: cr.tusk, bristle: cr.bristle,
          staff: cr.staff, hat: cr.hat, pack: cr.pack, glow: cr.glow, eye: cr.eye,
          moving: cr.moving, flip: cr.face < 0
        }, self.time + cr.ph * 0.16);
        c.restore();
        /* 头顶姓名（带底衬，避免草地上看不清） */
        const label = cr.name + ' · ' + cr.nick;
        c.font = 'bold 9px sans-serif';
        c.textAlign = 'center';
        const tw = c.measureText(label).width;
        const ty = -cr.size * 1.5 - 4;
        c.globalAlpha = 0.55;
        c.fillStyle = '#0b0d12';
        c.fillRect(-tw / 2 - 3, ty - 9, tw + 6, 12);
        c.globalAlpha = 1;
        const tc = (G.TEMPER[cr.temper] || {}).color || '#c9d3e0';
        c.fillStyle = tc;
        c.fillText(label, 0, ty);
        /* 性情标记 */
        c.font = '8px sans-serif';
        c.fillStyle = tc;
        c.fillText((G.TEMPER[cr.temper] || {}).mark || '', tw / 2 + 9, ty);
        /* 血量条（受伤后才显示） */
        if (cr.hp < cr.maxHp) {
          const bw = Math.max(16, cr.size * 1.0);
          c.fillStyle = 'rgba(0,0,0,.6)';
          c.fillRect(-bw / 2, ty - 13, bw, 2.6);
          c.fillStyle = '#8fd97a';
          c.fillRect(-bw / 2, ty - 13, bw * U.clamp(cr.hp / cr.maxHp, 0, 1), 2.6);
        }
        c.restore();
      }
      this.endWorld(c);
    },

    drawMobs: function (c) {
      const self = this;
      const list = this.mobs.slice().sort(function (a, b) { return a.y - b.y; });
      this.beginWorld(c);
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        c.save();
        c.translate(m.x, m.y);
        c.globalAlpha = 0.24;
        c.fillStyle = '#000';
        c.beginPath(); c.ellipse(0, 0, 9, 3.4, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.save();
        /* 幽影狼 / 藤蔓魔 / 墓碑骷髅画得比通用造型大，缩放相应调小免得被裁掉 */
        c.scale(m.def.sprite === 'vine' ? 0.30 : (m.def.sprite ? 0.34 : 0.42),
                m.def.sprite === 'vine' ? 0.30 : (m.def.sprite ? 0.34 : 0.42));
        if (m.hitT > 0) c.globalAlpha = 0.7;
        G.Sprites.enemy(c, {
          x: 0, y: 0, s: Math.max(2, m.size / 7), color: m.color,
          /* sprite 优先（幽影狼 / 藤蔓魔 / 墓碑骷髅），否则按 kind 走通用造型 */
          kind: (m.elite && !m.def.sprite) ? 'elite' : (m.def.sprite || m.etype),
          affix: m.affix, flip: m.face < 0, size: m.size,
          charging: m.etype === 'charger' && m.cd > 0.6, attacking: m.hitT > 0
        }, self.time);
        c.restore();
        if (m.hp < m.maxHp) {
          const bw = Math.max(18, m.size * 1.1);
          c.fillStyle = 'rgba(0,0,0,.6)';
          c.fillRect(-bw / 2, -m.size * 0.95, bw, 3);
          c.fillStyle = m.elite ? '#c07cff' : '#ff6b6b';
          c.fillRect(-bw / 2, -m.size * 0.95, bw * U.clamp(m.hp / m.maxHp, 0, 1), 3);
        }
        if (m.elite) {
          c.fillStyle = '#c07cff';
          c.font = 'bold 9px sans-serif';
          c.textAlign = 'center';
          c.fillText('精英 · Lv' + m.lvl, 0, -m.size * 1.15);
        }
        c.restore();
      }
      this.endWorld(c);
    },

    drawLootLayer: function (c) {
      this.beginWorld(c);
      for (let i = 0; i < this.loot.length; i++) {
        const l = this.loot[i];
        const col = (G.Icons.QC && G.Icons.QC[l.rarity]) || '#ffffff';
        const bob = Math.sin(l.t * 5) * 2;
        c.save();
        c.translate(l.x, l.y + bob);
        c.globalAlpha = 0.3;
        c.fillStyle = col;
        c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = col;
        c.fillRect(-3.5, -3.5, 7, 7);
        c.fillStyle = '#fff';
        c.fillRect(-1.5, -1.5, 3, 3);
        c.restore();
      }
      this.endWorld(c);

      const p = this.player;
      let best = null, bd = 44;
      for (let i = 0; i < this.loot.length; i++) {
        const d = U.dist(this.loot[i].x, this.loot[i].y, p.x, p.y);
        if (d < bd) { bd = d; best = this.loot[i]; }
      }
      if (best) {
        const sx = (best.x - this.cam.x) * this.zoom, sy = (best.y - this.cam.y) * this.zoom;
        c.save();
        c.fillStyle = 'rgba(6,10,16,.8)';
        c.fillRect(sx - 11, sy - 34, 22, 15);
        c.strokeStyle = '#ffd479';
        c.lineWidth = 1.4;
        c.strokeRect(sx - 11, sy - 34, 22, 15);
        c.fillStyle = '#ffd479';
        c.font = 'bold 11px sans-serif';
        c.textAlign = 'center';
        c.fillText('E', sx, sy - 23);
        c.restore();
      }
    },

    /** 朝向指示器：脚下画一个指向当前朝向的扇形箭头 */
    /** 采集提示：瞄准范围内有资源时在目标上画一个圈与名字 */
    drawHarvestHint: function (c) {
      const tgt = this.findHarvestTarget(1);
      if (!tgt) return;
      const def = G.RESOURCES[tgt.kind];
      if (!def) return;
      c.save();
      c.globalAlpha = 0.85;
      c.strokeStyle = '#ffd28a';
      c.lineWidth = 1.4;
      c.setLineDash([4, 3]);
      c.beginPath();
      c.arc(tgt.x, tgt.y - 6, 15, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      const label = def.verb + def.name;
      c.font = 'bold 9px sans-serif';
      c.textAlign = 'center';
      const tw = c.measureText(label).width;
      c.globalAlpha = 0.5;
      c.fillStyle = '#0b0d12';
      c.fillRect(tgt.x - tw / 2 - 3, tgt.y - 34, tw + 6, 12);
      c.globalAlpha = 1;
      c.fillStyle = '#ffd28a';
      c.fillText(label, tgt.x, tgt.y - 25);
      c.restore();
    },

    drawFacing: function (c, p) {
      const on = this.rotateMode;
      c.save();
      c.translate(p.x, p.y + 1);
      /* 底盘圆环 */
      c.globalAlpha = on ? 0.5 : 0.24;
      c.strokeStyle = on ? 'rgba(255,170,90,.9)' : 'rgba(200,215,235,.6)';
      c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, 13, 5.6, 0, 0, Math.PI * 2); c.stroke();
      /* 朝向扇形 */
      c.globalAlpha = on ? 0.85 : 0.4;
      c.fillStyle = on ? 'rgba(255,170,90,.85)' : 'rgba(200,215,235,.7)';
      c.beginPath();
      c.ellipse(0, 0, 13, 5.6, 0, p.aim - 0.34, p.aim + 0.34);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
      /* 箭头尖 */
      c.globalAlpha = on ? 1 : 0.5;
      c.fillStyle = on ? '#ffd28a' : 'rgba(230,240,255,.85)';
      const ax = Math.cos(p.aim) * 15.5, ay = Math.sin(p.aim) * 6.8;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(ax - Math.cos(p.aim - 0.5) * 4.4, ay - Math.sin(p.aim - 0.5) * 3.0);
      c.lineTo(ax - Math.cos(p.aim + 0.5) * 4.4, ay - Math.sin(p.aim + 0.5) * 3.0);
      c.closePath();
      c.fill();
      c.restore();
    },

    drawPlayer: function (c) {
      const p = this.player;
      this.beginWorld(c);
      c.globalAlpha = 0.3;
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(p.x, p.y + 1, 11, 4, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      /* 朝向指示器：脚下的扇形箭头（旋转模式开启时更明显） */
      this.drawFacing(c, p);
      if (p.atkT > 0) {
        const prog = 1 - p.atkT / p.atkDur;
        c.save();
        c.globalAlpha = (1 - prog) * 0.5;
        c.fillStyle = '#dff0ff';
        c.beginPath();
        c.moveTo(p.x, p.y - 10);
        const spread = p.comboStep === 3 ? 1.5 : 1.0;
        c.arc(p.x, p.y - 10, p.reach * (p.comboStep === 3 ? 1.3 : 1), p.aim - spread, p.aim + spread);
        c.closePath();
        c.fill();
        c.restore();
      }
      c.save();
      c.translate(p.x, p.y);
      c.scale(0.5, 0.5);
      if (p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) c.globalAlpha = 0.55;
      G.Sprites.hero(c, {
        x: 0, y: 0, s: 3.2,
        ph: p.ph, moving: p.moving,
        action: p.atkT > 0 ? 'attack' : (p.hurtT > 0 ? 'hurt' : 'idle'),
        atkT: p.atkT > 0 ? 1 - p.atkT / p.atkDur : 0,
        aim: 0, look: G.getLook(G.State.state.account.look),
        equip: G.Sprites.equipFromState(), wtype: p.wtype, reach: 46,
        flip: (p.aim > Math.PI / 2 || p.aim < -Math.PI / 2), comboStep: p.comboStep
      });
      c.restore();
      this.endWorld(c);
    },

    drawFx: function (c) {
      this.beginWorld(c);
      for (let i = 0; i < this.fx.length; i++) {
        const f = this.fx[i];
        const k = f.t / f.max;
        c.save();
        if (f.kind === 'hit') {
          c.globalAlpha = k;
          c.fillStyle = '#ffd479';
          c.beginPath(); c.arc(f.x, f.y, (1 - k) * 14 + 3, 0, Math.PI * 2); c.fill();
        } else if (f.kind === 'slash') {
          c.globalAlpha = k * 0.7;
          c.strokeStyle = '#dff0ff';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(f.x, f.y - 10, f.r * (0.7 + (1 - k) * 0.4), f.ang - 0.8, f.ang + 0.8);
          c.stroke();
        } else if (f.kind === 'bolt') {
          /* 史莱姆水弹：从施法者飞向目标的一颗发光弹 */
          const px2 = f.x + (f.tx - f.x) * (1 - k);
          const py2 = f.y + (f.ty - f.y) * (1 - k);
          c.globalAlpha = 0.25;
          c.fillStyle = f.color || '#bfe8ff';
          c.beginPath(); c.arc(px2, py2, 7 + (1 - k) * 3, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.95;
          c.beginPath(); c.arc(px2, py2, 3.2, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.7;
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(px2 - 1, py2 - 1, 1.4, 0, Math.PI * 2); c.fill();
        } else if (f.kind === 'dash') {
          c.globalAlpha = k * 0.5;
          c.strokeStyle = '#9eeaff';
          c.lineWidth = 2;
          c.beginPath(); c.arc(f.x, f.y, (1 - k) * 26 + 6, 0, Math.PI * 2); c.stroke();
        } else if (f.kind === 'death') {
          c.globalAlpha = k * 0.6;
          c.fillStyle = f.color || '#ff8a3c';
          for (let j = 0; j < 6; j++) {
            const a = j / 6 * Math.PI * 2, r = (1 - k) * 24;
            c.fillRect(f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r - 2, 4, 4);
          }
        }
        c.restore();
      }
      this.endWorld(c);
    },

    drawFloats: function (c) {
      this.beginWorld(c);
      for (let i = 0; i < this.floats.length; i++) {
        const f = this.floats[i];
        c.save();
        c.globalAlpha = U.clamp(f.t / 0.8, 0, 1);
        c.fillStyle = f.color;
        c.font = 'bold ' + f.size + 'px "Microsoft YaHei",sans-serif';
        c.textAlign = 'center';
        c.shadowColor = 'rgba(0,0,0,.85)';
        c.shadowBlur = 4;
        c.fillText(f.text, f.x, f.y);
        c.restore();
      }
      this.endWorld(c);
    },

    drawRain: function (c) {
      c.save();
      c.strokeStyle = 'rgba(205,228,255,.26)';
      c.lineWidth = 1;
      c.beginPath();
      const span = this.W + 400;
      for (let i = 0; i < this.rain.length; i++) {
        const r = this.rain[i];
        const sx = ((r.x % span) + span) % span - 200;
        c.moveTo(sx, r.y);
        c.lineTo(sx - r.s * 0.22, r.y + r.s);
      }
      c.stroke();
      c.restore();
    },

    drawVignette: function (c) {
      const g = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.36,
                                       this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.74);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(6,10,16,.5)');
      c.fillStyle = g;
      c.fillRect(0, 0, this.W, this.H);
    },

    drawStatusLine: function (c) {
      const T = TILE();
      const t = G.tInfo(G.tileAt(this.world, Math.floor(this.player.x / T), Math.floor(this.player.y / T)));
      c.save();
      c.font = '12px "Microsoft YaHei",sans-serif';
      c.fillStyle = 'rgba(233,238,247,.72)';
      c.textAlign = 'left';
      c.fillText('地形：' + t.name + '　坐标 ' + Math.floor(this.player.x / T) + ', ' + Math.floor(this.player.y / T) +
                 '　已探索 ' + Math.round(this.player.distance / T) + ' 格', 14, this.H - 12);
      c.textAlign = 'right';
      c.fillText('Tab 背包　·　M 地图　·　左键攻击/采集　·　右键闪避　·　E 拾取　·　F 药剂　·　Shift 疾跑　·　T 旋转模式　·　滚轮转向', this.W - 14, this.H - 12);
      c.restore();
    },

    /* ---------------- 朝向旋转 ---------------- */
    /** 把任意弧度归一化到档位索引 0..7（0=东，每档 45° 顺时针） */
    _aimToSlot: function (aim) {
      const u = Math.PI / 4;
      let k = Math.round(aim / u);
      return ((k % 8) + 8) % 8;
    },
    /** 档位索引 → 弧度（保持在 -π..π，方便三角函数与朝向名） */
    _slotToAim: function (slot) {
      const u = Math.PI / 4;
      const k = ((slot % 8) + 8) % 8;
      let a = k * u;
      if (a > Math.PI) a -= Math.PI * 2;
      return a;
    },
    /** 相对当前朝向转 step 档（每档 45°；step 为正 = 顺时针） */
    faceStep: function (step) {
      const p = this.player;
      /* 关键：先把当前朝向转成 0..7 的档位索引再加减，
         否则负档位与正档位混用会一次跳两档（西 → 西南 → 北 的错误） */
      const slot = this._aimToSlot(p.aim);
      const next = this._slotToAim(slot + step);
      p.aimWant = next;
      p.aim = next;                    /* 立即生效：同一帧内连滚可以逐档累积 */
      p.face = Math.cos(next) >= 0 ? 1 : -1;
      G.Audio.play('click');
      this.toast('朝向 ' + this.faceName(next));
    },
    /** 朝向名（用于提示） */
    faceName: function (aim) {
      const names = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
      return names[this._aimToSlot(aim)];
    },
    /** 切换旋转模式（T）：开 = WASD 决定朝向，关 = 朝向跟随移动 / 鼠标 */
    toggleRotate: function () {
      this.rotateMode = !this.rotateMode;
      G.Audio.play('click');
      this.toast(this.rotateMode
        ? '旋转模式：开（WASD 转向，可原地转身；滚轮微调 45°）'
        : '旋转模式：关（朝向跟随移动方向 / 鼠标）');
      this.syncHud();
    },
    /** Tab：在世界内打开背包浮层（不离开地图，世界循环暂停） */
    openBag: function () {
      if (this.bagOpen) return;
      this.bagOpen = true;
      this.bagWasPaused = this.paused;
      G.Audio.play('click');
      this.buildBag();
      this.syncHud();
    },
    closeBag: function () {
      if (!this.bagOpen) return;
      this.bagOpen = false;
      if (this.bagEl && this.bagEl.parentNode) this.bagEl.parentNode.removeChild(this.bagEl);
      this.bagEl = null;
      G.Audio.play('back');
      this.syncHud();
    },
    toggleBag: function () { if (this.bagOpen) this.closeBag(); else this.openBag(); },
    /** 构建背包浮层（HTML 覆盖在画布之上，像素画布不受影响） */
    buildBag: function () {
      const st = G.State.state;
      const self = this;
      const el = document.createElement('div');
      el.className = 'bag-overlay';
      /* 物品分类汇总（bagList 返回 {item, count} 包装对象） */
      const groups = { consume: [], material: [], blueprint: [] };
      G.State.bagList('all').forEach(function (row) {
        const it = row.item || row;
        const g = groups[it.kind] || groups.material;
        g.push({ item: it, count: row.count || 1 });
      });
      const KIND_NAME = { consume: '消耗品', material: '材料与采集物', blueprint: '图纸' };
      let body = '';
      ['consume', 'material', 'blueprint'].forEach(function (k) {
        const arr = groups[k];
        if (!arr.length) return;
        body += '<div class="bag-group"><div class="bag-gt">' + KIND_NAME[k] + '（' + arr.length + '）</div><div class="bag-grid">';
        arr.forEach(function (row) {
          const it = row.item;
          body += '<div class="bag-cell rq-' + (it.rarity || 0) + '" data-tip="' + U.esc(it.name) + '">' +
            G.Icons.item(it) + '<b class="bag-n">' + row.count + '</b>' +
            '<span class="bag-nm">' + U.esc(it.name) + '</span></div>';
        });
        body += '</div></div>';
      });
      if (!body) body = '<div class="bag-empty">背包是空的<br><span class="tiny">砍树、挖沙、打水、击败生物都会掉落物品</span></div>';
      /* 武器与衣物 */
      const w = G.State.weapon();
      const clothRows = G.SLOTS.map(function (s) {
        const c = G.State.clothAt(s.id);
        return '<div class="bag-eq"><span class="bag-eqk">' + s.label + '</span>' +
          '<span class="bag-eqv ' + (c ? U.qClass(c.rarity) : '') + '">' + (c ? U.esc(c.name) : '未装备') + '</span></div>';
      }).join('');
      el.innerHTML =
        '<div class="bag-box">' +
        '  <div class="bag-head"><b>背包</b><span class="bag-tip">Tab 关闭　·　世界已暂停</span>' +
        '    <button class="btn sm ghost" id="bag-close">关闭</button></div>' +
        '  <div class="bag-cols">' +
        '    <div class="bag-main">' + body + '</div>' +
        '    <div class="bag-side">' +
        '      <div class="bag-gt">当前装备</div>' +
        '      <div class="bag-eq"><span class="bag-eqk">武器</span><span class="bag-eqv ' + (w ? U.qClass(w.rarity) : '') + '">' +
        (w ? U.esc(w.name) : '空手') + '</span></div>' + clothRows +
        '      <div class="bag-gt" style="margin-top:12px">快捷</div>' +
        '      <div class="bag-key"><kbd>F</kbd> 使用药剂　<kbd>E</kbd> 拾取</div>' +
        '      <div class="bag-key"><kbd>Tab</kbd> 开关背包　<kbd>M</kbd> 地图</div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      const host = this.cv.parentNode || document.body;
      host.appendChild(el);
      this.bagEl = el;
      U.qs('#bag-close', el).onclick = function () { self.closeBag(); };
      /* 点遮罩空白处也关闭 */
      el.onclick = function (e) { if (e.target === el) self.closeBag(); };
    },

    /* ---------------- 大地图 ---------------- */
    toggleMap: function () {
      if (this.map && this.map.isOpen) { this.map.close(); this.map = null; return; }
      if (!this.mapThumb) this.mapThumb = G.renderMapThumb(this.world, 3);
      const self = this;
      this.map = G.MapView.open({
        thumb: this.mapThumb,
        world: this.world,
        player: this.player,
        getMobs: function () { return self.mobs; },
      });
    },

    /* ---------------- HUD ---------------- */
    syncHud: function () {
      const p = this.player;
      const set = function (id, v) { const el = document.getElementById(id); if (el) el.textContent = v; };
      const bar = function (id, pct) { const el = document.getElementById(id); if (el) el.style.width = U.clamp(pct, 0, 100) + '%'; };
      bar('w-hp', p.hp / p.maxHp * 100);
      bar('w-st', p.stamina / p.maxStamina * 100);
      const need = G.State.expNeed(p.lvl);
      bar('w-xp', ((G.State.state.account.exp || 0) / need) * 100);
      set('w-hp-t', Math.max(0, Math.round(p.hp)) + ' / ' + p.maxHp);
      set('w-st-t', Math.round(p.stamina) + ' / ' + p.maxStamina);
      set('w-lvl', 'Lv ' + p.lvl);
      set('w-kills', p.kills);
      set('w-loot', p.looted);
      set('w-ember', p.ember);
      set('w-mobs', this.mobs.length);
      const T = TILE();
      set('w-terrain', G.tInfo(G.tileAt(this.world, Math.floor(p.x / T), Math.floor(p.y / T))).name);
    },

    syncPause: function () {
      const el = document.getElementById('w-pause');
      if (el) el.classList.toggle('hide', !this.paused);
    },

    toast: function (msg, kind) {
      if (G.Screen && G.Screen.toast) G.Screen.toast(msg, kind);
    },
  };
})(window.G = window.G || {});
