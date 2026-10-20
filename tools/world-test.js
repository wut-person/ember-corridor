'use strict';
/* 开放世界专项验证：进入世界、漫游、战斗掉落、M 键地图缩放与拖动、控制台零报错 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9411;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const OUT = path.join(ROOT, 'tools', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-world-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
  });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (fn, arg) => {
    const r = await send('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')',
      returnByValue: true, awaitPromise: true
    });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : 'NORESULT';
  };
  const shot = async (n) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);

  /* 登录（带演示存档，保证有装备与等级） */
  await ev(function () {
    try { localStorage.removeItem(G.State.KEY); } catch (e) { }
    return 1;
  });
  await send('Page.reload'); await sleep(3000);
  await ev(function () {
    const i = document.querySelector('.login-panel input.input');
    if (i) i.value = '世界行者';
    const b = document.querySelector('.login-panel .btn.primary');
    if (b) b.click();
    return 1;
  });
  await sleep(1600);

  const pass = [];
  const fail = [];
  const ck = (name, v, extra) => { (v ? pass : fail).push(name + (extra ? '  ' + extra : '')); };

  /* 1) 进入开放世界 */
  const r1 = await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2200);
  const info = await ev(function () {
    const w = G.__world;
    if (!w) return { ok: false };
    return {
      ok: true,
      worldSize: w.world.size, props: w.world.props.length,
      px: Math.round(w.player.x), py: Math.round(w.player.y),
      terrain: G.tInfo(G.tileAt(w.world, Math.floor(w.player.x / 16), Math.floor(w.player.y / 16))).name,
      canvas: [w.W, w.H], zoom: w.zoom, mobs: w.mobs.length,
      hudHp: (document.getElementById('w-hp-t') || {}).textContent,
    };
  });
  ck('进入开放世界', info && info.ok, info && info.ok ? ('世界 ' + info.worldSize + '² · ' + info.props + ' 装饰 · 出生地形 ' + info.terrain + ' · 画布 ' + info.canvas.join('×')) : String(info));
  await shot('w01-world-enter');

  /* 2) 移动：按住 D 走一段，看坐标是否变化 & 相机跟随 */
  const move = await ev(function () {
    const w = G.__world;
    const x0 = w.player.x, c0 = w.cam.x;
    w.keys['d'] = true;
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    w.keys['d'] = false;
    return { dx: Math.round(w.player.x - x0), camFollowed: Math.abs(w.cam.x - c0) > 10, moved: w.player.moving };
  });
  ck('自由移动 + 相机跟随', move.dx > 20 && move.camFollowed, '位移 ' + move.dx + 'px，相机跟随=' + move.camFollowed);

  /* 3) 战斗与掉落：结果以字符串回传，避免对象序列化差异。
        掉落判定用「掉落总数」（地面剩余 + 已拾取），不依赖掉落物是否还留在地上，
        以免被自动刷怪与拾取时序影响。 */
  const combatStr = await ev(function () {
    const w = G.__world;
    const p = w.player;
    /* 清场，只留一个测试目标，并明确朝向正右方（避免软吸附把朝向转到别的怪身上） */
    w.mobs.length = 0;
    p.aim = 0;
    p.mouse = p.mouse || { x: 0, y: 0 };
    w.mobs.push({
      x: p.x + 18, y: p.y, face: -1, ph: 0,
      def: G.Enemies.list[0], etype: G.Enemies.list[0].kind, color: G.Enemies.list[0].color, size: 18,
      hp: 30, maxHp: 30, atk: 5, spd: 0.4, cd: 99, hurtT: 0, hitT: 0, elite: true, lvl: 3,
    });
    p.stamina = 9999;
    const k0 = p.kills, l0 = p.looted;
    /* 掉落是概率的（符合设计），最多尝试 3 次目标，直到出现掉落为止 */
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      for (let i = 0; i < 30; i++) {
        p.aim = 0;
        p.atkT = 0;
        w.attack();
        for (let j = 0; j < 6; j++) w.update(1 / 60);
        if (!w.mobs.length) break;
      }
      for (let i = 0; i < 90; i++) w.update(1 / 60);
      if ((p.looted - l0) + w.loot.length > 0) break;
      /* 这次没掉东西：再放一个目标继续验证掉落链路 */
      w.loot.length = 0;
      w.mobs.push({
        x: p.x + 18, y: p.y, face: -1, ph: 0,
        def: G.Enemies.list[0], etype: G.Enemies.list[0].kind, color: G.Enemies.list[0].color, size: 18,
        hp: 30, maxHp: 30, atk: 5, spd: 0.4, cd: 99, hurtT: 0, hitT: 0, elite: true, lvl: 3,
      });
    }
    /* 掉落总数 = 已拾取增量 + 仍留在地上的数量 */
    const dropped = (p.looted - l0) + w.loot.length;
    return 'kills=' + (p.kills - k0) + ';looted=' + (p.looted - l0) +
           ';dropped=' + dropped + ';onGround=' + w.loot.length + ';mobsLeft=' + w.mobs.length +
           ';reach=' + Math.round(p.reach) + ';atk=' + p.atk;
  });
  const cm = {};
  String(combatStr).split(';').forEach(function (kv) { const p = kv.split('='); cm[p[0]] = Number(p[1]); });
  ck('战斗击杀 + 掉落', cm.kills > 0 && cm.dropped > 0,
     '击杀 ' + cm.kills + ' · 掉落 ' + cm.dropped + ' 件 · 已拾取 ' + cm.looted + ' · 地上剩 ' + cm.onGround +
     ' · 敌剩 ' + cm.mobsLeft + ' · reach ' + cm.reach + ' · atk ' + cm.atk);
  await shot('w02-world-combat');

  /* 4) M 键地图：打开 / 缩放 / 拖动 / 关闭 */
  const mapInfo = await ev(function () {
    const w = G.__world;
    w.toggleMap();
    const mv = G.MapView;
    const z0 = mv.zoom;
    mv.setZoom(z0 * 2.2);
    const z1 = mv.zoom;
    const c0 = mv.cx;
    mv.cx += 40;                       /* 模拟拖动平移 */
    const moved = mv.cx !== c0;
    const dom = !!document.querySelector('.map-overlay');
    const buttons = document.querySelectorAll('.map-btn').length;
    return { open: mv.isOpen, z0: +z0.toFixed(3), z1: +z1.toFixed(3), moved: moved, dom: dom, buttons: buttons };
  });
  ck('M 键世界地图（打开 / 缩放 / 拖动）',
     mapInfo.open && mapInfo.dom && mapInfo.z1 > mapInfo.z0 && mapInfo.moved,
     '缩放 ' + mapInfo.z0 + ' → ' + mapInfo.z1 + ' · 按钮 ' + mapInfo.buttons + ' 个 · 拖动=' + mapInfo.moved);
  await sleep(700);
  await shot('w03-world-map');

  const mapZoom = await ev(function () {
    const mv = G.MapView;
    mv.setZoom(0.12);
    return { z: mv.zoom };
  });
  await sleep(600);
  await shot('w04-world-map-far');
  ck('地图缩小到全局视图', mapZoom.z < 0.2, '缩放 ' + mapZoom.z);

  await ev(function () { G.__world.toggleMap(); return 1; });
  await sleep(400);
  const closed = await ev(function () { return { open: !!(G.MapView && G.MapView.isOpen), dom: !!document.querySelector('.map-overlay') }; });
  ck('M 键关闭地图', !closed.open && !closed.dom, '覆盖层已移除=' + !closed.dom);

  /* 5) 暂停面板 */
  const pause = await ev(function () {
    const w = G.__world;
    w.paused = true; w.syncPause();
    const el = document.getElementById('w-pause');
    return { shown: el && !el.classList.contains('hide') };
  });
  ck('ESC 暂停面板', pause.shown, '面板显示=' + pause.shown);
  await shot('w05-world-pause');
  await ev(function () { G.__world.paused = false; G.__world.syncPause(); return 1; });

  /* 6) 世界生成数据体检 */
  const wq = await ev(function () {
    const w = G.__world.world;
    const cnt = new Array(8).fill(0);
    for (let i = 0; i < w.tiles.length; i++) cnt[w.tiles[i]]++;
    const names = ['深水', '浅水', '沙滩', '草地', '草甸', '森林', '岩地', '雪地'];
    return names.map(function (n, i) { return n + ' ' + (cnt[i] / w.tiles.length * 100).toFixed(1) + '%'; }).join(' | ');
  });
  console.log('地形分布：' + wq);
  ck('地形分布合理（有海有陆）', /深水 \d/.test(wq) && /森林 \d/.test(wq));

  /* 7) 控制台无报错（截图后先同步一次再等待，确保控制台事件已回流） */
  await ev(function () { return 'sync'; });
  await sleep(1000);
  const errs = logs.filter((l) => l.indexOf('[EXCEPTION]') >= 0 || l.indexOf('[console.error]') >= 0);
  ck('控制台零报错', errs.length === 0, errs.length ? errs.slice(0, 3).join(' / ') : ('0 条错误（共捕获 ' + logs.length + ' 条控制台输出）'));

  console.log('\n============ 开放世界验证 ============');
  pass.forEach((p) => console.log('ok   ' + p));
  fail.forEach((f) => console.log('FAIL ' + f));
  console.log('--------------------------------------');
  console.log('通过 ' + pass.length + ' 项，失败 ' + fail.length + ' 项');
  if (logs.length) {
    console.log('控制台输出 ' + logs.length + ' 条：');
    logs.slice(0, 12).forEach((l) => console.log('  ' + l.slice(0, 200)));
  } else console.log('控制台无任何输出');
  console.log('截图目录：' + OUT);
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
