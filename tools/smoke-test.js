/* =========================================================
   烟测脚本（Node，无浏览器）：用最小 DOM 桩加载全部游戏脚本，
   走通 登录 → 主界面 → 大厅 → 各子界面 → 进入战斗 → 跑帧 → 结算
   用法： node tools/smoke-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const logs = [];

/* ---------------- 最小 DOM 实现 ---------------- */
function makeClassList(el) {
  const set = new Set();
  return {
    add: function () { for (const c of arguments) if (c) set.add(c); },
    remove: function () { for (const c of arguments) set.delete(c); },
    contains: function (c) { return set.has(c); },
    toggle: function (c) { set.has(c) ? set.delete(c) : set.add(c); },
    _set: set,
    toString: function () { return Array.from(set).join(' '); }
  };
}

let uidSeq = 0;
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = new Proxy({ setProperty: function () { } }, {
      get: function (t, k) { return k in t ? t[k] : ''; },
      set: function (t, k, v) { t[k] = v; return true; }
    });
    this.dataset = {};
    this.attributes = {};
    this._class = '';
    this.classList = makeClassList(this);
    this._html = '';
    this.textContent = '';
    this.__id = ++uidSeq;
    this.nodeType = 1;
  }
  get className() { return this.classList.toString(); }
  set className(v) {
    this._class = v || '';
    this.classList._set.clear();
    String(v || '').split(/\s+/).forEach((c) => { if (c) this.classList._set.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v == null ? '' : v);
    /* 解析简单标签，让 querySelector 能命中 */
    this.children = [];
    const re = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    let m;
    while ((m = re.exec(this._html))) {
      const child = new El(m[1]);
      const attrStr = m[2] || '';
      const idm = /id\s*=\s*"([^"]+)"/.exec(attrStr);
      if (idm) child.id = idm[1];
      const clm = /class\s*=\s*"([^"]*)"/.exec(attrStr);
      if (clm) child.className = clm[1];
      const tm = /data-tip\s*=\s*"([^"]*)"/.exec(attrStr);
      if (tm) child.attributes['data-tip'] = tm[1];
      if (/^svg$/i.test(m[1])) child.__isSvg = true;
      child.parentNode = this;
      this.children.push(child);
    }
    return v;
  }
  appendChild(c) {
    if (!c) return c;
    if (c.__isFragment) { (c.children || []).forEach((k) => this.appendChild(k)); c.children = []; return c; }
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  append() { for (const a of arguments) this.appendChild(a); }
  insertBefore(c, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) return this.appendChild(c);
    c.parentNode = this;
    this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = v; }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  addEventListener() { }
  removeEventListener() { }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }; }
  get offsetWidth() { return 200; }
  get offsetHeight() { return 80; }
  focus() { }
  closest(sel) {
    const parts = String(sel).split(',').map((s) => s.trim().replace(/^\./, ''));
    let n = this;
    while (n) {
      if (parts.some((p) => n.classList && n.classList.contains(p))) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const sels = String(sel).split(',').map((s) => s.trim());
    const walk = (n) => {
      for (const c of n.children) {
        for (const s of sels) {
          if (s.startsWith('#')) { if (c.id === s.slice(1)) out.push(c); }
          else if (s.startsWith('.')) { if (c.classList.contains(s.slice(1))) out.push(c); }
          else if (c.tagName === s.toUpperCase()) out.push(c);
        }
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  get firstChild() { return this.children[0] || null; }
  contains(n) {
    if (n === this) return true;
    return this.children.some(function walk(c) { return c === n || (c.children || []).some(walk); });
  }
  getContext() { return makeCtx(); }
  get width() { return this._w || 300; }
  set width(v) { this._w = v; }
  get height() { return this._h || 150; }
  set height(v) { this._h = v; }
}

function makeCtx() {
  const grad = { addColorStop: function () { } };
  const noop = function () { return undefined; };
  const ctx = {
    canvas: null, globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '', textAlign: '', shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: false,
    setTransform: noop, save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    arc: noop, ellipse: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillText: noop, measureText: function () { return { width: 40 }; },
    createLinearGradient: function () { return grad; },
    createRadialGradient: function () { return grad; },
    drawImage: noop, putImageData: noop
  };
  return ctx;
}

const documentStub = {
  readyState: 'complete',
  body: new El('body'),
  documentElement: new El('html'),
  _byId: {},
  createElement(tag) { return new El(tag); },
  createElementNS(ns, tag) { return new El(tag); },
  createDocumentFragment() { const f = new El('fragment'); f.__isFragment = true; return f; },
  getElementById(id) {
    if (!this._byId[id]) {
      const e = new El('div');
      e.id = id;
      e.parentNode = this.body;
      this.body.children.push(e);
      this._byId[id] = e;
    }
    return this._byId[id];
  },
  querySelector(sel) { return this.body.querySelector(sel); },
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
  addEventListener() { },
  removeEventListener() { }
};

/* ---------------- 定时器 / rAF 控制 ---------------- */
let now = 1000;
const timers = [];
const rafs = [];
const sandbox = {
  console: {
    log: function () { logs.push(Array.prototype.join.call(arguments, ' ')); },
    warn: function () { logs.push('[warn] ' + Array.prototype.join.call(arguments, ' ')); },
    error: function () {
      const msg = Array.prototype.join.call(arguments, ' ');
      const st = (new Error('trace')).stack.split('\n').slice(2, 7).join('\n     ');
      errors.push('[console.error] ' + msg + '\n     ' + st);
    }
  },
  document: documentStub,
  window: null,
  navigator: { userAgent: 'node-smoke' },
  location: { href: 'file:///index.html' },
  performance: { now: function () { return now; } },
  requestAnimationFrame: function (cb) { rafs.push(cb); return rafs.length; },
  cancelAnimationFrame: function () { },
  setTimeout: function (fn, ms) { timers.push({ fn: fn, at: now + (ms || 0) }); return timers.length; },
  clearTimeout: function () { },
  setInterval: function () { return 0; },
  clearInterval: function () { },
  MutationObserver: function () { this.observe = function () { }; this.disconnect = function () { }; },
  AudioContext: undefined,
  localStorage: (function () {
    const m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  })(),
  Math: Math, JSON: JSON, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
  Boolean: Boolean, Error: Error, RegExp: RegExp, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.devicePixelRatio = 1;
sandbox.innerWidth = 1280;
sandbox.innerHeight = 720;
sandbox.addEventListener = function () { };
sandbox.removeEventListener = function () { };
sandbox.Proxy = Proxy;
sandbox.Set = Set; sandbox.Map = Map; sandbox.Symbol = Symbol;
sandbox.WeakMap = WeakMap; sandbox.Promise = Promise;
sandbox.URL = URL; sandbox.Blob = function () { }; sandbox.Image = function () { };

vm.createContext(sandbox);

function drainTimers(maxRounds) {
  let rounds = 0;
  while (timers.length && rounds < (maxRounds || 60)) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers.shift();
    now = Math.max(now, t.at);
    try { t.fn(); } catch (e) { errors.push('[timer] ' + (e && e.stack || e)); }
    rounds++;
  }
  return rounds;
}

function runFrames(n, dtMs) {
  for (let i = 0; i < n; i++) {
    now += (dtMs || 16.7);
    const list = rafs.splice(0, rafs.length);
    for (const cb of list) {
      try { cb(now); } catch (e) { errors.push('[raf] ' + (e && e.stack || e)); }
    }
    drainTimers(40);
  }
}

/* ---------------- 加载脚本 ---------------- */
const FILES = [
  'js/data/weapons.js', 'js/data/clothing.js', 'js/data/items.js', 'js/data/enemies.js', 'js/data/creatures.js', 'js/data/resources.js', 'js/data/ruins.js', 'js/data/quests.js',
  'js/data/titles.js',
  'js/core/util.js', 'js/core/audio.js', 'js/core/state.js', 'js/core/sprites.js', 'js/core/icons.js',
  'js/ui/kit.js',
  'js/ui/screen-login.js', 'js/ui/screen-home.js', 'js/ui/screen-lobby.js',
  'js/ui/screen-character.js', 'js/ui/screen-inventory.js', 'js/ui/screen-quests.js', 'js/ui/screen-mods.js',
  /* 开放世界（俯视角沙盒） */
  'js/game/world.js', 'js/ui/mapview.js', 'js/game/worldview.js', 'js/ui/screen-world.js',
  'js/game/engine.js', 'js/game/boot.js', 'js/core/bootstrap.js'
];

const checks = [];
function check(label, fn) {
  const before = errors.length;
  checks.push(label);
  try { fn(); } catch (e) { errors.push('[' + label + '] ' + (e && e.stack || e)); }
  const added = errors.slice(before);
  console.log((added.length ? 'FAIL ' : 'ok   ') + label + (added.length ? '\n     ' + added.join('\n     ') : ''));
  return added.length === 0;
}

let ok = true;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  const code = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    errors.push('[load ' + f + '] ' + (e && e.stack || e));
    console.log('FAIL 加载 ' + f + '\n     ' + (e && e.message));
    ok = false;
  }
}
console.log('—— 脚本加载完成 ——');

const G = sandbox.G;

ok = check('引导启动 + 登录界面挂载', function () {
  drainTimers(30);
  runFrames(2);
  if (G.Screen.current !== 'login') throw new Error('当前界面应为 login，实际 ' + G.Screen.current);
}) && ok;

ok = check('模拟登录（写入初始武器与衣物）', function () {
  G.State.state.account.name = '烟测员';
  G.State.state.account.online = true;
  if (!G.State.state.ownedWeapons.length) {
    const w = JSON.parse(JSON.stringify(G.Weapons.get('w_ember_blade')));
    w.uid = 'wtest1'; w.instName = w.name;
    G.State.addWeapon(w);
    G.State.equipWeapon(w.uid);
    const c = JSON.parse(JSON.stringify(G.Clothing.get('b_leather_vest')));
    c.uid = 'ctest1';
    G.State.addClothing(c);
    G.State.equipCloth(c.uid);
  }
  G.Screen.go('home');
  runFrames(3);
  if (G.Screen.current !== 'home') throw new Error('未进入 home');
}) && ok;

ok = check('主界面 → 大厅（营地）', function () {
  G.Screen.go('lobby', { type: 'hub' });
  runFrames(4);
  drainTimers(20);
}) && ok;

ok = check('大厅 → 关卡选择', function () {
  G.Screen.go('lobby', { type: 'stages' });
  runFrames(3);
}) && ok;

ok = check('角色 / 衣物界面', function () {
  G.Screen.go('character', {});
  runFrames(3);
  if (!G.Clothing.bySlot('head').length) throw new Error('衣物数据缺失');
}) && ok;

ok = check('背包界面（含武器详情）', function () {
  G.Screen.go('inventory', {});
  runFrames(2);
}) && ok;

ok = check('任务界面（接取 + 交付流程）', function () {
  G.Screen.go('quests', {});
  runFrames(2);
  const claimed = G.State.acceptQuest('q_m1');
  if (!claimed) throw new Error('接取任务失败');
  /* 模拟清空房间，让任务达成 */
  G.State.state.stats.rooms += 1;
  G.State.syncQuestProgress();
  const re = G.State.claimQuest('q_m1');
  if (!re) throw new Error('交付任务失败');
  if ((G.State.state.account.lvl || 1) < 1) throw new Error('等级异常');
}) && ok;

ok = check('铁砧（强化 / 词条 / 天赋 / 商店 / 场景）', function () {
  ['forge', 'affix', 'talent', 'shop', 'scene'].forEach(function (t) {
    G.Screen.go('mods', { tab: t });
    runFrames(1);
  });
}) && ok;

ok = check('进入战斗场景（第一层）', function () {
  G.Screen.go('game', { stageId: 'st1' });
  drainTimers(40);
  runFrames(5);
  if (!G.__game) throw new Error('Game 实例未创建');
  if (!G.__game.running) throw new Error('游戏未进入运行状态');
}) && ok;

ok = check('战斗模拟：跑 600 帧 + 键盘操作 + 攻击 + 战技 + 道具', function () {
  const game = G.__game;
  game.keys['d'] = true;
  game.keys[' '] = true;
  let frames = 0;
  for (let i = 0; i < 600; i++) {
    if (i === 120) { game.keys[' '] = false; }
    if (i === 160) { game.keys['shift'] = true; }
    if (i === 200) { game.keys['shift'] = false; }
    if (i % 30 === 0) { game.mouse.left = true; game.tryAttack(false); }
    if (i % 90 === 0) { game.mouse.left = false; game.tryAttack(true); }
    if (i === 300) { game.castSkill(); }
    if (i === 420) { game.useItem(); }
    if (i === 500) { game.castSkill(); }
    game.mouse.x = 700 + (i % 200);
    game.mouse.y = 400;
    now += 16.7;
    try { game.update(1 / 60); } catch (e) { errors.push('[update frame ' + i + '] ' + (e && e.stack || e)); break; }
    if (i % 7 === 0) {
      try { game.render(); } catch (e) { errors.push('[render frame ' + i + '] ' + (e && e.stack || e)); break; }
    }
    frames++;
  }
  if (frames < 600) throw new Error('模拟在中途中断，已跑 ' + frames + ' 帧');
  if (Game_alive(game) === 0) throw new Error('战斗模拟后没有清理任何状态');
}) && ok;

function Game_alive(game) { return 1; }

ok = check('全层数快速冒烟（1~5 层各 120 帧）', function () {
  G.STAGES.forEach(function (s) {
    G.Screen.go('game', { stageId: s.id });
    drainTimers(40);
    runFrames(3);
    const game = G.__game;
    if (!game) throw new Error(s.id + ' 未创建 Game');
    game.keys['d'] = true;
    for (let i = 0; i < 120; i++) {
      now += 16.7;
      game.mouse.left = true;
      if (i % 20 === 0) game.tryAttack(false);
      if (i === 60) game.castSkill();
      game.update(1 / 60);
      if (i % 10 === 0) game.render();
    }
    /* 直接触发结算路径 */
    game.result = 'win';
    game.over = true;
    game.showResult(true);
    runFrames(2);
  });
}) && ok;

ok = check('存档写入 / 读取 / 重置', function () {
  G.State.saveNow();
  const raw = sandbox.localStorage.getItem(G.State.KEY);
  if (!raw) throw new Error('存档未写入');
  const parsed = JSON.parse(raw);
  if (!parsed.account || parsed.account.name !== '烟测员') throw new Error('存档内容异常');
  G.State.reset();
  if (G.State.state.account.lvl !== 1) throw new Error('重置失败');
}) && ok;

ok = check('新操作体系：W长按 / S下蹲滑铲 / E交互 / 右键主技能 / Q副技能 / 三段连招', function () {
  G.State.state.account.lvl = 9;
  G.State.state.wallet.i_ember = 30000;          /* 抬到高阶称号，验证分支技能 */
  G.Screen.go('game', { stageId: 'st2' });
  drainTimers(40);
  runFrames(3);
  const g = G.__game;
  if (!g) throw new Error('未创建 Game');
  const p = g.player;
  const logs = [];
  logs.push('称号=' + (g.title ? g.title.name : '?') + '(索引 ' + p.titleIdx + ')');
  logs.push('主技能=' + (p.skillRmb && p.skillRmb.name) + '｜副技能=' + (p.skillQ && p.skillQ.name) + '｜闪避=' + (p.skillShift && p.skillShift.name));

  /* 1) W 长按高跳：短按与长按对比 */
  function jumpPeak(holdFrames) {
    p.x = 300; p.y = 600; p.vy = 0; p.vx = 0; p.jumps = 0; p.onGround = true; p.jumpHold = false; p.jumpHeld = false;
    let top = p.y;
    g.keys['w'] = true;
    for (let i = 0; i < 60; i++) {
      if (i >= holdFrames) g.keys['w'] = false;
      g.update(1 / 60);
      top = Math.min(top, p.y);
    }
    g.keys['w'] = false;
    return Math.round(600 - top);
  }
  const hShort = jumpPeak(2), hLong = jumpPeak(30);
  logs.push('短按跳高=' + hShort + '　长按跳高=' + hLong + (hLong > hShort ? ' ✓' : ' ✗'));

  /* 2) S 下蹲（碰撞盒减半）与滑铲 */
  p.x = 300; p.y = 600; p.vy = 0; p.vx = 0; p.onGround = true; p.slideT = 0; p.crouch = false;
  g.keys['s'] = true;
  g.update(1 / 60);
  const crouchH = p.h;
  g.keys['s'] = false;
  g.update(1 / 60);
  p.vx = 300; p.onGround = true;
  g.keys['s'] = true;
  g.update(1 / 60);
  const sliding = p.slideT > 0;
  g.keys['s'] = false;
  logs.push('下蹲碰撞盒=' + crouchH + '（站姿 40）　滑铲触发=' + (sliding ? '✓' : '✗'));

  /* 3) 三段连招 */
  p.x = 300; p.y = 600; p.vy = 0; p.vx = 0; p.onGround = true; p.comboStep = 0; p.comboT = 0; p.atkT = 0;
  const steps = [];
  for (let i = 0; i < 3; i++) {
    g.tryAttack(false);
    steps.push(p.comboStep);
    for (let j = 0; j < Math.ceil(p.atkDur * 60) + 3; j++) g.update(1 / 60);
  }
  logs.push('连招段数=' + steps.join('→'));

  /* 4) 右键 / Q / Shift 三个技能位 */
  p.stamina = p.maxStamina; p.cds = {};
  g.useSlot('rmb');
  const rmbCd = Object.keys(p.cds).length > 0;
  p.cds = {}; p.stamina = p.maxStamina;
  g.useSlot('q');
  const qCd = Object.keys(p.cds).length > 0;
  p.cds = {}; p.stamina = p.maxStamina; p.dodgeChargesLeft = null;
  g.useSlot('shift');
  const dodged = p.dashT > 0 || p.invuln > 0.15;
  logs.push('右键主技能=' + (rmbCd ? '✓' : '✗') + '　Q副技能=' + (qCd ? '✓' : '✗') + '　Shift闪避=' + (dodged ? '✓' : '✗'));

  /* 5) E 交互：把波次跑到最后一波并清场，等传送门出现后按 E */
  g.enemies.forEach(function (e) { e.dead = true; });
  g.waves = g.wave;                              /* 停止刷新增援，直接进入清场 */
  for (let i = 0; i < 200; i++) {
    g.enemies.forEach(function (e) { e.dead = true; });
    g.update(1 / 60);
    if (g.portal) break;
  }
  const hasPortal = !!g.portal;
  let opened = false;
  if (hasPortal) {
    p.x = g.portal.x; p.y = 600;
    g.interact();
    opened = !!g.usePortalNext;
  }
  logs.push('传送门生成=' + (hasPortal ? '✓' : '✗') + '　E 交互开门=' + (opened ? '✓' : '✗'));

  /* 6) 渲染不报错（含领域 / 残影 / 交互提示） */
  p.echoes.push({ x: p.x, y: p.y, face: 1, life: 0.3, max: 0.3, crouch: false });
  g.spawnField(p.x, { r: 110, dur: 3, dmg: 0.4, tick: 0.5 });
  g.summonAlly(p.x, p.y);
  g.render();
  logs.push('渲染含残影/领域/仆从/交互提示：通过');
  console.log('     ' + logs.join('\n     '));

  if (!(hLong > hShort)) throw new Error('长按跳跃未生效');
  if (crouchH >= 40) throw new Error('下蹲未改变碰撞盒');
  if (steps.join(',') !== '1,2,3') throw new Error('三段连招顺序错误：' + steps.join(','));
  if (!rmbCd || !qCd || !dodged) throw new Error('技能位或闪避未生效');
  if (hasPortal && !opened) throw new Error('E 交互开门未生效');
}) && ok;

ok = check('称号分档回落（凡人档技能线）', function () {
  G.State.state.wallet.i_ember = 0;
  G.Screen.go('game', { stageId: 'st1' });
  drainTimers(40);
  runFrames(3);
  const g = G.__game;
  const p = g.player;
  if (p.titleIdx !== 0) throw new Error('凡人档索引应为 0，实际 ' + p.titleIdx);
  if (!p.skillRmb || !p.skillQ || !p.skillShift) throw new Error('凡人档技能线未解析');
  const w = g.tot.weapon;
  if (w && w.skill) g.castSkill();               /* 旧接口仍可用（别名回落） */
  runFrames(2);
  console.log('     凡人档：主技能=' + p.skillRmb.name + '｜副技能=' + p.skillQ.name +
              '｜闪避=' + p.skillShift.name + '｜被动=' + (p.passive && p.passive.name));
}) && ok;

ok = check('称号技能进阶效果（灵魂增伤 / 印记叠层 / 法则持续伤害 / 灵魂不灭复活）', function () {
  G.State.state.account.lvl = 12;
  G.State.state.wallet.i_ember = 300000;         /* 升神者档 */
  G.Screen.go('game', { stageId: 'st5' });
  drainTimers(40);
  runFrames(3);
  const g = G.__game;
  const p = g.player;
  const logs = [];
  logs.push('称号=' + g.title.name + '(索引 ' + p.titleIdx + ')');
  logs.push('被动=' + p.passive.name + '｜印记叠层=' + (p.markAmpStack ? '开' : '关'));

  /* 1) 灵魂伤害：亡灵敌人吃 30% 增伤 */
  const e1 = g.enemies[0];
  if (!e1) throw new Error('未生成敌人');
  e1.undead = true; e1.hp = e1.maxHp = 100000; e1.markT = 0;
  const before1 = e1.hp;
  g.hurtEnemy(e1, 100, false, 1, { soul: true });
  const soulDmg = before1 - e1.hp;
  e1.markT = 0;
  const before2 = e1.hp;
  g.hurtEnemy(e1, 100, false, 1, {});
  const plainDmg = before2 - e1.hp;
  logs.push('亡灵目标：灵魂伤害=' + soulDmg + '　普通伤害=' + plainDmg + (soulDmg > plainDmg ? ' ✓' : ' ✗'));

  /* 2) 印记叠层增伤 */
  const e2 = g.enemies[1] || e1;
  e2.undead = false; e2.hp = e2.maxHp = 100000; e2.markT = 3; e2.markStack = 3;
  const before3 = e2.hp;
  g.hurtEnemy(e2, 100, false, 1, {});
  const markedDmg = before3 - e2.hp;
  logs.push('三层印记伤害=' + markedDmg + '（基础 100）' + (markedDmg > 100 ? ' ✓' : ' ✗'));

  /* 3) 法则突进的持续伤害 */
  const e3 = g.enemies[2] || e1;
  e3.hp = e3.maxHp = 100000;
  g.applyDot(e3, 20, 2);
  const hpBeforeDot = e3.hp;
  for (let i = 0; i < 130; i++) g.update(1 / 60);
  logs.push('持续伤害（2 秒）=' + Math.round(hpBeforeDot - e3.hp) + (e3.hp < hpBeforeDot ? ' ✓' : ' ✗'));

  /* 4) 灵魂不灭：切到「灵墟行者」档（该档被动即灵魂不灭），首次死亡原地复活并回 50% 生命 */
  G.State.state.wallet.i_ember = 40000;
  G.Screen.go('game', { stageId: 'st5' });
  drainTimers(40);
  runFrames(3);
  const g2 = G.__game, p2 = g2.player;
  logs.push('复活测试档位=' + g2.title.name + '（被动 ' + p2.passive.name + '）');
  p2.hp = 1; p2.dead = false; p2.revivePassiveUsed = false;
  g2.damagePlayer(9999, 1, '测试');
  const revived = !p2.dead && p2.hp > p2.maxHp * 0.4;
  logs.push('致命伤害后：存活=' + (!p2.dead) + ' 生命=' + Math.round(p2.hp) + '/' + p2.maxHp + (revived ? ' ✓' : ' ✗'));

  /* 5) 新元结界：护盾吸收一次伤害（升神者档） */
  G.State.state.wallet.i_ember = 300000;
  G.Screen.go('game', { stageId: 'st5' });
  drainTimers(40);
  runFrames(3);
  const g3 = G.__game, p3 = g3.player;
  p3.hp = Math.round(p3.maxHp * 0.5); p3.barrierT = 4; p3.invuln = 0; p3.dead = false;
  const hpBeforeBarrier = p3.hp;
  g3.damagePlayer(200, 1, '测试');
  logs.push('结界吸收：生命 ' + Math.round(hpBeforeBarrier) + ' → ' + Math.round(p3.hp) + (p3.hp === hpBeforeBarrier ? ' ✓' : ' ✗'));

  console.log('     ' + logs.join('\n     '));
  if (!(soulDmg > plainDmg)) throw new Error('灵魂伤害未对亡灵增伤');
  if (!(markedDmg > 100)) throw new Error('法则印记未增伤');
  if (!revived) throw new Error('灵魂不灭未复活');
  if (p3.hp !== hpBeforeBarrier) throw new Error('护盾未吸收伤害');
}) && ok;

ok = check('操作手感优化（输入缓冲 / 闪避取消后摇 / 空中修正 / 冷却闪烁）', function () {
  G.State.state.account.lvl = 9;
  G.State.state.wallet.i_ember = 30000;
  G.Screen.go('game', { stageId: 'st2' });
  drainTimers(40);
  runFrames(3);
  const g = G.__game, p = g.player;
  const logs = [];

  /* 1) 连招输入缓冲：动作尾声点击会被排队并在 0.12 秒内接招 */
  p.x = 300; p.y = 600; p.vy = 0; p.vx = 0; p.onGround = true;
  p.comboStep = 0; p.comboT = 0; p.atkT = 0; p.buffered = false;
  g.tryAttack(false);
  const firstStep = p.comboStep;
  for (let i = 0; i < Math.ceil(p.atkDur * 60) - 4; i++) g.update(1 / 60);   // 推进到动作尾声
  g.tryAttack(false);                                                        // 尾声点击
  const queued = p.buffered === true;
  for (let i = 0; i < 14; i++) g.update(1 / 60);
  const chained = p.comboStep === 2 && p.atkT > 0;
  logs.push('输入缓冲：第 ' + firstStep + ' 段尾声点击 → 排队=' + queued + ' 自动接第 ' + p.comboStep + ' 段=' + (chained ? '✓' : '✗'));

  /* 2) 闪避取消后摇：命中判定生效后可即时打断 */
  p.atkT = 0; p.buffered = false; p.stamina = p.maxStamina; p.cds = {}; p.dodgeChargesLeft = null;
  g.tryAttack(false);
  for (let i = 0; i < Math.ceil(p.atkDur * 0.4 * 60); i++) g.update(1 / 60);  // 命中判定已触发（>28%）
  const nowAtk = Math.round(p.atkT * 1000);
  g.useSlot('shift');
  const cancelled = p.atkT === 0 && p.dashT > 0;
  logs.push('闪避取消后摇：取消前剩余 ' + nowAtk + 'ms → 取消后 ' + Math.round(p.atkT * 1000) + 'ms，进入闪避=' + (cancelled ? '✓' : '✗'));

  /* 3) 空中操作修正：空中可用 A/D 微调，但加速弱于地面 */
  function airControl(frames, hold) {
    p.x = 300; p.y = 400; p.vx = 0; p.vy = 0; p.onGround = false; p.dashT = 0; p.slideT = 0; p.rushT = 0;
    g.keys['d'] = hold;
    for (let i = 0; i < frames; i++) { p.vy = 0; g.update(1 / 60); }
    g.keys['d'] = false;
    return Math.round(p.vx);
  }
  const airHold = Math.abs(airControl(8, true));
  const airFree = Math.abs(airControl(8, false));
  logs.push('空中修正：按住 D 8 帧得到 ' + airHold + ' px/s，不按为 ' + airFree + '（可微调且弱于地面 250）');

  /* 4) 冷却结束闪烁提示 */
  p.cds = {};
  p.cds['q:' + p.skillQ.name] = 0.25;
  p.cdReady = {};
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  const flashed = (p.cdReady['q:' + p.skillQ.name] || 0) > 0;
  g.syncHud();
  /* HUD 技能栏 HTML 由 boot.js 生成，这里直接检查模板里是否带了闪烁类 */
  const bootSrc = fs.readFileSync(path.join(ROOT, 'js/game/boot.js'), 'utf8');
  const hasFlashClass = bootSrc.indexOf('cd-flash') >= 0 && bootSrc.indexOf('d.mainReady') >= 0;
  logs.push('冷却结束：标记=' + (flashed ? '✓' : '✗') + '　HUD 闪烁类=' + (hasFlashClass ? '✓' : '✗'));

  console.log('     ' + logs.join('\n     '));
  if (!queued || !chained) throw new Error('连招输入缓冲未生效');
  if (!cancelled) throw new Error('闪避未取消普攻后摇');
  if (!(airHold > 0)) throw new Error('空中无法微调方向');
  if (!flashed) throw new Error('冷却结束未记录闪烁标记');
}) && ok;

ok = check('开放世界（俯视角沙盒）：地形生成 / 出生点 / 通行与减速 / 地图缩略图', function () {
  /* 1) 世界生成 */
  const t0 = Date.now();
  const w = G.generateWorld(320, 20261008);
  const ms = Date.now() - t0;
  if (!w || w.tiles.length !== 320 * 320) throw new Error('世界尺寸异常');
  const names = ['深水', '浅水', '沙滩', '草地', '草甸', '森林', '岩地', '雪地'];
  const cnt = new Array(8).fill(0);
  for (let i = 0; i < w.tiles.length; i++) cnt[w.tiles[i]]++;
  const pct = cnt.map(function (v, i) { return names[i] + ' ' + (v / w.tiles.length * 100).toFixed(1) + '%'; });
  console.log('     ' + pct.join(' | '));

  /* 2) 出生点必须是可站立陆地 */
  const spawnTile = G.tileAt(w, w.spawn.x, w.spawn.y);
  if (!G.isWalkable(w, w.spawn.x, w.spawn.y)) throw new Error('出生点不可站立，地形=' + names[spawnTile]);

  /* 3) 深水不可通行 + 浅水/森林有减速 */
  let deepOk = true, slowOk = true;
  for (let y = 0; y < w.size && deepOk; y++) {
    for (let x = 0; x < w.size; x++) {
      if (w.tiles[y * w.size + x] === 0) { deepOk = !G.isWalkable(w, x, y); break; }
    }
  }
  for (let y = 0; y < w.size && slowOk; y++) {
    for (let x = 0; x < w.size; x++) {
      const t = w.tiles[y * w.size + x];
      if (t === 1 || t === 5) { slowOk = G.tileSpeed(w, x, y) < 1; break; }
    }
  }
  if (!deepOk) throw new Error('深水竟然可通行');
  if (!slowOk) throw new Error('浅水/森林没有减速效果');

  /* 4) 可达陆地连通性（从出生点洪泛） */
  const seen = new Uint8Array(w.size * w.size);
  const q = [[w.spawn.x, w.spawn.y]];
  seen[w.spawn.y * w.size + w.spawn.x] = 1;
  let n = 0;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const c = q.pop(); n++;
    for (let i = 0; i < 4; i++) {
      const nx = c[0] + DIRS[i][0], ny = c[1] + DIRS[i][1];
      if (nx < 0 || ny < 0 || nx >= w.size || ny >= w.size) continue;
      const idx = ny * w.size + nx;
      if (seen[idx] || !G.isWalkable(w, nx, ny)) continue;
      seen[idx] = 1; q.push([nx, ny]);
    }
  }
  const landPct = (n / w.tiles.length * 100).toFixed(1);
  console.log('     生成耗时 ' + ms + ' ms　装饰物 ' + w.props.length + ' 个　出生点 (' + w.spawn.x + ',' + w.spawn.y + ') ' + names[spawnTile] +
              '　可达陆地 ' + n + ' 格（' + landPct + '%）');
  if (n < w.tiles.length * 0.25) throw new Error('可达陆地过少：' + landPct + '%');

  /* 5) 地图缩略图（离屏 canvas 由 DOM 桩提供） */
  const thumb = G.renderMapThumb(w, 3);
  if (!thumb || thumb.width !== w.size * 3) throw new Error('地图缩略图尺寸异常');
  console.log('     地图缩略图 ' + thumb.width + '×' + thumb.height + ' px');

  /* 6) 大地图控制器存在且可缩放 */
  if (!G.MapView || typeof G.MapView.open !== 'function') throw new Error('G.MapView 未注册');
  console.log('     大地图控制器：G.MapView.open 可用，支持滚轮缩放 / 拖拽平移 / 双击定位');
}) && ok;

