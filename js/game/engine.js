/* =========================================================
   余烬回廊 · 战斗核心（横板平台 · 肉鸽逐层推进）
   ========================================================= */
(function (G) {
  const U = G.U;
  const GRAV = 2000, MAXFALL = 1150, WORLD_H = 720;

  /* 战技定义 */
  const SKILLS = {
    sk_dash_cut: { name: '疾影斩', icon: '⚡', cd: 4.5, cost: 18, cast: function (w, p) { p.dashT = 0.22; p.dashDirX = p.face; p.pendingSlash = 0.12; } },
    sk_whirl: { name: '回旋斩', icon: '🌀', cd: 6, cost: 22, cast: function (w, p) { p.spinT = 0.6; p.spinHit = {}; } },
    sk_quake: { name: '崩地斩', icon: '💥', cd: 7.5, cost: 26, cast: function (w, p) { p.quakeT = 0.5; } },
    sk_execute: { name: '处决宣告', icon: '☠️', cd: 10, cost: 32, cast: function (w, p) { p.markT = 5; } },
    sk_thrust: { name: '贯穿突刺', icon: '➤', cd: 5.5, cost: 20, cast: function (w, p) { p.dashT = 0.3; p.dashDirX = p.face; p.pierceT = 0.3; } },
    sk_chain: { name: '连锁雷击', icon: '🌩️', cd: 9, cost: 30, cast: function (w, p) { p.chainT = 0.4; } },
    sk_frenzy: { name: '狂怒连斩', icon: '🔥', cd: 8, cost: 24, cast: function (w, p) { p.frenzyT = 4; } },
    sk_gravity_well: { name: '重力奇点', icon: '🕳️', cd: 12, cost: 36, cast: function (w, p) { p.wellT = 3.4; } },
    sk_rain: { name: '箭雨', icon: '🌧️', cd: 7, cost: 22, cast: function (w, p) { p.rainT = 0.6; p.rainN = 0; } },
    sk_pierce_shot: { name: '破空贯射', icon: '🎯', cd: 8, cost: 26, cast: function (w, p) { p.giantShot = true; } },
    sk_barrage: { name: '风暴弹幕', icon: '💠', cd: 9, cost: 30, cast: function (w, p) { p.barrageT = 0.7; p.barrageN = 0; } },
    sk_void_nova: { name: '虚空新星', icon: '🌌', cd: 10, cost: 34, cast: function (w, p) { p.novaT = 0.35; } },
    sk_flame_rush: { name: '烈焰冲拳', icon: '👊', cd: 6, cost: 20, cast: function (w, p) { p.rushT = 0.5; p.rushN = 0; } },
    sk_reap: { name: '魂之收割', icon: '🌾', cd: 9.5, cost: 30, cast: function (w, p) { p.reapT = 0.45; } },
    sk_flame_domain: { name: '焚烬领域', icon: '🜂', cd: 13, cost: 38, cast: function (w, p) { p.domainT = 6; p.domainX = p.x; } },
    sk_dawn_burst: { name: '破晓爆发', icon: '🌅', cd: 14, cost: 40, cast: function (w, p) { p.dawnT = 0.6; } }
  };

  /* 按键 -> 战技槽位命名（按武器类型给出更贴切的标签） */
  const SKILL_LABEL = {
    dash_cut: '冲刺斩', whirl: '回旋斩', quake: '崩地斩', execute: '处决', thrust: '突刺', chain: '连锁雷击',
    frenzy: '狂怒', gravity_well: '奇点', rain: '箭雨', pierce: '贯射', barrage: '弹幕', nova: '新星',
    rush: '冲拳', reap: '收割', domain: '焚烬领域', dawn: '破晓'
  };

  function roomLayout(rng, roomIndex, diff) {
    /* 地面 + 2~3 层平台（尺寸随房间序号轻微变化） */
    const plats = [{ x: 0, y: WORLD_H - 60, w: 1600, h: 60, ground: true }];
    const layouts = [
      [{ x: 180, y: WORLD_H - 200, w: 300 }, { x: 620, y: WORLD_H - 250, w: 260 }, { x: 1030, y: WORLD_H - 195, w: 320 }, { x: 480, y: WORLD_H - 380, w: 220 }],
      [{ x: 120, y: WORLD_H - 240, w: 260 }, { x: 520, y: WORLD_H - 190, w: 240 }, { x: 880, y: WORLD_H - 250, w: 240 }, { x: 1220, y: WORLD_H - 200, w: 260 }, { x: 660, y: WORLD_H - 400, w: 260 }],
      [{ x: 300, y: WORLD_H - 170, w: 420 }, { x: 900, y: WORLD_H - 170, w: 420 }, { x: 600, y: WORLD_H - 340, w: 380 }],
      [{ x: 90, y: WORLD_H - 210, w: 220 }, { x: 430, y: WORLD_H - 300, w: 200 }, { x: 720, y: WORLD_H - 180, w: 220 }, { x: 1050, y: WORLD_H - 300, w: 200 }, { x: 1340, y: WORLD_H - 210, w: 200 }]
    ];
    const pick = layouts[(roomIndex + diff) % layouts.length];
    pick.forEach(function (p) {
      plats.push({ x: p.x, y: p.y, w: p.w, h: 20, ground: false });
    });
    return plats;
  }

  function Game(canvas, hud) {
    this.cv = canvas;
    this.hud = hud;
    this.ctx = canvas.getContext('2d');
    this.keys = {};
    this.mouse = { x: 0, y: 0, left: false, right: false };
    this.running = false;
    this.paused = false;
    this.over = false;
    this.time = 0;
    this.acc = 0;
    this.last = 0;
    this.pickups = [];
    this.projs = [];
    this.fx = [];
    this.floats = [];
    this.corpses = [];
    this.loot = [];
    this.shake = 0;
    this.hitFlash = 0;
    this.waveNote = null;
    this.pending = 0;
  }

  Game.prototype = {
    /* ================= 初始化 ================= */
    start: function (stageId) {
      this.stage = G.STAGES.find(function (s) { return s.id === stageId; }) || G.STAGES[0];
      this.diff = this.stage.diff;
      const t = G.State.totals();
      const st = G.State.state;
      this.tot = t;
      this.player = {
        kind: 'player',
        x: 200, y: WORLD_H - 120, w: 26, h: 40, vx: 0, vy: 0,
        face: 1, onGround: false, jumps: 0,
        maxHp: t.maxHp, hp: t.maxHp,
        stamina: t.stamina, maxStamina: t.stamina,
        stamReg: 16, ember: 0, maxEmber: 100,
        atkT: 0, atkDur: 1 / t.spdW, attackIdx: 0, combo: 0, comboT: 0,
        invuln: 0, dashT: 0, dashCd: 0, dashDirX: 1, hitStop: 0,
        hurtT: 0, moving: false, ph: 0, aim: 0,
        slashArc: null, hitSet: {}, heavy: false,
        wtype: t.wtype, reach: t.reach, atk: t.atk, crit: t.crit, dr: t.dr,
        cds: {}, buffs: {}, items: this.buildItemBar(),
        reviveUsed: false, dead: false, markT: 0,
        /* —— 新增：操作体系状态 —— */
        crouch: false, slideT: 0, fastFall: false,
        jumpHold: false, jumpHoldT: 0,
        comboStep: 0, buffered: false, bufferT: 0,
        airAtk: false, flash: 0, echoes: [],
        landT: 0, runDust: 0, slideDust: 0, airborne: false, running: false, wasGround: true,
        shield: 0, barrierT: 0, stealthT: 0, revealT: 0, mirrorT: 0,
        titleIdx: 0, ranged: false, skillRmb: null, skillQ: null, skillShift: null,
        lastStandUsed: false, revivePassiveUsed: false, suppressAura: 0
      };
      /* 称号与技能线（随累计余烬进化） */
      const embers = (G.State.state.wallet && G.State.state.wallet.i_ember) || 0;
      this.player.titleIdx = G.titleIndexFor(embers);
      this.player.ranged = ['bow', 'crossbow', 'staff'].indexOf(t.wtype) >= 0;
      this.player.skillRmb = G.skillFor('rmb', this.player.titleIdx, this.player.ranged);
      this.player.skillQ = G.skillFor('q', this.player.titleIdx, this.player.ranged);
      this.player.skillShift = G.skillFor('shift', this.player.titleIdx, this.player.ranged);
      this.player.passive = G.passiveFor(this.player.titleIdx);
      /* 道标领主（第 8 档）起：法则印记可叠加增伤 */
      this.player.markAmpStack = this.player.titleIdx >= 7;
      this.title = G.titleFor(embers);
      this.room = 0;
      this.totalRooms = this.stage.rooms;
      this.kills = 0; this.eliteKills = 0; this.bossKills = 0;
      this.gained = {}; this.dmgDone = 0; this.dmgTaken = 0; this.startTime = performance.now();
      this.isBossRoom = false;
      this.loadRoom(0);
      this.running = true;
      this.bindInput();
      this.resize();
      const self = this;
      this._onResize = function () { self.resize(); };
      window.addEventListener('resize', this._onResize);
      this.last = performance.now();
      this.raf = requestAnimationFrame(function (n) { self.loop(n); });
      /* 开局提示 */
      this.setWaveNote('第 ' + this.diff + ' 层', this.stage.name + ' · 房间 1 / ' + this.totalRooms);
      G.State.state.stats.bestDepth = Math.max(G.State.state.stats.bestDepth, this.diff);
      G.State.trackRun();
    },

    stop: function () {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      this.unbindInput();
      this.cleanupHud();
    },

    buildItemBar: function () {
      const bar = [];
      const list = G.State.bagList('consume');
      ['i_potion_s', 'i_potion_l', 'i_stamina_draught', 'i_ember_flask', 'i_iron_skin', 'i_throw_bomb', 'i_smoke_bomb'].forEach(function (id) {
        const p = list.find(function (x) { return x.item.id === id; });
        if (p) bar.push({ id: id, item: p.item, count: p.count, cd: 0 });
      });
      return bar.slice(0, 3);
    },

    /* ================= 关卡房间 ================= */
    loadRoom: function (idx) {
      this.room = idx;
      this.plats = roomLayout(Math.random, idx, this.diff);
      this.enemies = [];
      this.projs = [];
      this.pickups = [];
      this.loot = [];
      this.corpses = [];
      this.fx = [];
      this.floats = [];
      this.isBossRoom = this.stage.boss && idx === this.totalRooms - 1;
      this.portal = null;
      this.clearShown = false;

      const p = this.player;
      p.x = 180; p.y = WORLD_H - 120; p.vx = 0; p.vy = 0;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.12));
      p.stamina = p.maxStamina;

      /* 波次与敌人配置 */
      this.wave = 0;
      this.waves = this.isBossRoom ? 1 : (this.diff >= 4 ? 3 : 2);
      this.spawnWave();

      if (this.isBossRoom) this.setWaveNote('⚠ 首领房间', G.Enemies.get(G.Enemies.bossFor(this.diff)).name);
      else this.setWaveNote('房间 ' + (idx + 1) + ' / ' + this.totalRooms, '清除全部敌人以开启传送门');
    },

    spawnWave: function () {
      this.wave++;
      const diff = this.diff;
      const scale = 1 + (diff - 1) * 0.34 + this.room * 0.12;
      const list = [];
      if (this.isBossRoom) {
        list.push({ id: G.Enemies.bossFor(diff), elite: false, boss: true });
        const minions = 2 + diff;
        for (let i = 0; i < minions; i++) list.push({ id: U.pick(G.Enemies.poolFor(diff)), elite: i % 3 === 0 });
      } else {
        const n = 3 + Math.floor(diff * 0.9) + this.room + (this.wave - 1);
        const pool = G.Enemies.poolFor(diff);
        for (let i = 0; i < n; i++) {
          const eliteChance = 0.06 + diff * 0.05 + (this.wave - 1) * 0.04;
          list.push({ id: U.pick(pool), elite: Math.random() < eliteChance && this.wave > 1 });
        }
      }
      const self = this;
      list.forEach(function (cfg, i) {
        const base = G.Enemies.get(cfg.id);
        if (!base) return;
        const affix = cfg.elite ? U.pick(G.ELITE_AFFIX) : null;
        const e = {
          kind: 'enemy', def: base, id: base.id, name: base.name,
          x: 320 + ((i * 173) % 1150) + U.rnd(-24, 24),
          y: WORLD_H - 140 - (i % 3) * 60,
          w: base.size * 2, h: base.size * 2.2,
          vx: 0, vy: 0, onGround: false, face: -1,
          hp: Math.round(base.hp * scale * (affix ? affix.hp : 1) * (cfg.boss ? 1 : 1)),
          maxHp: 0, atk: Math.round(base.atk * (0.85 + scale * 0.3) * (affix ? affix.atk : 1)),
          spd: base.spd * (affix ? affix.spd : 1),
          size: base.size * (affix && affix.id === 'af_giant' ? 1.4 : 1),
          behavior: base.behavior, weak: base.weak,
          etype: base.kind, color: base.color, undead: !!base.undead,
          affix: affix, boss: !!cfg.boss,
          state: 'idle', st: U.rnd(0.4, 2.4), cd: U.rnd(0.6, 2),
          hitT: 0, alpha: 1, dropTable: base.drops,
          ph: U.rnd(0, 6), dead: false, elite: !!cfg.elite
        };
        e.maxHp = e.hp;
        self.enemies.push(e);
      });
      if (this.wave < this.waves) this.pending = 0;
    },

    /* ================= 输入 ================= */
    bindInput: function () {
      const self = this;
      this._kd = function (e) {
        const k = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
        const first = !self.keys[k];
        self.keys[k] = true;
        if (k === 'escape') {
          if (self.over) return;
          self.paused = !self.paused;
          self.syncPause();
        }
        /* 主技能 / 副技能 / 闪避：按下即触发一次 */
        if (k === 'q' && first) self.useSlot('q');
        if ((k === 'shift' || k === 'shiftleft' || k === 'shiftright') && first) self.useSlot('shift');
        /* 交互 / 拾取 */
        if (k === 'e' && first) self.interact();
        /* 旧键位保留为别名，避免手感断层 */
        if (k === 'f' && first) self.useItem();
        if (k === '1' || k === '2' || k === '3') {
          const i = parseInt(k, 10) - 1;
          if (self.player.items[i]) { self.itemIdx = i; self.syncHud(); }
        }
      };
      this._ku = function (e) { self.keys[e.key.toLowerCase()] = false; };
      this._mm = function (e) {
        const r = self.cv.getBoundingClientRect();
        self.mouse.x = (e.clientX - r.left) * (self.W / r.width);
        self.mouse.y = (e.clientY - r.top) * (self.H / r.height);
      };
      this._md = function (e) {
        if (self.paused || self.over) return;
        self._mm(e);
        if (e.button === 0) { self.mouse.left = true; self.tryAttack(false); }
        if (e.button === 2) { self.mouse.right = true; self.useSlot('rmb'); }
      };
      this._mu = function (e) {
        if (e.button === 0) self.mouse.left = false;
        if (e.button === 2) self.mouse.right = false;
      };
      this._cm = function (e) { e.preventDefault(); };
      window.addEventListener('keydown', this._kd);
      window.addEventListener('keyup', this._ku);
      this.cv.addEventListener('mousemove', this._mm);
      this.cv.addEventListener('mousedown', this._md);
      window.addEventListener('mouseup', this._mu);
      this.cv.addEventListener('contextmenu', this._cm);
    },
    unbindInput: function () {
      window.removeEventListener('keydown', this._kd);
      window.removeEventListener('keyup', this._ku);
      this.cv.removeEventListener('mousemove', this._mm);
      this.cv.removeEventListener('mousedown', this._md);
      window.removeEventListener('mouseup', this._mu);
      this.cv.removeEventListener('contextmenu', this._cm);
    },

    /* ================= 尺寸 ================= */
    resize: function () {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = Math.max(640, r.width);
      this.H = Math.max(360, r.height);
      this.cv.width = Math.round(this.W * dpr);
      this.cv.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      /* 让 1600×720 的世界完整铺满视口：取高/宽两个比例中较小者，保证任何比例下都不裁切 */
      this.scale = Math.min(this.H / WORLD_H, this.W / 1600);
      /* 美术倍率：随视口大小整体缩放，保证角色与场景比例一致 */
      this.world = U.clamp(this.H / 800, 0.62, 1.3);
    },

    /* ================= 主循环 ================= */
    loop: function (now) {
      if (!this.running) return;
      const self = this;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.over) {
        this.acc += dt;
        const step = 1 / 60;
        let guard = 0;
        while (this.acc >= step && guard < 5) { this.update(step); this.acc -= step; guard++; }
      } else {
        this.time += dt * 0.2;
      }
      this.render();
      this.raf = requestAnimationFrame(function (n) { self.loop(n); });
    },

    /* ================= 更新 ================= */
    update: function (dt) {
      this.time += dt;
      const p = this.player;
      if (this.hitStop > 0) { this.hitStop -= dt; return; }
      if (p.hitStop > 0) { p.hitStop -= dt; dt *= 0.35; }

      this.updPlayer(dt);
      this.updEnemies(dt);
      this.updProjectiles(dt);
      this.updPickups(dt);
      this.updFx(dt);
      this.updWaveLogic(dt);
      this.cleanup();

      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
      if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 2.6);
      if (this.waveNote) {
        this.waveNote.t -= dt;
        if (this.waveNote.t <= 0) { this.waveNote = null; this.syncHud(); }
      }
    },

    /* ---------------- 玩家 ---------------- */
    updPlayer: function (dt) {
      const p = this.player;
      const k = this.keys;

      /* 计时器 */
      ['invuln', 'dashT', 'dashCd', 'hurtT', 'markT', 'spinT', 'quakeT', 'pierceT', 'chainT', 'frenzyT', 'wellT', 'rainT', 'barrageT', 'novaT', 'rushT', 'reapT', 'domainT', 'dawnT', 'pendingSlash', 'slideT', 'bufferT', 'flash', 'barrierT', 'stealthT', 'revealT', 'mirrorT', 'landT'].forEach(function (key) {
        if (p[key] > 0) p[key] = Math.max(0, p[key] - dt);
      });

      /* 道具冷却 */
      p.items.forEach(function (it) { if (it.cd > 0) it.cd = Math.max(0, it.cd - dt); });

      /* 技能冷却（「魔力亲和」被动缩短 15%）；归零瞬间记录，用于 HUD 闪烁提示 */
      const cdr = (p.passive && p.passive.k === 'cdr') ? 1.15 : 1;
      p.cdReady = p.cdReady || {};
      Object.keys(p.cds).forEach(function (key) {
        const before = p.cds[key];
        if (before > 0) {
          const after = Math.max(0, before - dt * cdr);
          p.cds[key] = after;
          if (after <= 0) p.cdReady[key] = 1.6;          /* 冷却结束提示持续 1.6 秒 */
        }
      });
      Object.keys(p.cdReady).forEach(function (key) {
        if (p.cdReady[key] > 0) p.cdReady[key] = Math.max(0, p.cdReady[key] - dt);
      });

      /* 体力回复 */
      const stamRate = p.stamReg * (p.frenzyT > 0 ? 0.8 : 1);
      p.stamina = Math.min(p.maxStamina, p.stamina + stamRate * dt);

      /* 移动 */
      let spdMul = 1;
      if (p.frenzyT > 0) spdMul *= 1.1;
      if (p.passive && p.passive.k === 'lowHpSpd' && p.hp < p.maxHp * 0.2) spdMul *= 1.2;
      if (p.crouch) spdMul *= 0.45;
      const speed = 250 * (1 + this.tot.spd) * spdMul;
      let ax = 0;
      if (k['a'] || k['arrowleft']) ax -= 1;
      if (k['d'] || k['arrowright']) ax += 1;
      if (p.dashT > 0) {
        p.vx = p.dashDirX * 620;
      } else if (p.slideT > 0) {
        p.vx *= (1 - Math.min(0.9, dt * 3.2));                 /* 滑铲自然减速 */
        if (Math.abs(p.vx) < 40) p.slideT = 0;
      } else if (p.rushT > 0) {
        p.vx = p.face * 520;
      } else if (!p.onGround) {
        /* 空中操作修正：允许微调左右方向，但加速更迟钝、且不保留地面惯性 */
        const airAcc = ax !== 0 ? dt * 4.2 : dt * 0.9;
        p.vx += (ax * speed * 0.82 - p.vx) * Math.min(1, airAcc);
      } else {
        p.vx += (ax * speed - p.vx) * Math.min(1, dt * 12);
      }
      p.moving = Math.abs(p.vx) > 24;

      /* 下蹲 / 滑铲 / 快速下落（S） */
      const sDown = !!k['s'] || !!k['arrowdown'];
      if (sDown) {
        if (p.onGround && p.slideT <= 0) {
          /* 奔跑中按下 = 滑铲；静止/慢走按下 = 下蹲 */
          if (Math.abs(p.vx) > 170) {
            p.slideT = 0.34;
            p.vx = Math.sign(p.vx) * Math.max(360, Math.abs(p.vx) * 1.25);
            p.crouch = false;
            G.Audio.play('dash');
            this.spawnDust(p.x, p.y, 7);
          } else {
            p.crouch = true;
          }
        } else if (!p.onGround) {
          p.crouch = false;
          p.fastFall = true;                                    /* 空中加速下落 */
        }
      } else {
        p.crouch = false;
        p.fastFall = false;
      }
      /* 碰撞盒：下蹲/滑铲时高度减半 */
      const lowBox = p.crouch || p.slideT > 0;
      p.h = lowBox ? 20 : 40;
      p.hurtLow = lowBox;

      /* 跳跃（短按小跳 / 长按高跳 / 二段跳） */
      const jumpKey = k[' '] || k['w'] || k['arrowup'];
      if (jumpKey && !p.jumpHeld && p.jumps < 2 && !p.crouch) {
        p.vy = -640;
        p.jumps++;
        p.jumpHeld = true;
        p.jumpHold = true;
        p.jumpHoldT = 0;
        p.slideT = 0;
        G.Audio.play('dash');
        this.spawnDust(p.x, p.y, 5);
      }
      if (jumpKey && p.jumpHold && p.vy < 0) {
        /* 长按持续托举，最多 0.26 秒，最高提升约 30% */
        p.jumpHoldT += dt;
        if (p.jumpHoldT < 0.26) p.vy -= 1150 * dt;
      }
      if (!jumpKey) { p.jumpHeld = false; p.jumpHold = false; }
      if (p.vy >= 0) p.jumpHold = false;

      /* 突进闪避（Shift）：位移 + 无敌帧，具体效果由称号技能线决定 */
      if ((k['shift'] || k['shiftleft'] || k['shiftright']) && p.dashCd <= 0 && p.stamina >= 12) {
        this.doDodge(ax);
      }

      /* 物理（快速下落时重力加倍） */
      const gMul = p.dashT > 0 ? 0.15 : (p.fastFall ? 2.1 : 1);
      const wasAir = !p.onGround;
      const vyBefore = p.vy;
      p.vy = Math.min(p.fastFall ? 1500 : MAXFALL, p.vy + GRAV * gMul * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = U.clamp(p.x, 20, 1580);
      this.collide(p);

      /* 精灵姿态标记（供渲染层使用） */
      p.airborne = !p.onGround;
      p.running = p.onGround && Math.abs(p.vx) > 170;

      /* 落地缓冲：短暂下压并压出尘土 */
      if (p.onGround && wasAir && !p.wasGround) {
        p.landT = vyBefore > 700 ? 0.16 : 0.1;
        this.dustTrail(p.x, p.y, Math.sign(p.vx) || p.face, 16, vyBefore > 700 ? 8 : 5);
        if (vyBefore > 1100) this.shake = Math.min(this.shake + 3, 10);
      }
      p.wasGround = p.onGround;
      /* 奔跑扬尘 */
      if (p.running && p.landT <= 0) {
        p.runDust = (p.runDust || 0) + dt;
        if (p.runDust > 0.11) {
          p.runDust = 0;
          this.dustTrail(p.x - p.face * 6, p.y, Math.sign(p.vx) || p.face, 6, 1);
        }
      }
      /* 滑铲长条尘土 */
      if (p.slideT > 0) {
        p.slideDust = (p.slideDust || 0) + dt;
        if (p.slideDust > 0.03) {
          p.slideDust = 0;
          this.dustTrail(p.x, p.y, Math.sign(p.vx) || p.face, 22, 2);
        }
      }

      /* 朝向 */
      p.face = (this.mouse.x >= p.x * this.scale ? 1 : -1);
      p.aim = Math.atan2(this.mouse.y - (p.y - 20) * this.scale, this.mouse.x - p.x * this.scale);

      /* 攻击计时（命中判定在动作 28% 处触发） */
      if (p.atkT > 0) {
        p.atkT -= dt;
        const prog = 1 - p.atkT / p.atkDur;
        if (!p.hitDone && prog > 0.28) { p.hitDone = true; this.melleHit(); }
        if (p.atkT <= 0) p.atkFinishing = false;
      }
      /* 连招窗口：超时重置段数 */
      if (p.comboT > 0) {
        p.comboT -= dt;
        if (p.comboT <= 0) { p.comboStep = 0; p.combo = 0; }
      }
      /* 输入缓冲：攻击结束前 0.12 秒内的点击会自动接上下一段 */
      if (p.buffered) {
        p.bufferT -= dt;
        if (p.atkT <= 0.12 && p.bufferT > 0) {
          p.buffered = false;
          this.tryAttack(false);
        } else if (p.bufferT <= 0) {
          p.buffered = false;
        }
      }

      /* 连续攻击（按住左键） */
      if (this.mouse.left && p.atkT <= 0 && !this.paused) this.tryAttack(false);

      /* 闪避残影淡出 */
      if (p.echoes.length) {
        p.echoes.forEach(function (e) { e.life -= dt; });
        p.echoes = p.echoes.filter(function (e) { return e.life > 0; });
      }
      p.suppressAura = (p.passive && (p.passive.k === 'suppress' || p.passive.k === 'awe')) ? 1 : 0;

      /* 战技持续效果 */
      this.tickSkills(dt);

      /* 状态 */
      if (p.hurtT > 0) p.hurtT -= dt;
      p.ph += dt * (p.moving ? 9 : 2.4);
      if (p.hp <= 0 && !p.dead) this.onPlayerDeath();
    },

    collide: function (e) {
      e.onGround = false;
      const prevBottom = e.y;
      this.plats.forEach(function (pl) {
        if (e.x + e.w / 2 < pl.x || e.x - e.w / 2 > pl.x + pl.w) return;
        const top = pl.y + (pl.ground ? 0 : 0);
        if (e.vy >= 0 && prevBottom <= top + 12 && e.y >= top) {
          e.y = top; e.vy = 0; e.onGround = true;
          if (e.kind === 'player') e.jumps = 0;
        }
      });
      if (e.y > WORLD_H + 200) { e.y = WORLD_H - 120; e.vy = 0; if (e.kind === 'player') this.damagePlayer(12, 0, '坠落'); }
    },

    /* ---------------- 攻击（鼠标左键 · 三段连招 / 空中攻击） ---------------- */
    tryAttack: function (heavy) {
      const p = this.player;
      /* 输入缓冲：动作尾声的点击排队，避免断连 */
      if (p.atkT > 0.02) {
        if (!heavy && p.comboStep > 0) { p.buffered = true; p.bufferT = 0.28; }
        return;
      }
      if (p.hurtT > 0.2) return;
      const skill = p.skillLmb || G.skillFor('lmb', p.titleIdx, p.ranged);
      p.skillLmb = skill;
      const cost = (heavy ? 12 : 6) * (p.frenzyT > 0 ? 0.7 : 1);
      if (p.stamina < cost) { this.toast('体力不足', 'warn'); return; }
      p.stamina -= cost;
      p.heavyAtk = heavy;
      p.airAtk = !p.onGround;
      /* 三段连招推进 */
      p.comboStep = (p.comboT > 0 ? (p.comboStep % 3) + 1 : 1);
      p.comboT = 1.1;
      p.combo = p.comboStep;
      /* 第三段略慢、范围更大 */
      const stepDur = p.comboStep === 3 ? 1.35 : (p.comboStep === 2 ? 1.05 : 1);
      p.atkDur = (heavy ? 0.42 : 1 / this.tot.spdW) * stepDur * (p.frenzyT > 0 ? 0.62 : 1);
      p.atkT = p.atkDur;
      p.hitDone = false;
      p.hitSet = {};
      p.slashArc = { t: 1, heavy: heavy, step: p.comboStep };
      G.Audio.play('swing');
    },

    melleHit: function () {
      const p = this.player;
      const w = this.tot.weapon;
      const heavy = p.heavyAtk;
      const skill = p.skillLmb || G.skillFor('lmb', p.titleIdx, p.ranged);
      const step = p.comboStep || 1;
      /* 第三段范围更大；空中攻击为斜向斩 */
      const stepRange = step === 3 ? 1.25 : (step === 2 ? 1.08 : 1);
      const reach = (p.reach || 46) * (heavy ? 1.12 : 1) * stepRange * (skill.range || 1);
      const stepDmg = step === 3 ? 1.25 : (step === 2 ? 1.1 : 1);
      let dmg = Math.round(p.atk * (heavy ? (w ? w.heavy : 2) : 1) * stepDmg * (skill.dmg || 1));

      /* 远程武器 / 远程技能分支：发射投射物 */
      const isProj = (w && w.proj) || skill.proj || (skill.beam && p.ranged);
      if (isProj && !p.pierceT) {
        const pr = skill.proj || w.proj || { speed: 700, size: 7, kind: 'bolt', pierce: 1 };
        const burst = pr.burst || 1;
        const speed = pr.speed || 700;
        const ang = p.aim;
        for (let i = 0; i < burst; i++) {
          const a2 = ang + (burst > 1 ? (i - (burst - 1) / 2) * 0.09 : 0);
          this.projs.push({
            side: 'p', x: p.x + Math.cos(a2) * 16, y: p.y - 22 + Math.sin(a2) * 12,
            vx: Math.cos(a2) * speed, vy: Math.sin(a2) * speed,
            r: pr.size || 7, dmg: dmg, kind: pr.kind || 'bolt',
            pierce: (pr.pierce || 1) + (heavy ? 1 : 0),
            aoe: pr.aoe || 0, life: 1.8, hit: {},
            crit: Math.random() < p.crit, soul: !!skill.soul,
            color: skill.vfx === 'arcane' ? '#c9a0ff' : (skill.vfx === 'soul' ? '#8fd8ff' : (p.wtype === 'staff' ? '#a06cff' : '#e8eef8'))
          });
        }
        G.Audio.play(p.wtype === 'staff' ? 'cast' : 'shoot');
        this.muzzle(p.x + Math.cos(ang) * 20, p.y - 22 + Math.sin(ang) * 12, skill.vfx === 'arcane' ? '#c9a0ff' : '#ffd479');
        return;
      }

      /* 近战：按段数使用不同扇形 */
      const self = this;
      let hits = 0;
      const up = step === 2, down = step === 3;
      this.enemies.forEach(function (e) {
        if (e.dead) return;
        if (p.hitSet[e.__id]) return;
        const dx = e.x - p.x, dy = (e.y - e.h / 2) - (p.y - (p.hurtLow ? 12 : 20));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > reach + e.w / 2) return;
        if (dx * p.face < -e.w * 0.6) return;               // 背后的敌人不判定
        /* 上挑只打偏高目标，下劈优先砸地面目标 */
        if (up && dy > e.h * 0.4) return;
        p.hitSet[e.__id] = 1;
        hits++;
        const crit = Math.random() < p.crit;
        let final = Math.round(dmg * (crit ? 1.6 : 1) * (1 + (p.combo - 1) * 0.03));
        if (step === 3 && p.passive && p.passive.k === 'finisher') final = Math.round(final * 1.3);
        if (p.passive && p.passive.k === 'trueDmg') final = Math.round(final * 1.08);
        self.hurtEnemy(e, final, crit, dx);
        /* 段数附加效果 */
        if (up) { e.vy = -220; }                            // 上挑浮空
        if (down) { e.vy = Math.max(e.vy, 120); e.stunT = Math.max(e.stunT || 0, 0.25); }
        if (p.airAtk) { p.vy = Math.min(p.vy, -180); self.sparks(e.x, e.y - e.h / 2, 6, '#ffd479'); }  // 空中命中微弹 + 火花
        if (skill.mark) {
          /* 道标领主起：印记可叠加（每层 +20%，最高 3 层） */
          e.markT = skill.mark.dur;
          e.markStack = p.markAmpStack ? Math.min(3, (e.markStack || 1) + (e.markStack ? 1 : 0)) : 1;
          if (p.markAmpStack) self.floats.push({ x: e.x, y: e.y - e.h - 20, t: 0.7, text: '印记 ×' + e.markStack, color: '#c07cff', size: 11 });
        }
        if (skill.lifesteal) self.healPlayer(Math.max(1, Math.round(final * skill.lifesteal)));
      });
      if (hits) {
        /* 命中停顿：普通 1 帧量级，第三段更重 */
        this.hitStop = down ? 0.075 : 0.045;
        this.shake = Math.min(12, this.shake + (heavy ? 7 : (down ? 5 : 3)));
        if (skill.shake) this.shake = Math.min(12, this.shake + skill.shake);
      }
      /* 剑气：第 4 档起每段附带短距离飞行剑气 */
      if (hits && skill.wave) {
        this.projs.push({
          side: 'p', x: p.x + p.face * 26, y: p.y - 24,
          vx: p.face * skill.wave.speed, vy: 0, r: 16,
          dmg: Math.round(p.atk * skill.wave.dmg * (skill.wave.full ? 3 : 1)),
          kind: 'wave', pierce: skill.wave.full ? 99 : 2,
          life: skill.wave.full ? 1.6 : 0.9, hit: {}, color: skill.vfx === 'holy' ? '#ffd479' : '#bfe8ff'
        });
      }
      /* 领域：第 6 档地面残留减速领域 */
      if (hits && skill.field) this.spawnField(p.x + p.face * 40, skill.field);
      /* 汲血 / 灼烧类武器被动 */
      if (hits && w && w.vamp) this.healPlayer(Math.round(p.maxHp * w.vamp * hits));
      /* 大剑破甲：降低敌人攻击 */
      if (hits && p.wtype === 'greatsword') {
        this.enemies.forEach(function (e) { if (p.hitSet[e.__id] && !e.dead) e.atk = Math.max(1, Math.round(e.atk * 0.94)); });
      }
    },

    /* ---------------- 技能槽位：右键主技能 / Q 副技能 / Shift 闪避 ---------------- */
    useSlot: function (slot) {
      const p = this.player;
      if (p.dead || this.paused || this.over) return;
      if (slot === 'shift') return this.doDodge(null);
      const skill = slot === 'rmb' ? p.skillRmb : p.skillQ;
      if (!skill) { this.toast('技能尚未解锁', 'warn'); return; }
      const cdKey = slot + ':' + skill.name;
      if ((p.cds[cdKey] || 0) > 0) {
        this.toast(skill.name + ' 冷却中 ' + (p.cds[cdKey]).toFixed(1) + 's', 'warn');
        return;
      }
      /* 副技能消耗体力更少，主技能按档位 */
      const cost = slot === 'rmb' ? 10 : 16;
      if (p.stamina < cost) { this.toast('体力不足（需要 ' + cost + '）', 'warn'); return; }
      p.stamina -= cost;
      p.cds[cdKey] = (skill.cd || 4) ;
      if (slot === 'rmb') this.castMainSkill(skill);
      else this.castSubSkill(skill);
      this.toast(skill.name, 'ok');
      G.Audio.play('cast');
      this.syncHud();
    },

    /** 右键 · 主技能（近战冲击 / 远程弹体） */
    castMainSkill: function (skill) {
      const p = this.player;
      const mul = skill.dmg || 1.5;
      if (skill.proj || (!skill.melee && p.ranged)) {
        const pr = skill.proj || { speed: 620, pierce: 1, burst: 1 };
        const burst = pr.burst || 1;
        for (let i = 0; i < burst; i++) {
          const a2 = p.aim + (burst > 1 ? (i - (burst - 1) / 2) * 0.1 : 0);
          this.projs.push({
            side: 'p', x: p.x + Math.cos(a2) * 18, y: p.y - 24,
            vx: Math.cos(a2) * (pr.speed || 620), vy: Math.sin(a2) * (pr.speed || 620),
            r: skill.vfx === 'meteor' ? 22 : 12, dmg: Math.round(p.atk * mul),
            kind: skill.vfx === 'fireball' || skill.vfx === 'meteor' ? 'orb' : 'bolt',
            pierce: pr.pierce || 1, aoe: skill.aoe || 0, life: 2.2, hit: {},
            crit: Math.random() < p.crit, soul: !!skill.soul,
            color: skill.vfx === 'fireball' || skill.vfx === 'meteor' ? '#ff8a3c' : '#c9a0ff'
          });
        }
        G.Audio.play('shoot');
        return;
      }
      /* 近战主技能：范围冲击 + 击退 / 眩晕 */
      const reach = (p.reach || 46) * (skill.range || 1.3);
      const dmg = Math.round(p.atk * mul);
      const self = this;
      this.fx.push({ kind: 'shock', x: p.x + p.face * 40, y: WORLD_H - 60, t: 0.4, max: 0.4, r: reach * 1.6, color: skill.vfx === 'holy' ? '#ffd479' : '#bfe8ff' });
      this.enemies.forEach(function (e) {
        if (e.dead) return;
        const dx = e.x - p.x;
        if (dx * p.face < -20) return;
        if (U.dist(e.x, e.y - e.h / 2, p.x, p.y - 20) > reach + e.w / 2) return;
        self.hurtEnemy(e, dmg, Math.random() < p.crit, dx);
        e.vx += p.face * (skill.knock || 160);
        if (skill.launch) e.vy = -320;
        if (skill.stun) e.stunT = Math.max(e.stunT || 0, skill.stun);
        if (skill.root) e.rootT = Math.max(e.rootT || 0, skill.root);
        if (skill.debuff) e.defDownT = skill.debuff.dur;
      });
      if (skill.block) { p.barrierT = skill.block; p.invuln = Math.max(p.invuln, skill.block); }
      if (skill.beam) this.arcSlash(p.x + p.face * 60, p.y - 26, p.face, reach * 1.4, Math.round(p.atk * skill.beam.dmg), '#e8e8f0', 0.3);
      this.shake = Math.min(16, this.shake + 9);
    },

    /** Q · 副技能（治疗 / 护盾 / 领域 / 召唤） */
    castSubSkill: function (skill) {
      const p = this.player, self = this;
      const col = { green: '#5fe08a', red: '#ff6b6b', blue: '#4fd7ff', purple: '#c07cff', gold: '#ffd479', golddomain: '#ffd479', ghost: '#8fd8ff', summon: '#a06cff', grayform: '#dfe8f5', genesis: '#ffe9a8', ice: '#9eeaff', eye: '#ffd479', reset: '#ffffff', mirror: '#c9a0ff' }[skill.vfx] || '#ffffff';
      if (skill.heal) this.healPlayer(Math.round(p.maxHp * skill.heal));
      if (skill.shield || skill.barrier) { p.barrierT = skill.dur || 4; p.invuln = Math.max(p.invuln, 0.3); }
      if (skill.buff) { p.frenzyT = Math.max(p.frenzyT, skill.buff.dur); p.atk = Math.round(this.tot.atk * (1 + (skill.buff.atk || 0))); }
      if (skill.dr) p.dr = Math.min(0.8, p.dr + skill.dr);
      if (skill.reveal || skill.revealAll) p.revealT = skill.dur || skill.reveal || 5;
      if (skill.stealth) p.stealthT = skill.stealth;
      if (skill.freeze || skill.slow || skill.slowField) {
        const r = 190;
        this.enemies.forEach(function (e) {
          if (e.dead) return;
          if (U.dist(e.x, e.y - e.h / 2, p.x, p.y - 20) > r) return;
          if (skill.freeze) { e.freezeT = skill.freeze; e.vx = 0; }
          else e.slowT = 3;
        });
        this.fx.push({ kind: 'nova', x: p.x, y: p.y - 20, t: 0.5, max: 0.5, color: col });
      }
      if (skill.fear) {
        this.enemies.forEach(function (e) {
          if (!e.dead && U.dist(e.x, e.y, p.x, p.y) < 220) e.fearT = skill.fear;
        });
      }
      if (skill.minions) {
        for (let i = 0; i < skill.minions; i++) this.summonAlly(p.x + U.rnd(-40, 40), p.y - 20);
      }
      if (skill.resetCd) { p.cds = {}; this.toast('所有技能冷却已重置', 'ok'); }
      if (skill.amp) { p.ampT = skill.dur || 5; }
      /* 视觉：以自身为中心的领域 / 光效 */
      this.fx.push({ kind: 'nova', x: p.x, y: p.y - 20, t: 0.6, max: 0.6, color: col });
      this.fx.push({ kind: 'burst', x: p.x, y: p.y - 26, t: 0.5, max: 0.5, color: col });
      this.shake = Math.min(12, this.shake + 4);
    },

    /** 突进闪避（Shift）：位移 + 无敌 + 称号附加效果 */
    doDodge: function (ax) {
      const p = this.player;
      const skill = p.skillShift || G.skillFor('shift', p.titleIdx, p.ranged);
      const cdKey = 'shift:' + skill.name;
      if ((p.cds[cdKey] || 0) > 0) return;
      if (p.stamina < 12) { this.toast('体力不足', 'warn'); return; }
      const charges = skill.charges || 1;
      if (p.dodgeChargesLeft == null) p.dodgeChargesLeft = charges;
      if (p.dodgeChargesLeft <= 0) { this.toast('闪避次数已用尽', 'warn'); return; }
      p.dodgeChargesLeft--;
      if (p.dodgeChargesLeft <= 0) {
        p.cds[cdKey] = skill.cd || 0.85;
        setTimeout(function () { p.dodgeChargesLeft = charges; }, (skill.cd || 0.85) * 1000);
      }
      p.stamina -= 12;
      /* 闪避取消后摇：命中判定已生效后可用闪避即时打断普攻后摇 */
      if (p.atkT > 0 && p.hitDone) {
        p.atkT = 0;
        p.buffered = false;
        p.bufferT = 0;
        p.cancelFlash = 0.18;
      }
      const dir = ax !== 0 ? ax : (skill.blink ? p.face : (Math.abs(p.vx) > 40 ? Math.sign(p.vx) : p.face));
      p.dashDirX = dir;
      p.dashT = 0.16 * (skill.dist || 1);
      p.invuln = Math.max(p.invuln, skill.invuln || 0.26);
      if (skill.phase) p.phaseT = p.dashT;
      /* 残影 */
      p.echoes.push({ x: p.x, y: p.y, face: p.face, life: 0.3, max: 0.3, crouch: p.hurtLow, tone: skill.vfx });
      if (skill.trailField) {
        this.spawnField(p.x, skill.trailField);
        /* 法则突进：路径上的敌人挂上持续伤害 */
        if (skill.trailField.dmg) {
          const self0 = this;
          this.enemies.forEach(function (e) {
            if (!e.dead && Math.abs(e.x - p.x) < skill.trailField.r) self0.applyDot(e, Math.round(p.atk * skill.trailField.dmg), skill.trailField.dur || 3);
          });
        }
      }
      if (skill.burst) {
        this.shockwave(p.x, p.y - 20, 110, Math.round(p.atk * Math.max(0.6, skill.dmg)), false);
      } else if (skill.dmg > 0) {
        /* 撞到敌人造成伤害（穿过型） */
        const self = this;
        this.enemies.forEach(function (e) {
          if (!e.dead && Math.abs(e.x - p.x) < 40 && Math.abs((e.y - e.h / 2) - (p.y - 20)) < 50) {
            self.hurtEnemy(e, Math.round(p.atk * skill.dmg), Math.random() < p.crit, dir);
            if (skill.stun) e.stunT = Math.max(e.stunT || 0, skill.stun);
          }
        });
      }
      if (p.skillShift && p.skillShift.vfx === 'gray') {
        /* 神性残影：留下一道自动攻击的残影 */
        this.projs.push({ side: 'p', x: p.x, y: p.y - 22, vx: -dir * 120, vy: 0, r: 14, dmg: Math.round(p.atk * 0.6), kind: 'wave', pierce: 3, life: 0.6, hit: {}, color: '#dfe8f5' });
      }
      G.Audio.play('dash');
      this.spawnDust(p.x, p.y, 8);
    },

    /** 生成持续领域（减速 / 持续伤害） */
    spawnField: function (x, f) {
      this.fields = this.fields || [];
      this.fields.push({
        x: x, y: WORLD_H - 60, r: f.r || 110, dur: f.dur || 3, t: 0,
        slow: f.slow || 0, dmg: f.dmg || 0, tick: f.tick || 0.5, acc: 0,
        color: f.dmg ? '#a06cff' : '#ffd479'
      });
    },

    /** 对领域内敌人施加持续伤害（法则突进等） */
    applyDot: function (e, dmg, dur) {
      e.dotDmg = Math.max(e.dotDmg || 0, dmg);
      e.dotT = Math.max(e.dotT || 0, dur);
    },

    /** 召唤友方仆从 / 镜像 */
    summonAlly: function (x, y) {
      this.allies = this.allies || [];
      this.allies.push({ x: x, y: y, t: 8, cd: 0.6, face: 1 });
    },

    /* ---------------- E 键 · 交互 / 拾取 / 开门 ---------------- */
    interact: function () {
      const p = this.player;
      if (p.dead || this.paused || this.over) return;
      /* 1) 传送门：交互开门 */
      if (this.portal && U.dist(p.x, p.y - 20, this.portal.x, this.portal.y) < this.portal.r + 46) {
        p.interactT = 0.3;
        this.usePortalNext = true;
        this.toast(this.portal.last ? '进入结算' : '前往下一个房间', 'ok');
        G.Audio.play('ui_open');
        return;
      }
      /* 2) 掉落物：拾取最近一件 */
      let best = null, bd = 86;
      const self = this;
      this.loot.forEach(function (l) {
        const d = U.dist(l.x, l.y, p.x, p.y - 20);
        if (d < bd) { bd = d; best = l; }
      });
      if (best) {
        best.picked = true;
        p.interactT = 0.3;
        const it = G.Items.get(best.id);
        G.State.addItem(best.id, best.count);
        this.gained[best.id] = (this.gained[best.id] || 0) + best.count;
        G.Audio.play(it && it.kind === 'currency' ? 'coin' : 'pickup');
        this.hud.logPickup(it, best.count);
        this.floats.push({ x: best.x, y: best.y - 18, t: 0.7, text: '拾取 ' + (it ? it.name : ''), color: '#ffd479', size: 11 });
        return;
      }
      this.toast('附近没有可交互的物体', 'warn');
    },

    /* 兼容旧调用：Q 现在走称号副技能，若未解锁则回落到武器战技 */
    castSkill: function () {
      const p = this.player;
      if (p.skillQ) return this.useSlot('q');
      const w = this.tot.weapon;
      if (!w || !w.skill) { this.toast('当前武器没有战技', 'warn'); return; }
      const def = SKILLS[w.skill.id];
      if (!def) { this.toast('战技未实现', 'warn'); return; }
      if ((p.cds[w.skill.id] || 0) > 0) { this.toast(def.name + ' 冷却中', 'warn'); return; }
      if (p.stamina < def.cost) { this.toast('体力不足（需要 ' + def.cost + '）', 'warn'); return; }
      p.stamina -= def.cost;
      p.cds[w.skill.id] = def.cd;
      def.cast(w, p);
      this.toast('战技：' + def.name, 'ok');
      G.Audio.play('cast');
      this.syncHud();
    },

    /* 持续效果与增益：闪避残影、领域、仆从、称号被动 */
    tickSkills: function (dt) {
      const p = this.player, self = this;

      /* 领域：减速 / 持续伤害 */
      if (this.fields && this.fields.length) {
        this.fields.forEach(function (f) {
          f.t += dt;
          if (f.slow) {
            self.enemies.forEach(function (e) {
              if (!e.dead && Math.abs(e.x - f.x) < f.r) e.slowT = Math.max(e.slowT || 0, 0.4);
            });
          }
          if (f.dmg) {
            f.acc += dt;
            if (f.acc >= f.tick) {
              f.acc = 0;
              self.enemies.forEach(function (e) {
                if (!e.dead && Math.abs(e.x - f.x) < f.r) {
                  self.hurtEnemy(e, Math.round(p.atk * f.dmg), false, e.x - f.x);
                }
              });
            }
          }
        });
        this.fields = this.fields.filter(function (f) { return f.t < f.dur; });
      }

      /* 仆从 / 镜像：自动攻击附近敌人 */
      if (this.allies && this.allies.length) {
        this.allies.forEach(function (a) {
          a.t -= dt;
          a.cd -= dt;
          a.x += (p.x - p.face * 50 - a.x) * Math.min(1, dt * 1.6);
          a.y += (p.y - a.y) * Math.min(1, dt * 3);
          if (a.cd <= 0) {
            let tgt = null, bd = 420;
            self.enemies.forEach(function (e) {
              if (e.dead) return;
              const d = U.dist(e.x, e.y, a.x, a.y);
              if (d < bd) { bd = d; tgt = e; }
            });
            if (tgt) {
              a.cd = 0.9;
              a.face = tgt.x < a.x ? -1 : 1;
              self.hurtEnemy(tgt, Math.max(1, Math.round(p.atk * 0.45)), false, tgt.x - a.x);
              self.fx.push({ kind: 'hit', x: tgt.x, y: tgt.y - 18, t: 0.16, max: 0.16, color: '#c9a0ff' });
            }
          }
        });
        this.allies = this.allies.filter(function (a) { return a.t > 0; });
      }

      /* 玩家增益计时 */
      if (p.ampT > 0) p.ampT -= dt;
      if (p.phaseT > 0) p.phaseT -= dt;
      if (p.interactT > 0) p.interactT -= dt;
      if (p.revealT > 0) p.revealT -= dt;
      if (p.stealthT > 0) p.stealthT -= dt;

      /* 称号被动：灵魂感知（自动吸附） */
      if (p.passive && p.passive.k === 'magnet' && this.loot && this.loot.length) {
        this.loot.forEach(function (l) {
          const d = U.dist(l.x, l.y, p.x, p.y - 20);
          if (d < 150) {
            l.x += (p.x - l.x) * Math.min(1, dt * 3);
            l.y += (p.y - 20 - l.y) * Math.min(1, dt * 3);
          }
        });
      }
      /* 称号被动：神性威压（敌人靠近减速） */
      if (p.passive && (p.passive.k === 'awe' || p.passive.k === 'suppress')) {
        const r = p.passive.k === 'awe' ? 120 : 150;
        this.enemies.forEach(function (e) {
          if (e.dead || e.boss) return;
          if (U.dist(e.x, e.y, p.x, p.y) < r) {
            e.slowT = Math.max(e.slowT || 0, 0.3);
            if (p.passive.k === 'suppress') e.atkDownT = 0.3;
          }
        });
      }

      /* 突刺 / 冲刺斩等武器的延迟斩击 */
      if (p.pendingSlash > 0 && p.dashT <= 0) {
        p.pendingSlash = 0;
        this.arcSlash(p.x, p.y - 22, p.face, p.reach * 1.2, Math.round(p.atk * 1.5), '#4fd7ff');
      }
      if (p.spinT > 0) {
        const ang = (0.6 - p.spinT) * 18;
        this.enemies.forEach(function (e) {
          const k2 = e.__id;
          if (p.spinHit[k2]) return;
          if (U.dist(e.x, e.y - e.h / 2, p.x, p.y - 20) < p.reach * 1.35 + e.w / 2) {
            p.spinHit[k2] = 1;
            self.hurtEnemy(e, Math.round(p.atk * 1.2), Math.random() < p.crit, e.x - p.x);
          }
        });
      }
      if (p.quakeT > 0.4 && !p.quakeDone) {
        p.quakeDone = true;
        this.shockwave(p.x + p.face * 60, WORLD_H - 60, 150, Math.round(p.atk * 1.8), true);
        this.shake = 12;
      }
      if (p.quakeT <= 0) p.quakeDone = false;

      if (p.pierceT > 0) this.arcSlash(p.x + p.face * 40, p.y - 22, p.face, p.reach * 1.1, Math.round(p.atk * 1.4), '#4fd7ff', 0.16);
      if (p.rainT > 0) {
        p.rainN += dt;
        if (p.rainN > 0.06) {
          p.rainN = 0;
          const tx = U.clamp(this.mouse.x / this.scale + U.rnd(-130, 130), 30, 1570);
          this.projs.push({ side: 'p', x: tx, y: -30, vx: 0, vy: 620, r: 5, dmg: Math.round(p.atk * 0.8), kind: 'arrow', pierce: 1, life: 2, hit: {}, color: '#e8eef8' });
        }
      }
      if (p.barrageT > 0) {
        p.barrageN += dt;
        if (p.barrageN > 0.038) {
          p.barrageN = 0;
          const ang = p.aim + U.rnd(-0.16, 0.16);
          this.projs.push({ side: 'p', x: p.x + Math.cos(ang) * 16, y: p.y - 22, vx: Math.cos(ang) * 860, vy: Math.sin(ang) * 860, r: 4, dmg: Math.round(p.atk * 0.7), kind: 'bolt', pierce: 1, life: 1.2, hit: {}, color: '#4fd7ff' });
        }
      }
      if (p.rushT > 0) {
        p.rushN += dt;
        if (p.rushN > 0.16) {
          p.rushN = 0;
          this.arcSlash(p.x + p.face * 26, p.y - 20, p.face, 54, Math.round(p.atk * 0.9), '#ff8a3c', 0.18);
        }
      }
      if (p.reapT > 0 && !p.reapDone) {
        p.reapDone = true;
        const self2 = this;
        let healed = 0;
        this.enemies.forEach(function (e) {
          if (e.dead) return;
          if (U.dist(e.x, e.y - e.h / 2, p.x, p.y - 20) < 170) {
            self2.hurtEnemy(e, Math.round(p.atk * 1.5), Math.random() < p.crit, e.x - p.x);
            healed++;
          }
        });
        if (healed) this.healPlayer(Math.round(p.maxHp * 0.04 * healed));
        this.arcSlash(p.x, p.y - 22, p.face, 170, 0, '#c07cff', 0.4);
      }
      if (p.reapT <= 0) p.reapDone = false;

      if (p.domainT > 0) {
        p.domainTick = (p.domainTick || 0) + dt;
        if (p.domainTick > 0.5) {
          p.domainTick = 0;
          const self3 = this;
          this.enemies.forEach(function (e) {
            if (!e.dead && Math.abs(e.x - p.domainX) < 150) self3.hurtEnemy(e, Math.round(p.atk * 0.35), false, e.x - p.x);
          });
        }
      }
      if (p.dawnT > 0 && !p.dawnDone) {
        p.dawnDone = true;
        const self4 = this;
        for (let i = 0; i < 3; i++) {
          (function (i) {
            setTimeout(function () {
              if (!self4.running) return;
              self4.projs.push({
                side: 'p', x: p.x + p.face * 24, y: p.y - 26 - i * 14,
                vx: p.face * 780, vy: 0, r: 24, dmg: Math.round(p.atk * 1.2), kind: 'wave',
                pierce: 99, life: 1.4, hit: {}, color: '#ffd88a', aoe: 60
              });
            }, i * 90);
          })(i);
        }
        this.shake = 14;
      }
      if (p.dawnT <= 0) p.dawnDone = false;
    },

    doChainLightning: function () {
      const p = this.player;
      const sorted = this.enemies.filter(function (e) { return !e.dead; })
        .sort(function (a, b) { return U.dist(a.x, a.y, p.x, p.y) - U.dist(b.x, b.y, p.x, p.y); }).slice(0, 3);
      const self = this;
      sorted.forEach(function (e, i) {
        setTimeout(function () {
          if (!self.running) return;
          self.hurtEnemy(e, Math.round(p.atk * 1.1), Math.random() < p.crit, e.x - p.x);
          self.fx.push({ kind: 'bolt', x: e.x, y: e.y - e.h / 2, t: 0.28, max: 0.28, color: '#4fd7ff' });
        }, i * 70);
      });
    },
    doNova: function () {
      const p = this.player, self = this;
      this.shockwave(p.x, p.y - 20, 190, Math.round(p.atk * 1.6), true);
      this.fx.push({ kind: 'nova', x: p.x, y: p.y - 20, t: 0.5, max: 0.5, color: '#a06cff' });
      this.shake = 10;
    },
    doGiantShot: function () {
      const p = this.player;
      const ang = p.aim;
      this.projs.push({
        side: 'p', x: p.x + Math.cos(ang) * 24, y: p.y - 22, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900,
        r: 14, dmg: Math.round(p.atk * 2.4), kind: 'giant', pierce: 99, life: 1.6, hit: {}, color: '#ffd479', knock: 320
      });
      this.shake = 9;
    },

    /* 冲击波：对半径内敌人造成伤害 */
    shockwave: function (x, y, radius, dmg, launch) {
      const self = this;
      this.fx.push({ kind: 'shock', x: x, y: y, t: 0.36, max: 0.36, r: radius, color: '#ffb066' });
      this.enemies.forEach(function (e) {
        if (e.dead) return;
        if (U.dist(e.x, e.y - e.h / 2, x, y) < radius + e.w / 2) {
          self.hurtEnemy(e, dmg, false, e.x - x);
          if (launch) { e.vy = -280; e.vx += Math.sign(e.x - x) * 120; }
        }
      });
    },

    /* 弧形斩击特效 */
    arcSlash: function (x, y, face, reach, dmg, color, dur, step) {
      this.fx.push({ kind: 'slash', x: x, y: y, t: dur || 0.22, max: dur || 0.22, reach: reach, face: face, color: color || '#ffd479', step: step || 1 });
      if (dmg > 0) {
        const self = this;
        this.enemies.forEach(function (e) {
          if (e.dead) return;
          const dx = e.x - x;
          if (dx * face < -10) return;
          if (U.dist(e.x, e.y - e.h / 2, x, y) < reach + e.w / 2) self.hurtEnemy(e, dmg, Math.random() < self.player.crit, dx);
        });
      }
    },

    /* ---------------- 伤害数值 ---------------- */
    hurtEnemy: function (e, dmg, crit, dx, opts) {
      if (e.dead) return;
      const p = this.player;
      const o = opts || {};
      /* 法则印记 / 易伤：放大后续伤害（第 8 档起印记可叠加，最高 +60%） */
      let final = dmg;
      if (e.markT > 0) {
        const amp = p.markAmpStack ? Math.min(0.6, 0.2 * (e.markStack || 1)) : 0.3;
        final = Math.round(final * (1 + amp));
      }
      if (p.ampT > 0) final = Math.round(final * 1.25);
      /* 灵魂伤害：对亡灵类敌人 +30% */
      const soulHit = o.soul || (p.skillLmb && p.skillLmb.soul);
      if (soulHit && e.undead) {
        final = Math.round(final * 1.3);
        this.fx.push({ kind: 'spark', x: e.x, y: e.y - e.h / 2, t: 0.3, max: 0.3, color: '#8fd8ff', r: 2 });
      }
      e.hp -= final;
      e.hitT = 0.12;
      this.dmgDone += final;
      this.floats.push({ x: e.x, y: e.y - e.h - 6, t: 0.85, text: (crit ? '✦' : '') + final, color: crit ? '#ffd479' : (soulHit ? '#8fd8ff' : '#ffffff'), size: crit ? 17 : 13 });
      this.fx.push({ kind: 'hit', x: e.x, y: e.y - e.h / 2, t: 0.16, max: 0.16, color: crit ? '#ffd479' : '#ffb066' });
      G.Audio.play(crit ? 'crit' : 'hit');
      if (dx) e.vx += Math.sign(dx) * (e.boss ? 20 : 90);
      /* 斩杀：低血量直接处决 */
      const skill = p.skillLmb;
      const exec = (p.skillRmb && p.skillRmb.execute) || (skill && skill.execute) || 0;
      if (exec && !e.boss && e.hp > 0 && e.hp < e.maxHp * exec) {
        this.floats.push({ x: e.x, y: e.y - e.h - 22, t: 0.9, text: '处决', color: '#ff5b6b', size: 12 });
        e.hp = 0;
      }
      /* 武器附加效果 */
      const w = this.tot.weapon;
      if (w && w.voidHit && Math.random() < 0.3) this.shockwave(e.x, e.y - e.h / 2, 52, Math.round(final * 0.4), false);
      if (e.hp <= 0) this.killEnemy(e);
    },

    killEnemy: function (e) {
      if (e.dead) return;
      e.dead = true;
      this.kills++;
      if (e.elite && !e.boss) this.eliteKills++;
      if (e.boss) this.bossKills++;
      G.State.trackKill(e.id, e.elite, e.boss, this.player.wtype);
      G.Audio.play('die');
      this.corpses.push({ x: e.x, y: e.y, t: 8, color: e.color, size: e.size });
      this.fx.push({ kind: 'burst', x: e.x, y: e.y - e.h / 2, t: 0.4, max: 0.4, color: e.color });
      /* 掉落 */
      const table = e.boss ? 'boss' : (e.elite ? 'elite' : 'normal');
      const rolls = e.boss ? 5 : (e.elite ? 2 : 1);
      const luck = G.State.totals().luck;
      for (let i = 0; i < rolls; i++) {
        const d = G.Items.rollDrop(table, luck);
        this.loot.push({ x: e.x + U.rnd(-24, 24), y: e.y - 14, vy: -180, vx: U.rnd(-60, 60), id: d.id, count: d.count, t: 0, y0: e.y - 14, ground: false });
      }
      /* 少量经验与余烬直接入账 */
      const ember = Math.round((e.boss ? 260 : e.elite ? 60 : 14) * (1 + this.diff * 0.3));
      this.gained.i_ember = (this.gained.i_ember || 0) + ember;
      if (e.affix && e.affix.id === 'af_void') this.shockwave(e.x, e.y - e.h / 2, 90, 18, false);
      /* 击杀回血（镰刀） */
      const w = this.tot.weapon;
      if (w && w.passive && w.passive.indexOf('击杀敌人回复') === 0) this.healPlayer(Math.round(this.player.maxHp * 0.08));
    },

    damagePlayer: function (dmg, dir, src) {
      const p = this.player;
      if (p.invuln > 0 || p.dead) return;
      /* 护盾 / 结界：吸收一次伤害 */
      if (p.barrierT > 0) {
        p.barrierT = 0;
        p.invuln = 0.5;
        this.floats.push({ x: p.x, y: p.y - 54, t: 0.8, text: '格挡', color: '#9eeaff', size: 13 });
        this.fx.push({ kind: 'nova', x: p.x, y: p.y - 24, t: 0.4, max: 0.4, color: '#9eeaff' });
        G.Audio.play('crit');
        return;
      }
      let real = Math.max(1, Math.round(dmg * (1 - p.dr)));
      if (p.passive && p.passive.k === 'trueDmg') real = Math.max(1, Math.round(real * 0.94));
      /* 「圣誓守护」：致命伤害保留 1 点生命并给盾 */
      if (p.passive && p.passive.k === 'lastStand' && !p.lastStandUsed && real >= p.hp) {
        p.lastStandUsed = true;
        p.hp = 1;
        p.barrierT = 3;
        p.invuln = 1.2;
        this.toast('圣誓守护：你被留在了 1 点生命', 'ok');
        G.Audio.play('levelup');
        this.syncHud();
        return;
      }
      p.hp -= real;
      this.dmgTaken += real;
      p.invuln = 0.62;
      /* 受击硬直：轻击 0.2 / 重击 0.5 秒 */
      const heavyHit = real > 0 && real >= p.maxHp * 0.12;
      p.hurtT = heavyHit ? 0.5 : 0.2;
      p.flash = 0.16;
      p.vx = dir * 200;
      if (dir) p.vy = -180;
      this.hitFlash = 0.9;
      this.shake = 9;
      G.Audio.play('hurt');
      this.floats.push({ x: p.x, y: p.y - 54, t: 0.85, text: '-' + real, color: '#ff6b6b', size: 14 });
      /* 飘出 3 个红色伤害像素 */
      for (let i = 0; i < 3; i++) {
        this.fx.push({ kind: 'dust', x: p.x + U.rnd(-8, 8), y: p.y - 30 - i * 4, t: 0.5, max: 0.5, color: '#ff5b6b' });
      }
      this.syncHud();
      if (p.hp <= 0) this.onPlayerDeath(src);
    },

    healPlayer: function (n) {
      const p = this.player;
      if (n <= 0) return;
      p.hp = Math.min(p.maxHp, p.hp + n);
      this.floats.push({ x: p.x, y: p.y - 56, t: 0.9, text: '+' + n, color: '#5fe08a', size: 13 });
      this.syncHud();
    },

    toast: function (msg, kind) {
      if (this.hud && this.hud.toast) this.hud.toast(msg, kind);
    },

    onPlayerDeath: function (src) {
      const p = this.player;
      /* 称号被动「灵魂不灭」：每局首次死亡原地复活并恢复 50% 生命 */
      if (!p.revivePassiveUsed && p.passive && p.passive.k === 'revive') {
        p.revivePassiveUsed = true;
        p.hp = Math.round(p.maxHp * 0.5);
        p.invuln = 2.6;
        p.dead = false;
        this.fx.push({ kind: 'nova', x: p.x, y: p.y - 20, t: 0.8, max: 0.8, color: '#8fd8ff' });
        this.fx.push({ kind: 'burst', x: p.x, y: p.y - 26, t: 0.6, max: 0.6, color: '#dfe8f5' });
        this.toast('灵魂不灭：你从灰烬里被拽了回来', 'ok');
        G.Audio.play('levelup');
        this.syncHud();
        return;
      }
      /* 不灭灰烬：一次复活 */
      if (!p.reviveUsed && G.State.countItem('i_revive_dust') > 0) {
        G.State.removeItem('i_revive_dust', 1);
        p.reviveUsed = true;
        p.hp = Math.round(p.maxHp * 0.5);
        p.invuln = 2.4;
        p.dead = false;
        this.fx.push({ kind: 'nova', x: p.x, y: p.y - 20, t: 0.7, max: 0.7, color: '#ff8a3c' });
        this.toast('不灭灰烬燃起 —— 你重新站了起来！', 'ok');
        G.Audio.play('levelup');
        return;
      }
      p.dead = true;
      this.over = true;
      this.result = 'dead';
      this.showResult(false);
    },

    /* ---------------- 敌人 ---------------- */
    updEnemies: function (dt) {
      const p = this.player, self = this;
      this.enemies.forEach(function (e, idx) {
        if (e.__id == null) e.__id = 'e' + idx + '_' + Math.random().toString(36).slice(2, 6);
        if (e.dead) return;
        if (e.hitT > 0) e.hitT -= dt;
        if (e.affix && e.affix.id === 'af_burning' && Math.random() < dt * 1.2) {
          self.fx.push({ kind: 'hit', x: e.x + U.rnd(-8, 8), y: e.y - e.h * 0.6, t: 0.3, max: 0.3, color: '#ff8a3c' });
        }
        /* —— 称号技能造成的状态 —— */
        ['stunT', 'rootT', 'freezeT', 'slowT', 'fearT', 'markT', 'defDownT', 'atkDownT'].forEach(function (key) {
          if (e[key] > 0) e[key] = Math.max(0, e[key] - dt);
        });
        const controlled = (e.stunT > 0 || e.rootT > 0 || e.freezeT > 0);
        const slowMul = e.freezeT > 0 ? 0 : (e.slowT > 0 ? 0.5 : 1);
        if (controlled || e.slowT > 0) {
          e.vx *= (e.freezeT > 0 ? 0 : 0.86);
          if (e.freezeT > 0) e.vy = 0;
        }
        /* 受控状态的可视标记：冻结（冰晶方框）/ 定身（法则纹路）/ 眩晕（头顶星点） */
        if (e.rootT > 0 && Math.random() < dt * 3) {
          self.fx.push({ kind: 'dust', x: e.x + U.rnd(-e.w / 2, e.w / 2), y: e.y - 2, t: 0.5, max: 0.5, color: '#a06cff', r: 2 });
        }
        if (e.stunT > 0 && Math.random() < dt * 5) {
          self.fx.push({ kind: 'spark', x: e.x + U.rnd(-6, 6), y: e.y - e.h - 8, t: 0.35, max: 0.35, color: '#ffd479', r: 1.5, vy: -30 });
        }
        if (e.fearT > 0) {
          /* 被震慑：向后逃离玩家 */
          e.vx += (-Math.sign(dx) * e.spd * 0.8 - e.vx) * Math.min(1, dt * 3);
        }
        /* 冻结：冰晶像素 */
        if (e.freezeT > 0 && Math.random() < dt * 4) {
          self.fx.push({ kind: 'spark', x: e.x + U.rnd(-8, 8), y: e.y - e.h * U.rnd(0.3, 0.9), t: 0.4, max: 0.4, color: '#9eeaff', r: 1.5 });
        }
        /* 法则突进等留下的持续伤害领域 */
        if (e.dotT > 0) {
          e.dotT -= dt;
          e.dotAcc = (e.dotAcc || 0) + dt;
          if (e.dotAcc > 0.5) {
            e.dotAcc = 0;
            self.hurtEnemy(e, e.dotDmg || 3, false, 0);
          }
        }
        const dx = p.x - e.x, dy = (p.y - 20) - (e.y - e.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        e.face = dx < 0 ? -1 : 1;
        e.ph += dt * 3;
        if (e.cd > 0) e.cd -= dt;
        if (controlled) {
          /* 眩晕 / 定身 / 冻结期间不执行 AI，只受重力 */
          e.vy = Math.min(MAXFALL, e.vy + GRAV * dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          e.x = U.clamp(e.x, 20, 1580);
          self.collide(e);
          return;
        }
        e.spdBase = e.spdBase || e.spd;
        e.spd = e.spdBase * slowMul * (e.atkDownT > 0 ? 1 : 1);
        e.atkNow = e.atk * (e.atkDownT > 0 ? 0.8 : 1) * (e.defDownT > 0 ? 1 : 1);

        /* 重力与移动 */
        e.vy = Math.min(MAXFALL, e.vy + GRAV * dt);
        if (e.etype === 'flyer') e.vy *= 0.86;

        switch (e.etype) {
          case 'charger':
            if (e.state === 'idle') {
              e.vx += (Math.sign(dx) * e.spd * 0.5 - e.vx) * Math.min(1, dt * 3);
              if (dist < 300 && e.cd <= 0) { e.state = 'wind'; e.st = 0.55; }
            } else if (e.state === 'wind') {
              e.vx *= 0.9;
              e.st -= dt;
              if (e.st <= 0) { e.state = 'charge'; e.st = 0.5; e.vx = Math.sign(dx) * e.spd * 3.2; G.Audio.play('dash'); }
            } else if (e.state === 'charge') {
              e.st -= dt;
              if (e.st <= 0) { e.state = 'idle'; e.cd = 1.4; }
            }
            break;
          case 'ranged':
            if (e.spd > 1) e.vx += (Math.sign(dx) * (dist < 260 ? -1 : 1) * e.spd * 0.6 - e.vx) * Math.min(1, dt * 2.5);
            else e.vx *= 0.9;
            if (e.cd <= 0 && dist < 620) {
              e.cd = Math.max(0.9, 2.2 - self.diff * 0.12);
              const ang = Math.atan2(dy, dx);
              self.projs.push({
                side: 'e', x: e.x, y: e.y - e.h / 2, vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360,
                r: 7, dmg: e.atk, kind: 'bolt', pierce: 1, life: 2.4, hit: {}, color: '#ff7a4d'
              });
              G.Audio.play('shoot');
            }
            break;
          case 'flyer':
            e.vx += (Math.sign(dx) * e.spd * (0.6 + 0.4 * Math.sin(e.ph)) - e.vx) * Math.min(1, dt * 2);
            e.y += Math.sin(e.ph * 1.4) * 22 * dt;
            if (dist < 90 && e.cd <= 0) { e.cd = 1.6; e.vy = 220; }
            break;
          case 'boss':
            self.bossAI(e, dt, dx, dy, dist);
            break;
          default: /* melee */
            e.vx += (Math.sign(dx) * e.spd - e.vx) * Math.min(1, dt * 2.2);
            if (dist < e.w / 2 + 34 && e.cd <= 0) {
              e.cd = 1.1;
              e.attackAnim = 0.3;
              G.Audio.play('swing');
              setTimeout(function () {
                if (!self.running || e.dead) return;
                if (U.dist(e.x, e.y - e.h / 2, p.x, p.y - 20) < e.w / 2 + 44) self.damagePlayer(e.atk, Math.sign(p.x - e.x));
                if (e.def && e.def.id === 'e_slag_brute') self.shockwave(e.x, WORLD_H - 60, 90, Math.round(e.atk * 0.5), false);
              }, 150);
            }
        }
        if (e.attackAnim > 0) e.attackAnim -= dt;

        /* 接触伤害（近身持续伤害，带保护间隔） */
        if (e.etype !== 'ranged' && dist < e.w * 0.55 && p.invuln <= 0) {
          self.damagePlayer(Math.round(e.atk * 0.6), Math.sign(p.x - e.x));
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.x = U.clamp(e.x, 20, 1580);
        self.collide(e);
        if (e.onGround) e.vx *= 0.94;
      });
    },

    bossAI: function (e, dt, dx, dy, dist) {
      const self = this, p = this.player;
      e.st -= dt;
      /* 阶段二：血量低于 50% 加强 */
      const phase2 = e.hp < e.maxHp * 0.5;
      if (e.state === 'idle') {
        e.vx += (Math.sign(dx) * e.spd * (phase2 ? 1.5 : 1) - e.vx) * Math.min(1, dt * 2);
        if (e.cd <= 0) {
          e.cd = phase2 ? 1.3 : 2;
          e.state = U.pick(['slam', 'cast', 'summon']);
          e.st = 0.6;
        }
      } else if (e.state === 'slam') {
        e.vx *= 0.9;
        if (e.st <= 0) {
          self.shockwave(e.x + e.face * 70, WORLD_H - 60, 160, Math.round(e.atk * 0.8), true);
          self.shake = 14;
          G.Audio.play('crit');
          e.state = 'idle'; e.cd = 1.6;
        }
      } else if (e.state === 'cast') {
        e.vx *= 0.92;
        if (e.st <= 0) {
          for (let i = 0; i < (phase2 ? 7 : 4); i++) {
            const ang = Math.atan2(dy, dx) + U.rnd(-0.5, 0.5);
            self.projs.push({
              side: 'e', x: e.x, y: e.y - e.h / 2, vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330,
              r: 9, dmg: Math.round(e.atk * 0.7), kind: 'orb', pierce: 1, life: 2.6, hit: {}, color: '#c07cff'
            });
          }
          G.Audio.play('cast');
          e.state = 'idle'; e.cd = 1.8;
        }
      } else if (e.state === 'summon') {
        e.vx *= 0.9;
        if (e.st <= 0) {
          for (let i = 0; i < 3; i++) {
            const def = G.Enemies.get(U.pick(G.Enemies.poolFor(this.diff)));
            const ne = {
              kind: 'enemy', def: def, id: def.id, name: def.name,
              x: e.x + U.rnd(-120, 120), y: e.y - 40, w: def.size * 2, h: def.size * 2.2,
              vx: 0, vy: 0, onGround: false, face: -1,
              hp: Math.round(def.hp * (1 + this.diff * 0.3)), maxHp: 0, atk: def.atk,
              spd: def.spd, size: def.size, etype: def.kind, color: def.color,
              behavior: def.behavior, weak: def.weak, state: 'idle', st: 1, cd: 1.4, hitT: 0, ph: 0,
              dead: false, elite: false, dropTable: def.drops, __id: 's' + Math.random().toString(36).slice(2, 6)
            };
            ne.maxHp = ne.hp;
            this.enemies.push(ne);
          }
          G.Audio.play('wave');
          e.state = 'idle'; e.cd = 3.4;
        }
      }
      if (e.attackAnim > 0) e.attackAnim -= dt;
    },

    /* ---------------- 投射物 ---------------- */
    updProjectiles: function (dt) {
      const self = this, p = this.player;
      this.projs.forEach(function (pr) {
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.kind !== 'wave') pr.vy += GRAV * 0.28 * dt;
        /* 地面碰撞 */
        self.plats.forEach(function (pl) {
          if (pr.x > pl.x && pr.x < pl.x + pl.w && pr.y > pl.y && pr.y < pl.y + pl.h + 6) {
            if (pr.vy > 0) { pr.y = pl.y; pr.vy = 0; pr.vx *= 0.2; }
          }
        });
        if (pr.side === 'p') {
          self.enemies.forEach(function (e) {
            if (e.dead || pr.hit[e.__id] || pr.life <= 0) return;
            if (U.dist(pr.x, pr.y, e.x, e.y - e.h / 2) < pr.r + e.w / 2) {
              pr.hit[e.__id] = 1;
              self.hurtEnemy(e, pr.dmg, pr.crit, pr.vx);
              if (pr.knock) { e.vx += Math.sign(pr.vx) * pr.knock; e.vy = -180; }
              if (pr.aoe) self.shockwave(pr.x, pr.y, pr.aoe, Math.round(pr.dmg * 0.5), false);
              pr.pierce--;
              if (pr.pierce <= 0) pr.life = 0;
            }
          });
        } else {
          if (U.dist(pr.x, pr.y, p.x, p.y - 22) < pr.r + 14) {
            self.damagePlayer(pr.dmg, Math.sign(pr.vx));
            pr.life = 0;
            self.fx.push({ kind: 'hit', x: pr.x, y: pr.y, t: 0.2, max: 0.2, color: '#ff6b6b' });
          }
        }
        if (pr.x < 0 || pr.x > 1600 || pr.y > WORLD_H + 40) pr.life = 0;
      });
      this.projs = this.projs.filter(function (pr) { return pr.life > 0; });
    },

    /* ---------------- 掉落物 ---------------- */
    updPickups: function (dt) {
      const p = this.player, self = this;
      this.loot.forEach(function (l) {
        l.t += dt;
        l.vy += GRAV * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.vx *= 0.97;
        /* 落地 */
        let landed = false;
        self.plats.forEach(function (pl) {
          if (l.x > pl.x && l.x < pl.x + pl.w && l.y > pl.y - 4 && l.y < pl.y + 24 && l.vy > 0) {
            l.y = pl.y; l.vy = 0; landed = true;
          }
        });
        if (landed) l.ground = true;
        /* 吸附 */
        const d = U.dist(l.x, l.y, p.x, p.y - 20);
        if (d < 90) {
          l.x += (p.x - l.x) * Math.min(1, dt * 6);
          l.y += (p.y - 20 - l.y) * Math.min(1, dt * 6);
        }
        if (d < 26) {
          l.picked = true;
          const it = G.Items.get(l.id);
          G.State.addItem(l.id, l.count);
          self.gained[l.id] = (self.gained[l.id] || 0) + l.count;
          G.Audio.play(it && it.kind === 'currency' ? 'coin' : 'pickup');
          self.hud.logPickup(it, l.count);
        }
      });
      this.loot = this.loot.filter(function (l) { return !l.picked && l.y < WORLD_H + 120; });
    },

    updFx: function (dt) {
      this.fx.forEach(function (f) {
        f.t -= dt;
        if (f.vx != null) { f.x += f.vx * dt; f.vx *= (1 - Math.min(0.9, dt * 2.4)); }
        if (f.vy != null) { f.y += f.vy * dt; f.vy += 260 * dt; }
      });
      this.fx = this.fx.filter(function (f) { return f.t > 0; });
      this.floats.forEach(function (f) { f.t -= dt; f.y -= dt * 34; });
      this.floats = this.floats.filter(function (f) { return f.t > 0; });
      this.corpses.forEach(function (c) { c.t -= dt; });
      this.corpses = this.corpses.filter(function (c) { return c.t > 0; });
    },

    spawnDust: function (x, y, n) {
      for (let i = 0; i < n; i++) {
        this.fx.push({ kind: 'dust', x: x + U.rnd(-8, 8), y: y, t: 0.4, max: 0.4, color: '#9fb0c4', vx: U.rnd(-60, 60), vy: U.rnd(-90, -20) });
      }
    },
    /** 地面尘土条：奔跑 / 滑铲 / 落地时的横向拖尘 */
    dustTrail: function (x, y, dir, len, n) {
      for (let i = 0; i < (n || 5); i++) {
        this.fx.push({
          kind: 'dust', x: x - dir * U.rnd(0, len), y: y - U.rnd(0, 6),
          t: 0.45, max: 0.45, color: '#a8b6c8',
          vx: -dir * U.rnd(20, 90), vy: U.rnd(-40, -8), r: U.rnd(2, 4)
        });
      }
    },
    /** 命中火花：斜向斩命中时的橙白粒子 */
    sparks: function (x, y, n, color) {
      for (let i = 0; i < (n || 6); i++) {
        this.fx.push({
          kind: 'spark', x: x, y: y, t: 0.28, max: 0.28,
          color: color || '#ffd479',
          vx: U.rnd(-220, 220), vy: U.rnd(-200, 60), r: U.rnd(1.5, 3)
        });
      }
    },
    muzzle: function (x, y, color) {
      this.fx.push({ kind: 'hit', x: x, y: y, t: 0.14, max: 0.14, color: color });
    },

    /* ---------------- 波次 / 通关 ---------------- */
    updWaveLogic: function (dt) {
      const alive = this.enemies.filter(function (e) { return !e.dead; }).length;
      if (alive === 0) {
        if (this.wave < this.waves) {
          this.spawnT = (this.spawnT || 0) + dt;
          if (this.spawnT > 1.1) {
            this.spawnT = 0;
            this.spawnWave();
            this.setWaveNote('第 ' + this.wave + ' 波', '敌人增援中');
            G.Audio.play('wave');
          }
        } else if (!this.portal && !this.over) {
          /* 房间清空 -> 开门 */
          const last = this.room >= this.totalRooms - 1;
          this.portal = { x: 800, y: WORLD_H - 120, r: 34, last: last, t: 0 };
          this.setWaveNote(last ? '✔ 层数通关' : '✔ 房间清空', last ? '进入传送门返回营地结算' : '穿过传送门前往下一个房间');
          G.Audio.play('clear');
          G.State.trackRoom();
          G.State.syncQuestProgress();
          this.syncHud();
        }
      }
      if (this.portal) {
        this.portal.t += dt;
        const p = this.player;
        /* 改为交互式：走到传送门附近按 E 进入（保留贴近自动进入作为兜底） */
        const near = U.dist(p.x, p.y - 20, this.portal.x, this.portal.y) < this.portal.r + 14;
        const viaInteract = this.usePortalNext && U.dist(p.x, p.y - 20, this.portal.x, this.portal.y) < this.portal.r + 46;
        if (near || viaInteract) {
          this.usePortalNext = false;
          if (this.portal.last) {
            this.result = 'win';
            G.State.trackStageClear(this.stage.id);
            G.State.syncQuestProgress();
            this.over = true;
            this.showResult(true);
          } else {
            this.loadRoom(this.room + 1);
          }
        }
      }
    },

    cleanup: function () {
      this.enemies = this.enemies.filter(function (e) { return !e.dead || e.keep; });
    },

    /* ---------------- 道具 ---------------- */
    useItem: function () {
      const p = this.player;
      const idx = this.itemIdx || 0;
      const it = p.items[idx];
      if (!it) { this.toast('没有可用的道具（可在背包中携带）', 'warn'); return; }
      if (it.cd > 0) { this.toast(it.item.name + ' 冷却中', 'warn'); return; }
      if (!G.State.removeItem(it.id, 1)) { this.toast('数量不足', 'err'); return; }
      it.count--;
      it.cd = it.item.cd || 4;
      if (it.item.hp) this.healPlayer(it.item.hp);
      if (it.item.stam) { p.stamina = Math.min(p.maxStamina, p.stamina + it.item.stam); this.floats.push({ x: p.x, y: p.y - 58, t: 0.9, text: '+' + it.item.stam + ' 体力', color: '#4fd7ff', size: 12 }); }
      if (it.item.buff) {
        p.buffs[it.item.buff.id] = it.item.buff.dur;
        if (it.item.buff.atk) p.atk = Math.round(this.tot.atk * (1 + it.item.buff.atk));
        if (it.item.buff.spd) p.frenzyT = Math.max(p.frenzyT, it.item.buff.dur * 0.5);
        if (it.item.buff.dr) p.dr = Math.min(0.75, p.dr + it.item.buff.dr);
      }
      if (it.item.throw) {
        const ang = p.aim;
        this.projs.push({
          side: 'p', x: p.x, y: p.y - 26, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420 - 120,
          r: 9, dmg: it.item.throw.dmg, kind: 'bomb', pierce: 1, life: 1.6, hit: {}, color: '#ff8a3c',
          aoe: it.item.throw.radius, gravity: true
        });
      }
      G.Audio.play('pickup');
      this.toast('使用 ' + it.item.name, 'ok');
      if (it.count <= 0) p.items.splice(idx, 1);
      this.itemIdx = 0;
      this.syncHud();
    },

    /* ---------------- 结算 ---------------- */
    showResult: function (win) {
      const self = this;
      G.State.syncQuestProgress();
      /* 掉落汇总 */
      const summary = {};
      Object.keys(this.gained).forEach(function (k) {
        if (k === 'i_ember') return;
        summary[k] = self.gained[k];
      });
      const stats = {
        win: win,
        stage: this.stage,
        room: this.room + 1,
        totalRooms: this.totalRooms,
        kills: this.kills,
        elites: this.eliteKills,
        bosses: this.bossKills,
        damage: this.dmgDone,
        taken: this.dmgTaken,
        ember: this.gained.i_ember || 0,
        time: Math.round((performance.now() - this.startTime) / 1000),
        drops: summary
      };
      /* 余烬入账 */
      if (summary) { }
      G.State.addCoins(stats.ember);
      G.State.addExp(Math.round(stats.kills * 6 + stats.room * 22 + (win ? 160 : 0) + stats.bosses * 220));
      G.State.state.lastRun = stats;
      G.State.saveNow();
      this.syncHud();
      if (this.hud && this.hud.result) this.hud.result(stats, function (action) {
        if (action === 'retry') { self.restart(); }
      });
    },

    restart: function () {
      const id = this.stage.id;
      this.stop();
      const hud = this.hud;
      hud.cleanup && hud.cleanup();
      hud.build && hud.build();
      this.__init = true;
      this.start(id);
    },

    /* ================= HUD 同步 ================= */
    syncHud: function () {
      if (!this.hud || !this.hud.update) return;
      const p = this.player;
      const w = this.tot.weapon;
      const cdOf = function (slot, name) { return p.cds[slot + ':' + (name || '')] || 0; };
      this.hud.update({
        hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp,
        stamina: Math.round(p.stamina), maxStamina: p.maxStamina,
        stage: this.stage, room: this.room + 1, totalRooms: this.totalRooms,
        wave: this.wave, waves: this.waves,
        enemies: this.enemies.filter(function (e) { return !e.dead; }).length,
        eliteKills: this.eliteKills, kills: this.kills,
        weapon: w, skill: p.skillQ ? { name: p.skillQ.name, cd: p.skillQ.cd, cost: 16 } : null,
        skillCd: cdOf('q', p.skillQ && p.skillQ.name),
        mainSkill: p.skillRmb ? { name: p.skillRmb.name, cd: p.skillRmb.cd, cost: 10 } : null,
        mainCd: cdOf('rmb', p.skillRmb && p.skillRmb.name),
        mainReady: !!(p.cdReady && p.cdReady['rmb:' + (p.skillRmb && p.skillRmb.name)] > 0),
        qReady: !!(p.cdReady && p.cdReady['q:' + (p.skillQ && p.skillQ.name)] > 0),
        dodgeReady: !!(p.cdReady && p.cdReady['shift:' + (p.skillShift && p.skillShift.name)] > 0),
        dodgeSkill: p.skillShift ? { name: p.skillShift.name, cd: p.skillShift.cd, cost: 12 } : null,
        dodgeCd: cdOf('shift', p.skillShift && p.skillShift.name),
        title: this.title, passive: p.passive, comboStep: p.comboStep,
        items: p.items, itemIdx: this.itemIdx || 0,
        buffs: p.buffs, note: this.waveNote,
        boss: this.enemies.find(function (e) { return e.boss && !e.dead; }) || null,
        level: G.State.state.account.lvl,
        exp: G.State.state.account.exp,
        expNeed: G.State.expNeed(G.State.state.account.lvl),
        dmgDone: this.dmgDone, dmgTaken: this.dmgTaken
      });
    },

    setWaveNote: function (title, sub) {
      this.waveNote = { title: title, sub: sub, t: 2.2 };
      this.syncHud();
    },

    syncPause: function () {
      if (this.hud && this.hud.pause) this.hud.pause(this.paused);
    },

    /* ================= 渲染 ================= */
    render: function () {
      const c = this.ctx;
      const W = this.W, H = this.H, s = this.scale;
      c.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
      c.save();
      c.clearRect(0, 0, W, H);

      /* 镜头震动 */
      if (this.shake > 0.2) {
        c.translate(U.rnd(-this.shake, this.shake) * 0.5, U.rnd(-this.shake, this.shake) * 0.5);
      }
      c.scale(s, s);
      /* 世界按比例居中，两侧留黑边由背景填充 */
      const fullW = 1600 * s, fullH = WORLD_H * s;
      const offX = (W - fullW) / 2, offY = (H - fullH) / 2;
      c.translate(offX / s, offY / s);

      this.drawBackground(c, WORLD_H);
      this.drawPlatforms(c);
      this.drawPortal(c);
      this.drawCorpses(c);
      this.drawLoot(c);

      /* 实体 */
      const self = this;
      this.enemies.forEach(function (e) {
        if (e.dead) return;
        c.save();
        if (e.hitT > 0) { c.globalAlpha = 0.65; }
        G.Sprites.enemy(c, {
          x: e.x, y: e.y, s: Math.max(2, e.size / 7) * (self.world || 1), color: e.color, kind: e.boss ? 'boss' : (e.elite ? 'elite' : e.etype),
          affix: e.affix, flip: e.face < 0, size: e.size, alpha: e.alpha
        }, self.time);
        c.restore();
        /* 小血条（非首领） */
        if (!e.boss && e.hp < e.maxHp) {
          const bw = Math.max(30, e.size * 2.4);
          c.fillStyle = 'rgba(0,0,0,.6)';
          c.fillRect(e.x - bw / 2, e.y - e.size * 2.6, bw, 4);
          c.fillStyle = e.elite ? '#c07cff' : '#ff6b6b';
          c.fillRect(e.x - bw / 2, e.y - e.size * 2.6, bw * U.clamp(e.hp / e.maxHp, 0, 1), 4);
        }
      });

      /* 玩家 */
      const p = this.player;
      if (!p.dead) {
        /* 闪避残影 */
        if (p.echoes && p.echoes.length) {
          p.echoes.forEach(function (ec) {
            const a = Math.max(0, ec.life / ec.max) * 0.45;
            c.save();
            c.globalAlpha = a;
            G.Sprites.hero(c, {
              x: ec.x, y: ec.y, s: 3.2 * (self.world || 1),
              ph: 1, moving: false, action: 'run', atkT: null, aim: 0,
              look: G.getLook(G.State.state.account.look),
              equip: G.Sprites.equipFromState(), wtype: p.wtype, reach: p.reach,
              flip: ec.face < 0, alpha: a
            });
            c.restore();
          });
        }
        c.save();
        const stealthA = p.stealthT > 0 ? 0.4 : null;
        if (stealthA) c.globalAlpha = stealthA;
        else if (p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) c.globalAlpha = 0.55;
        /* 落地缓冲：短暂下压 */
        const landSquash = p.landT > 0 ? 1 - p.landT * 1.1 : 1;
        if (landSquash < 1) { c.save(); c.translate(p.x, p.y); c.scale(1, landSquash); c.translate(-p.x, -p.y); }
        G.Sprites.hero(c, {
          x: p.x, y: p.y, s: 3.2 * (this.world || 1),
          ph: p.ph, moving: p.moving,
          action: p.atkT > 0 ? 'attack' : (p.hurtT > 0.1 ? 'hurt' : (p.crouch || p.slideT > 0 ? 'crouch' : 'idle')),
          atkT: p.atkT > 0 ? 1 - p.atkT / p.atkDur : 0,
          aim: p.aim, look: G.getLook(G.State.state.account.look),
          equip: G.Sprites.equipFromState(), wtype: p.wtype, reach: p.reach,
          flip: p.face < 0, comboStep: p.comboStep, airAtk: p.airAtk
        });
        if (landSquash < 1) c.restore();
        c.restore();
        /* 塑能学徒起：剑身缠绕灵魂微光（角色外轮廓淡蓝描边） */
        const lmbSkill = p.skillLmb || G.skillFor('lmb', p.titleIdx, p.ranged);
        if (lmbSkill && (lmbSkill.soul || lmbSkill.vfx === 'soul' || lmbSkill.vfx === 'ghost')) {
          c.save();
          c.globalAlpha = 0.22 + Math.sin(this.time * 7) * 0.08;
          c.fillStyle = '#8fd8ff';
          c.beginPath();
          c.ellipse(p.x, p.y - 32, 16, 34, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
        /* 受击闪白 1 帧 */
        if (p.flash > 0.12) {
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = 0.65;
          G.Sprites.hero(c, {
            x: p.x, y: p.y, s: 3.2 * (this.world || 1), ph: p.ph, moving: false,
            action: 'idle', atkT: null, aim: 0, look: { skin: '#ffffff', hair: '#ffffff', eye: '#ffffff', base: '#ffffff', cloth: '#ffffff', accent: '#ffffff' },
            equip: {}, wtype: p.wtype, reach: p.reach, flip: p.face < 0
          });
          c.restore();
        }
        /* 护盾 / 结界 */
        if (p.barrierT > 0) {
          c.save();
          c.globalAlpha = 0.35 + Math.sin(this.time * 8) * 0.1;
          c.strokeStyle = '#9eeaff';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(p.x, p.y - 26, 26, 40, 0, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }
        /* 处决标记 */
        if (p.markT > 0) {
          c.strokeStyle = '#ff5b6b';
          c.lineWidth = 2;
          this.enemies.forEach(function (e) {
            if (e.dead) return;
            c.beginPath();
            c.moveTo(e.x - 12, e.y - e.h - 16);
            c.lineTo(e.x + 12, e.y - e.h - 16);
            c.lineTo(e.x, e.y - e.h - 6);
            c.closePath();
            c.stroke();
          });
        }
        /* 焚烬领域 */
        if (p.domainT > 0) {
          c.fillStyle = 'rgba(255,120,40,.14)';
          c.fillRect(p.domainX - 150, WORLD_H - 70, 300, 70);
          c.strokeStyle = 'rgba(255,150,60,.5)';
          c.strokeRect(p.domainX - 150, WORLD_H - 70, 300, 70);
        }
      }

      /* 灵魂视野 / 全知之眼：屏幕边缘泛蓝并高亮敌人 */
      if (p && !p.dead && p.revealT > 0) {
        c.save();
        const g = c.createRadialGradient(this.W / 2 / (this.scale || 1), this.H / 2 / (this.scale || 1), 200, this.W / 2 / (this.scale || 1), this.H / 2 / (this.scale || 1), 900);
        g.addColorStop(0, 'rgba(79,215,255,0)');
        g.addColorStop(1, 'rgba(79,215,255,.16)');
        c.fillStyle = g;
        c.fillRect(0, 0, 1600, WORLD_H + 200);
        c.globalAlpha = 0.5;
        c.strokeStyle = '#8fd8ff';
        c.lineWidth = 2;
        this.enemies.forEach(function (e) {
          if (e.dead) return;
          c.strokeRect(e.x - e.w / 2 - 4, e.y - e.h - 4, e.w + 8, e.h + 8);
        });
        c.restore();
      }

      /* 技能领域 / 仆从 */
      if (this.fields && this.fields.length) {
        this.fields.forEach(function (f) {
          const k = 1 - f.t / f.dur;
          c.save();
          c.globalAlpha = 0.18 + 0.12 * k;
          c.fillStyle = f.color;
          c.fillRect(f.x - f.r, WORLD_H - 66, f.r * 2, 66);
          c.globalAlpha = 0.5;
          c.strokeStyle = f.color;
          c.lineWidth = 1.5;
          c.strokeRect(f.x - f.r, WORLD_H - 66, f.r * 2, 66);
          c.restore();
        });
      }
      if (this.allies && this.allies.length) {
        this.allies.forEach(function (a) {
          c.save();
          c.globalAlpha = 0.85;
          G.Sprites.hero(c, {
            x: a.x, y: a.y, s: 2.4 * (self.world || 1), ph: self.time * 3, moving: true,
            action: 'idle', atkT: null, aim: 0,
            look: { skin: '#c9a0ff', hair: '#7a4fd0', eye: '#ffffff', base: '#4a3a7a', cloth: '#3a2a5a', accent: '#a06cff', hairStyle: 'short' },
            equip: {}, wtype: 'blade', reach: 40, flip: a.face < 0
          });
          c.restore();
        });
      }

      this.drawProjectiles(c);
      this.drawFx(c);
      this.drawFloats(c);

      /* 暗角 */
      const vg = c.createRadialGradient(W / 2 / s, H / 2 / s, H / s * 0.32, W / 2 / s, H / 2 / s, H / s * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = vg;
      c.fillRect(0, 0, W / s, H / s);

      c.restore();

      /* 受伤红闪（短促、低强度，避免糊住整个画面） */
      if (this.hitFlash > 0) {
        c.fillStyle = 'rgba(255,40,50,' + (this.hitFlash * 0.16) + ')';
        c.fillRect(0, 0, W, H);
      }
      /* 准星 */
      this.drawCrosshair(c);
    },

    drawBackground: function (c, H) {
      const g = c.createLinearGradient(0, 0, 0, H);
      const palettes = [
        ['#101822', '#0a0f18'],
        ['#12202a', '#080e16'],
        ['#26130c', '#0d0705'],
        ['#160f2a', '#07050f'],
        ['#2a1c0a', '#0c0906']
      ];
      const pal = palettes[Math.min(this.diff - 1, 4)];
      g.addColorStop(0, pal[0]);
      g.addColorStop(1, pal[1]);
      c.fillStyle = g;
      c.fillRect(0, 0, 1600, H);

      /* 远近装饰 */
      c.fillStyle = 'rgba(255,255,255,.03)';
      for (let i = 0; i < 9; i++) {
        const bw = 1600 / 9;
        c.fillRect(i * bw, H - 200 - (i * 53) % 130, bw - 22, 200);
      }
      /* 悬浮余烬 */
      for (let i = 0; i < 26; i++) {
        const x = ((i * 137) % 100) / 100 * 1600;
        const y = H - (((this.time * 30 + i * 47) % (H * 0.9)));
        c.fillStyle = i % 6 === 0 ? 'rgba(79,215,255,.4)' : 'rgba(255,150,70,.34)';
        c.fillRect(x, y, 2, 2);
      }
      /* 层数专属环境 */
      if (this.diff >= 3) {
        c.fillStyle = 'rgba(255,90,30,' + (0.05 + 0.03 * Math.sin(this.time * 2)) + ')';
        c.fillRect(0, H - 90, 1600, 90);
      }
      if (this.diff >= 4) {
        c.strokeStyle = 'rgba(160,108,255,.16)';
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          const y = H * 0.2 + i * 60 + Math.sin(this.time + i) * 12;
          c.moveTo(0, y);
          c.lineTo(1600, y - 24);
          c.stroke();
        }
      }
    },

    drawPlatforms: function (c) {
      const diff = this.diff;
      this.plats.forEach(function (pl) {
        if (pl.ground) {
          c.fillStyle = '#212d3d';
          c.fillRect(pl.x, pl.y, pl.w, pl.h);
          c.fillStyle = '#2f3f55';
          c.fillRect(pl.x, pl.y, pl.w, 6);
          c.fillStyle = 'rgba(255,206,150,.16)';
          c.fillRect(pl.x, pl.y, pl.w, 1.5);
          /* 地面纹理 */
          c.fillStyle = 'rgba(255,255,255,.03)';
          for (let x = pl.x; x < pl.x + pl.w; x += 46) c.fillRect(x, pl.y + 16, 24, 4);
          if (diff >= 3) {
            c.fillStyle = 'rgba(255,110,40,' + (0.12 + 0.06 * Math.sin(Date.now() / 300)) + ')';
            for (let x = pl.x; x < pl.x + pl.w; x += 120) c.fillRect(x + 10, pl.y + 30, 70, 4);
          }
        } else {
          c.fillStyle = '#2c3a4d';
          c.fillRect(pl.x, pl.y, pl.w, pl.h);
          c.fillStyle = '#3f5170';
          c.fillRect(pl.x, pl.y, pl.w, 5);
          c.fillStyle = 'rgba(255,214,160,.14)';
          c.fillRect(pl.x, pl.y, pl.w, 1.5);
          c.fillStyle = 'rgba(0,0,0,.35)';
          c.fillRect(pl.x + 4, pl.y + pl.h, pl.w - 8, 3);
        }
      });
    },

    drawPortal: function (c) {
      const po = this.portal;
      if (!po) return;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      c.save();
      c.translate(po.x, po.y);
      const col = po.last ? '#ffd479' : '#4fd7ff';
      c.fillStyle = col;
      c.globalAlpha = 0.14 + pulse * 0.12;
      c.beginPath(); c.ellipse(0, 0, 44, 62, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(0, 0, 36, 54, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.5;
      c.beginPath(); c.ellipse(0, 0, 28, 44, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(6,10,16,.72)';
      c.beginPath(); c.ellipse(0, 0, 30, 46, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.font = 'bold 13px sans-serif';
      c.textAlign = 'center';
      c.fillText(po.last ? '结算' : '下一房间', 0, 4);
      c.restore();
      /* E 交互提示 */
      const p = this.player;
      if (!p.dead && U.dist(p.x, p.y - 20, po.x, po.y) < po.r + 56) {
        this.drawInteractHint(c, po.x, po.y - 78, 'E');
      }
    },

    /** 交互提示：黄色感叹号 + 按键标记 */
    drawInteractHint: function (c, x, y, key) {
      const bob = Math.sin(this.time * 5) * 3;
      c.save();
      c.translate(x, y + bob);
      c.fillStyle = 'rgba(6,10,16,.8)';
      c.fillRect(-11, -10, 22, 16);
      c.strokeStyle = '#ffd479';
      c.lineWidth = 1.4;
      c.strokeRect(-11, -10, 22, 16);
      c.fillStyle = '#ffd479';
      c.font = 'bold 11px sans-serif';
      c.textAlign = 'center';
      c.fillText(key, 0, 2);
      c.beginPath();
      c.moveTo(-5, 6); c.lineTo(5, 6); c.lineTo(0, 12);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffe9a8';
      c.font = 'bold 13px sans-serif';
      c.fillText('!', 0, -16);
      c.restore();
    },

    drawCorpses: function (c) {
      this.corpses.forEach(function (cp) {
        c.globalAlpha = Math.min(1, cp.t / 2) * 0.45;
        c.fillStyle = cp.color;
        c.fillRect(cp.x - cp.size * 0.6, cp.y - 6, cp.size * 1.2, 6);
        c.globalAlpha = 1;
      });
    },

    drawLoot: function (c) {
      const self = this;
      const p = this.player;
      this.loot.forEach(function (l) {
        const it = G.Items.get(l.id);
        const col = G.Icons.QC[it ? it.rarity : 0];
        const bob = Math.sin(l.t * 4) * 2;
        c.save();
        c.translate(l.x, l.y - 10 + bob);
        c.globalAlpha = 0.25;
        c.fillStyle = col;
        c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = col;
        c.fillRect(-4, -4, 8, 8);
        c.fillStyle = 'rgba(255,255,255,.85)';
        c.fillRect(-2, -2, 4, 4);
        c.restore();
        if (l.count > 1) {
          c.fillStyle = '#fff';
          c.font = '10px sans-serif';
          c.textAlign = 'center';
          c.fillText('×' + l.count, l.x, l.y + 6);
        }
      });
      /* E 交互提示：靠近且「灵魂感知」未生效时提示手动拾取 */
      if (p && !p.dead && p.passive && p.passive.k !== 'magnet') {
        let best = null, bd = 86;
        this.loot.forEach(function (l) {
          const d = U.dist(l.x, l.y, p.x, p.y - 20);
          if (d < bd) { bd = d; best = l; }
        });
        if (best) this.drawInteractHint(c, best.x, best.y - 34, 'E');
      }
    },

    drawProjectiles: function (c) {
      this.projs.forEach(function (pr) {
        c.save();
        c.translate(pr.x, pr.y);
        if (pr.kind === 'arrow') {
          c.rotate(Math.atan2(pr.vy, pr.vx));
          c.fillStyle = pr.color || '#e8eef8';
          c.fillRect(-10, -1.5, 20, 3);
          c.fillStyle = '#ffd479';
          c.fillRect(8, -3, 5, 6);
        } else if (pr.kind === 'wave') {
          c.globalAlpha = 0.7;
          c.fillStyle = pr.color;
          c.fillRect(-14, -pr.r, 28, pr.r * 2);
          c.globalAlpha = 1;
        } else if (pr.kind === 'orb') {
          c.globalAlpha = 0.3;
          c.fillStyle = pr.color;
          c.beginPath(); c.arc(0, 0, pr.r * 2, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 1;
          c.beginPath(); c.arc(0, 0, pr.r, 0, Math.PI * 2); c.fill();
        } else {
          c.rotate(Math.atan2(pr.vy, pr.vx));
          c.fillStyle = pr.color || '#e8eef8';
          c.fillRect(-pr.r, -pr.r * 0.4, pr.r * 2, pr.r * 0.8);
        }
        c.restore();
      });
    },

    drawFx: function (c) {
      this.fx.forEach(function (f) {
        const k = f.t / f.max;
        c.save();
        if (f.kind === 'hit' || f.kind === 'burst' || f.kind === 'dust') {
          c.globalAlpha = k * (f.kind === 'dust' ? 0.55 : 0.9);
          c.fillStyle = f.color;
          if (f.kind === 'dust') {
            const r = f.r || ((1 - k) * 4 + 2);
            c.fillRect(f.x - r, f.y - r, r * 2, r * 2);          /* 像素方块尘土 */
          } else {
            const r = (1 - k) * 16 + 4;
            c.beginPath(); c.arc(f.x, f.y, r, 0, Math.PI * 2); c.fill();
          }
        } else if (f.kind === 'spark') {
          c.globalAlpha = k;
          c.fillStyle = f.color;
          const r = f.r || 2;
          c.fillRect(f.x - r, f.y - r, r * 2, r * 2);            /* 命中火花像素 */
        } else if (f.kind === 'slash') {
          c.globalAlpha = k * 0.8;
          c.strokeStyle = f.color;
          c.lineWidth = 4;
          c.beginPath();
          /* step: 1 平斩 / 2 上挑 / 3 下劈 —— 弧线方向与角度不同 */
          const st = f.step || 1;
          const p = 1 - k;
          if (st === 2) {
            /* 由下往上扫 */
            if (f.face < 0) c.arc(f.x, f.y, f.reach, Math.PI + 0.9 - p * 1.5, Math.PI + 2.0 - p * 1.5);
            else c.arc(f.x, f.y, f.reach, -0.9 + p * 1.5, 0.2 + p * 1.5);
          } else if (st === 3) {
            /* 由上往下砸，弧线更陡更长 */
            c.lineWidth = 6;
            if (f.face < 0) c.arc(f.x, f.y, f.reach, Math.PI - 2.0 + p * 1.3, Math.PI - 0.9 + p * 1.3);
            else c.arc(f.x, f.y, f.reach, -2.0 + p * 1.3, -0.9 + p * 1.3);
          } else {
            if (f.face < 0) c.arc(f.x, f.y, f.reach, Math.PI - 1.1 + p * 1.4, Math.PI + 0.5 + p * 1.4);
            else c.arc(f.x, f.y, f.reach, -0.5 - p * 1.4, 1.1 - p * 1.4);
          }
          c.stroke();
          /* 第三击在地面溅起碎石 */
          if (st === 3 && k > 0.4) {
            c.globalAlpha = (k - 0.4) * 1.4;
            c.fillStyle = '#c9b79a';
            for (let i = 0; i < 6; i++) {
              const sx = f.x + f.face * (i * 7 + p * 30);
              c.fillRect(sx, f.y + 18 - ((i * 5 + p * 26) % 22), 2, 2);
            }
          }
        } else if (f.kind === 'shock') {
          c.globalAlpha = k * 0.7;
          c.strokeStyle = f.color;
          c.lineWidth = 5;
          c.beginPath();
          c.ellipse(f.x, f.y, f.r * (1.1 - k), f.r * 0.3 * (1.1 - k), 0, 0, Math.PI * 2);
          c.stroke();
        } else if (f.kind === 'nova') {
          c.globalAlpha = k * 0.6;
          c.strokeStyle = f.color;
          c.lineWidth = 6;
          c.beginPath(); c.arc(f.x, f.y, (1 - k) * 190, 0, Math.PI * 2); c.stroke();
        } else if (f.kind === 'bolt') {
          c.globalAlpha = k;
          c.strokeStyle = f.color;
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(f.x, 0);
          c.lineTo(f.x + U.rnd(-6, 6), f.y * 0.5);
          c.lineTo(f.x + U.rnd(-4, 4), f.y);
          c.stroke();
        }
        c.restore();
      });
    },

    drawFloats: function (c) {
      this.floats.forEach(function (f) {
        c.save();
        c.globalAlpha = Math.min(1, f.t / 0.5);
        c.fillStyle = f.color;
        c.font = 'bold ' + f.size + 'px "Microsoft YaHei",sans-serif';
        c.textAlign = 'center';
        c.shadowColor = 'rgba(0,0,0,.85)';
        c.shadowBlur = 4;
        c.fillText(f.text, f.x, f.y);
        c.restore();
      });
    },

    drawCrosshair: function (c) {
      const x = this.mouse.x, y = this.mouse.y, k = this.world || 1;
      const p = this.player;
      c.save();
      /* 瞄准辅助线：从角色手部指向准星，远程武器 / 投射类技能时显示 */
      const ranged = p.ranged || (p.skillLmb && p.skillLmb.proj);
      if (ranged && !p.dead) {
        const hx = p.x * (this.scale || 1) + (this.W - 1600 * (this.scale || 1)) / 2;
        const hy = (p.y - 24) * (this.scale || 1) + (this.H - WORLD_H * (this.scale || 1)) / 2;
        c.setLineDash([6 * k, 8 * k]);
        c.globalAlpha = 0.28;
        c.strokeStyle = '#9eeaff';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(hx, hy); c.lineTo(x, y);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1;
      }
      c.strokeStyle = p.atkT > 0 ? 'rgba(255,180,100,.95)' : 'rgba(255,255,255,.6)';
      c.lineWidth = 1.6;
      const r1 = 9 * k, r2 = 15 * k;
      c.beginPath();
      c.arc(x, y, r1, 0, Math.PI * 2);
      c.moveTo(x - r2, y); c.lineTo(x - r1 * 0.6, y);
      c.moveTo(x + r1 * 0.6, y); c.lineTo(x + r2, y);
      c.moveTo(x, y - r2); c.lineTo(x, y - r1 * 0.6);
      c.moveTo(x, y + r1 * 0.6); c.lineTo(x, y + r2);
      c.stroke();
      /* 准星落点的技能预测圈（主技能射程） */
      if (p.skillRmb && p.skillRmb.aoe) {
        c.globalAlpha = 0.35;
        c.strokeStyle = '#ff8a3c';
        c.beginPath();
        c.arc(x, y, p.skillRmb.aoe * 0.6, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    },

    cleanupHud: function () {
      if (this.hud && this.hud.cleanup) this.hud.cleanup();
    }
  };

  G.Game = Game;
  G.SKILLS = SKILLS;
})(window.G = window.G || {});
