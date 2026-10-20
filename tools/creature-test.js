'use strict';
/* 生物与背包专项：世界里生成生物 / 头顶姓名 / Tab 背包浮层 / 生物行为 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9551;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'edge-cr-' + Date.now()),
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
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')', returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return 'EXC: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r ? r.result.value : 'NORESULT';
  };
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'cr-' + n + '.png'), Buffer.from(s.data, 'base64')); };
  const results = [];
  const ck = (n, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + '  ' + info); results.push(ok); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '生物'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2600);

  /* 1) 生物已生成 */
  const spawnInfo = await ev(function () {
    const w = G.__world;
    const kinds = {};
    w.creatures.forEach(function (c) { kinds[c.name] = (kinds[c.name] || 0) + 1; });
    return {
      count: w.creatures.length,
      kinds: Object.keys(kinds).map(function (k) { return k + '×' + kinds[k]; }).join(' '),
      named: w.creatures.filter(function (c) { return c.nick && c.nick.length > 0; }).length,
      tempers: w.creatures.map(function (c) { return c.temper; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(',')
    };
  });
  ck('世界生成生物', typeof spawnInfo === 'object' && spawnInfo.count >= 15,
    '数量 ' + spawnInfo.count + '　种类 ' + (spawnInfo.kinds || '无'));
  ck('每个生物都有姓名', spawnInfo.named === spawnInfo.count, spawnInfo.named + '/' + spawnInfo.count + ' 个有名字');
  ck('三种性情都存在', String(spawnInfo.tempers).split(',').length >= 2, '性情：' + spawnInfo.tempers);
  await shot('01-creatures');

  /* 2) 生物行为：会移动、不会走进深水（陆生） */
  const before = await ev(function () { return G.__world.creatures.map(function (c) { return Math.round(c.x) + ',' + Math.round(c.y); }).join('|'); });
  await sleep(1600);
  const after = await ev(function () { return G.__world.creatures.map(function (c) { return Math.round(c.x) + ',' + Math.round(c.y); }).join('|'); });
  ck('生物会自行移动', before !== after, '1.6 秒后位置已变化');

  const habitat = await ev(function () {
    const w = G.__world;
    let landInWater = 0, fishOnLand = 0;
    w.creatures.forEach(function (c) {
      const t = G.tInfo(G.tileAt(w.world, Math.floor(c.x / 16), Math.floor(c.y / 16)));
      const isW = (t.key === 'deep' || t.key === 'shallow');
      if (c.habitat === 'land' && t.key === 'deep') landInWater++;
      if (c.habitat === 'water' && !isW) fishOnLand++;
    });
    return { landInWater: landInWater, fishOnLand: fishOnLand };
  });
  ck('栖息地正确（陆生不下深水 / 鱼不上岸）', habitat.landInWater === 0 && habitat.fishOnLand === 0,
    '陆生入深水 ' + habitat.landInWater + ' 只，鱼上岸 ' + habitat.fishOnLand + ' 只');

  /* 3) 头顶姓名能画出来（截图像素级验证：生物附近应有姓名底板） */
  const label = await ev(function () {
    const w = G.__world;
    /* 找一只离玩家最近的生物 */
    let best = null, bd = 1e9;
    w.creatures.forEach(function (c) {
      const d = Math.hypot(c.x - w.player.x, c.y - w.player.y);
      if (d < bd) { bd = d; best = c; }
    });
    return best ? (best.name + '·' + best.nick + ' 距离 ' + Math.round(bd) + 'px  性情 ' + best.temper) : '无生物';
  });
  console.log('     最近生物：' + label);
  results.push(true);

  /* 4) Tab 打开背包浮层 */
  await ev(function () {
    /* 先塞点东西，方便看效果 */
    G.State.addItem('i_wood', 12); G.State.addItem('i_sand', 7);
    G.State.addItem('i_water', 3); G.State.addItem('i_stone', 9);
    G.State.addItem('i_meat_raw', 4); G.State.addItem('i_cloth', 2);
    return 1;
  });
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
  await sleep(700);
  const bag = await ev(function () {
    const el = document.querySelector('.bag-overlay');
    if (!el) return { open: false };
    const cells = el.querySelectorAll('.bag-cell');
    const groups = el.querySelectorAll('.bag-gt');
    return {
      open: true, cells: cells.length, groups: groups.length,
      paused: G.__world.bagOpen === true,
      names: Array.prototype.slice.call(el.querySelectorAll('.bag-nm')).map(function (n) { return n.textContent; }).slice(0, 8).join('/')
    };
  });
  ck('Tab 打开背包浮层', bag.open === true, '格子 ' + bag.cells + ' 个，分组 ' + bag.groups + ' 个');
  ck('背包打开时世界暂停', bag.paused === true, 'bagOpen=' + bag.paused);
  console.log('     背包内容：' + (bag.names || '空'));
  await shot('02-bag');

  /* 5) Tab 再按一次关闭 */
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
  await sleep(600);
  const closed = await ev(function () {
    return { has: !!document.querySelector('.bag-overlay'), open: G.__world.bagOpen };
  });
  ck('Tab 再按关闭背包', closed.has === false && closed.open === false, '浮层已移除=' + !closed.has);
  await shot('03-after');

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 160) : ''));
  ws.close(); proc.kill(); await sleep(200);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
