'use strict';
/* 动作轨迹光效专项：按武器类型上色 + 三段连招的剑气与旋风环 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const cleanup = require('./lib/cleanup');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9681;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const sb = cleanup.begin();
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(sb, 'vfx-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception || {}).description) || m.params.exceptionDetails.text);
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn, arg) => {
    const r = await send('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')',
      returnByValue: true, awaitPromise: true
    });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : null;
  };
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'vfx-' + n + '.png'), Buffer.from(s.data, 'base64')); };
  const results = []; const ck = (n, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + '  ' + info); results.push(ok); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '光效'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2600);

  /* 1) 光效色表：每种武器类型都要有自己的颜色 */
  const tones = await ev(function () {
    const w = G.__world;
    const types = ['blade', 'greatsword', 'spear', 'axe', 'hammer', 'bow', 'crossbow', 'staff', 'gauntlet', 'scythe', 'whip'];
    const out = {};
    types.forEach(function (t) {
      w.player.wtype = t;
      w.fx.length = 0;
      w.player.atkT = 0; w.player.comboT = 0; w.player.stamina = 999;
      w.player.aim = 0; w.player.aimWant = 0;
      w.attack();
      const tr = w.fx.filter(function (f) { return f.kind === 'trail'; })[0];
      out[t] = tr ? tr.tone : '无轨迹';
    });
    return out;
  });
  const toneKeys = (tones && typeof tones === 'object') ? Object.keys(tones) : [];
  const allHaveTone = toneKeys.length === 11 && toneKeys.every(function (k) { return /^#[0-9a-f]{6}$/i.test(String(tones[k])); });
  ck('11 种武器都有专属光效色', allHaveTone, toneKeys.map(function (k) { return k + '=' + tones[k]; }).join(' '));

  /* 2) 三个关键色对齐参考图 */
  ck('剑 = 蓝白剑气', tones && tones.blade === '#8fd8ff', 'blade = ' + (tones && tones.blade));
  ck('弓 = 绿色', tones && tones.bow === '#6cf08a', 'bow = ' + (tones && tones.bow));
  ck('法杖 = 紫色', tones && tones.staff === '#c07cff', 'staff = ' + (tones && tones.staff));

  /* 3) 三段连招：每段都有轨迹，第三段额外出剑气 + 旋风环 */
  const combo = await ev(function () {
    const w = G.__world;
    const out = [];
    w.player.wtype = 'blade';
    w.player.comboT = 0;
    w.player.comboStep = 0;
    for (let step = 1; step <= 3; step++) {
      w.fx.length = 0;
      /* 让 comboStep 停在上一段，attack() 会推进到下一段 */
      w.player.comboStep = step - 1;
      w.player.comboT = 0.8;
      w.player.atkT = 0;
      w.player.stamina = 999;
      w.player.aim = 0; w.player.aimWant = 0;
      w.attack();
      const n = { trail: 0, qi: 0, ring: 0 };
      w.fx.forEach(function (f) { if (n[f.kind] != null) n[f.kind]++; });
      out.push('第' + step + '刀(step=' + w.player.comboStep + ') trail=' + n.trail + ' qi=' + n.qi + ' ring=' + n.ring);
    }
    return out.join(' | ');
  });
  const comboOk = /第3刀\(step=3\) trail=1 qi=1 ring=0/.test(combo || '');
  ck('三段连招：第三段必出剑气（挥空也有）', comboOk, combo);

  /* 3b) 第三段打中时还要多一圈旋风环 */
  const ringOnHit = await ev(function () {
    const w = G.__world;
    const p = w.player;
    w.player.wtype = 'blade';
    w.fx.length = 0;
    /* 面前放一个靶子，保证这一刀能打中 */
    const m = {
      x: p.x + 30, y: p.y, hp: 99999, maxHp: 99999, size: 20, etype: 'melee',
      def: { sprite: null }, color: '#888', dead: false, hurtT: 0, hitT: 0, cd: 99
    };
    w.mobs.push(m);
    p.comboStep = 2; p.comboT = 0.85;
    p.atkT = 0; p.stamina = 999; p.aim = 0; p.aimWant = 0;
    w.attack();
    const n = { qi: 0, ring: 0 };
    w.fx.forEach(function (f) { if (n[f.kind] != null) n[f.kind]++; });
    /* 清掉靶子，免得影响后续截图 */
    const idx = w.mobs.indexOf(m);
    if (idx >= 0) w.mobs.splice(idx, 1);
    return n.qi + '/' + n.ring;
  });
  ck('第三段命中时出旋风环', ringOnHit === '1/1', 'qi/ring = ' + ringOnHit);

  /* 4) 命中火花带武器色 */
  const spark = await ev(function () {
    const w = G.__world;
    const p = w.player;
    w.player.wtype = 'staff';
    w.fx.length = 0;
    const m = {
      x: p.x + 30, y: p.y, hp: 9999, maxHp: 9999, size: 20, etype: 'melee',
      def: { sprite: null }, color: '#888', dead: false, hurtT: 0, hitT: 0, cd: 1
    };
    w.mobs.push(m);
    p.atkT = 0; p.comboT = 0; p.stamina = 999; p.aim = 0; p.aimWant = 0;
    w.attack();
    const h = w.fx.filter(function (f) { return f.kind === 'hit'; })[0];
    return h ? h.tone : '无火花';
  });
  ck('命中火花带武器色', spark === '#c07cff', '法杖命中火花 = ' + spark);

  /* 5) 每种武器的光效都能真的画出来（跑一遍渲染不抛异常） */
  const drew = await ev(function () {
    const w = G.__world;
    const types = ['blade', 'greatsword', 'spear', 'axe', 'hammer', 'bow', 'crossbow', 'staff', 'gauntlet', 'scythe', 'whip'];
    let n = 0;
    types.forEach(function (t) {
      w.player.wtype = t;
      w.fx.length = 0;
      w.player.comboStep = 2; w.player.comboT = 0.8;
      w.player.atkT = 0; w.player.stamina = 999;
      w.player.aim = 0; w.player.aimWant = 0;
      w.attack();
      w.render();          /* 真的跑一次渲染 */
      n++;
    });
    return n;
  });
  ck('11 种武器的光效渲染均无异常', drew === 11, drew + ' 种全部渲染通过');

  /* 6) 截图：先把世界冻结，再摆一套光效（否则光效在等待期间就过期了）
         rAF 循环在 paused 时只渲染不更新，正好用来定格 */
  const freeze = async (wtype, aimRad, frames, tag) => {
    await ev(function (a) {
      const w = G.__world;
      const p = w.player;
      w.paused = false;
      w.player.wtype = a.wtype;
      p.aim = a.aim; p.aimWant = a.aim;
      w.fx.length = 0;
      w.floats.length = 0;
      p.comboStep = 2; p.comboT = 0.85;
      p.atkT = 0; p.stamina = 999;
      w.attack();
      for (let i = 0; i < a.frames; i++) w.update(1 / 60);
      /* 冻结：只渲染不再推进时间 */
      w.paused = true;
      return 1;
    }, { wtype: wtype, aim: aimRad, frames: frames });
    await sleep(260);
    await shot(tag);
    await ev(function () { G.__world.paused = false; return 1; });
  };

  await freeze('blade', 0, 4, '01-sword-qi');
  await freeze('bow', Math.PI * 0.5, 4, '02-bow-green');
  await freeze('staff', Math.PI, 4, '03-staff-purple');
  await freeze('axe', -Math.PI * 0.4, 4, '04-axe-orange');

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 200) : ''));
  ws.close(); proc.kill(); await sleep(400);
  cleanup.end(true);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