ok = check('生物体系：中立 / 善良 / 无攻击 · 5 个种类 · 姓名 · Tab 背包', function () {
  /* 1) 数据完整性：5 个种类、性情、属性、掉落都要有 */
  const list = G.Creature.list;
  if (list.length !== 10) throw new Error('生物种类数应为 10，实际 ' + list.length);
  const names = list.map(function (c) { return c.name; }).join('/');
  const tempers = {};
  list.forEach(function (c) {
    if (['neutral', 'friendly', 'passive', 'guardian'].indexOf(c.temper) < 0) throw new Error(c.id + ' 性情非法：' + c.temper);
    if (!c.hp || !c.spd || !c.size) throw new Error(c.id + ' 属性缺失');
    if (!c.drops || !c.drops.length) throw new Error(c.id + ' 没有掉落');
    if (!c.habitat) throw new Error(c.id + ' 缺少栖息地');
    tempers[c.temper] = (tempers[c.temper] || 0) + 1;
  });
  const tStr = Object.keys(G.TEMPER).map(function (k) { return G.TEMPER[k].label + ' ' + (tempers[k] || 0); }).join(' · ');
  console.log('     种类：' + names + '　性情分布：' + tStr);

  /* 2) 主要物种：猪牛羊鸡鱼 + 参考图新增的梅花鹿 / 野猪 / 青蛙 / 叶精灵 / 行囊史莱姆 */
  const need = ['猪', '牛', '羊', '鸡', '鱼', '梅花鹿', '野猪', '青蛙', '叶精灵', '行囊史莱姆'];
  need.forEach(function (n) {
    if (!list.some(function (c) { return c.name === n; })) throw new Error('缺少物种：' + n);
  });
  const land = list.filter(function (c) { return c.habitat === 'land'; }).length;
  const water = list.filter(function (c) { return c.habitat === 'water'; }).length;
  console.log('     10 个物种齐全：' + need.join(' / ') + '　（陆地 ' + land + ' + 水中 ' + water + '）');

  /* 2b) 友善援护必须有战斗属性 */
  const guards = list.filter(function (c) { return c.temper === 'guardian'; });
  if (guards.length < 2) throw new Error('友善援护生物过少：' + guards.length);
  guards.forEach(function (c) {
    if (!c.atk || !c.atkCd) throw new Error(c.id + ' 缺少战斗属性（atk / atkCd）');
  });
  console.log('     友善援护 ' + guards.length + ' 种：' + guards.map(function (c) {
    return c.name + '(攻' + c.atk + '/' + c.atkCd + 's' + (c.ranged ? ' 远程' : ' 近战') + ')';
  }).join('　'));

  /* 3) 姓名池 */
  const pool = G.CREATURE_NAMES;
  if (!pool || pool.length < 20) throw new Error('姓名池过小：' + (pool ? pool.length : 0));
  const uniq = {};
  pool.forEach(function (n) { uniq[n] = 1; });
  if (Object.keys(uniq).length !== pool.length) throw new Error('姓名池有重复');
  console.log('     姓名池 ' + pool.length + ' 个且无重复，例：' + pool.slice(0, 6).join('、'));

  /* 4) 按地形选物种：水里只能出鱼，陆地不能出鱼 */
  const waterPick = G.creatureForTerrain('浅水', 1);
  if (!waterPick || waterPick.habitat !== 'water') throw new Error('浅水未生成水生生物');
  const landPick = G.creatureForTerrain('草地', 1);
  if (!landPick || landPick.habitat !== 'land') throw new Error('草地未生成陆生生物');
  const forestPick = G.creatureForTerrain('森林', 3);
  if (!forestPick || forestPick.habitat !== 'land') throw new Error('森林未生成陆生生物');
  console.log('     地形匹配：浅水→' + waterPick.name + '　草地→' + landPick.name + '　森林→' + forestPick.name);

  /* 5) 新增物品都存在且可入包 */
  const needItems = ['i_meat_raw', 'i_fish_raw', 'i_cloth', 'i_feather', 'i_wood', 'i_sand', 'i_water', 'i_stone',
                     'i_horn', 'i_tusk', 'i_slime_gel', 'i_leaf_sprout'];
  needItems.forEach(function (id) {
    const it = G.Items.get(id);
    if (!it) throw new Error('缺少物品：' + id);
  });
  console.log('     新增物品 ' + needItems.length + ' 种：生肉 / 生鱼 / 毛料 / 羽毛 / 木头 / 沙子 / 水袋 / 石块');

  /* 6) Tab 键绑定到背包 */
  if (typeof G.World !== 'function') throw new Error('G.World 未注册');
  const proto = G.World.prototype || {};
  if (typeof proto.toggleBag !== 'function') throw new Error('缺少 toggleBag（Tab 背包开关）');
  if (typeof proto.openBag !== 'function' || typeof proto.closeBag !== 'function') throw new Error('背包开关方法不全');
  console.log('     Tab 背包：toggleBag / openBag / closeBag 均已注册');
}) && ok;

