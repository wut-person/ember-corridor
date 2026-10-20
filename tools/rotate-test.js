'use strict';
/* 旋转体系专项：WASD 八方向原地转身 / 滚轮 ±45° / T 切换模式 / 朝向指示器 */
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9531;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'edge-rot-' + Date.now()),
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
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'tools', 'shots', 'rot-' + n + '.png'), Buffer.from(s.data, 'base64')); };
  const results = [];
  const ck = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + '  ' + info); results.push(ok); };

  /** 按住指定方向键 runMs 毫秒，然后全部松开，返回收敛后的朝向 */
  async function press(keys, runMs) {
    await ev(function () { const w = G.__world; ['w', 'a', 's', 'd'].forEach(function (k) { w.keys[k] = false; }); return 1; });
    await sleep(120);
    await ev(function (arg) { const w = G.__world; for (const ch of arg) w.keys[ch] = true; return 1; }, keys);
    await sleep(runMs);
    const st = await ev(function () {
      const p = G.__world.player;
      return { aim: p.aim, want: p.aimWant, name: G.__world.faceName(p.aim), x: Math.round(p.x), y: Math.round(p.y) };
    });
    await ev(function () { const w = G.__world; ['w', 'a', 's', 'd'].forEach(function (k) { w.keys[k] = false; }); return 1; });
    await sleep(120);
    return st;
  }

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL }); await sleep(3200);
  await ev(function () { const i = document.querySelector('.login-panel input.input'); if (i) i.value = '旋转'; const b = document.querySelector('.login-panel .btn.primary'); if (b) b.click(); return 1; });
  await sleep(1800);
  await ev(function () { G.Screen.go('world', {}); return 1; });
  await sleep(2500);

  ck('旋转模式默认开启', await ev(function () { return G.__world.rotateMode === true; }),
    'rotateMode=' + await ev(function () { return G.__world.rotateMode; }));

  /* 八方向逐个测试（用较长按键时间保证收敛） */
  const dirs = [
    ['d', '东', 0], ['s', '南', Math.PI / 2], ['a', '西', Math.PI], ['w', '北', -Math.PI / 2],
    ['sd', '东南', Math.PI / 4], ['as', '西南', Math.PI * 3 / 4],
    ['wa', '西北', -Math.PI * 3 / 4], ['wd', '东北', -Math.PI / 4]
  ];
  for (const [keys, wantName, wantAng] of dirs) {
    const st = await press(keys, 600);
    let da = Math.abs(st.aim - wantAng);
    while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    ck('按 ' + keys.toUpperCase().split('').join('+') + ' 转向', da < 0.2,
      '期望 ' + wantName + '  实际 ' + st.name + '(' + Number(st.aim).toFixed(3) + ')  误差 ' + da.toFixed(3) + ' rad');
  }

  /* 原地转身：摆回东再转西，朝向变化但位移应接近 0（用极短按键） */
  await press(['d'], 400);
  const p0 = await ev(function () { const p = G.__world.player; return Math.round(p.x) + ',' + Math.round(p.y); });
  /* 直接设 keys 一帧就松开，模拟「只转身不走路」 */
  const turnOnly = await ev(function () {
    const w = G.__world, p = w.player;
    const x0 = p.x, y0 = p.y;
    w.keys['a'] = true;
    w.update(1 / 60);
    w.keys['a'] = false;
    for (let i = 0; i < 30; i++) w.update(1 / 60);   /* 松手后继续转向收敛 */
    return { dx: Math.round(p.x - x0), name: w.faceName(p.aim), aim: p.aim };
  });
  ck('原地可转身（几乎不位移）', Math.abs(turnOnly.dx) <= 4 && turnOnly.name === '西',
    '位移 ' + turnOnly.dx + 'px，朝向 ' + turnOnly.name);
  await shot('01-facing');

  /* 滚轮 ±45° */
  const b1 = await ev(function () { return G.__world.faceName(G.__world.player.aimWant); });
  await ev(function () { G.__world.faceStep(1); return 1; });
  await sleep(150);
  const a1 = await ev(function () { return G.__world.faceName(G.__world.player.aimWant); });
  await ev(function () { G.__world.faceStep(-1); return 1; });
  await sleep(150);
  const a2 = await ev(function () { return G.__world.faceName(G.__world.player.aimWant); });
  ck('滚轮 ±45° 微调', a1 !== b1 && a2 === b1, b1 + ' → 顺时针 ' + a1 + ' → 逆时针 ' + a2);

  /* 连续顺时针转一圈应回到原点（比 aimWant，因为 aim 需要时间平滑收敛） */
  const roundTrip = await ev(function () {
    const w = G.__world;
    const start = w.faceName(w.player.aimWant);
    const seq = [start];
    for (let i = 0; i < 8; i++) {
      w.faceStep(1);
      seq.push(w.faceName(w.player.aimWant));
    }
    return { seq: seq.join(' → '), same: seq[0] === seq[seq.length - 1] };
  });
  ck('连转 8 次回到原朝向', roundTrip.same === true, roundTrip.seq);

  /* 逆向转 4 次 = 顺时针转 4 次的反向 */
  const revTrip = await ev(function () {
    const w = G.__world;
    const a = w.faceName(w.player.aimWant);
    for (let i = 0; i < 4; i++) w.faceStep(-1);
    const b = w.faceName(w.player.aimWant);
    for (let i = 0; i < 4; i++) w.faceStep(1);
    const c = w.faceName(w.player.aimWant);
    return { info: a + ' →逆 4 次→ ' + b + ' →顺 4 次→ ' + c, ok: a === c };
  });
  ck('逆向转 4 次可原路返回', revTrip.ok === true, revTrip.info);

  /* T 键切换 */
  await ev(function () { G.__world.toggleRotate(); return 1; });
  await sleep(150);
  const off = await ev(function () { return G.__world.rotateMode; });
  await ev(function () { G.__world.toggleRotate(); return 1; });
  await sleep(150);
  const on = await ev(function () { return G.__world.rotateMode; });
  ck('T 键切换旋转模式', off === false && on === true, '关→' + off + '  开→' + on);

  /* 关掉旋转模式后，朝向应跟随移动方向 */
  await ev(function () { G.__world.rotateMode = false; return 1; });
  await press(['a'], 500);
  const follow = await ev(function () { return G.__world.faceName(G.__world.player.aim); });
  await ev(function () { G.__world.rotateMode = true; return 1; });
  ck('关闭旋转后朝向跟随移动', follow === '西', '向西移动时朝向 = ' + follow);
  await shot('02-after');

  console.log('');
  console.log('通过 ' + results.filter(Boolean).length + ' / ' + results.length);
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0, 160) : ''));
  ws.close(); proc.kill(); await sleep(200);
  process.exit(results.every(Boolean) && errs.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
