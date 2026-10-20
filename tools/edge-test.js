'use strict';
/* 边界与健壮性排查（只读探测，不修改任何文件）
   覆盖：重复开图 / 开图时改尺寸 / 空背包操作 / 缩放极限 / 攻击落空 / 连续闪避 /
        地图外坐标 / 死亡复活 / 切界面残留 / 世界地图与暂停并存 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9441;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'edge-edge-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errs = []; const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errs.push('[EXC] ' + (((m.params.exceptionDetails.exception || {}).description) || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' '));
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn) => {
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : 'NORESULT';
  };
  const results = [];
  const probe = async (name, fn, expect) => {
    const before = errs.length;
    const out = await ev(fn);
    const newErr = errs.length > before;
    const okFlag = !newErr && (expect ? expect(String(out)) : String(out).indexOf('EXC') !== 0);
    results.push({ name, out: String(out).slice(0, 150), ok: okFlag, newErr });
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);
  await ev(function () {
    try { localStorage.removeItem(G.State.KEY); } catch (e) { }
    return 1;
  });
  await send('Page.reload'); await sleep(3000);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '边界'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1600);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2400);

  /* ---- A. 连续开关地图 5 次（检查覆盖层残留） ---- */
  await probe('A 连续开关地图 5 次', function () {
    const w = G.__world;
    for (let i = 0; i < 5; i++) { w.toggleMap(); w.toggleMap(); }
    const overlays = document.querySelectorAll('.map-overlay').length;
    return '残留覆盖层=' + overlays + ' MapView.isOpen=' + G.MapView.isOpen;
  }, (s) => /残留覆盖层=0/.test(s));

  /* ---- B. 开图状态下改窗口尺寸 ---- */
  await probe('B 开图时窗口尺寸变化', function () {
    const w = G.__world;
    w.toggleMap();
    G.MapView.W = 800; G.MapView.H = 500;             /* 模拟尺寸突变 */
    G.MapView.draw();
    const ok = G.MapView.isOpen;
    w.toggleMap();
    return '绘图未抛错, 已关闭=' + !G.MapView.isOpen;
  }, (s) => /未抛错/.test(s));

  /* ---- C. 缩放极限（超范围输入） ---- */
  await probe('C 缩放极限 clamp', function () {
    const w = G.__world;
    w.toggleMap();
    const mv = G.MapView;
    mv.setZoom(9999); const hi = mv.zoom;
    mv.setZoom(-5); const lo = mv.zoom;
    mv.setZoom(0); const zero = mv.zoom;
    w.toggleMap();
    return '超大->' + hi + ' 负数->' + lo + ' 零->' + zero;
  }, (s) => /超大->4 负数->0\.05/.test(s));

  /* ---- D. 空背包按 F（无药剂） ---- */
  await probe('D 无药剂时按 F', function () {
    const w = G.__world;
    G.State.state.items = {};
    w.usePotion();
    return 'HP=' + Math.round(w.player.hp) + ' 未崩溃';
  }, (s) => /未崩溃/.test(s));

  /* ---- E. 无掉落物时按 E ---- */
  await probe('E 无掉落物时按 E', function () {
    const w = G.__world;
    w.loot.length = 0;
    w.interact();
    return 'loot=' + w.loot.length + ' 未崩溃';
  }, (s) => /未崩溃/.test(s));

  /* ---- F. 攻击落空（朝反方向挥砍） ---- */
  await probe('F 攻击落空不报错', function () {
    const w = G.__world, p = w.player;
    w.mobs.length = 0;
    w.mobs.push({ x: p.x + 19, y: p.y, face: -1, ph: 0, def: G.Enemies.list[0], etype: 'melee', color: '#fff',
      size: 18, hp: 100, maxHp: 100, atk: 1, spd: 0, cd: 99, hurtT: 0, hitT: 0, elite: false, lvl: 1 });
    const hp0 = w.mobs[0].hp;
    for (let i = 0; i < 10; i++) { p.atkT = 0; p.aim = Math.PI; w.attack(); }
    return '反方向攻击后敌人HP=' + w.mobs[0].hp + '（应仍为 ' + hp0 + '）';
  }, (s) => /应仍为/.test(s));

  /* ---- G. 连续闪避（体力耗尽） ---- */
  await probe('G 连续闪避耗尽体力', function () {
    const w = G.__world, p = w.player;
    p.stamina = 25;
    let n = 0;
    for (let i = 0; i < 10; i++) { p.dodgeCd = 0; w.dodge(); n++; }
    return '闪避尝试 10 次, 体力=' + Math.round(p.stamina) + ' 坐标有限=' + isFinite(p.x) + ',' + isFinite(p.y);
  }, (s) => /坐标有限=true,true/.test(s));

  /* ---- H. 强行把玩家推到水里（深水不可站立） ---- */
  await probe('H 玩家被推入深水后的表现', function () {
    const w = G.__world, p = w.player;
    /* 找一块深水 */
    let found = null;
    for (let y = 0; y < w.world.size && !found; y++) {
      for (let x = 0; x < w.world.size; x++) {
        if (w.world.tiles[y * w.world.size + x] === 0) { found = { x: x, y: y }; break; }
      }
    }
    if (!found) return '世界里没有深水（异常）';
    p.x = found.x * 16 + 8; p.y = found.y * 16 + 8;
    const inWater = !w.canStand(p.x, p.y);
    /* 试着往四周走，看能否脱困 */
    w.keys['d'] = true;
    for (let i = 0; i < 60; i++) w.update(1 / 60);
    w.keys['d'] = false;
    return '深水格 canStand=' + inWater + ' 尝试移动后 canStand=' + w.canStand(p.x, p.y);
  }, (s) => /canStand=false/.test(s));

  /* ---- I. 坐标越界保护 ---- */
  await probe('I 坐标越界后仍受 clamp 保护', function () {
    const w = G.__world, p = w.player;
    const max = w.world.size * 16;
    p.x = -9999; p.y = max + 9999;
    w.keys['a'] = true;
    for (let i = 0; i < 30; i++) w.update(1 / 60);
    w.keys['a'] = false;
    const inRange = p.x >= 0 && p.x <= max && p.y >= 0 && p.y <= max;
    return '坐标=(' + Math.round(p.x) + ',' + Math.round(p.y) + ') 在范围内=' + inRange;
  }, (s) => /在范围内=true/.test(s));

  /* ---- J. 死亡复活流程 ---- */
  await probe('J 生命归零触发复活', function () {
    const w = G.__world, p = w.player;
    p.hp = 1; p.invuln = 0;
    w.hurtPlayer(9999);
    return 'HP=' + Math.round(p.hp) + '/' + p.maxHp + ' 已回到出生点=' +
      (Math.abs(p.x - (w.world.spawn.x * 16 + 8)) < 2 && Math.abs(p.y - (w.world.spawn.y * 16 + 8)) < 2);
  }, (s) => /已回到出生点=true/.test(s));

  /* ---- K. 离开世界界面：循环与监听是否清理 ---- */
  await probe('K 离开界面后清理', function () {
    G.Screen.go('home', {});
    return 'G.__world=' + (G.__world === null ? 'null' : typeof G.__world) + ' bodyClass="' + document.body.className + '"';
  }, (s) => /G\.__world=null/.test(s));
  await sleep(600);
  await probe('K2 离开后无残留地图覆盖层', function () {
    return '覆盖层=' + document.querySelectorAll('.map-overlay').length;
  }, (s) => /覆盖层=0/.test(s));

  /* ---- L. 反复进出世界 3 次（检查 rAF / 监听泄漏迹象）
         注意：切屏有 320ms 淡出，旧节点会短暂留在 DOM 上，
         因此每次切换间隔要大于淡出时间，且断言前等 DOM 稳定。 ---- */
  await probe('L 反复进出世界 3 次', async function () {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 3; i++) {
      G.Screen.go('world', {}); await wait(700);
      G.Screen.go('home', {}); await wait(700);
    }
    await wait(600);
    return '结束时 G.__world=' + (G.__world === null ? 'null' : 'still-set') +
           ' 世界画面数=' + document.querySelectorAll('.world-wrap').length +
           ' 画布数=' + document.querySelectorAll('.world-wrap canvas').length;
  }, (s) => /世界画面数=0/.test(s));

  await sleep(900);
  const hardErrs = errs.filter((e) => e.indexOf('[EXC]') === 0);
  console.log('========== 边界场景排查结果 ==========');
  results.forEach((r) => console.log((r.ok && !r.newErr ? 'ok   ' : 'FAIL ') + r.name + '  → ' + r.out));
  console.log('--------------------------------------');
  console.log('通过 ' + results.filter((r) => r.ok && !r.newErr).length + ' / ' + results.length);
  if (hardErrs.length) {
    console.log('捕获到运行时异常 ' + hardErrs.length + ' 条：');
    hardErrs.slice(0, 8).forEach((e) => console.log('  ' + e.slice(0, 220)));
  } else console.log('未捕获到任何运行时异常');
  const badLogs = logs.filter((l) => l.indexOf('error') >= 0 || l.indexOf('warn') >= 0);
  if (badLogs.length) { console.log('控制台告警/错误：'); badLogs.slice(0, 6).forEach((l) => console.log('  ' + l.slice(0, 180))); }
  else console.log('控制台无 error / warn');
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