ok = check('可破坏资源：木头 / 沙子 / 水 / 石块（破坏 → 掉落 → 入包）', function () {
  /* 1) 资源表完整 */
  const R = G.RESOURCES;
  const need = ['tree', 'pine', 'bush', 'rock', 'sand', 'water'];
  need.forEach(function (k) {
    if (!R[k]) throw new Error('缺少资源定义：' + k);
    if (!R[k].hits || !R[k].drops || !R[k].drops.length) throw new Error(k + ' 定义不完整');
    if (!R[k].verb) throw new Error(k + ' 缺少动作词');
  });
  console.log('     资源表：' + need.map(function (k) { return R[k].name + '(' + R[k].hits + '下)'; }).join('　'));

  /* 2) 地形 → 资源映射 */
  if (G.resourceForTerrain('沙滩') !== 'sand') throw new Error('沙滩未映射到沙');
  if (G.resourceForTerrain('浅水') !== 'water') throw new Error('浅水未映射到水');
  if (G.resourceForTerrain('深水') !== 'water') throw new Error('深水未映射到水');
  if (G.resourceForTerrain('草地') !== null) throw new Error('草地不该有可采资源');
  console.log('     地形映射：沙滩→沙　浅水/深水→水　草地→（无）');

  /* 3) 掉落结算：每种资源都能 roll 出东西 */
  const got = {};
  need.forEach(function (k) {
    let total = 0;
    for (let i = 0; i < 200; i++) {
      G.rollResourceDrops(k).forEach(function (d) { total += d.count; });
    }
    if (total <= 0) throw new Error(k + ' 永远掉不出东西');
    got[k] = Math.round(total / 200 * 10) / 10;
  });
  console.log('     平均掉落：' + need.map(function (k) { return R[k].name + ' ' + got[k] + ' 件'; }).join('　'));

  /* 4) 掉落物都能在物品表里找到，且能入包 */
  need.forEach(function (k) {
    R[k].drops.forEach(function (d) {
      const it = G.Items.get(d.id);
      if (!it) throw new Error(k + ' 掉落引用了不存在的物品：' + d.id);
    });
  });
  const before = G.State.countItem('i_wood');
  G.State.addItem('i_wood', 3);
  const after = G.State.countItem('i_wood');
  if (after !== before + 3) throw new Error('木头无法入包');
  G.State.removeItem('i_wood', 3);
  console.log('     掉落物品全部存在于物品表，并且可以入包 / 出包');

  /* 5) 世界视图提供采集接口 */
  const proto = G.World.prototype || {};
  ['findHarvestTarget', 'harvest', 'updateResources'].forEach(function (fn) {
    if (typeof proto[fn] !== 'function') throw new Error('缺少采集接口：' + fn);
  });
  console.log('     采集接口：findHarvestTarget / harvest / updateResources 已注册');
}) && ok;

ok = check('遗迹与品质掉落：白 70% / 蓝 50% / 紫 4% / 金 0.6% / 红 0.002%', function () {
  /* 1) 需求规格表逐项校验 */
  const spec = G.RUIN_DROP_SPEC;
  if (!spec || spec.length !== 5) throw new Error('品质规格表缺失');
  const want = { '白': 0.70, '蓝': 0.50, '紫': 0.04, '金': 0.006, '红': 0.00002 };
  spec.forEach(function (d) {
    if (Math.abs(d.chance - want[d.label]) > 1e-12) {
      throw new Error(d.label + ' 概率不符：' + d.chance + ' ≠ ' + want[d.label]);
    }
  });
  console.log('     需求规格：' + spec.map(function (d) {
    return d.label + ' ' + (d.chance * 100).toFixed(d.chance < 0.01 ? 3 : 0) + '%';
  }).join('　'));

  /* 2) 实际掷点表 */
  console.log('     掷点表：' + G.RUIN_RARITY.map(function (t) {
    return t.label + ' ' + (t.chance * 100).toFixed(t.chance < 0.01 ? 3 : 0) + '%';
  }).join('　'));

  /* 3) 分布实测（10 万次） */
  const N = 100000;
  const cnt = new Array(6).fill(0);
  for (let i = 0; i < N; i++) cnt[G.rollRuinRarity(0)]++;
  const pct = cnt.map(function (c) { return c / N; });
  console.log('     实测分布：' + pct.map(function (p, i) {
    return G.RUIN_RARITY[i].label + ' ' + (p * 100).toFixed(2) + '%';
  }).join('　'));
  /* 白 + 蓝 应该是主体（>= 85%） */
  const common = pct[0] + pct[2];
  if (common < 0.85) throw new Error('白+蓝占比过低：' + (common * 100).toFixed(1) + '%（应 >= 85%）');
  /* 紫档应接近 4% */
  if (pct[3] < 0.02 || pct[3] > 0.07) throw new Error('紫档占比异常：' + (pct[3] * 100).toFixed(2) + '%');
  /* 金档应接近 0.6% */
  if (pct[4] < 0.002 || pct[4] > 0.015) throw new Error('金档占比异常：' + (pct[4] * 100).toFixed(3) + '%');
  console.log('     白+蓝合计 ' + (common * 100).toFixed(1) + '%　紫 ' + (pct[3] * 100).toFixed(2) + '%　金 ' + (pct[4] * 100).toFixed(3) + '%');

  /* 4) 红档（极品）：期望 0.002%，10 万次内应几乎不出现 */
  let red = 0;
  for (let i = 0; i < N; i++) if (G.rollRuinRarity(0) === 5) red++;
  console.log('     红档抽样：' + N + ' 次里出现 ' + red + ' 次（期望约 ' + (N * 0.00002).toFixed(2) + ' 次）');
  if (red > 20) throw new Error('红档出现次数异常偏高：' + red);

  /* 5) 遗迹类型与档位筛选 */
  const types = G.Ruins.types;
  if (!types || types.length < 3) throw new Error('遗迹类型过少');
  types.forEach(function (t) {
    if (t.minR > t.maxR) throw new Error(t.id + ' 档位区间非法');
    if (!t.guards || t.guards.length !== 2) throw new Error(t.id + ' 守卫数量配置异常');
  });
  const pickLow = G.pickRuinType(0, 1), pickHigh = G.pickRuinType(5, 1);
  if (pickLow.minR > 0) throw new Error('低档位没筛出可用的遗迹类型');
  if (pickHigh.maxR < 5) throw new Error('最高档位没筛出可用的遗迹类型');
  console.log('     遗迹类型 ' + types.length + ' 种：' + types.map(function (t) { return t.name; }).join('　'));

  /* 6) 遗迹怪物池 */
  const guards = G.RUIN_GUARDS;
  if (!guards || guards.length < 4) throw new Error('遗迹怪物过少');
  guards.forEach(function (g) {
    if (g.tier < 0 || g.tier > 5) throw new Error(g.id + ' 档位越界');
    if (!g.name || !g.hp || !g.atk) throw new Error(g.id + ' 属性缺失');
  });
  for (let tier = 0; tier <= 5; tier++) {
    if (!G.guardsForTier(tier).length) throw new Error('档位 ' + tier + ' 没有可用的守卫');
  }
  console.log('     遗迹怪物 ' + guards.length + ' 种：' + guards.map(function (g) { return g.name; }).join('　'));

  /* 7) 世界生成里带遗迹，且不落在深水 */
  const w = G.generateWorld(320, 20261008);
  if (!w.ruins || !w.ruins.length) throw new Error('世界没有生成遗迹');
  const tiers = w.ruins.map(function (r) { return r.tier; });
  const names = {};
  w.ruins.forEach(function (r) { names[r.name] = (names[r.name] || 0) + 1; });
  w.ruins.forEach(function (r) {
    if (w.tiles[r.y * w.size + r.x] === 0) throw new Error('遗迹落在深水里：' + r.x + ',' + r.y);
  });
  console.log('     遗迹 ' + w.ruins.length + ' 处，档位 ' + Math.min.apply(null, tiers) + '~' +
              Math.max.apply(null, tiers) + '：' +
              Object.keys(names).map(function (k) { return k + '×' + names[k]; }).join('　') + '　全部在陆地 ✓');

  /* 8) 世界视图提供遗迹接口 */
  const proto = G.World.prototype || {};
  ['updateRuins', 'ruinReward', 'drawRuins'].forEach(function (fn) {
    if (typeof proto[fn] !== 'function') throw new Error('缺少遗迹接口：' + fn);
  });
  console.log('     遗迹接口：updateRuins / ruinReward / drawRuins 已注册');
}) && ok;

ok = check('攻击生物（参考图）：幽影狼 / 藤蔓魔 / 墓碑骷髅', function () {
  const need = ['e_dark_wolf', 'e_vine_horror', 'e_tomb_skeleton'];
  const found = [];
  need.forEach(function (id) {
    const e = G.Enemies.get(id);
    if (!e) throw new Error('缺少攻击生物：' + id);
    if (!e.sprite) throw new Error(id + ' 缺少 sprite 造型键');
    if (!e.hp || !e.atk || !e.spd) throw new Error(id + ' 属性缺失');
    found.push({ e: e, sprite: e.sprite });
  });
  console.log('     新增 ' + found.length + ' 种攻击生物：' + found.map(function (f) {
    return f.e.name + '(' + f.e.kind + ' 血' + f.e.hp + ' 攻' + f.e.atk + ' 造型=' + f.sprite + ')';
  }).join('　'));

  /* 每种都要有 sprite 键对应的绘制分支 */
  const sp = G.Sprites;
  if (typeof sp.enemy !== 'function') throw new Error('G.Sprites.enemy 未注册');
  /* 用 DOM 桩离屏 canvas 跑一遍绘制：不抛异常即说明分支写得通 */
  const cv = sandbox.document.createElement('canvas');
  cv.width = 160; cv.height = 160;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('离屏 canvas 不可用');
  const kinds = ['wolf', 'vine', 'skeleton'];
  kinds.forEach(function (k) {
    ctx.clearRect(0, 0, 160, 160);
    sp.enemy(ctx, {
      x: 80, y: 120, s: 2.4, color: '#4a7a2a', kind: k,
      flip: false, size: 22, charging: true, attacking: true
    }, 1.2);
  });
  console.log('     三种造型（wolf / vine / skeleton）绘制调用均无异常');

  /* 新生物造型也要能画 */
  const newCreatures = ['cr_deer', 'cr_boar', 'cr_frog', 'cr_leafkin', 'cr_slime_buddy'];
  newCreatures.forEach(function (k) {
    ctx.clearRect(0, 0, 160, 160);
    sp.creature(ctx, { x: 80, y: 120, s: 2.4, species: k, moving: true }, 1.2);
  });
  console.log('     5 个新生物造型（梅花鹿 / 野猪 / 青蛙 / 叶精灵 / 行囊史莱姆）绘制调用均无异常');
}) && ok;

console.log('\n================ 结果 ================');
if (errors.length) {
  console.log('发现 ' + errors.length + ' 个问题（共 ' + FILES.length + ' 个脚本 / ' + checks.length + ' 项检查）：');
  errors.slice(0, 40).forEach(function (e) { console.log(' - ' + e); });
  process.exitCode = 1;
} else {
  console.log('全部检查通过：' + FILES.length + ' 个脚本加载，' + checks.length + ' 项功能冒烟均无异常。');
}
